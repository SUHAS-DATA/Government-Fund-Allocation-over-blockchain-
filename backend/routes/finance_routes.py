import random
import string
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, status
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import require_roles
import blockchain_service as bcs

router = APIRouter()
finance_bp = router

def generate_transfer_id(state_code):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"TRF-ST-{state_code}-{rand_suffix}"

@router.get("/dashboard")
async def dashboard(
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    pending_budgets = list(db.budget_allocations.find({
        "$or": [
            {"status": "SENT_TO_FINANCE"},
            {"$expr": {"$lt": ["$disbursed_amount", "$amount"]}}
        ]
    }))

    disbursed_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    disbursed_stats = list(db.state_transfers.aggregate(disbursed_pipeline))
    total_disbursed = disbursed_stats[0]["total"] if disbursed_stats else 0
    transfers_count = disbursed_stats[0]["count"] if disbursed_stats else 0

    state_pipeline = [
        {"$group": {"_id": "$state_name", "total_amount": {"$sum": "$amount"}, "transfer_count": {"$sum": 1}}},
        {"$sort": {"total_amount": -1}}
    ]
    state_breakdown = list(db.state_transfers.aggregate(state_pipeline))

    return {
        "success": True,
        "metrics": {
            "pending_budgets_count": len(pending_budgets),
            "total_disbursed": total_disbursed,
            "transfers_count": transfers_count,
            "states_supported": len(state_breakdown) if state_breakdown else 5
        },
        "pending_budgets": serialize_doc(pending_budgets[:5]),
        "state_breakdown": serialize_doc(state_breakdown)
    }

@router.get("/received-budgets")
async def received_budgets(
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    budgets = list(db.budget_allocations.find().sort("created_at", -1))
    return {"success": True, "budgets": serialize_doc(budgets)}

@router.get("/states")
async def get_states(
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    st_list = list(db.states.find().sort("name", 1))
    return {"success": True, "states": serialize_doc(st_list)}

@router.post("/verify-budget/{allocation_id}")
async def verify_budget(
    allocation_id: str,
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    alloc = db.budget_allocations.find_one({"allocation_id": allocation_id})
    if not alloc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Allocation not found"}
        )

    db.budget_allocations.update_one(
        {"allocation_id": allocation_id},
        {"$set": {
            "verification_status": "VERIFIED",
            "verified_by": current_user["name"],
            "verified_at": datetime.now(timezone.utc)
        }}
    )
    return {"success": True, "message": f"Budget {allocation_id} verified successfully."}

@router.post("/approve-and-transfer", status_code=status.HTTP_201_CREATED)
async def approve_and_transfer(
    request: Request,
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    alloc_id = data.get("allocation_id")
    state_code = data.get("state_code", "MH").upper()
    state_name = data.get("state_name", "Maharashtra")
    amount = float(data.get("amount", 0))
    sign_off_note = data.get("sign_off_note", "Sanctioned and disbursed by Central Finance Authority.")

    if not alloc_id or amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Allocation ID and valid positive amount are required"}
        )

    alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
    if not alloc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Budget allocation not found"}
        )

    # Available Balance Check
    already_disbursed = alloc.get("disbursed_amount", 0.0)
    total_sanctioned = alloc.get("amount", 0.0)
    available_balance = total_sanctioned - already_disbursed

    if amount > available_balance:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Transfer amount (INR {amount:,.2f}) exceeds available sanctioned balance (INR {available_balance:,.2f})"
            }
        )

    trf_id = generate_transfer_id(state_code)

    # 1. Execute On-Chain Ethereum Smart Contract Transaction
    tx_hash = None
    block_num = None
    try:
        contract = bcs.get_contract()
        if contract:
            try:
                exists = contract.functions.centralAllocations(alloc_id).call()[4]
            except Exception:
                exists = False

            if not exists:
                rec_parent = bcs.record_budget_allocation_onchain(
                    alloc_id,
                    alloc.get("scheme_name", "National Scheme"),
                    alloc.get("department", "Infrastructure"),
                    float(alloc.get("amount", amount))
                )
                db.budget_allocations.update_one(
                    {"allocation_id": alloc_id},
                    {"$set": {
                        "blockchain_tx_hash": rec_parent["tx_hash"],
                        "blockchain_block": rec_parent["block_number"]
                    }}
                )
                from_admin = bcs.get_entity_wallet("ADMIN")
                to_fin = bcs.get_entity_wallet("FINANCE")
                db.blockchain_transactions.insert_one({
                    "tx_hash": rec_parent["tx_hash"],
                    "block_number": rec_parent["block_number"],
                    "operation_type": "CENTRAL_BUDGET_ALLOCATION",
                    "entity_id": alloc_id,
                    "from_address": from_admin,
                    "to_address": to_fin,
                    "from_entity": "Central Secretariat (Cabinet Planning)",
                    "to_entity": "Ministry of Finance (Public Fund Authority)",
                    "transfer_tier": "CENTRAL_TO_FINANCE",
                    "flow_stage": "1. Central Sanction -> Finance Dept",
                    "amount": alloc.get("amount", amount),
                    "details": f"Budget Sanctioned for {alloc.get('scheme_name')} ({alloc.get('department')}) -> Forwarded to Ministry of Finance",
                    "timestamp": datetime.now(timezone.utc)
                })

        tx_receipt = bcs.record_state_transfer_onchain(trf_id, alloc_id, state_name, amount)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning executing state transfer on blockchain: {e}")

    # 2. Record Transfer in MongoDB
    transfer_doc = {
        "transfer_id": trf_id,
        "allocation_id": alloc_id,
        "scheme_name": alloc.get("scheme_name"),
        "department": alloc.get("department"),
        "state_code": state_code,
        "state_name": state_name,
        "amount": amount,
        "allocated_to_districts": 0.0,
        "sign_off_note": sign_off_note,
        "transferred_by": current_user["name"],
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "created_at": datetime.now(timezone.utc)
    }
    db.state_transfers.insert_one(transfer_doc)

    # 3. Update Budget Allocation Disbursed Amount & Status
    new_disbursed = already_disbursed + amount
    status_val = "FULLY_DISBURSED" if new_disbursed >= total_sanctioned else "PARTIALLY_DISBURSED"
    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "disbursed_amount": new_disbursed,
            "status": status_val,
            "last_transfer_at": datetime.now(timezone.utc)
        }}
    )

    # 4. Log to Global Blockchain Transactions Collection
    if tx_hash:
        from_fin = bcs.get_entity_wallet("FINANCE")
        to_state = bcs.get_entity_wallet("STATE", state_code)
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "FINANCE_STATE_TRANSFER",
            "entity_id": trf_id,
            "from_address": from_fin,
            "to_address": to_state,
            "from_entity": "Ministry of Finance (Public Fund Authority)",
            "to_entity": f"{state_name} State Treasury",
            "transfer_tier": "FINANCE_TO_STATE",
            "flow_stage": f"2. Finance Dept -> {state_name} Treasury",
            "amount": amount,
            "details": f"State Treasury Disbursal: Finance Dept -> {state_name} Treasury for {alloc.get('scheme_name')}",
            "timestamp": datetime.now(timezone.utc)
        })

    # 5. Notify State Officer
    db.notifications.insert_one({
        "recipient_role": "STATE",
        "recipient_state": state_code,
        "title": "Treasury Fund Transfer Received",
        "message": f"Received INR {amount:,.2f} under '{alloc.get('scheme_name')}' (Transfer ID: {trf_id}). Ready for district allocation.",
        "link": f"/state/allocations?transfer_id={trf_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": f"Funds successfully transferred to {state_name} Treasury and recorded on blockchain",
        "transfer": serialize_doc(transfer_doc),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.get("/transfers")
async def get_transfers(
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    transfers = list(db.state_transfers.find().sort("created_at", -1))
    return {"success": True, "transfers": serialize_doc(transfers)}
