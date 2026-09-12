import os
from database import db

def reset_all_transaction_data():
    print("==================================================")
    print("  PURGING ALL FINANCIAL, FUND & BLOCKCHAIN DATA   ")
    print("==================================================")

    # 1. Clear Financial Years, Schemes & Fund Allocations
    r_fy = db.financial_years.delete_many({})
    print(f"[-] Deleted {r_fy.deleted_count} Financial Years")

    r_schemes = db.schemes.delete_many({})
    print(f"[-] Deleted {r_schemes.deleted_count} Schemes")

    r_alloc = db.budget_allocations.delete_many({})
    print(f"[-] Deleted {r_alloc.deleted_count} Central Budget Allocations")

    r_transfers = db.state_transfers.delete_many({})
    print(f"[-] Deleted {r_transfers.deleted_count} State Treasury Transfers")

    r_dist_alloc = db.district_allocations.delete_many({})
    print(f"[-] Deleted {r_dist_alloc.deleted_count} District Allocations")

    db.budgets.delete_many({})
    db.fund_transfers.delete_many({})
    db.state_allocations.delete_many({})
    db.progress_updates.delete_many({})

    # 2. Clear Projects, Escrows & Milestones
    r_proj = db.projects.delete_many({})
    print(f"[-] Deleted {r_proj.deleted_count} Projects")

    r_miles = db.milestones.delete_many({})
    print(f"[-] Deleted {r_miles.deleted_count} Milestones")

    r_docs = db.documents.delete_many({})
    print(f"[-] Deleted {r_docs.deleted_count} Uploaded Documents & Hashes")

    # 3. Clear Audits & Fraud Reports
    r_fraud = db.fraud_reports.delete_many({})
    print(f"[-] Deleted {r_fraud.deleted_count} Fraud Reports")

    r_audits = db.audit_reports.delete_many({})
    print(f"[-] Deleted {r_audits.deleted_count} Audit Reports")
    db.audits.delete_many({})

    # 4. Clear Grievances & Blockchain Tx Logs
    r_comp = db.complaints.delete_many({})
    print(f"[-] Deleted {r_comp.deleted_count} Citizen Grievances")

    r_tx = db.blockchain_transactions.delete_many({})
    print(f"[-] Deleted {r_tx.deleted_count} Blockchain Transaction Receipts")
    db.blockchain_tx_logs.delete_many({})

    r_notif = db.notifications.delete_many({})
    print(f"[-] Deleted {r_notif.deleted_count} Notifications")

    # 5. Reset Contractor KYC to UNDER_REVIEW so user can test the KYC approval process
    r_kyc = db.contractor_kyc.update_many(
        {},
        {"$set": {
            "kyc_status": "UNDER_REVIEW",
            "verified_by": None,
            "verification_notes": None
        }}
    )
    print(f"[*] Reset {r_kyc.modified_count} Contractor KYC status to UNDER_REVIEW")

    # 6. Clean Uploads folder
    upload_folder = os.path.join(os.path.dirname(__file__), "uploads")
    if os.path.exists(upload_folder):
        count = 0
        for f in os.listdir(upload_folder):
            fpath = os.path.join(upload_folder, f)
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                    count += 1
                except Exception:
                    pass
        print(f"[-] Cleaned {count} off-chain files from backend/uploads/")

    print("==================================================")
    print("  DATABASE RESET COMPLETE — READY FOR MANUAL RUN  ")
    print("==================================================")

if __name__ == "__main__":
    reset_all_transaction_data()
