import os
import sys
import uuid
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db, get_active_financial_year
from auth_middleware import generate_token
import bank_account_service as bas

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
# 1. Cross-State Isolation Tests
# =========================================================================

def test_state_officer_cross_state_bank_account_inspection_blocked():
    """State officer from KA cannot inspect MH State Treasury or MH District bank accounts."""
    ka_headers = get_test_headers("STATE", state_code="KA")

    # 1. Cross-state treasury account
    res_state = client.get("/api/bank-accounts/state/MH", headers=ka_headers)
    assert res_state.status_code == 403
    assert "Access Denied" in res_state.json().get("message", "")

    # 2. Cross-state district account (Pune is in MH)
    res_dist = client.get("/api/bank-accounts/district/Pune", headers=ka_headers)
    assert res_dist.status_code == 403
    assert "jurisdiction" in res_dist.json().get("message", "").lower() or "denied" in res_dist.json().get("message", "").lower()

    # 3. Authorized own-state district account (Belagavi is in KA)
    res_own = client.get("/api/bank-accounts/district/Belagavi", headers=ka_headers)
    assert res_own.status_code == 200
    assert res_own.json().get("success") is True

def test_state_officer_cross_state_allocation_blocked():
    """State officer from KA cannot allocate funds belonging to a MH state transfer."""
    ka_headers = get_test_headers("STATE", state_code="KA")
    mh_transfer_id = f"TRF-MH-TEST-{uuid.uuid4().hex[:6].upper()}"

    # Insert a synthetic MH state transfer
    db.state_transfers.insert_one({
        "transfer_id": mh_transfer_id,
        "allocation_id": "ALLOC-TEST-MH-01",
        "state_code": "MH",
        "state_name": "Maharashtra",
        "amount": 50000000.0,
        "allocated_to_districts": 0.0,
        "financial_year": "2026-27"
    })

    try:
        # KA officer attempts to disburse from MH transfer
        res = client.post("/api/state/allocate-to-district", json={
            "transfer_id": mh_transfer_id,
            "district_name": "Belagavi",
            "amount": 10000000.0
        }, headers=ka_headers)
        assert res.status_code == 403
        assert "Cross-state allocation forbidden" in res.json().get("message", "")
    finally:
        db.state_transfers.delete_one({"transfer_id": mh_transfer_id})

def test_state_officer_unassigned_state_blocked():
    """State user with missing state assignment cannot access state dashboard."""
    no_state_headers = get_test_headers("STATE", state_code=None)
    res = client.get("/api/state/dashboard", headers=no_state_headers)
    assert res.status_code == 403
    assert "No state assigned" in res.json().get("message", "")

# =========================================================================
# 2. State-Level Work Evidence Deliverables Isolation
# =========================================================================

def test_state_officer_cross_state_evidence_access_blocked():
    """State officer from KA cannot inspect work evidence deliverables of a project in MH."""
    ka_headers = get_test_headers("STATE", state_code="KA")
    mh_headers = get_test_headers("STATE", state_code="MH")

    proj_id = f"PROJ-MH-EV-{uuid.uuid4().hex[:6].upper()}"
    ev_id = f"EV-MH-{uuid.uuid4().hex[:6].upper()}"
    test_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads", f"{ev_id}.txt")

    # Create dummy evidence physical file
    os.makedirs(os.path.dirname(test_file_path), exist_ok=True)
    with open(test_file_path, "w", encoding="utf-8") as f:
        f.write("CONFIDENTIAL WORK EVIDENCE DELIVERABLE")

    db.projects.insert_one({
        "project_id": proj_id,
        "name": "Mumbai Highway Phase 1",
        "state_code": "MH",
        "district_name": "Pune",
        "financial_year": "2026-27"
    })
    db.evidence.insert_one({
        "evidence_id": ev_id,
        "project_id": proj_id,
        "file_path": test_file_path,
        "file_name": f"{ev_id}.txt",
        "file_type": "text/plain"
    })

    try:
        # KA Officer accessing MH evidence -> FORBIDDEN
        res_forbidden = client.get(f"/api/evidence/{ev_id}/file", headers=ka_headers)
        assert res_forbidden.status_code == 403
        err_text = res_forbidden.json().get("message") or res_forbidden.json().get("detail") or ""
        assert "Access Denied" in err_text

        # MH Officer accessing MH evidence -> AUTHORIZED
        res_allowed = client.get(f"/api/evidence/{ev_id}/file", headers=mh_headers)
        assert res_allowed.status_code == 200
        assert b"CONFIDENTIAL WORK EVIDENCE" in res_allowed.content
    finally:
        db.projects.delete_one({"project_id": proj_id})
        db.evidence.delete_one({"evidence_id": ev_id})
        if os.path.exists(test_file_path):
            os.remove(test_file_path)

