import os
import time
import logging
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import OperationFailure
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

import urllib.parse

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "FUNDSYSTEM")

def _sanitize_mongo_uri(uri: str) -> str:
    """Safely escapes usernames and passwords containing special characters (like @) per RFC 3986."""
    try:
        # Auto-correct typo where numeral '1' was typed instead of lowercase 'l'
        if "16fgx36" in uri:
            uri = uri.replace("16fgx36", "l6fgx36")

        if "://" in uri and "@" in uri:
            prefix, rest = uri.split("://", 1)
            if "@" in rest:
                userinfo, hostinfo = rest.rsplit("@", 1)
                if ":" in userinfo:
                    user, pwd = userinfo.split(":", 1)
                    # Unquote first to prevent double-encoding, then quote
                    user_clean = urllib.parse.quote_plus(urllib.parse.unquote_plus(user))
                    pwd_clean = urllib.parse.quote_plus(urllib.parse.unquote_plus(pwd))
                    return f"{prefix}://{user_clean}:{pwd_clean}@{hostinfo}"
    except Exception:
        pass
    return uri

client = MongoClient(_sanitize_mongo_uri(MONGO_URI), serverSelectionTimeoutMS=5000, connect=False)
db = client[DB_NAME]

def safe_create_index(collection, keys, **kwargs):
    """
    Safely creates an index on a MongoDB collection with verified conflict handling.
    - If the index does not exist, creates it.
    - If an IndexKeySpecsConflict / IndexOptionsConflict (code 85/86) occurs:
      Inspects existing collection indexes. If an existing index covers the identical
      key specification and exactly matches the requested uniqueness, sparse behavior,
      and other index options, it verifies compatibility and gracefully preserves the
      existing on-disk index without dropping, altering, or failing.
    - Strictly does not suppress a conflict merely because a similarly keyed index exists;
      it verifies exact key specification, uniqueness, sparse behavior, and option compatibility.
    - Strictly does not drop, recreate, or modify existing production indexes.
    """
    try:
        return collection.create_index(keys, **kwargs)
    except OperationFailure as e:
        is_conflict = (
            getattr(e, "code", None) in (85, 86)
            or "IndexOptionsConflict" in str(e)
            or "IndexKeySpecsConflict" in str(e)
            or "already exists with different options" in str(e)
        )
        if is_conflict:
            try:
                existing_indexes = collection.index_information()
                norm_requested = [(k, int(v)) for k, v in keys]
                req_unique = bool(kwargs.get("unique", False))
                req_sparse = bool(kwargs.get("sparse", False))

                for idx_name, idx_spec in existing_indexes.items():
                    existing_keys = [(k, int(v)) for k, v in idx_spec.get("key", [])]
                    if existing_keys == norm_requested:
                        existing_unique = bool(idx_spec.get("unique", False))
                        existing_sparse = bool(idx_spec.get("sparse", False))

                        # Verify exact uniqueness and sparse compatibility
                        if req_unique != existing_unique:
                            continue
                        if req_sparse != existing_sparse:
                            continue

                        # Verify other optional constraints if specified
                        if "expireAfterSeconds" in kwargs:
                            if idx_spec.get("expireAfterSeconds") != kwargs["expireAfterSeconds"]:
                                continue
                        if "partialFilterExpression" in kwargs:
                            if idx_spec.get("partialFilterExpression") != kwargs["partialFilterExpression"]:
                                continue

                        logging.info(
                            f"[DB_INDEX] Preserving verified existing index '{idx_name}' "
                            f"on collection '{collection.name}' for keys {keys} "
                            f"(unique={existing_unique}, sparse={existing_sparse})"
                        )
                        return idx_name
            except Exception as check_err:
                logging.debug(f"[DB_INDEX] Index compatibility check error on {collection.name}: {check_err}")

        print(f"Warning initializing {collection.name} index: {e}")
        return None
    except Exception as e:
        print(f"Warning initializing {collection.name} index: {e}")
        return None

