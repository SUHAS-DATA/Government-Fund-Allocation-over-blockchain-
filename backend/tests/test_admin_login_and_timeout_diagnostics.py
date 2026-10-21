import os
import sys
import time
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import db
from auth_middleware import generate_token, hash_password
from routes.auth_routes import login

client = TestClient(app)

# ==========================================
# 1. Successful Login with Valid Credentials
# ==========================================

def test_successful_super_admin_login():
    """Verify that Super Admin can log in with valid credentials and receive token and user profile."""
    res = client.post("/api/auth/login", json={
        "identifier": "admin@govtfund.gov.in",
        "password": "Admin@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert data["user"]["email"] == "admin@govtfund.gov.in"
    assert "password" not in data["user"]

def test_successful_finance_login():
    """Verify that Finance Department officer can log in with valid credentials."""
    res = client.post("/api/auth/login", json={
        "identifier": "finance@govtfund.gov.in",
        "password": "Finance@123"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "token" in data
    assert data["user"]["role"] == "FINANCE"
    assert data["user"]["email"] == "finance@govtfund.gov.in"

# ==========================================
# 2. Invalid Credentials & Validation
# ==========================================

def test_login_invalid_password():
    """Verify that invalid password returns 401 Unauthorized with clean message."""
    res = client.post("/api/auth/login", json={
        "identifier": "admin@govtfund.gov.in",
        "password": "WrongPassword123!"
    })
    assert res.status_code == 401
    data = res.json()
    assert data["success"] is False
    assert "Invalid ID, email or credentials" in data["message"]

def test_login_nonexistent_user():
    """Verify that non-existent user returns 401 Unauthorized."""
    res = client.post("/api/auth/login", json={
        "identifier": "nobody@nonexistent.domain",
        "password": "Password123"
    })
    assert res.status_code == 401
    data = res.json()
    assert data["success"] is False
    assert "Invalid ID, email or credentials" in data["message"]

def test_login_missing_fields():
    """Verify that missing identifier or password returns 400 Bad Request."""
    res = client.post("/api/auth/login", json={"identifier": ""})
    assert res.status_code == 400
    res2 = client.post("/api/auth/login", json={"password": ""})
    assert res2.status_code == 400

# ==========================================
# 3. Account Status & Inactive Gate
# ==========================================

def test_login_suspended_account():
    """Verify that suspended / inactive account is blocked with 403 Forbidden."""
    test_email = "suspended.officer@govtfund.test"
    db.users.update_one(
        {"email": test_email},
        {"$set": {
            "name": "Suspended Officer",
            "email": test_email,
            "password": hash_password("Pass@123"),
            "role": "DISTRICT",
            "is_active": False
        }},
        upsert=True
    )
    try:
        res = client.post("/api/auth/login", json={
            "identifier": test_email,
            "password": "Pass@123"
        })
        assert res.status_code == 403
        data = res.json()
        assert data["success"] is False
        assert "suspended" in data["message"].lower()
    finally:
        db.users.delete_one({"email": test_email})

# ==========================================
# 4. JWT Expiration and Invalid Tokens
# ==========================================

def test_invalid_jwt_token():
    """Verify that malformed or tampered token returns 401 Unauthorized."""
    headers = {"Authorization": "Bearer invalid.fake.token"}
    res = client.get("/api/auth/profile", headers=headers)
    assert res.status_code == 401

def test_expired_jwt_token():
    """Verify that expired token returns 401 Unauthorized."""
    from datetime import datetime, timezone, timedelta
    import jwt
    from auth_middleware import JWT_SECRET, JWT_ALGORITHM
    expired_payload = {
        "user_id": "test_id",
        "email": "test@govtfund.gov.in",
        "role": "SUPER_ADMIN",
        "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        "iat": datetime.now(timezone.utc) - timedelta(hours=2)
    }
    expired_token = jwt.encode(expired_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    res = client.get("/api/auth/profile", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    res_data = res.json()
    err_text = (res_data.get("detail") or res_data.get("message") or "").lower()
    assert "expired" in err_text

# ==========================================
# 5. Role-Based Access Restrictions
# ==========================================

def test_role_based_access_admin_portal():
    """Verify that contractor cannot access Super Admin protected endpoints."""
    contractor_token = generate_token("con_id", "con@test.in", "CONTRACTOR", "Contractor")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {contractor_token}"})
    assert res.status_code == 403

def test_super_admin_has_elevated_access():
    """Verify that Super Admin can access administrative dashboard."""
    admin_token = generate_token("admin_id", "admin@govtfund.gov.in", "SUPER_ADMIN", "Super Admin")
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert res.status_code == 200

# ==========================================
# 6. MongoDB Resilience / Error Handling
# ==========================================

def test_login_mongo_unavailable_handling():
    """Verify that if MongoDB raises an unexpected query exception, the endpoint handles it gracefully."""
    with patch("pymongo.collection.Collection.find_one", side_effect=Exception("Connection to MongoDB timed out")):
        res = client.post("/api/auth/login", json={
            "identifier": "unknown.officer@govtfund.gov.in",
            "password": "Password123"
        })
        assert res.status_code == 503
        data = res.json()
        assert data["success"] is False
        assert "temporarily initializing" in data["message"].lower()

# ==========================================
# 7. Realtime Broadcast Exclusion for Auth
# ==========================================

def test_auth_requests_do_not_trigger_realtime_broadcast():
    """Verify that successful login does not trigger a global DATA_MUTATED realtime broadcast storm."""
    from realtime_manager import realtime_manager
    with patch.object(realtime_manager, "trigger_broadcast") as mock_broadcast:
        res = client.post("/api/auth/login", json={
            "identifier": "admin@govtfund.gov.in",
            "password": "Admin@123"
        })
        assert res.status_code == 200
        mock_broadcast.assert_not_called()
