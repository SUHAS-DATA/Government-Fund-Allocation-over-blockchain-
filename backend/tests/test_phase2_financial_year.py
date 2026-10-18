import os
import sys
import uuid
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from unittest.mock import patch
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
# 1. Financial Years Registration and Validation Tests
# =========================================================================

def test_public_financial_years_list():
    """Verify public endpoint returns available financial years with active status."""
    res = client.get("/api/public/financial-years")
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    fys = data.get("financial_years", [])
    years = [f.get("year") for f in fys]
    assert "2026-27" in years
    active_fy = get_active_financial_year()
    assert active_fy in years

def test_scheme_creation_financial_year_validation():
    """Verify POST /admin/schemes rejects unregistered FY and accepts valid FY."""
    headers = get_test_headers("SUPER_ADMIN")

    # Attempt creation with invalid FY
    res_invalid = client.post("/api/admin/schemes", json={
        "code": f"SCH-BAD-{uuid.uuid4().hex[:4]}",
        "name": "Invalid FY Scheme",
        "department": "Infrastructure",
        "financial_year": "1999-00",
        "target_budget": 10000000
    }, headers=headers)
    assert res_invalid.status_code == 400
    assert "Invalid financial year" in res_invalid.json().get("message", "")

    # Valid creation with FY 2026-27
    code_26 = f"SCH26-{uuid.uuid4().hex[:4].upper()}"
    res_valid = client.post("/api/admin/schemes", json={
        "code": code_26,
        "name": f"National Expressways Plan {code_26}",
        "department": "Road Transport & Infrastructure",
        "financial_year": "2026-27",
        "target_budget": 50000000
    }, headers=headers)
    assert res_valid.status_code in [200, 201]
    assert res_valid.json().get("success") is True

    # Check scheme is saved with financial_year
    saved = db.schemes.find_one({"code": code_26})
    assert saved is not None
    assert saved.get("financial_year") == "2026-27"

# =========================================================================
# 2. Financial-Year Scoped Budget Allocations
# =========================================================================

def test_budget_allocation_scoped_to_financial_year():
    """Verify budget allocation enforces valid FY and checks ceiling within that cycle."""
    headers = get_test_headers("SUPER_ADMIN")

    # Reject invalid FY
    bad_res = client.post("/api/admin/budget/allocate", json={
        "department": "Road Transport & Infrastructure",
        "scheme_name": "Non-existent Scheme",
        "financial_year": "INVALID-YEAR",
        "amount": 1000000
    }, headers=headers)
    assert bad_res.status_code == 400
    assert "Invalid financial year" in bad_res.json().get("message", "")

    # Create distinct scheme in FY 2026-27 with small budget
    s_code = f"CEIL-{uuid.uuid4().hex[:4].upper()}"
    s_name = f"Ceiling Test Scheme {s_code}"
    client.post("/api/admin/schemes", json={
        "code": s_code,
        "name": s_name,
        "department": "Road Transport & Infrastructure",
        "financial_year": "2026-27",
        "target_budget": 20000000  # 2 Cr
    }, headers=headers)

    # Allocate within ceiling for FY 2026-27
    alloc_res = client.post("/api/admin/budget/allocate", json={
        "department": "Road Transport & Infrastructure",
        "scheme_name": s_name,
        "financial_year": "2026-27",
        "amount": 15000000  # 1.5 Cr
    }, headers=headers)
    assert alloc_res.status_code in [200, 201]
    assert alloc_res.json().get("success") is True

    # Attempting to allocate an additional 1 Cr (total 2.5 Cr) should exceed ceiling of 2 Cr
    over_res = client.post("/api/admin/budget/allocate", json={
        "department": "Road Transport & Infrastructure",
        "scheme_name": s_name,
        "financial_year": "2026-27",
        "amount": 10000000  # 1 Cr
    }, headers=headers)
    assert over_res.status_code == 400
    assert "exceed" in over_res.json().get("message", "").lower()

# =========================================================================
# 3. Year Switching & Isolation: Admin & Finance Dashboards
# =========================================================================

def test_switching_financial_years_admin_dashboard():
    """Verify switching between FYs returns only records belonging to that cycle."""
    headers = get_test_headers("SUPER_ADMIN")

    res_26 = client.get("/api/admin/dashboard?fy=2026-27", headers=headers)
    assert res_26.status_code == 200
    data_26 = res_26.json()
    assert data_26.get("success") is True
    assert data_26["metrics"]["selected_financial_year"] == "2026-27"

    res_25 = client.get("/api/admin/dashboard?fy=2025-26", headers=headers)
    assert res_25.status_code == 200
    data_25 = res_25.json()
    assert data_25.get("success") is True
    assert data_25["metrics"]["selected_financial_year"] == "2025-26"

    # Verify that recent allocations in FY 2025-26 only have financial_year == 2025-26
    for alloc in data_25.get("recent_allocations", []):
        assert alloc.get("financial_year") in ["2025-26", None]

