import os
import sys
import uuid
from unittest.mock import MagicMock, PropertyMock, patch
import pytest
from fastapi.testclient import TestClient



# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db, get_active_financial_year
from auth_middleware import generate_token
import blockchain_service as bcs
from reconciliation_service import reconcile_financial_records
from audit_service import log_audit_event, query_audit_logs

client = TestClient(app)

def get_test_headers(role: str, user_id: str = None, state_code: str = None, district_name: str = None):
    uid = user_id or f"test-{role.lower()}-{uuid.uuid4().hex[:6]}"
    token = generate_token(
        user_id=uid,
        email=f"{role.lower()}_{uid}@govtfund.test",
        role=role,
        name=f"Test {role} Official",
        state_code=state_code,
        district_name=district_name
    )
    return {"Authorization": f"Bearer {token}"}

# =========================================================================
# 1. Receipt Status & Core Verification Tests
# =========================================================================

def test_verify_valid_blockchain_receipt_with_events_success():
    """Valid transaction with status 1, matching contract and emitted event succeeds verification."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    contract_addr = bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20"
    sender_addr = "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B"

    mock_tx = {
        "hash": tx_hash,
        "from": sender_addr,
        "to": contract_addr,
        "blockNumber": 1205,
        "chainId": 1337
    }

    mock_receipt = MagicMock()
    mock_receipt.status = 1
    mock_receipt.blockNumber = 1205
    mock_receipt.gasUsed = 45000
    mock_receipt.logs = [{"topics": [b"event_sig"]}]

    mock_event_obj = MagicMock()
    mock_event_obj().process_receipt.return_value = (
        MagicMock(event="FundsTransferredToState", args={"amount": 5000000, "state": "Karnataka"}),
    )

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx), \
         patch.object(bcs.w3.eth, "get_transaction_receipt", return_value=mock_receipt), \
         patch.object(type(bcs.w3.eth), "block_number", new_callable=PropertyMock, return_value=1215), \
         patch.object(bcs, "get_contract") as mock_get_contract:


        mock_contract = MagicMock()
        mock_contract.events.FundsTransferredToState = mock_event_obj
        mock_get_contract.return_value = mock_contract

        res = bcs.verify_transaction_onchain(
            tx_hash=tx_hash,
            expected_sender=sender_addr,
            expected_contract=contract_addr,
            expected_event="FundsTransferredToState",
            expected_chain_id=1337
        )

        assert res["verified"] is True
        assert res["status"] == "VERIFIED_SUCCESS"
        assert res["block_number"] == 1205
        assert res["confirmations"] == 11
        assert len(res["decoded_events"]) == 1
        assert res["decoded_events"][0]["event"] == "FundsTransferredToState"

def test_verify_reverted_receipt_fails_verification():
    """Transaction that mined but reverted (receipt.status == 0) fails verification without fabricated success."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    contract_addr = bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20"

    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": contract_addr,
        "blockNumber": 1210,
        "chainId": 1337
    }

    mock_receipt = MagicMock()
    mock_receipt.status = 0  # Reverted!
    mock_receipt.blockNumber = 1210
    mock_receipt.gasUsed = 21000

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx), \
         patch.object(bcs.w3.eth, "get_transaction_receipt", return_value=mock_receipt):

        res = bcs.verify_transaction_onchain(tx_hash=tx_hash)
        assert res["verified"] is False
        assert res["status"] == "REVERTED_ON_CHAIN"
        assert "reverted" in res["message"].lower()

def test_verify_missing_tx_hash_fails_verification():
    """Transaction not found on chain raises NOT_FOUND_ON_CHAIN and never claims verified."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", side_effect=Exception("Transaction not found")):

        res = bcs.verify_transaction_onchain(tx_hash=tx_hash)
        assert res["verified"] is False
        assert res["status"] == "NOT_FOUND_ON_CHAIN"

def test_verify_pending_mempool_transaction_fails_until_mined():
    """Transaction in mempool (blockNumber is None) is marked PENDING_IN_MEMPOOL."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "blockNumber": None,  # Pending
        "chainId": 1337
    }

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx):

        res = bcs.verify_transaction_onchain(tx_hash=tx_hash)
        assert res["verified"] is False
        assert res["status"] == "PENDING_IN_MEMPOOL"

# =========================================================================
# 2. Validation of Chain ID, Contract, Sender, and Emitted Events
# =========================================================================

