import os
import random
import string
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Request, Depends, status, Query
from fastapi.responses import JSONResponse
from bson import ObjectId
from database import db, serialize_doc
from auth_middleware import require_roles
import blockchain_service as bcs

router = APIRouter()
admin_bp = router

def generate_allocation_id(fy):
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"ALLOC-{fy}-{rand_suffix}"

@router.get("/dashboard")
async def dashboard(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    selected_fy = fy
    
    # 1. Fetch active and all financial years
    all_fys = list(db.financial_years.find().sort("year", -1))
    active_fy_doc = db.financial_years.find_one({"status": "ACTIVE"}) or (all_fys[0] if all_fys else None)
    
    target_fy_year = selected_fy if selected_fy else (active_fy_doc.get("year") if active_fy_doc else "2026-27")
    target_fy_doc = db.financial_years.find_one({"year": target_fy_year}) or active_fy_doc

    # 2. Compute FY-specific metrics
    fy_pipeline = [
        {"$match": {"financial_year": target_fy_year}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}, "count": {"$sum": 1}}}
    ]
    fy_stats = list(db.budget_allocations.aggregate(fy_pipeline))
    fy_allocated = fy_stats[0]["total"] if fy_stats else 0.0
    fy_disbursed = fy_stats[0]["disbursed"] if fy_stats else 0.0
    fy_allocations_count = fy_stats[0]["count"] if fy_stats else 0

    sanctioned_ceiling = float(target_fy_doc.get("total_budget", 5000000000.0)) if target_fy_doc else 5000000000.0
    remaining_unallocated = max(0.0, sanctioned_ceiling - fy_allocated)

    # 3. Overall / Lifetime stats
    total_budget_pipeline = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}}}
    ]
    budget_stats = list(db.budget_allocations.aggregate(total_budget_pipeline))
    lifetime_allocated = budget_stats[0]["total"] if budget_stats else 0.0
    lifetime_disbursed = budget_stats[0]["disbursed"] if budget_stats else 0.0

    schemes_count = db.schemes.count_documents({})
    states_count = db.states.count_documents({})
    districts_count = db.districts.count_documents({})
    projects_count = db.projects.count_documents({})
    open_fraud_alerts = db.fraud_reports.count_documents({"status": "OPEN"})

    # Recent transfers and allocations
    recent_transfers = list(db.state_transfers.find().sort("created_at", -1).limit(5))
    recent_allocations = list(db.budget_allocations.find({"financial_year": target_fy_year}).sort("created_at", -1).limit(5))
    if not recent_allocations and not selected_fy:
        recent_allocations = list(db.budget_allocations.find().sort("created_at", -1).limit(5))

    return {
        "success": True,
        "metrics": {
            "selected_financial_year": target_fy_year,
            "active_financial_year": active_fy_doc.get("year") if active_fy_doc else "2026-27",
            "sanctioned_union_ceiling": sanctioned_ceiling,
            "allocated_to_schemes": fy_allocated,
            "disbursed_to_states": fy_disbursed,
            "remaining_unallocated_ceiling": remaining_unallocated,
            "fy_allocations_count": fy_allocations_count,
            "total_sanctioned_budget": lifetime_allocated,
            "total_disbursed_to_states": lifetime_disbursed,
            "schemes_count": schemes_count,
            "states_count": states_count,
            "districts_count": districts_count,
            "active_projects_count": projects_count,
            "open_fraud_alerts": open_fraud_alerts
        },
        "financial_years": serialize_doc(all_fys),
        "recent_transfers": serialize_doc(recent_transfers),
        "recent_allocations": serialize_doc(recent_allocations)
    }

