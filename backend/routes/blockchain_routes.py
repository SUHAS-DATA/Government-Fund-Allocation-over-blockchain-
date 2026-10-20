import os
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Query, status
from fastapi.responses import JSONResponse
from database import db, serialize_doc
import blockchain_service as bcs

router = APIRouter()
blockchain_bp = router

@router.get("/status")
async def get_status():
    enabled = bcs.is_blockchain_enabled()
    connected = bcs.is_blockchain_connected(force_refresh=False) if enabled else False
    account = bcs.get_account() if enabled else None
    contract = bcs.get_contract() if enabled else None
    default_cid = bcs.contract_chain_id or (11155111 if bcs.is_cloud_render else 1337)
    if connected:
        chain_id = bcs.get_cached_chain_id(force_refresh=False) or (int(os.getenv("CHAIN_ID")) if os.getenv("CHAIN_ID") else default_cid)
    else:
        chain_id = int(os.getenv("CHAIN_ID")) if os.getenv("CHAIN_ID") else default_cid

    contract_deployed = False
    if connected and contract and bcs.contract_address:
        contract_deployed = bcs.is_contract_deployed(bcs.contract_address, force_refresh=False)

    return {
        "success": True,
        "enabled": enabled,
        "connected": connected,
        "rpc_url": bcs.mask_rpc_url(bcs.RPC_URL) if bcs.RPC_URL else "NOT_CONFIGURED",
        "chain_id": chain_id,
        "wallet_address": (account.address if account else None) or bcs.FINANCE_ADDR,
        "contract_address": bcs.contract_address or "NOT_CONFIGURED",
        "contract_deployed": contract_deployed
    }


@router.get("/transactions")
async def get_transactions(fy: Optional[str] = Query(None)):
    query = {}
    if fy and fy.strip() and fy.strip() != "ALL":
        query["financial_year"] = fy.strip()
    txs = list(db.blockchain_transactions.find(query).sort("timestamp", -1).limit(100))
    return {"success": True, "transactions": serialize_doc(txs)}

@router.post("/verify-document")
async def verify_document(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    doc_hash = data.get("doc_hash", "").strip()
    doc_id = data.get("document_id")

    doc = None
    if doc_id:
        doc = db.documents.find_one({"document_id": doc_id})
    elif doc_hash:
        doc = db.documents.find_one({"sha256_hash": doc_hash})

    if not doc and not doc_hash:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Document record or SHA-256 hash not found"}
        )

    target_hash = doc.get("sha256_hash") if doc else doc_hash
    recomputed_hash = target_hash
    file_exists = False

    if doc and "file_path" in doc and os.path.exists(doc["file_path"]):
        file_exists = True
        recomputed_hash = bcs.calculate_sha256(doc["file_path"])

    is_verified = (recomputed_hash.lower() == target_hash.lower())

    return {
        "success": True,
        "is_verified": is_verified,
        "document_id": doc.get("document_id") if doc else doc_id,
        "file_name": doc.get("file_name", "Document") if doc else "Document",
        "doc_type": doc.get("doc_type", "OFF_CHAIN_FILE") if doc else "OFF_CHAIN_FILE",
        "sha256_hash": target_hash,
        "recomputed_hash": recomputed_hash,
        "file_exists_on_disk": file_exists,
        "blockchain_tx_hash": doc.get("blockchain_tx_hash") if doc else None,
        "verification_timestamp": datetime.now(timezone.utc).isoformat()
    }

# =========================================================================
# ADVANCED TRANSACTION VERIFICATION & AUDIT APIS (PHASE 5)
# =========================================================================

@router.get("/verify-transaction/{tx_hash}")
async def verify_transaction_endpoint(tx_hash: str):
    """
    Publicly cross-examines any transaction hash against the active blockchain ledger:
    - Verifies RPC node connection.
    - Validates target contract address, sender, block receipt status, confirmations, and events.
    - Prevents fabricated or unverified success reporting.
    """
    result = bcs.verify_transaction_onchain(
        tx_hash=tx_hash,
        expected_contract=bcs.contract_address
    )
    if not result.get("verified"):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST if result.get("status") in ["INVALID_TX_HASH", "NOT_FOUND_ON_CHAIN", "REVERTED_ON_CHAIN"] else status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"success": False, **result}
        )
    return {"success": True, **result}

@router.get("/contract-state/{entity_type}/{entity_id}")
async def get_contract_state_endpoint(entity_type: str, entity_id: str):
    """
    Directly query smart contract storage mappings on-chain:
    - entity_type: 'budget_allocation', 'state_transfer', 'district_allocation', 'project_escrow', 'fund_transfer'
    """
    etype = entity_type.strip().lower()
    data = None
    if etype in ["budget_allocation", "allocation"]:
        data = bcs.get_onchain_budget_allocation(entity_id)
    elif etype in ["state_transfer", "transfer"]:
        data = bcs.get_onchain_state_transfer(entity_id)
    elif etype in ["district_allocation", "district_alloc"]:
        data = bcs.get_onchain_district_allocation(entity_id)
    elif etype in ["project_escrow", "project"]:
        data = bcs.get_onchain_project_escrow(entity_id)
    elif etype in ["fund_transfer", "transfer_record"]:
        data = bcs.get_onchain_fund_transfer_record(entity_id)
    else:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": f"Unsupported entity type: '{entity_type}'"}
        )

    if not data or not data.get("exists", True):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": f"No on-chain record found for '{entity_type}:{entity_id}'"}
        )

    return {
        "success": True,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "contract_address": bcs.contract_address,
        "onchain_data": data
    }

