from database import db
from auth_middleware import hash_password
from datetime import datetime

dist_users = [
    {
        "officer_id": "DIST-KA-BELAGAVI",
        "username": "district.belagavi",
        "name": "Belagavi District Collector & Agency",
        "email": "district.belagavi@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "KA",
        "state_name": "Karnataka",
        "district_name": "Belagavi",
        "department": "District Rural Development Agency (DRDA), Belagavi",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-KA-BENGALURU",
        "username": "district.bengaluru",
        "name": "Bengaluru Urban District Collector & Agency",
        "email": "district.bengaluru@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "KA",
        "state_name": "Karnataka",
        "district_name": "Bengaluru Urban",
        "department": "District Rural Development Agency, Bengaluru Urban",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-KA-MYSURU",
        "username": "district.mysuru",
        "name": "Mysuru District Collector & Agency",
        "email": "district.mysuru@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "KA",
        "state_name": "Karnataka",
        "district_name": "Mysuru",
        "department": "District Planning & Rural Development, Mysuru",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-MH-PUNE",
        "username": "district.pune",
        "name": "District Development Collector (Pune)",
        "email": "district@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "MH",
        "state_name": "Maharashtra",
        "district_name": "Pune",
        "department": "District Rural Development Agency (DRDA), Pune",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-MH-NAGPUR",
        "username": "district.nagpur",
        "name": "District Development Authority (Nagpur)",
        "email": "district.nagpur@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "MH",
        "state_name": "Maharashtra",
        "district_name": "Nagpur",
        "department": "District Planning Council, Nagpur",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-GJ-AHMEDABAD",
        "username": "district.ahmedabad",
        "name": "District Development Agency (Ahmedabad)",
        "email": "district.ahmedabad@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "GJ",
        "state_name": "Gujarat",
        "district_name": "Ahmedabad",
        "department": "District Rural Development Agency, Ahmedabad",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-TN-CHENNAI",
        "username": "district.chennai",
        "name": "District Project Implementation Agency (Chennai)",
        "email": "district.chennai@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "TN",
        "state_name": "Tamil Nadu",
        "district_name": "Chennai",
        "department": "District Project Implementation Agency, Chennai",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "officer_id": "DIST-UP-LUCKNOW",
        "username": "district.lucknow",
        "name": "District Development Agency (Lucknow)",
        "email": "district.lucknow@govtfund.gov.in",
        "password": hash_password("District@123"),
        "role": "DISTRICT",
        "state_code": "UP",
        "state_name": "Uttar Pradesh",
        "district_name": "Lucknow",
        "department": "District Rural Development Agency, Lucknow",
        "is_active": True,
        "created_at": datetime.utcnow()
    }
]

for du in dist_users:
    db.users.update_one({"email": du["email"]}, {"$set": du}, upsert=True)
    print(f"Seeded District Officer: {du['officer_id']} | {du['email']} | {du['district_name']} ({du['state_code']})")

print(f"\n[SUCCESS] Seeded {len(dist_users)} District Officer accounts with dedicated Officer IDs.")
