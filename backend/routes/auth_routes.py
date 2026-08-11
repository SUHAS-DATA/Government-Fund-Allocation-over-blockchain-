import os
from datetime import datetime
from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import hash_password, verify_password, generate_token, token_required

auth_bp = Blueprint("auth_bp", __name__)

@auth_bp.route("/register", methods=["POST"])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    name = data.get("name", "").strip()
    role = data.get("role", "CONTRACTOR").upper()

    if not email or not password or not name:
        return jsonify({"success": False, "message": "Email, password, and full name are required"}), 400

    if db.users.find_one({"email": email}):
        return jsonify({"success": False, "message": "An officer or contractor with this email already exists"}), 400

    user_doc = {
        "email": email,
        "password": hash_password(password),
        "name": name,
        "role": role,
        "department": data.get("department", "Public Infrastructure Division"),
        "state_code": data.get("state_code", "MH"),
        "district_name": data.get("district_name", "Pune"),
        "is_active": True,
        "created_at": datetime.utcnow()
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
            "created_at": datetime.utcnow()
        })

    token = generate_token(user_id, email, role, name)
    user_data = serialize_doc(user_doc)
    user_data["user_id"] = user_id
    del user_data["password"]

    return jsonify({
        "success": True,
        "message": "User account registered successfully",
        "token": token,
        "user": user_data
    }), 201

@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    identifier = (data.get("identifier") or data.get("email") or data.get("officer_id") or data.get("contractor_id") or data.get("username") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"success": False, "message": "ID / Email / Username and password are required"}), 400

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
        return jsonify({"success": False, "message": "Invalid ID, email or credentials"}), 401

    if not user.get("is_active", True):
        return jsonify({"success": False, "message": "This account is suspended. Contact Super Administrator."}), 403

    if not verify_password(password, user["password"]):
        return jsonify({"success": False, "message": "Invalid ID, email or credentials"}), 401

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
    del user_data["password"]

    return jsonify({
        "success": True,
        "message": "Login successful",
        "token": token,
        "user": user_data
    }), 200

@auth_bp.route("/district/login", methods=["POST"])
def district_login():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or data.get("officer_id") or data.get("username") or data.get("email") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"success": False, "message": "District Officer ID / Username / Email and password are required"}), 400

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
        return jsonify({"success": False, "message": "Invalid District Officer ID or password"}), 401

    if user.get("role") not in ["DISTRICT", "SUPER_ADMIN"]:
        return jsonify({"success": False, "message": "Access Denied: Only District Officers are permitted to log in through this portal."}), 403

    if not user.get("is_active", True):
        return jsonify({"success": False, "message": "This District Officer account is suspended. Contact Super Administrator."}), 403

    if not verify_password(password, user["password"]):
        return jsonify({"success": False, "message": "Invalid District Officer ID or password"}), 401

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
    del user_data["password"]

    return jsonify({
        "success": True,
        "message": f"Welcome District Officer: {user.get('name')} ({user.get('district_name')}, {user.get('state_name') or user.get('state_code')})",
        "token": token,
        "user": user_data
    }), 200

@auth_bp.route("/contractor/login", methods=["POST"])
def contractor_login():
    data = request.get_json() or {}
    identifier = (data.get("identifier") or data.get("contractor_id") or data.get("officer_id") or data.get("username") or data.get("email") or "").strip()
    password = data.get("password", "")

    if not identifier or not password:
        return jsonify({"success": False, "message": "Contractor ID / Username / Email and password are required"}), 400

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
        return jsonify({"success": False, "message": "Invalid Contractor credentials or account not found"}), 401

    if user.get("role") not in ["CONTRACTOR", "SUPER_ADMIN"]:
        return jsonify({"success": False, "message": "Access Denied: Only registered Contractors/Vendors can log in through this portal."}), 403

    if not user.get("is_active", True):
        return jsonify({"success": False, "message": "This Contractor account is suspended. Contact District Authority."}), 403

    if not verify_password(password, user["password"]):
        return jsonify({"success": False, "message": "Invalid Contractor credentials or password"}), 401

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
    del user_data["password"]

    return jsonify({
        "success": True,
        "message": f"Welcome Contractor: {user.get('company_name') or user.get('name')}",
        "token": token,
        "user": user_data
    }), 200

@auth_bp.route("/profile", methods=["GET"])
@token_required
def profile():
    user = db.users.find_one({"_id": ObjectId(g.current_user["user_id"])})
    if not user:
        return jsonify({"success": False, "message": "User not found"}), 404
    
    user_data = serialize_doc(user)
    user_data["user_id"] = str(user["_id"])
    if "password" in user_data:
        del user_data["password"]
        
    return jsonify({"success": True, "user": user_data})

@auth_bp.route("/change-password", methods=["POST"])
@token_required
def change_password():
    data = request.get_json() or {}
    old_pw = data.get("old_password", "")
    new_pw = data.get("new_password", "")

    user = db.users.find_one({"_id": ObjectId(g.current_user["user_id"])})
    if not user or not verify_password(old_pw, user["password"]):
        return jsonify({"success": False, "message": "Incorrect current password"}), 400

    db.users.update_one(
        {"_id": ObjectId(g.current_user["user_id"])},
        {"$set": {"password": hash_password(new_pw), "updated_at": datetime.utcnow()}}
    )
    return jsonify({"success": True, "message": "Password updated successfully"})
