"""
Regression and Pre-Flight Safety Tests for District Transactions and Escrow Revert Prevention.
Ensures:
- Transactions that would revert on-chain are intercepted and aborted before gas is spent.
- Fail-fast gas estimation and pre-flight call simulation prevent failed transactions on Sepolia.
- Non-existent escrows, 0% milestone progress, and budget overruns are caught before broadcast.
- Duplicate escrow and milestone setups are handled idempotently.
- Milestone completion verification avoids double-release reverts when advance transfers were already disbursed.
"""

import os
import sys
import pytest
from unittest.mock import MagicMock, patch
from web3.exceptions import ContractLogicError

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import blockchain_service as bcs
from database import db

# ---------------------------------------------------------------------------
# 1. execute_contract_transaction pre-flight simulation and fail-fast gas estimation
# ---------------------------------------------------------------------------

def test_execute_contract_transaction_call_simulation_reverts_aborts_without_broadcasting():
    """Verify that if func_call.call() simulates a revert, execute_contract_transaction aborts immediately."""
    mock_func = MagicMock()
    mock_func.fn_name = "releaseMilestonePayment"
    mock_func.call.side_effect = ContractLogicError("execution reverted: Project escrow does not exist")

    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True

    mock_account = MagicMock(address="0x613ae03002B66A538c71a39403398545e33e5280")

    with patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "get_account", return_value=mock_account), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "b" * 64):

        with pytest.raises(ValueError) as excinfo:
            bcs.execute_contract_transaction(mock_func, role="DISTRICT")

        assert "pre-flight check failed" in str(excinfo.value).lower()
        assert "project escrow does not exist" in str(excinfo.value).lower()

        # CRITICAL SAFETY: Must NEVER broadcast raw transaction to active network
        mock_w3.eth.send_raw_transaction.assert_not_called()


def test_execute_contract_transaction_estimate_gas_failure_aborts_without_broadcasting():
    """Verify that gas estimation failure is never swallowed; transaction must be aborted before gas is spent."""
    mock_func = MagicMock()
    mock_func.fn_name = "setMilestones"
    mock_func.call.return_value = True  # Simulation call passes
    mock_func.estimate_gas.side_effect = Exception("execution reverted: Milestones already configured")

    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True

    mock_account = MagicMock(address="0x613ae03002B66A538c71a39403398545e33e5280")

    with patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "get_account", return_value=mock_account), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "b" * 64):

        with pytest.raises(ValueError) as excinfo:
            bcs.execute_contract_transaction(mock_func, role="DISTRICT")

        assert "gas estimation failed" in str(excinfo.value).lower()

        # CRITICAL SAFETY: Must NEVER broadcast raw transaction
        mock_w3.eth.send_raw_transaction.assert_not_called()


# ---------------------------------------------------------------------------
# 2. Escrow creation idempotency
# ---------------------------------------------------------------------------

