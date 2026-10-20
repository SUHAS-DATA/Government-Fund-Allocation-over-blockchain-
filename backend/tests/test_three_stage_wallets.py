import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from web3 import Web3

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
import blockchain_service as bcs
from blockchain_service import (
    validate_and_get_stage_signer,
    STAGE_SIGNER_CONFIG,
    normalize_stage_role
)
from auth_middleware import generate_token

client = TestClient(app)

# Test key pairs (Generated specifically for unit testing; never use in production)
TEST_KEY_1 = "0x" + "1" * 64
TEST_ADDR_1 = Web3().eth.account.from_key(TEST_KEY_1).address

TEST_KEY_2 = "0x" + "2" * 64
TEST_ADDR_2 = Web3().eth.account.from_key(TEST_KEY_2).address

TEST_KEY_3 = "0x" + "3" * 64
TEST_ADDR_3 = Web3().eth.account.from_key(TEST_KEY_3).address

DIFFERENT_ADDR = "0x0000000000000000000000000000000000000001"


# ==============================================================================
# 1. Signer Selection for All Three Transfer Stages
# ==============================================================================

def test_stage_1_finance_signer_selection():
    """Verify Stage 1 selects the Finance signer and resolves derived address."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "FINANCE_WALLET_ADDRESS": TEST_ADDR_1,
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3
    }
    with patch.dict(os.environ, env, clear=False):
        signer = validate_and_get_stage_signer("FINANCE")
        assert signer["role"] == "FINANCE"
        assert signer["stage"] == "Stage 1: Finance -> State"
        assert signer["derived_address"] == TEST_ADDR_1
        assert signer["configured_address"] == TEST_ADDR_1
        assert signer["contract_role"] == "FINANCE_ROLE"
        assert signer["account"].address == TEST_ADDR_1

def test_stage_2_state_signer_selection():
    """Verify Stage 2 selects the State signer and resolves derived address."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "STATE_WALLET_ADDRESS": TEST_ADDR_2,
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3
    }
    with patch.dict(os.environ, env, clear=False):
        signer = validate_and_get_stage_signer("STATE")
        assert signer["role"] == "STATE"
        assert signer["stage"] == "Stage 2: State -> District"
        assert signer["derived_address"] == TEST_ADDR_2
        assert signer["configured_address"] == TEST_ADDR_2
        assert signer["contract_role"] == "STATE_ROLE"
        assert signer["account"].address == TEST_ADDR_2

def test_stage_3_district_signer_selection():
    """Verify Stage 3 selects the District signer and resolves derived address."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3,
        "DISTRICT_WALLET_ADDRESS": TEST_ADDR_3
    }
    with patch.dict(os.environ, env, clear=False):
        signer = validate_and_get_stage_signer("DISTRICT")
        assert signer["role"] == "DISTRICT"
        assert signer["stage"] == "Stage 3: District -> Contractor"
        assert signer["derived_address"] == TEST_ADDR_3
        assert signer["configured_address"] == TEST_ADDR_3
        assert signer["contract_role"] == "DISTRICT_ROLE"
        assert signer["account"].address == TEST_ADDR_3


# ==============================================================================
# 2. Wallet Address & Private Key Mismatch Rejection
# ==============================================================================

def test_stage_1_address_mismatch_raises_error():
    """Verify Stage 1 rejects configured address mismatch without leaking keys."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "FINANCE_WALLET_ADDRESS": DIFFERENT_ADDR
    }
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(bcs.WalletConfigurationError) as exc_info:
            validate_and_get_stage_signer("FINANCE")
        msg = str(exc_info.value)
        assert "does not match" in msg
        assert "FINANCE_WALLET_ADDRESS" in msg
        assert TEST_KEY_1 not in msg  # No private key leak

