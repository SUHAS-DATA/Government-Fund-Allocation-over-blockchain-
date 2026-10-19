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
