import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from bson import ObjectId
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from app import app
from database import db
from auth_middleware import generate_token
import blockchain_service as bcs

client = TestClient(app)

DISTRICT_USER = {
    "_id": ObjectId(),
    "email": "district.belagavi@govtfund.in",
    "name": "District Officer Belagavi",
    "role": "DISTRICT",
    "district_name": "Belagavi",
    "state_code": "KA"
}

CONTRACTOR_USER = {
    "_id": ObjectId(),
    "email": "contractor.infra@apex.in",
    "name": "Apex Infrastructure Contractors Pvt Ltd",
    "role": "CONTRACTOR",
    "contractor_id": "CON-KA-APEX",
    "state_code": "KA",
    "wallet_address": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3"
}

@pytest.fixture(autouse=True)
def setup_teardown():
    # Setup test collections
    db.projects.delete_many({"project_id": {"$regex": "^PRJ-TEST-"}})
    db.milestones.delete_many({"project_id": {"$regex": "^PRJ-TEST-"}})
    db.contractor_kyc.delete_many({"contractor_id": "CON-KA-APEX"})
    db.users.delete_many({"email": {"$in": [DISTRICT_USER["email"], CONTRACTOR_USER["email"]]}})
    db.blockchain_transactions.delete_many({"entity_id": {"$regex": "^PRJ-TEST-"}})
    db.blockchain_transactions.delete_many({"tx_hash": "0x" + "b" * 64})
    db.blockchain_transactions.delete_many({"tx_hash": "0x" + "c" * 64})

    # Insert test contractor KYC
    db.contractor_kyc.insert_one({
        "user_id": str(CONTRACTOR_USER["_id"]),
        "contractor_id": "CON-KA-APEX",
        "company_name": "Apex Infrastructure Contractors Pvt Ltd",
        "email": CONTRACTOR_USER["email"],
        "state_code": "KA",
        "kyc_status": "APPROVED",
        "wallet_address": CONTRACTOR_USER["wallet_address"]
    })

    yield

    # Teardown
    db.projects.delete_many({"project_id": {"$regex": "^PRJ-TEST-"}})
    db.milestones.delete_many({"project_id": {"$regex": "^PRJ-TEST-"}})
    db.contractor_kyc.delete_many({"contractor_id": "CON-KA-APEX"})
    db.blockchain_transactions.delete_many({"entity_id": {"$regex": "^PRJ-TEST-"}})
    db.blockchain_transactions.delete_many({"tx_hash": "0x" + "b" * 64})
    db.blockchain_transactions.delete_many({"tx_hash": "0x" + "c" * 64})
    db.users.delete_many({"email": {"$in": [DISTRICT_USER["email"], CONTRACTOR_USER["email"]]}})
    db.blockchain_transactions.delete_many({"entity_id": {"$regex": "^PRJ-TEST-"}})

def get_auth_token(user_dict):
    return generate_token(
        user_id=str(user_dict["_id"]),
        email=user_dict["email"],
        role=user_dict["role"],
        name=user_dict["name"],
        state_code=user_dict.get("state_code"),
        district_name=user_dict.get("district_name"),
        officer_id=user_dict.get("contractor_id")
    )

# -----------------------------------------------------------------------------
# 1. Missing Escrow Pre-Flight Check Blocks Release
# -----------------------------------------------------------------------------
def test_missing_escrow_preflight_blocks_release():
    """Verify that release_milestone_payment_onchain raises ValueError when escrow is missing on-chain."""
    proj_id = "PRJ-TEST-ESCROW-MISSING"
    
    mock_contract = MagicMock()
    # projectEscrows returns a tuple where exists (index 9) is False
    mock_contract.functions.projectEscrows.return_value.call.return_value = (
        "", "", "0x0000000000000000000000000000000000000000", 0, 0, 0, False, "", 0, False
    )

    with patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:
        
        # Calling release_milestone_payment_onchain must raise ValueError
        with pytest.raises(ValueError, match="Project escrow does not exist on-chain"):
            bcs.release_milestone_payment_onchain(proj_id, 0)
        
        # Must NOT broadcast any transaction to blockchain
        mock_exec.assert_not_called()