def test_stage_2_address_mismatch_raises_error():
    """Verify Stage 2 rejects configured address mismatch without leaking keys."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "STATE_WALLET_ADDRESS": DIFFERENT_ADDR
    }
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(bcs.WalletConfigurationError) as exc_info:
            validate_and_get_stage_signer("STATE")
        msg = str(exc_info.value)
        assert "does not match" in msg
        assert "STATE_WALLET_ADDRESS" in msg
        assert TEST_KEY_2 not in msg

def test_stage_3_address_mismatch_raises_error():
    """Verify Stage 3 rejects configured address mismatch without leaking keys."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3,
        "DISTRICT_WALLET_ADDRESS": DIFFERENT_ADDR
    }
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(bcs.WalletConfigurationError) as exc_info:
            validate_and_get_stage_signer("DISTRICT")
        msg = str(exc_info.value)
        assert "does not match" in msg
        assert "DISTRICT_WALLET_ADDRESS" in msg
        assert TEST_KEY_3 not in msg


# ==============================================================================
# 3. Missing Environment Variable Handling (No Account 1 Default Fallback)
# ==============================================================================

def test_stage_2_missing_key_does_not_fallback_to_account_1():
    """Verify Stage 2 fails safely when STATE_PRIVATE_KEY is missing, refusing to borrow Finance key."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "STATE_PRIVATE_KEY": "",
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3
    }
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(bcs.WalletConfigurationError) as exc_info:
            validate_and_get_stage_signer("STATE")
        assert "STATE_PRIVATE_KEY" in str(exc_info.value)

        # get_private_key_for_role must also refuse to return the Finance key for STATE
        pk = bcs.get_private_key_for_role("STATE")
        assert not pk or pk != TEST_KEY_1

def test_stage_3_missing_key_does_not_fallback_to_account_1():
    """Verify Stage 3 fails safely when DISTRICT_PRIVATE_KEY is missing, refusing to borrow Finance key."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "DISTRICT_PRIVATE_KEY": ""
    }
    with patch.dict(os.environ, env, clear=False):
        with pytest.raises(bcs.WalletConfigurationError) as exc_info:
            validate_and_get_stage_signer("DISTRICT")
        assert "DISTRICT_PRIVATE_KEY" in str(exc_info.value)

        pk = bcs.get_private_key_for_role("DISTRICT")
        assert not pk or pk != TEST_KEY_1


# ==============================================================================
# 4. Invalid Transfer Stage & Stage Alias Normalization
# ==============================================================================

def test_invalid_stage_rejected():
    """Verify arbitrary or invalid stage names are rejected."""
    with pytest.raises(bcs.WalletConfigurationError) as exc_info:
        validate_and_get_stage_signer("ARBITRARY_STAGE")
    assert "Unknown transfer stage" in str(exc_info.value)

def test_stage_aliases_normalized_correctly():
    """Verify aliases like STAGE_1, STAGE_2, STAGE_3 normalize to FINANCE, STATE, DISTRICT."""
    assert normalize_stage_role("STAGE_1") == "FINANCE"
    assert normalize_stage_role("STAGE1") == "FINANCE"
    assert normalize_stage_role("FINANCE_TO_STATE") == "FINANCE"

    assert normalize_stage_role("STAGE_2") == "STATE"
    assert normalize_stage_role("STAGE2") == "STATE"
    assert normalize_stage_role("STATE_TO_DISTRICT") == "STATE"

    assert normalize_stage_role("STAGE_3") == "DISTRICT"
    assert normalize_stage_role("STAGE3") == "DISTRICT"
    assert normalize_stage_role("DISTRICT_TO_CONTRACTOR") == "DISTRICT"


# ==============================================================================
# 5. Role-Based Access Control on Transfer Endpoints
# ==============================================================================

def test_stage_1_rejects_non_finance_users():
    """Verify /api/finance/transfer-to-state rejects non-FINANCE roles."""
    state_token = generate_token(user_id="state_officer", email="state@test.gov.in", role="STATE", name="State Officer")
    res = client.post(
        "/api/finance/transfer-to-state",
        headers={"Authorization": f"Bearer {state_token}"},
        json={"allocation_id": "ALC-TEST-001", "state_code": "MH", "amount": 1000}
    )
    assert res.status_code == 403

def test_stage_2_rejects_non_state_users():
    """Verify /api/state/allocate-to-district rejects non-STATE roles."""
    fin_token = generate_token(user_id="fin_officer", email="finance@test.gov.in", role="FINANCE", name="Finance Officer")
    res = client.post(
        "/api/state/allocate-to-district",
        headers={"Authorization": f"Bearer {fin_token}"},
        json={"transfer_id": "TRF-TEST-001", "district_name": "Pune", "amount": 1000}
    )
    assert res.status_code == 403

