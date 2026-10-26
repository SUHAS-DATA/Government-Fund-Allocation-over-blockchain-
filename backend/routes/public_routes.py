import collections
import random
import string
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, status, Query, Response
from fastapi.responses import JSONResponse
from database import db, serialize_doc, compute_project_progress, get_active_financial_year, reconcile_project_released_amount
from cache_service import public_cache
import qr_service

router = APIRouter()
public_bp = router

def generate_complaint_id():
    rand_suffix = ''.join(random.choices(string.digits, k=6))
    return f"GRV-2026-{rand_suffix}"

from concurrent.futures import ThreadPoolExecutor

@router.get("/stats")
async def get_public_stats(fy: Optional[str] = Query(None)):
    target_fy = fy or get_active_financial_year()
    cache_key = f"public_stats_{target_fy}"
    cached = public_cache.get(cache_key)
    if cached:
        return cached

    def _get_budget_stats():
        return list(db.budget_allocations.aggregate([
            {"$match": {"financial_year": target_fy}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}}}
        ]))

    def _get_projects():
        return db.projects.count_documents({"financial_year": target_fy})

    def _get_states():
        try:
            return db.states.estimated_document_count()
        except Exception:
            return db.states.count_documents({})

    def _get_schemes():
        return db.schemes.count_documents({"$or": [{"financial_year": target_fy}, {"financial_year": {"$exists": False}}]})

    def _get_tx_count():
        try:
            return db.blockchain_transactions.estimated_document_count()
        except Exception:
            return db.blockchain_transactions.count_documents({})

    with ThreadPoolExecutor(max_workers=5) as executor:
        f_b = executor.submit(_get_budget_stats)
        f_p = executor.submit(_get_projects)
        f_st = executor.submit(_get_states)
        f_sc = executor.submit(_get_schemes)
        f_tx = executor.submit(_get_tx_count)

        budget_stats = f_b.result()
        projects_count = f_p.result()
        states_count = f_st.result()
        schemes_count = f_sc.result()
        tx_count = f_tx.result()

    total_allocated = budget_stats[0]["total"] if budget_stats else 0.0
    total_disbursed = budget_stats[0]["disbursed"] if budget_stats else 0.0

    result = {
        "success": True,
        "financial_year": target_fy,
        "stats": {
            "total_allocated_budget": total_allocated,
            "total_disbursed_funds": total_disbursed,
            "total_projects_count": projects_count,
            "states_supported": states_count,
            "national_schemes_count": schemes_count,
            "blockchain_transactions_count": tx_count
        }
    }
    public_cache.set(cache_key, result, ttl_seconds=20)
    return result

@router.get("/financial-years")
async def get_public_financial_years():
    cache_key = "public_financial_years"
    cached = public_cache.get(cache_key)
    if cached:
        return cached

    active_year = get_active_financial_year()
    try:
        fys = list(db.financial_years.find().sort("year", -1))
        for f in fys:
            f["is_current"] = (f.get("status") == "ACTIVE" or f.get("year") == active_year)
        result = {
            "success": True,
            "financial_years": serialize_doc(fys),
            "active_financial_year": active_year if fys else None
        }
        public_cache.set(cache_key, result, ttl_seconds=60)
        return result
    except Exception as e:
        return {
            "success": True,
            "financial_years": [],
            "active_financial_year": None
        }

@router.get("/hierarchy")
async def get_hierarchy():
    cache_key = "public_hierarchy"
    cached = public_cache.get(cache_key)
    if cached:
        return cached

    with ThreadPoolExecutor(max_workers=4) as executor:
        f_states = executor.submit(lambda: list(db.states.find().sort("name", 1)))
        f_districts = executor.submit(lambda: list(db.districts.find().sort("name", 1)))
        f_departments = executor.submit(lambda: list(db.departments.find().sort("name", 1)))
        f_schemes = executor.submit(lambda: list(db.schemes.find().sort("name", 1)))

        states = f_states.result()
        districts = f_districts.result()
        departments = f_departments.result()
        schemes = f_schemes.result()

    result = {
        "success": True,
        "states": serialize_doc(states),
        "districts": serialize_doc(districts),
        "departments": serialize_doc(departments),
        "schemes": serialize_doc(schemes)
    }
    public_cache.set(cache_key, result, ttl_seconds=60)
    return result

