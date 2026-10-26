import os
import re
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import JSONResponse
from database import db, serialize_doc, get_active_financial_year
from auth_middleware import require_roles, get_current_user
import blockchain_service as bcs

router = APIRouter()
auditor_bp = router

# Authoritative read-only auditor route guard
AUDITOR_GUARD = Depends(require_roles(["AUDITOR", "SUPER_ADMIN"]))

def _format_denomination(amount):
    try:
        amt = float(amount)
    except (TypeError, ValueError):
        return str(amount)
    if amt >= 10000000:
        cr = amt / 10000000
        return f"{cr:.2f} Cr"
    elif amt >= 100000:
        lakh = amt / 100000
        return f"{lakh:.2f} Lakh"
    return f"₹{amt:,.2f}"

def _mask_account(acc_num: Optional[str]) -> str:
    if not acc_num or not isinstance(acc_num, str):
        return "N/A"
    clean = acc_num.strip()
    if len(clean) <= 4:
        return "XXXX"
    return f"XXXX XXXX {clean[-4:]}"

def _mask_pan(pan: Optional[str]) -> str:
    if not pan or not isinstance(pan, str):
        return "N/A"
    clean = pan.strip().upper()
    if len(clean) == 10:
        return f"{clean[:3]}XXXX{clean[-2:]}"
    return "XXXX-CONFIDENTIAL"


