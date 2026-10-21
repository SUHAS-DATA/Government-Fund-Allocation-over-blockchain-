import os
import re
import collections
import random
import string
import hashlib
from datetime import datetime, timezone
from typing import Optional
from pymongo import ReturnDocument
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc, compute_project_progress, get_active_financial_year, reconcile_project_released_amount
from auth_middleware import require_roles
import blockchain_service as bcs
import qr_service
from realtime_manager import realtime_manager
import bank_account_service as bas

router = APIRouter()
district_bp = router

def normalize_str(s: str) -> str:
    if not s:
        return ""
    return re.sub(r'\s+', ' ', str(s).strip())

def generate_project_id(district_name):
    clean_dist = "".join(filter(str.isalnum, district_name))[:3].upper()
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"PRJ-{clean_dist}-{rand_suffix}"

def check_district_access(target_district, current_user):
    """
    Strictly verifies that if the authenticated user is a District Officer,
    they can only access and perform actions within their assigned district.
    Higher Authorities (SUPER_ADMIN) have global cross-district access.
    """
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")

    if user_role == "SUPER_ADMIN":
        return True, None

    if user_role != "DISTRICT":
        return False, "Access Denied: District Officer role required for this resource."

    if not user_dist:
        return False, "Access Denied: No district assigned to this user profile."

    if target_district and target_district.strip().lower() != user_dist.strip().lower():
        return False, f"Unauthorized / Access Denied: You are only authorized to access your assigned district '{user_dist}'. Access to '{target_district}' is forbidden."

    return True, None

@router.get("/dashboard")
async def dashboard(
    district: Optional[str] = Query(None),
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    selected_dist = district
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code")
    user_state_name = current_user.get("state_name")

    if not user_state and user_dist:
        dist_record = db.districts.find_one({
            "$or": [{"name": user_dist}, {"name": {"$regex": f"^{re.escape(user_dist)}$", "$options": "i"}}]
        })
        if dist_record:
            user_state = dist_record.get("state_code", "KA")
            user_state_name = dist_record.get("state_name", "Karnataka")
        else:
            user_state = "KA"
            user_state_name = "Karnataka"
    elif not user_state:
        user_state = "KA"
        user_state_name = "Karnataka"

    if user_role == "DISTRICT":
        if not user_dist:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No district assigned to officer profile."}
            )
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "success": False,
                    "message": f"Unauthorized / Access Denied: You are only authorized to view data for your assigned district '{user_dist}'. Attempted access to '{selected_dist}' was blocked."
                }
            )
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Belagavi"

    target_fy = fy if (fy and fy != "ALL") else None

    da_query = {
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{re.escape(district_name)}$", "$options": "i"}}
        ]
    }
    if target_fy:
        da_query["financial_year"] = target_fy

    p_query = {
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{re.escape(district_name)}$", "$options": "i"}}
        ]
    }
    if target_fy:
        p_query["financial_year"] = target_fy

    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=5) as executor:
        f_sd = executor.submit(lambda: list(db.districts.find({"state_code": user_state}).sort("name", 1)))
        f_ra = executor.submit(lambda: list(db.district_allocations.find(da_query).sort("created_at", -1)))
        f_pr = executor.submit(lambda: list(db.projects.find(p_query).sort("created_at", -1)))
        f_kyc = executor.submit(lambda: db.contractor_kyc.count_documents({"state_code": user_state, "kyc_status": "UNDER_REVIEW"}))
        f_grv = executor.submit(lambda: db.complaints.count_documents({
            "district_name": {"$regex": f"^{re.escape(district_name)}$", "$options": "i"},
            "status": {"$ne": "RESOLVED"}
        }))

        state_districts = f_sd.result()
        received_allocs = f_ra.result()
        projects = f_pr.result()
        pending_kyc = f_kyc.result()
        open_grievances = f_grv.result()

    total_received = sum(a.get("amount", 0) for a in received_allocs)
    total_released = sum(p.get("released_amount", 0) for p in projects)

    p_ids = [p["project_id"] for p in projects if p.get("project_id")]
    pending_milestones_count = 0
    pending_payments_count = 0
    pending_verifications = []
    if p_ids:
        pending_ms_list = list(db.milestones.find({
            "project_id": {"$in": p_ids},
            "$or": [
                {"status": "SUBMITTED"},
                {"phase_status": "SUBMITTED_FOR_VERIFICATION"},
                {"evidence_status": "SUBMITTED"}
            ]
        }).sort("submitted_at", -1))
        pending_milestones_count = len(pending_ms_list)

        pending_pay_list = list(db.milestones.find({
            "project_id": {"$in": p_ids},
            "$or": [
                {"status": "FUND_REQUESTED"},
                {"phase_status": "FUND_REQUESTED"}
            ]
        }))
        pending_payments_count = len(pending_pay_list)

        # Build list of pending milestone verification details with project info
        proj_map = {p["project_id"]: p for p in projects}
        for ms in pending_ms_list[:10]:
            p_obj = proj_map.get(ms.get("project_id"), {})
            pending_verifications.append({
                "milestone_id": ms.get("milestone_id") or f"MS-{ms.get('project_id')}-{ms.get('milestone_index', 0) + 1}",
                "project_id": ms.get("project_id"),
                "project_name": p_obj.get("name", ms.get("project_id")),
                "scheme_name": p_obj.get("scheme_name", "Public Infrastructure"),
                "stage": ms.get("title") or f"Phase #{ms.get('milestone_index', 0) + 1}",
                "milestone_index": ms.get("milestone_index", 0),
                "amount": ms.get("amount", 0),
                "status": "Awaiting District Verification",
                "contractor_name": p_obj.get("contractor_name") or "Assigned Contractor",
                "proof_document_hash": ms.get("proof_document_hash"),
                "submitted_at": ms.get("submitted_at")
            })

    return {
        "success": True,
        "district_name": district_name,
        "state_code": user_state,
        "state_name": user_state_name,
        "officer_id": current_user.get("officer_id"),
        "officer_name": current_user.get("name"),
        "is_locked_district": (user_role == "DISTRICT"),
        "available_districts": serialize_doc(state_districts),
        "selected_financial_year": target_fy,
        "metrics": {
            "selected_financial_year": target_fy,
            "total_funds_received": total_received,
            "total_projects_count": len(projects),
            "active_projects_count": len([p for p in projects if p.get("status") in ["IN_PROGRESS", "ASSIGNED", "ESCROW_FUNDED"]]),
            "total_payments_released": total_released,
            "pending_kyc_count": pending_kyc,
            "open_grievances_count": open_grievances,
            "pending_milestones": pending_milestones_count,
            "pending_milestones_count": pending_milestones_count,
            "pending_payment_requests": pending_payments_count,
            "pending_payment_requests_count": pending_payments_count
        },
        "recent_projects": serialize_doc(projects[:5]),
        "received_funds": serialize_doc(received_allocs),
        "pending_verifications": serialize_doc(pending_verifications)
    }

# --- Scheme Management (Step 1: Create & View Schemes) ---
@router.get("/schemes")
async def get_schemes(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["DISTRICT", "SUPER_ADMIN"]))
):
    sc_query = {}
    if fy and fy != "ALL":
        sc_query["financial_year"] = fy
    sc_list = list(db.schemes.find(sc_query).sort("name", 1))
    return {"success": True, "schemes": serialize_doc(sc_list)}

@router.post("/schemes", status_code=status.HTTP_201_CREATED)
async def create_scheme(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = str(data.get("code", "")).strip().upper()
    name = str(data.get("name", "")).strip()
    fy = str(data.get("financial_year", "")).strip()
    department = str(data.get("department", "Infrastructure & Public Works")).strip()
    allocated_budget = float(data.get("allocated_budget", 500000000.0))
    description = str(data.get("description", "")).strip()

    if not code or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Scheme code and name are required"}
        )

    if not fy:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Financial year association is required"}
        )

    fy_doc = db.financial_years.find_one({"year": fy})
    if not fy_doc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Invalid financial year '{fy}'. Year not recognized."}
        )

    scheme_doc = {
        "code": code,
        "name": name,
        "financial_year": fy,
        "department": department,
        "allocated_budget": allocated_budget,
        "description": description or f"District development scheme {name}",
        "is_active": True,
        "created_by": current_user.get("name", "District Officer"),
        "created_at": datetime.now(timezone.utc)
    }

    db.schemes.update_one({"code": code, "financial_year": fy}, {"$set": scheme_doc}, upsert=True)

    return {
        "success": True,
        "message": f"Scheme '{name}' ({code}) registered successfully",
        "scheme": serialize_doc(scheme_doc)
    }