# --- Financial Years ---
@router.get("/financial-years")
async def get_financial_years(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"]))
):
    fys = list(db.financial_years.find().sort("year", -1))
    
    enriched_fys = []
    for fy in fys:
        y = fy.get("year")
        alloc_stats = list(db.budget_allocations.aggregate([
            {"$match": {"financial_year": y}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}, "disbursed": {"$sum": "$disbursed_amount"}, "count": {"$sum": 1}}}
        ]))
        allocated = alloc_stats[0]["total"] if alloc_stats else 0.0
        disbursed = alloc_stats[0]["disbursed"] if alloc_stats else 0.0
        count = alloc_stats[0]["count"] if alloc_stats else 0
        total_b = float(fy.get("total_budget", 0.0))

        fy_dict = serialize_doc(fy)
        fy_dict["allocated_amount"] = allocated
        fy_dict["disbursed_amount"] = disbursed
        fy_dict["remaining_budget"] = max(0.0, total_b - allocated)
        fy_dict["allocations_count"] = count
        enriched_fys.append(fy_dict)

    return {"success": True, "financial_years": enriched_fys}

@router.post("/financial-years", status_code=status.HTTP_201_CREATED)
async def create_financial_year(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    year = data.get("year", "").strip()
    if not year:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Financial year (e.g. 2026-27) is required"}
        )

    status_val = data.get("status", "ACTIVE")
    if status_val == "ACTIVE":
        db.financial_years.update_many({"year": {"$ne": year}}, {"$set": {"status": "CLOSED"}})

    parts = year.split('-')
    start_year = parts[0]
    end_suffix = parts[1] if len(parts) > 1 else str(int(start_year) + 1)[-2:]
    end_year = f"20{end_suffix}" if len(end_suffix) == 2 else end_suffix

    doc = {
        "year": year,
        "title": data.get("title", f"Union Budget FY {year}"),
        "total_budget": float(data.get("total_budget", 5000000000.0)),
        "status": status_val,
        "start_date": data.get("start_date", f"{start_year}-04-01"),
        "end_date": data.get("end_date", f"{end_year}-03-31"),
        "created_at": datetime.now(timezone.utc)
    }
    db.financial_years.update_one({"year": year}, {"$set": doc}, upsert=True)
    return {"success": True, "message": f"Financial year {year} saved successfully", "financial_year": serialize_doc(doc)}

@router.put("/financial-years/{year}/activate")
async def activate_financial_year(
    year: str,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    fy = db.financial_years.find_one({"year": year})
    if not fy:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Financial year not found"}
        )

    db.financial_years.update_many({"year": {"$ne": year}}, {"$set": {"status": "CLOSED"}})
    db.financial_years.update_one({"year": year}, {"$set": {"status": "ACTIVE", "updated_at": datetime.now(timezone.utc)}})
    
    return {"success": True, "message": f"Financial year {year} is now ACTIVE."}

# --- Departments ---
@router.get("/departments")
async def get_departments(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"]))
):
    depts = list(db.departments.find().sort("name", 1))
    return {"success": True, "departments": serialize_doc(depts)}

@router.post("/departments", status_code=status.HTTP_201_CREATED)
async def create_department(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    if not code or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Department code and name are required"}
        )

    doc = {
        "code": code,
        "name": name,
        "budget_share": float(data.get("budget_share", 20.0)),
        "head": data.get("head", ""),
        "created_at": datetime.now(timezone.utc)
    }
    db.departments.update_one({"code": code}, {"$set": doc}, upsert=True)
    return {"success": True, "message": "Department registered successfully", "department": serialize_doc(doc)}

# --- States & Districts ---
@router.get("/states")
async def get_states(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"]))
):
    st_list = list(db.states.find().sort("name", 1))
    return {"success": True, "states": serialize_doc(st_list)}