def test_switching_financial_years_finance_dashboard():
    """Verify Finance dashboard isolates pending budgets and disbursements per FY."""
    headers = get_test_headers("FINANCE")

    res_26 = client.get("/api/finance/dashboard?fy=2026-27", headers=headers)
    assert res_26.status_code == 200
    data_26 = res_26.json()
    assert data_26.get("success") is True

    # Pending budgets in 2026-27 should all have financial_year == 2026-27
    for b in data_26.get("pending_budgets", []):
        assert b.get("financial_year") == "2026-27"

    res_25 = client.get("/api/finance/dashboard?fy=2025-26", headers=headers)
    assert res_25.status_code == 200
    data_25 = res_25.json()
    assert data_25.get("success") is True
    for b in data_25.get("pending_budgets", []):
        assert b.get("financial_year") == "2025-26"

# =========================================================================
# 4. State & District Hierarchy Flow Across Financial Years
# =========================================================================

def test_state_and_district_hierarchical_fy_propagation():
    """
    Test full cycle:
    1. Budget Allocation created in FY 2026-27
    2. Finance transfers to State -> inherits FY 2026-27
    3. State allocates to District -> inherits FY 2026-27
    4. District dashboard and received funds show it in 2026-27, NEVER in 2025-26.
    """
    admin_headers = get_test_headers("SUPER_ADMIN")
    finance_headers = get_test_headers("FINANCE")
    state_headers = get_test_headers("STATE", state_code="KA")
    district_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")

    # Step 1: Create Scheme & Budget Allocation in FY 2026-27
    s_tag = f"FLOW-{uuid.uuid4().hex[:4].upper()}"
    s_name = f"Hierarchy Test Scheme {s_tag}"
    client.post("/api/admin/schemes", json={
        "code": s_tag,
        "name": s_name,
        "department": "Road Transport & Infrastructure",
        "financial_year": "2026-27",
        "target_budget": 50000000
    }, headers=admin_headers)

    alloc_res = client.post("/api/admin/budget/allocate", json={
        "department": "Road Transport & Infrastructure",
        "scheme_name": s_name,
        "financial_year": "2026-27",
        "amount": 25000000
    }, headers=admin_headers)
    assert alloc_res.status_code in [200, 201]
    alloc_id = alloc_res.json().get("allocation_id") or alloc_res.json()["budget"]["allocation_id"]

    mock_st_receipt = {
        "tx_hash": "0x" + uuid.uuid4().hex + uuid.uuid4().hex,
        "block_number": 1001,
        "from_address": "0x1111111111111111111111111111111111111111",
        "status": "SUCCESS"
    }
    mock_dist_receipt = {
        "tx_hash": "0x" + uuid.uuid4().hex + uuid.uuid4().hex,
        "block_number": 1002,
        "from_address": "0x2222222222222222222222222222222222222222",
        "status": "SUCCESS"
    }

    with patch("blockchain_service.get_contract", return_value=None), \
         patch("blockchain_service.record_budget_allocation_onchain", return_value=mock_st_receipt), \
         patch("blockchain_service.record_state_transfer_onchain", return_value=mock_st_receipt), \
         patch("blockchain_service.record_district_allocation_onchain", return_value=mock_dist_receipt), \
         patch("blockchain_service.send_native_eth_transfer", return_value=None):

        # Step 2: Finance approves and transfers to State
        trans_res = client.post("/api/finance/approve-and-transfer", json={
            "allocation_id": alloc_id,
            "state_code": "KA",
            "amount": 20000000
        }, headers=finance_headers)
        assert trans_res.status_code in [200, 201]
        transfer_id = trans_res.json()["transfer"]["transfer_id"]

        # Verify state_transfer doc has financial_year = 2026-27
        st_doc = db.state_transfers.find_one({"transfer_id": transfer_id})
        assert st_doc is not None
        assert st_doc.get("financial_year") == "2026-27"

        # Step 3: Verify State Received Funds in 2026-27 vs 2025-26
        state_rf_26 = client.get("/api/state/received-funds?fy=2026-27", headers=state_headers).json()
        rf_ids_26 = [r["transfer_id"] for r in state_rf_26.get("received_funds", [])]
        assert transfer_id in rf_ids_26

        state_rf_25 = client.get("/api/state/received-funds?fy=2025-26", headers=state_headers).json()
        rf_ids_25 = [r["transfer_id"] for r in state_rf_25.get("received_funds", [])]
        # Record from 2026-27 MUST NEVER appear in 2025-26
        assert transfer_id not in rf_ids_25

        # Step 4: State allocates to Belagavi District
        dist_alloc_res = client.post("/api/state/allocate-to-district", json={
            "transfer_id": transfer_id,
            "district_name": "Belagavi",
            "amount": 10000000
        }, headers=state_headers)
        assert dist_alloc_res.status_code in [200, 201]
        dist_alloc_id = dist_alloc_res.json()["allocation"]["district_alloc_id"]

        # Verify district_allocation doc has financial_year = 2026-27
        da_doc = db.district_allocations.find_one({"district_alloc_id": dist_alloc_id})
        assert da_doc is not None
        assert da_doc.get("financial_year") == "2026-27"

        # Step 5: Check District Dashboard isolation
        dist_dash_26 = client.get("/api/district/dashboard?district=Belagavi&fy=2026-27", headers=district_headers).json()
        assert dist_dash_26.get("success") is True
        alloc_ids_26 = [a.get("district_alloc_id") for a in dist_dash_26.get("received_funds", [])]
        assert dist_alloc_id in alloc_ids_26

        dist_dash_25 = client.get("/api/district/dashboard?district=Belagavi&fy=2025-26", headers=district_headers).json()
        assert dist_dash_25.get("success") is True
        alloc_ids_25 = [a.get("district_alloc_id") for a in dist_dash_25.get("received_funds", [])]
        # Record from 2026-27 MUST NEVER appear in 2025-26
        assert dist_alloc_id not in alloc_ids_25

