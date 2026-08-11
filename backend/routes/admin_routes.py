import os
import random
import string
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import role_required, token_required
import blockchain_service as bcs

admin_bp = Blueprint("admin_bp", __name__)

def generate_allocation_id(fy):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ALLOC-{fy}-{rand_suffix}"

@admin_bp.route("/dashboard", methods=["GET"])
@role_required(["SUPER_ADMIN"])
def dashboard():
    selected_fy = request.args.get("fy")
    
    # 1. Fetch active and all financial years
    all_fys = list(db.financial_years.find().sort("year", -1))
    active_fy_doc = db.financial_years.find_one({"status": "ACTIVE"}) or (all_fys[0] if all_fys else None)
    
    target_fy_year = selected_fy if selected_fy else (active_fy_doc.get("year") if active_fy_doc else "2026-27")
    target_fy_doc = db.financial_years.find_one({"year": target_fy_year}) or active_fy_doc

    # 2. Compute FY-specific metrics
    fy_pipeline = [
        {"$match": {"financial_year": target_fy_year}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}, "count": {"$sum": 1}}}
    ]
    fy_stats = list(db.budget_allocations.aggregate(fy_pipeline))
    fy_allocated = fy_stats[0]["total"] if fy_stats else 0.0
    fy_disbursed = fy_stats[0]["disbursed"] if fy_stats else 0.0
    fy_allocations_count = fy_stats[0]["count"] if fy_stats else 0

    sanctioned_ceiling = float(target_fy_doc.get("total_budget", 5000000000.0)) if target_fy_doc else 5000000000.0
    remaining_unallocated = max(0.0, sanctioned_ceiling - fy_allocated)

    # 3. Overall / Lifetime stats
    total_budget_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}}}
    ]
    budget_stats = list(db.budget_allocations.aggregate(total_budget_pipeline))
    lifetime_allocated = budget_stats[0]["total"] if budget_stats else 0.0
    lifetime_disbursed = budget_stats[0]["disbursed"] if budget_stats else 0.0

    schemes_count = db.schemes.count_documents({})
    states_count = db.states.count_documents({})
    districts_count = db.districts.count_documents({})
    projects_count = db.projects.count_documents({})
    open_fraud_alerts = db.fraud_reports.count_documents({"status": "OPEN"})

    # Recent transfers and allocations
    recent_transfers = list(db.state_transfers.find().sort("created_at", -1).limit(5))
    recent_allocations = list(db.budget_allocations.find({"financial_year": target_fy_year}).sort("created_at", -1).limit(5))
    if not recent_allocations and not selected_fy:
        recent_allocations = list(db.budget_allocations.find().sort("created_at", -1).limit(5))

    return jsonify({
        "success": True,
        "metrics": {
            "selected_financial_year": target_fy_year,
            "active_financial_year": active_fy_doc.get("year") if active_fy_doc else "2026-27",
            "sanctioned_union_ceiling": sanctioned_ceiling,
            "allocated_to_schemes": fy_allocated,
            "disbursed_to_states": fy_disbursed,
            "remaining_unallocated_ceiling": remaining_unallocated,
            "fy_allocations_count": fy_allocations_count,
            "total_sanctioned_budget": lifetime_allocated,
            "total_disbursed_to_states": lifetime_disbursed,
            "schemes_count": schemes_count,
            "states_count": states_count,
            "districts_count": districts_count,
            "active_projects_count": projects_count,
            "open_fraud_alerts": open_fraud_alerts
        },
        "financial_years": serialize_doc(all_fys),
        "recent_transfers": serialize_doc(recent_transfers),
        "recent_allocations": serialize_doc(recent_allocations)
    })