@router.post("/states", status_code=status.HTTP_201_CREATED)
async def create_state(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    if not code or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "State code and name required"}
        )

    doc = {
        "code": code,
        "name": name,
        "treasury_address": data.get("treasury_address", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"),
        "created_at": datetime.now(timezone.utc)
    }
    db.states.update_one({"code": code}, {"$set": doc}, upsert=True)
    return {"success": True, "message": "State configured successfully", "state": serialize_doc(doc)}

@router.get("/districts")
async def get_districts(
    state_code: Optional[str] = Query(None),
    state_name: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"]))
):
    query = {}
    if state_code:
        query["state_code"] = state_code.strip().upper()
    elif state_name:
        s_name = state_name.strip()
        query["$or"] = [{"state_name": s_name}, {"state_code": s_name.upper()}]

    dist_list = list(db.districts.find(query).sort("name", 1))
    return {"success": True, "districts": serialize_doc(dist_list)}

@router.post("/districts", status_code=status.HTTP_201_CREATED)
async def create_district(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    name = data.get("name", "").strip()
    state_code = data.get("state_code", "").strip().upper()
    if not name or not state_code:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "District name and state code required"}
        )

    st = db.states.find_one({"code": state_code})
    doc = {
        "name": name,
        "state_code": state_code,
        "state_name": st.get("name") if st else state_code,
        "treasury_address": data.get("treasury_address", "0x14dC79964da2C08b23698B3D3cc7Ca32193d9955"),
        "created_at": datetime.now(timezone.utc)
    }
    db.districts.update_one({"name": name}, {"$set": doc}, upsert=True)
    return {"success": True, "message": "District configured successfully", "district": serialize_doc(doc)}

# --- Schemes ---
@router.get("/schemes")
async def get_schemes(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT", "CONTRACTOR", "AUDITOR"]))
):
    sc_list = list(db.schemes.find().sort("name", 1))
    return {"success": True, "schemes": serialize_doc(sc_list)}

@router.post("/schemes", status_code=status.HTTP_201_CREATED)
async def create_scheme(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    code = data.get("code", "").strip().upper()
    name = data.get("name", "").strip()
    if not code or not name:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Scheme code and name required"}
        )

    doc = {
        "code": code,
        "name": name,
        "department_code": data.get("department_code", "INFRA"),
        "department_name": data.get("department_name", "Road Transport & Infrastructure"),
        "description": data.get("description", ""),
        "target_budget": float(data.get("target_budget", 1000000000.0)),
        "created_at": datetime.now(timezone.utc)
    }
    db.schemes.update_one({"code": code}, {"$set": doc}, upsert=True)
    return {"success": True, "message": "Scheme created successfully", "scheme": serialize_doc(doc)}

# --- Central Budget Allocation & Blockchain Dispatch ---
@router.post("/budget/allocate", status_code=status.HTTP_201_CREATED)
async def allocate_budget(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    fy = data.get("financial_year", "2026-27")
    department = data.get("department", "Road Transport & Infrastructure")
    scheme_name = data.get("scheme_name", "Pradhan Mantri Gram Sadak Yojana (All-Weather Rural Roads)")
    amount = float(data.get("amount", 0))

    if amount <= 0:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Allocation amount must be greater than zero"}
        )

    alloc_id = generate_allocation_id(fy)

    # 1. Record on Ethereum Smart Contract
    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.record_budget_allocation_onchain(alloc_id, scheme_name, department, amount)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning on-chain budget allocation transaction error: {e}")

    # 2. Record in MongoDB
    alloc_doc = {
        "allocation_id": alloc_id,
        "financial_year": fy,
        "department": department,
        "scheme_name": scheme_name,
        "amount": amount,
        "disbursed_amount": 0.0,
        "status": "SANCTIONED",
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "allocated_by": current_user["name"],
        "created_at": datetime.now(timezone.utc)
    }
    db.budget_allocations.insert_one(alloc_doc)

    # Log to global blockchain transactions collection
    if tx_hash:
        from_wallet = bcs.get_entity_wallet("ADMIN")
        to_wallet = bcs.get_entity_wallet("FINANCE")
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "CENTRAL_BUDGET_ALLOCATION",
            "entity_id": alloc_id,
            "from_address": from_wallet,
            "to_address": to_wallet,
            "from_entity": "Central Secretariat (Cabinet Planning)",
            "to_entity": "Ministry of Finance (Public Fund Authority)",
            "transfer_tier": "CENTRAL_TO_FINANCE",
            "flow_stage": "1. Central Sanction -> Finance Dept",
            "amount": amount,
            "details": f"Budget Sanctioned for {scheme_name} ({department}) -> Forwarded to Ministry of Finance",
            "timestamp": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Central budget allocation {alloc_id} registered and anchored on blockchain",
        "allocation_id": alloc_id,
        "blockchain": {"tx_hash": tx_hash, "block_number": block_num},
        "budget": serialize_doc(alloc_doc)
    }

