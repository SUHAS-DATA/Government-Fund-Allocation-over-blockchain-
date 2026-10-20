import os
import sys
import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db, get_active_financial_year
from auth_middleware import generate_token

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
# 1. Ceiling & Available Balance Validation Tests
# =========================================================================

def test_budget_allocation_cannot_exceed_scheme_ceiling():
    """Admin cannot allocate more budget than the remaining sanctioned ceiling for a scheme."""
    admin_headers = get_test_headers("SUPER_ADMIN")
    fy = get_active_financial_year()
    scheme_code = f"SCH-CEIL-{uuid.uuid4().hex[:4].upper()}"
    scheme_name = f"Ceiling Test Scheme {uuid.uuid4().hex[:4].upper()}"

    # Register scheme with 1,00,00,000 (1 Cr) target budget
    db.schemes.insert_one({
        "code": scheme_code,
        "name": scheme_name,
        "financial_year": fy,
        "department_code": "INFRA",
        "department_name": "Road Transport & Infrastructure",
        "target_budget": 10000000.0
    })

    # Sanction 80,00,000 (80 Lakhs)
    with patch("blockchain_service.record_budget_allocation_onchain") as mock_bc:
        mock_bc.return_value = {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", "block_number": 101}
        res1 = client.post("/api/admin/budget/allocate", json={
            "financial_year": fy,
            "scheme_name": scheme_name,
            "department": "Road Transport & Infrastructure",
            "amount": 8000000.0
        }, headers=admin_headers)
        assert res1.status_code == 201

    # Attempt to sanction 30,00,000 (30 Lakhs) -> Exceeds remaining 20 Lakhs ceiling!
    res2 = client.post("/api/admin/budget/allocate", json={
        "financial_year": fy,
        "scheme_name": scheme_name,
        "department": "Road Transport & Infrastructure",
        "amount": 3000000.0
    }, headers=admin_headers)
    assert res2.status_code == 400
    assert "exceeds" in res2.json().get("message", "").lower()

def test_finance_transfer_cannot_exceed_available_sanctioned_balance():
    """Ministry of Finance cannot disburse more than available balance of an allocation."""
    fin_headers = get_test_headers("FINANCE")
    fy = get_active_financial_year()
    alloc_id = f"ALC-CEIL-{uuid.uuid4().hex[:6].upper()}"

    # Allocation of 50,00,000 with 40,00,000 already disbursed
    db.budget_allocations.insert_one({
        "allocation_id": alloc_id,
        "financial_year": fy,
        "department": "Road Transport & Infrastructure",
        "scheme_name": "Ceiling Verification Scheme",
        "amount": 5000000.0,
        "disbursed_amount": 4000000.0,
        "status": "PARTIALLY_DISBURSED"
    })

    # Attempt to transfer 15,00,000 -> Exceeds 10,00,000 remaining!
    res = client.post("/api/finance/approve-and-transfer", json={
        "allocation_id": alloc_id,
        "state_code": "KA",
        "state_name": "Karnataka",
        "amount": 1500000.0,
        "sign_off_note": "Excess transfer test"
    }, headers=fin_headers)
    assert res.status_code == 400
    assert "exceeds" in res.json().get("message", "").lower()

def test_state_district_allocation_cannot_exceed_available_transfer_balance():
    """State officer cannot allocate more than remaining transfer balance to districts."""
    state_headers = get_test_headers("STATE", state_code="KA")
    trf_id = f"TRF-ST-KA-{uuid.uuid4().hex[:6].upper()}"

    # State transfer of 20,00,000 with 15,00,000 already allocated to districts
    db.state_transfers.insert_one({
        "transfer_id": trf_id,
        "state_code": "KA",
        "state_name": "Karnataka",
        "financial_year": get_active_financial_year(),
        "amount": 2000000.0,
        "allocated_to_districts": 1500000.0,
        "scheme_name": "Ceiling Verification Scheme"
    })

    # Attempt to allocate 8,00,000 to Belagavi -> Exceeds remaining 5,00,000!
    res = client.post("/api/state/allocate-to-district", json={
        "transfer_id": trf_id,
        "district_name": "Belagavi",
        "amount": 800000.0
    }, headers=state_headers)
    assert res.status_code == 400
    assert "exceeds" in res.json().get("message", "").lower()

def test_district_project_creation_cannot_exceed_available_district_balance():
    """District cannot create a project whose budget exceeds available received allocations under scheme."""
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    fy = get_active_financial_year()
    scheme_name = f"District Ceil Scheme {uuid.uuid4().hex[:4].upper()}"

    # Seed 10,00,000 received allocation for this scheme in Belagavi
    db.district_allocations.insert_one({
        "district_alloc_id": f"DIST-ALC-BEL-{uuid.uuid4().hex[:6].upper()}",
        "district_name": "Belagavi",
        "state_code": "KA",
        "scheme_name": scheme_name,
        "financial_year": fy,
        "amount": 1000000.0
    })

    # Seed an existing committed project of 7,00,000
    db.projects.insert_one({
        "project_id": f"PRJ-BEL-OLD-{uuid.uuid4().hex[:4].upper()}",
        "name": "Existing Belagavi Road",
        "district_name": "Belagavi",
        "scheme_name": scheme_name,
        "financial_year": fy,
        "total_budget": 700000.0,
        "released_amount": 0.0,
        "status": "IN_PROGRESS"
    })

    # Attempt to create new project with 5,00,000 budget -> Exceeds available 3,00,000!
    res = client.post("/api/district/projects", json={
        "name": "Excess Budget Road",
        "scheme_name": scheme_name,
        "district_name": "Belagavi",
        "total_budget": 500000.0,
        "financial_year": fy
    }, headers=dist_headers)
    assert res.status_code == 400
    assert "exceeds" in res.json().get("message", "").lower()

def test_transfer_to_contractor_cannot_exceed_remaining_project_budget():
    """District transfer directly to contractor cannot exceed remaining project budget."""
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    proj_id = f"PRJ-BEL-TRF-{uuid.uuid4().hex[:4].upper()}"

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Contractor Transfer Ceiling Test",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 1000000.0,
        "released_amount": 900000.0,
        "status": "IN_PROGRESS"
    })

    # Attempt to disburse 2,00,000 -> Exceeds remaining 1,00,000!
    res = client.post("/api/district/transfer-to-contractor", json={
        "project_id": proj_id,
        "amount": 200000.0,
        "district_name": "Belagavi",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd"
    }, headers=dist_headers)
    assert res.status_code == 400
    assert "exceeds" in res.json().get("message", "").lower()

