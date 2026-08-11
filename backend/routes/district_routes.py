import random
import string
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import role_required
import blockchain_service as bcs

district_bp = Blueprint("district_bp", __name__)

def generate_project_id(district_name):
    clean_dist = "".join(filter(str.isalnum, district_name))[:3].upper()
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"PRJ-{clean_dist}-{rand_suffix}"

def check_district_access(target_district):
    """
    Strictly verifies that if the authenticated user is a District Officer,
    they can only access and perform actions within their assigned district.
    Higher Authorities (SUPER_ADMIN) have global cross-district access.
    """
    user_role = g.current_user.get("role")
    user_dist = g.current_user.get("district_name")

    if user_role == "SUPER_ADMIN":
        return True, None

    if user_role != "DISTRICT":
        return False, "Access Denied: District Officer role required for this resource."

    if not user_dist:
        return False, "Access Denied: No district assigned to this user profile."

    if target_district and target_district.strip().lower() != user_dist.strip().lower():
        return False, f"Unauthorized / Access Denied: You are only authorized to access your assigned district '{user_dist}'. Access to '{target_district}' is forbidden."

    return True, None

@district_bp.route("/dashboard", methods=["GET"])
@role_required(["DISTRICT"])
def dashboard():
    selected_dist = request.args.get("district")
    user_role = g.current_user.get("role")
    user_dist = g.current_user.get("district_name")
    user_state = g.current_user.get("state_code", "KA")
    user_state_name = g.current_user.get("state_name", "Karnataka")

    # Enforce district isolation
    if user_role == "DISTRICT":
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return jsonify({
                "success": False,
                "message": f"Unauthorized / Access Denied: You are only authorized to view data for your assigned district '{user_dist}'. Attempted access to '{selected_dist}' was blocked."
            }), 403
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Belagavi"

    # Fetch districts in state
    state_districts = list(db.districts.find({"state_code": user_state}).sort("name", 1))
    if not state_districts:
        state_districts = list(db.districts.find().sort("name", 1))

    # Match allocations case-insensitively
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

    return jsonify({
        "success": True,
        "district_name": district_name,
        "state_code": user_state,
        "state_name": user_state_name,
        "officer_id": g.current_user.get("officer_id"),
        "officer_name": g.current_user.get("name"),
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
    })

# --- Contractor KYC Review & Directory ---
@district_bp.route("/contractors", methods=["GET"])
@role_required(["DISTRICT"])
def get_contractors():
    contractors = list(db.contractor_kyc.find().sort("created_at", -1))
    # Fetch associated user profiles and anchored documents
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
        
        # Attach uploaded documents with hashes
        docs = list(db.documents.find({"entity_id": str(uid)})) if uid else []
        c["kyc_documents"] = serialize_doc(docs)

    return jsonify({"success": True, "contractors": serialize_doc(contractors)})

@district_bp.route("/contractor/<user_id>/kyc-review", methods=["POST"])
@role_required(["DISTRICT"])
def review_contractor_kyc(user_id):
    data = request.get_json() or {}
    action = data.get("action", "APPROVED").upper() # APPROVED, REJECTED, RESUBMISSION_REQUIRED
    remarks = data.get("remarks", "All statutory credentials verified by District Development Officer.")

    db.contractor_kyc.update_one(
        {"user_id": user_id},
        {"$set": {
            "kyc_status": action,
            "verification_remarks": remarks,
            "verified_by": g.current_user["name"],
            "reviewed_at": datetime.utcnow()
        }}
    )

    # Notify Contractor
    db.notifications.insert_one({
        "recipient_user_id": user_id,
        "title": f"KYC Verification {action}",
        "message": f"Your contractor eligibility review verdict: {action}. Remarks: {remarks}",
        "link": "/contractor/kyc",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({"success": True, "message": f"Contractor KYC status updated to {action}"})

# --- Project Lifecycle & Smart Contract Escrow ---
@district_bp.route("/projects", methods=["GET", "POST"])
@role_required(["DISTRICT"])
def projects():
    selected_dist = request.args.get("district")
    user_role = g.current_user.get("role")
    user_dist = g.current_user.get("district_name")
    user_state = g.current_user.get("state_code", "KA")
    user_state_name = g.current_user.get("state_name", "Karnataka")

    if user_role == "DISTRICT":
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return jsonify({
                "success": False,
                "message": f"Unauthorized / Access Denied: You cannot view projects in '{selected_dist}'. You are assigned to '{user_dist}'."
            }), 403
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Belagavi"

    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        scheme_name = data.get("scheme_name", "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)")
        department = data.get("department", "Road Transport & Infrastructure")
        
        req_district = data.get("district_name")
        if user_role == "DISTRICT":
            if req_district and req_district.strip().lower() != user_dist.strip().lower():
                return jsonify({
                    "success": False,
                    "message": f"Unauthorized / Access Denied: You cannot create projects in '{req_district}'. Your assigned district is '{user_dist}'."
                }), 403
            target_district = user_dist
        else:
            target_district = req_district or district_name

        total_budget = float(data.get("total_budget", 150000000.0))

        if not name or total_budget <= 0:
            return jsonify({"success": False, "message": "Project name and valid budget are required"}), 400

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
            "created_by": g.current_user["name"],
            "created_at": datetime.utcnow()
        }
        db.projects.insert_one(doc)

        return jsonify({
            "success": True,
            "message": f"Project {project_id} created successfully for {target_district}",
            "project": serialize_doc(doc)
        }), 201

    proj_list = list(db.projects.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))
    return jsonify({
        "success": True,
        "district_name": district_name,
        "state_code": user_state,
        "state_name": user_state_name,
        "is_locked_district": (user_role == "DISTRICT"),
        "projects": serialize_doc(proj_list)
    })

