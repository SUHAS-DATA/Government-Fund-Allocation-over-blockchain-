import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional
from pymongo import ReturnDocument
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from database import db, serialize_doc, get_active_financial_year
from auth_middleware import require_roles
import blockchain_service as bcs
from realtime_manager import realtime_manager
import bank_account_service as bas

router = APIRouter()
finance_bp = router

def generate_transfer_id(state_code):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"TRF-ST-{state_code}-{rand_suffix}"

def format_denomination(amount):
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    
    if amt >= 10000000:
        cr_val = amt / 10000000
        val_str = f"{cr_val:.2f}".rstrip('0').rstrip('.') if not cr_val.is_integer() else f"{int(cr_val)}"
        return f"{val_str} Cr"
    elif amt >= 100000:
        lakh_val = amt / 100000
        val_str = f"{lakh_val:.2f}".rstrip('0').rstrip('.') if not lakh_val.is_integer() else f"{int(lakh_val)}"
        return f"{val_str} Lakh"
    elif amt >= 1000:
        k_val = amt / 1000
        val_str = f"{k_val:.2f}".rstrip('0').rstrip('.') if not k_val.is_integer() else f"{int(k_val)}"
        return f"{val_str} k"
    else:
        return f"₹{amt:,.2f}"

@router.get("/dashboard")
async def dashboard(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    target_fy = fy if (fy and fy != "ALL") else None
    
    pending_query = {
        "$or": [
            {"status": "SENT_TO_FINANCE"},
            {"$expr": {"$lt": ["$disbursed_amount", "$amount"]}}
        ]
    }
    if target_fy:
        pending_query["financial_year"] = target_fy
    pending_budgets = list(db.budget_allocations.find(pending_query))

    disbursed_match = {"financial_year": target_fy} if target_fy else {}
    disbursed_pipeline = [
        {"$match": disbursed_match} if disbursed_match else {"$match": {}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]
    disbursed_stats = list(db.state_transfers.aggregate(disbursed_pipeline))
    total_disbursed = disbursed_stats[0]["total"] if disbursed_stats else 0
    transfers_count = disbursed_stats[0]["count"] if disbursed_stats else 0

    state_pipeline = [
        {"$match": disbursed_match} if disbursed_match else {"$match": {}},
        {"$group": {"_id": "$state_name", "total_amount": {"$sum": "$amount"}, "transfer_count": {"$sum": 1}}},
        {"$sort": {"total_amount": -1}}
    ]
    state_breakdown = list(db.state_transfers.aggregate(state_pipeline))

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "metrics": {
            "selected_financial_year": target_fy,
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
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["FINANCE"]))
):
    query = {}
    if fy and fy != "ALL":
        query["financial_year"] = fy
    budgets = list(db.budget_allocations.find(query).sort("created_at", -1))
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
    raw_state_code = str(data.get("state_code", "")).strip().upper()
    state_name = data.get("state_name", "Maharashtra")
    amount = float(data.get("amount", 0))
    sign_off_note = data.get("sign_off_note", "Sanctioned and disbursed by Central Finance Authority.")

    if not alloc_id or amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Allocation ID and valid positive amount are required"}
        )

    if not raw_state_code:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "State code is required for treasury transfer"}
        )

    state_doc = db.states.find_one({"code": raw_state_code})
    if not state_doc:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Invalid state code '{raw_state_code}'. State does not exist in national registry."}
        )

    state_code = state_doc["code"]
    state_name = state_doc.get("name", state_name)

    alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
    if not alloc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Budget allocation not found"}
        )

    # Idempotency Protection: Check header or request body
    idempotency_key = request.headers.get("X-Idempotency-Key") or data.get("idempotency_key")
    if idempotency_key:
        existing_trf = db.state_transfers.find_one({"idempotency_key": idempotency_key})
        if existing_trf:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "message": f"Duplicate request acknowledged: state transfer {existing_trf.get('transfer_id')} already processed.",
                    "transfer": serialize_doc(existing_trf),
                    "is_duplicate": True
                }
            )

    # Atomic Reservation: Conditionally reserve amount only if disbursed_amount + amount <= total amount
    reserved_alloc = db.budget_allocations.find_one_and_update(
        {
            "allocation_id": alloc_id,
            "$expr": {"$lte": [{"$add": [{"$ifNull": ["$disbursed_amount", 0.0]}, amount]}, "$amount"]}
        },
        {"$inc": {"disbursed_amount": amount}},
        return_document=ReturnDocument.AFTER
    )

    if not reserved_alloc:
        latest = db.budget_allocations.find_one({"allocation_id": alloc_id})
        current_disbursed = latest.get("disbursed_amount", 0.0) if latest else 0.0
        tot_sanctioned = latest.get("amount", 0.0) if latest else 0.0
        rem_balance = max(0.0, tot_sanctioned - current_disbursed)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Insufficient available balance. Transfer amount (INR {amount:,.2f}) exceeds available sanctioned balance (INR {rem_balance:,.2f})"
            }
        )

    # Resolve Authoritative Bank Accounts (Entity -> Account Mapping)
    source_account = bas.get_or_create_central_account()
    destination_account = bas.get_or_create_state_account(state_code, state_name)

    trf_id = generate_transfer_id(state_code)

    # 1. Execute On-Chain Ethereum Smart Contract Transaction
    tx_hash = None
    block_num = None
    to_state = bcs.get_entity_wallet("STATE", state_code)
    from_fin = bcs.get_entity_wallet("FINANCE")

    try:
        contract = bcs.get_contract()
        if contract:
            try:
                alloc_record = contract.functions.budgetAllocations(alloc_id).call()
                exists = bool(alloc_record[6]) if len(alloc_record) > 6 else bool(alloc_record[-1])
            except Exception:
                exists = False

            if not exists:
                rec_parent = bcs.record_budget_allocation_onchain(
                    alloc_id,
                    alloc.get("scheme_name", "National Scheme"),
                    alloc.get("department", "Infrastructure"),
                    float(alloc.get("amount", amount))
                )
                if rec_parent:
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

        tx_receipt = bcs.record_state_transfer_onchain(trf_id, alloc_id, state_name, amount, receiver_address=to_state)
        if tx_receipt and tx_receipt.get("tx_hash"):
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
            from_fin = tx_receipt.get("from_address", from_fin)
        else:
            raise Exception("Blockchain transaction failed to return a valid transaction hash.")
    except Exception as e:
        print(f"Error executing state transfer on blockchain: {e}")
        # Roll back reservation atomically
        db.budget_allocations.update_one(
            {"allocation_id": alloc_id},
            {"$inc": {"disbursed_amount": -amount}}
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": f"Blockchain Transaction Failed: {str(e)}. Funds were not disbursed."
            }
        )

    # 2. Record Transfer in MongoDB
    now_utc = datetime.now(timezone.utc)
    fy = alloc.get("financial_year") or get_active_financial_year()
    transfer_doc = {
        "transfer_id": trf_id,
        "idempotency_key": idempotency_key,
        "allocation_id": alloc_id,
        "financial_year": fy,
        "project_id": alloc_id,
        "projectId": alloc_id,
        "scheme_name": alloc.get("scheme_name"),
        "department": alloc.get("department"),
        "state_code": state_code,
        "state_name": state_name,
        "amount": amount,
        "allocated_to_districts": 0.0,
        "sign_off_note": sign_off_note,
        "transferred_by": current_user["name"],
        "source_account_id": source_account.get("account_id"),
        "source_bank_name": source_account.get("bank_name"),
        "source_masked_account": bas.mask_account_number(source_account.get("account_number")),
        "source_ifsc": source_account.get("ifsc"),
        "destination_account_id": destination_account.get("account_id"),
        "destination_bank_name": destination_account.get("bank_name"),
        "destination_masked_account": bas.mask_account_number(destination_account.get("account_number")),
        "destination_ifsc": destination_account.get("ifsc"),
        "sender_address": from_fin,
        "senderAddress": from_fin,
        "receiver_address": to_state,
        "receiverAddress": to_state,
        "sender_department": "Ministry of Finance",
        "senderDepartment": "Ministry of Finance",
        "receiver_department": f"{state_name} State Treasury",
        "receiverDepartment": f"{state_name} State Treasury",
        "blockchain_tx_hash": tx_hash,
        "blockchainTxHash": tx_hash,
        "blockchain_block": block_num,
        "created_at": now_utc,
        "timestamp": now_utc
    }
    db.state_transfers.insert_one(transfer_doc)

    # 3. Create Authoritative Unified Financial Transaction Record
    financial_tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=source_account,
        destination_account=destination_account,
        amount=amount,
        purpose=sign_off_note,
        financial_year=fy,
        blockchain_tx_hash=tx_hash,
        blockchain_block=block_num,
        related_scheme_id=alloc.get("scheme_code"),
        related_scheme_name=alloc.get("scheme_name"),
        related_allocation_id=alloc_id,
        created_by=current_user["name"],
        status="COMPLETED",
        idempotency_key=idempotency_key
    )

    # 4. Finalize Budget Allocation Status
    new_disbursed = reserved_alloc.get("disbursed_amount", amount)
    total_sanctioned = reserved_alloc.get("amount", 0.0)
    status_val = "FULLY_DISBURSED" if new_disbursed >= total_sanctioned else "PARTIALLY_DISBURSED"
    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "status": status_val,
            "last_transfer_at": now_utc
        }}
    )

    try:
        from audit_service import log_audit_event
        log_audit_event(
            event_type="FINANCE_STATE_TRANSFER_APPROVED",
            actor=current_user,
            target_id=trf_id,
            target_type="STATE_TRANSFER",
            amount=amount,
            action="APPROVE_AND_TRANSFER",
            status="SUCCESS",
            details=f"Transferred {amount} to {state_name} State Treasury under {alloc.get('scheme_name')}",
            blockchain_tx_hash=tx_hash,
            blockchain_block=block_num,
            financial_year=fy,
            extra_data={"allocation_id": alloc_id, "state_code": state_code}
        )
    except Exception:
        pass


    # 5. Log to Global Blockchain Transactions Collection
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "blockchainTxHash": tx_hash,
            "block_number": block_num,
            "operation_type": "FINANCE_STATE_TRANSFER",
            "entity_id": trf_id,
            "project_id": alloc_id,
            "projectId": alloc_id,
            "from_address": from_fin,
            "senderAddress": from_fin,
            "to_address": to_state,
            "receiverAddress": to_state,
            "from_entity": "Ministry of Finance (Public Fund Authority)",
            "to_entity": f"{state_name} State Treasury",
            "sender_department": "Ministry of Finance",
            "senderDepartment": "Ministry of Finance",
            "receiver_department": f"{state_name} State Treasury",
            "receiverDepartment": f"{state_name} State Treasury",
            "transfer_tier": "FINANCE_TO_STATE",
            "flow_stage": f"2. Finance Dept -> {state_name} Treasury",
            "amount": amount,
            "details": f"State Treasury Disbursal: Finance Dept -> {state_name} Treasury for {alloc.get('scheme_name')}",
            "timestamp": now_utc
        })

    # 6. Notify State Officer
    db.notifications.insert_one({
        "recipient_role": "STATE",
        "recipient_state": state_code,
        "title": "Treasury Fund Transfer Received",
        "amount": amount,
        "message": f"Received {format_denomination(amount)} under '{alloc.get('scheme_name')}' (Transfer ID: {trf_id}). Ready for district allocation.",
        "link": f"/state/allocations?transfer_id={trf_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    # 7. Real-Time WebSocket Synchronization Broadcast
    realtime_manager.trigger_broadcast("TRANSACTION_COMPLETED", {
        "transaction_id": financial_tx["transaction_id"],
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": amount,
        "source_entity": source_account.get("account_holder_name"),
        "destination_entity": destination_account.get("account_holder_name"),
        "blockchain_tx_hash": tx_hash
    })
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "transactions",
        "action": "TRANSACTION_COMPLETED",
        "transaction_id": financial_tx["transaction_id"]
    })

    return {
        "success": True,
        "message": f"Funds successfully transferred to {state_name} Treasury and recorded on blockchain",
        "transfer": serialize_doc(transfer_doc),
        "transaction": serialize_doc(financial_tx),
        "source_account": bas.serialize_bank_account(source_account),
        "destination_account": bas.serialize_bank_account(destination_account),
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
