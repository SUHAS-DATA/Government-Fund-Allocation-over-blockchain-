import os
import sys
import pytest
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app, validate_environment, is_origin_allowed
from auth_middleware import generate_token

client = TestClient(app)

# Helper function to generate test tokens
def get_test_headers(role: str, user_id: str = "test-user-001", state_code: str = None, district_name: str = None):
    token = generate_token(
        user_id=user_id,
        email=f"{role.lower()}@govtfund.test",
        role=role,
        name=f"Test {role} Officer",
        state_code=state_code,
        district_name=district_name
    )
    return {"Authorization": f"Bearer {token}"}

# ==========================================
# 1. Environment and Secret Security Tests
# ==========================================

def test_env_validation_missing_jwt():
    orig = os.environ.get("JWT_SECRET")
    try:
        os.environ["JWT_SECRET"] = ""
        with pytest.raises(RuntimeError) as exc_info:
            validate_environment()
        assert "JWT_SECRET" in str(exc_info.value)
    finally:
        if orig is not None:
            os.environ["JWT_SECRET"] = orig

def test_env_validation_insecure_secret_in_prod():
    orig_env = os.environ.get("APP_ENV")
    orig_secret = os.environ.get("JWT_SECRET")
    try:
        os.environ["APP_ENV"] = "production"
        os.environ["JWT_SECRET"] = "super-secure-govtfund-secret-key-blockchain-2026"
        with pytest.raises(RuntimeError) as exc_info:
            validate_environment()
        assert "Production" in str(exc_info.value) or "default" in str(exc_info.value)
    finally:
        if orig_env is not None:
            os.environ["APP_ENV"] = orig_env
        else:
            os.environ.pop("APP_ENV", None)
        if orig_secret is not None:
            os.environ["JWT_SECRET"] = orig_secret

# ==========================================
# 2. CORS Restriction Tests
# ==========================================

def test_cors_allowed_origin():
    assert is_origin_allowed("http://localhost:5173") is True
    assert is_origin_allowed("http://127.0.0.1:3000") is True

    response = client.get("/api/public/stats", headers={"Origin": "http://localhost:5173"})
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

def test_cors_disallowed_origin():
    assert is_origin_allowed("http://malicious-attacker-domain.xyz") is False
    assert is_origin_allowed("http://evil.com") is False

    response = client.get("/api/public/stats", headers={"Origin": "http://evil.com"})
    # Must NOT reflect the disallowed origin
    assert response.headers.get("access-control-allow-origin") != "http://evil.com"

# ==========================================
# 3. Authentication & Registration Security
# ==========================================

def test_unauthenticated_api_access_blocked():
    protected_endpoints = [
        "/api/admin/dashboard",
        "/api/finance/dashboard",
        "/api/state/dashboard",
        "/api/district/dashboard",
        "/api/contractor/dashboard",
        "/api/notifications",
        "/api/bank-accounts/central"
    ]
    for ep in protected_endpoints:
        res = client.get(ep)
        assert res.status_code == 401, f"Endpoint {ep} allowed unauthenticated access with status {res.status_code}"

def test_public_registration_of_admin_roles_forbidden():
    disallowed_roles = ["SUPER_ADMIN", "ADMIN", "FINANCE", "STATE", "DISTRICT"]
    for role in disallowed_roles:
        payload = {
            "name": f"Hacker {role}",
            "email": f"hacker_{role.lower()}@evil.test",
            "password": "Password123!",
            "role": role,
            "state_code": "MH"
        }
        res = client.post("/api/auth/register", json=payload)
        assert res.status_code == 403, f"Registration of privileged role {role} was not forbidden (got {res.status_code})"
        msg = res.json().get("message", "")
        assert "Super Administrator" in msg or "SUPER_ADMIN" in msg

# ==========================================
# 4. Role-Based Access Control (RBAC)
# ==========================================

def test_contractor_cannot_access_administrative_endpoints():
    contractor_headers = get_test_headers("CONTRACTOR", user_id="CTR-999")
    
    # Contractor trying to access admin
    res1 = client.get("/api/admin/dashboard", headers=contractor_headers)
    assert res1.status_code == 403

    # Contractor trying to access state routes
    res2 = client.get("/api/state/dashboard", headers=contractor_headers)
    assert res2.status_code == 403

    # Contractor trying to access finance routes
    res3 = client.get("/api/finance/dashboard", headers=contractor_headers)
    assert res3.status_code == 403

def test_state_user_cannot_access_finance_routes():
    state_headers = get_test_headers("STATE", state_code="MH")
    res = client.get("/api/finance/dashboard", headers=state_headers)
    assert res.status_code == 403

# ==========================================
# 5. Cross-State and Cross-District Isolation
# ==========================================

def test_cross_state_district_allocation_blocked():
    mh_headers = get_test_headers("STATE", state_code="MH")
    
    # Attempt to allocate to a district in Karnataka (KA) from Maharashtra (MH)
    payload = {
        "state_transfer_id": "TRF-ST-MH-TEST01",
        "district_name": "Bangalore Urban",  # Not in MH
        "scheme_name": "PMGSY",
        "department": "Infrastructure",
        "amount": 500000.0
    }
    res = client.post("/api/state/allocate-to-district", json=payload, headers=mh_headers)
    # Should reject because Bangalore Urban does not belong to MH
    assert res.status_code in [400, 404]
    data = res.json()
    assert data.get("success") is False

def test_cross_state_bank_account_query_blocked():
    mh_headers = get_test_headers("STATE", state_code="MH")
    # MH user attempting to view Karnataka's state bank account
    res = client.get("/api/bank-accounts/state/KA", headers=mh_headers)
    assert res.status_code == 403

def test_public_project_endpoint_sanitizes_pii():
    # Calling public endpoint
    res = client.get("/api/public/projects")
    assert res.status_code == 200
    data = res.json()
    assert data.get("success") is True
    for proj in data.get("projects", []):
        assert "contractor_bank_account" not in proj
        assert "contractor_pan" not in proj
        assert "contractor_phone" not in proj
        assert "contractor_aadhaar" not in proj
