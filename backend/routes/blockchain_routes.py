import os
from flask import Blueprint, jsonify
from database import db, serialize_doc
import blockchain_service as bcs

blockchain_bp = Blueprint("blockchain_bp", __name__)

@blockchain_bp.route("/status", methods=["GET"])
def get_status():
    connected = bcs.is_blockchain_connected()
    account = bcs.get_account()
    contract = bcs.get_contract()
    chain_id = None
    if connected:
        try:
            chain_id = bcs.w3.eth.chain_id
        except Exception:
            chain_id = 1337

    return jsonify({
        "success": True,
        "connected": connected,
        "rpc_url": bcs.RPC_URL,
        "chain_id": chain_id,
        "wallet_address": account.address if account else None,
        "contract_address": bcs.contract_address,
        "contract_deployed": contract is not None
    })

@blockchain_bp.route("/transactions", methods=["GET"])
def get_transactions():
    txs = list(db.blockchain_transactions.find().sort("timestamp", -1).limit(100))
    return jsonify({"success": True, "transactions": serialize_doc(txs)})
