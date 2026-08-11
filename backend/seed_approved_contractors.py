from database import db
from auth_middleware import hash_password
from datetime import datetime

contractors_seed = [
    {
        "contractor_id": "CON-KA-APEX",
        "username": "contractor.apex",
        "email": "contractor@buildcorp.in",
        "password": hash_password("Contractor@123"),
        "name": "Apex Infrastructure Contractors Pvt Ltd",
        "company_name": "Apex Infrastructure & Civil Works Ltd.",
        "role": "CONTRACTOR",
        "department": "Public Works & Civil Engineering",
        "state_code": "KA",
        "district_name": "Belagavi",
        "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        "gst_number": "29AABCU9603R1ZM",
        "pan_number": "AABCU9603R",
        "license_number": "PWD/KA/CLASS-1/2024/089",
        "experience_years": 14,
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "contractor_id": "CON-KA-HIGHWAY",
        "username": "contractor.ka",
        "email": "contractor.ka@infra.in",
        "password": hash_password("Contractor@123"),
        "name": "Karnataka Highway Infra Concessionaires",
        "company_name": "Karnataka Highway Infra Concessionaires Pvt Ltd",
        "role": "CONTRACTOR",
        "department": "Highway Infrastructure & Civil Works",
        "state_code": "KA",
        "district_name": "Bengaluru Urban",
        "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        "gst_number": "29AAACK1234F1Z5",
        "pan_number": "AAACK1234F",
        "license_number": "PWD/KA/ROADS/2023/114",
        "experience_years": 18,
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "contractor_id": "CON-MH-INFRA",
        "username": "contractor.mh",
        "email": "contractor.mh@infra.in",
        "password": hash_password("Contractor@123"),
        "name": "Maharashtra Infrastructure & Expressway Works",
        "company_name": "Maharashtra Infrastructure & Expressway Works Ltd.",
        "role": "CONTRACTOR",
        "department": "Expressway & Urban Bridges",
        "state_code": "MH",
        "district_name": "Pune",
        "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
        "gst_number": "27AAACM9988P1ZZ",
        "pan_number": "AAACM9988P",
        "license_number": "PWD/MH/CLASS-1/2023/512",
        "experience_years": 15,
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "contractor_id": "CON-TN-SOUTHERN",
        "username": "contractor.south",
        "email": "contractor.south@infra.in",
        "password": hash_password("Contractor@123"),
        "name": "Southern Roads & Bridges Infrastructure",
        "company_name": "Southern Roads & Bridges Infrastructure Ltd",
        "role": "CONTRACTOR",
        "department": "Bridge Construction & High-Speed Corridors",
        "state_code": "TN",
        "district_name": "Chennai",
        "wallet_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
        "gst_number": "33AABCS5544K1ZR",
        "pan_number": "AABCS5544K",
        "license_number": "PWD/TN/BRIDGES/2022/045",
        "experience_years": 12,
        "is_active": True,
        "created_at": datetime.utcnow()
    }
]

for c in contractors_seed:
    user_data = dict(c)
    db.users.update_one({"email": c["email"]}, {"$set": user_data}, upsert=True)
    user_record = db.users.find_one({"email": c["email"]})
    user_id = str(user_record["_id"])

    # Update KYC record
    kyc_doc = {
        "user_id": user_id,
        "email": c["email"],
        "contractor_id": c["contractor_id"],
        "company_name": c["company_name"],
        "gst_number": c["gst_number"],
        "pan_number": c["pan_number"],
        "license_number": c["license_number"],
        "experience_years": c["experience_years"],
        "kyc_status": "APPROVED",
        "verified_by": "District Development Authority",
        "verification_remarks": "Class-1 PWD registered highway contractor verified with ISO-9001 certification.",
        "updated_at": datetime.utcnow()
    }
    db.contractor_kyc.update_one({"$or": [{"user_id": user_id}, {"email": c["email"]}]}, {"$set": kyc_doc}, upsert=True)
    print(f"[OK] Seeded Contractor: {c['contractor_id']} | {c['company_name']} | {c['email']}")

print(f"\n[SUCCESS] Seeded {len(contractors_seed)} approved contractor accounts.")
