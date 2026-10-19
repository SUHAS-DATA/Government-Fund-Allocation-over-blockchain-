import os
import sys
import uuid
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token
import bank_account_service as bas
import blockchain_service as bcs

client = TestClient(app)

def get_auth_headers(role="FINANCE", state_code=None):
    uid = f"test-{role.lower()}-{uuid.uuid4().hex[:6]}"
    token = generate_token(
        user_id=uid,
        email=f"{role.lower()}_{uid}@test.gov.in",
        role=role,
        name=f"Test {role} Official",
        state_code=state_code
    )
    return {"Authorization": f"Bearer {token}"}

@pytest.fixture(autouse=True)
def cleanup_test_data():
    test_ids = []
    yield test_ids
    for tid in test_ids:
        db.financial_transactions.delete_many({"$or": [{"transaction_id": tid}, {"transfer_id": tid}, {"idempotency_key": tid}]})
        db.state_transfers.delete_many({"$or": [{"transfer_id": tid}, {"idempotency_key": tid}]})

def test_record_financial_transaction_with_transfer_id(cleanup_test_data):
    """Verify record_financial_transaction correctly stores transfer_id and related_transfer_id."""
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    cleanup_test_data.append(unique_key)

    trf_id = f"TRF-ST-MH-TEST{uuid.uuid4().hex[:4].upper()}"
    cleanup_test_data.append(trf_id)

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=5000000.0,
        purpose="Test Transfer with Linked ID",
        financial_year="2026-27",
        related_transfer_id=trf_id,
        idempotency_key=unique_key
    )

    cleanup_test_data.append(tx["transaction_id"])

    assert tx is not None
    assert tx.get("transfer_id") == trf_id
    assert tx.get("related_transfer_id") == trf_id
    assert tx.get("financial_year") == "2026-27"

    # Confirm in MongoDB
    saved = db.financial_transactions.find_one({"transaction_id": tx["transaction_id"]})
    assert saved is not None
    assert saved.get("transfer_id") == trf_id
    assert saved.get("related_transfer_id") == trf_id

def test_record_financial_transaction_missing_optional_transfer_id(cleanup_test_data):
    """Verify transactions without optional transfer_id work without errors."""
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    cleanup_test_data.append(unique_key)

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("KA", "Karnataka")

    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=2500000.0,
        purpose="Test Transfer without Linked ID",
        financial_year="2026-27",
        idempotency_key=unique_key
    )

    cleanup_test_data.append(tx["transaction_id"])
    assert tx is not None
    assert "transfer_id" not in tx or tx.get("transfer_id") is None
    assert "related_transfer_id" not in tx or tx.get("related_transfer_id") is None

def test_lookup_transaction_details_by_both_identifiers(cleanup_test_data):
    """Verify GET /transactions/{id} resolves by both transaction_id and transfer_id."""
    headers = get_auth_headers("FINANCE")
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    trf_id = f"TRF-ST-MH-{uuid.uuid4().hex[:6].upper()}"
    cleanup_test_data.extend([unique_key, trf_id])

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=7500000.0,
        purpose="Test Multi-Identifier Lookup",
        financial_year="2026-27",
        related_transfer_id=trf_id,
        idempotency_key=unique_key
    )
    tx_id = tx["transaction_id"]
    cleanup_test_data.append(tx_id)

    # 1. Lookup by transaction_id
    res1 = client.get(f"/api/transactions/{tx_id}", headers=headers)
    assert res1.status_code == 200
    assert res1.json()["success"] is True
    assert res1.json()["transaction"]["transaction_id"] == tx_id

    # 2. Lookup by transfer_id
    res2 = client.get(f"/api/transactions/{trf_id}", headers=headers)
    assert res2.status_code == 200
    assert res2.json()["success"] is True
    assert res2.json()["transaction"]["transaction_id"] == tx_id
    assert res2.json()["transaction"]["transfer_id"] == trf_id

