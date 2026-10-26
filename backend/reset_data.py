import os
import shutil
from database import db

def reset_all_transaction_data():
    print("==================================================")
    print("  PURGING ALL FINANCIAL, FUND & INPUT STORAGE DATA")
    print("==================================================")

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

    # 5. Reset Contractor Operational Counters & KYC status
    r_kyc = db.contractor_kyc.update_many(
        {},
        {"$set": {
            "kyc_status": "UNDER_REVIEW",
            "verified_by": None,
            "verification_notes": None,
            "verification_remarks": None,
            "reviewed_at": None,
            "reviewed_by": None,
        }}
    )
    print(f"[*] Reset {r_kyc.modified_count} Contractor KYC records to UNDER_REVIEW")

    r_contractors = db.contractors.update_many(
        {},
        {"$set": {
            "active_projects_count": 0,
            "completed_projects_count": 0,
            "kyc_status": "UNDER_REVIEW",
            "kyc_documents": []
        }}
    )
    print(f"[*] Reset {r_contractors.modified_count} Contractors operational project counters to 0")

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

