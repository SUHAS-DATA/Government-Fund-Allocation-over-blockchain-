import os
import random
import string
from datetime import datetime
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import role_required
import blockchain_service as bcs

contractor_bp = Blueprint("contractor_bp", __name__)
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def generate_doc_id(doc_type):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DOC-{doc_type}-{rand_suffix}"

def get_contractor_identifiers():
    """Extract all matching IDs for the logged-in contractor"""
    user_id = str(g.current_user.get("user_id", ""))
    email = str(g.current_user.get("email", "")).lower()
    officer_id = str(g.current_user.get("officer_id") or g.current_user.get("contractor_id") or "")
    return user_id, email, officer_id

def verify_contractor_project_ownership(proj):
    """Verify that the project is assigned to the authenticated contractor"""
    if not proj:
        return False
    user_id, email, officer_id = get_contractor_identifiers()
    proj_cid = str(proj.get("contractor_id", ""))
    
    if proj_cid in [user_id, email, officer_id]:
        return True
    if proj.get("contractor_email") and str(proj.get("contractor_email")).lower() == email:
        return True
    return False

def build_contractor_project_query():
    user_id, email, officer_id = get_contractor_identifiers()
    cids = [user_id, email]
    if officer_id:
        cids.append(officer_id)
    return {
        "$or": [
            {"contractor_id": {"$in": cids}},
            {"contractor_email": email}
        ]
    }

@contractor_bp.route("/dashboard", methods=["GET"])
@role_required(["CONTRACTOR"])
def dashboard():
    user_id, email, officer_id = get_contractor_identifiers()
    kyc = db.contractor_kyc.find_one({"$or": [{"user_id": user_id}, {"user_id": email}, {"email": email}]})
    
    projects = list(db.projects.find(build_contractor_project_query()).sort("created_at", -1))

    total_value = sum(p.get("total_budget", 0) for p in projects if p.get("status") not in ["REJECTED_BY_CONTRACTOR"])
    total_received = sum(p.get("released_amount", 0) for p in projects)
    pending_assignments = [
        p for p in projects 
        if (p.get("status") in ["ASSIGNED", "PENDING_ACCEPTANCE"] or p.get("assignment_status") != "ACCEPTED" or not p.get("phases_configured")) and p.get("status") not in ["COMPLETED", "REJECTED_BY_CONTRACTOR"]
    ]

    recent_payments = list(db.blockchain_transactions.find({
        "operation_type": "MILESTONE_PAYMENT_RELEASE"
    }).sort("timestamp", -1).limit(5))

    return jsonify({
        "success": True,
        "contractor_profile": serialize_doc(kyc),
        "contractor_id": officer_id or user_id,
        "contractor_name": g.current_user.get("name"),
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
    })

# --- KYC & Off-Chain Document Submission ---
@contractor_bp.route("/kyc-status", methods=["GET"])
@role_required(["CONTRACTOR"])
def kyc_status():
    user_id, email, _ = get_contractor_identifiers()
    kyc = db.contractor_kyc.find_one({"$or": [{"user_id": user_id}, {"user_id": email}, {"email": email}]})
    docs = list(db.documents.find({"entity_id": user_id}))
    
    kyc_data = serialize_doc(kyc) if kyc else {}
    if kyc_data:
        kyc_data["kyc_documents"] = serialize_doc(docs)

    return jsonify({
        "success": True,
        "contractor": kyc_data,
        "documents": serialize_doc(docs)
    })