def test_verify_transaction_by_transfer_id(cleanup_test_data):
    """Verify /transactions/{id}/verify resolves and verifies using transfer_id."""
    headers = get_auth_headers("FINANCE")
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    trf_id = f"TRF-ST-MH-{uuid.uuid4().hex[:6].upper()}"
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    cleanup_test_data.extend([unique_key, trf_id])

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=10000000.0,
        purpose="Test Verification via Transfer ID",
        financial_year="2026-27",
        blockchain_tx_hash=tx_hash,
        blockchain_block=101,
        related_transfer_id=trf_id,
        idempotency_key=unique_key
    )
    cleanup_test_data.append(tx["transaction_id"])

    # Mock blockchain on-chain verification
    mock_tx = {
        "hash": tx_hash,
        "from": "0x1622F9853bDFEc6ba1A40FBf9bba7Fd74e8B451B",
        "to": bcs.contract_address or "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
        "blockNumber": 101,
        "chainId": 1337
    }
    mock_receipt = MagicMock()
    mock_receipt.status = 1
    mock_receipt.blockNumber = 101
    mock_receipt.gasUsed = 50000
    mock_receipt.logs = [{"topics": [b"event_sig"]}]

    mock_event_obj = MagicMock()
    mock_event_obj().process_receipt.return_value = (
        MagicMock(event="FundsTransferredToState", args={"amount": 10000000, "state": "Maharashtra"}),
    )

    with patch.object(bcs, "is_blockchain_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction", return_value=mock_tx), \
         patch.object(bcs.w3.eth, "get_transaction_receipt", return_value=mock_receipt), \
         patch.object(type(bcs.w3.eth), "block_number", new_callable=PropertyMock, return_value=105), \
         patch.object(bcs, "get_contract") as mock_get_contract:

        mock_contract = MagicMock()
        mock_contract.events.FundsTransferredToState = mock_event_obj
        mock_get_contract.return_value = mock_contract

        res = client.get(f"/api/transactions/{trf_id}/verify", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["verified"] is True
        assert data["transaction"]["transfer_id"] == trf_id

def test_fallback_resolution_via_state_transfers(cleanup_test_data):
    """Verify fallback lookup via state_transfers when financial_transaction lacks transfer_id."""
    headers = get_auth_headers("FINANCE")
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    trf_id = f"TRF-ST-MH-LEGACY{uuid.uuid4().hex[:4].upper()}"
    tx_hash = "0x" + uuid.uuid4().hex + uuid.uuid4().hex
    cleanup_test_data.extend([unique_key, trf_id])

    # Insert state_transfer
    db.state_transfers.insert_one({
        "transfer_id": trf_id,
        "state_code": "MH",
        "state_name": "Maharashtra",
        "amount": 5000000.0,
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": 200,
        "idempotency_key": unique_key
    })

    # Insert financial_transaction WITHOUT transfer_id (simulating legacy data)
    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")
    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=5000000.0,
        purpose="Legacy Record Without Transfer ID",
        financial_year="2026-27",
        blockchain_tx_hash=tx_hash,
        blockchain_block=200,
        idempotency_key=f"FT-{unique_key}"
    )
    cleanup_test_data.append(tx["transaction_id"])

    # Lookup using legacy transfer_id should resolve via state_transfers + tx_hash
    res = client.get(f"/api/transactions/{trf_id}", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["transaction"]["transaction_id"] == tx["transaction_id"]

def test_financial_year_filtering_in_transactions(cleanup_test_data):
    """Verify FY filtering in GET /transactions."""
    headers = get_auth_headers("FINANCE")
    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx1 = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=1000000.0,
        purpose="FY 2026-27 Tx",
        financial_year="2026-27",
        idempotency_key=f"IDEM-FY1-{uuid.uuid4().hex[:8]}"
    )
    tx2 = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=2000000.0,
        purpose="FY 2027-28 Tx",
        financial_year="2027-28",
        idempotency_key=f"IDEM-FY2-{uuid.uuid4().hex[:8]}"
    )
    cleanup_test_data.extend([tx1["transaction_id"], tx2["transaction_id"]])

    # Query FY 2026-27
    res_26 = client.get("/api/transactions?transaction_type=CENTRAL_TO_STATE&fy=2026-27", headers=headers)
    assert res_26.status_code == 200
    txs_26 = res_26.json()["transactions"]
    assert any(t["transaction_id"] == tx1["transaction_id"] for t in txs_26)
    assert not any(t["transaction_id"] == tx2["transaction_id"] for t in txs_26)

    # Query ALL
    res_all = client.get("/api/transactions?transaction_type=CENTRAL_TO_STATE&fy=ALL", headers=headers)
    assert res_all.status_code == 200
    txs_all = res_all.json()["transactions"]
    assert any(t["transaction_id"] == tx1["transaction_id"] for t in txs_all)
    assert any(t["transaction_id"] == tx2["transaction_id"] for t in txs_all)

def test_ambiguous_identifier_rejection(cleanup_test_data):
    """Verify ambiguous identifier matching multiple transactions is rejected with HTTP 400."""
    headers = get_auth_headers("FINANCE")
    ambiguous_id = f"TRF-AMBIGUOUS-{uuid.uuid4().hex[:6]}"
    cleanup_test_data.append(ambiguous_id)

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx1 = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=100000.0,
        purpose="Ambiguous 1",
        financial_year="2026-27",
        related_transfer_id=ambiguous_id,
        idempotency_key=f"IDEM-AMB1-{uuid.uuid4().hex[:8]}"
    )
    tx2 = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=200000.0,
        purpose="Ambiguous 2",
        financial_year="2026-27",
        related_transfer_id=ambiguous_id,
        idempotency_key=f"IDEM-AMB2-{uuid.uuid4().hex[:8]}"
    )
    cleanup_test_data.extend([tx1["transaction_id"], tx2["transaction_id"]])

    # Attempting to fetch or verify ambiguous identifier returns 400
    res = client.get(f"/api/transactions/{ambiguous_id}", headers=headers)
    assert res.status_code == 400
    assert "Ambiguous" in res.json()["message"]

