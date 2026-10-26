import os
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from database import db, serialize_doc, get_active_financial_year
from auth_middleware import get_current_user
import bank_account_service as bas
import blockchain_service as bcs
from audit_service import log_audit_event, query_audit_logs
from reconciliation_service import reconcile_financial_records

router = APIRouter()

transaction_bp = router

# =========================================================================
# 1. BANK ACCOUNT MAPPING ENDPOINTS
# =========================================================================

def check_transaction_access(tx: dict, current_user: dict) -> bool:
    if not tx or not current_user:
        return False
    role = current_user.get("role")
    if role in ["SUPER_ADMIN", "FINANCE"]:
        return True
    if role == "STATE":
        sc = current_user.get("state_code", "")
        if not sc:
            return False
        return (
            tx.get("source_account_id") == f"ACC-{sc}-001" or
            tx.get("destination_account_id") == f"ACC-{sc}-001" or
            sc.lower() in str(tx.get("related_allocation_id", "")).lower() or
            sc.lower() in str(tx.get("source_entity_name", "")).lower() or
            sc.lower() in str(tx.get("destination_entity_name", "")).lower()
        )
    if role == "DISTRICT":
        dn = (current_user.get("district_name") or "").lower()
        if not dn:
            return False
        return (
            dn in str(tx.get("source_entity_name", "")).lower() or
            dn in str(tx.get("destination_entity_name", "")).lower() or
            dn in str(tx.get("source_account_id", "")).lower() or
            dn in str(tx.get("destination_account_id", "")).lower() or
            dn in str(tx.get("related_allocation_id", "")).lower()
        )
    if role == "CONTRACTOR":
        cid = str(current_user.get("contractor_id") or current_user.get("user_id") or "").lower()
        cname = str(current_user.get("name") or "").lower()
        return (
            cid in str(tx.get("destination_entity_id", "")).lower() or
            cid in str(tx.get("destination_account_id", "")).lower() or
            cname in str(tx.get("destination_entity_name", "")).lower()
        )
    return False

@router.get("/bank-accounts/central")
async def get_central_bank_account(
    current_user: dict = Depends(get_current_user)
):
    """Retrieve the registered Central Finance Treasury Bank Account (Masked)"""
    role = current_user.get("role")
    if role not in ["SUPER_ADMIN", "FINANCE", "STATE"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: Central Treasury Account access restricted to authorized administrative tiers."}
        )
    acc = bas.get_or_create_central_account()
    return {
        "success": True,
        "account": bas.serialize_bank_account(acc)
    }

@router.get("/bank-accounts/state/{state_code}")
async def get_state_bank_account(
    state_code: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve the registered State Treasury Bank Account for a given state (Masked)"""
    sc = state_code.strip().upper()
    role = current_user.get("role")
    user_state = (current_user.get("state_code") or "").upper()
    if role == "STATE" and user_state != sc:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": f"Access Denied: You are not authorized to inspect State Treasury Account of '{sc}'."}
        )
    elif role not in ["SUPER_ADMIN", "FINANCE", "STATE"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: State Treasury Account access restricted."}
        )
    acc = bas.get_or_create_state_account(sc)
    return {
        "success": True,
        "state_code": sc,
        "account": bas.serialize_bank_account(acc)
    }

@router.get("/bank-accounts/district/{district_name}")
async def get_district_bank_account(
    district_name: str,
    state_code: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """Retrieve the registered District Implementing Agency Bank Account (Masked)"""
    d_clean = district_name.strip()
    role = current_user.get("role")
    user_dist = (current_user.get("district_name") or "").lower()

    if role == "DISTRICT":
        if not user_dist or user_dist != d_clean.lower():
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": f"Access Denied: You are not authorized to inspect District Account of '{d_clean}'."}
            )
    elif role == "STATE":
        user_state = (current_user.get("state_code") or "").strip().upper()
        if not user_state:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
            )
        dist_match = db.districts.find_one({
            "state_code": user_state,
            "$or": [{"name": d_clean}, {"name": {"$regex": f"^{re.escape(d_clean)}$", "$options": "i"}}]
        })
        if not dist_match:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": f"Access Denied: District '{d_clean}' does not belong to your state jurisdiction '{user_state}'."}
            )
    elif role not in ["SUPER_ADMIN", "FINANCE"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: District Agency Account access restricted."}
        )
    acc = bas.get_or_create_district_account(d_clean, state_code=state_code)
    return {
        "success": True,
        "district_name": d_clean,
        "account": bas.serialize_bank_account(acc)
    }

@router.get("/bank-accounts/contractor/{contractor_id}")
async def get_contractor_bank_account(
    contractor_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Retrieve the registered Contractor Bank Account (Masked)"""
    c_clean = contractor_id.strip()
    role = current_user.get("role")
    c_user_id = str(current_user.get("contractor_id") or current_user.get("user_id") or "")
    if role == "CONTRACTOR" and c_clean not in [c_user_id, current_user.get("email")]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: You cannot inspect another contractor's bank account."}
        )
    acc = bas.get_or_create_contractor_account(c_clean)
    return {
        "success": True,
        "contractor_id": c_clean,
        "account": bas.serialize_bank_account(acc)
    }