# --- Contractor KYC Review & Directory ---
@router.get("/contractors")
async def get_contractors(
    current_user: dict = Depends(require_roles(["DISTRICT", "SUPER_ADMIN"]))
):
    user_state = (current_user.get("state_code") or "").strip().upper()
    user_state_name = current_user.get("state_name") or ""
    is_admin = current_user.get("role") == "SUPER_ADMIN"

    kyc_filter = {} if is_admin else {"state_code": user_state}
    contractors = list(db.contractor_kyc.find(kyc_filter).sort("created_at", -1))
    result = []

    for c in contractors:
        user = None
        uid = c.get("user_id")
        if uid and ObjectId.is_valid(str(uid)):
            user = db.users.find_one({"_id": ObjectId(uid)})
        elif uid:
            user = db.users.find_one({"email": uid}) or db.users.find_one({"user_id": uid})
        elif c.get("email"):
            user = db.users.find_one({"email": c.get("email")})

        c_state_code = (c.get("state_code") or (user.get("state_code") if user else None) or "").strip().upper()
        c_state_name = c.get("state_name") or (user.get("state_name") if user else None) or ""

        # Sync back to KYC document if missing
        if not c.get("state_code") and c_state_code:
            c["state_code"] = c_state_code
            c["state_name"] = c_state_name
            db.contractor_kyc.update_one({"_id": c["_id"]}, {"$set": {"state_code": c_state_code, "state_name": c_state_name}})

        if user:
            c["user_id"] = str(user["_id"])
            if user.get("contractor_id"):
                c["contractor_id"] = user.get("contractor_id")
            c["email"] = user.get("email", c.get("email"))
            c["contact_name"] = user.get("name", c.get("company_name"))
            c["company_name"] = c.get("company_name") or user.get("company_name") or user.get("name")
            c["wallet_address"] = user.get("wallet_address", c.get("wallet_address", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"))
            if not c_state_name and user.get("state_name"):
                c["state_name"] = user.get("state_name")

        docs = list(db.documents.find({"entity_id": str(uid)})) if uid else []
        c["kyc_documents"] = serialize_doc(docs)

        # STRICT STATE ISOLATION: Only include contractors matching the District Officer's state!
        if is_admin or (user_state and c_state_code == user_state):
            result.append(c)

    return {
        "success": True,
        "state_code": user_state,
        "state_name": user_state_name,
        "contractors": serialize_doc(result)
    }

@router.post("/contractor/{user_id}/kyc-review")
async def review_contractor_kyc(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    action = data.get("action", "APPROVED").upper()
    remarks = data.get("remarks", "All statutory credentials verified by District Development Officer.")

    user_state = (current_user.get("state_code") or "").strip().upper()

    # Find the contractor KYC record
    query = {"$or": [{"user_id": str(user_id)}, {"contractor_id": str(user_id)}, {"email": str(user_id).lower()}]}
    if ObjectId.is_valid(str(user_id)):
        query["$or"].append({"_id": ObjectId(user_id)})
    kyc = db.contractor_kyc.find_one(query)

    if not kyc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Contractor KYC record not found"}
        )

    con_state = (kyc.get("state_code") or "").strip().upper()
    if con_state and user_state and con_state != user_state and current_user.get("role") != "SUPER_ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": f"Unauthorized: Contractor belongs to state '{con_state}', outside your district jurisdiction state '{user_state}'."
            }
        )

    db.contractor_kyc.update_one(
        query,
        {"$set": {
            "kyc_status": action,
            "verification_remarks": remarks,
            "verified_by": current_user["name"],
            "reviewed_at": datetime.now(timezone.utc)
        }}
    )

    db.notifications.insert_one({
        "recipient_user_id": user_id,
        "title": f"KYC Verification {action}",
        "message": f"Your contractor eligibility review verdict: {action}. Remarks: {remarks}",
        "link": "/contractor/kyc",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {"success": True, "message": f"Contractor KYC status updated to {action}"}

# --- Project Lifecycle & Smart Contract Escrow ---
@router.get("/projects")
async def get_projects(
    district: Optional[str] = Query(None),
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    selected_dist = district
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code")
    user_state_name = current_user.get("state_name")

    if not user_state and user_dist:
        dist_record = db.districts.find_one({
            "$or": [{"name": user_dist}, {"name": {"$regex": f"^{re.escape(user_dist)}$", "$options": "i"}}]
        })
        if dist_record:
            user_state = dist_record.get("state_code", "KA")
            user_state_name = dist_record.get("state_name", "Karnataka")
        else:
            user_state = "KA"
            user_state_name = "Karnataka"
    elif not user_state:
        user_state = "KA"
        user_state_name = "Karnataka"

    if user_role == "DISTRICT":
        if not user_dist:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No district assigned to officer profile."}
            )
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "success": False,
                    "message": f"Unauthorized / Access Denied: You cannot view projects in '{selected_dist}'. You are assigned to '{user_dist}'."
                }
            )
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Belagavi"

    norm_dist = normalize_str(district_name)
    dist_regex = re.compile(r"^" + r"\s+".join(re.escape(w) for w in norm_dist.split()) + r"$", re.IGNORECASE) if norm_dist else re.compile(f"^{re.escape(district_name)}$", re.IGNORECASE)

    target_fy = fy if (fy and fy != "ALL") else None

    # 1. All Projects in this District isolated to financial year
    p_filter = {
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": dist_regex}}
        ]
    }
    if target_fy:
        p_filter["financial_year"] = target_fy
    proj_list = list(db.projects.find(p_filter).sort("created_at", -1))

    # 2. All Fund Allocations received by this District from State Treasury in financial year
    da_filter = {
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": dist_regex}}
        ]
    }
    if target_fy:
        da_filter["financial_year"] = target_fy
    received_allocs = list(db.district_allocations.find(da_filter).sort("created_at", -1))

    # 3. Calculate Scheme-Level Fund Balances & Availability
    schemes_dict = {}

    # Seed with global schemes
    try:
        all_schemes = list(db.schemes.find().sort("name", 1))
        for sc in all_schemes:
            sc_name = normalize_str(sc.get("name", ""))
            if sc_name:
                schemes_dict[sc_name] = {
                    "scheme_name": sc.get("name", sc_name),
                    "scheme_code": sc.get("code", "SCHEME"),
                    "department": sc.get("department", "Public Infrastructure"),
                    "total_received": 0.0,
                    "committed_budget": 0.0,
                    "available_balance": 0.0
                }
    except Exception as e:
        print(f"Warning fetching schemes for district breakdown: {e}")

    # Add received funds per scheme
    for a in received_allocs:
        raw_sname = a.get("scheme_name") or "General Infrastructure Scheme"
        s_name = normalize_str(raw_sname)
        if s_name not in schemes_dict:
            schemes_dict[s_name] = {
                "scheme_name": raw_sname,
                "scheme_code": a.get("scheme_code") or a.get("department") or "SCHEME",
                "department": a.get("department") or "Public Works",
                "total_received": 0.0,
                "committed_budget": 0.0,
                "available_balance": 0.0
            }
        schemes_dict[s_name]["total_received"] += float(a.get("amount", 0.0))

    # Add committed project budgets per scheme
    for p in proj_list:
        if p.get("status") in ["CANCELLED", "REJECTED"]:
            continue
        raw_sname = p.get("scheme_name") or "General Infrastructure Scheme"
        s_name = normalize_str(raw_sname)
        if s_name not in schemes_dict:
            schemes_dict[s_name] = {
                "scheme_name": raw_sname,
                "scheme_code": p.get("scheme_code") or "SCHEME",
                "department": p.get("department") or "Public Works",
                "total_received": 0.0,
                "committed_budget": 0.0,
                "available_balance": 0.0
            }
        schemes_dict[s_name]["committed_budget"] += float(p.get("total_budget", 0.0))

    # Compute available balance for each scheme
    for s_name, s_data in schemes_dict.items():
        s_data["available_balance"] = max(0.0, s_data["total_received"] - s_data["committed_budget"])

    total_received_sum = sum(float(a.get("amount", 0.0)) for a in received_allocs)
    total_committed_sum = sum(float(p.get("total_budget", 0.0)) for p in proj_list if p.get("status") not in ["CANCELLED", "REJECTED"])
    total_available_sum = max(0.0, total_received_sum - total_committed_sum)

    # Attach phases/milestones and pending flags to projects so District table immediately reflects contractor submissions
    p_ids = [p["project_id"] for p in proj_list if p.get("project_id")]
    phases_by_proj = collections.defaultdict(list)
    if p_ids:
        all_phases = list(db.milestones.find({"project_id": {"$in": p_ids}}).sort("milestone_index", 1))
        for ph in all_phases:
            phases_by_proj[ph["project_id"]].append(ph)

    for p in proj_list:
        p_id = p.get("project_id")
        p_phases = phases_by_proj.get(p_id, [])
        p["milestones"] = serialize_doc(p_phases)
        has_pending_proof = any(
            ph.get("status") == "SUBMITTED" or 
            ph.get("phase_status") == "SUBMITTED_FOR_VERIFICATION" or
            ph.get("evidence_status") == "SUBMITTED"
            for ph in p_phases
        )
        has_pending_fund = any(
            ph.get("status") == "FUND_REQUESTED" or 
            ph.get("phase_status") == "FUND_REQUESTED"
            for ph in p_phases
        )
        p["has_pending_proof"] = has_pending_proof or p.get("has_pending_proof", False)
        p["has_pending_fund"] = has_pending_fund

    return {
        "success": True,
        "district_name": district_name,
        "state_code": user_state,
        "state_name": user_state_name,
        "is_locked_district": (user_role == "DISTRICT"),
        "projects": serialize_doc(proj_list),
        "received_allocations": serialize_doc(received_allocs),
        "scheme_balances": list(schemes_dict.values()),
        "summary": {
            "total_received": total_received_sum,
            "total_committed": total_committed_sum,
            "total_available": total_available_sum
        }
    }

