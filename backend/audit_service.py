import os
import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from database import db, get_active_financial_year, serialize_doc

def log_audit_event(
    event_type: str,
    actor: Optional[Dict[str, Any]],
    target_id: str,
    target_type: str = "FINANCIAL_TRANSACTION",
    amount: float = 0.0,
    action: str = "EXECUTE",
    status: str = "SUCCESS",
    details: Optional[str] = None,
    blockchain_tx_hash: Optional[str] = None,
    blockchain_block: Optional[int] = None,
    financial_year: Optional[str] = None,
    ip_address: Optional[str] = None,
    extra_data: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Authoritative Audit Logging for all financial, administrative, and blockchain lifecycle events.
    Records initiator, approver, entity jurisdiction, financial year, and blockchain anchoring.
    """
    now = datetime.now(timezone.utc)
    fy = financial_year or get_active_financial_year()

    actor_info = actor or {}
    audit_id = f"AUD-{uuid.uuid4().hex[:12].upper()}"

    doc = {
        "audit_id": audit_id,
        "event_type": event_type,
        "action": action,
        "status": status,
        "actor_id": str(actor_info.get("user_id") or actor_info.get("id") or "SYSTEM"),
        "actor_name": actor_info.get("name") or "System Automated Service",
        "actor_email": actor_info.get("email"),
        "actor_role": actor_info.get("role") or "SYSTEM",
        "state_code": (actor_info.get("state_code") or "").upper() or None,
        "district_name": actor_info.get("district_name") or None,
        "contractor_id": actor_info.get("contractor_id") or None,
        "target_id": target_id,
        "target_type": target_type,
        "amount": float(amount or 0.0),
        "details": details or "",
        "blockchain_tx_hash": blockchain_tx_hash,
        "blockchain_block": blockchain_block,
        "financial_year": fy,
        "ip_address": ip_address,
        "extra_data": extra_data or {},
        "timestamp": now,
        "created_at": now
    }

    try:
        db.audit_logs.insert_one(doc)
    except Exception as e:
        print(f"[AUDIT_LOG_ERROR] Failed to persist audit log: {e}")

    return doc

def query_audit_logs(
    current_user: Dict[str, Any],
    financial_year: Optional[str] = None,
    target_id: Optional[str] = None,
    event_type: Optional[str] = None,
    limit: int = 100
) -> List[Dict[str, Any]]:
    """
    Retrieve audit trail enforcing Phase 3 jurisdiction isolation and Phase 2 financial year scoping.
    """
    role = current_user.get("role")
    and_clauses = []

    if financial_year:
        and_clauses.append({"financial_year": financial_year})

    if target_id:
        and_clauses.append({"$or": [{"target_id": target_id}, {"blockchain_tx_hash": target_id}, {"audit_id": target_id}]})

    if event_type:
        and_clauses.append({"event_type": event_type})

    # Jurisdiction Isolation
    if role in ["SUPER_ADMIN", "ADMIN", "FINANCE"]:
        pass  # Global visibility
    elif role == "STATE":
        sc = (current_user.get("state_code") or "").upper()
        if not sc:
            return []
        and_clauses.append({
            "$or": [
                {"state_code": sc},
                {"target_id": {"$regex": f"-{sc}-", "$options": "i"}},
                {"details": {"$regex": sc, "$options": "i"}}
            ]
        })
    elif role == "DISTRICT":
        dn = (current_user.get("district_name") or "").strip()
        if not dn:
            return []
        and_clauses.append({
            "$or": [
                {"district_name": {"$regex": f"^{dn}$", "$options": "i"}},
                {"target_id": {"$regex": dn, "$options": "i"}},
                {"details": {"$regex": dn, "$options": "i"}}
            ]
        })
    elif role == "CONTRACTOR":
        cid = str(current_user.get("contractor_id") or current_user.get("user_id") or "")
        cname = str(current_user.get("name") or "")
        ors = []
        if cid:
            ors.append({"actor_id": cid})
            ors.append({"contractor_id": cid})
            ors.append({"target_id": {"$regex": cid, "$options": "i"}})
        if cname:
            ors.append({"actor_name": {"$regex": f"^{cname}$", "$options": "i"}})
            ors.append({"details": {"$regex": cname, "$options": "i"}})
        and_clauses.append({"$or": ors} if ors else {"_id": {"$exists": False}})
    else:
        return []

    query = {"$and": and_clauses} if and_clauses else {}
    cursor = db.audit_logs.find(query).sort("timestamp", -1).limit(limit)
    return serialize_doc(list(cursor))