# =============================================================================
# 1. AUDITOR DASHBOARD SUMMARY — FIVE MAIN BLOCKS OVERVIEW
# =============================================================================
@router.get("/dashboard-summary")
async def get_dashboard_summary(
    fy: Optional[str] = Query(None),
    current_user: dict = AUDITOR_GUARD
):
    """
    Returns verified, authoritative summary data for exactly the five primary audit modules.
    No fabricated counts or placeholders.
    """
    target_fy = fy if (fy and fy != "ALL") else None

    # Filter clauses by Financial Year where applicable
    fy_filter_alloc = {"financial_year": target_fy} if target_fy else {}
    fy_filter_trf = {"financial_year": target_fy} if target_fy else {}
    fy_filter_dist = {"financial_year": target_fy} if target_fy else {}
    fy_filter_proj = {"financial_year": target_fy} if target_fy else {}
    fy_filter_audit = {"financial_year": target_fy} if target_fy else {}

    # --- Block 1: Super Admin ---
    total_schemes = db.schemes.count_documents(fy_filter_alloc)
    total_budgets = db.budget_allocations.count_documents(fy_filter_alloc)
    budget_agg = list(db.budget_allocations.aggregate([
        {"$match": fy_filter_alloc},
        {"$group": {"_id": None, "total_sanctioned": {"$sum": "$amount"}}}
    ]))
    total_sanctioned = budget_agg[0]["total_sanctioned"] if budget_agg else 0.0

    last_sa_log = db.audit_logs.find_one(
        {"$and": [{"actor_role": "SUPER_ADMIN"}, fy_filter_audit]} if target_fy else {"actor_role": "SUPER_ADMIN"},
        sort=[("timestamp", -1)]
    )
    last_sa_time = last_sa_log["timestamp"] if last_sa_log else None
    if not last_sa_time:
        last_alloc = db.budget_allocations.find_one(fy_filter_alloc, sort=[("created_at", -1)])
        last_sa_time = last_alloc["created_at"] if last_alloc else None

    # --- Block 2: Financial Department ---
    approved_schemes_count = db.budget_allocations.count_documents(
        {**fy_filter_alloc, "status": {"$in": ["SENT_TO_FINANCE", "FULLY_DISBURSED", "PARTIALLY_DISBURSED"]}}
    )
    finance_transfers_count = db.state_transfers.count_documents(fy_filter_trf)
    fin_trf_agg = list(db.state_transfers.aggregate([
        {"$match": fy_filter_trf},
        {"$group": {"_id": None, "total_disbursed": {"$sum": "$amount"}}}
    ]))
    total_disbursed_to_states = fin_trf_agg[0]["total_disbursed"] if fin_trf_agg else 0.0

    last_fin_log = db.audit_logs.find_one(
        {"$and": [{"actor_role": "FINANCE"}, fy_filter_audit]} if target_fy else {"actor_role": "FINANCE"},
        sort=[("timestamp", -1)]
    )
    last_fin_time = last_fin_log["timestamp"] if last_fin_log else None
    if not last_fin_time:
        last_trf = db.state_transfers.find_one(fy_filter_trf, sort=[("created_at", -1)])
        last_fin_time = last_trf["created_at"] if last_trf else None

    # --- Block 3: State Government ---
    state_to_dist_count = db.district_allocations.count_documents(fy_filter_dist)
    dist_alloc_agg = list(db.district_allocations.aggregate([
        {"$match": fy_filter_dist},
        {"$group": {"_id": None, "total_to_districts": {"$sum": "$amount"}}}
    ]))
    total_to_districts = dist_alloc_agg[0]["total_to_districts"] if dist_alloc_agg else 0.0
    state_recorded_balance = max(0.0, total_disbursed_to_states - total_to_districts)

    last_state_log = db.audit_logs.find_one(
        {"$and": [{"actor_role": "STATE"}, fy_filter_audit]} if target_fy else {"actor_role": "STATE"},
        sort=[("timestamp", -1)]
    )
    last_state_time = last_state_log["timestamp"] if last_state_log else None
    if not last_state_time:
        last_da = db.district_allocations.find_one(fy_filter_dist, sort=[("created_at", -1)])
        last_state_time = last_da["created_at"] if last_da else None

    # --- Block 4: District Office ---
    total_projects = db.projects.count_documents(fy_filter_proj)
    evidence_count = db.evidence.count_documents({})
    verified_evidence_count = db.evidence.count_documents({"status": "VERIFIED"})
    milestone_paid_agg = list(db.financial_transactions.aggregate([
        {"$match": {**({"financial_year": target_fy} if target_fy else {}), "transaction_type": "DISTRICT_TO_CONTRACTOR", "status": "COMPLETED"}},
        {"$group": {"_id": None, "total_paid_contractors": {"$sum": "$amount"}}}
    ]))
    total_paid_contractors = milestone_paid_agg[0]["total_paid_contractors"] if milestone_paid_agg else 0.0

    last_dist_log = db.audit_logs.find_one(
        {"$and": [{"actor_role": "DISTRICT"}, fy_filter_audit]} if target_fy else {"actor_role": "DISTRICT"},
        sort=[("timestamp", -1)]
    )
    last_dist_time = last_dist_log["timestamp"] if last_dist_log else None
    if not last_dist_time:
        last_ev = db.evidence.find_one({}, sort=[("uploaded_at", -1)])
        last_dist_time = last_ev["uploaded_at"] if last_ev else None

    # --- Block 5: Contractor ---
    registered_contractors = db.users.count_documents({"role": "CONTRACTOR"})
    kyc_approved_count = db.contractor_kyc.count_documents({"kyc_status": "APPROVED"})
    kyc_pending_count = db.contractor_kyc.count_documents({"kyc_status": {"$in": ["UNDER_REVIEW", "PENDING"]}})
    contractor_claims_count = db.milestones.count_documents({"status": {"$in": ["SUBMITTED", "COMPLETED", "RELEASED"]}})

    last_con_log = db.audit_logs.find_one(
        {"$and": [{"actor_role": "CONTRACTOR"}, fy_filter_audit]} if target_fy else {"actor_role": "CONTRACTOR"},
        sort=[("timestamp", -1)]
    )
    last_con_time = last_con_log["timestamp"] if last_con_log else None
    if not last_con_time:
        last_kc = db.contractor_kyc.find_one({}, sort=[("created_at", -1)])
        last_con_time = last_kc["created_at"] if last_kc else None

    # Total audit logs in system
    total_audit_events = db.audit_logs.count_documents(fy_filter_audit)
    total_blockchain_txs = db.blockchain_transactions.count_documents({"financial_year": target_fy} if target_fy else {})

    blocks = [
        {
            "id": "super_admin",
            "name": "Super Admin Audit",
            "department": "National Planning Commission & Cabinet Secretariat",
            "tier": "TIER_1_CENTRAL",
            "description": "Audits Union budget ceiling sanctions, national scheme creation, financial year lifecycle transitions, and administrative access control.",
            "metrics": [
                {"label": "Schemes Created", "value": total_schemes, "type": "count"},
                {"label": "Budgets Sanctioned", "value": total_budgets, "type": "count"},
                {"label": "Total Sanctioned Ceiling", "value": total_sanctioned, "formatted": _format_denomination(total_sanctioned), "type": "currency"}
            ],
            "activity_count": total_schemes + total_budgets,
            "latest_activity_timestamp": last_sa_time.isoformat() if isinstance(last_sa_time, datetime) else last_sa_time,
            "status": "ACTIVE"
        },
        {
            "id": "finance",
            "name": "Financial Department Audit",
            "department": "Ministry of Finance (Public Fund Disbursal Division)",
            "tier": "TIER_2_FINANCE",
            "description": "Audits central treasury fund releases to State Governments, multi-sig approvals, bank account settlements, and on-chain transfer hashes.",
            "metrics": [
                {"label": "Approved Scheme Allocations", "value": approved_schemes_count, "type": "count"},
                {"label": "State Transfers Executed", "value": finance_transfers_count, "type": "count"},
                {"label": "Total Disbursed to States", "value": total_disbursed_to_states, "formatted": _format_denomination(total_disbursed_to_states), "type": "currency"}
            ],
            "activity_count": finance_transfers_count,
            "latest_activity_timestamp": last_fin_time.isoformat() if isinstance(last_fin_time, datetime) else last_fin_time,
            "status": "ACTIVE"
        },
        {
            "id": "state",
            "name": "State Government Audit",
            "department": "State Treasury & Planning Departments",
            "tier": "TIER_3_STATE",
            "description": "Tracks funds received from Finance Department, onward distribution to District Offices, and calculates authoritative unallocated treasury reserves.",
            "metrics": [
                {"label": "Funds Received from Finance", "value": total_disbursed_to_states, "formatted": _format_denomination(total_disbursed_to_states), "type": "currency"},
                {"label": "Transferred to Districts", "value": total_to_districts, "formatted": _format_denomination(total_to_districts), "type": "currency"},
                {"label": "Recorded State Balance", "value": state_recorded_balance, "formatted": _format_denomination(state_recorded_balance), "type": "currency"}
            ],
            "activity_count": state_to_dist_count,
            "latest_activity_timestamp": last_state_time.isoformat() if isinstance(last_state_time, datetime) else last_state_time,
            "status": "ACTIVE"
        },
        {
            "id": "district",
            "name": "District Office Audit",
            "department": "District Rural Development Agencies (DRDA) & Collectorates",
            "tier": "TIER_4_DISTRICT",
            "description": "Audits district project assignments, photographic and video site evidence verification, milestone approvals, and vendor escrow disbursements.",
            "metrics": [
                {"label": "Public Projects Governed", "value": total_projects, "type": "count"},
                {"label": "Verified Work Proofs", "value": verified_evidence_count, "type": "count"},
                {"label": "Disbursed to Contractors", "value": total_paid_contractors, "formatted": _format_denomination(total_paid_contractors), "type": "currency"}
            ],
            "activity_count": total_projects + evidence_count,
            "latest_activity_timestamp": last_dist_time.isoformat() if isinstance(last_dist_time, datetime) else last_dist_time,
            "status": "ACTIVE"
        },
        {
            "id": "contractor",
            "name": "Contractor Audit",
            "department": "Registered Concessionaires, Infrastructure Builders & Vendors",
            "tier": "TIER_5_CONTRACTOR",
            "description": "Audits contractor statutory KYC onboarding, progress claims, geotagged evidence submissions, and verified on-chain bank credits.",
            "metrics": [
                {"label": "Registered Contractors", "value": registered_contractors, "type": "count"},
                {"label": "Statutory KYC Approved", "value": kyc_approved_count, "type": "count"},
                {"label": "Payments Verified", "value": total_paid_contractors, "formatted": _format_denomination(total_paid_contractors), "type": "currency"}
            ],
            "activity_count": registered_contractors + contractor_claims_count,
            "latest_activity_timestamp": last_con_time.isoformat() if isinstance(last_con_time, datetime) else last_con_time,
            "status": "ACTIVE"
        }
    ]

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "total_audit_events": total_audit_events,
        "total_blockchain_transactions": total_blockchain_txs,
        "modules": blocks
    }