def test_verify_fund_request_disburses_funds_directly():
    """Verify that District approve fund request disburses on-chain contractor funds directly without requiring separate escrow."""
    proj_id = "PRJ-TEST-API-DIRECT-TRANSFER"
    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Belagavi Test Highway",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 50000000.0,
        "released_amount": 0.0,
        "contractor_id": "CON-KA-APEX",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "contractor_wallet": CONTRACTOR_USER["wallet_address"],
        "escrow_onchain": False,
        "status": "IN_PROGRESS"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1: Foundation (30%)",
        "amount": 15000000.0,
        "status": "FUND_REQUESTED",
        "phase_status": "FUND_REQUESTED"
    })

    token = get_auth_token(DISTRICT_USER)
    headers = {"Authorization": f"Bearer {token}"}

    mock_tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
    mock_receipt = {
        "tx_hash": mock_tx_hash,
        "block_number": 11955360,
        "status": "SUCCESS",
        "from_address": "0x53212DFE5d74b8e8a42c18B8D3C91Ee88C5758ec"
    }

    with patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "record_contractor_transfer_onchain", return_value=mock_receipt) as mock_trf:

        res = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        mock_trf.assert_called_once()

        # Ensure released_amount is updated to 15000000.0
        p = db.projects.find_one({"project_id": proj_id})
        assert p["released_amount"] == 15000000.0

# -----------------------------------------------------------------------------
# 2. Correct Escrow Activation in MongoDB Without Blockchain Dependency
# -----------------------------------------------------------------------------
def test_create_escrow_resolves_actual_contractor_wallet_and_updates_db():
    """Verify create-escrow updates project status in MongoDB without submitting on-chain transactions."""
    proj_id = "PRJ-TEST-CREATE-ESCROW"
    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Belagavi Smart Infrastructure Project",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 30000000.0,
        "contractor_id": "CON-KA-APEX",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "contractor_email": CONTRACTOR_USER["email"],
        "contractor_wallet": CONTRACTOR_USER["wallet_address"],
        "escrow_onchain": False,
        "status": "ASSIGNED"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1",
        "amount": 9000000.0,
        "status": "UNLOCKED"
    })

    token = get_auth_token(DISTRICT_USER)
    headers = {"Authorization": f"Bearer {token}"}

    with patch.object(bcs, "create_project_escrow_onchain") as mock_create_escrow, \
         patch.object(bcs, "set_project_milestones_onchain") as mock_set_milestones:

        res = client.post(
            f"/api/district/projects/{proj_id}/create-escrow",
            headers=headers
        )
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["contractor_wallet"] == CONTRACTOR_USER["wallet_address"]

        # Crucial: Project creation / escrow activation must NOT submit on-chain transactions
        mock_create_escrow.assert_not_called()
        mock_set_milestones.assert_not_called()

        # Verify database updated
        p = db.projects.find_one({"project_id": proj_id})
        assert p["status"] == "ESCROW_FUNDED"
        assert p["escrow_onchain"] is False

# -----------------------------------------------------------------------------
# 5. Project ID Consistency Across Lifecycle
# -----------------------------------------------------------------------------
def test_project_id_consistency_across_lifecycle():
    """Verify that the exact same canonical project ID is used throughout the lifecycle."""
    canonical_id = "PRJ-BEN-5ZO4EI"
    
    mock_contract = MagicMock()
    # Mock escrow exists = True
    mock_contract.functions.projectEscrows.return_value.call.return_value = (
        canonical_id, "Road", CONTRACTOR_USER["wallet_address"], 50000000, 0, 3, False, "", 11955340, True
    )

    with patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        mock_exec.return_value = {"tx_hash": "0x123", "block_number": 100, "status": "SUCCESS"}

        # Release milestone payment
        res = bcs.release_milestone_payment_onchain(canonical_id, 0)
        assert res["status"] == "SUCCESS"

        # Verify contract function was called with canonical_id
        mock_contract.functions.releaseMilestonePayment.assert_called_with(canonical_id, 0)

# -----------------------------------------------------------------------------
# 6. Successful Release After Escrow Initialization
# -----------------------------------------------------------------------------
def test_successful_release_after_escrow_initialization():
    """Verify that when escrow exists, District can successfully disburse phase funds."""
    proj_id = "PRJ-TEST-SUCCESS-RELEASE"
    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Belagavi Successful Project",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 50000000.0,
        "released_amount": 0.0,
        "contractor_id": "CON-KA-APEX",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "contractor_wallet": CONTRACTOR_USER["wallet_address"],
        "escrow_onchain": True,
        "status": "ESCROW_FUNDED"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1: Mobilization",
        "amount": 15000000.0,
        "status": "FUND_REQUESTED",
        "phase_status": "FUND_REQUESTED"
    })

    token = get_auth_token(DISTRICT_USER)
    headers = {"Authorization": f"Bearer {token}"}

    tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
    with patch.object(bcs, "check_project_escrow_exists_onchain", return_value=True), \
         patch.object(bcs, "release_milestone_payment_onchain", return_value={"tx_hash": tx_hash, "block_number": 11955355, "status": "SUCCESS"}):

        res = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=headers
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

        p = db.projects.find_one({"project_id": proj_id})
        assert p["released_amount"] == 15000000.0

        m = db.milestones.find_one({"project_id": proj_id, "milestone_index": 0})
        assert m["status"] == "FUNDS_TRANSFERRED"