@router.get("/bank-accounts/entity")
async def get_entity_bank_account(
    entity_type: str = Query(..., description="CENTRAL, STATE, DISTRICT, or CONTRACTOR"),
    identifier: Optional[str] = Query(None, description="State code, District name, or Contractor ID"),
    state_code: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user)
):
    """
    Unified lookup for any entity's registered bank account.
    Returns masked account values to protect banking secrecy.
    """
    et = entity_type.strip().upper()
    role = current_user.get("role")

    if et == "CENTRAL":
        if role not in ["SUPER_ADMIN", "FINANCE", "STATE"]:
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": "Access Denied"})
        acc = bas.get_or_create_central_account()
    elif et == "STATE":
        sc = (identifier or state_code or current_user.get("state_code") or "KA").strip().upper()
        if role == "STATE" and current_user.get("state_code", "").upper() != sc:
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": "Access Denied"})
        acc = bas.get_or_create_state_account(sc)
    elif et == "DISTRICT":
        d_name = identifier or current_user.get("district_name") or "Belagavi"
        if role == "DISTRICT" and current_user.get("district_name", "").lower() != d_name.lower():
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": "Access Denied"})
        acc = bas.get_or_create_district_account(d_name, state_code=state_code)
    elif et == "CONTRACTOR":
        cid = identifier or current_user.get("contractor_id") or current_user.get("user_id") or "CON-001"
        c_user_id = str(current_user.get("contractor_id") or current_user.get("user_id") or "")
        if role == "CONTRACTOR" and cid not in [c_user_id, current_user.get("email")]:
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"success": False, "message": "Access Denied"})
        acc = bas.get_or_create_contractor_account(cid)
    else:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Unsupported entity type: {entity_type}"}
        )

    return {
        "success": True,
        "entity_type": et,
        "account": bas.serialize_bank_account(acc)
    }

# =========================================================================
# 2. FINANCIAL TRANSACTIONS & BLOCKCHAIN TRACKING ENDPOINTS
# =========================================================================

