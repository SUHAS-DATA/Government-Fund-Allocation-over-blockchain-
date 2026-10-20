import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
import blockchain_service as bcs

client = TestClient(app)

def test_verification_disabled_when_flag_off():
    """Verify that when ENABLE_BLOCKCHAIN is false, verification returns BLOCKCHAIN_DISABLED without fabricated success."""
    with patch.object(bcs, "is_blockchain_enabled", return_value=False):
        res = bcs.verify_transaction_onchain("0x102f7b9ecca83cb6ba811d7a8e7a688b1b8b7e9a46860c68c9336c88c165b1da")
        assert res["verified"] is False
        assert res["status"] == "BLOCKCHAIN_DISABLED"
        assert "inactive" in res["message"].lower() or "disabled" in res["message"].lower()

def test_verification_fails_when_rpc_unreachable():
    """Verify that when RPC is disconnected, verification returns RPC_DISCONNECTED without falling back to MongoDB."""
    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "is_blockchain_connected", return_value=False):
        res = bcs.verify_transaction_onchain("0x102f7b9ecca83cb6ba811d7a8e7a688b1b8b7e9a46860c68c9336c88c165b1da")
        assert res["verified"] is False
        assert res["status"] == "RPC_DISCONNECTED"
        assert "unreachable" in res["message"].lower()

def test_verification_fails_when_contract_bytecode_missing():
    """Verify that if contract address has no bytecode on chain, verification fails with CONTRACT_NOT_DEPLOYED."""
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.to_checksum_address.side_effect = lambda a: a
    # Empty bytecode (0x or 0x0)
    mock_w3.eth.get_code.return_value = b""

    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs, "w3", mock_w3):
        res = bcs.verify_transaction_onchain(
            tx_hash="0x102f7b9ecca83cb6ba811d7a8e7a688b1b8b7e9a46860c68c9336c88c165b1da",
            expected_contract="0x0000000000000000000000000000000000000001"
        )
        assert res["verified"] is False
        assert res["status"] == "CONTRACT_NOT_DEPLOYED"
        assert "no smart contract bytecode" in res["message"].lower()

def test_diagnostics_reports_unreachable_truthfully():
    """Verify that get_blockchain_diagnostics reports DEGRADED and connected=False when RPC is offline."""
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = False

    with patch.object(bcs, "is_blockchain_connected", return_value=False), \
         patch.dict(os.environ, {"APP_ENV": "production", "RPC_URL": "https://fake-sepolia.rpc.io"}):
        diag = bcs.get_blockchain_diagnostics()
        assert diag["connected"] is False
        assert diag["status"] == "DEGRADED"
        assert any("unreachable" in w.lower() for w in diag["warnings"])

def test_production_loopback_rpc_generates_security_warning():
    """Verify that when running in production with 127.0.0.1, diagnostics issues a clear warning."""
    with patch.dict(os.environ, {"APP_ENV": "production", "RPC_URL": "http://127.0.0.1:7545"}):
        with patch.object(bcs, "RPC_URL", "http://127.0.0.1:7545"), \
             patch.object(bcs, "is_blockchain_connected", return_value=False):
            diag = bcs.get_blockchain_diagnostics()
            assert any("loopback" in w.lower() for w in diag["warnings"])

def test_status_endpoint_never_claims_fake_deployed_contract():
    """Verify /api/blockchain/status does not claim contract_deployed=True when disconnected."""
    with patch.object(bcs, "is_blockchain_connected", return_value=False):
        res = client.get("/api/blockchain/status")
        assert res.status_code == 200
        data = res.json()
        assert data["connected"] is False
        assert data["contract_deployed"] is False


def test_hosted_mode_rejects_loopback_rpc():
    """Verify that hosted environments reject loopback/Ganache RPC endpoints."""
    with patch.object(bcs, "is_hosted_environment", return_value=True):
        assert bcs._sanitize_rpc_url("http://127.0.0.1:7545") == ""
        assert bcs._sanitize_rpc_url("http://localhost:8545") == ""
        assert bcs._sanitize_rpc_url("https://sepolia.infura.io/v3/test-key") == "https://sepolia.infura.io/v3/test-key"

    with patch.object(bcs, "is_hosted_environment", return_value=False):
        assert bcs._sanitize_rpc_url("http://127.0.0.1:7545") == "http://127.0.0.1:7545"