# =========================================================================
# 5. Project Creation & Financial-Year Scoped Fund Ceilings
# =========================================================================

def test_project_creation_and_balance_scoping_per_fy():
    """Verify that project creation checks scheme balance only within that financial year."""
    district_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")

    # In FY 2025-26, no allocation was made for this scheme, so balance is ₹0
    res_bad_fy = client.post("/api/district/projects", json={
        "name": "Belagavi Urban Arterial Road",
        "scheme_name": "Non-Allocated Scheme In 2025",
        "financial_year": "2025-26",
        "total_budget": 5000000,
        "department": "Road Transport & Infrastructure",
        "district_name": "Belagavi"
    }, headers=district_headers)
    assert res_bad_fy.status_code == 400
    assert "Fund Allocation Error" in res_bad_fy.json().get("message", "")

    # Reject unregistered financial year in project creation
    res_invalid_fy = client.post("/api/district/projects", json={
        "name": "Belagavi Urban Arterial Road",
        "scheme_name": "PMGSY",
        "financial_year": "1990-91",
        "total_budget": 1000000,
        "department": "Road Transport & Infrastructure",
        "district_name": "Belagavi"
    }, headers=district_headers)
    assert res_invalid_fy.status_code == 400
    assert "Invalid financial year" in res_invalid_fy.json().get("message", "")

# =========================================================================
# 6. Public Stats and Financial Transactions Filtering by FY
# =========================================================================

def test_public_stats_and_projects_fy_filtering():
    """Verify public endpoints return data scoped to requested financial year."""
    res_26 = client.get("/api/public/stats?fy=2026-27")
    assert res_26.status_code == 200
    data_26 = res_26.json()
    assert data_26["financial_year"] == "2026-27"
    assert "total_allocated_budget" in data_26["stats"]

    res_proj_26 = client.get("/api/public/projects?fy=2026-27")
    assert res_proj_26.status_code == 200
    projects_26 = res_proj_26.json().get("projects", [])
    for p in projects_26:
        assert p.get("financial_year") == "2026-27"

def test_transactions_filtered_by_fy():
    """Verify financial transactions endpoint filters correctly by financial year."""
    headers = get_test_headers("SUPER_ADMIN")
    res = client.get("/api/transactions?fy=2026-27", headers=headers)
    assert res.status_code == 200
    txs = res.json().get("transactions", [])
    for t in txs:
        assert t.get("financial_year") in ["2026-27", None]

# =========================================================================
# 7. Preserved Role Permissions Under FY Filtering
# =========================================================================

def test_role_and_jurisdiction_enforced_with_fy():
    """Verify that State and District access restrictions remain active while filtering by FY."""
    # 1. District Officer attempting to view state dashboard (role forbidden)
    district_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    res_forbidden_role = client.get("/api/state/dashboard?fy=2026-27", headers=district_headers)
    assert res_forbidden_role.status_code == 403

    # 2. Officer with no state assigned attempting to view state dashboard
    no_state_headers = get_test_headers("STATE", state_code=None)
    res_no_state = client.get("/api/state/dashboard?fy=2026-27", headers=no_state_headers)
    assert res_no_state.status_code == 403

    # 3. Officer from Belagavi attempting to access Dharwad district dashboard
    res_dist_forbidden = client.get("/api/district/dashboard?district=Dharwad&fy=2026-27", headers=district_headers)
    assert res_dist_forbidden.status_code == 403