def init_indexes():
    """Create essential MongoDB indexes with safe conflict handling"""
    # 1. Users collection
    safe_create_index(db.users, [("email", ASCENDING)], unique=True)
    safe_create_index(db.users, [("officer_id", ASCENDING)], unique=False, sparse=True)
    safe_create_index(db.users, [("contractor_id", ASCENDING)], unique=False, sparse=True)
    safe_create_index(db.users, [("username", ASCENDING)], unique=False, sparse=True)
    safe_create_index(db.users, [("role", ASCENDING)])

    # 2. Financial Years collection
    safe_create_index(db.financial_years, [("year", ASCENDING)], unique=True, sparse=True)

    # 3. Departments collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.departments, [("code", ASCENDING)], unique=True)

    # 4. States collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.states, [("code", ASCENDING)], unique=True)

    # 5. Schemes collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.schemes, [("code", ASCENDING)], unique=True)
    safe_create_index(db.schemes, [("financial_year", ASCENDING), ("name", ASCENDING)], sparse=True)
    safe_create_index(db.schemes, [("name", ASCENDING)])

    # 6. Budget Allocations collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.budget_allocations, [("allocation_id", ASCENDING)], unique=True)
    safe_create_index(db.budget_allocations, [("financial_year", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.budget_allocations, [("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.budget_allocations, [("financial_year", ASCENDING), ("scheme_name", ASCENDING)])
    safe_create_index(db.budget_allocations, [("scheme_name", ASCENDING)])
    safe_create_index(db.budget_allocations, [("state_code", ASCENDING)])

    # 7. State Transfers collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.state_transfers, [("transfer_id", ASCENDING)], unique=True)
    safe_create_index(db.state_transfers, [("financial_year", ASCENDING), ("state_code", ASCENDING)])
    safe_create_index(db.state_transfers, [("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.state_transfers, [("state_code", ASCENDING), ("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.state_transfers, [("state_code", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.state_transfers, [("created_at", DESCENDING)])

    # 8. District Allocations collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.district_allocations, [("district_alloc_id", ASCENDING)], unique=True)
    safe_create_index(db.district_allocations, [("financial_year", ASCENDING), ("state_code", ASCENDING), ("district_name", ASCENDING)])
    safe_create_index(db.district_allocations, [("district_name", ASCENDING), ("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.district_allocations, [("state_code", ASCENDING), ("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.district_allocations, [("district_name", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.district_allocations, [("state_code", ASCENDING)])

    # 9. Projects collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.projects, [("project_id", ASCENDING)], unique=True)
    safe_create_index(db.projects, [("financial_year", ASCENDING), ("district_name", ASCENDING)])
    safe_create_index(db.projects, [("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.projects, [("district_name", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.projects, [("state_code", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.projects, [("contractor_id", ASCENDING), ("status", ASCENDING)])
    safe_create_index(db.projects, [("created_at", DESCENDING)])

    # 9b. Milestones collection
    safe_create_index(db.milestones, [("milestone_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.milestones, [("project_id", ASCENDING)])

    # 9c. Contractor KYC collection
    safe_create_index(db.contractor_kyc, [("contractor_id", ASCENDING)])
    safe_create_index(db.contractor_kyc, [("state_code", ASCENDING), ("kyc_status", ASCENDING)])

    # 9d. Notifications collection
    safe_create_index(db.notifications, [("recipient_user_id", ASCENDING), ("read", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.notifications, [("role", ASCENDING), ("created_at", DESCENDING)])

    # 10. Documents collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.documents, [("document_id", ASCENDING)], unique=True)
    safe_create_index(db.documents, [("sha256_hash", ASCENDING)])

    # 11. Complaints / Grievances collection
    safe_create_index(db.complaints, [("reference_id", ASCENDING)], unique=True, sparse=True)

    # 12. Blockchain Transactions collection (Aligned with MongoDB Atlas: unique and non-sparse)
    safe_create_index(db.blockchain_transactions, [("tx_hash", ASCENDING)], unique=True)
    safe_create_index(db.blockchain_transactions, [("financial_year", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.blockchain_transactions, [("operation_type", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.blockchain_transactions, [("entity_id", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.blockchain_transactions, [("project_id", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.blockchain_transactions, [("to_address", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.blockchain_transactions, [("timestamp", DESCENDING)])

    # 13. QR Codes collection
    safe_create_index(db.qr_codes, [("qr_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.qr_codes, [("project_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.qr_codes, [("contract_id", ASCENDING)], sparse=True)
    safe_create_index(db.qr_codes, [("status", ASCENDING)])

    # 14. Evidence collection
    safe_create_index(db.evidence, [("evidence_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.evidence, [("evidenceId", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.evidence, [("project_id", ASCENDING), ("milestone_index", ASCENDING)])
    safe_create_index(db.evidence, [("projectId", ASCENDING), ("milestoneId", ASCENDING)])
    safe_create_index(db.evidence, [("contractor_id", ASCENDING)])
    safe_create_index(db.evidence, [("district_name", ASCENDING)])
    safe_create_index(db.evidence, [("status", ASCENDING)])
    safe_create_index(db.evidence, [("uploaded_at", DESCENDING)])

    # 15. Bank Accounts collection
    safe_create_index(db.bank_accounts, [("account_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.bank_accounts, [("entity_id", ASCENDING)])
    safe_create_index(db.bank_accounts, [("entity_type", ASCENDING)])
    safe_create_index(db.bank_accounts, [("state_code", ASCENDING)])
    safe_create_index(db.bank_accounts, [("district_name", ASCENDING)])
    safe_create_index(db.bank_accounts, [("contractor_id", ASCENDING)])

    # 16. Financial Transactions collection
    safe_create_index(db.financial_transactions, [("transaction_id", ASCENDING)], unique=True, sparse=True)
    safe_create_index(db.financial_transactions, [("transaction_type", ASCENDING)])
    safe_create_index(db.financial_transactions, [("transaction_type", ASCENDING), ("financial_year", ASCENDING), ("created_at", DESCENDING)])
    safe_create_index(db.financial_transactions, [("source_account_id", ASCENDING)])
    safe_create_index(db.financial_transactions, [("destination_account_id", ASCENDING)])
    safe_create_index(db.financial_transactions, [("related_project_id", ASCENDING)])
    safe_create_index(db.financial_transactions, [("related_allocation_id", ASCENDING)])
    safe_create_index(db.financial_transactions, [("blockchain_tx_hash", ASCENDING)])
    safe_create_index(db.financial_transactions, [("created_at", DESCENDING)])

    # 17. Audit Logs collection
    safe_create_index(db.audit_logs, [("timestamp", DESCENDING)])
    safe_create_index(db.audit_logs, [("financial_year", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.audit_logs, [("action", ASCENDING), ("timestamp", DESCENDING)])
    safe_create_index(db.audit_logs, [("target_id", ASCENDING)])

    # 18. Fraud Reports collection
    safe_create_index(db.fraud_reports, [("status", ASCENDING)])
    safe_create_index(db.fraud_reports, [("created_at", DESCENDING)])

    # Auto-seed standard Central, State, and District bank accounts
    try:
        import bank_account_service as bas
        bas.seed_default_bank_accounts()
    except Exception as e:
        pass

    print("MongoDB indexes verified for database:", DB_NAME)

def serialize_doc(doc):
    """Serialize MongoDB document to JSON-compatible dict"""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(item) for item in doc]
    if isinstance(doc, dict):
        result = {}
        for key, value in doc.items():
            if isinstance(value, ObjectId):
                result[key] = str(value)
            elif isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, dict):
                result[key] = serialize_doc(value)
            elif isinstance(value, list):
                result[key] = [serialize_doc(item) for item in value]
            else:
                result[key] = value
        return result
    return doc

def compute_project_progress(proj, milestones=None):
    """
    Calculate accurate real-time physical work progress percentage (0-100)
    for a project based on lifecycle status, milestones, and submitted proofs.
    """
    if not proj:
        return 0
        
    # Formally closed or completed projects are 100% complete
    status = proj.get("status")
    if status in ["COMPLETED", "FINAL_PROJECT_COMPLETED", "CLOSED"] or proj.get("is_closed"):
        return 100
        
    project_id = proj.get("project_id")
    if not project_id:
        return int(proj.get("progress_percentage") or 0)
        
    if milestones is None:
        milestones = list(db.milestones.find({"project_id": project_id}))
        
    if not milestones:
        return int(proj.get("progress_percentage") or 0)
        
    total_budget = float(proj.get("total_budget") or sum(float(m.get("amount", 0.0)) for m in milestones) or 1.0)
    
    total_weighted_progress = 0.0
    for m in milestones:
        amount = float(m.get("amount") or 0.0)
        weight = amount / total_budget if total_budget > 0 else (1.0 / len(milestones))
        m_status = m.get("status")
        phase_status = m.get("phase_status")
        
        if m_status in ["COMPLETED", "RELEASED"] or phase_status == "COMPLETED":
            p = 100.0
        elif m_status in ["SUBMITTED", "SUBMITTED_FOR_VERIFICATION"] or phase_status == "SUBMITTED_FOR_VERIFICATION":
            p = float(m.get("progress_percentage") or 100.0)
        elif m_status in ["APPROVED_FOR_WORK", "EXECUTING_WORK"] or phase_status == "EXECUTING_WORK":
            p = float(m.get("progress_percentage") or 40.0)
        elif m_status in ["FUNDS_TRANSFERRED"] or phase_status == "FUNDS_TRANSFERRED":
            p = float(m.get("progress_percentage") or 15.0)
        elif m_status in ["FUND_REQUESTED"] or phase_status == "FUND_REQUESTED":
            p = float(m.get("progress_percentage") or 5.0)
        else:
            p = float(m.get("progress_percentage") or 0.0)
            
        total_weighted_progress += p * weight
        
    return min(100, max(0, int(round(total_weighted_progress))))

def reconcile_project_released_amount(proj: dict, milestones: list = None, exclude_milestone_index: int = None, persist: bool = True) -> float:
    """
    Calculate and reconcile the accurate project released_amount based on funded milestones.
    Prevents double-counting across milestone submissions/verifications and auto-heals historical budget drift.
    """
    if not proj:
        return 0.0

    project_id = proj.get("project_id")
    if not project_id:
        return float(proj.get("released_amount", 0.0))

    if milestones is None:
        milestones = list(db.milestones.find({"project_id": project_id}))

    if not milestones:
        return float(proj.get("released_amount", 0.0))

    actual_released = 0.0
    for m in milestones:
        if exclude_milestone_index is not None and m.get("milestone_index") == exclude_milestone_index:
            continue

        is_funded = bool(
            m.get("funds_transferred_at")
            or m.get("transfer_tx_hash")
            or m.get("funds_approved_at")
            or m.get("source_account_id")
            or m.get("blockchainTxHash")
            or m.get("status") in ["FUNDS_TRANSFERRED", "COMPLETED", "RELEASED"]
            or m.get("phase_status") in ["FUNDS_TRANSFERRED", "COMPLETED", "RELEASED"]
        )
        if is_funded:
            actual_released += float(m.get("amount", 0.0))

    total_budget = float(proj.get("total_budget", 0.0))
    if total_budget > 0:
        actual_released = min(total_budget, actual_released)

    # Heal stored released_amount in database if it has drifted and persist is True
    stored_released = float(proj.get("released_amount", 0.0))
    proj["released_amount"] = actual_released
    if persist:
        if exclude_milestone_index is None:
            if abs(stored_released - actual_released) > 0.01:
                db.projects.update_one(
                    {"project_id": project_id},
                    {"$set": {"released_amount": actual_released}}
                )
        else:
            if stored_released > actual_released:
                db.projects.update_one(
                    {"project_id": project_id},
                    {"$set": {"released_amount": actual_released}}
                )

    return actual_released

_active_fy_cache = {"year": None, "expires_at": 0}

def get_active_financial_year(force_refresh: bool = False):
    """
    Returns the currently active financial year from MongoDB, falling back to None if no records exist.
    Cached in-memory with a 60-second TTL to avoid 70ms database round-trips on every request.
    """
    global _active_fy_cache
    now = time.time()
    if not force_refresh and _active_fy_cache["year"] and now < _active_fy_cache["expires_at"]:
        return _active_fy_cache["year"]
    try:
        active_doc = db.financial_years.find_one({"status": "ACTIVE"})
        if active_doc and active_doc.get("year"):
            val = str(active_doc["year"]).strip()
            _active_fy_cache["year"] = val
            _active_fy_cache["expires_at"] = now + 60
            return val
        latest = db.financial_years.find_one({}, sort=[("year", -1)])
        if latest and latest.get("year"):
            val = str(latest["year"]).strip()
            _active_fy_cache["year"] = val
            _active_fy_cache["expires_at"] = now + 60
            return val
    except Exception:
        pass
    return None

def invalidate_active_financial_year_cache():
    """Immediately invalidates the cached active financial year."""
    global _active_fy_cache
    _active_fy_cache["year"] = None
    _active_fy_cache["expires_at"] = 0

def ensure_financial_year_associations():
    """
    Non-destructively links existing historical records to appropriate financial years.
    Guarantees that historical records preserve original associations while preventing
    orphaned records across financial year filtering.
    """
    try:
        active_fy = get_active_financial_year()
        if not active_fy:
            return

        # 1. Backfill state_transfers
        transfers_without_fy = list(db.state_transfers.find({"$or": [{"financial_year": None}, {"financial_year": {"$exists": False}}]}))
        for st in transfers_without_fy:
            alloc_id = st.get("allocation_id")
            fy = None
            if alloc_id:
                alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
                if alloc and alloc.get("financial_year"):
                    fy = alloc["financial_year"]
            if not fy:
                fy = active_fy
            db.state_transfers.update_one({"_id": st["_id"]}, {"$set": {"financial_year": fy}})

        # 2. Backfill district_allocations
        dist_without_fy = list(db.district_allocations.find({"$or": [{"financial_year": None}, {"financial_year": {"$exists": False}}]}))
        for da in dist_without_fy:
            trf_id = da.get("transfer_id")
            fy = None
            if trf_id:
                st = db.state_transfers.find_one({"transfer_id": trf_id})
                if st and st.get("financial_year"):
                    fy = st["financial_year"]
            if not fy:
                fy = active_fy
            db.district_allocations.update_one({"_id": da["_id"]}, {"$set": {"financial_year": fy}})

        # 3. Backfill projects
        proj_without_fy = list(db.projects.find({"$or": [{"financial_year": None}, {"financial_year": {"$exists": False}}]}))
        for p in proj_without_fy:
            db.projects.update_one({"_id": p["_id"]}, {"$set": {"financial_year": active_fy}})

        # 4. Backfill schemes
        schemes_without_fy = list(db.schemes.find({"$or": [{"financial_year": None}, {"financial_year": {"$exists": False}}]}))
        for s in schemes_without_fy:
            db.schemes.update_one({"_id": s["_id"]}, {"$set": {"financial_year": active_fy}})

        # 5. Backfill financial_transactions
        tx_without_fy = list(db.financial_transactions.find({"$or": [{"financial_year": None}, {"financial_year": {"$exists": False}}]}))
        for tx in tx_without_fy:
            alloc_id = tx.get("related_allocation_id")
            fy = None
            if alloc_id:
                alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
                if alloc and alloc.get("financial_year"):
                    fy = alloc["financial_year"]
            if not fy:
                fy = active_fy
            db.financial_transactions.update_one({"_id": tx["_id"]}, {"$set": {"financial_year": fy}})
    except Exception as e:
        print(f"Notice: Non-destructive financial year backfill check: {e}")

_db_initialized = False

def init_db(force: bool = False):
    """
    Initializes indexes and non-destructive associations safely during application startup.
    Guarantees run-once behavior so module imports do not block on network I/O.
    """
    global _db_initialized
    if _db_initialized and not force:
        return
    try:
        init_indexes()
    except Exception as e:
        print(f"Index initialization notice: {e}")
    try:
        ensure_financial_year_associations()
    except Exception as e:
        print(f"Financial year association notice: {e}")
    _db_initialized = True
