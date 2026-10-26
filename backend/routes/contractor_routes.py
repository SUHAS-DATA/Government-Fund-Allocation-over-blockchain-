import os
import re
import collections
import random
import string
import uuid
import hashlib
import mimetypes
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc, compute_project_progress, get_active_financial_year, reconcile_project_released_amount
from auth_middleware import require_roles
import blockchain_service as bcs
from realtime_manager import realtime_manager
import qr_service

router = APIRouter()
contractor_bp = router

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EVIDENCE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp",
    ".pdf", ".doc", ".docx",
    ".mp4", ".webm", ".avi", ".mov",
    ".txt", ".csv", ".xlsx", ".xls"
}
MAX_EVIDENCE_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

def sanitize_filename(filename: str) -> str:
    cleaned = "".join(c for c in filename if c.isalnum() or c in "._- ")
    return cleaned.replace(" ", "_")

def generate_doc_id(doc_type):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DOC-{doc_type}-{rand_suffix}"

def get_contractor_identifiers(current_user: dict):
    """
    Extract primary IDs for the logged-in contractor.
    Enriches with canonical contractor_id from db.users if missing in JWT.
    """
    user_id = str(current_user.get("user_id") or "").strip()
    email = str(current_user.get("email") or "").strip().lower()
    officer_id = str(current_user.get("officer_id") or current_user.get("contractor_id") or "").strip()

    if not officer_id and (user_id or email):
        user = None
        if user_id and ObjectId.is_valid(user_id):
            user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user and email:
            user = db.users.find_one({"email": email})
        if user:
            officer_id = str(user.get("contractor_id") or "")
            if not email and user.get("email"):
                email = user["email"].lower()
            if not user_id:
                user_id = str(user["_id"])

    return user_id, email, officer_id

def get_all_contractor_ids(current_user: dict) -> list:
    """
    Return all valid identifier aliases for the authenticated contractor.
    Covers MongoDB user ObjectId, canonical business code (e.g. CON-KA-APEX),
    verified email, and linked KYC document ObjectId.
    """
    ids = set()
    user_id, email, officer_id = get_contractor_identifiers(current_user)
    if user_id:
        ids.add(user_id)
    if email:
        ids.add(email)
    if officer_id:
        ids.add(officer_id)

    # Resolve from users collection
    user = None
    if user_id and ObjectId.is_valid(user_id):
        user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user and email:
        user = db.users.find_one({"email": email})
    if user:
        ids.add(str(user["_id"]))
        if user.get("email"):
            ids.add(user["email"].lower())
        if user.get("contractor_id"):
            ids.add(user["contractor_id"])

    # Resolve from contractor_kyc
    kyc_queries = []
    if user_id:
        kyc_queries.append({"user_id": user_id})
    if email:
        kyc_queries.append({"email": email})
    if user and user.get("contractor_id"):
        kyc_queries.append({"contractor_id": user["contractor_id"]})
    if officer_id:
        kyc_queries.append({"contractor_id": officer_id})

    if kyc_queries:
        kyc = db.contractor_kyc.find_one({"$or": kyc_queries})
        if kyc:
            ids.add(str(kyc["_id"]))
            if kyc.get("contractor_id"):
                ids.add(kyc["contractor_id"])
            if kyc.get("user_id"):
                ids.add(str(kyc["user_id"]))
            if kyc.get("email"):
                ids.add(kyc["email"].lower())

    return [i for i in ids if i]

def verify_contractor_project_ownership(proj, current_user: dict) -> bool:
    """Verify that the project is assigned to the authenticated contractor"""
    if not proj:
        return False
    valid_ids = get_all_contractor_ids(current_user)
    if not valid_ids:
        return False

    proj_cid = str(proj.get("contractor_id") or "").strip()
    proj_canon_cid = str(proj.get("canonical_contractor_id") or "").strip()
    proj_email = str(proj.get("contractor_email") or "").strip().lower()

    if proj_cid and proj_cid in valid_ids:
        return True
    if proj_canon_cid and proj_canon_cid in valid_ids:
        return True
    if proj_email and proj_email in valid_ids:
        return True
    return False

def build_contractor_project_query(current_user: dict) -> dict:
    valid_ids = get_all_contractor_ids(current_user)
    if not valid_ids:
        return {"_id": None}  # match nothing if unauthenticated/invalid contractor profile
    return {
        "$or": [
            {"contractor_id": {"$in": valid_ids}},
            {"canonical_contractor_id": {"$in": valid_ids}},
            {"contractor_email": {"$in": valid_ids}}
        ]
    }

