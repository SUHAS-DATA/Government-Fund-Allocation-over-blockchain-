import os
import sys
import pytest
from datetime import datetime, timezone
from bson import ObjectId
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token, hash_password

client = TestClient(app)

TEST_AUDITOR_EMAIL = "test.cag.auditor@govtfund.in"
TEST_AUDITOR_PASS = "AuditorSecurePass@2026"

@pytest.fixture(scope="module", autouse=True)
def setup_test_auditor():
    """Provision a verified test auditor user in MongoDB and clean up after test suite."""
    db.users.delete_many({"email": TEST_AUDITOR_EMAIL})
    res = db.users.insert_one({
        "name": "CAG Principal Audit Officer",
        "email": TEST_AUDITOR_EMAIL,
        "username": "cag_auditor_test",
        "officer_id": "AUD-CAG-001",
        "password": hash_password(TEST_AUDITOR_PASS),
        "role": "AUDITOR",
        "department": "Comptroller & Auditor General of India",
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    })
    auditor_id = str(res.inserted_id)

    yield auditor_id

    # Clean up test user
    db.users.delete_many({"email": TEST_AUDITOR_EMAIL})


# =============================================================================
# 1. AUTHENTICATION & LOGIN TESTS
# =============================================================================

def test_auditor_login_success(setup_test_auditor):
    """Auditor login succeeds with valid Auditor credentials and returns JWT token with AUDITOR role."""
    res = client.post("/api/auth/auditor/login", json={
        "identifier": TEST_AUDITOR_EMAIL,
        "password": TEST_AUDITOR_PASS
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["role"] == "AUDITOR"
    assert data["user"]["email"] == TEST_AUDITOR_EMAIL

def test_auditor_login_with_username():
    """Auditor login succeeds with username or officer_id identifier."""
    res = client.post("/api/auth/auditor/login", json={
        "identifier": "cag_auditor_test",
        "password": TEST_AUDITOR_PASS
    })
    assert res.status_code == 200
    assert res.json()["success"] is True

def test_auditor_login_invalid_password():
    """Invalid password is rejected with 401 Unauthorized."""
    res = client.post("/api/auth/auditor/login", json={
        "identifier": TEST_AUDITOR_EMAIL,
        "password": "WrongPassword@999"
    })
    assert res.status_code == 401
    assert res.json()["success"] is False

def test_auditor_login_nonexistent_user():
    """Non-existent identifier is rejected with 401 Unauthorized."""
    res = client.post("/api/auth/auditor/login", json={
        "identifier": "nonexistent.auditor@gov.in",
        "password": "AnyPassword@123"
    })
    assert res.status_code == 401
    assert res.json()["success"] is False

def test_non_auditor_accounts_rejected_at_auditor_login():
    """
    Super Admin, Finance, State, District, and Contractor accounts
    are strictly rejected with 403 Forbidden when attempting to log in through the Auditor Portal.
    """
    # 1. Super Admin attempt
    res_admin = client.post("/api/auth/auditor/login", json={
        "identifier": "admin@govtfund.gov.in",
        "password": "Admin@123"
    })
    assert res_admin.status_code == 403
    assert "Access Denied" in res_admin.json()["message"]
    assert "AUDITOR" in res_admin.json()["message"]

    # 2. Finance Department attempt
    res_fin = client.post("/api/auth/auditor/login", json={
        "identifier": "finance@govtfund.gov.in",
        "password": "Finance@123"
    })
    assert res_fin.status_code == 403
    assert "Access Denied" in res_fin.json()["message"]

    # 3. State Officer attempt
    res_state = client.post("/api/auth/auditor/login", json={
        "identifier": "karnataka@govtfund.gov.in",
        "password": "State@123"
    })
    assert res_state.status_code == 403
    assert "Access Denied" in res_state.json()["message"]

    # 4. Contractor attempt
    res_con = client.post("/api/auth/auditor/login", json={
        "identifier": "contractor@buildcorp.in",
        "password": "Contractor@123"
    })
    assert res_con.status_code == 403
    assert "Access Denied" in res_con.json()["message"]

def test_unauthenticated_requests_to_auditor_apis_rejected():
    """Unauthenticated requests to any auditor API return 401 Unauthorized."""
    res = client.get("/api/auditor/dashboard-summary")
    assert res.status_code == 401

    res2 = client.get("/api/auditor/super-admin")
    assert res2.status_code == 401

    res3 = client.get("/api/auditor/central-log")
    assert res3.status_code == 401

def test_invalid_jwt_token_rejected():
    """Requests with malformed or invalid JWT tokens return 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.jwt.token.here"}
    res = client.get("/api/auditor/dashboard-summary", headers=headers)
    assert res.status_code == 401


# =============================================================================
# 2. AUTHORIZATION & READ-ONLY ENFORCEMENT TESTS
# =============================================================================

def test_auditor_can_read_all_five_blocks(setup_test_auditor):
    """Auditor with valid token can access all five audit modules and central logs."""
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    # Summary
    r_sum = client.get("/api/auditor/dashboard-summary", headers=headers)
    assert r_sum.status_code == 200
    assert r_sum.json()["success"] is True
    assert len(r_sum.json()["modules"]) == 5

    # Block 1: Super Admin
    r_sa = client.get("/api/auditor/super-admin", headers=headers)
    assert r_sa.status_code == 200
    assert r_sa.json()["success"] is True

    # Block 2: Finance
    r_fin = client.get("/api/auditor/finance", headers=headers)
    assert r_fin.status_code == 200
    assert r_fin.json()["success"] is True

    # Block 3: State
    r_st = client.get("/api/auditor/state", headers=headers)
    assert r_st.status_code == 200
    assert r_st.json()["success"] is True
    assert "reconciliation_summary" in r_st.json()

    # Block 4: District
    r_dist = client.get("/api/auditor/district", headers=headers)
    assert r_dist.status_code == 200
    assert r_dist.json()["success"] is True
    assert "verification_history" in r_dist.json()

    # Block 5: Contractor
    r_con = client.get("/api/auditor/contractor", headers=headers)
    assert r_con.status_code == 200
    assert r_con.json()["success"] is True
    assert "contractor_profiles" in r_con.json()

    # Central Log
    r_cl = client.get("/api/auditor/central-log", headers=headers)
    assert r_cl.status_code == 200
    assert r_cl.json()["success"] is True

def test_auditor_cannot_mutate_records(setup_test_auditor):
    """
    CRITICAL SECURITY TEST: Auditor role is strictly read-only.
    Auditor CANNOT create schemes, allocate budgets, initiate transfers, or approve milestones.
    """
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Cannot create scheme
    r_scheme = client.post("/api/admin/schemes", headers=headers, json={
        "code": "AUDIT-FORBIDDEN-SCHEME",
        "name": "Forbidden Scheme Attempt",
        "financial_year": "2026-27"
    })
    assert r_scheme.status_code == 403

    # 2. Cannot sanction budget allocation
    r_alloc = client.post("/api/admin/budget/allocate", headers=headers, json={
        "scheme_code": "TEST",
        "amount": 1000000
    })
    assert r_alloc.status_code == 403

    # 3. Cannot initiate state fund transfer
    r_trf = client.post("/api/finance/transfer-to-state", headers=headers, json={
        "allocation_id": "ALLOC-TEST",
        "amount": 500000
    })
    assert r_trf.status_code == 403

    # 4. Cannot create project
    r_proj = client.post("/api/district/projects", headers=headers, json={
        "name": "Unauthorized Project"
    })
    assert r_proj.status_code == 403

    # 5. Cannot approve milestone fund release
    r_ms = client.post("/api/district/projects/PRJ-TEST/phases/0/approve-funds", headers=headers, json={
        "tx_hash": "0x1234"
    })
    assert r_ms.status_code == 403


# =============================================================================
# 3. DATA ACCURACY & RECONCILIATION TESTS
# =============================================================================

def test_state_reconciliation_calculation(setup_test_auditor):
    """
    Verify mathematical reconciliation integrity:
    Funds Received -> Funds Transferred to Districts -> Remaining Recorded Balance.
    """
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/auditor/state", headers=headers)
    assert res.status_code == 200
    data = res.json()

    summary = data["reconciliation_summary"]
    rec = summary["total_funds_received"]
    trf = summary["total_transferred_to_districts"]
    bal = summary["remaining_recorded_balance"]

    # Mathematical relationship must hold exactly
    assert round(bal, 2) == round(max(0.0, rec - trf), 2)

def test_contractor_confidential_sanitization(setup_test_auditor):
    """
    Verify that auditor contractor profiles do NOT expose confidential passwords,
    auth tokens, private keys, or raw banking/PAN details.
    """
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    res = client.get("/api/auditor/contractor", headers=headers)
    assert res.status_code == 200
    profiles = res.json().get("contractor_profiles", [])

    for p in profiles:
        assert "password" not in p
        assert "private_key" not in p
        assert "token" not in p
        if p.get("pan_masked"):
            # PAN must be masked (e.g. ABCXXXX12)
            assert "XXXX" in p["pan_masked"] or p["pan_masked"] == "N/A"
        if p.get("masked_account"):
            # Account must be masked (XXXX XXXX 1234)
            assert "XXXX" in p["masked_account"] or p["masked_account"] == "N/A"

def test_central_audit_log_filtering_and_pagination(setup_test_auditor):
    """Verify central audit log filters, pagination, and sorting."""
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    # Filter by SUPER_ADMIN role
    res_sa = client.get("/api/auditor/central-log?role=SUPER_ADMIN&limit=10", headers=headers)
    assert res_sa.status_code == 200
    data_sa = res_sa.json()
    assert data_sa["success"] is True
    for item in data_sa["audit_logs"]:
        assert item["actor_role"] == "SUPER_ADMIN"

    # Pagination
    res_p1 = client.get("/api/auditor/central-log?page=1&limit=5", headers=headers)
    assert res_p1.status_code == 200
    assert len(res_p1.json()["audit_logs"]) <= 5
    assert res_p1.json()["page"] == 1

def test_fund_journey_trace_endpoint(setup_test_auditor):
    """Verify 5-tier fund journey traceability engine handles known allocations."""
    token = generate_token(setup_test_auditor, TEST_AUDITOR_EMAIL, "AUDITOR", "CAG Principal Auditor")
    headers = {"Authorization": f"Bearer {token}"}

    # Find any existing allocation in database
    alloc = db.budget_allocations.find_one({})
    if alloc and alloc.get("allocation_id"):
        alloc_id = alloc["allocation_id"]
        res = client.get(f"/api/auditor/trace-fund/{alloc_id}", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["stages_discovered"] >= 1
        assert data["stages"][0]["tier"] == "SUPER_ADMIN"