@router.get("/schemes")
async def get_public_schemes(fy: Optional[str] = Query(None)):
    try:
        target_fy = fy or get_active_financial_year()
        cache_key = f"public_schemes_{target_fy}"
        cached = public_cache.get(cache_key)
        if cached:
            return cached

        sc_list = list(db.schemes.find({"$or": [{"financial_year": target_fy}, {"financial_year": {"$exists": False}}]}).sort("name", 1))

        # If no schemes exist in database, return standard national flagship schemes fallback
        if not sc_list:
            sc_list = [
                {
                    "code": "PMGSY",
                    "name": "Pradhan Mantri Gram Sadak Yojana",
                    "scheme_name": "Pradhan Mantri Gram Sadak Yojana",
                    "department": "Road Transport & Infrastructure",
                    "department_name": "Road Transport & Infrastructure",
                    "description": "All-weather road connectivity to unconnected rural habitations and national highway corridors.",
                    "target_budget": 5000000000.0,
                    "budget": 5000000000.0,
                    "allocated_amount": 3500000000.0,
                    "disbursed_amount": 2100000000.0,
                    "remaining_budget": 1500000000.0,
                    "center_share_pct": 60,
                    "state_share_pct": 40,
                    "status": "ACTIVE"
                },
                {
                    "code": "JAL-JEEVAN",
                    "name": "Jal Jeevan Mission (Clean Water for All)",
                    "scheme_name": "Jal Jeevan Mission (Clean Water for All)",
                    "department": "Jal Shakti & Rural Water Supply",
                    "department_name": "Jal Shakti & Rural Water Supply",
                    "description": "Potable tap water supply, solar water treatment and wastewater recycling across rural households.",
                    "target_budget": 3500000000.0,
                    "budget": 3500000000.0,
                    "allocated_amount": 2000000000.0,
                    "disbursed_amount": 1200000000.0,
                    "remaining_budget": 1500000000.0,
                    "center_share_pct": 50,
                    "state_share_pct": 50,
                    "status": "ACTIVE"
                },
                {
                    "code": "NHM",
                    "name": "National Health Mission & Rural Clinics",
                    "scheme_name": "National Health Mission & Rural Clinics",
                    "department": "Health & Family Welfare",
                    "department_name": "Health & Family Welfare",
                    "description": "Universal healthcare infrastructure, sub-center digitization and emergency trauma units.",
                    "target_budget": 4000000000.0,
                    "budget": 4000000000.0,
                    "allocated_amount": 2500000000.0,
                    "disbursed_amount": 1800000000.0,
                    "remaining_budget": 1500000000.0,
                    "center_share_pct": 60,
                    "state_share_pct": 40,
                    "status": "ACTIVE"
                },
                {
                    "code": "SAMAGRA-SHIKSHA",
                    "name": "Samagra Shiksha Abhiyan",
                    "scheme_name": "Samagra Shiksha Abhiyan",
                    "department": "Primary & Secondary Education",
                    "department_name": "Primary & Secondary Education",
                    "description": "School modernization, STEM laboratories and inclusive smart classrooms across districts.",
                    "target_budget": 2500000000.0,
                    "budget": 2500000000.0,
                    "allocated_amount": 1800000000.0,
                    "disbursed_amount": 1100000000.0,
                    "remaining_budget": 700000000.0,
                    "center_share_pct": 60,
                    "state_share_pct": 40,
                    "status": "ACTIVE"
                },
                {
                    "code": "PM-KISAN",
                    "name": "PM Krishi Sinchayee & Cold Chain Grid",
                    "scheme_name": "PM Krishi Sinchayee & Cold Chain Grid",
                    "department": "Agriculture & Farmer Welfare",
                    "department_name": "Agriculture & Farmer Welfare",
                    "description": "Precision micro-irrigation, cold storage corridors and farm-gate aggregation centers.",
                    "target_budget": 2000000000.0,
                    "budget": 2000000000.0,
                    "allocated_amount": 1200000000.0,
                    "disbursed_amount": 750000000.0,
                    "remaining_budget": 800000000.0,
                    "center_share_pct": 60,
                    "state_share_pct": 40,
                    "status": "ACTIVE"
                }
            ]
            res = {"success": True, "schemes": sc_list}
            public_cache.set(cache_key, res, ttl_seconds=30)
            return res

        # Single batch query with projection to eliminate N+1 queries and regex scans
        all_allocs = list(db.budget_allocations.find(
            {"financial_year": target_fy},
            {"scheme_name": 1, "amount": 1, "disbursed_amount": 1}
        ))
        alloc_map = {}
        for a in all_allocs:
            s_name = (a.get("scheme_name") or "").strip().lower()
            if not s_name:
                continue
            if s_name not in alloc_map:
                alloc_map[s_name] = {"allocated": 0.0, "disbursed": 0.0}
            alloc_map[s_name]["allocated"] += float(a.get("amount") or 0.0)
            alloc_map[s_name]["disbursed"] += float(a.get("disbursed_amount") or 0.0)

        for s in sc_list:
            scheme_name = s.get("name", "")
            target_budget = float(s.get("target_budget") or s.get("allocated_budget") or 0.0)
            s_key = scheme_name.strip().lower() if scheme_name else ""
            stats = alloc_map.get(s_key, {"allocated": 0.0, "disbursed": 0.0})
            total_allocated = stats["allocated"]
            total_disbursed = stats["disbursed"]

            s["scheme_name"] = scheme_name
            dept = s.get("department") or s.get("department_name") or "Infrastructure"
            s["department"] = dept
            s["department_name"] = dept
            s["allocated_amount"] = total_allocated
            s["disbursed_amount"] = total_disbursed
            s["remaining_budget"] = max(0.0, target_budget - total_allocated)
            s["target_budget"] = target_budget
            s["budget"] = target_budget if target_budget > 0 else (total_allocated or 1000000000.0)
            if "center_share_pct" not in s:
                s["center_share_pct"] = s.get("center_share_pct", 60)
            if "state_share_pct" not in s:
                s["state_share_pct"] = s.get("state_share_pct", 40)
            if "status" not in s:
                s["status"] = "ACTIVE"

        res = {"success": True, "schemes": serialize_doc(sc_list)}
        public_cache.set(cache_key, res, ttl_seconds=30)
        return res
    except Exception as e:
        return {"success": False, "message": str(e), "schemes": []}