@router.get("/dashboard")
async def dashboard(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    user_id, email, officer_id = get_contractor_identifiers(current_user)
    kyc = db.contractor_kyc.find_one({"$or": [{"user_id": user_id}, {"user_id": email}, {"email": email}]})
    kyc_status = (kyc.get("kyc_status") if kyc else None) or current_user.get("kyc_status") or "APPROVED"
    if kyc_status == "REJECTED":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "kyc_status": "REJECTED",
                "message": f"Contractor Registration Rejected by {(kyc or {}).get('state_name', 'State')} State Department. Portal access is denied.",
                "remarks": (kyc or {}).get("verification_remarks", "")
            }
        )
    
    target_fy = fy or get_active_financial_year()
    base_query = build_contractor_project_query(current_user)

    # 1. FY filtered projects for overview metrics
    if target_fy and target_fy.upper() != "ALL":
        fy_query = {"$and": [base_query, {"financial_year": target_fy}]}
    else:
        fy_query = base_query
    projects = list(db.projects.find(fy_query).sort("created_at", -1))

    # 2. All pending assignments requiring contractor action (NEVER hidden by FY filter!)
    pending_query = {
        "$and": [
            base_query,
            {
                "$or": [
                    {"status": {"$in": ["ASSIGNED", "PENDING_ACCEPTANCE"]}},
                    {"assignment_status": {"$ne": "ACCEPTED"}},
                    {"phases_configured": {"$ne": True}}
                ]
            },
            {"status": {"$nin": ["COMPLETED", "CLOSED", "REJECTED_BY_CONTRACTOR"]}}
        ]
    }
    pending_assignments = list(db.projects.find(pending_query).sort("created_at", -1))

    # Merge pending into display projects so contractor immediately sees all awards
    seen_ids = set()
    display_projects = []
    for p in pending_assignments + projects:
        pid = p.get("project_id")
        if pid and pid not in seen_ids:
            seen_ids.add(pid)
            display_projects.append(p)

    total_value = sum(p.get("total_budget", 0) for p in display_projects if p.get("status") not in ["REJECTED_BY_CONTRACTOR"])
    total_received = sum(p.get("released_amount", 0) for p in display_projects)

    proj_ids = [str(p.get("project_id")) for p in display_projects if p.get("project_id")]
    cwallet = (current_user.get("wallet_address") or "").strip()
    cname = (current_user.get("name") or "").strip()
    matchers = []
    if proj_ids:
        matchers.append({"project_id": {"$in": proj_ids}})
        matchers.append({"projectId": {"$in": proj_ids}})
        matchers.append({"entity_id": {"$in": proj_ids}})
    if cwallet:
        matchers.append({"to_address": cwallet})
        matchers.append({"receiverAddress": cwallet})
    if cname:
        matchers.append({"to_entity": cname})

    if matchers:
        pay_query = {
            "operation_type": {"$in": ["MILESTONE_PAYMENT_RELEASE", "DISTRICT_CONTRACTOR_TRANSFER", "PHASE_FUND_TRANSFER_TO_CONTRACTOR_BANK"]},
            "$or": matchers
        }
        recent_payments = list(db.blockchain_transactions.find(pay_query).sort("timestamp", -1).limit(5))
    else:
        recent_payments = []

    return {
        "success": True,
        "financial_year": target_fy,
        "contractor_profile": serialize_doc(kyc),
        "contractor_id": officer_id or user_id,
        "contractor_name": current_user.get("name"),
        "metrics": {
            "total_contract_value": total_value,
            "total_payments_received": total_received,
            "assigned_projects_count": len(display_projects),
            "pending_assignments_count": len(pending_assignments),
            "active_projects_count": len([p for p in display_projects if p.get("status") in ["IN_PROGRESS", "ACCEPTED", "ESCROW_FUNDED"]]),
            "completed_projects_count": len([p for p in display_projects if p.get("status") == "COMPLETED"]),
            "kyc_status": kyc.get("kyc_status") if kyc else "APPROVED"
        },
        "assigned_projects": serialize_doc(display_projects[:10]),
        "pending_assignments": serialize_doc(pending_assignments),
        "recent_payments": serialize_doc(recent_payments)
    }

# --- KYC & Off-Chain Document Submission ---
@router.get("/kyc-status")
async def kyc_status(
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    user_id, email, _ = get_contractor_identifiers(current_user)
    kyc = db.contractor_kyc.find_one({"$or": [{"user_id": user_id}, {"user_id": email}, {"email": email}]})
    docs = list(db.documents.find({"entity_id": user_id}))
    
    kyc_data = serialize_doc(kyc) if kyc else {}
    if kyc_data:
        kyc_data["kyc_documents"] = serialize_doc(docs)

    return {
        "success": True,
        "contractor": kyc_data,
        "documents": serialize_doc(docs)
    }

@router.post("/kyc-submit")
async def kyc_submit(
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    user_id, email, _ = get_contractor_identifiers(current_user)
    form = await request.form()

    company_name = form.get("company_name", current_user.get("name", ""))
    gst_number = str(form.get("gst_number", "")).strip().upper()
    pan_number = str(form.get("pan_number", "")).strip().upper()
    license_number = str(form.get("license_number", "")).strip()
    experience_years = int(form.get("experience_years", 5))

    existing_kyc = None
    if user_id or email:
        existing_kyc = db.contractor_kyc.find_one({"$or": [q for q in [{"user_id": user_id}, {"email": email}] if q.get("user_id") or q.get("email")]})

    if existing_kyc:
        if not gst_number:
            gst_number = existing_kyc.get("gst_number", "")
        if not pan_number:
            pan_number = existing_kyc.get("pan_number", "")
        if not license_number:
            license_number = existing_kyc.get("license_number", "")
        if not company_name:
            company_name = existing_kyc.get("company_name", current_user.get("name", ""))

    if not gst_number or not pan_number:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "GSTIN and PAN numbers are required"}
        )

    doc_keys = [("gst_document", "GST"), ("pan_document", "PAN"), ("license_document", "PWD_LICENSE")]
    
    # Also support general statutory document upload from ContractorKYC.jsx
    statutory_file = form.get("file") or form.get("document")
    if statutory_file and hasattr(statutory_file, "filename") and statutory_file.filename:
        st_type = str(form.get("doc_type") or "STATUTORY_CREDENTIAL").strip().upper()
        doc_keys.append(("file" if form.get("file") else "document", st_type))

    anchored_docs = []
    file_path_map = {}

    for form_key, doc_type in doc_keys:
        file = form.get(form_key)
        if file and hasattr(file, "filename") and file.filename:
            fname = sanitize_filename(f"{user_id}_{doc_type}_{file.filename}")
            save_path = os.path.join(UPLOAD_FOLDER, fname)
            content = await file.read()
            with open(save_path, "wb") as f:
                f.write(content)

            sha256_digest = bcs.calculate_sha256(save_path)
            doc_id = generate_doc_id(doc_type)

            if form_key in ["gst_document", "pan_document", "license_document"]:
                file_path_map[form_key] = save_path
            elif form_key in ["file", "document"]:
                raw_type = str(form.get("doc_type") or "").strip().lower()
                if raw_type in ["gst_document", "pan_document", "license_document", "tax_returns", "bank_statement"]:
                    file_path_map[raw_type] = save_path
                else:
                    file_path_map["statutory_document"] = save_path

            tx_hash = None

            doc_record = {
                "document_id": doc_id,
                "file_name": fname,
                "file_path": save_path,
                "file_size": len(content),
                "sha256_hash": sha256_digest,
                "doc_type": doc_type,
                "entity_id": user_id,
                "blockchain_tx_hash": tx_hash,
                "uploaded_at": datetime.now(timezone.utc)
            }
            db.documents.insert_one(doc_record)
            anchored_docs.append(serialize_doc(doc_record))

    kyc_update = {
        "user_id": user_id,
        "email": email,
        "company_name": company_name,
        "gst_number": gst_number,
        "pan_number": pan_number,
        "license_number": license_number or "PWD-REG-VERIFIED",
        "experience_years": experience_years,
        "kyc_status": "APPROVED",
        "updated_at": datetime.now(timezone.utc),
        **file_path_map
    }
    db.contractor_kyc.update_one({"$or": [{"user_id": user_id}, {"email": email}]}, {"$set": kyc_update}, upsert=True)

    return {
        "success": True,
        "message": "KYC credentials and SHA-256 cryptographic hashes verified and recorded successfully.",
        "documents": anchored_docs
    }

