import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, status
from fastapi.responses import JSONResponse
from database import db, serialize_doc
import blockchain_service as bcs

router = APIRouter()
blockchain_bp = router

@router.get("/status")
async def get_status():
    connected = bcs.is_blockchain_connected()
    account = bcs.get_account()
    contract = bcs.get_contract()
    chain_id = None
    if connected:
        try:
            chain_id = bcs.w3.eth.chain_id
        except Exception:
            chain_id = int(os.getenv("CHAIN_ID", 5777))

    return {
        "success": True,
        "connected": connected,
        "rpc_url": bcs.RPC_URL,
        "chain_id": chain_id,
        "wallet_address": account.address if account else None,
        "contract_address": bcs.contract_address,
        "contract_deployed": contract is not None
    }

@router.get("/transactions")
async def get_transactions():
    txs = list(db.blockchain_transactions.find().sort("timestamp", -1).limit(100))
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
