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
state_bp = router

def generate_district_alloc_id(district_name):
    clean_dist = "".join(filter(str.isalnum, district_name))[:3].upper()
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"DIST-ALC-{clean_dist}-{rand_suffix}"

def format_denomination(amount):
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    
    if amt >= 10000000:
        cr_val = amt / 10000000
        val_str = f"{cr_val:.2f}".rstrip('0').rstrip('.') if not cr_val.is_integer() else f"{int(cr_val)}"
        return f"{val_str} (Cr)"
    elif amt >= 100000:
        lakh_val = amt / 100000
        val_str = f"{lakh_val:.2f}".rstrip('0').rstrip('.') if not lakh_val.is_integer() else f"{int(lakh_val)}"
        return f"{val_str} (Lakh)"
    elif amt >= 1000:
        k_val = amt / 1000
        val_str = f"{k_val:.2f}".rstrip('0').rstrip('.') if not k_val.is_integer() else f"{int(k_val)}"
        return f"{val_str} (k)"
    else:
        return f"₹{amt:,.2f}"

@router.get("/dashboard")
async def dashboard(
    current_user: dict = Depends(require_roles(["STATE"]))
):
    user_state_code = current_user.get("state_code")
    user_state_name = current_user.get("state_name")

    query = {}
    if user_state_code:
        query["state_code"] = user_state_code

    received_funds = list(db.state_transfers.find(query).sort("created_at", -1))
    if not received_funds and user_state_code:
        received_funds = list(db.state_transfers.find().sort("created_at", -1))

    total_received = sum(f.get("amount", 0) for f in received_funds)

    district_allocations = list(db.district_allocations.find().sort("created_at", -1))
    total_allocated_to_districts = sum(d.get("amount", 0) for d in district_allocations)

    remaining_state_balance = max(0, total_received - total_allocated_to_districts)

    dist_pipeline = [
        {"$group": {"_id": "$district_name", "total_allocated": {"$sum": "$amount"}, "alloc_count": {"$sum": 1}}},
        {"$sort": {"total_allocated": -1}}
    ]
    district_breakdown = list(db.district_allocations.aggregate(dist_pipeline))

    current_state_title = user_state_name or (received_funds[0].get("state_name") if received_funds else "State Treasury")

    return {
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
    }

@router.get("/received-funds")
async def received_funds(
    current_user: dict = Depends(require_roles(["STATE"]))
):
    user_state_code = current_user.get("state_code")
    query = {}
    if user_state_code:
        query["state_code"] = user_state_code

    funds = list(db.state_transfers.find(query).sort("created_at", -1))
    if not funds and user_state_code:
        funds = list(db.state_transfers.find().sort("created_at", -1))

    return {"success": True, "received_funds": serialize_doc(funds)}

@router.get("/districts")
async def get_districts(
    state_code: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["STATE", "SUPER_ADMIN", "DISTRICT", "FINANCE"]))
):
    req_state_code = state_code.strip().upper() if state_code else ""
    user_state = req_state_code or current_user.get("state_code")
    query = {"state_code": user_state} if user_state else {}
    dist_list = list(db.districts.find(query).sort("name", 1))
    if not dist_list and not user_state:
        dist_list = list(db.districts.find().sort("name", 1))
    return {"success": True, "districts": serialize_doc(dist_list)}

@router.post("/allocate-to-district", status_code=status.HTTP_201_CREATED)
async def allocate_to_district(
    request: Request,
    current_user: dict = Depends(require_roles(["STATE"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    transfer_id = data.get("transfer_id")
    district_name = data.get("district_name", "Pune")
    amount = float(data.get("amount", 0))

    if not transfer_id or amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Transfer ID and valid allocation amount are required"}
        )

    trf = db.state_transfers.find_one({"transfer_id": transfer_id})
    if not trf:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "State transfer record not found"}
        )

    already_allocated = trf.get("allocated_to_districts", 0.0)
    total_transfer = trf.get("amount", 0.0)
    available_balance = total_transfer - already_allocated

    if amount > available_balance:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Requested amount (INR {amount:,.2f}) exceeds remaining state transfer balance (INR {available_balance:,.2f})"
            }
        )

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
        "allocated_by": current_user["name"],
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "created_at": datetime.now(timezone.utc)
    }
    db.district_allocations.insert_one(dist_doc)

    # 3. Update State Transfer Record
    db.state_transfers.update_one(
        {"transfer_id": transfer_id},
        {"$set": {
            "allocated_to_districts": already_allocated + amount,
            "last_allocation_at": datetime.now(timezone.utc)
        }}
    )

    # 4. Log to Global Blockchain Transactions Collection
    if tx_hash:
        from_state = bcs.get_entity_wallet("STATE", trf.get("state_code"))
        to_dist = bcs.get_entity_wallet("DISTRICT", district_name)
        state_title = trf.get("state_name") or "State"
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "STATE_DISTRICT_ALLOCATION",
            "entity_id": dist_alloc_id,
            "from_address": from_state,
            "to_address": to_dist,
            "from_entity": f"{state_title} State Treasury",
            "to_entity": f"{district_name} District Development Agency",
            "transfer_tier": "STATE_TO_DISTRICT",
            "flow_stage": f"3. {state_title} Treasury -> {district_name} District",
            "amount": amount,
            "details": f"District Fund Sanction: {state_title} Treasury -> {district_name} District Agency for {trf.get('scheme_name')}",
            "timestamp": datetime.now(timezone.utc)
        })

    # 5. Notify District Collector
    db.notifications.insert_one({
        "recipient_role": "DISTRICT",
        "recipient_district": district_name,
        "title": "District Fund Sanction Received",
        "amount": amount,
        "message": f"District Allocation {dist_alloc_id} for {format_denomination(amount)} under '{trf.get('scheme_name')}' received.",
        "link": f"/district/projects?district_alloc_id={dist_alloc_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": f"Funds successfully allocated to {district_name} District and logged on blockchain",
        "allocation": serialize_doc(dist_doc),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.get("/allocations")
async def get_allocations(
    current_user: dict = Depends(require_roles(["STATE"]))
):
    state_code = current_user.get("state_code", "MH")
    allocations = list(db.district_allocations.find({"state_code": state_code}).sort("created_at", -1))
    return {"success": True, "allocations": serialize_doc(allocations)}