# --- Project Directory & Accept / Reject Workflow ---
@router.get("/projects")
async def get_my_projects(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    base_query = build_contractor_project_query(current_user)
    if fy and fy.upper() != "ALL":
        query = {
            "$and": [
                base_query,
                {
                    "$or": [
                        {"financial_year": fy},
                        {"status": {"$in": ["ASSIGNED", "PENDING_ACCEPTANCE"]}},
                        {"assignment_status": {"$in": ["ASSIGNED", "PENDING_ACCEPTANCE"]}}
                    ]
                }
            ]
        }
    else:
        query = base_query

    projects = list(db.projects.find(query).sort("created_at", -1))
    
    p_ids = [p["project_id"] for p in projects if p.get("project_id")]
    phases_by_proj = collections.defaultdict(list)
    if p_ids:
        all_phases = list(db.milestones.find({"project_id": {"$in": p_ids}}).sort("milestone_index", 1))
        for ph in all_phases:
            phases_by_proj[ph["project_id"]].append(ph)

    for p in projects:
        p_id = p.get("project_id")
        p["phases"] = serialize_doc(phases_by_proj.get(p_id, []))

    return {"success": True, "financial_year": fy or get_active_financial_year(), "projects": serialize_doc(projects)}

@router.get("/projects/{project_id}")
async def get_contractor_project_details(
    project_id: str,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": "Unauthorized / Access Denied: You are not authorized to view projects assigned to other contractors."
            }
        )

    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
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
        "phases": serialize_doc(milestones),
        "documents": serialize_doc(documents),
        "evidence": serialize_doc(evidence)
    }