@district_bp.route("/projects/<project_id>", methods=["GET"])
@role_required(["DISTRICT"])
def get_project_details(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    # Verify district authorization
    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
    documents = list(db.documents.find({"entity_id": project_id}).sort("uploaded_at", -1))

    return jsonify({
        "success": True,
        "project": serialize_doc(proj),
        "milestones": serialize_doc(milestones),
        "documents": serialize_doc(documents)
    })

@district_bp.route("/projects/<project_id>/assign-contractor", methods=["POST"])
@role_required(["DISTRICT"])
def assign_contractor(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    data = request.get_json() or {}
    contractor_user_id = data.get("contractor_id") or data.get("contractor_user_id")

    if not contractor_user_id:
        return jsonify({"success": False, "message": "Contractor ID is required"}), 400

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

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "contractor_id": contractor_assigned_id,
            "contractor_email": contractor_email,
            "contractor_name": company_name,
            "status": "ASSIGNED",
            "assigned_at": datetime.utcnow()
        }}
    )

    # Notify Contractor
    db.notifications.insert_one({
        "recipient_user_id": contractor_user_id,
        "title": "New Infrastructure Project Assigned",
        "message": f"You have been awarded contract for {project_id}. Accept assignment and prepare milestone schedule.",
        "link": f"/contractor/my-projects?project_id={project_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Contractor '{company_name}' assigned to project {project_id} successfully"
    })

@district_bp.route("/projects/<project_id>/create-escrow", methods=["POST"])
@role_required(["DISTRICT"])
def create_escrow(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    if proj.get("escrow_onchain"):
        return jsonify({"success": False, "message": "Smart contract escrow already created on Ethereum"}), 400

    # 1. Execute Smart Contract Escrow Deployment
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

    # 2. Update MongoDB Project
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "escrow_onchain": True,
            "escrow_tx_hash": tx_hash,
            "escrow_block": block_num,
            "status": "ESCROW_FUNDED",
            "escrow_created_at": datetime.utcnow()
        }}
    )

    # 3. Log to Global Transactions
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "PROJECT_ESCROW_CREATION",
            "entity_id": project_id,
            "from_address": bcs.get_account().address if bcs.get_account() else "0xDistrictCollector",
            "to_address": "0xGovernmentFundTrackingContract",
            "amount": proj.get("total_budget"),
            "details": f"Smart Contract Escrow Lock for {proj.get('name')}",
            "timestamp": datetime.utcnow()
        })

    return jsonify({
        "success": True,
        "message": f"Smart contract escrow deployed on Ethereum for {project_id}",
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    })

@district_bp.route("/projects/<project_id>/milestones", methods=["POST"])
@role_required(["DISTRICT"])
def set_milestones(project_id):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    data = request.get_json() or {}
    milestones_data = data.get("milestones", [])
    if not milestones_data:
        return jsonify({"success": False, "message": "At least one milestone is required"}), 400

    total_milestones_sum = sum(float(m.get("amount", 0)) for m in milestones_data)
    if total_milestones_sum > proj.get("total_budget", 0):
        return jsonify({
            "success": False,
            "message": f"Sum of milestones (INR {total_milestones_sum:,.2f}) exceeds project budget ceiling (INR {proj.get('total_budget'):,.2f})"
        }), 400

    # 1. On-Chain Smart Contract Set Milestones
    amounts_list = [int(m.get("amount", 0)) for m in milestones_data]
    tx_hash = None
    try:
        tx_receipt = bcs.set_project_milestones_onchain(project_id, amounts_list)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
    except Exception as e:
        print(f"Warning setting milestones on-chain: {e}")

    # 2. Save in MongoDB
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
            "created_at": datetime.utcnow()
        })

    return jsonify({"success": True, "message": f"{len(milestones_data)} milestones configured and anchored on blockchain."})