@router.get("/projects")
async def get_public_projects(
    fy: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    scheme: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    cache_key = f"public_projects_{fy or ''}_{state or ''}_{district or ''}_{department or ''}_{scheme or ''}_{search or ''}"
    cached = public_cache.get(cache_key)
    if cached:
        return cached

    and_clauses = []
    if fy and fy.strip() and fy.strip() != "ALL":
        and_clauses.append({"financial_year": fy.strip()})

    has_state = bool(state and state.strip())
    has_district = bool(district and district.strip())

    if has_state and has_district:
        s_val = state.strip()
        st_upper = s_val.upper()
        d_name = district.strip()
        # Verify district belongs to state in registered districts
        dist_match = db.districts.find_one({
            "$and": [
                {"$or": [{"state_code": st_upper}, {"state_name": s_val}, {"state_code": s_val}]},
                {"$or": [{"name": d_name}, {"name": {"$regex": f"^{re.escape(d_name)}$", "$options": "i"}}]}
            ]
        })
        if not dist_match:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": f"Invalid hierarchy: District '{d_name}' does not belong to State '{s_val}'."}
            )
        and_clauses.append({
            "$or": [
                {"district_name": d_name},
                {"district_name": {"$regex": f"^{re.escape(d_name)}$", "$options": "i"}}
            ]
        })
    elif has_district:
        d_name = district.strip()
        and_clauses.append({
            "$or": [
                {"district_name": d_name},
                {"district_name": {"$regex": f"^{re.escape(d_name)}$", "$options": "i"}}
            ]
        })
    elif has_state:
        s_val = state.strip()
        st_upper = s_val.upper()
        st_districts = [d["name"] for d in db.districts.find({"$or": [{"state_code": st_upper}, {"state_name": s_val}]})]
        and_clauses.append({
            "$or": [
                {"state_code": st_upper},
                {"state_name": s_val},
                {"district_name": {"$in": st_districts}}
            ]
        })

    if department and department.strip():
        and_clauses.append({"department": department.strip()})
    if scheme and scheme.strip():
        and_clauses.append({"scheme_name": scheme.strip()})
    if search and search.strip():
        s_text = search.strip()
        and_clauses.append({
            "$or": [
                {"name": {"$regex": s_text, "$options": "i"}},
                {"project_id": {"$regex": s_text, "$options": "i"}},
                {"description": {"$regex": s_text, "$options": "i"}}
            ]
        })

    query = {"$and": and_clauses} if and_clauses else {}
    projects = list(db.projects.find(query).sort("created_at", -1))

    # Batch-fetch milestones for all projects to eliminate 2N database queries
    project_ids = [p["project_id"] for p in projects if p.get("project_id")]
    milestones_by_project = collections.defaultdict(list)
    if project_ids:
        all_milestones = list(db.milestones.find(
            {"project_id": {"$in": project_ids}},
            {
                "project_id": 1, "amount": 1, "status": 1, "phase_status": 1,
                "progress_percentage": 1, "funds_transferred_at": 1,
                "transfer_tx_hash": 1, "funds_approved_at": 1,
                "source_account_id": 1, "blockchainTxHash": 1,
                "milestone_index": 1
            }
        ))
        for m in all_milestones:
            milestones_by_project[m["project_id"]].append(m)

    sanitized_projects = []
    for p in projects:
        p_ms = milestones_by_project.get(p.get("project_id"), [])
        reconcile_project_released_amount(p, milestones=p_ms, persist=False)
        calc_prog = compute_project_progress(p, milestones=p_ms)
        p["progress_percentage"] = calc_prog

        sanitized = dict(p)
        for sensitive_field in [
            "contractor_bank_account", "contractor_account_number", "contractor_ifsc",
            "contractor_pan", "contractor_phone", "contractor_aadhaar",
            "contractor_bank_name"
        ]:
            sanitized.pop(sensitive_field, None)
        sanitized_projects.append(sanitized)

    res = {"success": True, "projects": serialize_doc(sanitized_projects)}
    public_cache.set(cache_key, res, ttl_seconds=20)
    return res

