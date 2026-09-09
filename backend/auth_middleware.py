import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from fastapi import Request, HTTPException, status, Depends
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
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again."
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token."
        )

async def get_current_user(request: Request) -> dict:
    """FastAPI dependency to extract and validate JWT token from Authorization header"""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )
    
    parts = auth_header.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header format"
        )
    
    token = parts[1]
    payload = decode_token(token)
    request.state.current_user = payload
    return payload

def require_roles(allowed_roles):
    """FastAPI dependency factory enforcing Role-Based Access Control (RBAC)"""
    if isinstance(allowed_roles, str):
        allowed_roles = [allowed_roles]

    async def role_checker(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("role")
        if user_role not in allowed_roles and user_role != "SUPER_ADMIN":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied. Role '{user_role}' is not authorized for this resource."
            )
        return current_user

    return role_checker

# Aliases for backward compatibility in imports
token_required = get_current_user
role_required = require_roles
