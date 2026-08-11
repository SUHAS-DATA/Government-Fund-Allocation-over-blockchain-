import os
import jwt
import bcrypt
from functools import wraps
from datetime import datetime, timedelta, timezone
from flask import request, jsonify, g
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET", "super-secure-govtfund-secret-key-blockchain-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode("utf-8"), salt)
    return hashed.decode("utf-8")

def verify_password(password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def generate_token(user_id: str, email: str, role: str, name: str, state_code: str = None, state_name: str = None, district_name: str = None, officer_id: str = None, username: str = None) -> str:
    """Generate JWT auth token"""
    payload = {
        "user_id": str(user_id),
        "email": email,
        "role": role,
        "name": name,
        "state_code": state_code,
        "state_name": state_name,
        "district_name": district_name,
        "officer_id": officer_id,
        "username": username,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise Exception("Session expired. Please log in again.")
    except jwt.InvalidTokenError:
        raise Exception("Invalid authentication token.")

def token_required(f):
    """Decorator requiring valid JWT token"""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return jsonify({"success": False, "message": "Authorization header missing"}), 401
        
        parts = auth_header.split(" ")
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"success": False, "message": "Invalid Authorization header format"}), 401
        
        token = parts[1]
        try:
            payload = decode_token(token)
            g.current_user = payload
        except Exception as e:
            return jsonify({"success": False, "message": str(e)}), 401
            
        return f(*args, **kwargs)
    return decorated

def role_required(allowed_roles):
    """Strict RBAC decorator validating user role"""
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return jsonify({"success": False, "message": "Authentication required"}), 401
            
            parts = auth_header.split(" ")
            if len(parts) != 2 or parts[0].lower() != "bearer":
                return jsonify({"success": False, "message": "Invalid Token Format"}), 401
            
            try:
                payload = decode_token(parts[1])
                g.current_user = payload
                user_role = payload.get("role")

                if user_role not in allowed_roles and user_role != "SUPER_ADMIN":
                    return jsonify({
                        "success": False,
                        "message": f"Access Denied. Role '{user_role}' is not authorized for this resource."
                    }), 403

            except Exception as e:
                return jsonify({"success": False, "message": str(e)}), 401

            return f(*args, **kwargs)
        return decorated_function
    return decorator