@router.post("/projects", status_code=status.HTTP_201_CREATED)
async def create_project(
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    name = data.get("name", "").strip()
    raw_scheme_name = data.get("scheme_name", "").strip()
    department = data.get("department", "Road Transport & Infrastructure")
    
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code", "KA")
    user_state_name = current_user.get("state_name", "Karnataka")

    req_district = data.get("district_name")
    if user_role == "DISTRICT":
        if not user_dist:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No district assigned to officer profile."}
            )
        if req_district and req_district.strip().lower() != user_dist.strip().lower():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "success": False,
                    "message": f"Unauthorized / Access Denied: You cannot create projects in '{req_district}'. Your assigned district is '{user_dist}'."
                }
            )
        target_district = user_dist
    else:
        target_district = req_district or user_dist or "Belagavi"

    if not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project name is required"}
        )

    if not raw_scheme_name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Scheme selection is required"}
        )

    try:
        total_budget = float(data.get("total_budget", 0))
    except (ValueError, TypeError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Valid project budget is required"}
        )

    if total_budget <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project total budget must be greater than 0"}
        )

    fy = data.get("financial_year") or data.get("fy")
    if fy:
        valid_fy = db.financial_years.find_one({"year": fy})
        if not valid_fy:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": f"Invalid financial year: '{fy}'. Must be a registered financial year."}
            )
    else:
        fy = get_active_financial_year()

    # Compile regexes with whitespace tolerance
    norm_dist = normalize_str(target_district)
    dist_regex = re.compile(r"^" + r"\s+".join(re.escape(w) for w in norm_dist.split()) + r"$", re.IGNORECASE) if norm_dist else re.compile(f"^{re.escape(target_district)}$", re.IGNORECASE)

    norm_scheme = normalize_str(raw_scheme_name)
    scheme_regex = re.compile(r"^" + r"\s+".join(re.escape(w) for w in norm_scheme.split()) + r"$", re.IGNORECASE) if norm_scheme else re.compile(f"^{re.escape(raw_scheme_name)}$", re.IGNORECASE)

    # 1. Check District Allocations received from State Treasury for this Scheme in this Financial Year
    scheme_allocs = list(db.district_allocations.find({
        "$and": [
            {
                "$or": [
                    {"district_name": target_district},
                    {"district_name": {"$regex": dist_regex}}
                ]
            },
            {
                "$or": [
                    {"scheme_name": raw_scheme_name},
                    {"scheme_name": {"$regex": scheme_regex}}
                ]
            },
            {"financial_year": fy}
        ]
    }))
    total_scheme_received = sum(float(a.get("amount", 0.0)) for a in scheme_allocs)

    # 2. Check Existing Project Budgets for this District & Scheme in this Financial Year
    existing_projects = list(db.projects.find({
        "$and": [
            {
                "$or": [
                    {"district_name": target_district},
                    {"district_name": {"$regex": dist_regex}}
                ]
            },
            {
                "$or": [
                    {"scheme_name": raw_scheme_name},
                    {"scheme_name": {"$regex": scheme_regex}}
                ]
            },
            {"status": {"$nin": ["CANCELLED", "REJECTED"]}},
            {"financial_year": fy}
        ]
    }))
    already_committed = sum(float(p.get("total_budget", 0.0)) for p in existing_projects)
    available_scheme_balance = max(0.0, total_scheme_received - already_committed)

    # Strict Validation against District Fund Ceiling
    if total_scheme_received <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": (
                    f"Fund Allocation Error: No funds have been allocated by the State Treasury to {target_district} "
                    f"district for scheme '{raw_scheme_name}' in FY {fy}. Total received: ₹0. "
                    f"Please allocate funds from State Treasury before creating projects under this scheme."
                )
            }
        )

    if total_budget > available_scheme_balance:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": (
                    f"Budget Exceeded: Requested contract budget ₹{total_budget:,.2f} exceeds available district fund "
                    f"balance of ₹{available_scheme_balance:,.2f} for scheme '{raw_scheme_name}' in {target_district} for FY {fy} "
                    f"(Total Received: ₹{total_scheme_received:,.2f}, Already Committed: ₹{already_committed:,.2f})."
                )
            }
        )

    # Look up scheme code if not passed
    scheme_code = data.get("scheme_code")
    if not scheme_code:
        sc_doc = db.schemes.find_one({"$or": [{"name": raw_scheme_name}, {"name": {"$regex": scheme_regex}}]})
        if sc_doc:
            scheme_code = sc_doc.get("code")
            if not department or department == "Road Transport & Infrastructure":
                department = sc_doc.get("department", department)

    project_id = generate_project_id(target_district)

    doc = {
        "project_id": project_id,
        "name": name,
        "scheme_code": scheme_code or "SCHEME",
        "scheme_name": raw_scheme_name,
        "department": department,
        "state_code": data.get("state_code", user_state),
        "state_name": user_state_name,
        "district_name": target_district,
        "financial_year": fy,
        "total_budget": total_budget,
        "released_amount": 0.0,
        "progress_percentage": 0,
        "contractor_id": None,
        "contractor_name": None,
        "status": "CREATED",
        "escrow_onchain": False,
        "escrow_tx_hash": None,
        "is_frozen": False,
        "freeze_reason": None,
        "description": data.get("description", ""),
        "timeline_months": int(data.get("timeline_months", 12)),
        "created_by": current_user["name"],
        "created_at": datetime.now(timezone.utc)
    }
    db.projects.insert_one(doc)

    realtime_manager.trigger_broadcast("PROJECT_CREATED", {
        "project_id": project_id,
        "name": name,
        "district_name": target_district,
        "financial_year": fy,
        "scheme_name": raw_scheme_name,
        "total_budget": total_budget
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "action": "CREATE",
        "project_id": project_id,
        "district_name": target_district
    })

    return {
        "success": True,
        "message": f"Project {project_id} created successfully for {target_district} under '{raw_scheme_name}' ({fy})",
        "project": serialize_doc(doc),
        "available_balance": available_scheme_balance - total_budget
    }

@router.get("/projects/{project_id}")
async def get_project_details(
    project_id: str,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
    
    # Auto-reconcile and heal released_amount and physical progress
    reconcile_project_released_amount(proj, milestones=milestones)
    calc_prog = compute_project_progress(proj, milestones=milestones)
    if proj.get("progress_percentage") != calc_prog:
        db.projects.update_one({"project_id": project_id}, {"$set": {"progress_percentage": calc_prog}})
        proj["progress_percentage"] = calc_prog

    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))
    evidence = list(db.evidence.find({"$or": [{"project_id": project_id}, {"projectId": project_id}]}).sort("uploaded_at", -1))
    qr_doc = db.qr_codes.find_one({"project_id": project_id})

    return {
        "success": True,
        "project": serialize_doc(proj),
        "qr_code": serialize_doc(qr_doc),
        "milestones": serialize_doc(milestones),
        "documents": serialize_doc(documents),
        "evidence": serialize_doc(evidence)
    }

@router.post("/projects/{project_id}/assign-contractor")
async def assign_contractor(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    # Check project status to prevent corrupting active or completed workflows
    curr_status = proj.get("status")
    if curr_status in ["IN_PROGRESS", "ACCEPTED", "ESCROW_FUNDED", "COMPLETED", "CLOSED"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Cannot reassign project in '{curr_status}' state. Project is already accepted and in execution."
            }
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    contractor_user_id = data.get("contractor_id") or data.get("contractor_user_id")
    if not contractor_user_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Contractor ID is required"}
        )

    # 1. Robust Multi-Collection Contractor Identity Resolution
    # Resolves user and kyc documents whether frontend passes user ObjectId, KYC ObjectId, contractor code, or email
    cid_str = str(contractor_user_id).strip()
    kyc = None
    user = None

    if ObjectId.is_valid(cid_str):
        kyc = db.contractor_kyc.find_one({"_id": ObjectId(cid_str)})
        user = db.users.find_one({"_id": ObjectId(cid_str)})

    if not kyc:
        kyc = db.contractor_kyc.find_one({
            "$or": [
                {"user_id": cid_str},
                {"contractor_id": cid_str},
                {"email": cid_str.lower()}
            ]
        })

    # Link from KYC to User if user was not found directly by input ID
    if not user and kyc:
        uid = kyc.get("user_id")
        if uid and ObjectId.is_valid(str(uid)):
            user = db.users.find_one({"_id": ObjectId(uid)})
        if not user and kyc.get("email"):
            user = db.users.find_one({"email": kyc.get("email").lower()})
        if not user and kyc.get("contractor_id"):
            user = db.users.find_one({"contractor_id": kyc.get("contractor_id")})

    # Fallback lookup in users table
    if not user:
        user = db.users.find_one({
            "$or": [
                {"contractor_id": cid_str},
                {"email": cid_str.lower()},
                {"username": cid_str.lower()}
            ]
        })

    # Link from User to KYC if KYC was not found directly
    if not kyc and user:
        kyc = db.contractor_kyc.find_one({
            "$or": [
                {"user_id": str(user["_id"])},
                {"contractor_id": user.get("contractor_id")},
                {"email": user.get("email", "").lower()}
            ]
        })

    if not user and not kyc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Contractor '{contractor_user_id}' not found in registered accounts or KYC directory."}
        )

    # 2. State Isolation Check: Contractor must be in the same state as the project
    con_state = (kyc.get("state_code") if kyc else None) or (user.get("state_code") if user else None) or ""
    proj_state = (proj.get("state_code") or current_user.get("state_code") or "").strip().upper()

    if con_state and proj_state and con_state.strip().upper() != proj_state:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Cross-state contractor assignment is not permitted. This project is in {proj_state}, but contractor is registered in {con_state.strip().upper()}. District officers can only allocate projects to contractors available in their state ({proj_state})."
            }
        )

    # 3. State Department Approval Check: Contractor must be verified by State Dept
    kyc_status = (kyc.get("kyc_status") if kyc else None) or (user.get("kyc_status") if user else "UNDER_REVIEW")
    if kyc_status != "APPROVED":
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Contractor registration status is '{kyc_status}'. Contractor must first be verified and approved by the State Department before projects can be allocated."
            }
        )

    # 4. Authoritative Contractor Metadata & Canonical Identifiers
    company_name = (kyc.get("company_name") if kyc else None) or (user.get("company_name") if user else None) or (user.get("name") if user else None) or "Registered Contractor"
    contractor_email = (user.get("email") if user else None) or (kyc.get("email") if kyc else None) or "contractor@buildcorp.in"
    contractor_assigned_id = str(user["_id"]) if user else (str(kyc.get("user_id")) if kyc and kyc.get("user_id") else str(contractor_user_id))
    canonical_cid = (user.get("contractor_id") if user else None) or (kyc.get("contractor_id") if kyc else None) or f"CON-{proj_state}-{contractor_assigned_id[-4:].upper()}"
    contractor_wallet = (kyc.get("wallet_address") if kyc else None) or (user.get("wallet_address") if user else None) or "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

    # Idempotency: If already assigned to this exact contractor awaiting acceptance
    if curr_status == "ASSIGNED" and (proj.get("contractor_id") == contractor_assigned_id or proj.get("canonical_contractor_id") == canonical_cid):
        return {
            "success": True,
            "message": f"Project {project_id} is already assigned to '{company_name}'. Awaiting contractor acceptance.",
            "already_assigned": True
        }

    bank_details = {
        "bank_name": (kyc.get("bank_name") if kyc else None) or (user.get("bank_name") if user else None) or "State Bank of India",
        "account_number": (kyc.get("account_number") if kyc else None) or (user.get("account_number") if user else None) or "SBIN-992834710293",
        "ifsc_code": (kyc.get("ifsc_code") if kyc else None) or (user.get("ifsc_code") if user else None) or "SBIN0001234",
        "branch": (kyc.get("branch") if kyc else None) or (user.get("branch") if user else None) or f"{proj.get('district_name', 'District')} Main Branch",
        "wallet_address": contractor_wallet,
        "is_active": True,
        "deactivated_at": None,
        "deactivation_reason": None
    }

    contract_id = proj.get("contract_id") or qr_service.generate_contract_id(project_id)
    assigning_district = proj.get("district_name") or current_user.get("district_name") or "District"

    # 5. Persist complete assignment schema linking project to contractor and district
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "contract_id": contract_id,
            "contract_status": "PENDING_ACCEPTANCE",
            "assignment_status": "ASSIGNED",
            "contractor_id": contractor_assigned_id,
            "canonical_contractor_id": canonical_cid,
            "contractor_email": contractor_email,
            "contractor_name": company_name,
            "contractor_wallet": contractor_wallet,
            "contractor_bank_account": bank_details,
            "bank_account_status": "ACTIVE",
            "status": "ASSIGNED",
            "assigned_at": datetime.now(timezone.utc),
            "assigned_by_district": assigning_district,
            "assigned_district": assigning_district,
            "assigned_by_user": current_user.get("name") or current_user.get("email")
        }}
    )

    db.notifications.insert_one({
        "recipient_user_id": contractor_assigned_id,
        "title": "4. New Project Assigned by District Authority",
        "message": f"You have been awarded contract for {project_id} under scheme {proj.get('scheme_name')}. Please Accept or Reject the assignment.",
        "link": f"/contractor/my-projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    realtime_manager.trigger_broadcast("PROJECT_ASSIGNED", {
        "project_id": project_id,
        "contractor_id": contractor_assigned_id,
        "contractor_name": company_name,
        "district_name": assigning_district,
        "status": "ASSIGNED"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "action": "ASSIGN_CONTRACTOR",
        "project_id": project_id,
        "contractor_id": contractor_assigned_id
    })

    return {
        "success": True,
        "message": f"Contractor '{company_name}' assigned to project {project_id} successfully"
    }