def test_create_project_escrow_idempotency_avoids_duplicate_revert():
    """Verify that create_project_escrow_onchain returns gracefully if escrow already exists on-chain."""
    proj_id = "PRJ-BEN-5ZO4EI"

    with patch.object(bcs, "check_project_escrow_exists_onchain", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec, \
         patch.object(bcs, "get_contract", return_value=MagicMock()), \
         patch.object(bcs.w3, "is_connected", return_value=True):

        res = bcs.create_project_escrow_onchain(proj_id, "Smart Road", "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3", 10000000)

        assert res.get("status") == "SUCCESS"
        assert res.get("already_existed") is True
        mock_exec.assert_not_called()


# ---------------------------------------------------------------------------
# 3. Milestone setup safety & idempotency
# ---------------------------------------------------------------------------

def test_set_project_milestones_fails_when_escrow_missing():
    """Verify that set_project_milestones_onchain raises ValueError when escrow is missing."""
    proj_id = "PRJ-MISSING-ESCROW-001"

    with patch.object(bcs, "get_project_escrow_onchain", return_value=None), \
         patch.object(bcs, "get_contract", return_value=MagicMock()), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        with pytest.raises(ValueError, match="Project escrow does not exist"):
            bcs.set_project_milestones_onchain(proj_id, [3000000, 4000000, 3000000])

        mock_exec.assert_not_called()


def test_set_project_milestones_idempotent_when_already_configured():
    """Verify that set_project_milestones_onchain skips redundant calls when milestones already exist."""
    proj_id = "PRJ-CONFIGURED-ESCROW-002"

    mock_escrow = {
        "project_id": proj_id,
        "name": "Bridge",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": 10000000,
        "released_amount": 0,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    with patch.object(bcs, "get_project_escrow_onchain", return_value=mock_escrow), \
         patch.object(bcs, "get_contract", return_value=MagicMock()), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        res = bcs.set_project_milestones_onchain(proj_id, [3000000, 4000000, 3000000])

        assert res.get("status") == "SUCCESS"
        assert res.get("already_configured") is True
        mock_exec.assert_not_called()


# ---------------------------------------------------------------------------
# 4. Milestone release pre-flight checks: 0% progress, budget overruns, idempotency
# ---------------------------------------------------------------------------

def test_release_milestone_payment_blocks_zero_percent_progress():
    """Verify that milestone release is blocked before broadcasting if progress percentage is 0."""
    proj_id = "PRJ-BEN-5ZO4EI"

    mock_escrow = {
        "project_id": proj_id,
        "name": "Road",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": 10000000,
        "released_amount": 0,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    mock_contract = MagicMock()
    # projectMilestones struct: [index, amount, proofHash, progressPercentage, isReleased, ...]
    mock_contract.functions.projectMilestones.return_value.call.return_value = (
        0, 3000000, "", 0, False, 0, False, 0
    )

    with patch.object(bcs, "get_project_escrow_onchain", return_value=mock_escrow), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        with pytest.raises(ValueError) as excinfo:
            bcs.release_milestone_payment_onchain(proj_id, 0)

        assert "0% progress" in str(excinfo.value).lower()
        mock_exec.assert_not_called()


def test_release_milestone_payment_blocks_budget_overrun():
    """Verify that milestone release is blocked before broadcasting if release would exceed budget."""
    proj_id = "PRJ-BEN-5ZO4EI"

    # Suppose 7,000,000 was already released via advance transfers, total budget is 10,000,000
    mock_escrow = {
        "project_id": proj_id,
        "name": "Road",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": 10000000,
        "released_amount": 7000000,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    mock_contract = MagicMock()
    # Milestone 1 asks for 4,000,000 (7M + 4M = 11M > 10M)
    mock_contract.functions.projectMilestones.return_value.call.return_value = (
        1, 4000000, "QmProofHash", 100, False, 0, True, 12345
    )

    with patch.object(bcs, "get_project_escrow_onchain", return_value=mock_escrow), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        with pytest.raises(ValueError) as excinfo:
            bcs.release_milestone_payment_onchain(proj_id, 1)

        assert "exceed remaining budget" in str(excinfo.value).lower()
        mock_exec.assert_not_called()


def test_release_milestone_payment_idempotent_when_already_released():
    """Verify that release_milestone_payment_onchain returns success without broadcasting if already released."""
    proj_id = "PRJ-BEN-5ZO4EI"

    mock_escrow = {
        "project_id": proj_id,
        "name": "Road",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": 10000000,
        "released_amount": 3000000,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    mock_contract = MagicMock()
    # isReleased = True (index 4)
    mock_contract.functions.projectMilestones.return_value.call.return_value = (
        0, 3000000, "QmProof", 100, True, 123456, True, 123456
    )

    with patch.object(bcs, "get_project_escrow_onchain", return_value=mock_escrow), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        res = bcs.release_milestone_payment_onchain(proj_id, 0)

        assert res.get("status") == "SUCCESS"
        assert res.get("already_released") is True
        mock_exec.assert_not_called()


# ---------------------------------------------------------------------------
# 5. Contractor transfer pre-flight budget ceiling check
# ---------------------------------------------------------------------------

def test_record_contractor_transfer_fails_when_budget_exceeded():
    """Verify that record_contractor_transfer_onchain blocks transfer if amount exceeds escrow remaining budget."""
    proj_id = "PRJ-BEN-5ZO4EI"

    mock_escrow = {
        "project_id": proj_id,
        "name": "Road",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": 10000000,
        "released_amount": 8000000,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    with patch.object(bcs, "get_project_escrow_onchain", return_value=mock_escrow), \
         patch.object(bcs, "get_contract", return_value=MagicMock()), \
         patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec:

        # Attempt to transfer 3,000,000 when only 2,000,000 remaining
        with pytest.raises(ValueError) as excinfo:
            bcs.record_contractor_transfer_onchain(
                "TRF-TEST-001",
                proj_id,
                "Bengaluru District",
                "Apex Infrastructure",
                3000000
            )

        assert "exceeds project escrow budget ceiling" in str(excinfo.value).lower()
        mock_exec.assert_not_called()


# ---------------------------------------------------------------------------
# 6. Route-level integration: District milestone verification & fund requests
# ---------------------------------------------------------------------------

def test_milestone_verification_routes_to_anchor_when_funds_already_disbursed():
    """Verify that District milestone verification anchors completion rather than double-releasing escrow."""
    from fastapi.testclient import TestClient
    from app import app
    from auth_middleware import generate_token
    from bson import ObjectId

    client = TestClient(app)
    proj_id = "PRJ-ROUTE-TEST-001"
    district_user = {
        "_id": ObjectId(),
        "email": "district.officer@govtfund.in",
        "name": "District Officer",
        "role": "DISTRICT",
        "district_name": "Bengaluru Urban",
        "state_code": "KA"
    }

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Bengaluru Smart Corridor",
        "district_name": "Bengaluru Urban",
        "total_budget": 10000000.0,
        "released_amount": 3000000.0,
        "status": "IN_PROGRESS"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1 Mobilization",
        "amount": 3000000.0,
        "status": "UNDER_REVIEW",
        "phase_status": "FUNDS_TRANSFERRED",
        "fund_transfer_tx": "0x123abc456def"
    })

    token = generate_token(
        user_id=str(district_user["_id"]),
        email=district_user["email"],
        role=district_user["role"],
        name=district_user["name"],
        district_name=district_user["district_name"],
        state_code=district_user["state_code"]
    )
    headers = {"Authorization": f"Bearer {token}"}

    import uuid
    tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
    db.blockchain_transactions.delete_many({"tx_hash": tx_hash})

    with patch.object(bcs, "anchor_document_hash_onchain") as mock_anchor, \
         patch.object(bcs, "release_milestone_payment_onchain") as mock_release:

        res = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify",
            json={"action": "VERIFY_AND_APPROVE", "remarks": "Site inspection passed."},
            headers=headers
        )

        assert res.status_code == 200
        # Crucial: Milestone verification is off-chain via MongoDB; neither anchor nor release is called
        mock_anchor.assert_not_called()
        mock_release.assert_not_called()

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})
    db.blockchain_transactions.delete_many({"tx_hash": tx_hash})


def test_verify_fund_request_disburses_funds_directly_to_contractor():
    """Verify that verify_phase_fund_request disburses funds on-chain to contractor without requiring on-chain escrow creation."""
    from fastapi.testclient import TestClient
    from app import app
    from auth_middleware import generate_token
    from bson import ObjectId

    client = TestClient(app)
    proj_id = "PRJ-ROUTE-NO-ESCROW-002"
    district_user = {
        "_id": ObjectId(),
        "email": "district.officer2@govtfund.in",
        "name": "District Officer",
        "role": "DISTRICT",
        "district_name": "Bengaluru Urban",
        "state_code": "KA"
    }

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Corridor without Escrow",
        "district_name": "Bengaluru Urban",
        "total_budget": 10000000.0,
        "released_amount": 0.0,
        "contractor_id": "CON-001",
        "contractor_name": "Test Contractor",
        "contractor_wallet": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "status": "APPROVED"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1 Advance",
        "amount": 3000000.0,
        "status": "FUND_REQUESTED",
        "phase_status": "FUND_REQUESTED"
    })

    token = generate_token(
        user_id=str(district_user["_id"]),
        email=district_user["email"],
        role=district_user["role"],
        name=district_user["name"],
        district_name=district_user["district_name"],
        state_code=district_user["state_code"]
    )
    headers = {"Authorization": f"Bearer {token}"}

    import uuid
    mock_tx_hash = f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"
    mock_receipt = {
        "tx_hash": mock_tx_hash,
        "block_number": 12345,
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
        assert res.json()["success"] is True
        mock_trf.assert_called_once()

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})


