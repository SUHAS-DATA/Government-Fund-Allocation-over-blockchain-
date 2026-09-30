import io
import os
import re
import base64
import secrets
from datetime import datetime, timezone
from typing import Optional, Dict, Any
import qrcode
from qrcode.constants import ERROR_CORRECT_M

from database import db, serialize_doc, compute_project_progress

def get_frontend_base_url(request_host: Optional[str] = None) -> str:
    """
    Intelligently resolves frontend base URL:
    1. Checks FRONTEND_URL env var if configured.
    2. If request comes from an external host/IP, resolves to that host on port 5173.
    3. Defaults to http://localhost:5173.
    """
    env_url = os.getenv("FRONTEND_URL")
    if env_url and env_url.strip():
        return env_url.strip().rstrip("/")
        
    if request_host:
        host_clean = request_host.split(":")[0]
        if host_clean and host_clean not in ["127.0.0.1", "localhost", "0.0.0.0"]:
            return f"http://{host_clean}:5173"

    return "http://localhost:5173"

def generate_contract_id(project_id: str) -> str:
    """
    Generates a standardized official contract identifier.
    Example: PRJ-DHA-9X2A88 -> CON-2026-DHA-9X2A88
    """
    clean_suffix = project_id.replace("PRJ-", "")
    current_year = datetime.now().year
    return f"CON-{current_year}-{clean_suffix}"

def generate_qr_image_data_uri(text_data: str) -> str:
    """
    Generates a high-quality QR code image and returns a base64 Data URI (image/png).
    The QR image encodes ONLY the verification URL, without sensitive data.
    """
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_M,
        box_size=10,
        border=3,
    )
    qr.add_data(text_data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="#0F172A", back_color="#FFFFFF")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64_str = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_str}"

def generate_project_qr(
    project: Dict[str, Any],
    contractor_user: Optional[Dict[str, Any]] = None,
    frontend_base_url: Optional[str] = None
) -> Dict[str, Any]:
    """
    Generates and persists a unique QR code for an accepted project/contract.
    Guarantees:
    - Exactly one QR code per accepted project.
    - Idempotent: returns existing QR if already generated.
    - Encodes ONLY the public verification URL.
    - Zero sensitive data included.
    """
    project_id = project["project_id"]

    # 1. Idempotency Check: Return existing QR code if already generated
    existing_qr = db.qr_codes.find_one({"project_id": project_id})
    if existing_qr:
        return serialize_doc(existing_qr)

    # 2. Derive contract ID
    contract_id = project.get("contract_id") or generate_contract_id(project_id)

    # 3. Determine contractor identifier
    contractor_id = project.get("contractor_id")
    if not contractor_id and contractor_user:
        contractor_id = contractor_user.get("contractor_id") or str(contractor_user.get("user_id", contractor_user.get("_id")))
    if not contractor_id:
        contractor_id = "CON-UNASSIGNED"

    contractor_name = project.get("contractor_name")
    if not contractor_name and contractor_user:
        contractor_name = contractor_user.get("company_name") or contractor_user.get("name")
    if not contractor_name:
        contractor_name = "Government Registered Contractor"

    # 4. Generate unique QR ID and verification token
    qr_id = f"QR-{contract_id}"
    verification_token = secrets.token_urlsafe(18)

    # 5. Build public verification URL
    base_url = (frontend_base_url or get_frontend_base_url()).rstrip("/")
    verification_url = f"{base_url}/verify/{qr_id}"

    # 6. Generate QR image (contains ONLY the verification URL)
    qr_image_data = generate_qr_image_data_uri(verification_url)

    # 7. Construct QR record
    now_utc = datetime.now(timezone.utc)
    qr_doc = {
        "qr_id": qr_id,
        "project_id": project_id,
        "contract_id": contract_id,
        "contractor_id": str(contractor_id),
        "contractor_name": contractor_name,
        "verification_url": verification_url,
        "verification_token": verification_token,
        "status": "ACTIVE",
        "qr_image_data": qr_image_data,
        "created_at": now_utc,
        "invalidated_at": None,
        "invalidation_reason": None
    }

    # 8. Persist in db.qr_codes with duplicate prevention
    try:
        db.qr_codes.update_one(
            {"project_id": project_id},
            {"$setOnInsert": qr_doc},
            upsert=True
        )
    except Exception as e:
        # If conflict occurred, retrieve existing
        existing = db.qr_codes.find_one({"project_id": project_id})
        if existing:
            return serialize_doc(existing)
        raise e

    # Fetch stored document
    saved_qr = db.qr_codes.find_one({"project_id": project_id})

    # 9. Sync minimal public QR reference and contract_id back to db.projects
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "contract_id": contract_id,
            "contract_status": "ACCEPTED",
            "qr_id": qr_id,
            "qr_code": {
                "qr_id": qr_id,
                "contract_id": contract_id,
                "verification_url": verification_url,
                "status": "ACTIVE",
                "created_at": now_utc,
                "qr_image_data": qr_image_data
            }
        }}
    )

    return serialize_doc(saved_qr)