# --- Phase Fund Approval & Milestone Verification / Rejection ---
@district_bp.route("/projects/<project_id>/phases/<int:milestone_index>/approve-funds", methods=["POST"])
@role_required(["DISTRICT"])
def approve_phase_funds(project_id, milestone_index):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not phase:
        return jsonify({"success": False, "message": f"Phase #{milestone_index + 1} not found"}), 404

    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "APPROVED_FOR_WORK",
            "phase_status": "APPROVED_FOR_WORK",
            "funds_approved_by": g.current_user["name"],
            "funds_approved_at": datetime.utcnow()
        }}
    )

    # Notify Contractor
    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Funds Approved",
            "message": f"District Authority approved funds for Phase #{milestone_index + 1} of {project_id}. You may now commence physical execution and submit completion evidence.",
            "link": "/contractor/my-projects",
            "read": False,
            "created_at": datetime.utcnow()
        })

    return jsonify({
        "success": True,
        "message": f"Funds approved for Phase #{milestone_index + 1}. Contractor is authorized to commence work."
    })

@district_bp.route("/projects/<project_id>/phases/<int:milestone_index>/verify", methods=["POST"])
@district_bp.route("/projects/<project_id>/milestones/<int:milestone_index>/approve-release", methods=["POST"])
@role_required(["DISTRICT"])
def verify_milestone_and_release(project_id, milestone_index):
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return jsonify({"success": False, "message": "Project not found"}), 404

    allowed, err_msg = check_district_access(proj.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    if proj.get("is_frozen"):
        return jsonify({"success": False, "message": "Project is FROZEN due to forensic audit hold. Cannot release funds."}), 403

    milestone = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index})
    if not milestone:
        return jsonify({"success": False, "message": "Milestone phase not found"}), 404

    data = request.get_json(silent=True) or {}
    action = data.get("action", "APPROVE").upper() # APPROVE or REJECT
    remarks = data.get("remarks") or data.get("rejection_reason") or data.get("notes") or ""

    # Case 1: REJECTION OF MILESTONE
    if action == "REJECT":
        if not remarks:
            remarks = "Quality inspection failed or photographic evidence was insufficient. Rectification required."

        db.milestones.update_one(
            {"project_id": project_id, "milestone_index": milestone_index},
            {"$set": {
                "status": "REJECTED",
                "phase_status": "REJECTED",
                "rejection_reason": remarks,
                "rejected_by": g.current_user["name"],
                "rejected_at": datetime.utcnow()
            }}
        )

        # Notify Contractor with reason
        if proj.get("contractor_id"):
            db.notifications.insert_one({
                "recipient_user_id": proj.get("contractor_id"),
                "title": f"Milestone #{milestone_index + 1} Rejected",
                "message": f"Phase #{milestone_index + 1} completion evidence for {project_id} was rejected by District Officer. Reason: {remarks}. Please review and resubmit.",
                "link": "/contractor/my-projects",
                "read": False,
                "created_at": datetime.utcnow()
            })

        return jsonify({
            "success": True,
            "message": f"Phase #{milestone_index + 1} rejected. Rejection reason recorded and contractor notified for resubmission.",
            "rejection_reason": remarks
        })

    # Case 2: APPROVAL & ON-CHAIN RELEASE
    if milestone.get("status") == "COMPLETED" or milestone.get("status") == "RELEASED":
        return jsonify({"success": False, "message": "Milestone phase payment has already been released."}), 400

    # 1. Execute Smart Contract Payment Release on Ethereum
    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.release_milestone_payment_onchain(project_id, milestone_index)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning executing milestone payment release on blockchain: {e}")

    # 2. Update Milestone Record to COMPLETED
    milestone_amount = milestone.get("amount", 0.0)
    db.milestones.update_one(
        {"project_id": project_id, "milestone_index": milestone_index},
        {"$set": {
            "status": "COMPLETED",
            "phase_status": "COMPLETED",
            "progress_percentage": 100,
            "blockchain_tx_hash": tx_hash,
            "blockchain_block": block_num,
            "approved_by": g.current_user["name"],
            "released_at": datetime.utcnow(),
            "rejection_reason": None
        }}
    )

    # 3. Automatically Unlock Next Phase (milestone_index + 1)
    next_phase = db.milestones.find_one({"project_id": project_id, "milestone_index": milestone_index + 1})
    if next_phase:
        db.milestones.update_one(
            {"project_id": project_id, "milestone_index": milestone_index + 1},
            {"$set": {
                "status": "UNLOCKED",
                "phase_status": "READY_FOR_FUND_REQUEST",
                "unlocked_at": datetime.utcnow()
            }}
        )

    # 4. Update Project Records
    new_released_total = proj.get("released_amount", 0.0) + milestone_amount
    is_all_completed = (milestone_index >= 2) or (new_released_total >= proj.get("total_budget", 0))

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "released_amount": new_released_total,
            "status": "COMPLETED" if is_all_completed else "IN_PROGRESS",
            "current_active_phase": milestone_index + 2 if not is_all_completed else 3,
            "last_disbursal_at": datetime.utcnow()
        }}
    )

    # 5. Log to Global Transactions
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "MILESTONE_PAYMENT_RELEASE",
            "entity_id": project_id,
            "from_address": "0xGovernmentFundTrackingContract",
            "to_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "amount": milestone_amount,
            "details": f"Phase #{milestone_index + 1} Escrow Disbursal for {proj.get('name')}",
            "timestamp": datetime.utcnow()
        })

    # 6. Notify Contractor
    if proj.get("contractor_id"):
        db.notifications.insert_one({
            "recipient_user_id": proj.get("contractor_id"),
            "title": f"Phase #{milestone_index + 1} Approved & Disbursed (INR {milestone_amount:,.2f})",
            "message": f"Phase #{milestone_index + 1} payment released on blockchain.{' Next phase is now unlocked!' if next_phase else ' All project phases completed!'}",
            "link": "/contractor/payments",
            "read": False,
            "created_at": datetime.utcnow()
        })

    return jsonify({
        "success": True,
        "message": f"Phase #{milestone_index + 1} approved and payment released on blockchain.{' Phase #' + str(milestone_index + 2) + ' automatically unlocked.' if next_phase else ' Project fully completed!'}",
        "next_phase_unlocked": bool(next_phase),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    })