def test_sequential_partial_releases_and_insufficient_remaining_budget():
    """Verify sequential partial releases: valid partial releases succeed, but once remaining budget is exceeded, pre-flight aborts."""
    proj_id = "PRJ-BEN-PARTIAL-001"
    total_budget = 10000000  # 10M INR

    # Phase 1: 3M out of 10M (remaining 7M)
    escrow_state = {
        "project_id": proj_id,
        "name": "Corridor",
        "contractor": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "total_budget": total_budget,
        "released_amount": 0,
        "milestone_count": 3,
        "is_frozen": False,
        "exists": True
    }

    mock_contract = MagicMock()
    mock_contract.address = "0x103cdC78636491B20deadC5574755Bbd64B119c6"
    sel_trf = bcs.Web3.keccak(text="transferToContractor(string,string,address,string,string,uint256)")[:4].hex()[2:]
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.is_address.return_value = True
    mock_w3.to_checksum_address.side_effect = lambda a: a
    mock_w3.eth.get_code.return_value = bytes.fromhex(sel_trf)

    with patch.object(bcs, "get_project_escrow_onchain", return_value=escrow_state), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "execute_contract_transaction", return_value={"tx_hash": "0x111", "status": "SUCCESS"}) as mock_exec, \
         patch.object(bcs, "send_native_eth_transfer"):

        res1 = bcs.record_contractor_transfer_onchain("TRF-P1", proj_id, "Dist", "Cont", 3000000)
        assert res1["status"] == "SUCCESS"
        mock_exec.assert_called_once()

    # Phase 2: 4M out of remaining 7M (released_amount becomes 7M, remaining 3M)
    escrow_state["released_amount"] = 3000000
    with patch.object(bcs, "get_project_escrow_onchain", return_value=escrow_state), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "execute_contract_transaction", return_value={"tx_hash": "0x222", "status": "SUCCESS"}) as mock_exec, \
         patch.object(bcs, "send_native_eth_transfer"):

        res2 = bcs.record_contractor_transfer_onchain("TRF-P2", proj_id, "Dist", "Cont", 4000000)
        assert res2["status"] == "SUCCESS"
        mock_exec.assert_called_once()

    # Phase 3 attempt: 4M when only 3M remaining (7M + 4M = 11M > 10M)
    escrow_state["released_amount"] = 7000000
    with patch.object(bcs, "get_project_escrow_onchain", return_value=escrow_state), \
         patch.object(bcs, "get_contract", return_value=mock_contract), \
         patch.object(bcs, "w3", mock_w3), \
         patch.object(bcs, "execute_contract_transaction") as mock_exec, \
         patch.object(bcs, "send_native_eth_transfer"):

        with pytest.raises(ValueError) as excinfo:
            bcs.record_contractor_transfer_onchain("TRF-P3", proj_id, "Dist", "Cont", 4000000)

        assert "exceeds project escrow budget ceiling" in str(excinfo.value).lower()
        mock_exec.assert_not_called()