def invalidate_project_qr(project_id: str, reason: str = "Project assignment rejected or cancelled"):
    """
    Marks a project's QR code as INVALID/INACTIVE upon project decline or cancellation.
    """
    now_utc = datetime.now(timezone.utc)
    db.qr_codes.update_many(
        {"project_id": project_id},
        {"$set": {
            "status": "INVALID",
            "invalidation_reason": reason,
            "invalidated_at": now_utc
        }}
    )
    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {
            "qr_code.status": "INVALID",
            "qr_code.invalidation_reason": reason,
            "qr_code.invalidated_at": now_utc
        }}
    )

def verify_project_qr(qr_id_or_token: str) -> Dict[str, Any]:
    """
    Validates a scanned QR ID or token against the database and returns
    verified public project details.
    STRICT SECURITY RULE:
    - Never trust data in the QR.
    - Fetches directly from authoritative MongoDB records.
    - Excludes all sensitive bank credentials, account numbers, IFSC codes, passwords, private KYC.
    """
    clean_identifier = (qr_id_or_token or "").strip()
    
    # Also support searching by project_id if scanner passed project ID
    qr_doc = db.qr_codes.find_one({
        "$or": [
            {"qr_id": clean_identifier},
            {"qr_id": f"QR-{clean_identifier}"},
            {"verification_token": clean_identifier},
            {"contract_id": clean_identifier},
            {"project_id": clean_identifier}
        ]
    })

    if not qr_doc:
        return {
            "success": False,
            "is_valid": False,
            "status": "UNRECOGNIZED",
            "message": "Scanned QR code does not match any official government record in the National Blockchain Registry."
        }

    project_id = qr_doc.get("project_id")
    proj = db.projects.find_one({"project_id": project_id})
    if not proj:
        return {
            "success": False,
            "is_valid": False,
            "status": "PROJECT_NOT_FOUND",
            "message": "Associated government project record was not found."
        }

    # Check project invalidation status
    is_declined = proj.get("status") in ["REJECTED_BY_CONTRACTOR", "PROJECT_REJECTED", "CANCELLED"]
    is_frozen = bool(proj.get("is_frozen"))
    qr_db_status = qr_doc.get("status", "ACTIVE")

    if is_declined or is_frozen or qr_db_status != "ACTIVE":
        invalidation_reason = qr_doc.get("invalidation_reason")
        if is_declined and not invalidation_reason:
            invalidation_reason = "Contractor declined or rejected this project assignment."
        elif is_frozen and not invalidation_reason:
            invalidation_reason = f"Project halted/frozen by authority: {proj.get('freeze_reason', 'Under administrative review')}"
        elif not invalidation_reason:
            invalidation_reason = "Project or contract has been cancelled or invalidated."

        return {
            "success": True,
            "is_valid": False,
            "status": "INVALID",
            "invalidation_reason": invalidation_reason,
            "qr_id": qr_doc.get("qr_id"),
            "contract_id": qr_doc.get("contract_id"),
            "project_id": project_id,
            "project_name": proj.get("name"),
            "scheme_name": proj.get("scheme_name"),
            "district_name": proj.get("district_name"),
            "state_name": proj.get("state_name"),
            "created_at": qr_doc.get("created_at"),
            "invalidated_at": qr_doc.get("invalidated_at") or datetime.now(timezone.utc),
            "message": f"This QR code is INVALID / INACTIVE. Reason: {invalidation_reason}"
        }

    # Active and Valid: Fetch Milestones and Blockchain Transactions
    milestones = list(db.milestones.find({"project_id": project_id}).sort("milestone_index", 1))
    transactions = list(db.blockchain_transactions.find({"entity_id": project_id}).sort("timestamp", -1))
    progress_pct = compute_project_progress(proj, milestones)

    # Sanitize milestones for public display (only show public completion proofs, amounts, status)
    sanitized_milestones = []
    for m in milestones:
        sanitized_milestones.append({
            "phase_number": m.get("phase_number") or (m.get("milestone_index", 0) + 1),
            "title": m.get("title"),
            "percentage_share": m.get("percentage_share"),
            "amount": float(m.get("amount", 0.0)),
            "status": m.get("status"),
            "phase_status": m.get("phase_status"),
            "progress_percentage": m.get("progress_percentage", 0),
            "description": m.get("description"),
            "proof_document_hash": m.get("proof_document_hash"),
            "blockchain_tx_hash": m.get("blockchain_tx_hash")
        })

    # Permitted financial information
    total_budget = float(proj.get("total_budget", 0.0))
    released_amount = float(proj.get("released_amount", 0.0))
    remaining_balance = max(0.0, total_budget - released_amount)

    # Sanitize blockchain receipts
    sanitized_txs = []
    for tx in transactions[:10]: # Top 10 latest transactions
        sanitized_txs.append({
            "tx_hash": tx.get("tx_hash"),
            "block_number": tx.get("block_number"),
            "operation_type": tx.get("operation_type"),
            "details": tx.get("details"),
            "timestamp": tx.get("timestamp")
        })

    # Official Verified Public Payload (ZERO sensitive info: no bank A/C, no IFSC, no password, no private KYC)
    return {
        "success": True,
        "is_valid": True,
        "status": "ACTIVE",
        "verification_time": datetime.now(timezone.utc).isoformat(),
        "qr": {
            "qr_id": qr_doc.get("qr_id"),
            "created_at": qr_doc.get("created_at"),
            "status": "ACTIVE",
            "verification_url": qr_doc.get("verification_url"),
            "qr_image_data": qr_doc.get("qr_image_data")
        },
        "contract": {
            "contract_id": qr_doc.get("contract_id"),
            "contract_status": proj.get("contract_status", "ACCEPTED"),
            "accepted_at": proj.get("accepted_at"),
            "accepted_by": proj.get("accepted_by")
        },
        "project": {
            "project_id": proj.get("project_id"),
            "name": proj.get("name"),
            "scheme_name": proj.get("scheme_name"),
            "scheme_code": proj.get("scheme_code"),
            "department": proj.get("department"),
            "state_code": proj.get("state_code"),
            "state_name": proj.get("state_name"),
            "district_name": proj.get("district_name"),
            "description": proj.get("description"),
            "status": proj.get("status"),
            "progress_percentage": progress_pct,
            "timeline_months": proj.get("timeline_months"),
            "created_at": proj.get("created_at"),
            "escrow_onchain": proj.get("escrow_onchain", False),
            "escrow_tx_hash": proj.get("escrow_tx_hash")
        },
        "contractor": {
            "contractor_id": qr_doc.get("contractor_id"),
            "company_name": proj.get("contractor_name") or qr_doc.get("contractor_name"),
            "wallet_address": proj.get("contractor_wallet")
            # NOTE: Strictly NO bank account number, NO IFSC, NO passwords, NO private KYC!
        },
        "finances": {
            "total_budget": total_budget,
            "released_amount": released_amount,
            "remaining_balance": remaining_balance
        },
        "milestones": sanitized_milestones,
        "blockchain_transactions": sanitized_txs
    }
