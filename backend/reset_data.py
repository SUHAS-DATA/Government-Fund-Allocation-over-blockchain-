import os
import sys
import json
import shutil
import urllib.parse

# Ensure backend directory is in sys.path regardless of execution cwd
_backend_dir = os.path.dirname(os.path.abspath(__file__))
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

from pymongo import MongoClient

# ------------------------------------------------------------------------------
# Production Configuration & Environment Loading
# ------------------------------------------------------------------------------
# 1. Environment Variable Precedence: PROD_MONGODB_URI -> MONGODB_URI
prod_uri = os.getenv("PROD_MONGODB_URI") or os.getenv("MONGODB_URI")
if prod_uri:
    os.environ["MONGODB_URI"] = prod_uri

# Enforce target database name
target_db_name = os.getenv("MONGODB_DB_NAME", "FUNDSYSTEM")
os.environ["MONGODB_DB_NAME"] = target_db_name

from database import _sanitize_mongo_uri

# Re-enforce prod_uri after database import (in case dotenv loaded local .env)
if prod_uri:
    os.environ["MONGODB_URI"] = prod_uri

def _mask_uri(uri: str) -> str:
    """Safely mask username and password from connection URI for display."""
    if not uri:
        return "<NOT CONFIGURED>"
    try:
        if "://" in uri and "@" in uri:
            prefix, rest = uri.split("://", 1)
            userinfo, hostinfo = rest.rsplit("@", 1)
            user = userinfo.split(":", 1)[0] if ":" in userinfo else "****"
            return f"{prefix}://{user}:****@{hostinfo.split('?')[0]}"
    except Exception:
        pass
    return "mongodb+srv://****:****@<cluster>"

