import os
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("MONGODB_DB_NAME", "FUNDSYSTEM")

client = MongoClient(MONGO_URI)
db = client[DB_NAME]

def init_indexes():
    """Create essential MongoDB indexes with safe conflict handling"""
    # 1. Users collection
    try:
        db.users.create_index([("email", ASCENDING)], unique=True)
    except Exception as e:
        print(f"Warning initializing users index: {e}")

    # 2. Financial Years collection
    try:
        db.financial_years.create_index([("year", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing financial_years index: {e}")

    # 3. Departments collection
    try:
        db.departments.create_index([("code", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing departments index: {e}")

    # 4. States collection
    try:
        db.states.create_index([("code", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing states index: {e}")

    # 5. Schemes collection
    try:
        db.schemes.create_index([("code", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing schemes index: {e}")

    # 6. Budget Allocations collection
    try:
        db.budget_allocations.create_index([("allocation_id", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing budget_allocations index: {e}")

    # 7. State Transfers collection
    try:
        db.state_transfers.create_index([("transfer_id", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing state_transfers index: {e}")

    # 8. District Allocations collection
    try:
        db.district_allocations.create_index([("district_alloc_id", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing district_allocations index: {e}")

    # 9. Projects collection
    try:
        db.projects.create_index([("project_id", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing projects index: {e}")

    # 10. Documents collection
    try:
        db.documents.create_index([("document_id", ASCENDING)], unique=True, sparse=True)
        db.documents.create_index([("sha256_hash", ASCENDING)])
    except Exception as e:
        print(f"Warning initializing documents index: {e}")

    # 11. Complaints / Grievances collection
    try:
        try:
            db.complaints.drop_index("ref_id_1")
        except Exception:
            pass
        db.complaints.create_index([("reference_id", ASCENDING)], unique=True, sparse=True)
    except Exception as e:
        print(f"Warning initializing complaints index: {e}")

    # 12. Blockchain Transactions collection
    try:
        db.blockchain_transactions.create_index([("tx_hash", ASCENDING)], unique=True, sparse=True)
        db.blockchain_transactions.create_index([("timestamp", DESCENDING)])
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

# Initialize indexes when imported
init_indexes()