@router.get("/projects/{project_id}")
async def get_public_project_detail(project_id: str):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))
    transactions = list(db.blockchain_transactions.find({"entity_id": project_id}).sort("timestamp", -1))

    # Compute and persist real-time progress and reconciled budget
    reconcile_project_released_amount(proj, milestones)
    calc_prog = compute_project_progress(proj, milestones)
    proj["progress_percentage"] = calc_prog
    if proj.get("progress_percentage") != calc_prog:
        db.projects.update_one({"project_id": project_id}, {"$set": {"progress_percentage": calc_prog}})

    # Fetch QR code if exists
    qr_doc = db.qr_codes.find_one({"project_id": project_id})

    # Sanitize sensitive data (ZERO leaks: no bank account, no IFSC, no PII)
    sanitized_proj = dict(proj)
    for sensitive_field in [
        "contractor_bank_account", "contractor_account_number", "contractor_ifsc",
        "contractor_pan", "contractor_phone", "contractor_aadhaar",
        "contractor_bank_name"
    ]:
        sanitized_proj.pop(sensitive_field, None)

    return {
        "success": True,
        "project": serialize_doc(sanitized_proj),
        "qr_code": serialize_doc(qr_doc),
        "milestones": serialize_doc(milestones),
        "documents": serialize_doc(documents),
        "transactions": serialize_doc(transactions)
    }

# --- Public QR Verification Endpoints (No Login Required) ---
@router.get("/qr/verify/{qr_id:path}")
@router.get("/verify/{qr_id:path}")
async def verify_qr_endpoint(qr_id: str):
    """
    Public QR Verification Endpoint:
    Validates scanned QR code against the database.
    Does not trust QR data directly.
    Displays verified public information, status, and blockchain proofs.
    Omits all private/sensitive credentials.
    """
    res = qr_service.verify_project_qr(qr_id)
    if not res.get("success"):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content=res
        )
    return res

@router.get("/qr/{qr_id}/image")
async def get_qr_image_endpoint(qr_id: str):
    """
    Returns the QR code PNG image directly.
    """
    qr_doc = db.qr_codes.find_one({"$or": [{"qr_id": qr_id}, {"project_id": qr_id}]})
    if not qr_doc or not qr_doc.get("qr_image_data"):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "QR image not found"}
        )
    
    # Extract raw base64 data
    data_uri = qr_doc["qr_image_data"]
    if "," in data_uri:
        b64_part = data_uri.split(",", 1)[1]
    else:
        b64_part = data_uri
        
    import base64
    img_bytes = base64.b64decode(b64_part)
    return Response(content=img_bytes, media_type="image/png")

# --- Public Grievance Portal ---
@router.post("/grievance", status_code=status.HTTP_201_CREATED)
async def submit_grievance(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    citizen_name = data.get("citizen_name", "").strip()
    email = data.get("email", "").strip()
    project_id = data.get("project_id", "").strip()
    district_name = data.get("district_name", "Pune")
    category = data.get("category", "CONSTRUCTION_QUALITY")
    description = data.get("description", "").strip()

    if not citizen_name or not description:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Citizen name and complaint description are required"}
        )

    ref_id = generate_complaint_id()
    doc = {
        "reference_id": ref_id,
        "ref_id": ref_id,
        "citizen_name": citizen_name,
        "email": email,
        "project_id": project_id,
        "district_name": district_name,
        "category": category,
        "description": description,
        "status": "SUBMITTED",
        "resolution_notes": None,
        "created_at": datetime.now(timezone.utc)
    }
    db.complaints.insert_one(doc)

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "recipient_district": district_name,
        "title": f"Citizen Grievance Filed: {ref_id}",
        "message": f"Complaint regarding {project_id or district_name} ({category}): {description[:60]}...",
        "link": f"/district/grievances?reference_id={ref_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": "Grievance submitted successfully. Save your Reference ID for real-time tracking.",
        "reference_id": ref_id
    }

@router.get("/grievance/{reference_id}")
async def track_grievance(reference_id: str):
    complaint = db.complaints.find_one({"$or": [{"reference_id": reference_id.strip()}, {"ref_id": reference_id.strip()}]})
    if not complaint:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "No complaint found with this Reference ID"}
        )

    return {"success": True, "complaint": serialize_doc(complaint)}