def test_stage_3_rejects_non_district_users():
    """Verify /api/district/transfer-to-contractor rejects non-DISTRICT roles."""
    state_token = generate_token(user_id="state_officer", email="state@test.gov.in", role="STATE", name="State Officer")
    res = client.post(
        "/api/district/transfer-to-contractor",
        headers={"Authorization": f"Bearer {state_token}"},
        json={"project_id": "PRJ-TEST-001", "contractor_name": "Apex", "amount": 1000}
    )
    assert res.status_code == 403


# ==============================================================================
# 6. Cross-Jurisdiction Isolation
# ==============================================================================

def test_stage_2_cross_state_jurisdiction_blocked():
    """Verify a State officer from KA cannot allocate a transfer belonging to MH."""
    ka_token = generate_token(
        user_id="ka_state_officer",
        email="ka_state@test.gov.in",
        role="STATE",
        name="KA State Officer",
        state_code="KA"
    )

    trf_id = "TRF-MH-CROSS-TEST-001"
    db.state_transfers.update_one(
        {"transfer_id": trf_id},
        {"$set": {
            "transfer_id": trf_id,
            "allocation_id": "ALC-MH-001",
            "state_code": "MH",
            "state_name": "Maharashtra",
            "amount": 50000.0,
            "allocated_to_districts": 0.0
        }},
        upsert=True
    )

    res = client.post(
        "/api/state/allocate-to-district",
        headers={"Authorization": f"Bearer {ka_token}"},
        json={"transfer_id": trf_id, "district_name": "Pune", "amount": 10000.0}
    )
    assert res.status_code == 403
    assert "cross-state" in res.json()["message"].lower()

def test_stage_3_cross_district_jurisdiction_blocked():
    """Verify a District officer from Belagavi cannot release payments for Mysuru projects."""
    belagavi_token = generate_token(
        user_id="belagavi_officer",
        email="belagavi@test.gov.in",
        role="DISTRICT",
        name="Belagavi Officer",
        district_name="Belagavi"
    )

    prj_id = "PRJ-MYSURU-CROSS-001"
    db.projects.update_one(
        {"project_id": prj_id},
        {"$set": {
            "project_id": prj_id,
            "district_name": "Mysuru",
            "state_code": "KA",
            "total_budget": 100000.0,
            "released_amount": 0.0,
            "contractor_name": "Apex Infra"
        }},
        upsert=True
    )

    res = client.post(
        "/api/district/transfer-to-contractor",
        headers={"Authorization": f"Bearer {belagavi_token}"},
        json={"project_id": prj_id, "amount": 10000.0}
    )
    assert res.status_code == 403
    assert "access denied" in res.json()["message"].lower() or "jurisdiction" in res.json()["message"].lower()


# ==============================================================================
# 7. Idempotency Protection Across Stages
# ==============================================================================

def test_stage_1_idempotent_duplicate_prevention():
    """Verify idempotency key prevents duplicate transfers at Stage 1."""
    fin_token = generate_token(user_id="fin_off", email="fin@test.gov.in", role="FINANCE", name="Finance Officer")
    idem_key = "IDEM-FIN-TEST-999"
    alloc_id = "ALC-IDEM-TEST-001"

    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "allocation_id": alloc_id,
            "amount": 100000.0,
            "disbursed_amount": 25000.0,
            "scheme_name": "Idempotency Test Scheme",
            "department": "Infrastructure"
        }},
        upsert=True
    )

    # Pre-seed transfer with idempotency key
    db.state_transfers.update_one(
        {"idempotency_key": idem_key},
        {"$set": {
            "transfer_id": "TRF-SEEDED-999",
            "idempotency_key": idem_key,
            "allocation_id": alloc_id,
            "amount": 25000.0,
            "state_code": "MH"
        }},
        upsert=True
    )

    res = client.post(
        "/api/finance/transfer-to-state",
        headers={
            "Authorization": f"Bearer {fin_token}",
            "X-Idempotency-Key": idem_key
        },
        json={"allocation_id": alloc_id, "state_code": "MH", "amount": 25000.0}
    )
    assert res.status_code == 200
    assert res.json().get("is_duplicate") is True
    assert res.json().get("transfer", {}).get("transfer_id") == "TRF-SEEDED-999"


