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
            "wallet_address": "0x1E3A8A93FD0b4c8A9bE14c46f1F0A84D63A50001",
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
            "wallet_address": "0x0F766E99F6E4A836bE9344445839DC9E86DA0002",
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
            "wallet_address": "0x0369A1BAE6FD3c8290f79BF6Eb2C4F8703650003",
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
            "wallet_address": "0x14dC79964da2C08b23698B3D3cc7Ca32193D0004",
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
            "wallet_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C0005",
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
            "wallet_address": "0x9965507D1a55bcC2695C58ba16FB37d819B00006",
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
            "wallet_address": "0x976EA74026E726554dB657fA54763abd0C3a0007",
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
            "wallet_address": "0x7C3AEDDDD6FE90f79BF6eb2C4f870365E7850008",
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
            "wallet_address": "0x90F79bf6EB2c4f870365E785982E1f101E930009",
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
            "wallet_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA420010",
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
            "wallet_address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B20011",
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
            "wallet_address": "0x8b3a350cf5c34c9194ca85829a2df0ec315300015",
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
            "wallet_address": "0x71bE63f3384f5fb9899544c7b624147781400013",
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
            "wallet_address": "0xa0Ee7A142d267C1f36714E4a8F75612F20a70012",
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
            "wallet_address": "0xC2410CFED7AA70997970C51812dc3A010C7d0017",
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
            "wallet_address": "0x5de4111afa1a4b94908f83103eb1f17063670018",
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
            "wallet_address": "0x7c852118294e51e653712a81e05800f419140019",
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
            "wallet_address": "0xB91C1CFECACAa0Ee7A142d267C1f36714E4a8F750020",
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
                    "wallet_address": u.get("wallet_address"),
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
        {"code": "KA", "name": "Karnataka", "treasury_address": "0x0369A1BAE6FD3c8290f79BF6Eb2C4F8703650003"},
        {"code": "MH", "name": "Maharashtra", "treasury_address": "0x14dC79964da2C08b23698B3D3cc7Ca32193D0004"},
        {"code": "GJ", "name": "Gujarat", "treasury_address": "0x15d34AAf54267DB7D7c367839AAf71A00a2C0005"},
        {"code": "TN", "name": "Tamil Nadu", "treasury_address": "0x9965507D1a55bcC2695C58ba16FB37d819B00006"},
        {"code": "UP", "name": "Uttar Pradesh", "treasury_address": "0x976EA74026E726554dB657fA54763abd0C3a0007"}
    ]
    for s in states:
        db.states.update_one({"code": s["code"]}, {"$set": s}, upsert=True)

    districts = [
        {"state_code": "KA", "state_name": "Karnataka", "name": "Bengaluru Urban", "treasury_address": "0x90F79bf6EB2c4f870365E785982E1f101E930009"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Mysuru", "treasury_address": "0x3C44CdDdB6a900fa2b585dd299e03d12FA420010"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Belagavi", "treasury_address": "0x7C3AEDDDD6FE90f79BF6eb2C4f870365E7850008"},
        {"state_code": "KA", "state_name": "Karnataka", "name": "Mangaluru", "treasury_address": "0x92db14e403b83dfe3df233f83dfa3a0d709600016"},
        {"state_code": "MH", "state_name": "Maharashtra", "name": "Pune", "treasury_address": "0x23618e81E3f5cdF7f54C3d65f7FBc0aBf5B20011"},
        {"state_code": "MH", "state_name": "Maharashtra", "name": "Nagpur", "treasury_address": "0x8b3a350cf5c34c9194ca85829a2df0ec315300015"},
        {"state_code": "GJ", "state_name": "Gujarat", "name": "Ahmedabad", "treasury_address": "0xBcd4042DE499D14e55001CcbB24a551F3b900014"},
        {"state_code": "TN", "state_name": "Tamil Nadu", "name": "Chennai", "treasury_address": "0x71bE63f3384f5fb9899544c7b624147781400013"},
        {"state_code": "UP", "state_name": "Uttar Pradesh", "name": "Lucknow", "treasury_address": "0xa0Ee7A142d267C1f36714E4a8F75612F20a70012"}
    ]
    for dist in districts:
        db.districts.update_one({"name": dist["name"]}, {"$set": dist}, upsert=True)

    # 4. Flagship National Schemes (Cleared by user request - empty initially)
    # Schemes will be created dynamically by Admin through the UI portal

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

    # 6. Synchronize Multi-Tier Addresses in Existing Blockchain Transactions
    sync_multitier_transactions()

    print("Automated seeding completed successfully!")