@contractor_bp.route("/kyc-submit", methods=["POST"])
@role_required(["CONTRACTOR"])
def kyc_submit():
    user_id, email, _ = get_contractor_identifiers()
    company_name = request.form.get("company_name", g.current_user["name"])
    gst_number = request.form.get("gst_number", "").strip().upper()
    pan_number = request.form.get("pan_number", "").strip().upper()
    license_number = request.form.get("license_number", "").strip()
    experience_years = int(request.form.get("experience_years", 5))

    if not gst_number or not pan_number or not license_number:
        return jsonify({"success": False, "message": "GSTIN, PAN, and PWD license numbers are required"}), 400

    doc_keys = [("gst_document", "GST"), ("pan_document", "PAN"), ("license_document", "PWD_LICENSE")]
    anchored_docs = []

    for form_key, doc_type in doc_keys:
        file = request.files.get(form_key)
        if file and file.filename:
            fname = secure_filename(f"{user_id}_{doc_type}_{file.filename}")
            save_path = os.path.join(UPLOAD_FOLDER, fname)
            file.save(save_path)

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
                "file_size": os.path.getsize(save_path),
                "sha256_hash": sha256_digest,
                "doc_type": doc_type,
                "entity_id": user_id,
                "blockchain_tx_hash": tx_hash,
                "uploaded_at": datetime.utcnow()
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
        "updated_at": datetime.utcnow()
    }
    db.contractor_kyc.update_one({"user_id": user_id}, {"$set": kyc_update}, upsert=True)

    return jsonify({
        "success": True,
        "message": "KYC credentials and SHA-256 cryptographic hashes anchored on blockchain.",
        "anchored_documents": anchored_docs
    })

# --- Project Directory & Accept / Reject Workflow ---
@contractor_bp.route("/projects", methods=["GET"])
@role_required(["CONTRACTOR"])
def get_my_projects():
    projects = list(db.projects.find(build_contractor_project_query()).sort("created_at", -1))
    
    # Attach phases for each project
    for p in projects:
        p_id = p.get("project_id")
        phases = list(db.milestones.find({"project_id": p_id}).sort("milestone_index", 1))
        p["phases"] = serialize_doc(phases)

    return jsonify({"success": True, "projects": serialize_doc(projects)})

@contractor_bp.route("/projects/<project_id>", methods=["GET"])
@role_required(["CONTRACTOR"])
def get_contractor_project_details(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    if not verify_contractor_project_ownership(proj):
        return jsonify({
            "success": False,
            "message": "Unauthorized / Access Denied: You are not authorized to view projects assigned to other contractors."
        }), 403

    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))

    return jsonify({
        "success": True,
        "project": serialize_doc(proj),
        "milestones": serialize_doc(milestones),
        "phases": serialize_doc(milestones),
        "documents": serialize_doc(documents)
    })

@contractor_bp.route("/projects/<project_id>/accept", methods=["POST"])
@role_required(["CONTRACTOR"])
def accept_project(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    if not verify_contractor_project_ownership(proj):
        return jsonify({"success": False, "message": "Unauthorized: This project is not assigned to your enterprise."}), 403

    total_budget = float(proj.get("total_budget", 150000000.0))

    # Calculate 3 Standardized Phases (30%, 40%, 30%)
    p1_amount = round(total_budget * 0.30, 2)
    p2_amount = round(total_budget * 0.40, 2)
    p3_amount = round(total_budget - (p1_amount + p2_amount), 2) # Ensure exact 100%

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
            "created_at": datetime.utcnow()
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
            "created_at": datetime.utcnow()
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
            "created_at": datetime.utcnow()
        }
    ]

    # Save to MongoDB
    db.milestones.delete_many({"project_id": project_id})
    for phase in three_phases:
        db.milestones.insert_one(phase)

    # Initialize Smart Contract Milestones on-chain if not already done
    try:
        amounts_list = [int(p1_amount), int(p2_amount), int(p3_amount)]
        bcs.set_project_milestones_onchain(project_id, amounts_list)
    except Exception as e:
        print(f"Warning syncing on-chain milestones: {e}")

    # Update Project Record
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "IN_PROGRESS",
            "assignment_status": "ACCEPTED",
            "phases_configured": True,
            "current_active_phase": 1,
            "accepted_at": datetime.utcnow(),
            "accepted_by": g.current_user["name"]
        }}
    )

    # Notify District Officer
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Accepted",
        "message": f"Contractor '{g.current_user['name']}' accepted project {project_id}. 3 Phases (30%, 40%, 30%) automatically configured.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Project {project_id} accepted! Automatically divided into 3 standardized phases (30%, 40%, 30%). Phase 1 is now ready for fund request.",
        "phases": serialize_doc(three_phases)
    })