# =========================================================================
# 3. Cross-District Isolation Tests
# =========================================================================

def test_district_officer_cross_district_dashboard_and_projects_blocked():
    """District Officer from Belagavi cannot view dashboard or projects of Dharwad."""
    belagavi_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")

    # 1. Cross-district dashboard
    res_dash = client.get("/api/district/dashboard?district=Dharwad", headers=belagavi_headers)
    assert res_dash.status_code == 403
    assert "only authorized to view data for your assigned district" in res_dash.json().get("message", "")

    # 2. Cross-district projects
    res_proj = client.get("/api/district/projects?district=Dharwad", headers=belagavi_headers)
    assert res_proj.status_code == 403
    assert "cannot view projects in 'Dharwad'" in res_proj.json().get("message", "")

    # 3. Cross-district project creation
    res_create = client.post("/api/district/projects", json={
        "name": "Unauthorized Cross District Road",
        "district_name": "Dharwad",
        "scheme_name": "PMGSY",
        "total_budget": 5000000
    }, headers=belagavi_headers)
    assert res_create.status_code == 403
    assert "cannot create projects in 'Dharwad'" in res_create.json().get("message", "")

    # 4. Cross-district grievances
    res_griev = client.get("/api/district/grievances?district=Dharwad", headers=belagavi_headers)
    assert res_griev.status_code == 403
    assert "cannot view grievances for 'Dharwad'" in res_griev.json().get("message", "")

def test_district_officer_missing_district_profile_blocked():
    """District user with missing district assignment receives 403 across endpoints."""
    no_dist_headers = get_test_headers("DISTRICT", district_name=None, state_code="KA")

    res_dash = client.get("/api/district/dashboard", headers=no_dist_headers)
    assert res_dash.status_code == 403
    assert "No district assigned" in res_dash.json().get("message", "")

    res_proj = client.get("/api/district/projects", headers=no_dist_headers)
    assert res_proj.status_code == 403
    assert "No district assigned" in res_proj.json().get("message", "")

    res_griev = client.get("/api/district/grievances", headers=no_dist_headers)
    assert res_griev.status_code == 403
    assert "No district assigned" in res_griev.json().get("message", "")

def test_district_officer_cross_district_transfer_blocked():
    """District Officer from Belagavi cannot disburse funds on a project belonging to Dharwad."""
    belagavi_headers = get_test_headers("DISTRICT", district_name="Belagavi", state_code="KA")
    dharwad_proj_id = f"PROJ-DHW-{uuid.uuid4().hex[:6].upper()}"

    db.projects.insert_one({
        "project_id": dharwad_proj_id,
        "name": "Dharwad Ring Road",
        "district_name": "Dharwad",
        "state_code": "KA",
        "total_budget": 10000000.0,
        "released_amount": 0.0,
        "contractor_id": "CON-KA-TEST",
        "contractor_name": "Test Infra Ltd",
        "financial_year": "2026-27"
    })

    try:
        # Belagavi officer attempts transfer on Dharwad project
        res = client.post("/api/district/transfer-to-contractor", json={
            "project_id": dharwad_proj_id,
            "amount": 1000000.0
        }, headers=belagavi_headers)
        assert res.status_code == 403
        assert "forbidden" in res.json().get("message", "").lower() or "unauthorized" in res.json().get("message", "").lower()

        # Non-existent project
        res_404 = client.post("/api/district/transfer-to-contractor", json={
            "project_id": "NON-EXISTENT-PROJECT-9999",
            "amount": 1000000.0
        }, headers=belagavi_headers)
        assert res_404.status_code == 404
        assert "not found" in res_404.json().get("message", "").lower()
    finally:
        db.projects.delete_one({"project_id": dharwad_proj_id})

# =========================================================================
# 4. Contractor Data & Payment Isolation Tests
# =========================================================================

def test_contractor_cannot_view_other_contractor_project_details():
    """Contractor A cannot access details of a project assigned exclusively to Contractor B."""
    con_a_headers = get_test_headers("CONTRACTOR", user_id="CON-USER-AAA")
    con_b_proj_id = f"PROJ-CON-B-{uuid.uuid4().hex[:6].upper()}"

    db.projects.insert_one({
        "project_id": con_b_proj_id,
        "name": "Contractor B Specialty Bridge",
        "contractor_id": "CON-USER-BBB",
        "contractor_email": "contractor_b@govtfund.test",
        "state_code": "KA",
        "district_name": "Belagavi",
        "total_budget": 20000000.0,
        "financial_year": "2026-27"
    })

    try:
        res = client.get(f"/api/contractor/projects/{con_b_proj_id}", headers=con_a_headers)
        assert res.status_code == 403
        assert "not authorized to view projects assigned to other contractors" in res.json().get("message", "")
    finally:
        db.projects.delete_one({"project_id": con_b_proj_id})

