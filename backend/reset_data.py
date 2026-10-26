import os
import shutil

# In Render Web Shell, service env vars might not be exported to interactive bash by default.
# Auto-resolve MONGODB_URI and MONGODB_DB_NAME from the running container service process.
if not os.getenv("MONGODB_URI") or "127.0.0.1" in os.getenv("MONGODB_URI", ""):
    if os.path.exists("/proc"):
        for pid in sorted(os.listdir("/proc"), key=lambda x: int(x) if x.isdigit() else 999999):
            if pid.isdigit() and pid != str(os.getpid()):
                env_file = f"/proc/{pid}/environ"
                try:
                    with open(env_file, "rb") as f:
                        entries = f.read().split(b"\x00")
                        for entry in entries:
                            if entry.startswith(b"MONGODB_URI="):
                                val = entry.split(b"=", 1)[1].decode("utf-8", errors="ignore")
                                if val and "127.0.0.1" not in val:
                                    os.environ["MONGODB_URI"] = val
                            elif entry.startswith(b"MONGODB_DB_NAME="):
                                val = entry.split(b"=", 1)[1].decode("utf-8", errors="ignore")
                                if val:
                                    os.environ["MONGODB_DB_NAME"] = val
                except Exception:
                    pass
                if os.getenv("MONGODB_URI") and "127.0.0.1" not in os.getenv("MONGODB_URI", ""):
                    break

from database import db

def reset_all_transaction_data():
    print("==================================================")
    print("  PURGING ALL FINANCIAL, FUND & INPUT STORAGE DATA")
    print("==================================================")
    print(f"[*] Target Database Name: {db.name}")
    if db.name != "FUNDSYSTEM":
        raise ValueError(f"CRITICAL SAFETY ABORT: Target database must be 'FUNDSYSTEM', found '{db.name}'")

    current_uri = os.getenv("MONGODB_URI", "")
    if "127.0.0.1" in current_uri or "localhost" in current_uri:
        raise ValueError(
            "CRITICAL SAFETY ABORT: MONGODB_URI is pointing to localhost/127.0.0.1! "
            "Please ensure production Atlas MONGODB_URI is loaded in this shell before running reset."
        )

    # 1. Operational & User-Inputted Fund Allocation Collections
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
    for col_name, label in fund_collections:
        res = db[col_name].delete_many({})
        print(f"[-] Deleted {res.deleted_count} {label} ({col_name})")

    # 2. Project, Milestone & Evidence Collections
    project_collections = [
        ("projects", "Projects"),
        ("milestones", "Milestones"),
        ("progress_updates", "Progress Updates"),
        ("documents", "Uploaded Documents & Hashes"),
        ("evidence", "Evidence Records"),
        ("qr_codes", "Project QR Codes"),
    ]
    for col_name, label in project_collections:
        res = db[col_name].delete_many({})
        print(f"[-] Deleted {res.deleted_count} {label} ({col_name})")

    # 3. Audits, Fraud Reports & Grievances
    audit_collections = [
        ("fraud_reports", "Fraud Reports"),
        ("audit_reports", "Audit Reports"),
        ("audits", "Audits"),
        ("audit_logs", "Operational Audit Logs"),
        ("complaints", "Citizen Grievances & Complaints"),
    ]
    for col_name, label in audit_collections:
        res = db[col_name].delete_many({})
        print(f"[-] Deleted {res.deleted_count} {label} ({col_name})")

    # 4. Transaction Logs & Notifications
    tx_collections = [
        ("blockchain_transactions", "Blockchain Transaction Receipts"),
        ("blockchain_tx_logs", "Blockchain Tx Logs"),
        ("financial_transactions", "Financial & Bank Transactions"),
        ("notifications", "System Notifications"),
    ]
    for col_name, label in tx_collections:
        res = db[col_name].delete_many({})
        print(f"[-] Deleted {res.deleted_count} {label} ({col_name})")

    # 5. Reset Contractor Operational Project Counters (Preserving KYC Status & Identity)
    # db.contractor_kyc is preserved intact (all 12 records with APPROVED statuses and verification remarks preserved)
    r_contractors = db.contractors.update_many(
        {},
        {"$set": {
            "active_projects_count": 0,
            "completed_projects_count": 0
        }}
    )
    print(f"[*] Reset {r_contractors.modified_count} Contractors operational project counters to 0 (KYC statuses preserved)")

    # 6. Reset all Department and Administrative Level Financial Balances to 0
    r_depts = db.departments.update_many(
        {},
        {"$set": {
            "allocated_budget": 0.0,
            "transferred_to_state": 0.0
        }}
    )
    print(f"[*] Reset financial balances to 0 for {r_depts.modified_count} Departments")

    r_states = db.states.update_many(
        {},
        {"$set": {
            "total_received": 0.0,
            "allocated_to_districts": 0.0
        }}
    )
    print(f"[*] Reset financial balances to 0 for {r_states.modified_count} State Administrative Levels")

    r_districts = db.districts.update_many(
        {},
        {"$set": {
            "total_received": 0.0,
            "allocated_to_projects": 0.0
        }}
    )
    print(f"[*] Reset financial balances to 0 for {r_districts.modified_count} District Administrative Levels")

    # 7. Clean all off-chain files from backend/uploads including evidence subdirectories
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    if os.path.exists(uploads_dir):
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
                    print(f"[!] Warning deleting file {file_path}: {e}")
            for d in dirs:
                dir_path = os.path.join(root, d)
                # Keep evidence folder structure but empty
                if d == "evidence":
                    continue
                try:
                    if not os.listdir(dir_path):
                        os.rmdir(dir_path)
                except Exception:
                    pass

        # Ensure .gitkeep in uploads and uploads/evidence
        evidence_dir = os.path.join(uploads_dir, "evidence")
        os.makedirs(evidence_dir, exist_ok=True)
        for target_dir in [uploads_dir, evidence_dir]:
            gitkeep = os.path.join(target_dir, ".gitkeep")
            if not os.path.exists(gitkeep):
                with open(gitkeep, "w") as fp:
                    fp.write("# Keep directory in git\n")

        print(f"[-] Cleaned {files_removed} off-chain files and evidence from backend/uploads/")

    print("==================================================")
    print("  INPUT STORAGE & TRANSACTIONAL DATA PURGE COMPLETE")
    print("  ADMIN USERS, DEPARTMENTS & MASTER DATA PRESERVED ")
    print("==================================================")

if __name__ == "__main__":
    reset_all_transaction_data()