def run_reset():
    # --------------------------------------------------------------------------
    # Argument Parsing: Default to Dry-Run for Absolute Safety
    # --------------------------------------------------------------------------
    is_dry_run = "--dry-run" in sys.argv or os.getenv("DRY_RUN", "").lower() in ("1", "true", "yes")
    is_execute = "--execute" in sys.argv

    if not is_execute and not is_dry_run:
        print("[SAFETY NOTICE] No execution mode flag specified (--execute or --dry-run).")
        print("[SAFETY NOTICE] Defaulting to safe DRY-RUN mode.")
        is_dry_run = True

    mode_label = "DRY RUN (READ-ONLY SIMULATION)" if is_dry_run else "LIVE DESTRUCTIVE RESET"

    print("==================================================================")
    print(f"  GOVTFUND PRODUCTION DATABASE RESET — {mode_label}")
    print("==================================================================")

    # --------------------------------------------------------------------------
    # Safety Check 1: Verify Connection URI is Present and Non-Local
    # --------------------------------------------------------------------------
    current_uri = os.getenv("MONGODB_URI", "")
    if not current_uri:
        raise ValueError(
            "CRITICAL SAFETY ABORT: Connection string environment variable 'MONGODB_URI' "
            "(or 'PROD_MONGODB_URI') is not set in this shell.\n"
            "Please set $env:MONGODB_URI before running."
        )

    if "127.0.0.1" in current_uri or "localhost" in current_uri:
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Connection string points to localhost or 127.0.0.1!\n"
            f"Current URI: {_mask_uri(current_uri)}\n"
            "This procedure is strictly restricted to production MongoDB Atlas FUNDSYSTEM."
        )

    # --------------------------------------------------------------------------
    # Safety Check 2: Connect and Verify Database Target is FUNDSYSTEM
    # --------------------------------------------------------------------------
    try:
        client = MongoClient(_sanitize_mongo_uri(current_uri), serverSelectionTimeoutMS=8000)
        # Verify cluster ping
        client.admin.command("ping")
    except Exception as conn_err:
        raise ConnectionError(
            f"CRITICAL SAFETY ABORT: Could not establish connection to MongoDB Atlas cluster.\n"
            f"Target: {_mask_uri(current_uri)}\n"
            f"Error details: {conn_err}"
        )

    db = client[target_db_name]

    print(f"[*] Target Cluster:  {_mask_uri(current_uri)}")
    print(f"[*] Target Database: {db.name}")

    if db.name != "FUNDSYSTEM":
        raise ValueError(
            f"CRITICAL SAFETY ABORT: Target database must be 'FUNDSYSTEM', but connected to '{db.name}'."
        )

    # Check connected node addresses to reject accidental localhost tunnel
    for host, port in client.nodes:
        if "127.0.0.1" in host or "localhost" in host:
            raise ValueError(f"CRITICAL SAFETY ABORT: Connected cluster node '{host}' is local!")

    # --------------------------------------------------------------------------
    # Safety Check 3: Verify Pre-Reset Backup Completeness
    # --------------------------------------------------------------------------
    backup_path = os.path.join(os.path.dirname(__file__), "scratch", "production_backup_pre_reset.json")
    if not os.path.exists(backup_path):
        raise FileNotFoundError(
            f"CRITICAL SAFETY ABORT: Verified backup file not found at:\n{backup_path}\n"
            "Execution is blocked because a verified pre-reset backup is mandatory."
        )

    try:
        with open(backup_path, "r", encoding="utf-8") as bf:
            backup_data = json.load(bf)
        required_collections = [
            "financial_years", "schemes", "budget_allocations", "state_transfers",
            "district_allocations", "projects", "blockchain_transactions",
            "contractor_kyc", "departments", "states", "districts", "users"
        ]
        missing_collections = [c for c in required_collections if c not in backup_data]
        if missing_collections:
            raise ValueError(f"Backup is incomplete. Missing collections: {missing_collections}")

        backup_size = os.path.getsize(backup_path)
        print(f"[*] Pre-Reset Backup Verified: {backup_path} ({backup_size:,} bytes, {len(backup_data)} keys)")
    except Exception as b_err:
        raise ValueError(f"CRITICAL SAFETY ABORT: Pre-reset backup verification failed: {b_err}")

    print("------------------------------------------------------------------")

    # --------------------------------------------------------------------------
    # Operational Collections to Clear
    # --------------------------------------------------------------------------
    fund_collections = [
        ("financial_years", "Financial Years"),
        ("schemes", "Schemes"),
        ("budget_allocations", "Central Budget Allocations"),
        ("state_transfers", "State Treasury Transfers"),
        ("district_allocations", "District Allocations"),
        ("contractor_transfers", "Contractor Transfers"),
        ("budgets", "Budgets"),
        ("fund_transfers", "Fund Transfers"),
        ("state_allocations", "State Allocations"),
        ("allocations", "Legacy Allocations"),
    ]

    project_collections = [
        ("projects", "Projects"),
        ("milestones", "Milestones"),
        ("progress_updates", "Progress Updates"),
        ("documents", "Uploaded Documents & Hashes"),
        ("evidence", "Evidence Records"),
        ("qr_codes", "Project QR Codes"),
    ]

    audit_collections = [
        ("fraud_reports", "Fraud Reports"),
        ("audit_reports", "Audit Reports"),
        ("audits", "Audits"),
        ("audit_logs", "Operational Audit Logs"),
        ("complaints", "Citizen Grievances & Complaints"),
    ]

    tx_collections = [
        ("blockchain_transactions", "Off-chain Blockchain Transaction Receipts"),
        ("blockchain_tx_logs", "Blockchain Tx Logs"),
        ("financial_transactions", "Financial & Bank Transactions"),
        ("notifications", "System Notifications"),
    ]

    all_purge_collections = fund_collections + project_collections + audit_collections + tx_collections

    # --------------------------------------------------------------------------
    # Section A: Document Deletions (or Dry-Run Inspection)
    # --------------------------------------------------------------------------
    print("\n[SECTION 1: OPERATIONAL COLLECTIONS PURGE]")
    total_would_delete = 0

    for col_name, label in all_purge_collections:
        count = db[col_name].count_documents({})
        if is_dry_run:
            print(f"  [DRY RUN] Would delete: {count:>3} records from {label} ({col_name})")
            total_would_delete += count
        else:
            res = db[col_name].delete_many({})
            print(f"  [-] Deleted: {res.deleted_count:>3} {label} ({col_name})")

    if is_dry_run:
        print(f"  => Total operational documents that would be deleted: {total_would_delete}")

    # --------------------------------------------------------------------------
    # Section B: Operational Balances & Project Counters Reset
    # --------------------------------------------------------------------------
    print("\n[SECTION 2: OPERATIONAL BALANCES & COUNTERS RESET]")

    # 1. Contractors (only active_projects_count and completed_projects_count; KYC preserved)
    c_query = {"$or": [{"active_projects_count": {"$ne": 0}}, {"completed_projects_count": {"$ne": 0}}]}
    contractors_to_reset = db.contractors.count_documents(c_query)
    total_contractors = db.contractors.count_documents({})
    if is_dry_run:
        print(f"  [DRY RUN] Would reset active/completed counters to 0 for: {contractors_to_reset} / {total_contractors} Contractors")
    else:
        r_c = db.contractors.update_many({}, {"$set": {"active_projects_count": 0, "completed_projects_count": 0}})
        print(f"  [*] Reset {r_c.modified_count} Contractors operational project counters to 0")

    # 2. Departments
    d_query = {"$or": [{"allocated_budget": {"$ne": 0.0}}, {"transferred_to_state": {"$ne": 0.0}}]}
    depts_to_reset = db.departments.count_documents(d_query)
    total_depts = db.departments.count_documents({})
    if is_dry_run:
        print(f"  [DRY RUN] Would reset allocated_budget and transferred_to_state to 0.0 for: {depts_to_reset} / {total_depts} Departments")
    else:
        r_d = db.departments.update_many({}, {"$set": {"allocated_budget": 0.0, "transferred_to_state": 0.0}})
        print(f"  [*] Reset financial balances to 0 for {r_d.modified_count} Departments")

    # 3. States
    s_query = {"$or": [{"total_received": {"$ne": 0.0}}, {"allocated_to_districts": {"$ne": 0.0}}]}
    states_to_reset = db.states.count_documents(s_query)
    total_states = db.states.count_documents({})
    if is_dry_run:
        print(f"  [DRY RUN] Would reset total_received and allocated_to_districts to 0.0 for: {states_to_reset} / {total_states} States")
    else:
        r_s = db.states.update_many({}, {"$set": {"total_received": 0.0, "allocated_to_districts": 0.0}})
        print(f"  [*] Reset financial balances to 0 for {r_s.modified_count} State Administrative Levels")

    # 4. Districts
    dst_query = {"$or": [{"total_received": {"$ne": 0.0}}, {"allocated_to_projects": {"$ne": 0.0}}]}
    districts_to_reset = db.districts.count_documents(dst_query)
    total_districts = db.districts.count_documents({})
    if is_dry_run:
        print(f"  [DRY RUN] Would reset total_received and allocated_to_projects to 0.0 for: {districts_to_reset} / {total_districts} Districts")
    else:
        r_dst = db.districts.update_many({}, {"$set": {"total_received": 0.0, "allocated_to_projects": 0.0}})
        print(f"  [*] Reset financial balances to 0 for {r_dst.modified_count} District Administrative Levels")

    # --------------------------------------------------------------------------
    # Section C: Master Data Preservation Verification
    # --------------------------------------------------------------------------
    print("\n[SECTION 3: PRESERVED MASTER DATA VERIFICATION]")
    users_count = db.users.count_documents({})
    kyc_count = db.contractor_kyc.count_documents({})
    approved_kyc_count = db.contractor_kyc.count_documents({"kyc_status": "APPROVED"})
    bank_count = db.bank_accounts.count_documents({})

    print(f"  [PRESERVED] {users_count:>2} User accounts (passwords, logins, roles intact)")
    print(f"  [PRESERVED] {kyc_count:>2} Contractor KYC profiles ({approved_kyc_count} APPROVED statuses intact)")
    print(f"  [PRESERVED] {bank_count:>2} Institutional bank accounts intact")
    print(f"  [PRESERVED] Smart contracts & on-chain Sepolia transactions completely untouched")

    # --------------------------------------------------------------------------
    # Section D: Clean Uploads Directory (Off-Chain Files)
    # --------------------------------------------------------------------------
    print("\n[SECTION 4: OFF-CHAIN UPLOAD STORAGE]")
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    if os.path.exists(uploads_dir):
        files_count = 0
        for root, dirs, files in os.walk(uploads_dir):
            for f in files:
                if f != ".gitkeep":
                    files_count += 1
        if is_dry_run:
            print(f"  [DRY RUN] Would clean: {files_count} off-chain files from backend/uploads/")
        else:
            files_removed = 0
            for root, dirs, files in os.walk(uploads_dir, topdown=False):
                for f in files:
                    if f == ".gitkeep":
                        continue
                    file_path = os.path.join(root, f)
                    try:
                        os.remove(file_path)
                        files_removed += 1
                    except Exception as e:
                        print(f"  [!] Warning deleting file {file_path}: {e}")
                for d in dirs:
                    dir_path = os.path.join(root, d)
                    if d == "evidence":
                        continue
                    try:
                        if not os.listdir(dir_path):
                            os.rmdir(dir_path)
                    except Exception:
                        pass

            # Ensure .gitkeep files exist
            evidence_dir = os.path.join(uploads_dir, "evidence")
            os.makedirs(evidence_dir, exist_ok=True)
            for target_dir in [uploads_dir, evidence_dir]:
                gitkeep = os.path.join(target_dir, ".gitkeep")
                if not os.path.exists(gitkeep):
                    with open(gitkeep, "w") as fp:
                        fp.write("# Keep directory in git\n")
            print(f"  [-] Cleaned {files_removed} off-chain files and evidence from backend/uploads/")
    else:
        print("  [*] backend/uploads/ does not exist or is already clean.")

    # --------------------------------------------------------------------------
    # Summary
    # --------------------------------------------------------------------------
    print("\n==================================================================")
    if is_dry_run:
        print("  DRY RUN COMPLETED SUCCESSFULLY — ZERO DATA MODIFIED")
        print("  All safety pre-checks passed. Backup verified.")
        print("  Target verified: MongoDB Atlas FUNDSYSTEM (non-local).")
        print("  To execute destructive reset, re-run with --execute flag.")
    else:
        print("  PRODUCTION RESET COMPLETED SUCCESSFULLY")
        print("  ALL APPROVED OPERATIONAL COLLECTIONS CLEARED.")
        print("  ALL USER ACCOUNTS, PASSWORDS, ROLES & KYC STATUSES PRESERVED.")
    print("==================================================================")

if __name__ == "__main__":
    run_reset()
