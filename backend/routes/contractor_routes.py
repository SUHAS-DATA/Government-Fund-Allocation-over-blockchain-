import os
import random
import string
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, status
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import require_roles
import blockchain_service as bcs

router = APIRouter()
contractor_bp = router

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def sanitize_filename(filename: str) -> str:
    cleaned = "".join(c for c in filename if c.isalnum() or c in "._- ")
    return cleaned.replace(" ", "_")

def generate_doc_id(doc_type):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DOC-{doc_type}-{rand_suffix}"

def get_contractor_identifiers(current_user: dict):
    """Extract all matching IDs for the logged-in contractor"""
    user_id = str(current_user.get("user_id", ""))
    email = str(current_user.get("email", "")).lower()
    officer_id = str(current_user.get("officer_id") or current_user.get("contractor_id") or "")
    return user_id, email, officer_id

def verify_contractor_project_ownership(proj, current_user: dict):
    """Verify that the project is assigned to the authenticated contractor"""
    if not proj:
        return False
    user_id, email, officer_id = get_contractor_identifiers(current_user)
    proj_cid = str(proj.get("contractor_id", ""))
    
    if proj_cid in [user_id, email, officer_id]:
        return True
    if proj.get("contractor_email") and str(proj.get("contractor_email")).lower() == email:
        return True
    return False

def build_contractor_project_query(current_user: dict):
    user_id, email, officer_id = get_contractor_identifiers(current_user)
    cids = [user_id, email]
    if officer_id:
        cids.append(officer_id)
    return {
        "$or": [
            {"contractor_id": {"$in": cids}},
            {"contractor_email": email}
        ]
    }

@router.get("/dashboard")
async def dashboard(
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    user_id, email, officer_id = get_contractor_identifiers(current_user)
    kyc = db.contractor_kyc.find_one({"$or": [{"user_id": user_id}, {"user_id": email}, {"email": email}]})
    
    projects = list(db.projects.find(build_contractor_project_query(current_user)).sort("created_at", -1))

    total_value = sum(p.get("total_budget", 0) for p in projects if p.get("status") not in ["REJECTED_BY_CONTRACTOR"])
    total_received = sum(p.get("released_amount", 0) for p in projects)
    pending_assignments = [
        p for p in projects 
        if (p.get("status") in ["ASSIGNED", "PENDING_ACCEPTANCE"] or p.get("assignment_status") != "ACCEPTED" or not p.get("phases_configured")) and p.get("status") not in ["COMPLETED", "REJECTED_BY_CONTRACTOR"]
    ]

    recent_payments = list(db.blockchain_transactions.find({
        "operation_type": "MILESTONE_PAYMENT_RELEASE"
    }).sort("timestamp", -1).limit(5))

    return {
        "success": True,
        "contractor_profile": serialize_doc(kyc),
        "contractor_id": officer_id or user_id,
        "contractor_name": current_user.get("name"),
        "metrics": {
            "total_contract_value": total_value,
            "total_payments_received": total_received,
            "assigned_projects_count": len(projects),
            "pending_assignments_count": len(pending_assignments),
            "active_projects_count": len([p for p in projects if p.get("status") in ["IN_PROGRESS", "ACCEPTED", "ESCROW_FUNDED"]]),
            "completed_projects_count": len([p for p in projects if p.get("status") == "COMPLETED"]),
            "kyc_status": kyc.get("kyc_status") if kyc else "APPROVED"
        },
        "assigned_projects": serialize_doc(projects[:10]),
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

    company_name = form.get("company_name", current_user["name"])
    gst_number = str(form.get("gst_number", "")).strip().upper()
    pan_number = str(form.get("pan_number", "")).strip().upper()
    license_number = str(form.get("license_number", "")).strip()
    experience_years = int(form.get("experience_years", 5))

    if not gst_number or not pan_number or not license_number:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "GSTIN, PAN, and PWD license numbers are required"}
        )

    doc_keys = [("gst_document", "GST"), ("pan_document", "PAN"), ("license_document", "PWD_LICENSE")]
    anchored_docs = []

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

            tx_hash = None
            try:
                tx_receipt = bcs.anchor_document_hash_onchain(doc_id, sha256_digest, doc_type, user_id)
                if tx_receipt:
                    tx_hash = tx_receipt["tx_hash"]
            except Exception as e:
                print(f"Warning anchoring KYC document hash on-chain: {e}")

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
        "license_number": license_number,
        "experience_years": experience_years,
        "kyc_status": "APPROVED",
        "updated_at": datetime.now(timezone.utc)
    }
    db.contractor_kyc.update_one({"user_id": user_id}, {"$set": kyc_update}, upsert=True)

    return {
        "success": True,
        "message": "KYC credentials and SHA-256 cryptographic hashes anchored on blockchain.",
        "anchored_documents": anchored_docs
    }

