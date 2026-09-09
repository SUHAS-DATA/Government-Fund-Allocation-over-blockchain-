import os
from datetime import datetime, timezone
from fastapi import APIRouter, Request, Depends, status
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import (
    hash_password,
    verify_password,
    generate_token,
    get_current_user
)

router = APIRouter()
auth_bp = router # Alias for backwards compatibility

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
        
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    role = data.get("role", "CONTRACTOR").upper()

    if not email or not password or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Email, password, and full name are required"}
        )

    if db.users.find_one({"email": email}):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "An officer or contractor with this email already exists"}
        )

    user_doc = {
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "department": data.get("department", "Public Infrastructure Division"),
        "state_code": data.get("state_code", "MH"),
        "district_name": data.get("district_name", "Pune"),
        "is_active": True,
        "created_at": datetime.now(timezone.utc)
    }

    res = db.users.insert_one(user_doc)
    user_id = str(res.inserted_id)

    # Initialize Contractor KYC document if contractor
    if role == "CONTRACTOR":
        db.contractor_kyc.insert_one({
            "user_id": user_id,
            "company_name": data.get("company_name", name),
            "gst_number": data.get("gst_number", "27AABCU9603R1ZM"),
            "pan_number": data.get("pan_number", "AABCU9603R"),
            "license_number": data.get("license_number", "PWD/MH/2024/001"),
            "experience_years": int(data.get("experience_years", 5)),
            "kyc_status": "UNDER_REVIEW",
            "created_at": datetime.now(timezone.utc)
        })

    token = generate_token(user_id, email, role, name)
    user_data = serialize_doc(user_doc)
    user_data["user_id"] = user_id
    if "password" in user_data:
        del user_data["password"]

    return {
        "success": True,
        "message": "User account registered successfully",
        "token": token,
        "user": user_data
    }

@router.post("/login")
async def login(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    identifier = (data.get("identifier") or data.get("email") or data.get("officer_id") or data.get("contractor_id") or data.get("username") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "ID / Email / Username and password are required"}
        )

    query = {
        "$or": [
            {"email": identifier.lower()},
            {"email": identifier},
            {"contractor_id": identifier.upper()},
            {"contractor_id": identifier},
            {"officer_id": identifier.upper()},
            {"officer_id": identifier},
            {"username": identifier.lower()},
            {"username": identifier}
        ]
    }
    user = db.users.find_one(query)
    if not user:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid ID, email or credentials"}
        )

    if not user.get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "This account is suspended. Contact Super Administrator."}
        )

    if not verify_password(password, user["password"]):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid ID, email or credentials"}
        )

    token = generate_token(
        str(user["_id"]),
        user["email"],
        user["role"],
        user["name"],
        user.get("state_code"),
        user.get("state_name"),
        user.get("district_name"),
        user.get("officer_id"),
        user.get("username")
    )
    user_data = serialize_doc(user)
    user_data["user_id"] = str(user["_id"])
    if "password" in user_data:
        del user_data["password"]

    return {
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": user_data
    }

@router.post("/district/login")
async def district_login(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    identifier = (data.get("identifier") or data.get("officer_id") or data.get("username") or data.get("email") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "District Officer ID / Username / Email and password are required"}
        )

    query = {
        "$or": [
            {"officer_id": identifier.upper()},
            {"officer_id": identifier},
            {"username": identifier.lower()},
            {"username": identifier},
            {"email": identifier.lower()},
            {"email": identifier}
        ]
    }
    user = db.users.find_one(query)
    if not user:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid District Officer ID or password"}
        )

    if user.get("role") not in ["DISTRICT", "SUPER_ADMIN"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: Only District Officers are permitted to log in through this portal."}
        )

    if not user.get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "This District Officer account is suspended. Contact Super Administrator."}
        )

    if not verify_password(password, user["password"]):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid District Officer ID or password"}
        )

    token = generate_token(
        str(user["_id"]),
        user["email"],
        user["role"],
        user["name"],
        user.get("state_code"),
        user.get("state_name"),
        user.get("district_name"),
        user.get("officer_id"),
        user.get("username")
    )
    user_data = serialize_doc(user)
    user_data["user_id"] = str(user["_id"])
    if "password" in user_data:
        del user_data["password"]

    return {
        "success": True,
        "message": f"Welcome District Officer: {user.get('name')} ({user.get('district_name')}, {user.get('state_name') or user.get('state_code')})",
        "token": token,
        "user": user_data
    }

@router.post("/contractor/login")
async def contractor_login(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}

    identifier = (data.get("identifier") or data.get("contractor_id") or data.get("officer_id") or data.get("username") or data.get("email") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Contractor ID / Username / Email and password are required"}
        )

    query = {
        "$or": [
            {"contractor_id": identifier.upper()},
            {"contractor_id": identifier},
            {"officer_id": identifier.upper()},
            {"officer_id": identifier},
            {"username": identifier.lower()},
            {"username": identifier},
            {"email": identifier.lower()},
            {"email": identifier}
        ]
    }
    user = db.users.find_one(query)
    if not user:
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid Contractor credentials or account not found"}
        )

    if user.get("role") not in ["CONTRACTOR", "SUPER_ADMIN"]:
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "Access Denied: Only registered Contractors/Vendors can log in through this portal."}
        )

    if not user.get("is_active", True):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"success": False, "message": "This Contractor account is suspended. Contact District Authority."}
        )

    if not verify_password(password, user["password"]):
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"success": False, "message": "Invalid Contractor credentials or password"}
        )

    token = generate_token(
        str(user["_id"]),
        user["email"],
        user["role"],
        user["name"],
        user.get("state_code"),
        user.get("state_name"),
        user.get("district_name"),
        user.get("officer_id") or user.get("contractor_id"),
        user.get("username")
    )
    user_data = serialize_doc(user)
    user_data["user_id"] = str(user["_id"])
    if "password" in user_data:
        del user_data["password"]

    return {
        "success": True,
        "message": f"Welcome Contractor: {user.get('company_name') or user.get('name')}",
        "token": token,
        "user": user_data
    }

@router.get("/profile")
async def profile(current_user: dict = Depends(get_current_user)):
    user = db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "User not found"}
        )
    
    user_data = serialize_doc(user)
    user_data["user_id"] = str(user["_id"])
    if "password" in user_data:
        del user_data["password"]
        
    return {"success": True, "user": user_data}

@router.post("/change-password")
async def change_password(request: Request, current_user: dict = Depends(get_current_user)):
    try:
        data = await request.json()
    except Exception:
        data = {}

    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")

    user = db.users.find_one({"_id": ObjectId(current_user["user_id"])})
    if not user or not verify_password(old_pw, user["password"]):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Incorrect current password"}
        )

    db.users.update_one(
        {"_id": ObjectId(current_user["user_id"])},
        {"$set": {"password": hash_password(new_pw), "updated_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "message": "Password updated successfully"}