@router.post("/projects/{project_id}/accept")
async def accept_project(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Unauthorized: This project is not assigned to your enterprise."}
        )

    # 1. Idempotency Check: Return existing accepted contract and QR code
    if proj.get("assignment_status") == "ACCEPTED" or proj.get("contract_status") == "ACCEPTED":
        existing_qr = db.qr_codes.find_one({"project_id": project_id})
        if not existing_qr:
            try:
                existing_qr = qr_service.generate_project_qr(
                    proj,
                    contractor_user=current_user,
                    frontend_base_url=request.headers.get("origin")
                )
            except Exception as e:
                print(f"Warning recovering existing QR: {e}")

        milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
        return {
            "success": True,
            "message": f"Project {project_id} has already been officially accepted.",
            "contract_id": proj.get("contract_id"),
            "contract_status": "ACCEPTED",
            "qr_code": serialize_doc(existing_qr),
            "project": serialize_doc(proj),
            "phases": serialize_doc(milestones)
        }

    total_budget = float(proj.get("total_budget", 150000000.0))

    # Calculate 3 Standardized Phases (30%, 40%, 30%)
    p1_amount = round(total_budget * 0.30, 2)
    p2_amount = round(total_budget * 0.40, 2)
    p3_amount = round(total_budget - (p1_amount + p2_amount), 2)

    three_phases = [
        {
            "project_id": project_id,
            "milestone_index": 0,
            "phase_number": 1,
            "title": "Phase 1: Foundation, Site Survey & Earthwork (30%)",
            "percentage_share": 30,
            "amount": p1_amount,
            "status": "UNLOCKED",
            "phase_status": "READY_FOR_FUND_REQUEST",
            "progress_percentage": 0,
            "description": "Initial land clearing, subgrade compaction, foundation leveling, and primary drainage culvert installation.",
            "proof_document_hash": None,
            "blockchain_tx_hash": None,
            "rejection_reason": None,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "project_id": project_id,
            "milestone_index": 1,
            "phase_number": 2,
            "title": "Phase 2: Core Civil Construction & Paving (40%)",
            "percentage_share": 40,
            "amount": p2_amount,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "progress_percentage": 0,
            "description": "Heavy reinforced cement concrete (RCC) sub-base laying, asphalt bitumen surfacing, and primary structural construction.",
            "proof_document_hash": None,
            "blockchain_tx_hash": None,
            "rejection_reason": None,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "project_id": project_id,
            "milestone_index": 2,
            "phase_number": 3,
            "title": "Phase 3: Final Quality Audit, Markings & Handover (30%)",
            "percentage_share": 30,
            "amount": p3_amount,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "progress_percentage": 0,
            "description": "Road safety markings, solar streetlights, guardrails installation, quality test certifications, and public handover.",
            "proof_document_hash": None,
            "blockchain_tx_hash": None,
            "rejection_reason": None,
            "created_at": datetime.now(timezone.utc)
        }
    ]

    db.milestones.delete_many({"project_id": project_id})
    for phase in three_phases:
        db.milestones.insert_one(phase)


    contract_id = proj.get("contract_id") or qr_service.generate_contract_id(project_id)

    # 2. Automatically generate unique QR code immediately upon contractor acceptance
    try:
        qr_doc = qr_service.generate_project_qr(
            {**proj, "contract_id": contract_id},
            contractor_user=current_user,
            frontend_base_url=request.headers.get("origin")
        )
    except Exception as e:
        print(f"Error during QR code generation: {e}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": f"Project accepted, but QR code generation failed: {str(e)}. Safe retry is enabled."
            }
        )

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "assignment_status": "ACCEPTED",
            "contract_status": "ACCEPTED",
            "contract_id": contract_id,
            "phases_configured": True,
            "current_active_phase": 1,
            "accepted_at": datetime.now(timezone.utc),
            "accepted_by": current_user["name"],
            "qr_id": qr_doc.get("qr_id"),
            "qr_code": {
                "qr_id": qr_doc.get("qr_id"),
                "contract_id": contract_id,
                "verification_url": qr_doc.get("verification_url"),
                "status": "ACTIVE",
                "created_at": qr_doc.get("created_at"),
                "qr_image_data": qr_doc.get("qr_image_data")
            }
        }}
    )

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Accepted & QR Generated",
        "message": f"Contractor '{current_user['name']}' accepted project {project_id} (Contract {contract_id}). QR code generated and active.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    # Trigger real-time synchronization across Contractor & District dashboards
    realtime_manager.trigger_broadcast("PROJECT_ACCEPTED", {
        "project_id": project_id,
        "contract_id": contract_id,
        "qr_id": qr_doc.get("qr_id"),
        "contractor_name": current_user["name"],
        "status": "ACCEPTED"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "path": f"/contractor/projects/{project_id}/accept",
        "method": "POST"
    })

    updated_proj = db.projects.find_one({"project_id": project_id})

    return {
        "success": True,
        "message": f"Project {project_id} accepted! Contract {contract_id} active. QR code generated automatically.",
        "contract_id": contract_id,
        "contract_status": "ACCEPTED",
        "qr_code": serialize_doc(qr_doc),
        "project": serialize_doc(updated_proj),
        "phases": serialize_doc(three_phases)
    }

@router.post("/projects/{project_id}/reject")
async def reject_project(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Unauthorized: This project is not assigned to your enterprise."}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    reason = data.get("rejection_reason") or data.get("reason", "Contractor at full operational capacity; unable to accept assignment.")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "REJECTED_BY_CONTRACTOR",
            "assignment_status": "REJECTED",
            "contract_status": "REJECTED",
            "rejection_reason": reason,
            "rejected_at": datetime.now(timezone.utc),
            "rejected_by": current_user["name"]
        }}
    )

    # Invalidate QR code if project is rejected/declined
    qr_service.invalidate_project_qr(project_id, reason=reason)

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Declined by Contractor",
        "message": f"Contractor '{current_user['name']}' rejected project {project_id}. Reason: {reason}",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    realtime_manager.trigger_broadcast("PROJECT_REJECTED", {
        "project_id": project_id,
        "reason": reason
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "path": f"/contractor/projects/{project_id}/reject",
        "method": "POST"
    })

    return {
        "success": True,
        "message": f"Project assignment for {project_id} has been declined."
    }

# --- Step 1: Request Allocated Phase Funds ---
@router.post("/projects/{project_id}/phases/{milestone_index}/request-funds")
async def request_phase_funds(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Unauthorized access to project."}
        )

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Phase #{milestone_index + 1} not found"}
        )

    if milestone_index > 0:
        prev_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index - 1})
        valid_completed_statuses = ["COMPLETED", "RELEASED", "VERIFIED", "PAID"]
        is_prev_completed = prev_phase and (
            prev_phase.get("status") in valid_completed_statuses or
            prev_phase.get("phase_status") in valid_completed_statuses or
            prev_phase.get("evidence_status") == "VERIFIED"
        )
        if not is_prev_completed:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "message": f"Sequential progression required: Phase #{milestone_index} must be completed and verified by District Officer before requesting funds for Phase #{milestone_index + 1}."
                }
            )

    try:
        data = await request.json()
    except Exception:
        data = {}

    requested_amount = float(data.get("requested_amount", phase.get("amount", 0)))
    notes = data.get("notes") or data.get("request_notes") or f"Fund request for Phase #{milestone_index + 1} execution mobilization."

    if requested_amount > phase.get("amount", 0):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Excess fund request blocked: Requested amount (INR {requested_amount:,.2f}) exceeds Phase #{milestone_index + 1} allocated limit of INR {phase.get('amount'):,.2f}."
            }
        )

    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "FUND_REQUESTED",
            "phase_status": "FUND_REQUESTED",
            "fund_requested_amount": requested_amount,
            "fund_request_notes": notes,
            "fund_requested_at": datetime.now(timezone.utc)
        }}
    )

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": f"Phase #{milestone_index + 1} Fund Request",
        "message": f"Contractor requested INR {requested_amount:,.2f} mobilization funds for {project_id} (Phase #{milestone_index + 1}).",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    realtime_manager.trigger_broadcast("FUND_REQUESTED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "requested_amount": requested_amount,
        "district_name": proj.get("district_name")
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "milestones",
        "action": "FUND_REQUESTED",
        "project_id": project_id,
        "milestone_index": milestone_index
    })

    return {
        "success": True,
        "message": f"Fund request for Phase #{milestone_index + 1} (INR {requested_amount:,.2f}) submitted to District Officer for approval."
    }