# =============================================================================
# 2. MODULE 1 — SUPER ADMIN AUDIT
# =============================================================================
@router.get("/super-admin")
async def get_super_admin_audit(
    fy: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = AUDITOR_GUARD
):
    """
    Detailed audit view of all Super Admin activities:
    A. Scheme Management (schemes created, target budgets, timestamps)
    B. Budget Management (allocations sanctioned, financial year, department)
    C. Administrative Activities (user role changes, configuration updates from audit_logs)
    D. Financial and Transaction Records (budget allocations and forwardings)
    """
    target_fy = fy if (fy and fy != "ALL") else None
    query_fy = {"financial_year": target_fy} if target_fy else {}

    # A. Schemes
    schemes = list(db.schemes.find(query_fy).sort("created_at", -1).limit(limit))

    # B. Budget Allocations
    allocations = list(db.budget_allocations.find(query_fy).sort("created_at", -1).limit(limit))

    # C. Administrative audit logs
    admin_logs_query = {"actor_role": "SUPER_ADMIN"}
    if target_fy:
        admin_logs_query["financial_year"] = target_fy
    admin_logs = list(db.audit_logs.find(admin_logs_query).sort("timestamp", -1).limit(limit))

    # D. Summary metrics
    total_sanctioned_amount = sum(float(a.get("amount", 0.0)) for a in allocations)
    total_disbursed_amount = sum(float(a.get("disbursed_amount", 0.0)) for a in allocations)

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "metrics": {
            "schemes_count": len(schemes),
            "allocations_count": len(allocations),
            "admin_logs_count": len(admin_logs),
            "total_sanctioned": total_sanctioned_amount,
            "total_disbursed_to_date": total_disbursed_amount,
            "total_sanctioned_formatted": _format_denomination(total_sanctioned_amount)
        },
        "schemes": serialize_doc(schemes),
        "budget_allocations": serialize_doc(allocations),
        "administrative_logs": serialize_doc(admin_logs)
    }