# ==============================================================================
# 8. Diagnostics Truthfully Displays 3-Stage Wallet Readiness
# ==============================================================================

def test_diagnostics_reports_three_stage_status():
    """Verify get_blockchain_diagnostics includes details for all 3 stage signers."""
    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": TEST_KEY_1,
        "FINANCE_WALLET_ADDRESS": TEST_ADDR_1,
        "STATE_PRIVATE_KEY": TEST_KEY_2,
        "STATE_WALLET_ADDRESS": TEST_ADDR_2,
        "DISTRICT_PRIVATE_KEY": TEST_KEY_3,
        "DISTRICT_WALLET_ADDRESS": TEST_ADDR_3
    }
    with patch.dict(os.environ, env, clear=False):
        diag = bcs.get_blockchain_diagnostics()
        roles = diag.get("roles", {})

        assert "FINANCE" in roles
        assert roles["FINANCE"]["wallet_derived"] == TEST_ADDR_1
        assert roles["FINANCE"]["configured_address"] == TEST_ADDR_1
        assert roles["FINANCE"]["address_match"] is True
        assert roles["FINANCE"]["ready"] is True

        assert "STATE" in roles
        assert roles["STATE"]["wallet_derived"] == TEST_ADDR_2
        assert roles["STATE"]["configured_address"] == TEST_ADDR_2
        assert roles["STATE"]["address_match"] is True
        assert roles["STATE"]["ready"] is True

        assert "DISTRICT" in roles
        assert roles["DISTRICT"]["wallet_derived"] == TEST_ADDR_3
        assert roles["DISTRICT"]["configured_address"] == TEST_ADDR_3
        assert roles["DISTRICT"]["address_match"] is True
        assert roles["DISTRICT"]["ready"] is True

def test_exact_production_target_addresses_matching():
    """Verify validation logic with the user's three designated public addresses."""
    target_finance = "0xeCcD57EfadFCc6217a21Bf482FEBe18c9F3D6148"
    target_state = "0x6CFe24b1097460d379096A4dF7b62cA39893d71D"
    target_district = "0x613ae03002B66A538c71a39403398545e33e5280"

    mock_account_finance = MagicMock(address=target_finance)
    mock_account_state = MagicMock(address=target_state)
    mock_account_district = MagicMock(address=target_district)

    def mock_from_key(pk):
        if pk == "0x" + "a" * 64:
            return mock_account_finance
        elif pk == "0x" + "b" * 64:
            return mock_account_state
        elif pk == "0x" + "c" * 64:
            return mock_account_district
        return MagicMock(address="0x9999999999999999999999999999999999999999")

    env = {
        "ENABLE_BLOCKCHAIN": "true",
        "FINANCE_PRIVATE_KEY": "0x" + "a" * 64,
        "FINANCE_WALLET_ADDRESS": target_finance,
        "STATE_PRIVATE_KEY": "0x" + "b" * 64,
        "STATE_WALLET_ADDRESS": target_state,
        "DISTRICT_PRIVATE_KEY": "0x" + "c" * 64,
        "DISTRICT_WALLET_ADDRESS": target_district
    }

    with patch.dict(os.environ, env, clear=False), \
         patch.object(bcs.w3.eth.account, "from_key", side_effect=mock_from_key):
        fin_signer = validate_and_get_stage_signer("FINANCE")
        assert fin_signer["derived_address"] == target_finance
        assert fin_signer["configured_address"] == target_finance
        assert fin_signer["contract_role"] == "FINANCE_ROLE"

        state_signer = validate_and_get_stage_signer("STATE")
        assert state_signer["derived_address"] == target_state
        assert state_signer["configured_address"] == target_state
        assert state_signer["contract_role"] == "STATE_ROLE"

        dist_signer = validate_and_get_stage_signer("DISTRICT")
        assert dist_signer["derived_address"] == target_district
        assert dist_signer["configured_address"] == target_district
        assert dist_signer["contract_role"] == "DISTRICT_ROLE"