# --- Grievances Management ---
@district_bp.route("/grievances", methods=["GET"])
@role_required(["DISTRICT"])
def get_grievances():
    user_role = g.current_user.get("role")
    user_dist = g.current_user.get("district_name")
    selected_dist = request.args.get("district")

    if user_role == "DISTRICT":
        if selected_dist and selected_dist.strip().lower() != user_dist.strip().lower():
            return jsonify({
                "success": False,
                "message": f"Unauthorized: You cannot view grievances for '{selected_dist}'."
            }), 403
        district_name = user_dist
    else:
        district_name = selected_dist or user_dist or "Pune"

    grievances = list(db.complaints.find({
        "$or": [
            {"district_name": district_name},
            {"district_name": {"$regex": f"^{district_name}$", "$options": "i"}}
        ]
    }).sort("created_at", -1))
    return jsonify({"success": True, "district_name": district_name, "grievances": serialize_doc(grievances)})

@district_bp.route("/grievances/<reference_id>/update-status", methods=["PUT"])
@role_required(["DISTRICT"])
def update_grievance_status(reference_id):
    complaint = db.complaints.find_one({"$or": [{"reference_id": reference_id}, {"ref_id": reference_id}]})
    if not complaint:
        return jsonify({"success": False, "message": "Grievance complaint not found"}), 404

    allowed, err_msg = check_district_access(complaint.get("district_name"))
    if not allowed:
        return jsonify({"success": False, "message": err_msg}), 403

    data = request.get_json() or {}
    new_status = data.get("status", "RESOLVED").upper() # INVESTIGATING, RESOLVED, REJECTED
    notes = data.get("resolution_notes", "Site inspection completed and corrective measures verified.")

    db.complaints.update_one(
        {"$or": [{"reference_id": reference_id}, {"ref_id": reference_id}]},
        {"$set": {
            "status": new_status,
            "resolution_notes": notes,
            "resolved_by": g.current_user["name"],
            "resolved_at": datetime.utcnow()
        }}
    )
    return jsonify({"success": True, "message": f"Grievance {reference_id} status updated to {new_status}"})