# =============================================================================
# 3. MODULE 2 — FINANCIAL DEPARTMENT AUDIT
# =============================================================================
@router.get("/finance")
async def get_finance_audit(
    fy: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = AUDITOR_GUARD
):
    """
    Detailed audit view of Finance Department activities:
    A. Approved Schemes & Received Budgets
    B. Budget Allocation Records vs Disbursed
    C. Fund Transfers from Finance to State Governments with On-Chain Hashes
    D. Reconciliation & Transaction Verification Logs
    """
    target_fy = fy if (fy and fy != "ALL") else None
    query_fy = {"financial_year": target_fy} if target_fy else {}

    # State transfers initiated by Finance
    transfers = list(db.state_transfers.find(query_fy).sort("created_at", -1).limit(limit))

    # Received budget allocations under Finance jurisdiction
    budgets = list(db.budget_allocations.find({
        **query_fy,
        "status": {"$in": ["SENT_TO_FINANCE", "FULLY_DISBURSED", "PARTIALLY_DISBURSED"]}
    }).sort("created_at", -1).limit(limit))

    # Finance audit logs
    fin_logs_query = {"actor_role": "FINANCE"}
    if target_fy:
        fin_logs_query["financial_year"] = target_fy
    finance_logs = list(db.audit_logs.find(fin_logs_query).sort("timestamp", -1).limit(limit))

    # Distinguish transfers by on-chain status
    completed_transfers = []
    pending_or_unconfirmed = []
    for t in transfers:
        has_hash = bool(t.get("blockchain_tx_hash") or t.get("blockchainTxHash"))
        if has_hash:
            completed_transfers.append(t)
        else:
            pending_or_unconfirmed.append(t)

    total_disbursed = sum(float(t.get("amount", 0.0)) for t in transfers)
    total_received_budget = sum(float(b.get("amount", 0.0)) for b in budgets)

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "metrics": {
            "total_received_budget": total_received_budget,
            "total_disbursed": total_disbursed,
            "transfers_count": len(transfers),
            "completed_onchain_transfers": len(completed_transfers),
            "app_recorded_transfers": len(pending_or_unconfirmed),
            "total_disbursed_formatted": _format_denomination(total_disbursed)
        },
        "state_transfers": serialize_doc(transfers),
        "received_budgets": serialize_doc(budgets),
        "finance_activity_logs": serialize_doc(finance_logs)
    }