def test_verify_contract_address_mismatch_fails():
    """Transaction sent to unexpected contract address is rejected."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": "0x000000000000000000000000000000000000dEaD",  # Wrong address
        "blockNumber": 1220,
        "chainId": 1337
    }

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx):

        res = bcs.verify_transaction_onchain(
            tx_hash=tx_hash,
            expected_contract=bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20"
        )
        assert res["verified"] is False
        assert res["status"] == "CONTRACT_ADDRESS_MISMATCH"

def test_verify_sender_mismatch_fails():
    """Transaction initiated by unauthorized sender address is rejected."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    mock_tx = {
        "hash": tx_hash,
        "from": "0x9999999999999999999999999999999999999999",  # Unauthorized
        "to": bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "blockNumber": 1220,
        "chainId": 1337
    }

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx):

        res = bcs.verify_transaction_onchain(
            tx_hash=tx_hash,
            expected_sender="0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B"
        )
        assert res["verified"] is False
        assert res["status"] == "SENDER_ADDRESS_MISMATCH"

def test_verify_chain_id_mismatch_fails():
    """Transaction submitted on wrong network chain ID is rejected."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "blockNumber": 1220,
        "chainId": 1  # Ethereum Mainnet instead of Local Devnet (1337)
    }

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx):

        res = bcs.verify_transaction_onchain(
            tx_hash=tx_hash,
            expected_chain_id=1337
        )
        assert res["verified"] is False
        assert res["status"] == "CHAIN_ID_MISMATCH"

def test_verify_event_emission_mismatch_fails():
    """Receipt mined successfully but lacking the expected event emission is rejected."""
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    contract_addr = bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20"

    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": contract_addr,
        "blockNumber": 1230,
        "chainId": 1337
    }

    mock_receipt = MagicMock()
    mock_receipt.status = 1
    mock_receipt.blockNumber = 1230
    mock_receipt.gasUsed = 35000
    mock_receipt.logs = [{"topics": [b"some_other_event"]}]

    mock_event_obj = MagicMock()
    # Emits empty tuple -> event not found in logs
    mock_event_obj().process_receipt.return_value = ()

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx), \
         patch.object(bcs.w3.eth, "get_transaction_receipt", return_value=mock_receipt), \
         patch.object(bcs, "get_contract") as mock_get_contract:

        mock_contract = MagicMock()
        mock_contract.events.FundsTransferredToState = mock_event_obj
        mock_get_contract.return_value = mock_contract

        res = bcs.verify_transaction_onchain(
            tx_hash=tx_hash,
            expected_event="FundsTransferredToState"
        )
        assert res["verified"] is False
        assert res["status"] == "EVENT_EMISSION_MISMATCH"

# =========================================================================
# 3. Endpoint Integration & RPC Failure Testing
# =========================================================================

def test_rpc_unreachable_returns_unverified_not_fabricated_success():
    """When RPC node is down, verification endpoint returns RPC_DISCONNECTED without fabricated success."""
    admin_headers = get_test_headers("SUPER_ADMIN")
    tx_id = f"TX-DISCONN-{uuid.uuid4().hex[:6]}"
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "blockchain_tx_hash": tx_hash,
        "amount": 1000000.0,
        "status": "COMPLETED"
    })

    with patch.object(bcs, "is_blockchain_connected", return_value=False):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=admin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["verified"] is False
        assert data["verification_status"] == "RPC_DISCONNECTED"
        assert "unreachable" in data["message"].lower()

def test_transaction_verification_updates_mongodb_and_logs_audit():
    """Calling /verify updates MongoDB transaction document and writes an audit log."""
    fin_headers = get_test_headers("FINANCE")
    tx_id = f"TX-AUDIT-UPD-{uuid.uuid4().hex[:6]}"
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex

    db.financial_transactions.insert_one({
        "transaction_id": tx_id,
        "blockchain_tx_hash": tx_hash,
        "amount": 2500000.0,
        "status": "COMPLETED",
        "blockchain_status": "UNVERIFIED"
    })

    mock_v_res = {
        "verified": True,
        "status": "VERIFIED_SUCCESS",
        "message": "Verified on-chain",
        "block_number": 1255,
        "confirmations": 8,
        "from_address": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to_address": "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "gas_used": 50000,
        "decoded_events": []
    }

    with patch.object(bcs, "verify_transaction_onchain", return_value=mock_v_res):
        res = client.get(f"/api/transactions/{tx_id}/verify", headers=fin_headers)
        assert res.status_code == 200
        data = res.json()
        assert data["verified"] is True
        assert data["verification_status"] == "VERIFIED_CONFIRMED"

        # Check DB updated
        doc = db.financial_transactions.find_one({"transaction_id": tx_id})
        assert doc["blockchain_status"] == "VERIFIED"
        assert doc["blockchain_block"] == 1255

        # Check Audit Log created
        audit_entry = db.audit_logs.find_one({"target_id": tx_id, "event_type": "TRANSACTION_VERIFICATION_ATTEMPT"})
        assert audit_entry is not None
        assert audit_entry["status"] == "SUCCESS"
        assert audit_entry["actor_role"] == "FINANCE"

# =========================================================================
# 4. Reconciliation Engine Tests
# =========================================================================

def test_reconciliation_detects_match_and_amount_discrepancy():
    """Reconciliation flags MATCHED records and identifies AMOUNT_MISMATCH discrepancies."""
    fy = get_active_financial_year()
    alloc_matched = f"ALC-REC-MATCH-{uuid.uuid4().hex[:8]}"
    alloc_mismatch = f"ALC-REC-MISMATCH-{uuid.uuid4().hex[:8]}"

    db.budget_allocations.delete_many({"allocation_id": {"$in": [alloc_matched, alloc_mismatch]}})

    db.budget_allocations.insert_one({
        "allocation_id": alloc_matched,
        "financial_year": fy,
        "amount": 5000000.0,
        "disbursed_amount": 0.0
    })

    db.budget_allocations.insert_one({
        "allocation_id": alloc_mismatch,
        "financial_year": fy,
        "amount": 8000000.0,
        "disbursed_amount": 0.0
    })

    def fake_get_alloc(aid):
        if aid == alloc_matched:
            return {"exists": True, "total_sanctioned": 5000000.0, "disbursed_to_states": 0.0}
        elif aid == alloc_mismatch:
            # On-chain says 6000000, but Mongo says 8000000! Discrepancy!
            return {"exists": True, "total_sanctioned": 6000000.0, "disbursed_to_states": 0.0}
        return None

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs, "get_onchain_budget_allocation", side_effect=fake_get_alloc), \
         patch.object(bcs, "get_onchain_state_transfer", return_value=None), \
         patch.object(bcs, "get_onchain_district_allocation", return_value=None), \
         patch.object(bcs, "verify_transaction_onchain", return_value={"verified": True, "status": "VERIFIED_SUCCESS"}):


        report = reconcile_financial_records(financial_year=fy, current_user={"name": "Finance Officer", "role": "FINANCE"})
        assert report["blockchain_connected"] is True
        assert report["discrepancy_count"] >= 1

        # Check matched allocation document
        m_doc = db.budget_allocations.find_one({"allocation_id": alloc_matched})
        assert m_doc["reconciliation_status"] == "MATCHED"

        # Check mismatched allocation document
        mis_doc = db.budget_allocations.find_one({"allocation_id": alloc_mismatch})
        assert mis_doc["reconciliation_status"] == "AMOUNT_MISMATCH"
        assert "mismatch" in mis_doc["reconciliation_issue"].lower()

# =========================================================================
# 5. Audit Log Jurisdiction Isolation Tests
# =========================================================================

def test_audit_logs_endpoint_jurisdiction_isolation():
    """State and district officers can only retrieve audit logs within their jurisdiction; Super Admin has global oversight."""
    # Seed audit logs across jurisdictions
    log_audit_event(
        event_type="STATE_TRANSFER",
        actor={"user_id": "u-ka", "name": "KA Officer", "role": "STATE", "state_code": "KA"},
        target_id="TRF-KA-001",
        amount=500000.0,
        details="Karnataka State Disbursal"
    )
    log_audit_event(
        event_type="STATE_TRANSFER",
        actor={"user_id": "u-mh", "name": "MH Officer", "role": "STATE", "state_code": "MH"},
        target_id="TRF-MH-001",
        amount=700000.0,
        details="Maharashtra State Disbursal"
    )

    ka_headers = get_test_headers("STATE", state_code="KA")
    res_ka = client.get("/api/transactions/audit-logs", headers=ka_headers)
    assert res_ka.status_code == 200
    ka_logs = res_ka.json().get("audit_logs", [])
    # Verify KA officer does NOT receive MH audit logs
    for log in ka_logs:
        if log.get("state_code"):
            assert log["state_code"] == "KA"

    # Super Admin can view all
    admin_headers = get_test_headers("SUPER_ADMIN")
    res_admin = client.get("/api/transactions/audit-logs", headers=admin_headers)
    assert res_admin.status_code == 200
    admin_logs = res_admin.json().get("audit_logs", [])
    states_seen = {l.get("state_code") for l in admin_logs if l.get("state_code")}
    assert "KA" in states_seen
    assert "MH" in states_seen
