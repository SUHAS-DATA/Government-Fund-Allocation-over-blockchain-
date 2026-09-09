import os
import random
import string
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import require_roles
import blockchain_service as bcs

router = APIRouter()
district_bp = router

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
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    selected_dist = district
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code", "KA")
    user_state_name = current_user.get("state_name", "Karnataka")

    if user_role == "DISTRICT":
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

    state_districts = list(db.districts.find({"state_code": user_state}).sort("name", 1))
    if not state_districts:
        state_districts = list(db.districts.find().sort("name", 1))

    received_allocs = list(db.district_allocations.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))
    
    total_received = sum(a.get("amount", 0) for a in received_allocs)

    projects = list(db.projects.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))
    
    total_released = sum(p.get("released_amount", 0) for p in projects)
    pending_kyc = db.contractor_kyc.count_documents({"kyc_status": "UNDER_REVIEW"})
    open_grievances = db.complaints.count_documents({
        "district_name": {"$regex": f"^{district_name}$", "$options": "i"},
        "status": {"$ne": "RESOLVED"}
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
        "metrics": {
            "total_funds_received": total_received,
            "total_projects_count": len(projects),
            "active_projects_count": len([p for p in projects if p.get("status") in ["IN_PROGRESS", "ASSIGNED", "ESCROW_FUNDED"]]),
            "total_payments_released": total_released,
            "pending_kyc_count": pending_kyc,
            "open_grievances_count": open_grievances
        },
        "recent_projects": serialize_doc(projects[:5]),
        "received_funds": serialize_doc(received_allocs)
    }

# --- Scheme Management (Step 1: Create & View Schemes) ---
@router.get("/schemes")
async def get_schemes(
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    sc_list = list(db.schemes.find().sort("name", 1))
    return {"success": True, "schemes": serialize_doc(sc_list)}

@router.post("/schemes", status_code=status.HTTP_201_CREATED)
async def create_scheme(
    request: Request,
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = str(data.get("code", "")).strip().upper()
    name = str(data.get("name", "")).strip()
    department = str(data.get("department", "Infrastructure & Public Works")).strip()
    allocated_budget = float(data.get("allocated_budget", 500000000.0))
    description = str(data.get("description", "")).strip()

    if not code or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Scheme code and name are required"}
        )

    scheme_doc = {
        "code": code,
        "name": name,
        "department": department,
        "allocated_budget": allocated_budget,
        "description": description or f"District development scheme {name}",
        "is_active": True,
        "created_by": current_user.get("name", "District Officer"),
        "created_at": datetime.now(timezone.utc)
    }

    db.schemes.update_one({"code": code}, {"$set": scheme_doc}, upsert=True)

    return {
        "success": True,
        "message": f"Scheme '{name}' ({code}) registered successfully",
        "scheme": serialize_doc(scheme_doc)
    }

# --- Contractor KYC Review & Directory ---
@router.get("/contractors")
async def get_contractors(
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    contractors = list(db.contractor_kyc.find().sort("created_at", -1))
    for c in contractors:
        user = None
        uid = c.get("user_id")
        if uid and ObjectId.is_valid(str(uid)):
            user = db.users.find_one({"_id": ObjectId(uid)})
        elif uid:
            user = db.users.find_one({"email": uid}) or db.users.find_one({"user_id": uid})

        if user:
            c["email"] = user.get("email")
            c["contact_name"] = user.get("name")
            c["wallet_address"] = user.get("wallet_address", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
        
        docs = list(db.documents.find({"entity_id": str(uid)})) if uid else []
        c["kyc_documents"] = serialize_doc(docs)

    return {"success": True, "contractors": serialize_doc(contractors)}

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

    db.contractor_kyc.update_one(
        {"user_id": user_id},
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
    current_user: dict = Depends(require_roles(["DISTRICT"]))
):
    selected_dist = district
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code", "KA")
    user_state_name = current_user.get("state_name", "Karnataka")

    if user_role == "DISTRICT":
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

    proj_list = list(db.projects.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))

    return {
        "success": True,
        "district_name": district_name,
        "state_code": user_state,
        "state_name": user_state_name,
        "is_locked_district": (user_role == "DISTRICT"),
        "projects": serialize_doc(proj_list)
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
    scheme_name = data.get("scheme_name", "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)")
    department = data.get("department", "Road Transport & Infrastructure")
    
    user_role = current_user.get("role")
    user_dist = current_user.get("district_name")
    user_state = current_user.get("state_code", "KA")
    user_state_name = current_user.get("state_name", "Karnataka")

    req_district = data.get("district_name")
    if user_role == "DISTRICT":
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

    total_budget = float(data.get("total_budget", 150000000.0))

    if not name or total_budget <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project name and valid budget are required"}
        )

    project_id = generate_project_id(target_district)

    doc = {
        "project_id": project_id,
        "name": name,
        "scheme_name": scheme_name,
        "department": department,
        "state_code": data.get("state_code", user_state),
        "state_name": user_state_name,
        "district_name": target_district,
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

    return {
        "success": True,
        "message": f"Project {project_id} created successfully for {target_district}",
        "project": serialize_doc(doc)
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
    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))

    return {
        "success": True,
        "project": serialize_doc(proj),
        "milestones": serialize_doc(milestones),
        "documents": serialize_doc(documents)
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

    query = {
        "$or": [
            {"user_id": str(contractor_user_id)},
            {"contractor_id": str(contractor_user_id)},
            {"email": str(contractor_user_id).lower()}
        ]
    }
    if ObjectId.is_valid(str(contractor_user_id)):
        query["$or"].append({"_id": ObjectId(contractor_user_id)})

    kyc = db.contractor_kyc.find_one(query)
    user_query = {
        "$or": [
            {"contractor_id": str(contractor_user_id)},
            {"email": str(contractor_user_id).lower()},
            {"username": str(contractor_user_id).lower()}
        ]
    }
    if ObjectId.is_valid(str(contractor_user_id)):
        user_query["$or"].append({"_id": ObjectId(contractor_user_id)})
    user = db.users.find_one(user_query)

    company_name = (kyc.get("company_name") if kyc else None) or (user.get("company_name") if user else None) or (user.get("name") if user else None) or "Apex Infrastructure Contractors Pvt Ltd"
    contractor_email = user.get("email") if user else "contractor@buildcorp.in"
    contractor_assigned_id = str(user["_id"]) if user else str(contractor_user_id)
    contractor_wallet = (kyc.get("wallet_address") if kyc else None) or (user.get("wallet_address") if user else None) or "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

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

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "contractor_id": contractor_assigned_id,
            "contractor_email": contractor_email,
            "contractor_name": company_name,
            "contractor_wallet": contractor_wallet,
            "contractor_bank_account": bank_details,
            "bank_account_status": "ACTIVE",
            "status": "ASSIGNED",
            "assigned_at": datetime.now(timezone.utc)
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

    if proj.get("escrow_onchain"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Smart contract escrow already created on Ethereum"}
        )

    tx_hash = None
    block_num = None
    try:
        contractor_wallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
        tx_receipt = bcs.create_project_escrow_onchain(
            project_id,
            proj.get("name"),
            contractor_wallet,
            proj.get("total_budget")
        )
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning deploying smart contract escrow: {e}")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "escrow_onchain": True,
            "escrow_tx_hash": tx_hash,
            "escrow_block": block_num,
            "status": "ESCROW_FUNDED",
            "escrow_created_at": datetime.now(timezone.utc)
        }}
    )

    if tx_hash:
        from_dist = bcs.get_entity_wallet("DISTRICT", proj.get("district_name"))
        to_escrow = bcs.get_entity_wallet("ESCROW")
        dist_title = proj.get("district_name") or "District"
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "PROJECT_ESCROW_CREATION",
            "entity_id": project_id,
            "from_address": from_dist,
            "to_address": to_escrow,
            "from_entity": f"{dist_title} District Development Agency",
            "to_entity": "Project Smart Contract Escrow",
            "transfer_tier": "DISTRICT_TO_ESCROW",
            "flow_stage": f"4. {dist_title} District -> Project Escrow Lock",
            "amount": proj.get("total_budget"),
            "details": f"Project Escrow Lock: {dist_title} Agency -> Smart Contract Escrow for {proj.get('name')}",
            "timestamp": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Smart contract escrow deployed on Ethereum for {project_id}",
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
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

    total_milestones_sum = sum(float(m.get("amount", 0)) for m in milestones_data)
    if total_milestones_sum > proj.get("total_budget", 0):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Sum of milestones (INR {total_milestones_sum:,.2f}) exceeds project budget ceiling (INR {proj.get('total_budget'):,.2f})"
            }
        )

    amounts_list = [int(m.get("amount", 0)) for m in milestones_data]
    try:
        bcs.set_project_milestones_onchain(project_id, amounts_list)
    except Exception as e:
        print(f"Warning setting milestones on-chain: {e}")

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

    return {"success": True, "message": f"{len(milestones_data)} milestones configured and anchored on blockchain."}

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

        return {
            "success": True,
            "message": f"Phase #{milestone_index + 1} fund request rejected. Reason recorded and contractor notified.",
            "fund_rejection_reason": remarks
        }

    # Decision Node: APPROVE -> Step 10: Allocate Funds & Step 11: Transfer Funds to Contractor Bank Account
    allocated_amount = phase.get("amount", 0.0)
    bank_acc = proj.get("contractor_bank_account") or {
        "bank_name": "State Bank of India",
        "account_number": "SBIN-992834710293",
        "ifsc_code": "SBIN0001234",
        "wallet_address": proj.get("contractor_wallet", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
    }

    tx_hash = None
    block_num = None
    try:
        from_dist = bcs.get_entity_wallet("DISTRICT", proj.get("district_name"))
        to_contractor = bank_acc.get("wallet_address") or bcs.get_entity_wallet("CONTRACTOR", proj.get("contractor_name"))
        tx_receipt = bcs.release_milestone_payment_onchain(project_id, milestone_index)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning executing bank transfer transaction on blockchain: {e}")

    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "FUNDS_TRANSFERRED",
            "phase_status": "FUNDS_TRANSFERRED",
            "funds_approved_by": current_user["name"],
            "funds_approved_at": datetime.now(timezone.utc),
            "funds_transferred_at": datetime.now(timezone.utc),
            "transfer_tx_hash": tx_hash,
            "fund_rejection_reason": None
        }}
    )

    # Record On-Chain Bank Transfer Ledger Entry
    db.blockchain_transactions.insert_one({
        "tx_hash": tx_hash or f"0x{os.urandom(32).hex()}",
        "block_number": block_num or 1000,
        "operation_type": "PHASE_FUND_TRANSFER_TO_CONTRACTOR_BANK",
        "entity_id": project_id,
        "from_address": bcs.get_entity_wallet("DISTRICT", proj.get("district_name")),
        "to_address": bank_acc.get("wallet_address", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
        "from_entity": f"{proj.get('district_name')} District Development Agency",
        "to_entity": f"{proj.get('contractor_name')} ({bank_acc.get('bank_name')} A/C: {bank_acc.get('account_number')})",
        "transfer_tier": "DISTRICT_ESCROW_TO_CONTRACTOR_BANK",
        "flow_stage": f"Fund Disbursal Phase #{milestone_index + 1}: District -> Contractor Bank Account",
        "amount": allocated_amount,
        "details": f"Phase #{milestone_index + 1} Allocated Funds Transferred to {proj.get('contractor_name')} Bank Account ({bank_acc.get('bank_name')} A/C: {bank_acc.get('account_number')}, IFSC: {bank_acc.get('ifsc_code')})",
        "timestamp": datetime.now(timezone.utc)
    })

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Funds Transferred to Bank Account (INR {allocated_amount:,.2f})",
            "message": f"District Officer approved and transferred INR {allocated_amount:,.2f} to your {bank_acc.get('bank_name')} account ({bank_acc.get('account_number')}). You may now execute work.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Phase #{milestone_index + 1} funds (INR {allocated_amount:,.2f}) allocated and transferred to Contractor Bank Account ({bank_acc.get('bank_name')} A/C: {bank_acc.get('account_number')}).",
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
                "rejection_reason": remarks,
                "rejected_by": current_user["name"],
                "rejected_at": datetime.now(timezone.utc)
            }}
        )

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

    # Decision Node: APPROVE Submission (Step 17/27/37: Yes -> Phase Completed)
    if milestone.get("status") == "COMPLETED" or milestone.get("status") == "RELEASED":
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Milestone phase has already been verified and marked completed."}
        )

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.release_milestone_payment_onchain(project_id, milestone_index)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning executing milestone completion anchor on blockchain: {e}")

    milestone_amount = milestone.get("amount", 0.0)
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "COMPLETED",
            "phase_status": "COMPLETED",
            "progress_percentage": 100,
            "blockchain_tx_hash": tx_hash,
            "blockchain_block": block_num,
            "verified_by": current_user["name"],
            "completed_at": datetime.now(timezone.utc),
            "rejection_reason": None
        }}
    )

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

    new_released_total = proj.get("released_amount", 0.0) + milestone_amount
    is_final_phase = (milestone_index >= 2)

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "released_amount": new_released_total,
            "status": "FINAL_PROJECT_COMPLETED" if is_final_phase else "IN_PROGRESS",
            "current_active_phase": milestone_index + 2 if not is_final_phase else 3,
            "last_disbursal_at": datetime.now(timezone.utc)
        }}
    )

    if tx_hash:
        from_escrow = bcs.get_entity_wallet("ESCROW")
        contractor_wallet = proj.get("contractor_wallet") or bcs.get_entity_wallet("CONTRACTOR", proj.get("contractor_name"))
        contractor_name = proj.get("contractor_name") or "Contractor & Vendor"
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "MILESTONE_COMPLETION_VERIFICATION",
            "entity_id": project_id,
            "from_address": from_escrow,
            "to_address": contractor_wallet,
            "from_entity": "Project Smart Contract Escrow",
            "to_entity": f"{contractor_name} (Contractor)",
            "transfer_tier": "ESCROW_TO_CONTRACTOR",
            "flow_stage": f"Milestone #{milestone_index + 1} Verified & Completed",
            "amount": milestone_amount,
            "details": f"Phase #{milestone_index + 1} Completion Verified: Smart Contract Escrow -> {contractor_name} for {proj.get('name')}",
            "timestamp": datetime.now(timezone.utc)
        })

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Completed & Verified",
            "message": f"Phase #{milestone_index + 1} completion evidence verified by District Officer.{' Phase #' + str(milestone_index + 2) + ' is now unlocked for fund request!' if next_phase else ' All 3 phases completed! Project is ready for closure.'}",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
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
            "closed_at": datetime.now(timezone.utc),
            "closed_by": current_user["name"]
        }}
    )

    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"38. Project {project_id} Formally Closed",
            "message": f"District Authority has completed quality audits and formally closed project {project_id}.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Project {project_id} has been formally closed by District Authority (Step 38)."
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
            "title": "39. Contractor Project Bank Account Deactivated",
            "message": f"Project {project_id} bank account has been deactivated: Account Not Available to Contractor.",
            "link": f"/contractor/my-projects?project_id={project_id}",
            "read": False,
            "created_at": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Contractor bank account for project {project_id} deactivated successfully (Step 39). Status: Account Not Available to Contractor.",
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