@router.post("/projects/{project_id}/create-escrow")
async def create_escrow(
    project_id: str,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    if not proj.get("contractor_name") and not proj.get("contractor_id"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Cannot create escrow: Contractor has not been assigned to this project yet."}
        )

    # Authoritative resolution of contractor wallet address
    contractor_wallet = proj.get("contractor_wallet")
    is_valid_addr = contractor_wallet and bcs.w3.is_address(contractor_wallet) and contractor_wallet.lower() != "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
    if not is_valid_addr:
        c_id = proj.get("contractor_id")
        kyc = db.contractor_kyc.find_one({
            "$or": [{"user_id": str(c_id)}, {"contractor_id": str(c_id)}, {"email": proj.get("contractor_email")}]
        })
        if kyc and kyc.get("wallet_address") and bcs.w3.is_address(kyc.get("wallet_address")):
            contractor_wallet = kyc.get("wallet_address")
        else:
            u_query = [{"email": proj.get("contractor_email")}]
            if ObjectId.is_valid(str(c_id)):
                u_query.append({"_id": ObjectId(str(c_id))})
            u = db.users.find_one({"$or": u_query})
            if u and u.get("wallet_address") and bcs.w3.is_address(u.get("wallet_address")):
                contractor_wallet = u.get("wallet_address")
            else:
                contractor_wallet = bcs.get_entity_wallet("CONTRACTOR", proj.get("contractor_name"))

    tx_hash = None
    block_num = None
    now_utc = datetime.now(timezone.utc)
    new_status = "ESCROW_FUNDED" if proj.get("status") in ["CREATED", "ASSIGNED"] else proj.get("status")
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "escrow_onchain": False,
            "contractor_wallet": contractor_wallet,
            "escrow_tx_hash": None,
            "escrow_block": None,
            "status": new_status,
            "escrow_created_at": now_utc
        }}
    )

    realtime_manager.trigger_broadcast("ESCROW_CREATED", {
        "project_id": project_id,
        "contractor_wallet": contractor_wallet,
        "tx_hash": tx_hash,
        "status": new_status
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "escrow",
        "action": "CREATE_ESCROW",
        "project_id": project_id
    })

    return {
        "success": True,
        "message": f"Project escrow record active for {project_id}",
        "escrow_onchain": False,
        "contractor_wallet": contractor_wallet,
        "blockchain": None
    }

@router.post("/projects/{project_id}/milestones")
async def set_milestones(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    milestones_data = data.get("milestones", [])
    if not milestones_data:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "At least one milestone is required"}
        )

    # Safety: Cannot alter milestone schedule if funds have already been requested or disbursed
    if float(proj.get("released_amount", 0.0)) > 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Cannot modify milestones: Funds have already been disbursed for this project."}
        )

    existing_funded = db.milestones.find_one({
        "project_id": project_id,
        "status": {"$in": ["FUNDS_TRANSFERRED", "COMPLETED", "FUND_REQUESTED"]}
    })
    if existing_funded:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Cannot modify milestones: One or more milestones are already in progress, requested, or funded."}
        )

    for idx, m in enumerate(milestones_data):
        m_amt = float(m.get("amount", 0))
        if m_amt <= 0:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": f"Milestone #{idx + 1} amount must be greater than zero."}
            )

    total_milestones_sum = sum(float(m.get("amount", 0)) for m in milestones_data)
    total_proj_budget = float(proj.get("total_budget", 0))
    if total_milestones_sum > total_proj_budget:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Sum of milestones (INR {total_milestones_sum:,.2f}) exceeds project budget ceiling (INR {total_proj_budget:,.2f})"
            }
        )

    total_percentages = sum(float(m.get("progress_percentage", 0)) for m in milestones_data)
    if total_percentages > 100:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Sum of milestone progress percentages ({total_percentages:.1f}%) exceeds 100%."
            }
        )


    db.milestones.delete_many({"project_id": project_id})
    for idx, m in enumerate(milestones_data):
        db.milestones.insert_one({
            "project_id": project_id,
            "milestone_index": idx,
            "title": m.get("title", f"Milestone #{idx + 1}"),
            "description": m.get("description", ""),
            "amount": float(m.get("amount", 0)),
            "status": "PENDING",
            "progress_percentage": 0,
            "proof_document_hash": None,
            "blockchain_tx_hash": None,
            "created_at": datetime.now(timezone.utc)
        })

    realtime_manager.trigger_broadcast("MILESTONES_CONFIGURED", {
        "project_id": project_id,
        "count": len(milestones_data)
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "milestones",
        "action": "CONFIGURED",
        "project_id": project_id
    })

    return {"success": True, "message": f"{len(milestones_data)} milestones configured successfully."}

