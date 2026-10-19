import random
import string
import re
from datetime import datetime, timezone
from typing import Optional
from pymongo import ReturnDocument
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc, get_active_financial_year
from auth_middleware import require_roles
import blockchain_service as bcs
from realtime_manager import realtime_manager
import bank_account_service as bas

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
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["STATE"]))
):
    user_state_code = current_user.get("state_code")
    user_state_name = current_user.get("state_name")

    if not user_state_code:
        if current_user.get("role") == "SUPER_ADMIN":
            user_state_code = "KA"
        else:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
            )

    target_fy = None if fy == "ALL" else (fy or get_active_financial_year())

    # Strictly isolated to officer's state and financial year
    st_filter = {"state_code": user_state_code}
    da_filter = {"state_code": user_state_code}
    if target_fy:
        st_filter["financial_year"] = target_fy
        da_filter["financial_year"] = target_fy

    received_funds = list(db.state_transfers.find(st_filter).sort("created_at", -1))
    total_received = sum(f.get("amount", 0) for f in received_funds)

    district_allocations = list(db.district_allocations.find(da_filter).sort("created_at", -1))
    total_allocated_to_districts = sum(d.get("amount", 0) for d in district_allocations)

    remaining_state_balance = max(0, total_received - total_allocated_to_districts)

    dist_match = {"state_code": user_state_code}
    if target_fy:
        dist_match["financial_year"] = target_fy
    dist_pipeline = [
        {"$match": dist_match},
        {"$group": {"_id": "$district_name", "total_allocated": {"$sum": "$amount"}, "alloc_count": {"$sum": 1}}},
        {"$sort": {"total_allocated": -1}}
    ]
    district_breakdown = list(db.district_allocations.aggregate(dist_pipeline))

    current_state_title = user_state_name or (received_funds[0].get("state_name") if received_funds else f"State ({user_state_code})")

    con_query = {"state_code": user_state_code}
    pending_contractors = db.contractor_kyc.count_documents({**con_query, "kyc_status": "UNDER_REVIEW"})
    total_contractors = db.contractor_kyc.count_documents(con_query)

    return {
        "success": True,
        "state_code": user_state_code,
        "state_name": current_state_title,
        "selected_financial_year": target_fy,
        "metrics": {
            "selected_financial_year": target_fy,
            "total_funds_received": total_received,
            "total_allocated_to_districts": total_allocated_to_districts,
            "remaining_state_treasury_balance": remaining_state_balance,
            "received_transfers_count": len(received_funds),
            "district_allocations_count": len(district_allocations),
            "pending_contractors_count": pending_contractors,
            "total_contractors_count": total_contractors
        },
        "recent_received_funds": serialize_doc(received_funds[:5]),
        "district_breakdown": serialize_doc(district_breakdown)
    }

@router.get("/received-funds")
async def received_funds(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["STATE"]))
):
    user_state_code = current_user.get("state_code")
    if not user_state_code:
        if current_user.get("role") == "SUPER_ADMIN":
            user_state_code = "KA"
        else:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
            )

    st_filter = {"state_code": user_state_code}
    if fy and fy != "ALL":
        st_filter["financial_year"] = fy

    funds = list(db.state_transfers.find(st_filter).sort("created_at", -1))
    return {"success": True, "received_funds": serialize_doc(funds)}