@router.get("/transactions")
async def list_transactions(
    fy: Optional[str] = Query(None),
    transaction_type: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    allocation_id: Optional[str] = Query(None),
    transfer_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    List financial transactions with role-based filtering and masked bank details.
    """
    and_clauses = []

    if fy and fy.strip() and fy.strip() != "ALL":
        and_clauses.append({"financial_year": fy.strip()})
    if transaction_type:
        and_clauses.append({"transaction_type": transaction_type.strip().upper()})
    if project_id:
        and_clauses.append({"$or": [{"related_project_id": project_id}, {"related_allocation_id": project_id}]})
    if allocation_id:
        and_clauses.append({"related_allocation_id": allocation_id})
    if transfer_id and transfer_id.strip():
        tid = transfer_id.strip()
        and_clauses.append({"$or": [{"transfer_id": tid}, {"related_transfer_id": tid}]})

    # Role-based scoping
    role = current_user.get("role")
    if role in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        pass  # Global oversight for audit and finance
    elif role == "STATE":
        sc = (current_user.get("state_code") or "").strip().upper()
        if not sc:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No state assigned to officer profile."}
            )
        and_clauses.append({
            "$or": [
                {"source_account_id": f"ACC-{sc}-001"},
                {"destination_account_id": f"ACC-{sc}-001"},
                {"related_allocation_id": {"$regex": f"-{sc}-", "$options": "i"}},
                {"source_entity_name": {"$regex": sc, "$options": "i"}},
                {"destination_entity_name": {"$regex": sc, "$options": "i"}}
            ]
        })
    elif role == "DISTRICT":
        dn = (current_user.get("district_name") or "").strip()
        if not dn:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: No district assigned to officer profile."}
            )
        and_clauses.append({
            "$or": [
                {"source_entity_name": {"$regex": dn, "$options": "i"}},
                {"destination_entity_name": {"$regex": dn, "$options": "i"}},
                {"source_account_id": {"$regex": dn, "$options": "i"}},
                {"destination_account_id": {"$regex": dn, "$options": "i"}},
                {"related_allocation_id": {"$regex": dn, "$options": "i"}}
            ]
        })
    elif role == "CONTRACTOR":
        cid = str(current_user.get("contractor_id") or current_user.get("user_id") or "").strip()
        cname = (current_user.get("name") or "").strip()
        if not cid and not cname:
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"success": False, "message": "Access Denied: Unrecognized contractor profile."}
            )
        c_ors = []
        if cid:
            c_ors.extend([
                {"destination_entity_id": cid},
                {"destination_account_id": {"$regex": re.escape(cid), "$options": "i"}},
                {"contractor_id": cid}
            ])
        if cname:
            c_ors.append({"destination_entity_name": {"$regex": f"^{re.escape(cname)}$", "$options": "i"}})
        and_clauses.append({"$or": c_ors})
    else:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: Unauthorized role for financial transactions."}
        )

    query = {"$and": and_clauses} if and_clauses else {}
    txs = list(db.financial_transactions.find(query).sort("created_at", -1).limit(limit))
    return {
        "success": True,
        "count": len(txs),
        "transactions": serialize_doc(txs)
    }

def check_transaction_access(tx: dict, current_user: dict) -> bool:
    """
    Verify caller has permission to view the transaction based on role and jurisdiction.
    """
    role = current_user.get("role")
    if role in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        return True

    if role == "STATE":
        sc = current_user.get("state_code", "")
        if not sc:
            return False
        sc_upper = sc.upper()
        alloc_id = str(tx.get("related_allocation_id", "")).upper()
        proj_id = str(tx.get("related_project_id", "")).upper()
        src_acc = str(tx.get("source_account_id", "")).upper()
        dst_acc = str(tx.get("destination_account_id", "")).upper()
        src_ent = str(tx.get("source_entity_name", "")).upper()
        dst_ent = str(tx.get("destination_entity_name", "")).upper()

        if f"-{sc_upper}-" in alloc_id or f"-{sc_upper}-" in proj_id:
            return True
        if f"-{sc_upper}-" in src_acc or f"-{sc_upper}-" in dst_acc:
            return True
        if sc_upper in src_ent or sc_upper in dst_ent:
            return True
        return False

    if role == "DISTRICT":
        dn = current_user.get("district_name", "")
        if not dn:
            return False
        dn_lower = dn.lower()
        src_ent = str(tx.get("source_entity_name", "")).lower()
        dst_ent = str(tx.get("destination_entity_name", "")).lower()
        src_acc = str(tx.get("source_account_id", "")).lower()
        dst_acc = str(tx.get("destination_account_id", "")).lower()
        alloc_id = str(tx.get("related_allocation_id", "")).lower()

        if dn_lower in src_ent or dn_lower in dst_ent or dn_lower in src_acc or dn_lower in dst_acc or dn_lower in alloc_id:
            return True
        return False

    if role == "CONTRACTOR":
        cid = str(current_user.get("contractor_id") or current_user.get("user_id") or "")
        cname = str(current_user.get("name", "")).lower()
        dst_id = str(tx.get("destination_entity_id", ""))
        dst_acc = str(tx.get("destination_account_id", ""))
        dst_ent = str(tx.get("destination_entity_name", "")).lower()

        if (cid and (cid == dst_id or cid in dst_acc)) or (cname and cname in dst_ent):
            return True
        return False

    return False

# =========================================================================
# RECONCILIATION & AUDIT TRAILS (PHASE 5)
# =========================================================================

@router.post("/transactions/reconcile")
async def trigger_reconciliation(
    request: Request,
    current_user: dict = Depends(get_current_user)
):
    """
    Reconciles MongoDB financial records with on-chain smart contract state and transaction receipts.
    Restricted to SUPER_ADMIN, ADMIN, and FINANCE roles.
    """
    role = current_user.get("role")
    if role not in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: Financial reconciliation restricted to administrative audit authorities."}
        )

    try:
        data = await request.json()
    except Exception:
        data = {}

    financial_year = data.get("financial_year") or get_active_financial_year()
    limit = int(data.get("limit", 100))

    report = reconcile_financial_records(
        financial_year=financial_year,
        current_user=current_user,
        limit=limit
    )

    return {
        "success": True,
        "report": report
    }

@router.get("/transactions/audit-logs")
async def get_audit_trail(
    financial_year: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user)
):
    """
    Query tamper-evident audit logs enforcing role and jurisdiction isolation.
    """
    logs = query_audit_logs(
        current_user=current_user,
        financial_year=financial_year,
        target_id=target_id,
        event_type=event_type,
        limit=limit
    )
    return {
        "success": True,
        "count": len(logs),
        "audit_logs": logs
    }

def resolve_transaction_record(identifier: str) -> tuple[Optional[dict], Optional[str]]:
    """
    Safely resolves a financial transaction by:
    1. Direct authoritative transaction_id / transactionId
    2. Explicit transfer_id / related_transfer_id in financial_transactions
    3. Blockchain transaction hash
    4. Fallback lookup via state_transfers (by transfer_id) linked to financial_transactions via blockchain_tx_hash
    Returns (tx_doc, error_message).
    Detects and rejects ambiguous matches if an identifier matches multiple records.
    """
    if not identifier or not isinstance(identifier, str):
        return None, "Invalid transaction identifier"

    clean_id = identifier.strip()
    if not clean_id:
        return None, "Transaction identifier cannot be empty"

    # 1. Exact match on authoritative transaction_id / transactionId
    direct_matches = list(db.financial_transactions.find({
        "$or": [{"transaction_id": clean_id}, {"transactionId": clean_id}]
    }).limit(2))
    if len(direct_matches) == 1:
        return direct_matches[0], None
    elif len(direct_matches) > 1:
        return None, f"Ambiguous transaction ID '{clean_id}' matches multiple records"

    # 2. Check transfer_id / related_transfer_id in financial_transactions
    transfer_matches = list(db.financial_transactions.find({
        "$or": [{"transfer_id": clean_id}, {"related_transfer_id": clean_id}]
    }).limit(2))
    if len(transfer_matches) == 1:
        return transfer_matches[0], None
    elif len(transfer_matches) > 1:
        return None, f"Ambiguous transfer ID '{clean_id}' matches multiple records"

    # 3. Blockchain tx hash match (if 0x hex)
    if clean_id.startswith("0x"):
        hash_matches = list(db.financial_transactions.find({
            "$or": [{"blockchain_tx_hash": clean_id}, {"blockchain_hash": clean_id}]
        }).limit(2))
        if len(hash_matches) == 1:
            return hash_matches[0], None
        elif len(hash_matches) > 1:
            return None, f"Ambiguous blockchain hash '{clean_id}' matches multiple records"

    # 4. Fallback lookup via state_transfers (by transfer_id) linked via blockchain_tx_hash
    st_matches = list(db.state_transfers.find({"transfer_id": clean_id}).limit(2))
    if len(st_matches) == 1 and st_matches[0].get("blockchain_tx_hash"):
        st_hash = st_matches[0]["blockchain_tx_hash"]
        linked_matches = list(db.financial_transactions.find({
            "$or": [{"blockchain_tx_hash": st_hash}, {"blockchain_hash": st_hash}]
        }).limit(2))
        if len(linked_matches) == 1:
            return linked_matches[0], None
        elif len(linked_matches) > 1:
            return None, f"Ambiguous state transfer '{clean_id}' links to multiple financial records"
    elif len(st_matches) > 1:
        return None, f"Ambiguous state transfer ID '{clean_id}' matches multiple transfer records"

    return None, None

@router.get("/transactions/{transaction_id}")
async def get_transaction_details(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Retrieve single transaction record with complete blockchain verification details.
    """
    tx, err = resolve_transaction_record(transaction_id)
    if err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": err}
        )
    if not tx:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Transaction record not found"}
        )

    if not check_transaction_access(tx, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Forbidden: transaction outside your jurisdiction"}
        )

    return {
        "success": True,
        "transaction": serialize_doc(tx)
    }