# =========================================================================
# 2. Idempotency & Duplicate Request Protection Tests
# =========================================================================

def test_idempotency_prevents_duplicate_finance_transfer():
    """Submitting the same transfer with identical idempotency_key returns existing record without double-decrementing."""
    fin_headers = get_test_headers("FINANCE")
    fy = get_active_financial_year()
    alloc_id = f"ALC-IDEM-{uuid.uuid4().hex[:6].upper()}"
    idempotency_key = f"IDEM-KEY-{uuid.uuid4().hex}"

    db.budget_allocations.insert_one({
        "allocation_id": alloc_id,
        "financial_year": fy,
        "department": "Road Transport & Infrastructure",
        "scheme_name": "Idempotency Scheme",
        "amount": 1000000.0,
        "disbursed_amount": 0.0,
        "status": "SANCTIONED"
    })

    with patch("blockchain_service.get_contract", return_value=None), \
         patch("blockchain_service.record_state_transfer_onchain") as mock_bc:
        mock_bc.return_value = {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", "block_number": 201}

        # Request 1
        res1 = client.post(
            "/api/finance/approve-and-transfer",
            json={
                "allocation_id": alloc_id,
                "state_code": "KA",
                "state_name": "Karnataka",
                "amount": 400000.0,
                "idempotency_key": idempotency_key
            },
            headers={**fin_headers, "X-Idempotency-Key": idempotency_key}
        )
        assert res1.status_code == 201
        data1 = res1.json()
        assert data1.get("success") is True

        # Check disbursed amount after Request 1
        alloc_after_1 = db.budget_allocations.find_one({"allocation_id": alloc_id})
        assert alloc_after_1["disbursed_amount"] == 400000.0

        # Request 2 with SAME idempotency_key (Retry / Network replay)
        res2 = client.post(
            "/api/finance/approve-and-transfer",
            json={
                "allocation_id": alloc_id,
                "state_code": "KA",
                "state_name": "Karnataka",
                "amount": 400000.0,
                "idempotency_key": idempotency_key
            },
            headers={**fin_headers, "X-Idempotency-Key": idempotency_key}
        )
        assert res2.status_code == 200
        data2 = res2.json()
        assert data2.get("is_duplicate") is True

        # CRITICAL: Disbursed amount must NOT have been incremented a second time!
        alloc_after_2 = db.budget_allocations.find_one({"allocation_id": alloc_id})
        assert alloc_after_2["disbursed_amount"] == 400000.0
        # Blockchain service should have been called only once
        assert mock_bc.call_count == 1

def test_idempotency_prevents_duplicate_state_allocation():
    """State allocation with identical idempotency_key deduplicates safely without double allocation."""
    state_headers = get_test_headers("STATE", state_code="KA")
    trf_id = f"TRF-ST-IDEM-{uuid.uuid4().hex[:6].upper()}"
    idempotency_key = f"IDEM-STATE-{uuid.uuid4().hex}"

    db.state_transfers.insert_one({
        "transfer_id": trf_id,
        "state_code": "KA",
        "state_name": "Karnataka",
        "financial_year": get_active_financial_year(),
        "amount": 1000000.0,
        "allocated_to_districts": 0.0,
        "scheme_name": "Idempotency State Scheme"
    })

    with patch("blockchain_service.get_contract", return_value=None), \
         patch("blockchain_service.record_district_allocation_onchain") as mock_bc:
        mock_bc.return_value = {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", "block_number": 301}

        res1 = client.post(
            "/api/state/allocate-to-district",
            json={
                "transfer_id": trf_id,
                "district_name": "Belagavi",
                "amount": 300000.0,
                "idempotency_key": idempotency_key
            },
            headers={**state_headers, "X-Idempotency-Key": idempotency_key}
        )
        assert res1.status_code == 201

        # Check allocated_to_districts
        trf_after_1 = db.state_transfers.find_one({"transfer_id": trf_id})
        assert trf_after_1["allocated_to_districts"] == 300000.0

        # Re-send same request
        res2 = client.post(
            "/api/state/allocate-to-district",
            json={
                "transfer_id": trf_id,
                "district_name": "Belagavi",
                "amount": 300000.0,
                "idempotency_key": idempotency_key
            },
            headers={**state_headers, "X-Idempotency-Key": idempotency_key}
        )
        assert res2.status_code == 200
        assert res2.json().get("is_duplicate") is True

        # allocated_to_districts must still be 300000, not 600000
        trf_after_2 = db.state_transfers.find_one({"transfer_id": trf_id})
        assert trf_after_2["allocated_to_districts"] == 300000.0

# =========================================================================
# 3. Milestone Validation & Payment Release Tests
# =========================================================================

def test_milestone_validation_amounts_and_percentage_ceilings():
    """Setting milestones validates positive amount, total project budget ceiling, and percentage limit."""
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    proj_id = f"PRJ-MS-VAL-{uuid.uuid4().hex[:4].upper()}"

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Milestone Validation Project",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 1000000.0,
        "released_amount": 0.0,
        "status": "CREATED"
    })

    # 1. Milestone amount <= 0 rejected
    res_neg = client.post(f"/api/district/projects/{proj_id}/milestones", json={
        "milestones": [
            {"title": "Phase 1", "amount": -50000.0, "progress_percentage": 20}
        ]
    }, headers=dist_headers)
    assert res_neg.status_code == 400
    assert "greater than zero" in res_neg.json().get("message", "").lower()

    # 2. Sum of milestones > total budget rejected
    res_ceil = client.post(f"/api/district/projects/{proj_id}/milestones", json={
        "milestones": [
            {"title": "Phase 1", "amount": 600000.0, "progress_percentage": 50},
            {"title": "Phase 2", "amount": 600000.0, "progress_percentage": 50}
        ]
    }, headers=dist_headers)
    assert res_ceil.status_code == 400
    assert "exceeds" in res_ceil.json().get("message", "").lower()

    # 3. Sum of percentages > 100% rejected
    res_pct = client.post(f"/api/district/projects/{proj_id}/milestones", json={
        "milestones": [
            {"title": "Phase 1", "amount": 300000.0, "progress_percentage": 60},
            {"title": "Phase 2", "amount": 300000.0, "progress_percentage": 60}
        ]
    }, headers=dist_headers)
    assert res_pct.status_code == 400
    assert "exceeds 100%" in res_pct.json().get("message", "").lower()

    # 4. Valid configuration succeeds
    with patch("blockchain_service.set_project_milestones_onchain") as mock_bc:
        mock_bc.return_value = {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}"}
        res_ok = client.post(f"/api/district/projects/{proj_id}/milestones", json={
            "milestones": [
                {"title": "Phase 1", "amount": 400000.0, "progress_percentage": 40},
                {"title": "Phase 2", "amount": 600000.0, "progress_percentage": 60}
            ]
        }, headers=dist_headers)
        assert res_ok.status_code == 200
        assert res_ok.json().get("success") is True

