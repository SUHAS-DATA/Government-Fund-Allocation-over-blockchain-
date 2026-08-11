import random
import string
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import role_required
import blockchain_service as bcs

state_bp = Blueprint("state_bp", __name__)

def generate_district_alloc_id(district_name):
    clean_dist = "".join(filter(str.isalnum, district_name))[:3].upper()
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DIST-ALC-{clean_dist}-{rand_suffix}"

@state_bp.route("/dashboard", methods=["GET"])
@role_required(["STATE"])
def dashboard():
    user_state_code = g.current_user.get("state_code")
    user_state_name = g.current_user.get("state_name")

    query = {}
    if user_state_code:
        query["state_code"] = user_state_code

    received_funds = list(db.state_transfers.find(query).sort("created_at", -1))
    if not received_funds and user_state_code:
        # Fallback to all transfers if user's specific state has none yet
        received_funds = list(db.state_transfers.find().sort("created_at", -1))

    total_received = sum(f.get("amount", 0) for f in received_funds)

    district_allocations = list(db.district_allocations.find().sort("created_at", -1))
    total_allocated_to_districts = sum(d.get("amount", 0) for d in district_allocations)

    remaining_state_balance = max(0, total_received - total_allocated_to_districts)

    # Breakdown by district
    dist_pipeline = [
        {"$group": {"_id": "$district_name", "total_allocated": {"$sum": "$amount"}, "alloc_count": {"$sum": 1}}},
        {"$sort": {"total_allocated": -1}}
    ]
    district_breakdown = list(db.district_allocations.aggregate(dist_pipeline))

    current_state_title = user_state_name or (received_funds[0].get("state_name") if received_funds else "State Treasury")

    return jsonify({
        "success": True,
        "state_code": user_state_code or (received_funds[0].get("state_code") if received_funds else "ALL"),
        "state_name": current_state_title,
        "metrics": {
            "total_funds_received": total_received,
            "total_allocated_to_districts": total_allocated_to_districts,
            "remaining_state_treasury_balance": remaining_state_balance,
            "received_transfers_count": len(received_funds),
            "district_allocations_count": len(district_allocations)
        },
        "recent_received_funds": serialize_doc(received_funds[:5]),
        "district_breakdown": serialize_doc(district_breakdown)
    })

@state_bp.route("/received-funds", methods=["GET"])
@role_required(["STATE"])
def received_funds():
    user_state_code = g.current_user.get("state_code")
    query = {}
    if user_state_code:
        query["state_code"] = user_state_code

    funds = list(db.state_transfers.find(query).sort("created_at", -1))
    if not funds and user_state_code:
        # Fallback to all state transfers
        funds = list(db.state_transfers.find().sort("created_at", -1))

    return jsonify({"success": True, "received_funds": serialize_doc(funds)})

@state_bp.route("/districts", methods=["GET"])
@role_required(["STATE", "SUPER_ADMIN", "DISTRICT", "FINANCE"])
def get_districts():
    state_code = request.args.get("state_code", "").strip().upper()
    user_state = state_code or g.current_user.get("state_code")
    query = {"state_code": user_state} if user_state else {}
    dist_list = list(db.districts.find(query).sort("name", 1))
    if not dist_list and not user_state:
        dist_list = list(db.districts.find().sort("name", 1))
    return jsonify({"success": True, "districts": serialize_doc(dist_list)})

@state_bp.route("/allocate-to-district", methods=["POST"])
@role_required(["STATE"])
def allocate_to_district():
    data = request.get_json() or {}
    transfer_id = data.get("transfer_id")
    district_name = data.get("district_name", "Pune")
    amount = float(data.get("amount", 0))

    if not transfer_id or amount <= 0:
        return jsonify({"success": False, "message": "Transfer ID and valid allocation amount are required"}), 400

    trf = db.state_transfers.find_one({"transfer_id": transfer_id})
    if not trf:
        return jsonify({"success": False, "message": "State transfer record not found"}), 404

    # Balance check
    already_allocated = trf.get("allocated_to_districts", 0.0)
    total_transfer = trf.get("amount", 0.0)
    available_balance = total_transfer - already_allocated

    if amount > available_balance:
        return jsonify({
            "success": False,
            "message": f"Requested amount (INR {amount:,.2f}) exceeds remaining state transfer balance (INR {available_balance:,.2f})"
        }), 400

    dist_alloc_id = generate_district_alloc_id(district_name)

    # 1. Execute On-Chain Smart Contract Function
    tx_hash = None
    block_num = None
    try:
        contract = bcs.get_contract()
        if contract:
            try:
                exists = contract.functions.stateTransfers(transfer_id).call()[4]
            except Exception:
                exists = False

            if not exists:
                rec_trf = bcs.record_state_transfer_onchain(
                    transfer_id,
                    trf.get("allocation_id"),
                    trf.get("state_name", "Karnataka"),
                    float(trf.get("amount", amount))
                )
                db.state_transfers.update_one(
                    {"transfer_id": transfer_id},
                    {"$set": {
                        "blockchain_tx_hash": rec_trf["tx_hash"],
                        "blockchain_block": rec_trf["block_number"]
                    }}
                )

        tx_receipt = bcs.record_district_allocation_onchain(dist_alloc_id, transfer_id, district_name, amount)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning executing district allocation on blockchain: {e}")

    # 2. Record District Allocation in MongoDB
    dist_doc = {
        "district_alloc_id": dist_alloc_id,
        "transfer_id": transfer_id,
        "scheme_name": trf.get("scheme_name"),
        "department": trf.get("department"),
        "state_code": trf.get("state_code"),
        "district_name": district_name,
        "amount": amount,
        "allocated_by": g.current_user["name"],
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "created_at": datetime.utcnow()
    }
    db.district_allocations.insert_one(dist_doc)

    # 3. Update State Transfer Record
    db.state_transfers.update_one(
        {"transfer_id": transfer_id},
        {"$set": {
            "allocated_to_districts": already_allocated + amount,
            "last_allocation_at": datetime.utcnow()
        }}
    )

    # 4. Log to Global Blockchain Transactions Collection
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "STATE_DISTRICT_ALLOCATION",
            "entity_id": dist_alloc_id,
            "from_address": f"0xStateTreasury_{trf.get('state_code')}",
            "to_address": f"0xDistrictAgency_{district_name}",
            "amount": amount,
            "details": f"District Fund Sanction for {district_name} ({trf.get('scheme_name')})",
            "timestamp": datetime.utcnow()
        })

    # 5. Notify District Collector
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "recipient_district": district_name,
        "title": "District Fund Sanction Received",
        "message": f"District Allocation {dist_alloc_id} for INR {amount:,.2f} under '{trf.get('scheme_name')}' received.",
        "link": f"/district/projects?district_alloc_id={dist_alloc_id}",
        "read": False,
        "created_at": datetime.utcnow()
    })

    return jsonify({
        "success": True,
        "message": f"Funds successfully allocated to {district_name} District and logged on blockchain",
        "allocation": serialize_doc(dist_doc),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }), 201

@state_bp.route("/allocations", methods=["GET"])
@role_required(["STATE"])
def get_allocations():
    state_code = g.current_user.get("state_code", "MH")
    allocations = list(db.district_allocations.find({"state_code": state_code}).sort("created_at", -1))
    return jsonify({"success": True, "allocations": serialize_doc(allocations)})