def test_transactions_contain_state_and_account_fields_for_search(cleanup_test_data):
    """Verify financial transaction records contain state and account details used by frontend search."""
    headers = get_auth_headers("FINANCE")
    unique_key = f"TEST-IDEM-{uuid.uuid4().hex[:8]}"
    cleanup_test_data.append(unique_key)

    src_acc = bas.get_or_create_central_account()
    dst_acc = bas.get_or_create_state_account("MH", "Maharashtra")

    tx = bas.record_financial_transaction(
        transaction_type="CENTRAL_TO_STATE",
        source_account=src_acc,
        destination_account=dst_acc,
        amount=5000000.0,
        purpose="Search Fields Test",
        financial_year="2026-27",
        idempotency_key=unique_key
    )
    cleanup_test_data.append(tx["transaction_id"])

    res = client.get(f"/api/transactions/{tx['transaction_id']}", headers=headers)
    assert res.status_code == 200
    t = res.json()["transaction"]
    assert "destination_entity_name" in t and "Maharashtra" in t["destination_entity_name"]
    assert "destination_account_id" in t and t["destination_account_id"] == "ACC-MH-001"
    assert "destination_masked_account" in t and len(t["destination_masked_account"]) > 0
    assert "source_masked_account" in t and len(t["source_masked_account"]) > 0

def test_datatable_search_simulation_state_and_account():
    """Verify DataTable multi-key search logic matches by either identifier, state, or account."""
    def filter_data(data, search_term, search_key=None, search_keys=None):
        keys = []
        if search_keys:
            keys = [k for k in search_keys if isinstance(k, str) and k.strip()]
        elif search_key:
            keys = [search_key.strip()]
        if not search_term or not keys:
            return data
        term = search_term.lower().strip()
        if not term:
            return data
        return [
            item for item in data
            if any(term in str(item.get(k, "")).lower() for k in keys if item.get(k) is not None)
        ]

    mock_items = [
        {
            "transaction_id": "TX-CENTRAL-CEN-MH-YVMLC9",
            "transfer_id": "TRF-ST-MH-F7YHYK",
            "destination_entity_name": "Maharashtra State Treasury & Finance Dept",
            "destination_masked_account": "XXXX XXXX 4918",
            "destination_account_id": "ACC-MH-001",
            "source_masked_account": "XXXX XXXX 6451",
            "amount": 10000000
        },
        {
            "transaction_id": "TX-CENTRAL-CEN-KA-123456",
            "transfer_id": "TRF-ST-KA-778899",
            "destination_entity_name": "Karnataka State Treasury",
            "destination_masked_account": "XXXX XXXX 9988",
            "destination_account_id": "ACC-KA-001",
            "source_masked_account": "XXXX XXXX 6451",
            "amount": 5000000
        },
        {
            "transaction_id": "TX-CENTRAL-CEN-UP-LEGACY",
            "transfer_id": None, # Missing optional identifier
            "destination_entity_name": "Uttar Pradesh State Treasury",
            "destination_masked_account": "XXXX XXXX 1122",
            "destination_account_id": "ACC-UP-001",
            "source_masked_account": "XXXX XXXX 6451",
            "amount": 7500000
        }
    ]

    keys = [
        "transaction_id", "transfer_id", "destination_entity_name",
        "destination_account_id", "destination_masked_account", "source_masked_account"
    ]

    # 1. Search by Transfer ID
    r_trf = filter_data(mock_items, "TRF-ST-MH-F7YHYK", search_keys=keys)
    assert len(r_trf) == 1 and r_trf[0]["transaction_id"] == "TX-CENTRAL-CEN-MH-YVMLC9"

    # 2. Search by Transaction ID
    r_tx = filter_data(mock_items, "TX-CENTRAL-CEN-MH-YVMLC9", search_keys=keys)
    assert len(r_tx) == 1 and r_tx[0]["transfer_id"] == "TRF-ST-MH-F7YHYK"

    # 3. Search by State
    r_state = filter_data(mock_items, "maharashtra", search_keys=keys)
    assert len(r_state) == 1 and r_state[0]["transaction_id"] == "TX-CENTRAL-CEN-MH-YVMLC9"

    # 4. Search by Account Number
    r_acc = filter_data(mock_items, "4918", search_keys=keys)
    assert len(r_acc) == 1 and r_acc[0]["transaction_id"] == "TX-CENTRAL-CEN-MH-YVMLC9"

    # 5. Missing optional identifier handled safely
    r_up = filter_data(mock_items, "UP-LEGACY", search_keys=keys)
    assert len(r_up) == 1 and r_up[0]["transfer_id"] is None

    # 6. Legacy single searchKey callers remain functional
    r_legacy = filter_data(mock_items, "TX-CENTRAL-CEN-KA", search_key="transaction_id")
    assert len(r_legacy) == 1 and r_legacy[0]["transaction_id"] == "TX-CENTRAL-CEN-KA-123456"

