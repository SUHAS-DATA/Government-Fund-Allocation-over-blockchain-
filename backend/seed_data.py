import os
from datetime import datetime, timezone
from database import db
from auth_middleware import hash_password

def seed():
    print("Starting automated database seeding for FUNDSYSTEM...")

    # 1. Seed Users for all 6 Roles
    users_data = [
        # SUPER ADMIN
        {
            "name": "Central Super Administrator",
            "email": "admin@govtfund.gov.in",
            "password": hash_password("Admin@123"),
            "role": "SUPER_ADMIN",
            "department": "Cabinet Secretariat & National Planning Commission",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        # FINANCE AUTHORITY
        {
            "name": "Finance Disbursal Officer",
            "email": "finance@govtfund.gov.in",
            "password": hash_password("Finance@123"),
            "role": "FINANCE",
            "department": "Ministry of Finance (Public Fund Disbursal Division)",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        # STATE TREASURY OFFICERS
        {
            "name": "Karnataka State Treasury Officer",
            "email": "karnataka@govtfund.gov.in",
            "password": hash_password("State@123"),
            "role": "STATE",
            "state_code": "KA",
            "state_name": "Karnataka",
            "department": "Karnataka State Finance & Treasury Department",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
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
            "created_at": datetime.now(timezone.utc)
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
            "created_at": datetime.now(timezone.utc)
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
            "created_at": datetime.now(timezone.utc)
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
            "created_at": datetime.now(timezone.utc)
        },
        # DISTRICT IMPLEMENTING AGENCIES
        {
            "name": "Belagavi District Collector & Agency",
            "email": "district.belagavi@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Belagavi",
            "department": "District Rural Development Agency, Belagavi",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "Bengaluru Urban District Collector & Agency",
            "email": "district.bengaluru@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Bengaluru Urban",
            "department": "District Rural Development Agency, Bengaluru",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "Mysuru District Collector & Agency",
            "email": "district.mysuru@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "KA",
            "state_name": "Karnataka",
            "district_name": "Mysuru",
            "department": "District Planning & Rural Development, Mysuru",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "District Development Collector (Pune)",
            "email": "district@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "MH",
            "state_name": "Maharashtra",
            "district_name": "Pune",
            "department": "District Rural Development Agency (DRDA), Pune",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "District Development Authority (Nagpur)",
            "email": "district.nagpur@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "MH",
            "state_name": "Maharashtra",
            "district_name": "Nagpur",
            "department": "District Planning Council, Nagpur",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "District Development Agency (Chennai)",
            "email": "district.chennai@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "TN",
            "state_name": "Tamil Nadu",
            "district_name": "Chennai",
            "department": "District Project Implementation Agency, Chennai",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "District Development Agency (Lucknow)",
            "email": "district.lucknow@govtfund.gov.in",
            "password": hash_password("District@123"),
            "role": "DISTRICT",
            "state_code": "UP",
            "state_name": "Uttar Pradesh",
            "district_name": "Lucknow",
            "department": "District Rural Development Agency, Lucknow",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        # CONTRACTORS
        {
            "name": "Apex Infrastructure Contractors Pvt Ltd",
            "email": "contractor@buildcorp.in",
            "password": hash_password("Contractor@123"),
            "role": "CONTRACTOR",
            "company_name": "Apex Infrastructure & Civil Works Ltd.",
            "gst_number": "29AABCU9603R1ZM",
            "pan_number": "AABCU9603R",
            "license_number": "PWD/KA/CLASS1/2024/889",
            "experience_years": 14,
            "state_code": "KA",
            "district_name": "Bengaluru Urban",
            "wallet_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "Karnataka Highway Infra Concessionaires Pvt Ltd",
            "email": "contractor.ka@infra.in",
            "password": hash_password("Contractor@123"),
            "role": "CONTRACTOR",
            "company_name": "Karnataka Highway Infra Concessionaires Pvt Ltd",
            "gst_number": "29AAACK1234F1Z5",
            "pan_number": "AAACK1234F",
            "license_number": "PWD/KA/ROADS/2023/114",
            "experience_years": 18,
            "state_code": "KA",
            "district_name": "Bengaluru Urban",
            "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "name": "Southern Roads & Bridges Infrastructure Ltd",
            "email": "contractor.south@infra.in",
            "password": hash_password("Contractor@123"),
            "role": "CONTRACTOR",
            "company_name": "Southern Roads & Bridges Infrastructure Ltd",
            "gst_number": "29AABCS5544K1ZR",
            "pan_number": "AABCS5544K",
            "license_number": "PWD/KA/BRIDGES/2022/045",
            "experience_years": 11,
            "state_code": "KA",
            "district_name": "Bengaluru Urban",
            "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        },
        # AUDITOR
        {
            "name": "Chief Blockchain Forensic Auditor",
            "email": "auditor@auditindia.gov.in",
            "password": hash_password("Auditor@123"),
            "role": "AUDITOR",
            "department": "Comptroller and Auditor General (CAG) Blockchain Cell",
            "is_active": True,
            "created_at": datetime.now(timezone.utc)
        }
    ]

    for u in users_data:
        existing = db.users.find_one({"email": u["email"]})
        if not existing:
            res = db.users.insert_one(u)
            user_id = str(res.inserted_id)
            print(f"  + Seeded user: {u['email']} ({u['role']})")
        else:
            user_id = str(existing["_id"])
            db.users.update_one(
                {"email": u["email"]},
                {"$set": {
                    "password": u["password"],
                    "name": u["name"],
                    "state_code": u.get("state_code"),
                    "state_name": u.get("state_name"),
                    "district_name": u.get("district_name"),
                    "company_name": u.get("company_name"),
                    "wallet_address": u.get("wallet_address"),
                    "is_active": True
                }}
            )

        # Ensure Contractor KYC record
        if u["role"] == "CONTRACTOR":
            db.contractor_kyc.update_one(
                {"company_name": u["company_name"]},
                {"$set": {
                    "user_id": user_id,
                    "company_name": u["company_name"],
                    "gst_number": u["gst_number"],
                    "pan_number": u["pan_number"],
                    "license_number": u["license_number"],
                    "experience_years": u["experience_years"],
                    "kyc_status": "APPROVED",
                    "verified_by": "District Development Authority",
                    "verification_remarks": "Class-1 PWD registered highway contractor verified with statutory credentials.",
                    "created_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )

    # 2. Key Ministries / Departments
    departments = [
        {"code": "INFRA", "name": "Road Transport & Infrastructure", "budget_share": 35.0, "head": "Principal Secretary (Infrastructure)"},
        {"code": "HEALTH", "name": "Health & Family Welfare", "budget_share": 25.0, "head": "Director General of Health Services"},
        {"code": "WATER", "name": "Jal Shakti & Rural Water Supply", "budget_share": 20.0, "head": "Mission Director (Jal Jeevan)"},
        {"code": "EDU", "name": "Primary & Secondary Education", "budget_share": 12.0, "head": "Secretary (School Education)"},
        {"code": "AGRI", "name": "Agriculture & Farmer Welfare", "budget_share": 8.0, "head": "Commissioner for Agriculture"}
    ]
    for d in departments:
        db.departments.update_one({"code": d["code"]}, {"$set": d}, upsert=True)

    # 3. Seed States & Districts
    states = [
        {"code": "KA", "name": "Karnataka", "treasury_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"},
        {"code": "MH", "name": "Maharashtra", "treasury_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"},
        {"code": "GJ", "name": "Gujarat", "treasury_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"},
        {"code": "TN", "name": "Tamil Nadu", "treasury_address": "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"},
        {"code": "UP", "name": "Uttar Pradesh", "treasury_address": "0x976EA74026E726554dB657fA54763abd0C3a0aa9"}
    ]
    for s in states:
        db.states.update_one({"code": s["code"]}, {"$set": s}, upsert=True)

    districts = [
        {"state_code": "KA", "state_name": "Karnataka", "name": "Bengaluru Urban", "treasury_address": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Mysuru", "treasury_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Belagavi", "treasury_address": "0x90F79bf6EB2c4f870365E785982E1f101E93b906"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Mangaluru", "treasury_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"},
        {"state_code": "MH", "state_name": "Maharashtra", "name": "Pune", "treasury_address": "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"},
        {"state_code": "MH", "state_name": "Maharashtra", "name": "Nagpur", "treasury_address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B21E8f"},
        {"state_code": "GJ", "state_name": "Gujarat", "name": "Ahmedabad", "treasury_address": "0xBcd4042DE499D14e55001CcbB24a551F3b954096"},
        {"state_code": "TN", "state_name": "Tamil Nadu", "name": "Chennai", "treasury_address": "0x71bE63f3384f5fb9899544c7b62414778140467c"},
        {"state_code": "UP", "state_name": "Uttar Pradesh", "name": "Lucknow", "treasury_address": "0xa0Ee7A142d267C1f36714E4a8F75612F20a79720"}
    ]
    for dist in districts:
        db.districts.update_one({"name": dist["name"]}, {"$set": dist}, upsert=True)

    # 4. Seed Flagship National Schemes
    schemes = [
        {
            "code": "PMGSY",
            "name": "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)",
            "department_code": "INFRA",
            "department_name": "Road Transport & Infrastructure",
            "description": "Connecting unconnected habitations with all-weather motorable roads and high-load bridges.",
            "target_budget": 1200000000.0,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "code": "JAL-JEEVAN",
            "name": "National Jal Jeevan Mission (Functional Tap Connections)",
            "department_code": "WATER",
            "department_name": "Jal Shakti & Rural Water Supply",
            "description": "Providing safe and adequate drinking water through individual household tap connections to all rural homes.",
            "target_budget": 1000000000.0,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "code": "NHIM",
            "name": "National Health Infrastructure Mission",
            "department_code": "HEALTH",
            "department_name": "Health & Family Welfare",
            "description": "Upgrading district trauma hospitals, primary health centers, and diagnostic pathology networks.",
            "target_budget": 800000000.0,
            "created_at": datetime.now(timezone.utc)
        },
        {
            "code": "SAMAGRA-SHIKSHA",
            "name": "Samagra Shiksha Digital Classroom Infrastructure",
            "department_code": "EDU",
            "department_name": "Primary & Secondary Education",
            "description": "Equipping rural higher secondary institutions with digital smart classrooms and computer laboratories.",
            "target_budget": 500000000.0,
            "created_at": datetime.now(timezone.utc)
        }
    ]
    for sc in schemes:
        db.schemes.update_one({"code": sc["code"]}, {"$set": sc}, upsert=True)

    # 5. Seed Multi-Year Financial Cycles
    fys = [
        {
            "year": "2025-26",
            "title": "Union Budget FY 2025-2026",
            "total_budget": 4500000000.0,
            "status": "CLOSED",
            "start_date": "2025-04-01",
            "end_date": "2026-03-31",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "year": "2026-27",
            "title": "Union Budget FY 2026-2027",
            "total_budget": 5000000000.0,
            "status": "ACTIVE",
            "start_date": "2026-04-01",
            "end_date": "2027-03-31",
            "created_at": datetime.now(timezone.utc)
        },
        {
            "year": "2027-28",
            "title": "Union Budget FY 2027-2028 (Projected)",
            "total_budget": 6000000000.0,
            "status": "UPCOMING",
            "start_date": "2027-04-01",
            "end_date": "2028-03-31",
            "created_at": datetime.now(timezone.utc)
        }
    ]
    for fy in fys:
        existing_fy = db.financial_years.find_one({"year": fy["year"]})
        if not existing_fy:
            db.financial_years.insert_one(fy)

    print("Automated seeding completed successfully!")

if __name__ == "__main__":
    seed()