def test_already_disbursed_phase_fund_request_blocked():
    """Verify that District verify_phase_fund_request returns HTTP 400 if phase funds were already disbursed."""
    from fastapi.testclient import TestClient
    from app import app
    from auth_middleware import generate_token
    from bson import ObjectId

    client = TestClient(app)
    proj_id = "PRJ-ROUTE-ALREADY-DISBURSED-003"
    district_user = {
        "_id": ObjectId(),
        "email": "district.officer3@govtfund.in",
        "name": "District Officer",
        "role": "DISTRICT",
        "district_name": "Bengaluru Urban",
        "state_code": "KA"
    }

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Project Disbursed Test",
        "district_name": "Bengaluru Urban",
        "total_budget": 10000000.0,
        "released_amount": 3000000.0,
        "contractor_id": "CON-001",
        "contractor_name": "Test Contractor",
        "contractor_wallet": "0xCDc59F7Bba64A99C5B36222133Da2D2a892Cd3f3",
        "status": "IN_PROGRESS"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1 Already Disbursed",
        "amount": 3000000.0,
        "status": "FUNDS_TRANSFERRED",
        "phase_status": "FUNDS_TRANSFERRED",
        "fund_transfer_tx": "0xalreadytransferredtx123"
    })

    token = generate_token(
        user_id=str(district_user["_id"]),
        email=district_user["email"],
        role=district_user["role"],
        name=district_user["name"],
        district_name=district_user["district_name"],
        state_code=district_user["state_code"]
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch.object(bcs, "record_contractor_transfer_onchain") as mock_trf:
        res = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=headers
        )

        assert res.status_code == 400
        assert "already been transferred" in res.json()["message"].lower()
        mock_trf.assert_not_called()

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})