def test_hosted_mode_forbids_silent_fallback_on_tx_failure():
    """Verify that in hosted mode, failed contract transaction broadcasts raise exceptions instead of returning mock receipts."""
    mock_func = MagicMock()
    mock_func.estimate_gas.return_value = 100000

    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.get_transaction_count.return_value = 1
    mock_w3.eth.gas_price = 20000000000
    mock_w3.eth.send_raw_transaction.side_effect = Exception("Sepolia RPC timeout or error")

    mock_account = MagicMock()
    mock_account.address = "0x9D11c4A30D1c5b1a4d597F0b81b9b02bCf6517f5"

    # Hosted mode: Must raise Exception, never silent fallback
    with patch.object(bcs, "is_cloud_render", True), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "get_account", return_value=mock_account), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "1" * 64):
        with pytest.raises(Exception, match="Hosted blockchain transaction failed on Sepolia"):
            bcs.execute_contract_transaction(mock_func, role="FINANCE")

    # Local mode: Falls back to local dev cryptographic ledger receipt
    with patch.object(bcs, "is_cloud_render", False), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "get_account", return_value=mock_account), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "1" * 64):
        res = bcs.execute_contract_transaction(mock_func, role="FINANCE")
        assert res is not None
        assert res.get("status") == "SUCCESS"


def test_hosted_mode_fund_operations_fail_when_disconnected():
    """Verify financial operations raise an exception when disconnected in hosted mode, rather than generating mock receipts."""
    with patch.object(bcs, "is_cloud_render", True), \
         patch.object(bcs, "is_blockchain_connected", return_value=False), \
         patch.object(bcs, "get_contract", return_value=None):
        with pytest.raises(Exception, match="Cannot record budget allocation"):
            bcs.record_budget_allocation_onchain("ALLOC-001", "Scheme", "Dept", 100000)

        with pytest.raises(Exception, match="Cannot record state transfer"):
            bcs.record_state_transfer_onchain("TRF-001", "ALLOC-001", "Maharashtra", 50000)

        with pytest.raises(Exception, match="Cannot record district allocation"):
            bcs.record_district_allocation_onchain("DIST-001", "TRF-001", "Pune", 25000)


def test_hosted_mode_rejects_ganache_tx_chain_id():
    """Verify that verify_transaction_onchain rejects chain ID 1337/5777 when in hosted mode."""
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.to_checksum_address.side_effect = lambda a: a
    mock_w3.eth.get_code.return_value = b"contract_code"
    mock_w3.eth.get_transaction.return_value = {
        "hash": b"123",
        "from": "0x9D11c4A30D1c5b1a4d597F0b81b9b02bCf6517f5",
        "to": "0x103cdC78636491B20deadC5574755Bbd64B119c6",
        "value": 0,
        "input": b"",
        "blockNumber": 12345,
        "chainId": 1337  # Ganache chain ID
    }
    mock_receipt = MagicMock()
    mock_receipt.status = 1
    mock_receipt.blockNumber = 12345
    mock_receipt.gasUsed = 50000
    mock_receipt.logs = []
    mock_w3.eth.get_transaction_receipt.return_value = mock_receipt

    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs, "is_contract_deployed", return_value=True), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "contract_address", "0x103cdC78636491B20deadC5574755Bbd64B119c6"):
        # Hosted mode: chain ID mismatch is flagged
        with patch.object(bcs, "is_cloud_render", True), \
             patch.object(bcs, "contract_chain_id", 11155111):
            res = bcs.verify_transaction_onchain("0x" + "ab" * 32)
            assert res["verified"] is False
            assert res["status"] == "CHAIN_ID_MISMATCH"

        # Local mode: Ganache compatibility (1337/5777) is accepted
        with patch.object(bcs, "is_cloud_render", False), \
             patch.object(bcs, "contract_chain_id", 1337):
            res = bcs.verify_transaction_onchain("0x" + "ab" * 32)
            assert res["verified"] is True