@router.get("/districts")
async def get_districts(
    state_code: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["STATE", "SUPER_ADMIN", "DISTRICT", "FINANCE"]))
):
    user_role = current_user.get("role")
    # For state officers, force user's own state jurisdiction
    if user_role == "STATE":
        user_state = current_user.get("state_code")
    else:
        req_state_code = state_code.strip().upper() if state_code else ""
        user_state = req_state_code or current_user.get("state_code")

    query = {"state_code": user_state} if user_state else {}
    dist_list = list(db.districts.find(query).sort("name", 1))
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

    user_state_code = (current_user.get("state_code") or "").strip().upper()
    if not user_state_code and current_user.get("role") != "SUPER_ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
        )

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

    # Cross-state isolation: Officer can only allocate transfers belonging to their state
    trf_state_code = (trf.get("state_code") or "").strip().upper()
    if user_state_code and trf_state_code != user_state_code and current_user.get("role") != "SUPER_ADMIN":
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={
                "success": False,
                "message": f"Cross-state allocation forbidden. Transfer {transfer_id} belongs to state '{trf_state_code}', while your jurisdiction is '{user_state_code}'."
            }
        )

    # State-to-District relationship check: Verify target district belongs to this state
    dist_query = {
        "state_code": trf_state_code,
        "$or": [
            {"name": district_name},
            {"name": {"$regex": f"^{re.escape(district_name.strip())}$", "$options": "i"}}
        ]
    }
    dist_doc = db.districts.find_one(dist_query)
    if not dist_doc and user_state_code:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Jurisdiction error: District '{district_name}' does not belong to state '{trf_state_code}'."
            }
        )

    # Idempotency Protection: Check header or request body
    idempotency_key = request.headers.get("X-Idempotency-Key") or data.get("idempotency_key")
    if idempotency_key:
        existing_alloc = db.district_allocations.find_one({"idempotency_key": idempotency_key})
        if existing_alloc:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "success": True,
                    "message": f"Duplicate request acknowledged: district allocation {existing_alloc.get('district_alloc_id')} already processed.",
                    "allocation": serialize_doc(existing_alloc),
                    "is_duplicate": True
                }
            )

    # Atomic Reservation: Conditionally reserve amount only if allocated_to_districts + amount <= total transfer amount
    reserved_trf = db.state_transfers.find_one_and_update(
        {
            "transfer_id": transfer_id,
            "$expr": {"$lte": [{"$add": [{"$ifNull": ["$allocated_to_districts", 0.0]}, amount]}, "$amount"]}
        },
        {"$inc": {"allocated_to_districts": amount}},
        return_document=ReturnDocument.AFTER
    )

    if not reserved_trf:
        latest_trf = db.state_transfers.find_one({"transfer_id": transfer_id})
        cur_alloc = latest_trf.get("allocated_to_districts", 0.0) if latest_trf else 0.0
        tot_trf = latest_trf.get("amount", 0.0) if latest_trf else 0.0
        rem_bal = max(0.0, tot_trf - cur_alloc)
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "success": False,
                "message": f"Insufficient available balance. Requested amount (INR {amount:,.2f}) exceeds remaining state transfer balance (INR {rem_bal:,.2f})"
            }
        )

    # Resolve Authoritative Bank Accounts (Entity -> Account Mapping)
    source_account = bas.get_or_create_state_account(trf.get("state_code", user_state_code or "KA"), trf.get("state_name"))
    destination_account = bas.get_or_create_district_account(district_name, trf.get("state_code", user_state_code or "KA"))

    dist_alloc_id = generate_district_alloc_id(district_name)

    # 1. Execute On-Chain Smart Contract Function
    tx_hash = None
    block_num = None
    to_dist = bcs.get_entity_wallet("DISTRICT", district_name)
    from_state = bcs.get_entity_wallet("STATE", trf.get("state_code"))
    state_title = trf.get("state_name") or "State"

    try:
        contract = bcs.get_contract()
        if contract:
            try:
                st_rec = contract.functions.stateTransfers(transfer_id).call()
                exists = bool(st_rec[6]) if len(st_rec) > 6 else bool(st_rec[-1])
            except Exception:
                exists = False

            if not exists:
                rec_trf = bcs.record_state_transfer_onchain(
                    transfer_id,
                    trf.get("allocation_id"),
                    trf.get("state_name", "Karnataka"),
                    float(trf.get("amount", amount))
                )
                if rec_trf:
                    db.state_transfers.update_one(
                        {"transfer_id": transfer_id},
                        {"$set": {
                            "blockchain_tx_hash": rec_trf["tx_hash"],
                            "blockchain_block": rec_trf["block_number"]
                        }}
                    )

        tx_receipt = bcs.record_district_allocation_onchain(dist_alloc_id, transfer_id, district_name, amount, receiver_address=to_dist)
        if tx_receipt and tx_receipt.get("tx_hash"):
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
            from_state = tx_receipt.get("from_address", from_state)
        else:
            raise Exception("Blockchain transaction failed to return a valid transaction hash.")
    except Exception as e:
        print(f"Error executing district allocation on blockchain: {e}")
        # Roll back reservation atomically
        db.state_transfers.update_one(
            {"transfer_id": transfer_id},
            {"$inc": {"allocated_to_districts": -amount}}
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "success": False,
                "message": f"Blockchain Transaction Failed: {str(e)}. Funds were not allocated."
            }
        )

    # 2. Record District Allocation in MongoDB
    now_utc = datetime.now(timezone.utc)
    fy = trf.get("financial_year") or get_active_financial_year()
    dist_doc = {
        "district_alloc_id": dist_alloc_id,
        "idempotency_key": idempotency_key,
        "transfer_id": transfer_id,
        "financial_year": fy,
        "project_id": dist_alloc_id,
        "projectId": dist_alloc_id,
        "scheme_name": trf.get("scheme_name"),
        "department": trf.get("department"),
        "state_code": trf.get("state_code"),
        "district_name": district_name,
        "amount": amount,
        "allocated_by": current_user["name"],
        "source_account_id": source_account.get("account_id"),
        "source_bank_name": source_account.get("bank_name"),
        "source_masked_account": bas.mask_account_number(source_account.get("account_number")),
        "source_ifsc": source_account.get("ifsc"),
        "destination_account_id": destination_account.get("account_id"),
        "destination_bank_name": destination_account.get("bank_name"),
        "destination_masked_account": bas.mask_account_number(destination_account.get("account_number")),
        "destination_ifsc": destination_account.get("ifsc"),
        "sender_address": from_state,
        "senderAddress": from_state,
        "receiver_address": to_dist,
        "receiverAddress": to_dist,
        "sender_department": f"{state_title} State Treasury",
        "senderDepartment": f"{state_title} State Treasury",
        "receiver_department": f"{district_name} District Implementing Agency",
        "receiverDepartment": f"{district_name} District Implementing Agency",
        "blockchain_tx_hash": tx_hash,
        "blockchainTxHash": tx_hash,
        "blockchain_block": block_num,
        "created_at": now_utc,
        "timestamp": now_utc
    }
    db.district_allocations.insert_one(dist_doc)

    # 3. Create Authoritative Unified Financial Transaction Record
    financial_tx = bas.record_financial_transaction(
        transaction_type="STATE_TO_DISTRICT",
        source_account=source_account,
        destination_account=destination_account,
        amount=amount,
        purpose=f"State fund allocation from {state_title} Treasury to {district_name} District Agency for {trf.get('scheme_name')}",
        financial_year=fy,
        blockchain_tx_hash=tx_hash,
        blockchain_block=block_num,
        related_scheme_id=trf.get("scheme_code"),
        related_scheme_name=trf.get("scheme_name"),
        related_allocation_id=transfer_id,
        created_by=current_user["name"],
        status="COMPLETED",
        idempotency_key=idempotency_key
    )

    db.state_transfers.update_one(
        {"transfer_id": transfer_id},
        {"$set": {
            "last_allocation_at": now_utc
        }}
    )

    try:
        from audit_service import log_audit_event
        log_audit_event(
            event_type="STATE_DISTRICT_ALLOCATION_APPROVED",
            actor=current_user,
            target_id=dist_alloc_id,
            target_type="DISTRICT_ALLOCATION",
            amount=amount,
            action="ALLOCATE_TO_DISTRICT",
            status="SUCCESS",
            details=f"State allocated {amount} from transfer {transfer_id} to district {district_name}",
            blockchain_tx_hash=tx_hash,
            blockchain_block=block_num,
            financial_year=fy,
            extra_data={"transfer_id": transfer_id, "district_name": district_name, "state_code": state_code}
        )
    except Exception:
        pass


    # 5. Log to Global Blockchain Transactions Collection
    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "blockchainTxHash": tx_hash,
            "block_number": block_num,
            "operation_type": "STATE_DISTRICT_ALLOCATION",
            "entity_id": dist_alloc_id,
            "project_id": dist_alloc_id,
            "projectId": dist_alloc_id,
            "from_address": from_state,
            "senderAddress": from_state,
            "to_address": to_dist,
            "receiverAddress": to_dist,
            "from_entity": f"{state_title} State Treasury",
            "to_entity": f"{district_name} District Development Agency",
            "sender_department": f"{state_title} State Treasury",
            "senderDepartment": f"{state_title} State Treasury",
            "receiver_department": f"{district_name} District Implementing Agency",
            "receiverDepartment": f"{district_name} District Implementing Agency",
            "transfer_tier": "STATE_TO_DISTRICT",
            "flow_stage": f"3. {state_title} Treasury -> {district_name} District",
            "amount": amount,
            "details": f"District Fund Sanction: {state_title} Treasury -> {district_name} District Agency for {trf.get('scheme_name')}",
            "timestamp": now_utc
        })

    # 6. Notify District Collector
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

    # 7. Real-Time WebSocket Synchronization Broadcast
    realtime_manager.trigger_broadcast("TRANSACTION_COMPLETED", {
        "transaction_id": financial_tx["transaction_id"],
        "transaction_type": "STATE_TO_DISTRICT",
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
        "message": f"Funds successfully allocated to {district_name} District and logged on blockchain",
        "allocation": serialize_doc(dist_doc),
        "transaction": serialize_doc(financial_tx),
        "source_account": bas.serialize_bank_account(source_account),
        "destination_account": bas.serialize_bank_account(destination_account),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.get("/allocations")
async def get_allocations(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["STATE"]))
):
    state_code = current_user.get("state_code")
    if not state_code:
        if current_user.get("role") == "SUPER_ADMIN":
            state_code = "KA"
        else:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
            )
    query = {"state_code": state_code}
    if fy and fy != "ALL":
        query["financial_year"] = fy
    allocations = list(db.district_allocations.find(query).sort("created_at", -1))
    return {"success": True, "allocations": serialize_doc(allocations)}