# --- Financial Years ---
@admin_bp.route("/financial-years", methods=["GET", "POST"])
@role_required(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"])
def financial_years():
    if request.method == "POST":
        if g.current_user.get("role") != "SUPER_ADMIN":
            return jsonify({"success": False, "message": "Super Admin authorization required"}), 403

        data = request.get_json() or {}
        year = data.get("year", "").strip()
        if not year:
            return jsonify({"success": False, "message": "Financial year (e.g. 2026-27) is required"}), 400

        status = data.get("status", "ACTIVE")
        if status == "ACTIVE":
            # Deactivate previous active years to ensure clean single active cycle
            db.financial_years.update_many({"year": {"$ne": year}}, {"$set": {"status": "CLOSED"}})

        # Safe date calculation
        parts = year.split('-')
        start_year = parts[0]
        end_suffix = parts[1] if len(parts) > 1 else str(int(start_year) + 1)[-2:]
        end_year = f"20{end_suffix}" if len(end_suffix) == 2 else end_suffix

        doc = {
            "year": year,
            "title": data.get("title", f"Union Budget FY {year}"),
            "total_budget": float(data.get("total_budget", 5000000000.0)),
            "status": status,
            "start_date": data.get("start_date", f"{start_year}-04-01"),
            "end_date": data.get("end_date", f"{end_year}-03-31"),
            "created_at": datetime.utcnow()
        }
        db.financial_years.update_one({"year": year}, {"$set": doc}, upsert=True)
        return jsonify({"success": True, "message": f"Financial year {year} saved successfully", "financial_year": doc}), 201

    fys = list(db.financial_years.find().sort("year", -1))
    
    # Enrich each FY with live aggregated allocation totals
    enriched_fys = []
    for fy in fys:
        y = fy.get("year")
        alloc_stats = list(db.budget_allocations.aggregate([
            {"$match": {"financial_year": y}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}, "count": {"$sum": 1}}}
        ]))
        allocated = alloc_stats[0]["total"] if alloc_stats else 0.0
        disbursed = alloc_stats[0]["disbursed"] if alloc_stats else 0.0
        count = alloc_stats[0]["count"] if alloc_stats else 0
        total_b = float(fy.get("total_budget", 0.0))

        fy_dict = serialize_doc(fy)
        fy_dict["allocated_amount"] = allocated
        fy_dict["disbursed_amount"] = disbursed
        fy_dict["remaining_budget"] = max(0.0, total_b - allocated)
        fy_dict["allocations_count"] = count
        enriched_fys.append(fy_dict)

    return jsonify({"success": True, "financial_years": enriched_fys})

@admin_bp.route("/financial-years/<year>/activate", methods=["PUT"])
@role_required(["SUPER_ADMIN"])
def activate_financial_year(year):
    fy = db.financial_years.find_one({"year": year})
    if not fy:
        return jsonify({"success": False, "message": "Financial year not found"}), 404

    # Set all other FYs to CLOSED and this one to ACTIVE
    db.financial_years.update_many({"year": {"$ne": year}}, {"$set": {"status": "CLOSED"}})
    db.financial_years.update_one({"year": year}, {"$set": {"status": "ACTIVE", "updated_at": datetime.utcnow()}})
    
    return jsonify({"success": True, "message": f"Financial year {year} is now ACTIVE."})