def test_milestone_immutability_once_funded():
    """Milestones cannot be altered or deleted once funds have been disbursed."""
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    proj_id = f"PRJ-MS-IMMUT-{uuid.uuid4().hex[:4].upper()}"

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Funded Project",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 1000000.0,
        "released_amount": 400000.0,  # funds already disbursed!
        "status": "IN_PROGRESS"
    })

    res = client.post(f"/api/district/projects/{proj_id}/milestones", json={
        "milestones": [
            {"title": "New Phase 1", "amount": 500000.0}
        ]
    }, headers=dist_headers)
    assert res.status_code == 400
    assert "cannot modify milestones" in res.json().get("message", "").lower()

def test_phase_fund_request_duplicate_and_completion_consistency():
    """Phase fund request cannot be approved twice and milestone completion does not double-count released amount."""
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    proj_id = f"PRJ-MS-PHASE-{uuid.uuid4().hex[:4].upper()}"

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Phase Flow Test",
        "district_name": "Belagavi",
        "state_code": "KA",
        "total_budget": 1000000.0,
        "released_amount": 0.0,
        "contractor_id": "CON-TEST-001",
        "contractor_name": "Apex Infrastructure Contractors Pvt Ltd",
        "status": "IN_PROGRESS"
    })

    db.milestones.insert_one({
        "project_id": proj_id,
        "milestone_index": 0,
        "title": "Phase 1 Mobilization",
        "amount": 300000.0,
        "status": "FUND_REQUESTED",
        "progress_percentage": 0
    })

    with patch("blockchain_service.release_milestone_payment_onchain") as mock_bc:
        mock_bc.side_effect = lambda *args, **kwargs: {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", "block_number": 401}

        # Step 1: Approve fund request
        res1 = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res1.status_code == 200
        assert res1.json().get("success") is True

        # Check released_amount on project is now 300000
        p1 = db.projects.find_one({"project_id": proj_id})
        assert p1["released_amount"] == 300000.0

        # Step 2: Attempt to approve the SAME phase again -> blocked!
        res_dup = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res_dup.status_code == 400
        assert "already" in res_dup.json().get("message", "").lower()

        # Step 3: Complete the phase and verify completion
        # Must NOT add 300000 a second time to released_amount!
        res_comp = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res_comp.status_code == 200

        p2 = db.projects.find_one({"project_id": proj_id})
        # released_amount MUST remain 300000, NOT become 600000!
        assert p2["released_amount"] == 300000.0

# =========================================================================
# 4. Blockchain Failure & Consistency Tests
# =========================================================================

def test_blockchain_failure_rolls_back_reservation_and_returns_500():
    """If a blockchain transaction fails/reverts, balance reservation rolls back and no financial success record is created."""
    fin_headers = get_test_headers("FINANCE")
    fy = get_active_financial_year()
    alloc_id = f"ALC-FAIL-{uuid.uuid4().hex[:6].upper()}"

    db.budget_allocations.insert_one({
        "allocation_id": alloc_id,
        "financial_year": fy,
        "department": "Road Transport & Infrastructure",
        "scheme_name": "Rollback Test Scheme",
        "amount": 2000000.0,
        "disbursed_amount": 500000.0,
        "status": "PARTIALLY_DISBURSED"
    })

    with patch("blockchain_service.record_state_transfer_onchain") as mock_bc:
        # Simulate blockchain RPC failure / revert
        mock_bc.side_effect = Exception("Ganache RPC node timed out or transaction reverted on-chain")

        res = client.post("/api/finance/approve-and-transfer", json={
            "allocation_id": alloc_id,
            "state_code": "KA",
            "state_name": "Karnataka",
            "amount": 500000.0,
            "sign_off_note": "Failed transfer test"
        }, headers=fin_headers)

        assert res.status_code == 500
        assert "blockchain transaction failed" in res.json().get("message", "").lower()

        # CRITICAL VERIFICATION:
        # 1. Disbursed amount must have rolled back to 500000 (NOT incremented to 1000000)
        alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
        assert alloc["disbursed_amount"] == 500000.0

        # 2. No successful financial transaction record was created
        ft = db.financial_transactions.find_one({"related_allocation_id": alloc_id, "amount": 500000.0, "status": "COMPLETED"})
        assert ft is None

        # 3. No state transfer record was created
        st = db.state_transfers.find_one({"allocation_id": alloc_id, "amount": 500000.0})
        assert st is None

def test_blockchain_reverted_receipt_raises_exception():
    """execute_contract_transaction must raise Exception when receipt.status == 0."""
    import blockchain_service as bcs
    from unittest.mock import MagicMock

    mock_receipt = MagicMock()
    mock_receipt.status = 0  # Reverted!
    mock_receipt.transactionHash = b"reverted_hash_1234567890123456"
    mock_receipt.blockNumber = 999
    mock_receipt.gasUsed = 50000

    with patch.object(bcs.w3, "is_connected", return_value=True), \
         patch.object(bcs.w3.eth, "get_transaction_count", return_value=1), \
         patch.object(bcs.w3.eth, "send_raw_transaction", return_value=b"reverted_hash_1234567890123456"), \
         patch.object(bcs.w3.eth, "wait_for_transaction_receipt", return_value=mock_receipt), \
         patch.object(bcs, "get_private_key_for_role", return_value="0x" + "a" * 64), \
         patch.object(bcs, "get_account", return_value=MagicMock(address="0x1111111111111111111111111111111111111111")):
        
        mock_func = MagicMock()
        mock_func.estimate_gas.return_value = 100000
        mock_func.build_transaction.return_value = {
            "to": "0x7A259d42d1F6e24cfF76aDDF89eEBDAC195E1c20",
            "value": 0,
            "gas": 500000,
            "gasPrice": 20000000000,
            "nonce": 1,
            "chainId": 1337
        }

        with pytest.raises(Exception) as excinfo:
            bcs.execute_contract_transaction(mock_func, role="SUPER_ADMIN")
        
        assert "reverted" in str(excinfo.value).lower()

def test_sequential_phases_and_verification_reconciliation_prevent_insufficient_budget():
    """
    Regression test for:
    Phase #1 (30 Lakh) advance transferred -> contractor submits work evidence ->
    District Officer verifies Phase #1 -> released_amount MUST NOT double count.
    Contractor requests Phase #2 (40 Lakh) -> District Officer approves -> MUST SUCCEED
    without 'Insufficient available project budget' error.
    """
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    con_headers = get_test_headers("CONTRACTOR", user_id="test_contractor_user", state_code="KA", district_name="Belagavi")
    fy = get_active_financial_year()
    proj_id = f"PRJ-TEST-P2-{uuid.uuid4().hex[:6].upper()}"

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Phase 2 Disbursal Test Project",
        "financial_year": fy,
        "total_budget": 10000000.0,  # 1.00 Cr
        "released_amount": 0.0,
        "status": "ACCEPTED",
        "district_name": "Belagavi",
        "state_code": "KA",
        "contractor_id": "test_contractor_user",
        "contractor_name": "Test Infrastructure Ltd",
        "contractor_wallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "created_at": datetime.now(timezone.utc)
    })

    # 3 Phases: 30%, 40%, 30%
    db.milestones.insert_many([
        {
            "project_id": proj_id,
            "milestone_index": 0,
            "phase_number": 1,
            "title": "Phase 1: Foundation (30%)",
            "amount": 3000000.0,
            "percentage_share": 30,
            "status": "FUND_REQUESTED",
            "phase_status": "FUND_REQUESTED",
            "progress_percentage": 0
        },
        {
            "project_id": proj_id,
            "milestone_index": 1,
            "phase_number": 2,
            "title": "Phase 2: Core Civil (40%)",
            "amount": 4000000.0,
            "percentage_share": 40,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "progress_percentage": 0
        },
        {
            "project_id": proj_id,
            "milestone_index": 2,
            "phase_number": 3,
            "title": "Phase 3: Final Handover (30%)",
            "amount": 3000000.0,
            "percentage_share": 30,
            "status": "LOCKED",
            "phase_status": "LOCKED",
            "progress_percentage": 0
        }
    ])

    with patch("blockchain_service.release_milestone_payment_onchain") as mock_bc:
        mock_bc.side_effect = lambda *args, **kwargs: {"tx_hash": f"0x{uuid.uuid4().hex}{uuid.uuid4().hex}", "block_number": 501}

        # Step 1: District Officer approves Phase #1 fund request
        res1 = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify-fund-request",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res1.status_code == 200, res1.text
        assert res1.json().get("success") is True

        p1 = db.projects.find_one({"project_id": proj_id})
        assert p1["released_amount"] == 3000000.0

        # Step 2: Contractor submits work progress for Phase #1 (transitioning milestone status to SUBMITTED)
        res_sub = client.post(
            f"/api/contractor/projects/{proj_id}/phases/0/submit-milestone",
            data={"percentage": "100", "notes": "Foundation completed"},
            headers=con_headers
        )
        assert res_sub.status_code == 200, res_sub.text
        m0 = db.milestones.find_one({"project_id": proj_id, "milestone_index": 0})
        assert m0["status"] == "SUBMITTED"

        # Step 3: District Officer verifies completion of Phase #1
        res_v = client.post(
            f"/api/district/projects/{proj_id}/phases/0/verify",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res_v.status_code == 200, res_v.text

        # released_amount MUST remain 3000000.0, NOT 6000000.0!
        p_after_v = db.projects.find_one({"project_id": proj_id})
        assert p_after_v["released_amount"] == 3000000.0

        # Step 4: Contractor requests funds for Phase #2 (40 Lakh)
        res_req2 = client.post(
            f"/api/contractor/projects/{proj_id}/phases/1/request-funds",
            json={"requested_amount": 4000000.0, "notes": "Phase 2 mobilization advance"},
            headers=con_headers
        )
        assert res_req2.status_code == 200, res_req2.text
        m1 = db.milestones.find_one({"project_id": proj_id, "milestone_index": 1})
        assert m1["status"] == "FUND_REQUESTED"

        # Step 5: District Officer approves Phase #2 fund request
        # This MUST succeed and NOT throw "Insufficient available project budget"!
        res_approve2 = client.post(
            f"/api/district/projects/{proj_id}/phases/1/verify-fund-request",
            json={"action": "APPROVE"},
            headers=dist_headers
        )
        assert res_approve2.status_code == 200, res_approve2.text
        assert res_approve2.json().get("success") is True

        p_final = db.projects.find_one({"project_id": proj_id})
        # released_amount is now 30 Lakh + 40 Lakh = 70 Lakh!
        assert p_final["released_amount"] == 7000000.0


def test_reconcile_heals_historical_released_amount_drift():
    """
    Verifies that if db.projects.released_amount has historically drifted (e.g. 10,000,000.0
    when only Phase #1 was funded), accessing project details or approving Phase #2 auto-heals
    the released_amount to 3,000,000.0 and allows Phase #2 disbursal.
    """
    dist_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    fy = get_active_financial_year()
    proj_id = f"PRJ-TEST-DRIFT-{uuid.uuid4().hex[:6].upper()}"

    # Insert project with corrupted released_amount (1 Cr instead of 30 Lakh)
    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Drift Auto-Heal Test Project",
        "financial_year": fy,
        "total_budget": 10000000.0,
        "released_amount": 10000000.0,  # Corrupted released_amount!
        "status": "IN_PROGRESS",
        "district_name": "Belagavi",
        "state_code": "KA",
        "contractor_id": "test_contractor_user",
        "contractor_name": "Test Infrastructure Ltd",
        "contractor_wallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "created_at": datetime.now(timezone.utc)
    })

    db.milestones.insert_many([
        {
            "project_id": proj_id,
            "milestone_index": 0,
            "phase_number": 1,
            "title": "Phase 1: Foundation (30%)",
            "amount": 3000000.0,
            "status": "COMPLETED",
            "phase_status": "COMPLETED",
            "funds_transferred_at": datetime.now(timezone.utc),
            "transfer_tx_hash": "0xmocktx001"
        },
        {
            "project_id": proj_id,
            "milestone_index": 1,
            "phase_number": 2,
            "title": "Phase 2: Core Civil (40%)",
            "amount": 4000000.0,
            "status": "FUND_REQUESTED",
            "phase_status": "FUND_REQUESTED"
        },
        {
            "project_id": proj_id,
            "milestone_index": 2,
            "phase_number": 3,
            "title": "Phase 3: Final Handover (30%)",
            "amount": 3000000.0,
            "status": "LOCKED",
            "phase_status": "LOCKED"
        }
    ])

    # 1. Fetching project details auto-heals released_amount in DB
    res_details = client.get(f"/api/district/projects/{proj_id}", headers=dist_headers)
    assert res_details.status_code == 200
    assert res_details.json()["project"]["released_amount"] == 3000000.0

    p_in_db = db.projects.find_one({"project_id": proj_id})
    assert p_in_db["released_amount"] == 3000000.0

    # 2. Approving Phase #2 now succeeds smoothly without budget error
    res_approve = client.post(
        f"/api/district/projects/{proj_id}/phases/1/verify-fund-request",
        json={"action": "APPROVE"},
        headers=dist_headers
    )
    assert res_approve.status_code == 200
    assert res_approve.json().get("success") is True

    p_after = db.projects.find_one({"project_id": proj_id})
    assert p_after["released_amount"] == 7000000.0