# --- Phase Fund Request Verification & Bank Disbursal (Steps 8-11, 19-22, 29-32) ---
@router.post("/projects/{project_id}/phases/{milestone_index}/verify-fund-request")
async def verify_phase_fund_request(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    if proj.get("is_frozen"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Project is FROZEN by audit hold. Cannot process fund requests."}
        )

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Phase #{milestone_index + 1} not found"}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    action = str(data.get("action", "APPROVE")).upper()
    remarks = data.get("remarks") or data.get("reason") or ""

    # Decision Node: REJECT Fund Request
    if action == "REJECT":
        if not remarks:
            remarks = "Fund request mobilization justification insufficient or advance estimate exceeds current allocation guidelines."

        db.milestones.update_one(
            {"project_id": project_id, "milestone_index": milestone_index},
            {"$set": {
                "status": "FUND_REQUEST_REJECTED",
                "phase_status": "FUND_REQUEST_REJECTED",
                "fund_rejection_reason": remarks,
                "fund_rejected_by": current_user["name"],
                "fund_rejected_at": datetime.now(timezone.utc)
            }}
        )

        if proj.get("contractor_id"):
            db.notifications.insert_one({
                "recipient_user_id": proj.get("contractor_id"),
                "title": f"Phase #{milestone_index + 1} Fund Request Rejected",
                "message": f"District Authority rejected fund request for Phase #{milestone_index + 1} of {project_id}. Reason: {remarks}. You may adjust notes and re-request.",
                "link": f"/contractor/my-projects?project_id={project_id}",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })

        realtime_manager.trigger_broadcast("FUND_REQUEST_REJECTED", {
            "project_id": project_id,
            "milestone_index": milestone_index,
            "fund_rejection_reason": remarks
        })
        realtime_manager.trigger_broadcast("DATA_MUTATED", {
            "entity": "milestones",
            "action": "FUND_REQUEST_REJECTED",
            "project_id": project_id,
            "milestone_index": milestone_index
        })

        return {
            "success": True,
            "message": f"Phase #{milestone_index + 1} fund request rejected. Reason recorded and contractor notified.",
            "fund_rejection_reason": remarks
        }

    # Duplicate Protection: Cannot approve if already transferred or completed
    if phase.get("status") in ["FUNDS_TRANSFERRED", "COMPLETED"] or phase.get("phase_status") in ["FUNDS_TRANSFERRED", "COMPLETED"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Funds have already been transferred for Phase #{milestone_index + 1}."}
        )

    allocated_amount = float(phase.get("amount", 0.0))
    if allocated_amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Phase #{milestone_index + 1} allocation amount must be greater than zero."}
        )

    # Idempotency Protection: Check header or request body
    idempotency_key = request.headers.get("X-Idempotency-Key") or data.get("idempotency_key")
    if idempotency_key:
        existing_tx = db.financial_transactions.find_one({"idempotency_key": idempotency_key})
        if existing_tx:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "message": f"Duplicate request acknowledged: Phase #{milestone_index + 1} fund disbursal already processed.",
                    "transaction": serialize_doc(existing_tx),
                    "is_duplicate": True
                }
            )

    # Reconcile project released_amount before reservation to self-heal any prior drift
    reconcile_project_released_amount(proj, exclude_milestone_index=milestone_index)

    # Atomic Reservation: Conditionally reserve amount only if released_amount + allocated_amount <= total_budget
    reserved_proj = db.projects.find_one_and_update(
        {
            "project_id": project_id,
            "$expr": {"$lte": [{"$add": [{"$ifNull": ["$released_amount", 0.0]}, allocated_amount]}, "$total_budget"]}
        },
        {"$inc": {"released_amount": allocated_amount}},
        return_document=ReturnDocument.AFTER
    )

    if not reserved_proj:
        latest_p = db.projects.find_one({"project_id": project_id})
        cur_rel = float(latest_p.get("released_amount", 0.0)) if latest_p else 0.0
        tot_b = float(latest_p.get("total_budget", 0.0)) if latest_p else 0.0
        rem_b = max(0.0, tot_b - cur_rel)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Insufficient available project budget. Phase #{milestone_index + 1} amount (INR {allocated_amount:,.2f}) exceeds remaining budget (INR {rem_b:,.2f})"
            }
        )

    # Resolve Authoritative Bank Accounts (Entity -> Account Mapping)
    source_account = bas.get_or_create_district_account(proj.get("district_name", "Belagavi"), proj.get("state_code", "KA"))
    destination_account = bas.get_or_create_contractor_account(proj.get("contractor_id", "CON-001"), proj.get("contractor_name"))

    bank_acc = {
        "bank_name": destination_account.get("bank_name", "State Bank of India"),
        "account_number": destination_account.get("account_number", "SBIN-992834710293"),
        "masked_account_number": bas.mask_account_number(destination_account.get("account_number")),
        "ifsc_code": destination_account.get("ifsc", "SBIN0001234"),
        "wallet_address": proj.get("contractor_wallet", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
    }

    tx_hash = None
    block_num = None
    from_dist = bcs.get_entity_wallet("DISTRICT", proj.get("district_name"))
    to_contractor = bank_acc.get("wallet_address") or bcs.get_entity_wallet("CONTRACTOR", proj.get("contractor_name"))

    # Pre-flight check: Escrow must be initialized on-chain before releasing milestone payments

    try:
        rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        transfer_id = f"TRF-PHASE-{project_id}-P{milestone_index + 1}-{rand_suffix}"
        district_dept = f"{proj.get('district_name', 'Bengaluru Urban')} District Implementing Agency"
        contractor_dept = proj.get("contractor_name", "Contractor")
        tx_receipt = bcs.record_contractor_transfer_onchain(
            transfer_id=transfer_id,
            project_id=project_id,
            district_name=district_dept,
            contractor_name=contractor_dept,
            amount=allocated_amount,
            receiver_address=to_contractor
        )
        if tx_receipt and tx_receipt.get("tx_hash"):
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt.get("block_number")
            from_dist = tx_receipt.get("from_address", from_dist)
        else:
            raise Exception("Blockchain transaction failed to return a valid transaction hash.")
    except (ValueError, Exception) as e:
        print(f"Error executing bank transfer transaction on blockchain: {e}")
        # Roll back reservation atomically
        db.projects.update_one(
            {"project_id": project_id},
            {"$inc": {"released_amount": -allocated_amount}}
        )
        is_escrow_err = "escrow does not exist" in str(e).lower()
        status_code = status.HTTP_400_BAD_REQUEST if (isinstance(e, ValueError) or is_escrow_err) else status.HTTP_500_INTERNAL_SERVER_ERROR
        msg = (
            f"Cannot disburse funds: Project escrow has not been initialized on-chain for '{project_id}'. "
            f"Please initialize the smart contract escrow before releasing milestone payments."
            if is_escrow_err else f"Blockchain Transaction Failed: {str(e)}. Funds were not disbursed."
        )
        return JSONResponse(
            status_code=status_code,
            content={
                "success": False,
                "message": msg
            }
        )

    now_utc = datetime.now(timezone.utc)
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "FUNDS_TRANSFERRED",
            "phase_status": "FUNDS_TRANSFERRED",
            "funds_approved_by": current_user["name"],
            "funds_approved_at": now_utc,
            "funds_transferred_at": now_utc,
            "sender_address": from_dist,
            "receiver_address": to_contractor,
            "sender_department": f"{proj.get('district_name')} District Implementing Agency",
            "receiver_department": f"{proj.get('contractor_name')} (Contractor)",
            "source_account_id": source_account.get("account_id"),
            "destination_account_id": destination_account.get("account_id"),
            "transfer_tx_hash": tx_hash,
            "blockchainTxHash": tx_hash,
            "senderAddress": from_dist,
            "receiverAddress": to_contractor,
            "senderDepartment": f"{proj.get('district_name')} District Implementing Agency",
            "receiverDepartment": f"{proj.get('contractor_name')} (Contractor)",
            "amount": allocated_amount,
            "projectId": project_id,
            "timestamp": now_utc,
            "fund_rejection_reason": None
        }}
    )

    # Create Authoritative Unified Financial Transaction Record
    financial_tx = bas.record_financial_transaction(
        transaction_type="DISTRICT_TO_CONTRACTOR",
        source_account=source_account,
        destination_account=destination_account,
        amount=allocated_amount,
        purpose=f"Phase #{milestone_index + 1} Advance / Fund Release for Project {project_id}",
        blockchain_tx_hash=tx_hash,
        blockchain_block=block_num,
        related_project_id=project_id,
        related_contract_id=proj.get("contract_id"),
        related_milestone_index=milestone_index,
        created_by=current_user["name"],
        status="COMPLETED",
        idempotency_key=idempotency_key
    )

    try:
        from audit_service import log_audit_event
        log_audit_event(
            event_type="CONTRACTOR_ADVANCE_PAYMENT_RELEASED",
            actor=current_user,
            target_id=f"{project_id}-MS-{milestone_index}",
            target_type="MILESTONE_PAYMENT",
            amount=allocated_amount,
            action="RELEASE_PAYMENT",
            status="SUCCESS",
            details=f"Released Phase #{milestone_index + 1} advance payment of {allocated_amount} for project {project_id}",
            blockchain_tx_hash=tx_hash,
            blockchain_block=block_num,
            financial_year=proj.get("financial_year"),
            extra_data={"project_id": project_id, "milestone_index": milestone_index, "contractor_id": proj.get("contractor_id")}
        )
    except Exception:
        pass

    # Record Verified On-Chain Bank Transfer Ledger Entry

    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "blockchainTxHash": tx_hash,
            "block_number": block_num or 1000,
            "operation_type": "PHASE_FUND_TRANSFER_TO_CONTRACTOR_BANK",
            "entity_id": project_id,
            "project_id": project_id,
            "projectId": project_id,
            "from_address": from_dist,
            "senderAddress": from_dist,
            "to_address": to_contractor,
            "receiverAddress": to_contractor,
            "from_entity": f"{proj.get('district_name')} District Development Agency",
            "to_entity": f"{proj.get('contractor_name')} ({bank_acc.get('bank_name')} A/C: {bank_acc.get('masked_account_number')})",
            "sender_department": f"{proj.get('district_name')} District Implementing Agency",
            "senderDepartment": f"{proj.get('district_name')} District Implementing Agency",
            "receiver_department": f"{proj.get('contractor_name')} (Contractor)",
            "receiverDepartment": f"{proj.get('contractor_name')} (Contractor)",
            "transfer_tier": "DISTRICT_ESCROW_TO_CONTRACTOR_BANK",
            "flow_stage": f"4. Disbursal Phase #{milestone_index + 1}: District -> Contractor Bank Account",
            "amount": allocated_amount,
            "details": f"Phase #{milestone_index + 1} Allocated Funds Transferred to {proj.get('contractor_name')} Bank Account ({bank_acc.get('bank_name')} A/C: {bank_acc.get('masked_account_number')}, IFSC: {bank_acc.get('ifsc_code')})",
            "timestamp": now_utc
        })

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Funds Transferred to Bank Account (INR {allocated_amount:,.2f})",
            "message": f"District Officer approved and transferred INR {allocated_amount:,.2f} to your {bank_acc.get('bank_name')} account ({bank_acc.get('masked_account_number')}). You may now execute work.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": now_utc
        })

    # Real-Time WebSocket Synchronization Broadcast
    realtime_manager.trigger_broadcast("TRANSACTION_COMPLETED", {
        "transaction_id": financial_tx["transaction_id"],
        "transaction_type": "DISTRICT_TO_CONTRACTOR",
        "amount": allocated_amount,
        "source_entity": source_account.get("account_holder_name"),
        "destination_entity": destination_account.get("account_holder_name"),
        "blockchain_tx_hash": tx_hash
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "transactions",
        "action": "TRANSACTION_COMPLETED",
        "transaction_id": financial_tx["transaction_id"]
    })

    return {
        "success": True,
        "message": f"Phase #{milestone_index + 1} funds (INR {allocated_amount:,.2f}) allocated and transferred to Contractor Bank Account ({bank_acc.get('bank_name')} A/C: {bank_acc.get('masked_account_number')}).",
        "transaction": serialize_doc(financial_tx),
        "source_account": bas.serialize_bank_account(source_account),
        "destination_account": bas.serialize_bank_account(destination_account),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.post("/transfer-to-contractor", status_code=status.HTTP_201_CREATED)
async def transfer_to_contractor(
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id") or data.get("projectId")
    contractor_name = data.get("contractor_name", "Apex Infrastructure Contractors Pvt Ltd")
    contractor_wallet = data.get("contractor_wallet") or data.get("contractor_address")
    amount = float(data.get("amount", 0))
    district_name = current_user.get("district_name") or data.get("district_name", "Belagavi")
    notes = data.get("notes") or data.get("sign_off_note", "District fund disbursal to contractor")

    if not project_id or amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID and valid positive amount are required"}
        )

    # Access check
    ok, err = check_district_access(district_name, current_user)
    if not ok:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": err})

    # Find project in MongoDB - must exist
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Project record '{project_id}' not found"}
        )

    # Verify that the calling district officer is authorized for the target project's district
    proj_dist = proj.get("district_name")
    allowed, err_msg = check_district_access(proj_dist, current_user)
    if not allowed:
        return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": err_msg})

    # Idempotency Protection: Check header or request body
    idempotency_key = request.headers.get("X-Idempotency-Key") or data.get("idempotency_key")
    if idempotency_key:
        existing_trf = db.contractor_transfers.find_one({"idempotency_key": idempotency_key})
        if existing_trf:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "message": f"Duplicate request acknowledged: contractor transfer {existing_trf.get('transfer_id')} already processed.",
                    "transfer": serialize_doc(existing_trf),
                    "is_duplicate": True
                }
            )

    # Reconcile project released_amount before reservation to self-heal any prior drift
    reconcile_project_released_amount(proj)

    # Atomic Reservation: Conditionally reserve amount only if released_amount + amount <= total_budget
    reserved_proj = db.projects.find_one_and_update(
        {
            "project_id": project_id,
            "$expr": {"$lte": [{"$add": [{"$ifNull": ["$released_amount", 0.0]}, amount]}, "$total_budget"]}
        },
        {"$inc": {"released_amount": amount}},
        return_document=ReturnDocument.AFTER
    )

    if not reserved_proj:
        latest_p = db.projects.find_one({"project_id": project_id})
        cur_rel = float(latest_p.get("released_amount", 0.0)) if latest_p else 0.0
        tot_b = float(latest_p.get("total_budget", 0.0)) if latest_p else 0.0
        rem_budget = max(0.0, tot_b - cur_rel)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Insufficient available balance. Transfer amount (INR {amount:,.2f}) exceeds remaining project budget (INR {rem_budget:,.2f})"
            }
        )

    if proj.get("contractor_name"):
        contractor_name = proj.get("contractor_name")
    if not contractor_wallet:
        contractor_wallet = proj.get("contractor_wallet")
    district_name = proj_dist or district_name

    # Resolve Authoritative Bank Accounts (Entity -> Account Mapping)
    source_account = bas.get_or_create_district_account(district_name, proj.get("state_code", "KA"))
    destination_account = bas.get_or_create_contractor_account(proj.get("contractor_id") if proj else contractor_name, contractor_name)

    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    transfer_id = f"TRF-CON-{rand_suffix}"

    from_dist = bcs.get_entity_wallet("DISTRICT", district_name)
    to_contractor = contractor_wallet or bcs.get_entity_wallet("CONTRACTOR", contractor_name)

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.record_contractor_transfer_onchain(
            transfer_id,
            project_id,
            f"{district_name} District Implementing Agency",
            contractor_name,
            amount,
            receiver_address=to_contractor
        )
        if tx_receipt and tx_receipt.get("tx_hash"):
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
            from_dist = tx_receipt.get("from_address", from_dist)
        else:
            raise Exception("Blockchain transaction failed to return a valid transaction hash.")
    except Exception as e:
        print(f"Error executing contractor transfer on blockchain: {e}")
        # Roll back reservation atomically
        db.projects.update_one(
            {"project_id": project_id},
            {"$inc": {"released_amount": -amount}}
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": f"Blockchain Transaction Failed: {str(e)}. Funds were not transferred."
            }
        )

    now_utc = datetime.now(timezone.utc)
    transfer_doc = {
        "transfer_id": transfer_id,
        "idempotency_key": idempotency_key,
        "project_id": project_id,
        "projectId": project_id,
        "district_name": district_name,
        "contractor_name": contractor_name,
        "amount": amount,
        "notes": notes,
        "transferred_by": current_user["name"],
        "source_account_id": source_account.get("account_id"),
        "source_bank_name": source_account.get("bank_name"),
        "source_masked_account": bas.mask_account_number(source_account.get("account_number")),
        "source_ifsc": source_account.get("ifsc"),
        "destination_account_id": destination_account.get("account_id"),
        "destination_bank_name": destination_account.get("bank_name"),
        "destination_masked_account": bas.mask_account_number(destination_account.get("account_number")),
        "destination_ifsc": destination_account.get("ifsc"),
        "sender_address": from_dist,
        "senderAddress": from_dist,
        "receiver_address": to_contractor,
        "receiverAddress": to_contractor,
        "sender_department": f"{district_name} District Implementing Agency",
        "senderDepartment": f"{district_name} District Implementing Agency",
        "receiver_department": f"{contractor_name} (Contractor)",
        "receiverDepartment": f"{contractor_name} (Contractor)",
        "blockchain_tx_hash": tx_hash,
        "blockchainTxHash": tx_hash,
        "blockchain_block": block_num,
        "created_at": now_utc,
        "timestamp": now_utc
    }
    db.contractor_transfers.insert_one(transfer_doc)

    # Create Authoritative Unified Financial Transaction Record
    financial_tx = bas.record_financial_transaction(
        transaction_type="DISTRICT_TO_CONTRACTOR",
        source_account=source_account,
        destination_account=destination_account,
        amount=amount,
        purpose=notes,
        blockchain_tx_hash=tx_hash,
        blockchain_block=block_num,
        related_project_id=project_id,
        related_contract_id=proj.get("contract_id") if proj else None,
        created_by=current_user["name"],
        status="COMPLETED",
        idempotency_key=idempotency_key
    )

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "last_disbursal_at": now_utc,
            "last_tx_hash": tx_hash
        }}
    )

    try:
        from audit_service import log_audit_event
        log_audit_event(
            event_type="CONTRACTOR_DIRECT_TRANSFER_COMPLETED",
            actor=current_user,
            target_id=project_id,
            target_type="PROJECT_DISBURSAL",
            amount=amount,
            action="TRANSFER_TO_CONTRACTOR",
            status="SUCCESS",
            details=f"District disbursed {amount} directly to contractor {contractor_name} for project {project_id}",
            blockchain_tx_hash=tx_hash,
            blockchain_block=block_num,
            financial_year=proj.get("financial_year") if proj else None,
            extra_data={"project_id": project_id, "contractor_name": contractor_name, "district_name": district_name}
        )
    except Exception:
        pass


    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "blockchainTxHash": tx_hash,
            "block_number": block_num,
            "operation_type": "DISTRICT_CONTRACTOR_TRANSFER",
            "entity_id": project_id,
            "project_id": project_id,
            "projectId": project_id,
            "from_address": from_dist,
            "senderAddress": from_dist,
            "to_address": to_contractor,
            "receiverAddress": to_contractor,
            "from_entity": f"{district_name} District Development Agency",
            "to_entity": f"{contractor_name} (Contractor)",
            "sender_department": f"{district_name} District Implementing Agency",
            "senderDepartment": f"{district_name} District Implementing Agency",
            "receiver_department": f"{contractor_name} (Contractor)",
            "receiverDepartment": f"{contractor_name} (Contractor)",
            "transfer_tier": "DISTRICT_TO_CONTRACTOR",
            "flow_stage": f"4. {district_name} District -> {contractor_name}",
            "amount": amount,
            "details": f"Direct Contractor Transfer: {district_name} District Agency -> {contractor_name} for Project {project_id}",
            "timestamp": now_utc
        })

    # Real-Time WebSocket Synchronization Broadcast
    realtime_manager.trigger_broadcast("TRANSACTION_COMPLETED", {
        "transaction_id": financial_tx["transaction_id"],
        "transaction_type": "DISTRICT_TO_CONTRACTOR",
        "amount": amount,
        "source_entity": source_account.get("account_holder_name"),
        "destination_entity": destination_account.get("account_holder_name"),
        "blockchain_tx_hash": tx_hash
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "transactions",
        "action": "TRANSACTION_COMPLETED",
        "transaction_id": financial_tx["transaction_id"]
    })

    return {
        "success": True,
        "message": f"Funds (INR {amount:,.2f}) successfully transferred to {contractor_name} and recorded on blockchain",
        "transfer": serialize_doc(transfer_doc),
        "transaction": serialize_doc(financial_tx),
        "source_account": bas.serialize_bank_account(source_account),
        "destination_account": bas.serialize_bank_account(destination_account),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.post("/projects/{project_id}/phases/{milestone_index}/approve-funds")
async def approve_phase_funds(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    return await verify_phase_fund_request(project_id, milestone_index, request, current_user)

# --- Milestone Verification & Phase Completion (Steps 16-17, 26-27, 36-37) ---
async def handle_milestone_verification(project_id: str, milestone_index: int, request: Request, current_user: dict):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    if proj.get("is_frozen"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Project is FROZEN due to audit hold."}
        )

    milestone = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not milestone:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Milestone phase not found"}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    action = str(data.get("action", "APPROVE")).upper()
    remarks = data.get("remarks") or data.get("rejection_reason") or data.get("notes") or ""

    # Decision Node: REJECT Submission (Step 17/27/37: No -> Loop back to Execute Work)
    if action == "REJECT":
        if not remarks:
            remarks = "Quality inspection failed or photographic/video evidence was insufficient. Rectification required."

        db.milestones.update_one(
            {"project_id": project_id, "milestone_index": milestone_index},
            {"$set": {
                "status": "REJECTED_NEEDS_RECTIFICATION",
                "phase_status": "REJECTED_NEEDS_RECTIFICATION",
                "evidence_status": "REJECTED",
                "rejection_reason": remarks,
                "rejected_by": current_user["name"],
                "rejected_at": datetime.now(timezone.utc)
            }}
        )

        # Update matching records in db.evidence
        db.evidence.update_many(
            {"$and": [
                {"$or": [{"project_id": project_id}, {"projectId": project_id}]},
                {"$or": [{"milestone_index": milestone_index}, {"milestoneId": f"MS-{project_id}-{milestone_index + 1}"}]}
            ]},
            {"$set": {
                "status": "REJECTED",
                "rejection_reason": remarks,
                "rejectionReason": remarks,
                "rejected_at": datetime.now(timezone.utc),
                "rejected_by": current_user["name"]
            }}
        )

        # Real-time WebSocket synchronization broadcast
        realtime_manager.trigger_broadcast("EVIDENCE_REJECTED", {
            "project_id": project_id,
            "milestone_index": milestone_index,
            "status": "REJECTED",
            "rejection_reason": remarks
        })
        realtime_manager.trigger_broadcast("DATA_MUTATED", {
            "entity": "evidence",
            "project_id": project_id,
            "milestone_index": milestone_index,
            "action": "EVIDENCE_REJECTED"
        })

        if proj.get("contractor_id"):
            db.notifications.insert_one({
                "recipient_user_id": proj.get("contractor_id"),
                "title": f"Phase #{milestone_index + 1} Deliverables Rejected (Rectification Required)",
                "message": f"Phase #{milestone_index + 1} completion evidence for {project_id} was rejected by District Officer. Reason: {remarks}. Please rectify site work and resubmit proof.",
                "link": f"/contractor/my-projects?project_id={project_id}",
                "read": False,
                "created_at": datetime.now(timezone.utc)
            })

        return {
            "success": True,
            "message": f"Phase #{milestone_index + 1} submission rejected. Loop back to Execute Work triggered. Contractor notified to rectify and resubmit.",
            "rejection_reason": remarks
        }


    if milestone.get("status") == "COMPLETED" or milestone.get("status") == "RELEASED":
        return {
            "success": True,
            "message": f"Milestone phase #{milestone_index + 1} is already verified and marked completed.",
            "is_already_completed": True
        }

    # Preserve existing fund transfer transaction metadata if previously disbursed
    tx_hash = milestone.get("blockchain_tx_hash") or milestone.get("fund_transfer_tx")
    block_num = milestone.get("blockchain_block") or milestone.get("fund_transfer_block")

    milestone_amount = milestone.get("amount", 0.0)
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "COMPLETED",
            "phase_status": "COMPLETED",
            "evidence_status": "VERIFIED",
            "progress_percentage": 100,
            "blockchain_tx_hash": tx_hash,
            "blockchain_block": block_num,
            "verified_by": current_user["name"],
            "completed_at": datetime.now(timezone.utc),
            "rejection_reason": None
        }}
    )

    # Mark all evidence for this milestone as VERIFIED
    db.evidence.update_many(
        {"$and": [
            {"$or": [{"project_id": project_id}, {"projectId": project_id}]},
            {"$or": [{"milestone_index": milestone_index}, {"milestoneId": f"MS-{project_id}-{milestone_index + 1}"}]}
        ]},
        {"$set": {
            "status": "VERIFIED",
            "verified_at": datetime.now(timezone.utc),
            "verifiedAt": datetime.now(timezone.utc),
            "verified_by": current_user["name"],
            "verifiedBy": current_user["name"],
            "rejection_reason": None,
            "rejectionReason": None
        }}
    )

    # Real-time WebSocket synchronization broadcast
    realtime_manager.trigger_broadcast("EVIDENCE_VERIFIED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "status": "VERIFIED",
        "verified_by": current_user["name"]
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "evidence",
        "project_id": project_id,
        "milestone_index": milestone_index,
        "action": "EVIDENCE_VERIFIED"
    })

    next_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index + 1})
    if next_phase:
        # Trigger / Unlock Next Phase
        db.milestones.update_one(
            {"project_id": project_id, "milestone_index": milestone_index + 1},
            {"$set": {
                "status": "UNLOCKED",
                "phase_status": "READY_FOR_FUND_REQUEST",
                "unlocked_at": datetime.now(timezone.utc)
            }}
        )

    # Reconcile authoritative released amount across all funded milestones (idempotent, prevents double-counting)
    new_released_total = reconcile_project_released_amount(proj)
    is_final_phase = (milestone_index >= 2)
    calc_prog = compute_project_progress(proj)

    remaining_submitted = db.milestones.count_documents({
        "project_id": project_id,
        "$or": [
            {"status": "SUBMITTED"},
            {"phase_status": "SUBMITTED_FOR_VERIFICATION"},
            {"evidence_status": "SUBMITTED"}
        ]
    })
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "released_amount": new_released_total,
            "status": "FINAL_PROJECT_COMPLETED" if is_final_phase else "IN_PROGRESS",
            "progress_percentage": 100 if is_final_phase else calc_prog,
            "current_active_phase": milestone_index + 2 if not is_final_phase else 3,
            "last_disbursal_at": datetime.now(timezone.utc),
            "has_pending_proof": (remaining_submitted > 0)
        }}
    )


    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Completed & Verified",
            "message": f"Phase #{milestone_index + 1} completion evidence verified by District Officer.{' Phase #' + str(milestone_index + 2) + ' is now unlocked for fund request!' if next_phase else ' All 3 phases completed! Project is ready for closure.'}",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    realtime_manager.trigger_broadcast("MILESTONE_VERIFIED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "next_phase_unlocked": bool(next_phase),
        "is_final_project_completed": is_final_phase,
        "blockchain_tx_hash": tx_hash,
        "status": "COMPLETED"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "milestones",
        "action": "MILESTONE_VERIFIED",
        "project_id": project_id,
        "milestone_index": milestone_index
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "action": "MILESTONE_VERIFIED",
        "project_id": project_id
    })

    return {
        "success": True,
        "message": f"Phase #{milestone_index + 1} verified and completed! {'Phase #' + str(milestone_index + 2) + ' is now unlocked.' if next_phase else 'Final project execution completed!'}",
        "next_phase_unlocked": bool(next_phase),
        "is_final_project_completed": is_final_phase,
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.post("/projects/{project_id}/phases/{milestone_index}/verify")
@router.post("/projects/{project_id}/phases/{milestone_index}/verify-milestone")
async def verify_milestone_and_release(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    return await handle_milestone_verification(project_id, milestone_index, request, current_user)

@router.post("/projects/{project_id}/milestones/{milestone_index}/approve-release")
async def approve_milestone_release_alias(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    return await handle_milestone_verification(project_id, milestone_index, request, current_user)

# --- Step 38: Close Project & Step 39: Deactivate Contractor Bank Account ---
@router.post("/projects/{project_id}/close-project")
async def close_project(
    project_id: str,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "CLOSED",
            "is_closed": True,
            "progress_percentage": 100,
            "closed_at": datetime.now(timezone.utc),
            "closed_by": current_user["name"]
        }}
    )

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Project {project_id} Formally Closed",
            "message": f"District Authority has completed quality audits and formally closed project {project_id}.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Project {project_id} has been formally closed by District Authority."
    }

