import random
import string
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, status, Query
from fastapi.responses import JSONResponse
from database import db, serialize_doc

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
    fys = list(db.financial_years.find().sort("year", -1))
    return {"success": True, "financial_years": serialize_doc(fys)}

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