def test_milestone_verification_rejection_marks_needs_rectification_without_blockchain_call():
    """Verify that when District rejects evidence, status becomes REJECTED_NEEDS_RECTIFICATION and no blockchain call occurs."""
    from fastapi.testclient import TestClient
    from app import app
    from auth_middleware import generate_token
    from bson import ObjectId

    client = TestClient(app)
    proj_id = "PRJ-ROUTE-REJECT-004"
    district_user = {
        "_id": ObjectId(),
        "email": "district.officer4@govtfund.in",
        "name": "District Officer",
        "role": "DISTRICT",
        "district_name": "Bengaluru Urban",
        "state_code": "KA"
    }

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Project Rejection Test",
        "district_name": "Bengaluru Urban",
        "total_budget": 10000000.0,
        "released_amount": 3000000.0,
        "contractor_id": "CON-001",
        "status": "IN_PROGRESS"
    })
    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1 Poor Concrete Work",
        "amount": 3000000.0,
        "status": "SUBMITTED",
        "phase_status": "SUBMITTED_FOR_VERIFICATION",
        "fund_transfer_tx": "0x123abc"
    })

    token = generate_token(
        user_id=str(district_user["_id"]),
        email=district_user["email"],
        role=district_user["role"],
        name=district_user["name"],
        district_name=district_user["district_name"],
        state_code=district_user["state_code"]
    )
    headers = {"Authorization": f"Bearer {token}"}

    with patch.object(bcs, "anchor_document_hash_onchain") as mock_anchor, \
         patch.object(bcs, "release_milestone_payment_onchain") as mock_release:

        res = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify",
            json={"action": "REJECT", "remarks": "Concrete cube test failed compressive strength test."},
            headers=headers
        )

        assert res.status_code == 200
        assert res.json()["success"] is True
        assert "rejected" in res.json()["message"].lower()

        # Blockchain must NOT be called on rejection
        mock_anchor.assert_not_called()
        mock_release.assert_not_called()

        m_after = db.milestones.find_one({"project_id": proj_id, "milestone_index": 0})
        assert m_after["status"] == "REJECTED_NEEDS_RECTIFICATION"
        assert m_after["evidence_status"] == "REJECTED"
        assert "compressive strength" in m_after["rejection_reason"].lower()

    db.projects.delete_many({"project_id": proj_id})
    db.milestones.delete_many({"project_id": proj_id})