# --- Departments ---
@admin_bp.route("/departments", methods=["GET", "POST"])
@role_required(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"])
def departments():
    if request.method == "POST":
        if g.current_user.get("role") != "SUPER_ADMIN":
            return jsonify({"success": False, "message": "Super Admin authorization required"}), 403

        data = request.get_json() or {}
        code = data.get("code", "").strip().upper()
        name = data.get("name", "").strip()
        if not code or not name:
            return jsonify({"success": False, "message": "Department code and name are required"}), 400

        doc = {
            "code": code,
            "name": name,
            "budget_share": float(data.get("budget_share", 20.0)),
            "head": data.get("head", ""),
            "created_at": datetime.utcnow()
        }
        db.departments.update_one({"code": code}, {"$set": doc}, upsert=True)
        return jsonify({"success": True, "message": "Department registered successfully", "department": doc}), 201

    depts = list(db.departments.find().sort("name", 1))
    return jsonify({"success": True, "departments": serialize_doc(depts)})

# --- States & Districts ---
@admin_bp.route("/states", methods=["GET", "POST"])
@role_required(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"])
def states():
    if request.method == "POST":
        if g.current_user.get("role") != "SUPER_ADMIN":
            return jsonify({"success": False, "message": "Super Admin authorization required"}), 403

        data = request.get_json() or {}
        code = data.get("code", "").strip().upper()
        name = data.get("name", "").strip()
        if not code or not name:
            return jsonify({"success": False, "message": "State code and name required"}), 400

        doc = {
            "code": code,
            "name": name,
            "treasury_address": data.get("treasury_address", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
            "created_at": datetime.utcnow()
        }
        db.states.update_one({"code": code}, {"$set": doc}, upsert=True)
        return jsonify({"success": True, "message": "State configured successfully", "state": doc}), 201

    st_list = list(db.states.find().sort("name", 1))
    return jsonify({"success": True, "states": serialize_doc(st_list)})

@admin_bp.route("/districts", methods=["GET", "POST"])
@role_required(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"])
def districts():
    if request.method == "POST":
        if g.current_user.get("role") != "SUPER_ADMIN":
            return jsonify({"success": False, "message": "Super Admin authorization required"}), 403

        data = request.get_json() or {}
        name = data.get("name", "").strip()
        state_code = data.get("state_code", "").strip().upper()
        if not name or not state_code:
            return jsonify({"success": False, "message": "District name and state code required"}), 400

        st = db.states.find_one({"code": state_code})
        doc = {
            "name": name,
            "state_code": state_code,
            "state_name": st.get("name") if st else state_code,
            "treasury_address": data.get("treasury_address", "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"),
            "created_at": datetime.utcnow()
        }
        db.districts.update_one({"name": name}, {"$set": doc}, upsert=True)
        return jsonify({"success": True, "message": "District configured successfully", "district": doc}), 201

    state_code = request.args.get("state_code", "").strip().upper()
    state_name = request.args.get("state_name", "").strip()
    query = {}
    if state_code:
        query["state_code"] = state_code
    elif state_name:
        query["$or"] = [{"state_name": state_name}, {"state_code": state_name.upper()}]

    dist_list = list(db.districts.find(query).sort("name", 1))
    return jsonify({"success": True, "districts": serialize_doc(dist_list)})

# --- Schemes ---
@admin_bp.route("/schemes", methods=["GET", "POST"])
@role_required(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"])
def schemes():
    if request.method == "POST":
        if g.current_user.get("role") != "SUPER_ADMIN":
            return jsonify({"success": False, "message": "Super Admin authorization required"}), 403

        data = request.get_json() or {}
        code = data.get("code", "").strip().upper()
        name = data.get("name", "").strip()
        if not code or not name:
            return jsonify({"success": False, "message": "Scheme code and name required"}), 400

        doc = {
            "code": code,
            "name": name,
            "department_code": data.get("department_code", "INFRA"),
            "department_name": data.get("department_name", "Road Transport & Infrastructure"),
            "description": data.get("description", ""),
            "target_budget": float(data.get("target_budget", 1000000000.0)),
            "created_at": datetime.utcnow()
        }
        db.schemes.update_one({"code": code}, {"$set": doc}, upsert=True)
        return jsonify({"success": True, "message": "Scheme created successfully", "scheme": doc}), 201

    sc_list = list(db.schemes.find().sort("name", 1))
    return jsonify({"success": True, "schemes": serialize_doc(sc_list)})

# --- Central Budget Allocation & Blockchain Dispatch ---
@admin_bp.route("/budget/allocate", methods=["POST"])
@role_required(["SUPER_ADMIN"])
def allocate_budget():
    data = request.get_json() or {}
    fy = data.get("financial_year", "2026-27")
    department = data.get("department", "Road Transport & Infrastructure")
    scheme_name = data.get("scheme_name", "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)")
    amount = float(data.get("amount", 0))

    if amount <= 0:
        return jsonify({"success": False, "message": "Allocation amount must be greater than zero"}), 400

    alloc_id = generate_allocation_id(fy)

    # 1. Record on Ethereum Smart Contract
    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.record_budget_allocation_onchain(alloc_id, scheme_name, department, amount)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning on-chain budget allocation transaction error: {e}")

    # 2. Record in MongoDB
    alloc_doc = {
        "allocation_id": alloc_id,
        "financial_year": fy,
        "department": department,
        "scheme_name": scheme_name,
        "amount": amount,
        "disbursed_amount": 0.0,
        "status": "SANCTIONED",
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "allocated_by": g.current_user["name"],
        "created_at": datetime.utcnow()
    }
    db.budget_allocations.insert_one(alloc_doc)

    # Log to global blockchain transactions collection
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "CENTRAL_BUDGET_ALLOCATION",
            "entity_id": alloc_id,
            "from_address": bcs.get_account().address if bcs.get_account() else "0xCentralGovernment",
            "to_address": "0xFinanceDisbursalAuthority",
            "amount": amount,
            "details": f"Budget Sanctioned for {scheme_name} ({department})",
            "timestamp": datetime.utcnow()
        })

    return jsonify({
        "success": True,
        "message": f"Central budget allocation {alloc_id} registered and anchored on blockchain",
        "allocation_id": alloc_id,
        "blockchain": {"tx_hash": tx_hash, "block_number": block_num},
        "budget": serialize_doc(alloc_doc)
    }), 201

@admin_bp.route("/allocations", methods=["GET"])
@role_required(["SUPER_ADMIN"])
def get_allocations():
    fy = request.args.get("fy")
    query = {}
    if fy and fy != "ALL":
        query["financial_year"] = fy
    allocations = list(db.budget_allocations.find(query).sort("created_at", -1))
    return jsonify({"success": True, "allocations": serialize_doc(allocations)})

# --- Send to Finance ---
@admin_bp.route("/budget/send-to-finance", methods=["POST"])
@role_required(["SUPER_ADMIN"])
def send_to_finance():
    data = request.get_json() or {}
    alloc_id = data.get("allocation_id")

    if not alloc_id:
        return jsonify({"success": False, "message": "Allocation ID is required"}), 400

    alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
    if not alloc:
        return jsonify({"success": False, "message": "Allocation not found"}), 404

    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "status": "SENT_TO_FINANCE",
            "sent_to_finance_at": datetime.utcnow(),
            "forwarding_notes": data.get("notes", "Sanctioned for Public Finance Disbursal")
        }}
    )

    # Create notification for Finance Department
    db.notifications.insert_one({
        "recipient_role": "FINANCE",
        "title": "New Budget Allocation Received",
        "message": f"Central Allocation {alloc_id} for '{alloc.get('scheme_name')}' (INR {alloc.get('amount'):,.2f}) forwarded for State Treasury transfer.",
        "link": f"/finance/transfers?allocation_id={alloc_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({"success": True, "message": f"Allocation {alloc_id} forwarded to Finance Department successfully."})

# --- User & Role Management ---
@admin_bp.route("/users", methods=["GET"])
@role_required(["SUPER_ADMIN"])
def get_users():
    users = list(db.users.find().sort("created_at", -1))
    return jsonify({"success": True, "users": serialize_doc(users)})

@admin_bp.route("/users/<user_id>/role", methods=["PUT"])
@role_required(["SUPER_ADMIN"])
def update_user_role(user_id):
    data = request.get_json() or {}
    new_role = data.get("role", "").upper()
    if not new_role:
        return jsonify({"success": False, "message": "Role is required"}), 400

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": new_role, "updated_at": datetime.utcnow()}}
    )
    return jsonify({"success": True, "message": f"User role updated to {new_role}"})

@admin_bp.route("/users/<user_id>/status", methods=["PUT"])
@role_required(["SUPER_ADMIN"])
def toggle_user_status(user_id):
    data = request.get_json() or {}
    is_active = data.get("is_active", True)

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": is_active, "updated_at": datetime.utcnow()}}
    )
    return jsonify({"success": True, "message": f"User status updated to {'Active' if is_active else 'Suspended'}"})

# --- Audit Reports Review ---
@admin_bp.route("/audit-reports", methods=["GET"])
@role_required(["SUPER_ADMIN"])
def get_audit_reports():
    reports = list(db.audit_reports.find().sort("created_at", -1))
    return jsonify({"success": True, "audit_reports": serialize_doc(reports)})

# --- Blockchain Explorer ---
@admin_bp.route("/blockchain-explorer", methods=["GET"])
@role_required(["SUPER_ADMIN", "AUDITOR", "FINANCE", "STATE", "DISTRICT"])
def admin_blockchain_explorer():
    connected = bcs.is_blockchain_connected()
    account = bcs.get_account()
    contract = bcs.get_contract()
    chain_id = None
    if connected:
        try:
            chain_id = bcs.w3.eth.chain_id
        except Exception:
            chain_id = 1337

    txs = list(db.blockchain_transactions.find().sort("timestamp", -1).limit(200))
    return jsonify({
        "success": True,
        "status": {
            "connected": connected,
            "rpc_url": bcs.RPC_URL,
            "chain_id": chain_id,
            "wallet_address": account.address if account else None,
            "contract_address": bcs.contract_address,
            "contract_deployed": contract is not None
        },
        "transactions": serialize_doc(txs)
    })