# --- Steps 13, 23, 33: Receive Allocated Funds & Acknowledge ---
@router.post("/projects/{project_id}/phases/{milestone_index}/receive-funds")
async def receive_allocated_funds(
    project_id: str,
    milestone_index: int,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Unauthorized access."}
        )

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Phase #{milestone_index + 1} not found"}
        )

    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "APPROVED_FOR_WORK",
            "phase_status": "EXECUTING_WORK",
            "funds_acknowledged_at": datetime.now(timezone.utc),
            "funds_acknowledged_by": current_user["name"]
        }}
    )

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "current_active_phase": milestone_index + 1
        }}
    )

    realtime_manager.trigger_broadcast("FUNDS_RECEIVED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "status": "APPROVED_FOR_WORK"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "milestones",
        "action": "FUNDS_RECEIVED",
        "project_id": project_id,
        "milestone_index": milestone_index
    })

    return {
        "success": True,
        "message": f"Phase #{milestone_index + 1} allocated funds acknowledged in Contractor Bank Account. Phase execution initiated."
    }

# --- Steps 15, 25, 35: Submit Completion Proof (Material Bills, Progress Photos, Videos, Documents) ---
async def handle_milestone_progress_submission(project_id: str, milestone_index: Optional[int], request: Request, current_user: dict):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Unauthorized access."}
        )

    if proj.get("is_frozen"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Project is FROZEN by audit hold. Work halted."}
        )

    form = {}
    content_type = request.headers.get("content-type", "")
    if "multipart/form-data" in content_type:
        try:
            form = await request.form()
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": f"Malformed multipart form data: {str(e)}"}
            )
    elif "application/json" in content_type:
        try:
            form = await request.json()
        except Exception as e:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"success": False, "message": f"Malformed JSON request: {str(e)}"}
            )
    else:
        try:
            form = await request.form()
        except Exception:
            try:
                form = await request.json()
            except Exception:
                form = {}

    if milestone_index is None:
        milestone_index = int(form.get("milestone_index", 0))

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Phase #{milestone_index + 1} not found"}
        )

    if phase.get("status") in ["COMPLETED", "RELEASED"] or phase.get("phase_status") in ["COMPLETED", "RELEASED"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Phase #{milestone_index + 1} has already been verified and completed."}
        )

    if milestone_index > 0:
        prev_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index - 1})
        valid_completed_statuses = ["COMPLETED", "RELEASED", "VERIFIED", "PAID"]
        is_prev_completed = prev_phase and (
            prev_phase.get("status") in valid_completed_statuses or
            prev_phase.get("phase_status") in valid_completed_statuses or
            prev_phase.get("evidence_status") == "VERIFIED"
        )
        if not is_prev_completed:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={
                    "success": False,
                    "message": f"Phase #{milestone_index} must be verified and completed before submitting Phase #{milestone_index + 1}."
                }
            )

    progress_percentage = int(form.get("percentage") or form.get("progress_percentage", 100))
    description = form.get("notes") or form.get("description", "Construction deliverables executed as per technical specifications.")
    
    # 4 Flowchart Proof Deliverables
    material_bills_notes = form.get("material_bills_notes", "")
    video_url = form.get("video_url", "")

    proof_files_saved = []
    proof_hashes = []
    primary_hash = "60a22a54ec9c1c2d992147779f7a552bf3f9611db93952f4a4df0f77df27e02a"

    file_categories = [
        ("material_bills_file", "MATERIAL_BILLS"),
        ("progress_photo_file", "PROGRESS_PHOTO"),
        ("photo", "PROGRESS_PHOTO"),
        ("file", "PROGRESS_PHOTO"),
        ("progress_video_file", "PROGRESS_VIDEO"),
        ("other_doc_file", "QUALITY_TEST_CERTIFICATE")
    ]

    contractor_id_canonical = (
        proj.get("canonical_contractor_id") or 
        proj.get("contractor_id") or 
        str(current_user.get("contractor_id") or current_user.get("user_id", ""))
    )

    for form_key, doc_type in file_categories:
        file_obj = form.get(form_key)
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            orig_filename = file_obj.filename
            _, ext = os.path.splitext(orig_filename.lower())
            if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"success": False, "message": f"Unsupported file type '{ext}' for {form_key}. Allowed formats: JPG, PNG, WEBP, PDF, DOC, DOCX, MP4, WEBM, AVI, MOV."}
                )
            content = await file_obj.read()
            if len(content) > MAX_EVIDENCE_FILE_SIZE:
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"success": False, "message": f"File '{orig_filename}' exceeds 25 MB limit ({len(content) / (1024 * 1024):.1f} MB)."}
                )

            fname = sanitize_filename(f"{project_id}_PHASE{milestone_index + 1}_{doc_type}_{orig_filename}")
            save_path = os.path.join(UPLOAD_FOLDER, fname)
            with open(save_path, "wb") as f:
                f.write(content)
            
            sha256_digest = bcs.calculate_sha256(save_path)
            doc_id = generate_doc_id(f"P{milestone_index + 1}_{doc_type[:4]}")
            proof_hashes.append(sha256_digest)
            primary_hash = sha256_digest


            doc_rec = {
                "document_id": doc_id,
                "file_name": fname,
                "file_path": save_path,
                "file_size": len(content),
                "sha256_hash": sha256_digest,
                "doc_type": doc_type,
                "entity_id": project_id,
                "milestone_index": milestone_index,
                "contractor_id": contractor_id_canonical,
                "uploaded_at": datetime.now(timezone.utc)
            }
            db.documents.insert_one(doc_rec)
            proof_files_saved.append(serialize_doc(doc_rec))

            # Store matching minimal Evidence entity for District verification
            guessed_mime, _ = mimetypes.guess_type(fname)
            evidence_rec = {
                "evidence_id": doc_id,
                "evidenceId": doc_id,
                "project_id": project_id,
                "projectId": project_id,
                "contract_id": proj.get("contract_id") or f"CTR-{project_id}",
                "contractId": proj.get("contract_id") or f"CTR-{project_id}",
                "milestone_id": f"MS-{project_id}-{milestone_index + 1}",
                "milestoneId": f"MS-{project_id}-{milestone_index + 1}",
                "milestone_index": milestone_index,
                "contractor_id": contractor_id_canonical,
                "contractorId": contractor_id_canonical,
                "contractor_name": proj.get("contractor_name") or current_user.get("name"),
                "submitted_by_user_id": str(current_user.get("user_id", "")),
                "project_name": proj.get("name"),
                "district_name": proj.get("district_name"),
                "file_name": getattr(file_obj, "filename", fname) or fname,
                "fileName": getattr(file_obj, "filename", fname) or fname,
                "file_type": getattr(file_obj, "content_type", None) or guessed_mime or "application/octet-stream",
                "fileType": getattr(file_obj, "content_type", None) or guessed_mime or "application/octet-stream",
                "file_path": save_path,
                "file_url": f"/api/evidence/{doc_id}/file",
                "fileUrl": f"/api/evidence/{doc_id}/file",
                "file_size": len(content),
                "sha256_hash": sha256_digest,
                "description": f"{doc_type.replace('_', ' ').title()}: {description or material_bills_notes or 'Milestone completion deliverable'}",
                "status": "SUBMITTED",
                "rejection_reason": None,
                "rejectionReason": None,
                "uploaded_at": datetime.now(timezone.utc),
                "uploadedAt": datetime.now(timezone.utc),
                "verified_at": None,
                "verifiedAt": None,
                "verified_by": None,
                "verifiedBy": None
            }
            db.evidence.insert_one(evidence_rec)

    tx_hash = None
    block_num = None

    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "SUBMITTED",
            "phase_status": "SUBMITTED_FOR_VERIFICATION",
            "progress_percentage": progress_percentage,
            "proof_document_hash": primary_hash,
            "all_proof_hashes": proof_hashes,
            "material_bills_notes": material_bills_notes,
            "video_url": video_url,
            "progress_notes": description,
            "blockchain_progress_tx": tx_hash,
            "submitted_at": datetime.now(timezone.utc),
            "rejection_reason": None
        }}
    )

    # Recalculate parent project progress and mark project has_pending_proof
    calc_prog = compute_project_progress(proj)
    now_utc_ts = datetime.now(timezone.utc)
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "progress_percentage": calc_prog,
            "has_pending_proof": True,
            "pending_verification_phase": milestone_index,
            "last_submitted_at": now_utc_ts
        }}
    )

    if tx_hash:
        contractor_wallet = bcs.get_entity_wallet("CONTRACTOR", proj.get("contractor_name"))
        contractor_name = proj.get("contractor_name") or "Contractor & Vendor"
        to_escrow = bcs.get_entity_wallet("ESCROW")
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "MILESTONE_PROGRESS_SUBMISSION",
            "entity_id": project_id,
            "from_address": contractor_wallet,
            "to_address": to_escrow,
            "from_entity": f"{contractor_name} (Contractor)",
            "to_entity": "Project Smart Contract Escrow",
            "transfer_tier": "CONTRACTOR_TO_ESCROW",
            "flow_stage": f"Proof Submission: Phase #{milestone_index + 1}",
            "amount": 0,
            "details": f"Material Bills, Photos, Videos & SHA-256 Proof Anchor ({primary_hash[:12]}...) for Phase #{milestone_index + 1} ({proj.get('name')})",
            "timestamp": now_utc_ts
        })

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": f"Phase #{milestone_index + 1} Completion Proof Submitted",
        "message": f"Contractor submitted Phase #{milestone_index + 1} proof deliverables (Material Bills, Photos, Videos, Test Docs) with cryptographic SHA-256 for {project_id}. Verification required.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": now_utc_ts
    })

    realtime_manager.trigger_broadcast("WORK_EVIDENCE_SUBMITTED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "primary_hash": primary_hash,
        "district_name": proj.get("district_name")
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "milestones",
        "action": "WORK_EVIDENCE_SUBMITTED",
        "project_id": project_id,
        "milestone_index": milestone_index
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "action": "WORK_EVIDENCE_SUBMITTED",
        "project_id": project_id,
        "milestone_index": milestone_index
    })

    return {
        "success": True,
        "message": f"Phase #{milestone_index + 1} completion proof submitted with cryptographic SHA-256 digests. Forwarded to District Officer for verification.",
        "proof_document_hash": primary_hash,
        "uploaded_proof_files": proof_files_saved,
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.post("/projects/{project_id}/phases/{milestone_index}/submit-milestone")
async def submit_milestone_progress(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    return await handle_milestone_progress_submission(project_id, milestone_index, request, current_user)

@router.post("/projects/{project_id}/progress")
async def submit_milestone_progress_fallback(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    return await handle_milestone_progress_submission(project_id, None, request, current_user)

@router.post("/projects/{project_id}/milestone-request")
async def legacy_milestone_request(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}
    milestone_index = int(data.get("milestone_index", 0))
    return await request_phase_funds(project_id, milestone_index, request, current_user)

@router.post("/projects/{project_id}/request-payment")
async def legacy_request_payment(
    project_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}
    milestone_index = int(data.get("milestone_index", 0))
    return await request_phase_funds(project_id, milestone_index, request, current_user)

@router.get("/payments")
async def get_payments(
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    cid = str(current_user.get("contractor_id") or current_user.get("user_id") or "").strip()
    cname = (current_user.get("name") or "").strip()
    cemail = (current_user.get("email") or "").strip().lower()
    cwallet = (current_user.get("wallet_address") or "").strip().lower()

    # Find project IDs assigned to this contractor
    proj_query = build_contractor_project_query(current_user)
    owned_projects = list(db.projects.find(proj_query, {"project_id": 1}))
    owned_project_ids = [p["project_id"] for p in owned_projects if p.get("project_id")]

    # Match financial transactions strictly belonging to this contractor or their assigned projects
    contractor_matchers = []
    if cid:
        contractor_matchers.extend([
            {"destination_entity_id": cid},
            {"destination_account_id": {"$regex": re.escape(cid), "$options": "i"}},
            {"contractor_id": cid}
        ])
    if cname:
        contractor_matchers.append({"destination_entity_name": {"$regex": f"^{re.escape(cname)}$", "$options": "i"}})
    if owned_project_ids:
        contractor_matchers.append({"related_project_id": {"$in": owned_project_ids}})

    if not contractor_matchers:
        return {"success": True, "payments": []}

    tx_query = {
        "transaction_type": {"$in": ["DISTRICT_TO_CONTRACTOR", "ESCROW_TO_CONTRACTOR", "CONTRACTOR_PAYMENT"]},
        "$or": contractor_matchers
    }
    txs = list(db.financial_transactions.find(tx_query).sort("created_at", -1))

    if not txs:
        bc_matchers = []
        if cwallet:
            bc_matchers.extend([
                {"to_address": {"$regex": f"^{re.escape(cwallet)}$", "$options": "i"}},
                {"receiverAddress": {"$regex": f"^{re.escape(cwallet)}$", "$options": "i"}}
            ])
        if owned_project_ids:
            bc_matchers.append({"project_id": {"$in": owned_project_ids}})
            bc_matchers.append({"entity_id": {"$in": owned_project_ids}})

        if bc_matchers:
            txs = list(db.blockchain_transactions.find({
                "operation_type": {"$in": ["MILESTONE_PAYMENT_RELEASE", "DISTRICT_CONTRACTOR_TRANSFER", "PHASE_FUND_TRANSFER_TO_CONTRACTOR_BANK"]},
                "$or": bc_matchers
            }).sort("timestamp", -1))

    return {"success": True, "payments": serialize_doc(txs)}

# --- Project Work Evidence Upload (Contractor -> District Verification) ---
@router.post("/projects/{project_id}/milestones/{milestone_index}/evidence")
@router.post("/projects/{project_id}/phases/{milestone_index}/evidence")
async def upload_work_evidence(
    project_id: str,
    milestone_index: int,
    request: Request,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    """
    Contractor uploads milestone work evidence (photographs, progress images, PDFs, completion docs).
    Validates file format, size, contractor assignment, and records evidence with status SUBMITTED.
    """
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Project not found"}
        )

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: You cannot upload evidence for a project not assigned to you."}
        )

    if proj.get("is_frozen"):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Project is FROZEN by audit hold. Evidence upload halted."}
        )

    milestone = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not milestone:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Milestone #{milestone_index + 1} not found"}
        )

    if milestone.get("status") in ["COMPLETED", "RELEASED"] or milestone.get("phase_status") in ["COMPLETED", "RELEASED"]:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Phase #{milestone_index + 1} has already been verified and completed."}
        )

    try:
        form = await request.form()
    except Exception as e:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Invalid form data payload: {str(e)}"}
        )

    file_obj = form.get("file") or form.get("evidence_file") or form.get("photo") or form.get("document")
    if not file_obj or not hasattr(file_obj, "filename") or not file_obj.filename:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "No file uploaded. Please select an image (JPG, PNG, WEBP) or document (PDF, DOC)."}
        )

    description = str(form.get("description") or form.get("notes") or "").strip()
    if not description:
        description = f"Work completion evidence for Phase #{milestone_index + 1}: {milestone.get('title', '')}"

    orig_filename = file_obj.filename
    _, ext = os.path.splitext(orig_filename.lower())
    if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Unsupported file type '{ext}'. Allowed formats: JPG, PNG, WEBP, PDF, DOC, DOCX."}
        )

    content = await file_obj.read()
    if len(content) == 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Uploaded file is empty (0 bytes)."}
        )

    if len(content) > MAX_EVIDENCE_FILE_SIZE:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"File size exceeds 25 MB ceiling ({len(content) / (1024 * 1024):.1f} MB)."}
        )

    content_type = getattr(file_obj, "content_type", None)
    if not content_type or content_type == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(orig_filename)
        content_type = guessed or "application/octet-stream"

    ev_folder = os.path.join(UPLOAD_FOLDER, "evidence")
    os.makedirs(ev_folder, exist_ok=True)
    rand_id = uuid.uuid4().hex[:8].upper()
    evidence_id = f"EVD-{project_id}-P{milestone_index + 1}-{rand_id}"
    safe_fname = sanitize_filename(f"{evidence_id}_{orig_filename}")
    save_path = os.path.join(ev_folder, safe_fname)

    with open(save_path, "wb") as f:
        f.write(content)

    sha256_digest = hashlib.sha256(content).hexdigest()



    contract_id = proj.get("contract_id") or f"CTR-{project_id}"
    milestone_id = f"MS-{project_id}-{milestone_index + 1}"
    contractor_id_canonical = (
        proj.get("canonical_contractor_id") or 
        proj.get("contractor_id") or 
        str(current_user.get("contractor_id") or current_user.get("user_id", ""))
    )
    now_utc = datetime.now(timezone.utc)

    evidence_doc = {
        "evidence_id": evidence_id,
        "evidenceId": evidence_id,
        "project_id": project_id,
        "projectId": project_id,
        "contract_id": contract_id,
        "contractId": contract_id,
        "milestone_id": milestone_id,
        "milestoneId": milestone_id,
        "milestone_index": milestone_index,
        "contractor_id": contractor_id_canonical,
        "contractorId": contractor_id_canonical,
        "contractor_name": proj.get("contractor_name") or current_user.get("name"),
        "submitted_by_user_id": str(current_user.get("user_id", "")),
        "project_name": proj.get("name"),
        "district_name": proj.get("district_name"),
        "file_name": orig_filename,
        "fileName": orig_filename,
        "file_type": content_type,
        "fileType": content_type,
        "file_path": save_path,
        "file_url": f"/api/evidence/{evidence_id}/file",
        "fileUrl": f"/api/evidence/{evidence_id}/file",
        "file_size": len(content),
        "sha256_hash": sha256_digest,
        "description": description,
        "status": "SUBMITTED",
        "rejection_reason": None,
        "rejectionReason": None,
        "uploaded_at": now_utc,
        "uploadedAt": now_utc,
        "verified_at": None,
        "verifiedAt": None,
        "verified_by": None,
        "verifiedBy": None
    }
    db.evidence.insert_one(evidence_doc)

    db.documents.insert_one({
        "document_id": evidence_id,
        "file_name": safe_fname,
        "file_path": save_path,
        "file_size": len(content),
        "sha256_hash": sha256_digest,
        "doc_type": "WORK_EVIDENCE",
        "entity_id": project_id,
        "milestone_index": milestone_index,
        "contractor_id": contractor_id_canonical,
        "uploaded_at": now_utc
    })

    # Update milestone status to SUBMITTED
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "SUBMITTED",
            "phase_status": "SUBMITTED_FOR_VERIFICATION",
            "evidence_status": "SUBMITTED",
            "proof_document_hash": sha256_digest,
            "submitted_at": now_utc,
            "rejection_reason": None
        }}
    )

    # Recalculate physical progress and set has_pending_proof on parent project
    calc_prog = compute_project_progress(proj)
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "progress_percentage": calc_prog,
            "has_pending_proof": True,
            "pending_verification_phase": milestone_index,
            "last_submitted_at": now_utc
        }}
    )

    # Notify District Officer
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "New Work Evidence Submitted",
        "message": f"New work evidence submitted for Project {proj.get('name', project_id)} (Phase #{milestone_index + 1}). Verification required.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": now_utc
    })

    # Real-time WebSocket event broadcasts (Zero manual refresh)
    realtime_manager.trigger_broadcast("EVIDENCE_SUBMITTED", {
        "project_id": project_id,
        "milestone_index": milestone_index,
        "evidence_id": evidence_id,
        "project_name": proj.get("name", project_id),
        "message": f"New work evidence submitted for Project {proj.get('name', project_id)}."
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "evidence",
        "project_id": project_id,
        "milestone_index": milestone_index,
        "action": "EVIDENCE_SUBMITTED"
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "projects",
        "project_id": project_id,
        "milestone_index": milestone_index,
        "action": "EVIDENCE_SUBMITTED"
    })

    return {
        "success": True,
        "message": "Work evidence submitted successfully! Evidence Status: Pending Verification.",
        "evidence_status": "Pending Verification",
        "evidence": serialize_doc(evidence_doc)
    }

@router.get("/projects/{project_id}/milestones/{milestone_index}/evidence")
@router.get("/projects/{project_id}/phases/{milestone_index}/evidence")
async def list_contractor_milestone_evidence(
    project_id: str,
    milestone_index: int,
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    """Retrieve all submitted evidence items for a milestone by the assigned contractor"""
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return JSONResponse(status_code=404, content={"success": False, "message": "Project not found"})

    if not verify_contractor_project_ownership(proj, current_user):
        return JSONResponse(status_code=403, content={"success": False, "message": "Access Denied."})

    evidence_list = list(db.evidence.find({
        "$and": [
            {"$or": [{"project_id": project_id}, {"projectId": project_id}]},
            {"$or": [{"milestone_index": milestone_index}, {"milestoneId": f"MS-{project_id}-{milestone_index + 1}"}]}
        ]
    }).sort("uploaded_at", -1))

    return {
        "success": True,
        "project_id": project_id,
        "milestone_index": milestone_index,
        "evidence_count": len(evidence_list),
        "evidence": serialize_doc(evidence_list)
    }
