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
    """Verify ENABLE_BLOCKCHAIN flag parsing and cloud fallback behavior."""
    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "false"}, clear=False):
        assert bcs.is_blockchain_enabled() is False

    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "0"}, clear=False):
        assert bcs.is_blockchain_enabled() is False

    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "off"}, clear=False):
        assert bcs.is_blockchain_enabled() is False

    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "true"}, clear=False):
        assert bcs.is_blockchain_enabled() is True

    with patch.dict(os.environ, {"ENABLE_BLOCKCHAIN": "1"}, clear=False):
        assert bcs.is_blockchain_enabled() is True

    # Cloud fallback when ENABLE_BLOCKCHAIN is not set
    with patch.dict(os.environ, {"RENDER": "true"}, clear=False):
        os.environ.pop("ENABLE_BLOCKCHAIN", None)
        assert bcs.is_blockchain_enabled() is False

def test_localtunnel_url_is_strictly_sanitized():
    """Verify that any lingering loca.lt tunnel URL is rejected and blocked."""
    assert bcs._sanitize_rpc_url("https://silly-worms-eat.loca.lt") == ""
    assert bcs._sanitize_rpc_url("https://any-other-subdomain.loca.lt/") == ""
    assert bcs._sanitize_rpc_url("http://127.0.0.1:7545") == "http://127.0.0.1:7545"

def test_blockchain_disabled_blocks_keys_and_rpc():
    """Verify that when blockchain is disabled, no signing keys or contracts are loaded."""
    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        assert bcs.is_blockchain_connected() is False
        assert bcs.get_private_key_for_role("FINANCE") is None
        assert bcs.get_private_key_for_role("STATE") is None
        assert bcs.get_private_key_for_role("DISTRICT") is None
        assert bcs.get_private_key_for_role("SUPER_ADMIN") is None
        assert bcs.get_account("FINANCE") is None
        assert bcs.get_contract() is None

        # Diagnostics must report clean healthy status without hanging
        diag = bcs.get_blockchain_diagnostics()
        assert diag["connected"] is False
        assert diag["rpc_url"] == "BLOCKCHAIN_DISABLED"
        assert diag["status"] == "HEALTHY"

def test_execute_contract_transaction_raises_when_disabled():
    """Verify execute_contract_transaction strictly prevents transaction submission when disabled."""
    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        with pytest.raises(Exception) as exc_info:
            bcs.execute_contract_transaction(MagicMock(), role="FINANCE")
        assert "Cloud blockchain transactions are disabled" in str(exc_info.value)

def test_verify_transaction_onchain_when_disabled():
    """Verify verify_transaction_onchain reports BLOCKCHAIN_DISABLED status without network calls."""
    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        result = bcs.verify_transaction_onchain("0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef")
        assert result["verified"] is False
        assert result["status"] == "BLOCKCHAIN_DISABLED"

def test_blockchain_status_endpoint_when_disabled():
    """Verify /api/blockchain/status returns enabled=False and clean metadata."""
    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        res = client.get("/api/blockchain/status")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["enabled"] is False
        assert data["connected"] is False
        assert data["rpc_url"] == "BLOCKCHAIN_DISABLED"
        assert data["wallet_address"] is None

def test_finance_approve_and_transfer_blocked_on_cloud():
    """Verify /api/finance/approve-and-transfer is blocked with clear error and NO state change."""
    finance_token = generate_token(
        user_id="test_fin_user",
        email="finance@govtfund.gov.in",
        role="FINANCE",
        name="Finance Officer"
    )
    headers = {"Authorization": f"Bearer {finance_token}"}

    # Setup a mock budget allocation
    alloc_id = "ALC-TEST-CLOUD-BLOCK-001"
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

    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        res = client.post("/api/finance/approve-and-transfer", json={
            "allocation_id": alloc_id,
            "state_code": "KA",
            "state_name": "Karnataka",
            "amount": 1000000.0
        }, headers=headers)

        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "Cloud blockchain transfers are disabled" in data["message"]

        # CRITICAL: Verify disbursed_amount was NOT incremented and no transfer was recorded
        alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
        assert alloc["disbursed_amount"] == 0.0

def test_state_allocate_to_district_blocked_on_cloud():
    """Verify /api/state/allocate-to-district is blocked with clear error and NO state change."""
    state_token = generate_token(
        user_id="test_state_user",
        email="karnataka@govtfund.gov.in",
        role="STATE",
        name="State Officer",
        state_code="KA"
    )
    headers = {"Authorization": f"Bearer {state_token}"}

    trf_id = "TRF-TEST-CLOUD-BLOCK-001"
    db.state_transfers.update_one(
        {"transfer_id": trf_id},
        {"$set": {
            "transfer_id": trf_id,
            "state_code": "KA",
            "state_name": "Karnataka",
            "amount": 2000000.0,
            "allocated_to_districts": 0.0
        }},
        upsert=True
    )

    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        res = client.post("/api/state/allocate-to-district", json={
            "transfer_id": trf_id,
            "district_name": "Belagavi",
            "amount": 500000.0
        }, headers=headers)

        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "Cloud blockchain transfers are disabled" in data["message"]

        # CRITICAL: Verify allocated_to_districts was NOT incremented
        trf = db.state_transfers.find_one({"transfer_id": trf_id})
        assert trf["allocated_to_districts"] == 0.0

def test_district_contractor_transfer_blocked_on_cloud():
    """Verify /api/district/contractor-transfer is blocked with clear error and NO state change."""
    district_token = generate_token(
        user_id="test_dist_user",
        email="district@govtfund.gov.in",
        role="DISTRICT",
        name="District Officer",
        district_name="Belagavi",
        state_code="KA"
    )
    headers = {"Authorization": f"Bearer {district_token}"}

    proj_id = "PRJ-TEST-CLOUD-BLOCK-001"
    db.projects.update_one(
        {"project_id": proj_id},
        {"$set": {
            "project_id": proj_id,
            "district_name": "Belagavi",
            "state_code": "KA",
            "total_budget": 1000000.0,
            "released_amount": 0.0
        }},
        upsert=True
    )

    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        res = client.post("/api/district/transfer-to-contractor", json={
            "project_id": proj_id,
            "amount": 200000.0,
            "contractor_name": "Apex Infrastructure"
        }, headers=headers)

        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "Cloud blockchain transfers are disabled" in data["message"]

        # CRITICAL: Verify released_amount was NOT incremented
        proj = db.projects.find_one({"project_id": proj_id})
        assert proj["released_amount"] == 0.0

def test_admin_allocate_budget_blocked_on_cloud():
    """Verify /api/admin/budget/allocate is blocked with clear error."""
    admin_token = generate_token(
        user_id="test_admin_user",
        email="admin@govtfund.gov.in",
        role="SUPER_ADMIN",
        name="Admin Officer"
    )
    headers = {"Authorization": f"Bearer {admin_token}"}

    with patch("blockchain_service.is_blockchain_enabled", return_value=False):
        res = client.post("/api/admin/budget/allocate", json={
            "financial_year": "2027-28",
            "department": "National Infrastructure",
            "scheme_name": "Pradhan Mantri Gram Sadak Yojana (PMGSY)",
            "amount": 1000000.0
        }, headers=headers)

        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert "Cloud blockchain transfers are disabled" in data["message"]

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