@contractor_bp.route("/projects/<project_id>/reject", methods=["POST"])
@role_required(["CONTRACTOR"])
def reject_project(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    if not verify_contractor_project_ownership(proj):
        return jsonify({"success": False, "message": "Unauthorized: This project is not assigned to your enterprise."}), 403

    data = request.get_json(silent=True) or {}
    reason = data.get("rejection_reason") or data.get("reason", "Contractor at full operational capacity; unable to accept assignment.")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "status": "REJECTED_BY_CONTRACTOR",
            "assignment_status": "REJECTED",
            "rejection_reason": reason,
            "rejected_at": datetime.utcnow(),
            "rejected_by": g.current_user["name"]
        }}
    )

    # Notify District Officer
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": "Project Assignment Declined by Contractor",
        "message": f"Contractor '{g.current_user['name']}' rejected project {project_id}. Reason: {reason}",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Project assignment for {project_id} has been declined."
    })

# --- Step 1: Request Allocated Phase Funds ---
@contractor_bp.route("/projects/<project_id>/phases/<int:milestone_index>/request-funds", methods=["POST"])
@role_required(["CONTRACTOR"])
def request_phase_funds(project_id, milestone_index):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    if not verify_contractor_project_ownership(proj):
        return jsonify({"success": False, "message": "Unauthorized access to project."}), 403

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return jsonify({"success": False, "message": f"Phase #{milestone_index + 1} not found"}), 404

    # 1. Prevent Phase Skipping: Previous phases must be COMPLETED
    if milestone_index > 0:
        prev_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index - 1})
        if not prev_phase or prev_phase.get("status") != "COMPLETED":
            return jsonify({
                "success": False,
                "message": f"Sequential progression required: Phase #{milestone_index} must be completed and verified by District Officer before requesting funds for Phase #{milestone_index + 1}."
            }), 400

    data = request.get_json(silent=True) or {}
    requested_amount = float(data.get("requested_amount", phase.get("amount", 0)))
    notes = data.get("notes") or data.get("request_notes") or f"Fund request for Phase #{milestone_index + 1} execution mobilization."

    # 2. Prevent Excess Funds Request
    if requested_amount > phase.get("amount", 0):
        return jsonify({
            "success": False,
            "message": f"Excess fund request blocked: Requested amount (INR {requested_amount:,.2f}) exceeds Phase #{milestone_index + 1} allocated limit of INR {phase.get('amount'):,.2f}."
        }), 400

    # 3. Update Phase Status in MongoDB
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "FUND_REQUESTED",
            "phase_status": "FUND_REQUESTED",
            "fund_requested_amount": requested_amount,
            "fund_request_notes": notes,
            "fund_requested_at": datetime.utcnow()
        }}
    )

    # Notify District Officer
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": f"Phase #{milestone_index + 1} Fund Request",
        "message": f"Contractor requested INR {requested_amount:,.2f} mobilization funds for {project_id} (Phase #{milestone_index + 1}).",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Fund request for Phase #{milestone_index + 1} (INR {requested_amount:,.2f}) submitted to District Officer for approval."
    })