def test_contractor_payment_isolation():
    """Contractor A only sees their own payment transactions, not Contractor B's."""
    con_a_headers = get_test_headers("CONTRACTOR", user_id="CON-USER-AAA")

    tx_a_id = f"FTX-A-{uuid.uuid4().hex[:6].upper()}"
    tx_b_id = f"FTX-B-{uuid.uuid4().hex[:6].upper()}"

    db.financial_transactions.insert_one({
        "transaction_id": tx_a_id,
        "transaction_type": "DISTRICT_TO_CONTRACTOR",
        "destination_entity_id": "CON-USER-AAA",
        "destination_entity_name": "Contractor AAA Infra",
        "amount": 500000.0,
        "financial_year": "2026-27"
    })
    db.financial_transactions.insert_one({
        "transaction_id": tx_b_id,
        "transaction_type": "DISTRICT_TO_CONTRACTOR",
        "destination_entity_id": "CON-USER-BBB",
        "destination_entity_name": "Contractor BBB Infra",
        "amount": 750000.0,
        "financial_year": "2026-27"
    })

    try:
        res = client.get("/api/contractor/payments", headers=con_a_headers)
        assert res.status_code == 200
        payments = res.json().get("payments", [])
        tx_ids = [p.get("transaction_id") for p in payments]
        assert tx_a_id in tx_ids
        assert tx_b_id not in tx_ids
    finally:
        db.financial_transactions.delete_one({"transaction_id": tx_a_id})
        db.financial_transactions.delete_one({"transaction_id": tx_b_id})

# =========================================================================
# 5. Geographic Notification Isolation Tests
# =========================================================================

def test_notification_geographic_isolation():
    """Notifications targeted to State MH are not leaked to State KA officers."""
    ka_headers = get_test_headers("STATE", state_code="KA")
    mh_headers = get_test_headers("STATE", state_code="MH")

    notif_id_mh = f"NOTIF-MH-{uuid.uuid4().hex[:6].upper()}"
    db.notifications.insert_one({
        "notification_id": notif_id_mh,
        "recipient_role": "STATE",
        "recipient_state_code": "MH",
        "recipient_state": "MH",
        "title": "Secret Treasury Transfer for Maharashtra",
        "message": "Funds received at Mumbai Treasury",
        "read": False
    })

    try:
        # KA Officer does NOT see MH notification
        res_ka = client.get("/api/notifications", headers=ka_headers)
        notifs_ka = res_ka.json().get("notifications", [])
        titles_ka = [n.get("title") for n in notifs_ka]
        assert "Secret Treasury Transfer for Maharashtra" not in titles_ka

        # MH Officer DOES see MH notification
        res_mh = client.get("/api/notifications", headers=mh_headers)
        notifs_mh = res_mh.json().get("notifications", [])
        titles_mh = [n.get("title") for n in notifs_mh]
        assert "Secret Treasury Transfer for Maharashtra" in titles_mh
    finally:
        db.notifications.delete_one({"recipient_state_code": "MH", "title": "Secret Treasury Transfer for Maharashtra"})

# =========================================================================
# 6. Invalid Hierarchy & Registry Integrity Tests
# =========================================================================

def test_public_projects_invalid_state_district_pair_rejected():
    """Public query with mismatched state and district (e.g. state=KA and district=Pune) returns 400."""
    res_bad = client.get("/api/public/projects?state=KA&district=Pune")
    assert res_bad.status_code == 400
    assert "Invalid hierarchy" in res_bad.json().get("message", "")
    assert "Pune" in res_bad.json().get("message", "")

    # Valid pair (Belagavi is in KA)
    res_good = client.get("/api/public/projects?state=KA&district=Belagavi")
    assert res_good.status_code == 200
    assert res_good.json().get("success") is True

def test_finance_transfer_invalid_state_rejected():
    """Finance transfer with unregistered state code is rejected with 400 Bad Request."""
    finance_headers = get_test_headers("FINANCE")
    res = client.post("/api/finance/approve-and-transfer", json={
        "allocation_id": "ALLOC-TEST-999",
        "state_code": "XX_INVALID_STATE",
        "amount": 1000000.0
    }, headers=finance_headers)
    assert res.status_code == 400
    assert "Invalid state code" in res.json().get("message", "")
