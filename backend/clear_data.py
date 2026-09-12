import os
from database import db

def clear_all_operational_data():
    print("==================================================")
    print("  PURGING ALL OPERATIONAL & TRANSACTIONAL DATA    ")
    print("==================================================")

    collections_to_clear = [
        "schemes",
        "budget_allocations",
        "state_transfers",
        "district_allocations",
        "projects",
        "milestones",
        "documents",
        "complaints",
        "audit_reports",
        "fraud_reports",
        "blockchain_transactions",
        "blockchain_tx_logs",
        "notifications",
        "budgets",
        "fund_transfers",
        "state_allocations",
        "progress_updates",
        "audits",
    ]

    for col in collections_to_clear:
        r = db[col].delete_many({})
        print(f"[-] Deleted {r.deleted_count} records from collection: {col}")

    # Clean backend/uploads (preserving .gitkeep)
    uploads_dir = os.path.join(os.path.dirname(__file__), "uploads")
    files_deleted = 0
    if os.path.exists(uploads_dir):
        for f in os.listdir(uploads_dir):
            if f == ".gitkeep":
                continue
            fp = os.path.join(uploads_dir, f)
            if os.path.isfile(fp):
                try:
                    os.remove(fp)
                    files_deleted += 1
                except Exception as e:
                    print(f"Error removing {f}: {e}")

    print(f"[-] Removed {files_deleted} off-chain files from backend/uploads/")

    print("==================================================")
    print("  DATA PURGE COMPLETE — USERS & MASTER DATA KEPT ")
    print("==================================================")

if __name__ == "__main__":
    clear_all_operational_data()