# --- State Department Contractor Verification & Directory ---
@router.get("/contractors")
async def get_state_contractors(
    current_user: dict = Depends(require_roles(["STATE", "SUPER_ADMIN"]))
):
    user_state = (current_user.get("state_code") or "").strip().upper()
    user_state_name = current_user.get("state_name") or ""
    is_admin = current_user.get("role") == "SUPER_ADMIN"

    contractors = list(db.contractor_kyc.find().sort("created_at", -1))
    result = []

    for c in contractors:
        user = None
        uid = c.get("user_id")
        if uid and ObjectId.is_valid(str(uid)):
            user = db.users.find_one({"_id": ObjectId(uid)})
        elif uid:
            user = db.users.find_one({"email": uid}) or db.users.find_one({"user_id": uid})
        elif c.get("email"):
            user = db.users.find_one({"email": c.get("email")})

        # Resolve state_code & state_name
        c_state_code = (c.get("state_code") or (user.get("state_code") if user else None) or "").strip().upper()
        c_state_name = c.get("state_name") or (user.get("state_name") if user else None) or ""

        # Sync back to KYC document if missing
        if not c.get("state_code") and c_state_code:
            c["state_code"] = c_state_code
            c["state_name"] = c_state_name
            db.contractor_kyc.update_one({"_id": c["_id"]}, {"$set": {"state_code": c_state_code, "state_name": c_state_name}})

        if user:
            c["email"] = user.get("email", c.get("email"))
            c["contact_name"] = user.get("name", c.get("company_name"))
            c["wallet_address"] = user.get("wallet_address", c.get("wallet_address", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"))
            if not c_state_name and user.get("state_name"):
                c["state_name"] = user.get("state_name")

        docs = list(db.documents.find({"entity_id": str(uid)})) if uid else []
        c["kyc_documents"] = serialize_doc(docs)

        # Filter strictly for this state
        if is_admin or not user_state or c_state_code == user_state:
            result.append(c)

    return {
        "success": True,
        "state_code": user_state,
        "state_name": user_state_name,
        "contractors": serialize_doc(result)
    }

@router.post("/contractor/{user_id}/kyc-review")
async def review_contractor_kyc_state(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["STATE", "SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    action = data.get("action", "APPROVED").upper()
    user_state = (current_user.get("state_code") or "").strip().upper()
    user_state_name = current_user.get("state_name") or "State"
    officer_name = current_user.get("name") or "State Treasury Officer"
    default_remarks = f"Statutory registration credentials and licensing verified and {action.lower()} by {user_state_name} State Department."
    remarks = data.get("remarks") or default_remarks

    # Find the contractor KYC record
    query = {"$or": [{"user_id": str(user_id)}, {"contractor_id": str(user_id)}, {"email": str(user_id).lower()}]}
    if ObjectId.is_valid(str(user_id)):
        query["$or"].append({"_id": ObjectId(user_id)})
    
    kyc = db.contractor_kyc.find_one(query)
    
    user_query = {"$or": [{"email": str(user_id).lower()}, {"contractor_id": str(user_id)}]}
    if ObjectId.is_valid(str(user_id)):
        user_query["$or"].append({"_id": ObjectId(user_id)})
    user = db.users.find_one(user_query)

    con_state = (kyc.get("state_code") if kyc else None) or (user.get("state_code") if user else None) or ""
    if con_state and user_state and current_user.get("role") != "SUPER_ADMIN":
        if con_state.strip().upper() != user_state:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "success": False,
                    "message": f"Unauthorized: Contractor is registered in {con_state.strip().upper()}, while your jurisdiction is {user_state}. State officers may only verify contractors of their own state."
                }
            )

    update_fields = {
        "kyc_status": action,
        "verification_remarks": remarks,
        "verified_by": officer_name,
        "verification_dept": f"{user_state_name} State Department",
        "verified_state_code": user_state,
        "state_verified": (action == "APPROVED"),
        "reviewed_at": datetime.now(timezone.utc)
    }
    if con_state:
        update_fields["state_code"] = con_state.strip().upper()

    db.contractor_kyc.update_one(query, {"$set": update_fields})
    if user:
        db.users.update_one({"_id": user["_id"]}, {"$set": {
            "kyc_status": action,
            "state_verified": (action == "APPROVED"),
            "verification_remarks": remarks
        }})

    company_name = (kyc.get("company_name") if kyc else None) or (user.get("name") if user else "Contractor")

    # Send Notification to Contractor
    db.notifications.insert_one({
        "recipient_user_id": str(user["_id"]) if user else str(user_id),
        "title": f"State Department Verification: {action}",
        "message": f"Your contractor registration for {user_state_name} has been {action} by the State Department. Remarks: {remarks}",
        "link": "/contractor/kyc",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    # Trigger Realtime sync
    realtime_manager.trigger_broadcast("DATA_MUTATED", {
        "entity": "contractors",
        "action": "KYC_REVIEWED",
        "status": action,
        "user_id": str(user_id)
    })

    return {
        "success": True,
        "message": f"Contractor '{company_name}' registration successfully {action} by {user_state_name} State Department",
        "status": action
    }