@router.post("/projects/{project_id}/deactivate-bank-account")
async def deactivate_contractor_bank_account(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    reason = data.get("reason", "Project formally closed and audited. Escrow facility and contractor bank account deactivated.")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "contractor_bank_account.is_active": False,
            "contractor_bank_account.deactivated_at": datetime.now(timezone.utc),
            "contractor_bank_account.deactivation_reason": reason,
            "contractor_bank_account.deactivated_by": current_user["name"],
            "bank_account_status": "DEACTIVATED",
            "status": "CLOSED",
            "is_closed": True
        }}
    )

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": "Contractor Project Bank Account Deactivated",
            "message": f"Project {project_id} bank account has been deactivated: Account Not Available to Contractor.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Contractor bank account for project {project_id} deactivated successfully. Status: Account Not Available to Contractor.",
        "bank_account_status": "DEACTIVATED"
    }

# --- Grievances Management ---
@router.get("/grievances")
async def get_grievances(
    district: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    selected_dist = district

    if user_role == "DISTRICT":
        if not user_dist:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No district assigned to officer profile."}
            )
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "success": False,
                    "message": f"Unauthorized: You cannot view grievances for '{selected_dist}'."
                }
            )
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Pune"

    grievances = list(db.complaints.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))
    return {"success": True, "district_name": district_name, "grievances": serialize_doc(grievances)}

