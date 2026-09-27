import random
import string
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, status, Query
from fastapi.responses import JSONResponse
from database import db, serialize_doc, compute_project_progress

router = APIRouter()
public_bp = router

def generate_complaint_id():
    rand_suffix = ''.join(random.choices(string.digits, k=6))
    return f"GRV-2026-{rand_suffix}"

@router.get("/stats")
async def get_public_stats():
    budget_stats = list(db.budget_allocations.aggregate([
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}}}
    ]))
    total_allocated = budget_stats[0]["total"] if budget_stats else 0.0
    total_disbursed = budget_stats[0]["disbursed"] if budget_stats else 0.0

    projects_count = db.projects.count_documents({})
    states_count = db.states.count_documents({})
    schemes_count = db.schemes.count_documents({})
    tx_count = db.blockchain_transactions.count_documents({})

    return {
        "success": True,
        "stats": {
            "total_allocated_budget": total_allocated,
            "total_disbursed_funds": total_disbursed,
            "total_projects_count": projects_count,
            "states_supported": states_count,
            "national_schemes_count": schemes_count,
            "blockchain_transactions_count": tx_count
        }
    }

@router.get("/financial-years")
async def get_public_financial_years():
    try:
        fys = list(db.financial_years.find().sort("year", -1))
        if fys:
            return {"success": True, "financial_years": serialize_doc(fys)}
    except Exception as e:
        pass
    return {
        "success": True,
        "financial_years": [
            {"year": "2026-27", "is_current": True, "description": "National Financial Year 2026-27"},
            {"year": "2025-26", "is_current": False, "description": "National Financial Year 2025-26"}
        ]
    }

@router.get("/hierarchy")
async def get_hierarchy():
    states = list(db.states.find().sort("name", 1))
    districts = list(db.districts.find().sort("name", 1))
    departments = list(db.departments.find().sort("name", 1))
    schemes = list(db.schemes.find().sort("name", 1))

    return {
        "success": True,
        "states": serialize_doc(states),
        "districts": serialize_doc(districts),
        "departments": serialize_doc(departments),
        "schemes": serialize_doc(schemes)
    }

@router.get("/schemes")
async def get_public_schemes():
    try:
        sc_list = list(db.schemes.find().sort("name", 1))

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
            return {"success": True, "schemes": sc_list}

        for s in sc_list:
            scheme_name = s.get("name", "")
            target_budget = float(s.get("target_budget") or s.get("allocated_budget") or 0.0)

            allocations = []
            if scheme_name:
                allocations = list(db.budget_allocations.find({
                    "$or": [
                        {"scheme_name": scheme_name},
                        {"scheme_name": {"$regex": f"^{re.escape(scheme_name.strip())}$", "$options": "i"}}
                    ]
                }))

            total_allocated = sum(float(a.get("amount", 0.0)) for a in allocations)
            total_disbursed = sum(float(a.get("disbursed_amount", 0.0)) for a in allocations)

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

        return {"success": True, "schemes": serialize_doc(sc_list)}
    except Exception as e:
        return {"success": False, "message": str(e), "schemes": []}

@router.get("/projects")
async def get_public_projects(
    state: Optional[str] = Query(None),
    district: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    scheme: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    query = {}
    if district and district.strip():
        d_name = district.strip()
        query["$or"] = [
            {"district_name": d_name},
            {"district_name": {"$regex": f"^{d_name}$", "$options": "i"}}
        ]
    elif state and state.strip():
        s_val = state.strip()
        st_upper = s_val.upper()
        st_districts = [d["name"] for d in db.districts.find({"$or": [{"state_code": st_upper}, {"state_name": s_val}]})]
        query["$or"] = [
            {"state_code": st_upper},
            {"state_name": s_val},
            {"district_name": {"$in": st_districts}}
        ]

    if department and department.strip():
        query["department"] = department.strip()
    if scheme and scheme.strip():
        query["scheme_name"] = scheme.strip()
    if search and search.strip():
        s_text = search.strip()
        query["$or"] = [
            {"name": {"$regex": s_text, "$options": "i"}},
            {"project_id": {"$regex": s_text, "$options": "i"}},
            {"description": {"$regex": s_text, "$options": "i"}}
        ]

    projects = list(db.projects.find(query).sort("created_at", -1))
    for p in projects:
        calc_prog = compute_project_progress(p)
        if p.get("progress_percentage") != calc_prog:
            p["progress_percentage"] = calc_prog
            db.projects.update_one({"project_id": p["project_id"]}, {"$set": {"progress_percentage": calc_prog}})

    return {"success": True, "projects": serialize_doc(projects)}

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

    # Compute and persist real-time progress
    calc_prog = compute_project_progress(proj, milestones)
    proj["progress_percentage"] = calc_prog
    if proj.get("progress_percentage") != calc_prog:
        db.projects.update_one({"project_id": project_id}, {"$set": {"progress_percentage": calc_prog}})

    return {
        "success": True,
        "project": serialize_doc(proj),
        "milestones": serialize_doc(milestones),
        "documents": serialize_doc(documents),
        "transactions": serialize_doc(transactions)
    }

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
