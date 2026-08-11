from database import db
from auth_middleware import hash_password
from datetime import datetime

state_users = [
    {
        "name": "Karnataka State Treasury Officer",
        "email": "karnataka@govtfund.gov.in",
        "password": hash_password("State@123"),
        "role": "STATE",
        "state_code": "KA",
        "state_name": "Karnataka",
        "department": "Karnataka State Finance & Treasury Department",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "name": "Maharashtra State Treasury Officer",
        "email": "state@govtfund.gov.in",
        "password": hash_password("State@123"),
        "role": "STATE",
        "state_code": "MH",
        "state_name": "Maharashtra",
        "department": "Maharashtra Planning & Finance Department",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "name": "Gujarat State Treasury Officer",
        "email": "gujarat@govtfund.gov.in",
        "password": hash_password("State@123"),
        "role": "STATE",
        "state_code": "GJ",
        "state_name": "Gujarat",
        "department": "Gujarat Finance Department",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "name": "Tamil Nadu State Treasury Officer",
        "email": "tamilnadu@govtfund.gov.in",
        "password": hash_password("State@123"),
        "role": "STATE",
        "state_code": "TN",
        "state_name": "Tamil Nadu",
        "department": "Tamil Nadu Finance Department",
        "is_active": True,
        "created_at": datetime.utcnow()
    },
    {
        "name": "Uttar Pradesh State Treasury Officer",
        "email": "up@govtfund.gov.in",
        "password": hash_password("State@123"),
        "role": "STATE",
        "state_code": "UP",
        "state_name": "Uttar Pradesh",
        "department": "Uttar Pradesh Finance Department",
        "is_active": True,
        "created_at": datetime.utcnow()
    }
]

for su in state_users:
    db.users.update_one({"email": su["email"]}, {"$set": su}, upsert=True)
    print(f"Seeded state officer: {su['email']} for {su['state_name']} ({su['state_code']})")