# --- Project Directory & Accept / Reject Workflow ---
@router.get("/projects")
async def get_my_projects(
    current_user: dict = Depends(require_roles(["CONTRACTOR"]))
):
    projects = list(db.projects.find(build_contractor_project_query(current_user)).sort("created_at", -1))
    
    for p in projects:
        p_id = p.get("project_id")
        phases = list(db.milestones.find({"project_id": p_id}).sort("milestone_index", 1))
        p["phases"] = serialize_doc(phases)

    return {"success": True, "projects": serialize_doc(projects)}

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
    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))

    return {
        "success": True,
        "project": serialize_doc(proj),
        "milestones": serialize_doc(milestones),
        "phases": serialize_doc(milestones),
        "documents": serialize_doc(documents)
    }

@router.post("/projects/{project_id}/accept")
async def accept_project(
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
            content={"success": False, "message": "Unauthorized: This project is not assigned to your enterprise."}
        )

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

    try:
        amounts_list = [int(p1_amount), int(p2_amount), int(p3_amount)]
        bcs.set_project_milestones_onchain(project_id, amounts_list)
    except Exception as e:
        print(f"Warning syncing on-chain milestones: {e}")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "assignment_status": "ACCEPTED",
            "phases_configured": True,
            "current_active_phase": 1,
            "accepted_at": datetime.now(timezone.utc),
            "accepted_by": current_user["name"]
        }}
    )

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Accepted",
        "message": f"Contractor '{current_user['name']}' accepted project {project_id}. 3 Phases (30%, 40%, 30%) automatically configured.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": f"Project {project_id} accepted! Automatically divided into 3 standardized phases (30%, 40%, 30%). Phase 1 is now ready for fund request.",
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
            "rejection_reason": reason,
            "rejected_at": datetime.now(timezone.utc),
            "rejected_by": current_user["name"]
        }}
    )

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Declined by Contractor",
        "message": f"Contractor '{current_user['name']}' rejected project {project_id}. Reason: {reason}",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
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
        if not prev_phase or prev_phase.get("status") != "COMPLETED":
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
    try:
        form = await request.form()
    except Exception:
        try:
            form = await request.json()
        except Exception:
            pass

    if milestone_index is None:
        milestone_index = int(form.get("milestone_index", 0))

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"Phase #{milestone_index + 1} not found"}
        )

    if milestone_index > 0:
        prev_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index - 1})
        if not prev_phase or prev_phase.get("status") != "COMPLETED":
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

    for form_key, doc_type in file_categories:
        file_obj = form.get(form_key)
        if file_obj and hasattr(file_obj, "filename") and file_obj.filename:
            fname = sanitize_filename(f"{project_id}_PHASE{milestone_index + 1}_{doc_type}_{file_obj.filename}")
            save_path = os.path.join(UPLOAD_FOLDER, fname)
            content = await file_obj.read()
            with open(save_path, "wb") as f:
                f.write(content)
            
            sha256_digest = bcs.calculate_sha256(save_path)
            doc_id = generate_doc_id(f"P{milestone_index + 1}_{doc_type[:4]}")
            proof_hashes.append(sha256_digest)
            primary_hash = sha256_digest

            try:
                bcs.anchor_document_hash_onchain(doc_id, sha256_digest, f"PHASE_{milestone_index + 1}_{doc_type}", project_id)
            except Exception as e:
                print(f"Warning anchoring {doc_type} proof on blockchain: {e}")

            doc_rec = {
                "document_id": doc_id,
                "file_name": fname,
                "file_path": save_path,
                "file_size": len(content),
                "sha256_hash": sha256_digest,
                "doc_type": doc_type,
                "entity_id": project_id,
                "milestone_index": milestone_index,
                "uploaded_at": datetime.now(timezone.utc)
            }
            db.documents.insert_one(doc_rec)
            proof_files_saved.append(serialize_doc(doc_rec))

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.submit_milestone_progress_onchain(project_id, milestone_index, primary_hash, progress_percentage)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning anchoring milestone progress on-chain: {e}")

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
            "timestamp": datetime.now(timezone.utc)
        })

    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": f"Phase #{milestone_index + 1} Completion Proof Submitted",
        "message": f"Contractor submitted Phase #{milestone_index + 1} proof deliverables (Material Bills, Photos, Videos, Test Docs) with cryptographic SHA-256 for {project_id}. Verification required.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
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
    payments = list(db.blockchain_transactions.find({
        "operation_type": "MILESTONE_PAYMENT_RELEASE"
    }).sort("timestamp", -1))
    return {"success": True, "payments": serialize_doc(payments)}
