import os
import sys
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token
import blockchain_service as bcs

client = TestClient(app)

def setup_module(module):
    """Ensure test users and sample entities exist for portal verification."""
    # Seed state and district if not existing
    db.states.update_one(
        {"code": "KA"},
        {"$set": {"code": "KA", "name": "Karnataka", "capital": "Bengaluru"}},
        upsert=True
    )
    db.districts.update_one(
        {"code": "BLR", "state_code": "KA"},
        {"$set": {"code": "BLR", "name": "Bengaluru Urban", "state_code": "KA"}},
        upsert=True
    )

def test_admin_portal_connectivity_and_authorization():
    """Verify Admin Portal endpoints: /api/admin/users, /api/admin/schemes, /api/blockchain/status."""
    admin_token = generate_token(
        user_id="test_admin_portal",
        email="admin@govtfund.gov.in",
        role="SUPER_ADMIN",
        name="Super Admin"
    )
    unauthorized_token = generate_token(
        user_id="test_unauth_user",
        email="citizen@govtfund.gov.in",
        role="CITIZEN",
        name="Citizen"
    )

    # 1. Blockchain status
    res_status = client.get("/api/blockchain/status")
    assert res_status.status_code == 200
    data_status = res_status.json()
    assert data_status["success"] is True

    # 2. Admin users - unauthorized citizen is rejected with 403
    res_users_unauth = client.get("/api/admin/users", headers={"Authorization": f"Bearer {unauthorized_token}"})
    assert res_users_unauth.status_code == 403

    # 3. Admin users - authorized admin succeeds
    res_users = client.get("/api/admin/users", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_users.status_code == 200
    assert "users" in res_users.json()

    # 4. Admin schemes
    res_schemes = client.get("/api/admin/schemes", headers={"Authorization": f"Bearer {admin_token}"})
    assert res_schemes.status_code == 200
    assert "schemes" in res_schemes.json()

def test_field_portal_state_and_district_authorization():
    """Verify Field Portal endpoints for State Treasury and District Officers."""
    state_token = generate_token(
        user_id="test_state_officer",
        email="state@ka.gov.in",
        role="STATE",
        name="State Officer",
        state_code="KA",
        state_name="Karnataka"
    )
    district_token = generate_token(
        user_id="test_district_officer",
        email="district@blr.gov.in",
        role="DISTRICT",
        name="District Officer",
        state_code="KA",
        state_name="Karnataka",
        district_name="Bengaluru Urban"
    )
    contractor_token = generate_token(
        user_id="test_contractor_field",
        email="contractor@infra.com",
        role="CONTRACTOR",
        name="Contractor"
    )

    # State Officer Dashboard
    res_state = client.get("/api/state/dashboard", headers={"Authorization": f"Bearer {state_token}"})
    assert res_state.status_code == 200
    assert res_state.json()["success"] is True

    # District officer blocked from State Dashboard
    res_cross = client.get("/api/state/dashboard", headers={"Authorization": f"Bearer {district_token}"})
    assert res_cross.status_code == 403

    # District Officer Dashboard
    res_district = client.get("/api/district/dashboard", headers={"Authorization": f"Bearer {district_token}"})
    assert res_district.status_code == 200
    assert res_district.json()["success"] is True

    # Contractor blocked from District Dashboard
    res_contractor_blocked = client.get("/api/district/dashboard", headers={"Authorization": f"Bearer {contractor_token}"})
    assert res_contractor_blocked.status_code == 403

def test_contractor_portal_connectivity_and_authorization():
    """Verify Contractor Portal endpoints: dashboard, projects, milestone access."""
    contractor_token = generate_token(
        user_id="test_contractor_portal_user",
        email="infra_corp@build.com",
        role="CONTRACTOR",
        name="Infra Corp"
    )
    citizen_token = generate_token(
        user_id="test_citizen_contractor",
        email="random@public.org",
        role="CITIZEN",
        name="Citizen"
    )

    # Contractor Dashboard
    res = client.get("/api/contractor/dashboard", headers={"Authorization": f"Bearer {contractor_token}"})
    assert res.status_code == 200
    assert res.json()["success"] is True

    # Citizen blocked from Contractor Dashboard
    res_unauth = client.get("/api/contractor/dashboard", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_unauth.status_code == 403

    # Contractor Projects
    res_proj = client.get("/api/contractor/projects", headers={"Authorization": f"Bearer {contractor_token}"})
    assert res_proj.status_code == 200
    assert "projects" in res_proj.json()

def test_public_portal_read_only_access():
    """Verify Public Portal endpoints: no auth required, public stats, project list, verify."""
    # 1. Public stats
    res_stats = client.get("/api/public/stats")
    assert res_stats.status_code == 200
    data_stats = res_stats.json()
    assert data_stats["success"] is True

    # 2. Public projects
    res_projects = client.get("/api/public/projects")
    assert res_projects.status_code == 200
    data_projects = res_projects.json()
    assert data_projects["success"] is True

    # 3. Financial years
    res_fy = client.get("/api/public/financial-years")
    assert res_fy.status_code == 200
    assert "financial_years" in res_fy.json()

    # 4. Public blockchain transaction verification endpoint (Connected mode)
    tx_hash = "0x001429b80bd5e236806d8c902a1ec47c035040b542dc40a523ade5ac3967ddc6"
    mock_verification = {
        "verified": True,
        "status": "VERIFIED_SUCCESS",
        "message": "Transaction successfully verified on-chain in block #11949523.",
        "tx_hash": tx_hash,
        "block_number": 11949523,
        "gas_used": 38194388,
        "from_address": "0xeCcD57EfadFCc6217a21Bf482FEBe18c9F3D6148",
        "to_address": "0x103cdC78636491B20deadC5574755Bbd64B119c6",
        "confirmations": 12,
        "decoded_events": []
    }
    with patch.object(bcs, "verify_transaction_onchain", return_value=mock_verification):
        res_verify = client.get(f"/api/blockchain/verify-transaction/{tx_hash}")
        assert res_verify.status_code == 200
        data_verify = res_verify.json()
        assert data_verify["success"] is True
        assert data_verify["verified"] is True
        assert data_verify["tx_hash"] == tx_hash

    # 5. Public blockchain transaction verification endpoint (RPC unavailable safeguard)
    mock_unavail = {
        "verified": False,
        "status": "RPC_UNAVAILABLE",
        "message": "Blockchain RPC endpoint is currently unreachable."
    }
    with patch.object(bcs, "verify_transaction_onchain", return_value=mock_unavail):
        res_fail = client.get(f"/api/blockchain/verify-transaction/{tx_hash}")
        assert res_fail.status_code == 503
        assert res_fail.json()["success"] is False

def test_auditor_portal_connectivity_and_authorization():
    """Verify Auditor Portal: audit logs, reconciliation, and role authorization."""
    auditor_token = generate_token(
        user_id="test_auditor_user",
        email="cag@audit.gov.in",
        role="AUDITOR",
        name="Comptroller & Auditor"
    )
    citizen_token = generate_token(
        user_id="test_citizen_auditor",
        email="citizen@audit.org",
        role="CITIZEN",
        name="Citizen"
    )

    # 1. Auditor Audit Trail (/api/transactions/audit-logs)
    res_audit = client.get("/api/transactions/audit-logs", headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_audit.status_code == 200
    assert "audit_logs" in res_audit.json()

    # 2. Citizen gets empty audit logs due to strict jurisdiction isolation
    res_unauth = client.get("/api/transactions/audit-logs", headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_unauth.status_code == 200
    assert res_unauth.json()["audit_logs"] == []

    # 3. Auditor Reconciliation (/api/transactions/reconcile)
    res_recon = client.post("/api/transactions/reconcile", json={}, headers={"Authorization": f"Bearer {auditor_token}"})
    assert res_recon.status_code == 200
    assert "report" in res_recon.json()

    # 4. Citizen blocked from Reconciliation
    res_recon_unauth = client.post("/api/transactions/reconcile", json={}, headers={"Authorization": f"Bearer {citizen_token}"})
    assert res_recon_unauth.status_code == 403