@router.put("/grievances/{reference_id}/update-status")
async def update_grievance_status(
    reference_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    complaint = db.complaints.find_one({"$or": [{"reference_id": reference_id}, {"ref_id": reference_id}]})
    if not complaint:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Grievance complaint not found"}
        )

    allowed, err_msg = check_district_access(complaint.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": err_msg}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    new_status = data.get("status", "RESOLVED").upper()
    notes = data.get("resolution_notes", "Site inspection completed and corrective measures verified.")

    db.complaints.update_one(
        {"$or": [{"reference_id": reference_id}, {"ref_id": reference_id}]},
        {"$set": {
            "status": new_status,
            "resolution_notes": notes,
            "resolved_by": current_user["name"],
            "resolved_at": datetime.now(timezone.utc)
        }}
    )
    return {"success": True, "message": f"Grievance {reference_id} status updated to {new_status}"}

# --- Work Evidence Inspection and District Verification ---
@router.get("/projects/{project_id}/milestones/{milestone_index}/evidence")
@router.get("/projects/{project_id}/phases/{milestone_index}/evidence")
async def list_district_milestone_evidence(
    project_id: str,
    milestone_index: int,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    """Retrieve all submitted evidence items for a milestone under the district's jurisdiction"""
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(status_code=404, content={"success": False, "message": "Project not found"})

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(status_code=403, content={"success": False, "message": err_msg})

    milestone = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})

    evidence_list = list(db.evidence.find({
        "$and": [
            {"$or": [{"project_id": project_id}, {"projectId": project_id}]},
            {"$or": [{"milestone_index": milestone_index}, {"milestoneId": f"MS-{project_id}-{milestone_index + 1}"}]}
        ]
    }).sort("uploaded_at", -1))

    return {
        "success": True,
        "project_id": project_id,
        "project_name": proj.get("name"),
        "contractor_name": proj.get("contractor_name"),
        "milestone_index": milestone_index,
        "milestone_title": milestone.get("title") if milestone else f"Phase #{milestone_index + 1}",
        "evidence_count": len(evidence_list),
        "evidence": serialize_doc(evidence_list)
    }