def sync_multitier_transactions():
    import blockchain_service as bcs
    print("[*] Synchronizing multi-tier blockchain transaction addresses...")
    txs = list(db.blockchain_transactions.find())
    for t in txs:
        op = t.get("operation_type", "")
        ent_id = t.get("entity_id", "")
        updates = {}
        if op == "CENTRAL_BUDGET_ALLOCATION":
            updates["from_address"] = bcs.get_entity_wallet("ADMIN")
            updates["to_address"] = bcs.get_entity_wallet("FINANCE")
            updates["from_entity"] = "Central Secretariat (Cabinet Planning)"
            updates["to_entity"] = "Ministry of Finance (Public Fund Authority)"
            updates["transfer_tier"] = "CENTRAL_TO_FINANCE"
            updates["flow_stage"] = "1. Central Sanction -> Finance Dept"
        elif op in ["FINANCE_STATE_TRANSFER", "STATE_TRANSFER"]:
            st_trf = db.state_transfers.find_one({"transfer_id": ent_id})
            st_code = st_trf.get("state_code", "KA") if st_trf else "KA"
            st_name = st_trf.get("state_name", "Karnataka") if st_trf else "Karnataka"
            updates["from_address"] = bcs.get_entity_wallet("FINANCE")
            updates["to_address"] = bcs.get_entity_wallet("STATE", st_code)
            updates["from_entity"] = "Ministry of Finance (Public Fund Authority)"
            updates["to_entity"] = f"{st_name} State Treasury"
            updates["transfer_tier"] = "FINANCE_TO_STATE"
            updates["flow_stage"] = f"2. Finance Dept -> {st_name} Treasury"
        elif op == "STATE_DISTRICT_ALLOCATION":
            dist_alloc = db.district_allocations.find_one({"district_alloc_id": ent_id})
            d_name = dist_alloc.get("district_name", "Belagavi") if dist_alloc else "Belagavi"
            s_name = dist_alloc.get("state_name", "Karnataka") if dist_alloc else "Karnataka"
            s_code = dist_alloc.get("state_code", "KA") if dist_alloc else "KA"
            updates["from_address"] = bcs.get_entity_wallet("STATE", s_code)
            updates["to_address"] = bcs.get_entity_wallet("DISTRICT", d_name)
            updates["from_entity"] = f"{s_name} State Treasury"
            updates["to_entity"] = f"{d_name} District Development Agency"
            updates["transfer_tier"] = "STATE_TO_DISTRICT"
            updates["flow_stage"] = f"3. {s_name} Treasury -> {d_name} District"
        elif op == "PROJECT_ESCROW_CREATION":
            proj = db.projects.find_one({"project_id": ent_id})
            d_name = proj.get("district_name", "Belagavi") if proj else "Belagavi"
            updates["from_address"] = bcs.get_entity_wallet("DISTRICT", d_name)
            updates["to_address"] = bcs.get_entity_wallet("ESCROW")
            updates["from_entity"] = f"{d_name} District Development Agency"
            updates["to_entity"] = "Project Smart Contract Escrow"
            updates["transfer_tier"] = "DISTRICT_TO_ESCROW"
            updates["flow_stage"] = f"4. {d_name} District -> Project Escrow Lock"
        elif op == "MILESTONE_PAYMENT_RELEASE":
            proj = db.projects.find_one({"project_id": ent_id})
            c_name = proj.get("contractor_name", "Apex Infrastructure") if proj else "Apex Infrastructure"
            updates["from_address"] = bcs.get_entity_wallet("ESCROW")
            updates["to_address"] = bcs.get_entity_wallet("CONTRACTOR", c_name)
            updates["from_entity"] = "Project Smart Contract Escrow"
            updates["to_entity"] = f"{c_name} (Contractor)"
            updates["transfer_tier"] = "ESCROW_TO_CONTRACTOR"
            updates["flow_stage"] = f"5. Smart Contract Escrow -> {c_name}"
        elif op == "PROJECT_FROZEN":
            updates["from_address"] = bcs.get_entity_wallet("AUDITOR")
            updates["to_address"] = bcs.get_entity_wallet("ESCROW")
            updates["from_entity"] = "CAG Audit & Inspection Directorate"
            updates["to_entity"] = "Project Smart Contract Escrow"
            updates["transfer_tier"] = "AUDITOR_TO_ESCROW"
            updates["flow_stage"] = "Emergency Oversight Freeze"

        if updates:
            db.blockchain_transactions.update_one({"_id": t["_id"]}, {"$set": updates})

if __name__ == "__main__":
    seed()