@router.get("/transactions/{transaction_id}/verify")
@router.post("/transactions/{transaction_id}/verify")
async def verify_transaction_blockchain(
    transaction_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Cross-examine application transaction record with on-chain Ethereum ledger.
    Compares stored transaction parameters with on-chain block receipt and event hash.
    """
    tx, err = resolve_transaction_record(transaction_id)
    if err:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": err}
        )
    if not tx:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Transaction record not found"}
        )

    if not check_transaction_access(tx, current_user):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Forbidden: transaction outside your jurisdiction"}
        )

    tx_hash = tx.get("blockchain_tx_hash") or tx.get("blockchain_hash")
    if not tx_hash:
        return {
            "success": False,
            "verified": False,
            "is_verified": False,
            "verification_status": "MISSING_TX_HASH",
            "message": "Transaction has no associated blockchain transaction hash.",
            "transaction": serialize_doc(tx)
        }

    # Deep on-chain verification against active blockchain
    verification = bcs.verify_transaction_onchain(
        tx_hash=tx_hash,
        expected_contract=bcs.contract_address
    )

    now_utc = datetime.now(timezone.utc)
    is_verified = bool(verification.get("verified"))
    verification_status = verification.get("status")

    # If blockchain verification is disabled (cloud environment), do not mutate database or log audit failure
    if verification_status == "BLOCKCHAIN_DISABLED":
        return {
            "success": False,
            "verified": False,
            "is_verified": False,
            "verification_status": "BLOCKCHAIN_DISABLED",
            "message": verification.get("message") or "Blockchain verification is inactive on cloud environment (ENABLE_BLOCKCHAIN=false).",
            "transaction": serialize_doc(tx),
            "verification_details": verification
        }

    # Update database record only when live verification actually executed on-chain
    update_data = {
        "last_verified_at": now_utc,
        "blockchain_verification_status": verification_status,
        "blockchain_status": "VERIFIED" if is_verified else "UNVERIFIED"
    }
    if is_verified:
        update_data["blockchain_block"] = verification.get("block_number")
        update_data["blockchain_confirmations"] = verification.get("confirmations")

    db.financial_transactions.update_one(
        {"_id": tx["_id"]},
        {"$set": update_data}
    )

    # Log audit event for the verification action
    log_audit_event(
        event_type="TRANSACTION_VERIFICATION_ATTEMPT",
        actor=current_user,
        target_id=tx.get("transaction_id", transaction_id),
        target_type="FINANCIAL_TRANSACTION",
        action="VERIFY_ONCHAIN",
        status="SUCCESS" if is_verified else "FAILED",
        details=verification.get("message"),
        blockchain_tx_hash=tx_hash,
        blockchain_block=verification.get("block_number")
    )

    if not is_verified:
        return {
            "success": False,
            "verified": False,
            "is_verified": False,
            "verification_status": verification.get("status"),
            "message": verification.get("message"),
            "transaction": serialize_doc({**tx, **update_data}),
            "verification_details": verification
        }

    active_cid = verification.get("chain_id") or bcs.get_cached_chain_id() or bcs.contract_chain_id or (11155111 if bcs.is_cloud_render else 1337)
    if active_cid == 11155111:
        network_label = "Ethereum Sepolia Testnet (Chain ID: 11155111)"
    elif active_cid in (1337, 5777, 31337):
        network_label = f"Ethereum Local Devnet (Chain ID: {active_cid})"
    else:
        network_label = f"Ethereum Network (Chain ID: {active_cid})"

    return {
        "success": True,
        "verified": True,
        "is_verified": True,
        "verification_status": "VERIFIED_CONFIRMED",
        "message": verification.get("message"),
        "transaction": serialize_doc({**tx, **update_data}),
        "blockchain": {
            "network": network_label,
            "tx_hash": tx_hash,
            "block_number": verification.get("block_number"),
            "confirmations": verification.get("confirmations"),
            "from_address": verification.get("from_address"),
            "to_address": verification.get("to_address"),
            "gas_used": verification.get("gas_used"),
            "status": "VERIFIED_CONFIRMED",
            "verified_at": now_utc.isoformat(),
            "decoded_events": verification.get("decoded_events", [])
        },
        "blockchain_receipt": {
            "transaction_hash": tx_hash,
            "block_number": verification.get("block_number"),
            "status": "CONFIRMED"
        }
    }