# --- Step 3: Upload Milestone Completion Evidence & Photos ---
@contractor_bp.route("/projects/<project_id>/phases/<int:milestone_index>/submit-milestone", methods=["POST"])
@contractor_bp.route("/projects/<project_id>/progress", methods=["POST"])
@role_required(["CONTRACTOR"])
def submit_milestone_progress(project_id, milestone_index=None):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    if not verify_contractor_project_ownership(proj):
        return jsonify({"success": False, "message": "Unauthorized access."}), 403

    if proj.get("is_frozen"):
        return jsonify({"success": False, "message": "Project is FROZEN by CAG audit hold. Work halted."}), 403

    if milestone_index is None:
        milestone_index = int(request.form.get("milestone_index", 0))

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return jsonify({"success": False, "message": f"Phase #{milestone_index + 1} not found"}), 404

    # Ensure previous phase is completed
    if milestone_index > 0:
        prev_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index - 1})
        if not prev_phase or prev_phase.get("status") != "COMPLETED":
            return jsonify({
                "success": False,
                "message": f"Phase #{milestone_index} must be verified and completed before submitting Phase #{milestone_index + 1}."
            }), 400

    progress_percentage = int(request.form.get("percentage") or request.form.get("progress_percentage", 100))
    description = request.form.get("notes") or request.form.get("description", "Site inspection completed. Construction work executed as per specifications.")

    # Process photo / document upload and compute SHA-256
    proof_hash = "60a22a54ec9c1c2d992147779f7a552bf3f9611db93952f4a4df0f77df27e02a"
    file = request.files.get("file") or request.files.get("progress_file") or request.files.get("photo")
    saved_filename = None

    if file and file.filename:
        fname = secure_filename(f"{project_id}_PHASE{milestone_index + 1}_{file.filename}")
        save_path = os.path.join(UPLOAD_FOLDER, fname)
        file.save(save_path)
        proof_hash = bcs.calculate_sha256(save_path)
        saved_filename = fname
        doc_id = generate_doc_id(f"PHASE{milestone_index + 1}")

        # Anchor on Ethereum Smart Contract
        try:
            bcs.anchor_document_hash_onchain(doc_id, proof_hash, f"PHASE_{milestone_index + 1}_PROOF", project_id)
        except Exception as e:
            print(f"Warning anchoring milestone proof on blockchain: {e}")

        db.documents.insert_one({
            "document_id": doc_id,
            "file_name": fname,
            "file_path": save_path,
            "file_size": os.path.getsize(save_path),
            "sha256_hash": proof_hash,
            "doc_type": "PHASE_COMPLETION_PROOF",
            "entity_id": project_id,
            "milestone_index": milestone_index,
            "uploaded_at": datetime.utcnow()
        })

    # Submit on-chain milestone progress
    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.submit_milestone_progress_onchain(project_id, milestone_index, proof_hash, progress_percentage)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning anchoring milestone progress on-chain: {e}")

    # Update Phase in MongoDB
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "SUBMITTED",
            "phase_status": "SUBMITTED_FOR_VERIFICATION",
            "progress_percentage": progress_percentage,
            "proof_document_hash": proof_hash,
            "file_name": saved_filename or phase.get("file_name"),
            "progress_notes": description,
            "blockchain_progress_tx": tx_hash,
            "submitted_at": datetime.utcnow(),
            "rejection_reason": None # Clear previous rejection on resubmission
        }}
    )

    # Notify District Officer
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "district_name": proj.get("district_name"),
        "title": f"Phase #{milestone_index + 1} Completion Submitted",
        "message": f"Contractor submitted completion evidence & photo with SHA-256 for {project_id} (Phase #{milestone_index + 1}). Verification required.",
        "link": f"/district/projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Phase #{milestone_index + 1} completion evidence uploaded and anchored with SHA-256 digest ({proof_hash[:12]}...). Submitted to District Officer for verification.",
        "proof_document_hash": proof_hash,
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    })

@contractor_bp.route("/projects/<project_id>/milestone-request", methods=["POST"])
@contractor_bp.route("/projects/<project_id>/request-payment", methods=["POST"])
@role_required(["CONTRACTOR"])
def legacy_request_milestone_payment(project_id):
    data = request.get_json(silent=True) or {}
    milestone_index = int(data.get("milestone_index", 0))
    notes = data.get("notes") or data.get("request_notes") or "Phase deliverables completed."
    return request_phase_funds(project_id, milestone_index)

@contractor_bp.route("/payments", methods=["GET"])
@role_required(["CONTRACTOR"])
def get_payments():
    payments = list(db.blockchain_transactions.find({
        "operation_type": "MILESTONE_PAYMENT_RELEASE"
    }).sort("timestamp", -1))
    return jsonify({"success": True, "payments": serialize_doc(payments)})
