import os
import sys
import uuid
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token
import blockchain_service as bcs

client = TestClient(app)

def get_auth_headers(role: str = "FINANCE"):
    token = generate_token(
        user_id=f"test-{role.lower()}-{uuid.uuid4().hex[:6]}",
        email=f"{role.lower()}@govtfund.test",
        role=role,
        name=f"Test {role} Officer"
    )
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def clean_test_transactions():
    """Clean up test transactions created during tests."""
    created_ids = []
    yield created_ids
    for tx_id in created_ids:
        db.financial_transactions.delete_many({"transaction_id": tx_id})
        db.audit_logs.delete_many({"target_id": tx_id})

def test_cloud_blockchain_disabled_verification_returns_disabled_and_no_db_mutation(clean_test_transactions):
    """
    When cloud blockchain verification is disabled (ENABLE_BLOCKCHAIN=false):
    - /transactions/{id}/verify reports verified=False and verification_status=BLOCKCHAIN_DISABLED
    - The database document is NOT modified (retains original blockchain_status)
    - No failure audit log corrupts the record
    """
    tx_id = f"TX-TEST-VERIFY-DIS-{uuid.uuid4().hex[:6]}"
    clean_test_transactions.append(tx_id)

    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": 10000000.0,
        "source_entity_id": "CENTRAL-FINANCE",
        "destination_entity_id": "STATE-MH",
        "blockchain_tx_hash": "0x" + uuid.uuid4().hex + uuid.uuid4().hex,
        "blockchain_status": "VERIFIED",
        "blockchain_block": 250,
        "status": "COMPLETED"
    })

    headers = get_auth_headers("FINANCE")

    with patch.object(bcs, "is_blockchain_enabled", return_value=False):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # Verification attempt must strictly report false
        assert data["success"] is False
        assert data["verified"] is False
        assert data["is_verified"] is False
        assert data["verification_status"] == "BLOCKCHAIN_DISABLED"
        assert "inactive on cloud environment" in data["message"]

        # Confirm DB document was NOT modified
        doc = db.financial_transactions.find_one({"transaction_id": tx_id})
        assert doc["blockchain_status"] == "VERIFIED"
        assert doc["blockchain_block"] == 250
        assert "last_verified_at" not in doc or doc.get("blockchain_verification_status") != "BLOCKCHAIN_DISABLED"

def test_blockchain_verification_succeeds_locally(clean_test_transactions):
    """
    When blockchain is enabled and on-chain verification confirms receipt status == 1:
    - /transactions/{id}/verify returns verified=True and VERIFIED_CONFIRMED
    - The database record is updated with confirmed block number
    """
    tx_id = f"TX-TEST-VERIFY-OK-{uuid.uuid4().hex[:6]}"
    clean_test_transactions.append(tx_id)

    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": 5000000.0,
        "source_entity_id": "CENTRAL-FINANCE",
        "destination_entity_id": "STATE-KA",
        "blockchain_tx_hash": tx_hash,
        "blockchain_status": "UNVERIFIED",
        "status": "COMPLETED"
    })

    mock_verification = {
        "verified": True,
        "status": "VERIFIED_SUCCESS",
        "message": "Transaction receipt verified on active blockchain ledger.",
        "block_number": 404,
        "confirmations": 15,
        "from_address": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to_address": bcs.contract_address,
        "gas_used": 60000
    }

    headers = get_auth_headers("FINANCE")

    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "verify_transaction_onchain", return_value=mock_verification):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["success"] is True
        assert data["verified"] is True
        assert data["is_verified"] is True
        assert data["verification_status"] == "VERIFIED_CONFIRMED"
        assert data["blockchain"]["block_number"] == 404

        # Verify DB updated
        doc = db.financial_transactions.find_one({"transaction_id": tx_id})
        assert doc["blockchain_status"] == "VERIFIED"
        assert doc["blockchain_block"] == 404

def test_blockchain_verification_fails_when_rpc_unavailable(clean_test_transactions):
    """
    When blockchain RPC is unreachable:
    - /transactions/{id}/verify returns verified=False and RPC_DISCONNECTED
    - Does NOT fabricate success
    """
    tx_id = f"TX-TEST-VERIFY-RPC-{uuid.uuid4().hex[:6]}"
    clean_test_transactions.append(tx_id)

    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": 7500000.0,
        "source_entity_id": "CENTRAL-FINANCE",
        "destination_entity_id": "STATE-GJ",
        "blockchain_tx_hash": tx_hash,
        "blockchain_status": "UNVERIFIED",
        "status": "COMPLETED"
    })

    mock_verification = {
        "verified": False,
        "status": "RPC_DISCONNECTED",
        "message": "Blockchain RPC node is unreachable. Cannot verify on-chain state."
    }

    headers = get_auth_headers("FINANCE")

    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "verify_transaction_onchain", return_value=mock_verification):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["success"] is False
        assert data["verified"] is False
        assert data["is_verified"] is False
        assert data["verification_status"] == "RPC_DISCONNECTED"
        assert "unreachable" in data["message"].lower()

def test_blockchain_verification_fails_when_reverted_on_chain(clean_test_transactions):
    """
    When transaction receipt status == 0 (reverted):
    - /transactions/{id}/verify reports verified=False and REVERTED_ON_CHAIN
    - DB record is marked UNVERIFIED
    """
    tx_id = f"TX-TEST-VERIFY-REV-{uuid.uuid4().hex[:6]}"
    clean_test_transactions.append(tx_id)

    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": 3000000.0,
        "source_entity_id": "CENTRAL-FINANCE",
        "destination_entity_id": "STATE-TN",
        "blockchain_tx_hash": tx_hash,
        "blockchain_status": "UNVERIFIED",
        "status": "COMPLETED"
    })

    mock_verification = {
        "verified": False,
        "status": "REVERTED_ON_CHAIN",
        "message": "Transaction mined but execution reverted with status 0."
    }

    headers = get_auth_headers("FINANCE")

    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(bcs, "verify_transaction_onchain", return_value=mock_verification):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()

        assert data["success"] is False
        assert data["verified"] is False
        assert data["is_verified"] is False
        assert data["verification_status"] == "REVERTED_ON_CHAIN"

        doc = db.financial_transactions.find_one({"transaction_id": tx_id})
        assert doc["blockchain_status"] == "UNVERIFIED"

def test_existing_stored_status_not_misrepresented_as_new_verification(clean_test_transactions):
    """
    Ensure existing stored status in database (e.g. historical VERIFIED)
    does not get misrepresented as a fresh verification pass when the verification check fails.
    """
    tx_id = f"TX-TEST-VERIFY-SEP-{uuid.uuid4().hex[:6]}"
    clean_test_transactions.append(tx_id)

    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "transactionId": tx_id,
        "transaction_type": "CENTRAL_TO_STATE",
        "amount": 10000000.0,
        "source_entity_id": "CENTRAL-FINANCE",
        "destination_entity_id": "STATE-MH",
        "blockchain_tx_hash": tx_hash,
        "blockchain_status": "VERIFIED",
        "blockchain_block": 303,
        "status": "COMPLETED"
    })

    headers = get_auth_headers("FINANCE")

    # In cloud mode where verification is disabled
    with patch.object(bcs, "is_blockchain_enabled", return_value=False):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()

        # The fresh verification check MUST be False
        assert data["verified"] is False
        assert data["is_verified"] is False
        assert data["verification_status"] == "BLOCKCHAIN_DISABLED"

        # The stored transaction document in payload reflects historical record
        assert data["transaction"]["blockchain_status"] == "VERIFIED"
        assert data["transaction"]["blockchain_block"] == 303