@router.get("/allocations")
async def get_allocations(
    fy: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    query = {}
    if fy and fy != "ALL":
        query["financial_year"] = fy
    allocations = list(db.budget_allocations.find(query).sort("created_at", -1))
    return {"success": True, "allocations": serialize_doc(allocations)}

# --- Send to Finance ---
@router.post("/budget/send-to-finance")
async def send_to_finance(
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    alloc_id = data.get("allocation_id")
    if not alloc_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Allocation ID is required"}
        )

    alloc = db.budget_allocations.find_one({"allocation_id": alloc_id})
    if not alloc:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Allocation not found"}
        )

    db.budget_allocations.update_one(
        {"allocation_id": alloc_id},
        {"$set": {
            "status": "SENT_TO_FINANCE",
            "sent_to_finance_at": datetime.now(timezone.utc),
            "forwarding_notes": data.get("notes", "Sanctioned for Public Finance Disbursal")
        }}
    )

    db.notifications.insert_one({
        "recipient_role": "FINANCE",
        "title": "New Budget Allocation Received",
        "message": f"Central Allocation {alloc_id} for '{alloc.get('scheme_name')}' (INR {alloc.get('amount'):,.2f}) forwarded for State Treasury transfer.",
        "link": f"/finance/transfers?allocation_id={alloc_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {"success": True, "message": f"Allocation {alloc_id} forwarded to Finance Department successfully."}

# --- User & Role Management ---
@router.get("/users")
async def get_users(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    users = list(db.users.find().sort("created_at", -1))
    return {"success": True, "users": serialize_doc(users)}

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    new_role = data.get("role", "").upper()
    if not new_role:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Role is required"}
        )

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"role": new_role, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "message": f"User role updated to {new_role}"}

@router.put("/users/{user_id}/status")
async def toggle_user_status(
    user_id: str,
    request: Request,
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    is_active = data.get("is_active", True)
    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"is_active": is_active, "updated_at": datetime.now(timezone.utc)}}
    )
    return {"success": True, "message": f"User status updated to {'Active' if is_active else 'Suspended'}"}

# --- Audit Reports Review ---
@router.get("/audit-reports")
async def get_audit_reports(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN"]))
):
    reports = list(db.audit_reports.find().sort("created_at", -1))
    return {"success": True, "audit_reports": serialize_doc(reports)}

# --- Blockchain Explorer ---
@router.get("/blockchain-explorer")
async def admin_blockchain_explorer(
    current_user: dict = Depends(require_roles(["SUPER_ADMIN", "AUDITOR", "FINANCE", "STATE", "DISTRICT"]))
):
    connected = bcs.is_blockchain_connected()
    account = bcs.get_account()
    contract = bcs.get_contract()
    chain_id = None
    if connected:
        try:
            chain_id = bcs.w3.eth.chain_id
        except Exception:
            chain_id = 1337

    txs = list(db.blockchain_transactions.find().sort("timestamp", -1).limit(200))
    return {
        "success": True,
        "status": {
            "connected": connected,
            "rpc_url": bcs.RPC_URL,
            "chain_id": chain_id,
            "wallet_address": account.address if account else None,
            "contract_address": bcs.contract_address,
            "contract_deployed": contract is not None
        },
        "transactions": serialize_doc(txs)
    }