@router.post("/evidence/{evidence_id}/verify")
@router.post("/projects/{project_id}/milestones/{milestone_index}/evidence/{evidence_id}/verify")
async def verify_work_evidence(
    evidence_id: str,
    request: Request,
    project_id: Optional[str] = None,
    milestone_index: Optional[int] = None,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    """
    District Officer verifies an uploaded work evidence record.
    Sets evidence status to VERIFIED, records verifiedAt & verifiedBy,
    and updates milestone eligibility for next project/payment workflow.
    """
    ev = db.evidence.find_one({
        "$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]
    })
    if not ev:
        return JSONResponse(status_code=404, content={"success": False, "message": "Evidence record not found"})

    proj_id = ev.get("project_id") or ev.get("projectId") or project_id
    proj = db.projects.find_one({"project_id": proj_id})
    if not proj:
        return JSONResponse(status_code=404, content={"success": False, "message": "Associated project not found"})

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(status_code=403, content={"success": False, "message": err_msg})

    if proj.get("is_frozen"):
        return JSONResponse(status_code=403, content={"success": False, "message": "Project is FROZEN by audit hold."})

    m_idx = ev.get("milestone_index", milestone_index or 0)
    now_utc = datetime.now(timezone.utc)

    # Update evidence record to VERIFIED
    db.evidence.update_one(
        {"$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]},
        {"$set": {
            "status": "VERIFIED",
            "verified_at": now_utc,
            "verifiedAt": now_utc,
            "verified_by": current_user["name"],
            "verifiedBy": current_user["name"],
            "rejection_reason": None,
            "rejectionReason": None
        }}
    )

    # Check remaining pending evidence for this milestone
    pending_count = db.evidence.count_documents({
        "$and": [
            {"$or": [{"project_id": proj_id}, {"projectId": proj_id}]},
            {"$or": [{"milestone_index": m_idx}, {"milestoneId": f"MS-{proj_id}-{m_idx + 1}"}]},
            {"status": {"$in": ["SUBMITTED", "PENDING", "DRAFT"]}}
        ]
    })

    if pending_count == 0:
        db.milestones.update_one(
            {"project_id": proj_id, "milestone_index": m_idx},
            {"$set": {
                "evidence_status": "VERIFIED",
                "verified_by": current_user["name"]
            }}
        )

    # Notify contractor
    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Work Evidence Verified: {proj.get('name')}",
            "message": f"Work evidence '{ev.get('file_name', evidence_id)}' for Phase #{m_idx + 1} was verified by District Officer.",
            "link": f"/contractor/my-projects?project_id={proj_id}",
            "read": False,
            "created_at": now_utc
        })

    # Real-time WebSocket synchronization broadcast (Zero manual refresh)
    realtime_manager.trigger_broadcast("EVIDENCE_VERIFIED", {
        "project_id": proj_id,
        "milestone_index": m_idx,
        "evidence_id": evidence_id,
        "status": "VERIFIED",
        "verified_by": current_user["name"]
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "evidence",
        "project_id": proj_id,
        "milestone_index": m_idx,
        "action": "EVIDENCE_VERIFIED"
    })

    updated_ev = db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]})
    return {
        "success": True,
        "message": f"Evidence {evidence_id} successfully verified. Status: VERIFIED.",
        "evidence_status": "VERIFIED",
        "evidence": serialize_doc(updated_ev)
    }

@router.post("/evidence/{evidence_id}/reject")
@router.post("/projects/{project_id}/milestones/{milestone_index}/evidence/{evidence_id}/reject")
async def reject_work_evidence(
    evidence_id: str,
    request: Request,
    project_id: Optional[str] = None,
    milestone_index: Optional[int] = None,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    """
    District Officer rejects an uploaded work evidence record.
    Requires a non-empty rejection reason. Sets evidence status to REJECTED.
    Notifies contractor and updates milestone to REJECTED_NEEDS_RECTIFICATION.
    """
    ev = db.evidence.find_one({
        "$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]
    })
    if not ev:
        return JSONResponse(status_code=404, content={"success": False, "message": "Evidence record not found"})

    proj_id = ev.get("project_id") or ev.get("projectId") or project_id
    proj = db.projects.find_one({"project_id": proj_id})
    if not proj:
        return JSONResponse(status_code=404, content={"success": False, "message": "Associated project not found"})

    allowed, err_msg = check_district_access(proj.get("district_name"), current_user)
    if not allowed:
        return JSONResponse(status_code=403, content={"success": False, "message": err_msg})

    try:
        data = await request.json()
    except Exception:
        data = {}

    rejection_reason = (data.get("rejection_reason") or data.get("remarks") or data.get("reason") or "").strip()
    if not rejection_reason:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Rejection reason is required. Please provide feedback on what was deficient."}
        )

    m_idx = ev.get("milestone_index", milestone_index or 0)
    now_utc = datetime.now(timezone.utc)

    # Update evidence record to REJECTED
    db.evidence.update_one(
        {"$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]},
        {"$set": {
            "status": "REJECTED",
            "rejection_reason": rejection_reason,
            "rejectionReason": rejection_reason,
            "rejected_at": now_utc,
            "rejected_by": current_user["name"],
            "verified_at": None,
            "verified_by": None
        }}
    )

    # Update parent milestone to trigger rectification loop
    db.milestones.update_one(
        {"project_id": proj_id, "milestone_index": m_idx},
        {"$set": {
            "status": "REJECTED_NEEDS_RECTIFICATION",
            "phase_status": "REJECTED_NEEDS_RECTIFICATION",
            "evidence_status": "REJECTED",
            "rejection_reason": rejection_reason,
            "rejected_at": now_utc,
            "rejected_by": current_user["name"]
        }}
    )

    rem_submitted = db.milestones.count_documents({
        "project_id": proj_id,
        "$or": [
            {"status": "SUBMITTED"},
            {"phase_status": "SUBMITTED_FOR_VERIFICATION"},
            {"evidence_status": "SUBMITTED"}
        ]
    })
    db.projects.update_one(
        {"project_id": proj_id},
        {"$set": {"has_pending_proof": (rem_submitted > 0)}}
    )

    # Notify contractor with reason
    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{m_idx + 1} Work Evidence Rejected",
            "message": f"Work evidence for {proj.get('name')} was rejected by District Officer. Reason: \"{rejection_reason}\". Please rectify site work and upload corrected evidence.",
            "link": f"/contractor/my-projects?project_id={proj_id}",
            "read": False,
            "created_at": now_utc
        })

    # Real-time WebSocket synchronization broadcast (Zero manual refresh)
    realtime_manager.trigger_broadcast("EVIDENCE_REJECTED", {
        "project_id": proj_id,
        "milestone_index": m_idx,
        "evidence_id": evidence_id,
        "status": "REJECTED",
        "rejection_reason": rejection_reason,
        "rejected_by": current_user["name"]
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "evidence",
        "project_id": proj_id,
        "milestone_index": m_idx,
        "action": "EVIDENCE_REJECTED"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "project_id": proj_id,
        "milestone_index": m_idx,
        "action": "EVIDENCE_REJECTED"
    })

    updated_ev = db.evidence.find_one({"$or": [{"evidence_id": evidence_id}, {"evidenceId": evidence_id}]})
    return {
        "success": True,
        "message": "Work evidence rejected. Contractor notified with rejection reason for rectification.",
        "evidence_status": "REJECTED",
        "rejection_reason": rejection_reason,
        "evidence": serialize_doc(updated_ev)
    }