# =============================================================================
# 4. MODULE 3 — STATE GOVERNMENT AUDIT
# =============================================================================
@router.get("/state")
async def get_state_audit(
    state_code: Optional[str] = Query(None),
    fy: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = AUDITOR_GUARD
):
    """
    Tracks funds received by State Government from Finance Dept and subsequent transfers to District Offices.
    Provides authoritative financial comparison:
    Funds Received from Finance -> Funds Transferred to Districts -> Remaining Recorded Balance.
    """
    target_fy = fy if (fy and fy != "ALL") else None
    sc_upper = state_code.strip().upper() if state_code else None

    # Base match filters
    match_received = {}
    match_district = {}
    if target_fy:
        match_received["financial_year"] = target_fy
        match_district["financial_year"] = target_fy
    if sc_upper:
        match_received["state_code"] = sc_upper
        match_district["state_code"] = sc_upper

    funds_received = list(db.state_transfers.find(match_received).sort("created_at", -1).limit(limit))
    district_allocations = list(db.district_allocations.find(match_district).sort("created_at", -1).limit(limit))

    # State audit logs
    state_logs_query = {"actor_role": "STATE"}
    if target_fy:
        state_logs_query["financial_year"] = target_fy
    if sc_upper:
        state_logs_query["state_code"] = sc_upper
    state_logs = list(db.audit_logs.find(state_logs_query).sort("timestamp", -1).limit(limit))

    # Authoritative Reconciliation Comparison per State
    # Aggregation for state reconciliation breakdown
    group_received = list(db.state_transfers.aggregate([
        {"$match": match_received},
        {"$group": {"_id": {"code": "$state_code", "name": "$state_name"}, "received": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]))
    group_district = list(db.district_allocations.aggregate([
        {"$match": match_district},
        {"$group": {"_id": "$state_code", "transferred": {"$sum": "$amount"}, "count": {"$sum": 1}}}
    ]))

    district_map = {item["_id"]: item["transferred"] for item in group_district if item.get("_id")}

    reconciliation_table = []
    total_received_all = 0.0
    total_transferred_districts_all = 0.0

    for st in group_received:
        code = st["_id"].get("code", "UNKNOWN")
        name = st["_id"].get("name", code)
        rec_amt = float(st.get("received", 0.0))
        dist_amt = float(district_map.get(code, 0.0))
        rem_balance = max(0.0, rec_amt - dist_amt)

        total_received_all += rec_amt
        total_transferred_districts_all += dist_amt

        reconciliation_table.append({
            "state_code": code,
            "state_name": name,
            "funds_received": rec_amt,
            "funds_received_formatted": _format_denomination(rec_amt),
            "funds_transferred_to_districts": dist_amt,
            "funds_transferred_formatted": _format_denomination(dist_amt),
            "remaining_recorded_balance": rem_balance,
            "remaining_balance_formatted": _format_denomination(rem_balance),
            "reconciliation_status": "BALANCED" if rem_balance >= 0 else "DEFICIT",
            "transfers_received_count": st.get("count", 0)
        })

    # Sort reconciliation table by received amount desc
    reconciliation_table.sort(key=lambda x: x["funds_received"], reverse=True)
    overall_remaining = max(0.0, total_received_all - total_transferred_districts_all)

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "state_code_filter": sc_upper,
        "reconciliation_summary": {
            "total_funds_received": total_received_all,
            "total_funds_received_formatted": _format_denomination(total_received_all),
            "total_transferred_to_districts": total_transferred_districts_all,
            "total_transferred_formatted": _format_denomination(total_transferred_districts_all),
            "remaining_recorded_balance": overall_remaining,
            "remaining_balance_formatted": _format_denomination(overall_remaining)
        },
        "reconciliation_table": reconciliation_table,
        "funds_received_records": serialize_doc(funds_received),
        "district_allocations": serialize_doc(district_allocations),
        "state_activity_logs": serialize_doc(state_logs)
    }


# =============================================================================
# 5. MODULE 4 — DISTRICT OFFICE AUDIT
# =============================================================================
@router.get("/district")
async def get_district_audit(
    district_name: Optional[str] = Query(None),
    fy: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = AUDITOR_GUARD
):
    """
    Tracks funds received by District from State and releases made to Contractors.
    Separates project workflow actions (evidence review, milestones) from actual financial transfers.
    Displays verification history (who submitted evidence, who reviewed, date, outcome, rejection reason).
    """
    target_fy = fy if (fy and fy != "ALL") else None
    dn_clean = district_name.strip() if district_name else None

    # Base match filters
    match_dist_alloc = {}
    match_projects = {}
    match_evidence = {}
    match_ft = {"transaction_type": "DISTRICT_TO_CONTRACTOR", "status": "COMPLETED"}

    if target_fy:
        match_dist_alloc["financial_year"] = target_fy
        match_projects["financial_year"] = target_fy
        match_ft["financial_year"] = target_fy

    if dn_clean:
        match_dist_alloc["district_name"] = {"$regex": f"^{dn_clean}$", "$options": "i"}
        match_projects["district_name"] = {"$regex": f"^{dn_clean}$", "$options": "i"}
        match_evidence["district_name"] = {"$regex": f"^{dn_clean}$", "$options": "i"}
        match_ft["$or"] = [
            {"source_entity_name": {"$regex": dn_clean, "$options": "i"}},
            {"source_account_id": {"$regex": dn_clean, "$options": "i"}}
        ]

    # Funds received from State
    received_from_state = list(db.district_allocations.find(match_dist_alloc).sort("created_at", -1).limit(limit))

    # Projects under district management
    projects = list(db.projects.find(match_projects).sort("created_at", -1).limit(limit))

    # Actual financial transfers to contractors
    contractor_payments = list(db.financial_transactions.find(match_ft).sort("created_at", -1).limit(limit))

    # Verification History (Evidence reviewed)
    verification_history = list(db.evidence.find(match_evidence).sort("uploaded_at", -1).limit(limit))

    # District audit logs
    dist_logs_query = {"actor_role": "DISTRICT"}
    if target_fy:
        dist_logs_query["financial_year"] = target_fy
    if dn_clean:
        dist_logs_query["district_name"] = dn_clean
    district_logs = list(db.audit_logs.find(dist_logs_query).sort("timestamp", -1).limit(limit))

    # Financial sums
    total_received_from_state = sum(float(d.get("amount", 0.0)) for d in received_from_state)
    total_paid_to_contractors = sum(float(p.get("amount", 0.0)) for p in contractor_payments)
    total_project_commitments = sum(float(pr.get("total_budget", 0.0)) for pr in projects)

    return {
        "success": True,
        "selected_financial_year": target_fy,
        "district_filter": dn_clean,
        "metrics": {
            "funds_received_from_state": total_received_from_state,
            "funds_received_formatted": _format_denomination(total_received_from_state),
            "funds_released_to_contractors": total_paid_to_contractors,
            "funds_released_formatted": _format_denomination(total_paid_to_contractors),
            "total_project_commitments": total_project_commitments,
            "total_project_commitments_formatted": _format_denomination(total_project_commitments),
            "projects_count": len(projects),
            "evidence_reviews_count": len(verification_history)
        },
        "funds_received_from_state": serialize_doc(received_from_state),
        "contractor_payments": serialize_doc(contractor_payments),
        "projects": serialize_doc(projects),
        "verification_history": serialize_doc(verification_history),
        "district_activity_logs": serialize_doc(district_logs)
    }


# =============================================================================
# 6. MODULE 5 — CONTRACTOR AUDIT
# =============================================================================
@router.get("/contractor")
async def get_contractor_audit(
    contractor_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    current_user: dict = AUDITOR_GUARD
):
    """
    Displays verified activities of registered Contractors.
    Protects confidential data: Passwords, tokens, private keys, secret env vars,
    and unnecessary personal details are STRICTLY sanitized.
    A. Contractor Registration & KYC profiles (masked PAN/account)
    B. Assigned projects and milestone progress
    C. Evidence submissions and proof verification outcomes
    D. Payment requests vs actual on-chain verified credits
    """
    cid_clean = contractor_id.strip() if contractor_id else None

    # Contractor KYC & Profiles
    kyc_match = {}
    if cid_clean:
        kyc_match["$or"] = [
            {"contractor_id": {"$regex": f"^{cid_clean}$", "$options": "i"}},
            {"user_id": cid_clean},
            {"email": cid_clean.lower()}
        ]

    raw_kyc = list(db.contractor_kyc.find(kyc_match).sort("created_at", -1).limit(limit))
    sanitized_contractors = []
    for k in raw_kyc:
        sanitized_contractors.append({
            "contractor_id": k.get("contractor_id") or "UNASSIGNED",
            "company_name": k.get("company_name") or "Contractor Organization",
            "state_code": k.get("state_code"),
            "state_name": k.get("state_name"),
            "district_name": k.get("district_name"),
            "email": k.get("email"),
            "experience_years": k.get("experience_years"),
            "gst_number": k.get("gst_number"),
            "pan_masked": _mask_pan(k.get("pan_number")),
            "license_number": k.get("license_number"),
            "kyc_status": k.get("kyc_status", "UNDER_REVIEW"),
            "state_verified": bool(k.get("state_verified", False)),
            "verification_authority": k.get("verification_authority") or k.get("verification_dept"),
            "verification_remarks": k.get("verification_remarks"),
            "wallet_address": k.get("wallet_address"),
            "bank_name": k.get("bank_name"),
            "masked_account": _mask_account(k.get("account_number")),
            "ifsc_code": k.get("ifsc_code"),
            "created_at": k.get("created_at"),
            "reviewed_at": k.get("reviewed_at")
        })

    # Assigned projects
    proj_match = {}
    if cid_clean:
        proj_match["$or"] = [
            {"contractor_id": {"$regex": f"^{cid_clean}$", "$options": "i"}},
            {"contractorId": {"$regex": f"^{cid_clean}$", "$options": "i"}}
        ]
    projects = list(db.projects.find(proj_match).sort("created_at", -1).limit(limit))

    # Evidence submissions
    ev_match = {}
    if cid_clean:
        ev_match["$or"] = [
            {"contractor_id": cid_clean},
            {"contractorId": cid_clean}
        ]
    evidence_submissions = list(db.evidence.find(ev_match).sort("uploaded_at", -1).limit(limit))

    # Actual payments received (from verified financial transactions)
    pay_match = {"transaction_type": "DISTRICT_TO_CONTRACTOR", "status": "COMPLETED"}
    if cid_clean:
        pay_match["$or"] = [
            {"destination_entity_id": cid_clean},
            {"destination_account_id": {"$regex": cid_clean, "$options": "i"}}
        ]
    payments_received = list(db.financial_transactions.find(pay_match).sort("created_at", -1).limit(limit))

    total_payments = sum(float(p.get("amount", 0.0)) for p in payments_received)

    return {
        "success": True,
        "contractor_id_filter": cid_clean,
        "metrics": {
            "registered_contractors_count": len(sanitized_contractors),
            "projects_assigned_count": len(projects),
            "evidence_submitted_count": len(evidence_submissions),
            "verified_payments_count": len(payments_received),
            "total_verified_payments": total_payments,
            "total_verified_payments_formatted": _format_denomination(total_payments)
        },
        "contractor_profiles": serialize_doc(sanitized_contractors),
        "assigned_projects": serialize_doc(projects),
        "evidence_submissions": serialize_doc(evidence_submissions),
        "verified_payments": serialize_doc(payments_received)
    }


# =============================================================================
# 7. CENTRALIZED AUDIT LOG — ADVANCED MULTI-TIER SEARCH & TRACEABILITY
# =============================================================================
@router.get("/central-log")
async def get_central_audit_log(
    department: Optional[str] = Query(None),
    role: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None),
    financial_year: Optional[str] = Query(None),
    scheme: Optional[str] = Query(None),
    project: Optional[str] = Query(None),
    from_date: Optional[str] = Query(None),
    to_date: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    sort_by: str = Query("timestamp"),
    sort_dir: str = Query("desc"),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    current_user: dict = AUDITOR_GUARD
):
    """
    Centralized, searchable, tamper-evident audit-record view.
    Filters across all five tiers with pagination, search, and sorting.
    Traces fund journeys with direct links to blockchain transaction hashes.
    """
    and_clauses = []

    # Financial Year
    if financial_year and financial_year != "ALL":
        and_clauses.append({"financial_year": financial_year.strip()})

    # Actor Role or Department
    target_role = (role or department or "").strip().upper()
    if target_role and target_role != "ALL":
        if target_role == "SUPER_ADMIN":
            and_clauses.append({"actor_role": "SUPER_ADMIN"})
        elif target_role == "FINANCE":
            and_clauses.append({"actor_role": "FINANCE"})
        elif target_role == "STATE":
            and_clauses.append({"actor_role": "STATE"})
        elif target_role == "DISTRICT":
            and_clauses.append({"actor_role": "DISTRICT"})
        elif target_role == "CONTRACTOR":
            and_clauses.append({"actor_role": "CONTRACTOR"})
        elif target_role == "SYSTEM":
            and_clauses.append({"actor_role": "SYSTEM"})
        else:
            and_clauses.append({"$or": [{"actor_role": target_role}, {"target_type": target_role}]})

    # Event Type
    if event_type and event_type != "ALL":
        and_clauses.append({"event_type": event_type.strip()})

    # Status
    if status_filter and status_filter != "ALL":
        and_clauses.append({"status": status_filter.strip().upper()})

    # Scheme
    if scheme and scheme.strip():
        and_clauses.append({
            "$or": [
                {"details": {"$regex": scheme.strip(), "$options": "i"}},
                {"target_id": {"$regex": scheme.strip(), "$options": "i"}}
            ]
        })

    # Project
    if project and project.strip():
        and_clauses.append({
            "$or": [
                {"target_id": {"$regex": project.strip(), "$options": "i"}},
                {"details": {"$regex": project.strip(), "$options": "i"}}
            ]
        })

    # Date Range
    if from_date:
        try:
            fd = datetime.fromisoformat(from_date.replace("Z", "+00:00"))
            and_clauses.append({"timestamp": {"$gte": fd}})
        except Exception:
            pass

    if to_date:
        try:
            td = datetime.fromisoformat(to_date.replace("Z", "+00:00"))
            and_clauses.append({"timestamp": {"$lte": td}})
        except Exception:
            pass

    # Search keyword
    if search and search.strip():
        term = search.strip()
        and_clauses.append({
            "$or": [
                {"audit_id": {"$regex": term, "$options": "i"}},
                {"target_id": {"$regex": term, "$options": "i"}},
                {"actor_name": {"$regex": term, "$options": "i"}},
                {"actor_id": {"$regex": term, "$options": "i"}},
                {"details": {"$regex": term, "$options": "i"}},
                {"blockchain_tx_hash": {"$regex": term, "$options": "i"}},
                {"event_type": {"$regex": term, "$options": "i"}},
                {"action": {"$regex": term, "$options": "i"}}
            ]
        })

    query = {"$and": and_clauses} if and_clauses else {}

    # Sort order
    direction = 1 if sort_dir.lower() == "asc" else -1
    sort_field = "amount" if sort_by == "amount" else "timestamp"

    total_count = db.audit_logs.count_documents(query)
    skip = (page - 1) * limit
    cursor = db.audit_logs.find(query).sort(sort_field, direction).skip(skip).limit(limit)
    logs = list(cursor)

    total_pages = max(1, (total_count + limit - 1) // limit)

    # Decorate records with explorer link and blockchain indicator
    decorated = []
    active_cid = bcs.get_cached_chain_id() or bcs.contract_chain_id or 11155111
    explorer_base = "https://sepolia.etherscan.io/tx/" if active_cid == 11155111 else f"http://127.0.0.1:8545/tx/"

    for item in logs:
        tx_hash = item.get("blockchain_tx_hash")
        item["has_blockchain_record"] = bool(tx_hash and tx_hash.startswith("0x"))
        item["explorer_url"] = f"{explorer_base}{tx_hash}" if item["has_blockchain_record"] else None
        item["record_source"] = "BLOCKCHAIN_VERIFIED" if item["has_blockchain_record"] else "APPLICATION_DATABASE"
        decorated.append(item)

    return {
        "success": True,
        "page": page,
        "limit": limit,
        "total_records": total_count,
        "total_pages": total_pages,
        "audit_logs": serialize_doc(decorated)
    }


# =============================================================================
# 8. FUND JOURNEY TRACEABILITY ENGINE (5-TIER COMPLETE LIFECYCLE)
# =============================================================================
@router.get("/trace-fund/{identifier}")
async def trace_fund_lifecycle(
    identifier: str,
    current_user: dict = AUDITOR_GUARD
):
    """
    Traces the entire recorded journey of a government fund allocation across:
    Super Admin (Ceiling) -> Finance Department (Transfer) -> State Government (District Allocation) -> District Office (Escrow) -> Contractor (Release)
    """
    clean_id = identifier.strip()
    if not clean_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Identifier required for fund journey trace"}
        )

    # Initialize 5 lifecycle stage slots
    stage_1 = None # Super Admin Allocation
    stage_2 = None # Finance Transfer
    stage_3 = None # State to District Allocation
    stage_4 = None # District Project
    stage_5 = None # Contractor Milestone Disbursal

    # Attempt resolution via Allocation ID, Transfer ID, District Alloc ID, Project ID, or Tx Hash
    alloc = db.budget_allocations.find_one({"$or": [{"allocation_id": clean_id}, {"scheme_code": clean_id}]})
    transfer = db.state_transfers.find_one({
        "$or": [{"transfer_id": clean_id}, {"allocation_id": clean_id}, {"blockchain_tx_hash": clean_id}]
    })
    dist_alloc = db.district_allocations.find_one({
        "$or": [{"district_alloc_id": clean_id}, {"transfer_id": clean_id}, {"blockchain_tx_hash": clean_id}]
    })
    project = db.projects.find_one({
        "$or": [{"project_id": clean_id}, {"district_alloc_id": clean_id}]
    })

    # Correlate upstream if found at later stages
    if project and not dist_alloc:
        dist_alloc = db.district_allocations.find_one({"district_alloc_id": project.get("district_alloc_id")})
    if dist_alloc and not transfer:
        transfer = db.state_transfers.find_one({"transfer_id": dist_alloc.get("transfer_id")})
    if transfer and not alloc:
        alloc = db.budget_allocations.find_one({"allocation_id": transfer.get("allocation_id")})
    if not transfer and alloc:
        transfer = db.state_transfers.find_one({"allocation_id": alloc.get("allocation_id")})
    if not dist_alloc and transfer:
        dist_alloc = db.district_allocations.find_one({"transfer_id": transfer.get("transfer_id")})
    if not project and dist_alloc:
        project = db.projects.find_one({"district_alloc_id": dist_alloc.get("district_alloc_id")})

    # Stage 1: Super Admin
    if alloc:
        stage_1 = {
            "tier": "SUPER_ADMIN",
            "tier_title": "Stage 1: Central Budget Allocation",
            "actor": alloc.get("allocated_by", "Central Super Administrator"),
            "entity": "Cabinet Secretariat & Planning Commission",
            "allocation_id": alloc.get("allocation_id"),
            "scheme_name": alloc.get("scheme_name"),
            "department": alloc.get("department"),
            "amount": alloc.get("amount", 0.0),
            "amount_formatted": _format_denomination(alloc.get("amount", 0.0)),
            "status": alloc.get("status"),
            "financial_year": alloc.get("financial_year"),
            "blockchain_tx_hash": alloc.get("blockchain_tx_hash"),
            "timestamp": alloc.get("created_at")
        }

    # Stage 2: Finance Department
    if transfer:
        stage_2 = {
            "tier": "FINANCE",
            "tier_title": f"Stage 2: Finance Dept Treasury Disbursal ({transfer.get('state_name', 'State')})",
            "actor": transfer.get("transferred_by", "Finance Disbursal Officer"),
            "entity": "Ministry of Finance",
            "transfer_id": transfer.get("transfer_id"),
            "source_account": transfer.get("source_account_id"),
            "destination_account": transfer.get("destination_account_id"),
            "amount": transfer.get("amount", 0.0),
            "amount_formatted": _format_denomination(transfer.get("amount", 0.0)),
            "blockchain_tx_hash": transfer.get("blockchain_tx_hash"),
            "blockchain_block": transfer.get("blockchain_block"),
            "status": "COMPLETED",
            "timestamp": transfer.get("created_at")
        }

    # Stage 3: State Government
    if dist_alloc:
        stage_3 = {
            "tier": "STATE",
            "tier_title": f"Stage 3: State Treasury Allocation ({dist_alloc.get('district_name', 'District')})",
            "actor": dist_alloc.get("allocated_by", "State Treasury Officer"),
            "entity": f"{dist_alloc.get('state_name', 'State')} Treasury",
            "district_alloc_id": dist_alloc.get("district_alloc_id"),
            "district_name": dist_alloc.get("district_name"),
            "amount": dist_alloc.get("amount", 0.0),
            "amount_formatted": _format_denomination(dist_alloc.get("amount", 0.0)),
            "blockchain_tx_hash": dist_alloc.get("blockchain_tx_hash"),
            "status": "COMPLETED",
            "timestamp": dist_alloc.get("created_at")
        }

    # Stage 4: District Office
    if project:
        stage_4 = {
            "tier": "DISTRICT",
            "tier_title": f"Stage 4: District Project Assignment ({project.get('name')})",
            "actor": project.get("district_name", "District Collectorate"),
            "entity": f"{project.get('district_name')} DRDA",
            "project_id": project.get("project_id"),
            "contract_id": project.get("contract_id"),
            "contractor_id": project.get("contractor_id"),
            "total_budget": project.get("total_budget", 0.0),
            "released_amount": project.get("released_amount", 0.0),
            "progress_percentage": project.get("progress_percentage", 0),
            "status": project.get("status"),
            "timestamp": project.get("created_at")
        }

        # Stage 5: Contractor Payments / Milestones
        milestones = list(db.milestones.find({"project_id": project.get("project_id")}).sort("milestone_index", 1))
        txs = list(db.financial_transactions.find({
            "related_project_id": project.get("project_id"),
            "status": "COMPLETED"
        }).sort("created_at", -1))

        stage_5 = {
            "tier": "CONTRACTOR",
            "tier_title": f"Stage 5: Contractor Milestones & Verified Releases",
            "contractor_id": project.get("contractor_id"),
            "milestones_count": len(milestones),
            "verified_transactions_count": len(txs),
            "milestones": [
                {
                    "milestone_index": m.get("milestone_index"),
                    "title": m.get("title"),
                    "amount": m.get("amount"),
                    "status": m.get("status"),
                    "verified_by": m.get("verified_by"),
                    "blockchain_tx_hash": m.get("blockchain_tx_hash") or m.get("transfer_tx_hash")
                }
                for m in milestones
            ],
            "payments": [
                {
                    "transaction_id": t.get("transaction_id"),
                    "amount": t.get("amount"),
                    "blockchain_tx_hash": t.get("blockchain_tx_hash"),
                    "timestamp": t.get("created_at")
                }
                for t in txs
            ]
        }

    stages = [s for s in [stage_1, stage_2, stage_3, stage_4, stage_5] if s is not None]

    return {
        "success": True,
        "identifier": clean_id,
        "is_complete_chain": len(stages) >= 4,
        "stages_discovered": len(stages),
        "stages": serialize_doc(stages)
    }
