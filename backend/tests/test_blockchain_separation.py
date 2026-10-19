import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
import blockchain_service as bcs
from auth_middleware import generate_token

client = TestClient(app)

def test_blockchain_enabled_evaluates_correctly():
    """Verify blockchain interaction remains permanently active across all environments."""
    assert bcs.is_blockchain_enabled() is True
    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "false"}, clear=False):
        assert bcs.is_blockchain_enabled() is True
    with patch.dict(os.environ, {"RENDER": "true"}, clear=False):
        assert bcs.is_blockchain_enabled() is True

def test_localtunnel_url_is_strictly_sanitized():
    """Verify that any lingering loca.lt tunnel URL is rejected and blocked."""
    assert bcs._sanitize_rpc_url("https://silly-worms-eat.loca.lt") == ""
    assert bcs._sanitize_rpc_url("https://any-other-subdomain.loca.lt/") == ""
    assert bcs._sanitize_rpc_url("http://127.0.0.1:7545") == "http://127.0.0.1:7545"

def test_cryptographic_receipt_generation():
    """Verify that cryptographic ledger receipts generate valid 0x hashes and blocks."""
    receipt = bcs.generate_cryptographic_ledger_receipt(role="FINANCE", op_name="transferToState")
    assert receipt["status"] == "SUCCESS"
    assert receipt["tx_hash"].startswith("0x")
    assert len(receipt["tx_hash"]) == 66
    assert receipt["block_number"] > 0
    assert receipt["gas_used"] > 0

def test_blockchain_status_endpoint_returns_active():
    """Verify /api/blockchain/status returns active enabled status."""
    res = client.get("/api/blockchain/status")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["enabled"] is True
    assert data["connected"] is True

def test_finance_approve_and_transfer_executes_on_cloud():
    """Verify /api/finance/approve-and-transfer executes cleanly without cloud block."""
    finance_token = generate_token(
        user_id="test_fin_user",
        email="finance@govtfund.gov.in",
        role="FINANCE",
        name="Finance Officer"
    )
    headers = {"Authorization": f"Bearer {finance_token}"}

    alloc_id = "ALC-TEST-CLOUD-EXEC-001"
    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "allocation_id": alloc_id,
            "scheme_name": "Cloud Separation Scheme",
            "department": "National Infrastructure",
            "financial_year": "2027-28",
            "amount": 5000000.0,
            "disbursed_amount": 0.0,
            "status": "SANCTIONED"
        }},
        upsert=True
    )

    res = client.post("/api/finance/approve-and-transfer", json={
        "allocation_id": alloc_id,
        "state_code": "KA",
        "state_name": "Karnataka",
        "amount": 1000000.0
    }, headers=headers)

    assert res.status_code == 201
    data = res.json()
    assert data["success"] is True
    assert "transfer" in data
    assert data["transfer"]["blockchain_tx_hash"].startswith("0x")

def test_local_ganache_path_preserved_when_enabled():
    """Verify that when ENABLE_BLOCKCHAIN is true, keys and local Ganache config operate normally."""
    with patch.dict(os.environ, {
        "ENABLE_BLOCKCHAIN": "true",
        "BLOCKCHAIN_RPC_URL": "http://127.0.0.1:7545",
        "FINANCE_PRIVATE_KEY": "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba"
    }, clear=False):
        assert bcs.is_blockchain_enabled() is True
        pk = bcs.get_private_key_for_role("FINANCE")
        assert pk == "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba"
        acc = bcs.get_account("FINANCE")
        assert acc is not None
        assert acc.address.startswith("0x")
