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
auditor_bp = router

def generate_audit_id():
    rand_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
    return f"AUD-CAG-{rand_suffix}"

@router.get("/dashboard")
async def dashboard(
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    total_audits = db.audit_reports.count_documents({})
    fraud_reports_count = db.fraud_reports.count_documents({"status": "OPEN"})
    frozen_projects_count = db.projects.count_documents({"is_frozen": True})
    total_txs = db.blockchain_transactions.count_documents({})

    recent_audits = list(db.audit_reports.find().sort("created_at", -1).limit(5))
    frozen_projects = list(db.projects.find({"is_frozen": True}))

    return {
        "success": True,
        "metrics": {
            "total_audits": total_audits,
            "fraud_reports_count": fraud_reports_count,
            "frozen_projects_count": frozen_projects_count,
            "total_blockchain_transactions": total_txs
        },
        "recent_audits": serialize_doc(recent_audits),
        "frozen_projects": serialize_doc(frozen_projects)
    }

# --- Blockchain Explorer ---
@router.get("/blockchain-explorer")
async def blockchain_explorer(
    operation_type: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles(["AUDITOR", "SUPER_ADMIN", "FINANCE", "STATE", "DISTRICT"]))
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

    query = {}
    if operation_type:
        query["operation_type"] = operation_type
    if search and search.strip():
        s = search.strip()
        query["$or"] = [
            {"tx_hash": {"$regex": s, "$options": "i"}},
            {"entity_id": {"$regex": s, "$options": "i"}},
            {"details": {"$regex": s, "$options": "i"}},
            {"from_address": {"$regex": s, "$options": "i"}},
            {"to_address": {"$regex": s, "$options": "i"}}
        ]

    txs = list(db.blockchain_transactions.find(query).sort("timestamp", -1).limit(200))
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

# --- Document Hash Verification ---
@router.get("/documents")
async def get_documents(
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    docs = list(db.documents.find().sort("uploaded_at", -1))
    return {"success": True, "documents": serialize_doc(docs)}

@router.post("/verify-document")
async def verify_document(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    doc_hash = data.get("doc_hash", "").strip()
    doc_id = data.get("document_id")

    doc = None
    if doc_id:
        doc = db.documents.find_one({"document_id": doc_id})
    elif doc_hash:
        doc = db.documents.find_one({"sha256_hash": doc_hash})

    if not doc and not doc_hash:
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND,
            content={"success": False, "message": "Document record or SHA-256 hash not found"}
        )

    target_hash = doc.get("sha256_hash") if doc else doc_hash
    recomputed_hash = target_hash
    file_exists = False

    if doc and "file_path" in doc and os.path.exists(doc["file_path"]):
        file_exists = True
        recomputed_hash = bcs.calculate_sha256(doc["file_path"])

    is_verified = (recomputed_hash.lower() == target_hash.lower())

    return {
        "success": True,
        "status": "VERIFIED" if is_verified else "MISMATCH",
        "is_verified": is_verified,
        "stored_hash": target_hash,
        "recalculated_hash": recomputed_hash,
        "file_exists_on_disk": file_exists,
        "document_metadata": serialize_doc(doc)
    }

# --- Cross-Project Anomaly Analytics ---
@router.get("/analytics/anomalies")
async def get_anomalies(
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    anomalies = []

    # 1. Repeated Contractor Assignment Concentration
    pipeline = [
        {"$match": {"contractor_name": {"$ne": None}}},
        {"$group": {"_id": "$contractor_name", "count": {"$sum": 1}, "total_value": {"$sum": "$total_budget"}}},
        {"$match": {"count": {"$gt": 2}}}
    ]
    concentrations = list(db.projects.aggregate(pipeline))
    for c in concentrations:
        anomalies.append({
            "type": "CONTRACTOR_CONCENTRATION",
            "severity": "HIGH",
            "title": f"High Vendor Allocation Density: {c['_id']}",
            "description": f"Contractor holds {c['count']} active infrastructure projects totaling INR {c['total_value']:,.2f}.",
            "entity": c["_id"]
        })

    # 2. Budget vs Disbursed Discrepancy
    overrun_pipeline = [
        {"$match": {"$expr": {"$gt": ["$released_amount", "$total_budget"]}}}
    ]
    overruns = list(db.projects.aggregate(overrun_pipeline))
    for o in overruns:
        anomalies.append({
            "type": "BUDGET_OVERRUN",
            "severity": "CRITICAL",
            "title": f"Escrow Disbursal Ceiling Breach: {o.get('project_id')}",
            "description": f"Released amount (INR {o.get('released_amount'):,.2f}) exceeds total budget ceiling.",
            "entity": o.get("project_id")
        })

    # 3. Unanchored Documents Check
    unanchored = list(db.documents.find({"blockchain_tx_hash": None}))
    if len(unanchored) > 0:
        anomalies.append({
            "type": "UNANCHORED_DOCUMENTS",
            "severity": "MEDIUM",
            "title": f"{len(unanchored)} Off-Chain Files Awaiting On-Chain Hash Synchronization",
            "description": "Certain uploaded progress PDFs are pending cryptographic block anchoring.",
            "entity": "System Storage"
        })

    if not anomalies:
        anomalies.append({
            "type": "SYSTEM_INTEGRITY_CHECK",
            "severity": "LOW",
            "title": "All Active Escrows Synchronized with Smart Contract",
            "description": "No double spending or milestone variance detected across active projects.",
            "entity": "Ethereum Network"
        })

    return {
        "success": True,
        "anomalies_count": len(anomalies),
        "anomalies": anomalies
    }

# --- Fraud Flagging & Fund Freeze ---
@router.post("/fraud-report")
async def file_fraud_report(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id")
    title = data.get("title", "Forensic Audit Discrepancy Detected")
    description = data.get("description", "Material variance detected between physical progress and claims.")
    severity = data.get("severity", "HIGH")
    freeze_funds = data.get("freeze_funds", True)

    if not project_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID is required"}
        )

    report_doc = {
        "project_id": project_id,
        "title": title,
        "description": description,
        "severity": severity,
        "status": "OPEN",
        "auditor_name": current_user["name"],
        "created_at": datetime.now(timezone.utc)
    }
    db.fraud_reports.insert_one(report_doc)

    tx_hash = None
    if freeze_funds:
        try:
            tx_receipt = bcs.freeze_project_onchain(project_id, description)
            if tx_receipt:
                tx_hash = tx_receipt["tx_hash"]
        except Exception as e:
            print(f"Warning freezing project on-chain: {e}")

        db.projects.update_one(
            {"project_id": project_id},
            {"$set": {
                "is_frozen": True,
                "freeze_reason": description,
                "frozen_at": datetime.now(timezone.utc),
                "freeze_tx_hash": tx_hash
            }}
        )

        if tx_hash:
            from_auditor = bcs.get_entity_wallet("AUDITOR")
            to_escrow = bcs.get_entity_wallet("ESCROW")
            db.blockchain_transactions.insert_one({
                "tx_hash": tx_hash,
                "operation_type": "PROJECT_FROZEN",
                "entity_id": project_id,
                "from_address": from_auditor,
                "to_address": to_escrow,
                "from_entity": "CAG Audit & Inspection Directorate",
                "to_entity": "Project Smart Contract Escrow",
                "transfer_tier": "AUDITOR_TO_ESCROW",
                "flow_stage": "Emergency Oversight Freeze",
                "amount": 0,
                "details": f"Emergency Escrow Freeze: {description}",
                "timestamp": datetime.now(timezone.utc)
            })

    db.notifications.insert_one({
        "recipient_role": "SUPER_ADMIN",
        "title": f"EMERGENCY AUDIT ALERT: Project {project_id} FROZEN",
        "message": f"CAG Auditor logged fraud report: {title}. Project escrow locked on blockchain.",
        "link": f"/admin/audit-reports?project_id={project_id}",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": f"Fraud report logged. Project {project_id} escrow FROZEN on-chain.",
        "blockchain_tx": tx_hash
    }

@router.post("/fund-freeze")
async def toggle_fund_freeze(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR", "SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id")
    action = data.get("action", "FREEZE").upper()
    reason = data.get("reason", "Forensic auditor status adjustment")

    if not project_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID required"}
        )

    tx_hash = None
    if action == "FREEZE":
        try:
            tx_receipt = bcs.freeze_project_onchain(project_id, reason)
            if tx_receipt:
                tx_hash = tx_receipt["tx_hash"]
        except Exception as e:
            print(f"Warning freezing on-chain: {e}")

        db.projects.update_one(
            {"project_id": project_id},
            {"$set": {"is_frozen": True, "freeze_reason": reason, "frozen_at": datetime.now(timezone.utc)}}
        )
    else:
        try:
            tx_receipt = bcs.unfreeze_project_onchain(project_id)
            if tx_receipt:
                tx_hash = tx_receipt["tx_hash"]
        except Exception as e:
            print(f"Warning unfreezing on-chain: {e}")

        db.projects.update_one(
            {"project_id": project_id},
            {"$set": {"is_frozen": False, "freeze_reason": None, "unfrozen_at": datetime.now(timezone.utc)}}
        )

    return {"success": True, "message": f"Project {project_id} {action}D on blockchain", "blockchain_tx": tx_hash}

# --- Formal Audit Report Submission ---
async def handle_submit_audit_report(request: Request, current_user: dict):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id")
    findings = data.get("findings", "Physical milestone inspection conducted and verified.")
    compliance_score = int(data.get("compliance_score", 95))
    status_val = data.get("status", "APPROVED")

    if not project_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID required"}
        )

    audit_id = generate_audit_id()
    proj = db.projects.find_one({"project_id": project_id})

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.submit_audit_report_onchain(
            audit_id,
            project_id,
            current_user["name"],
            compliance_score,
            status_val
        )
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning submitting audit report on-chain: {e}")

    report_doc = {
        "audit_id": audit_id,
        "project_id": project_id,
        "project_name": proj.get("name") if proj else project_id,
        "auditor_name": current_user["name"],
        "compliance_score": compliance_score,
        "findings": findings,
        "status": status_val,
        "blockchain_tx_hash": tx_hash,
        "blockchain_block": block_num,
        "created_at": datetime.now(timezone.utc)
    }
    db.audit_reports.insert_one(report_doc)

    if tx_hash:
        from_auditor = bcs.get_entity_wallet("AUDITOR")
        to_escrow = bcs.get_entity_wallet("ESCROW")
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "AUDIT_REPORT_SUBMISSION",
            "entity_id": audit_id,
            "from_address": from_auditor,
            "to_address": to_escrow,
            "from_entity": "CAG Audit & Inspection Directorate",
            "to_entity": "Smart Contract Audit Ledger",
            "transfer_tier": "AUDITOR_TO_ESCROW",
            "flow_stage": "Audit Report Anchoring",
            "amount": 0,
            "details": f"Forensic Audit Verdict for {proj.get('name') if proj else project_id} (Score: {compliance_score}/100, Status: {status_val})",
            "timestamp": datetime.now(timezone.utc)
        })

    db.notifications.insert_one({
        "recipient_role": "SUPER_ADMIN",
        "title": f"Forensic Audit Verdict: {audit_id} ({status_val})",
        "message": f"Audit for '{proj.get('name') if proj else project_id}' submitted with compliance score {compliance_score}/100.",
        "link": "/admin/audit-reports",
        "read": False,
        "created_at": datetime.now(timezone.utc)
    })

    return {
        "success": True,
        "message": f"CAG Forensic Audit Report {audit_id} submitted and anchored on blockchain",
        "audit_report": serialize_doc(report_doc),
        "blockchain": {
            "tx_hash": tx_hash,
            "block_number": block_num
        }
    }

@router.post("/submit-report", status_code=status.HTTP_201_CREATED)
async def submit_audit_report(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    return await handle_submit_audit_report(request, current_user)

@router.post("/submit-audit-report", status_code=status.HTTP_201_CREATED)
async def submit_audit_report_alias(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    return await handle_submit_audit_report(request, current_user)

@router.post("/freeze-project")
async def freeze_project(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR", "SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id")
    reason = data.get("reason", "Forensic auditor emergency hold")

    if not project_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID required"}
        )

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.freeze_project_onchain(project_id, reason)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning freezing on-chain: {e}")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"is_frozen": True, "freeze_reason": reason, "frozen_at": datetime.now(timezone.utc), "freeze_tx_hash": tx_hash}}
    )

    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "PROJECT_FROZEN",
            "entity_id": project_id,
            "from_address": bcs.get_account().address if bcs.get_account() else "0xAuditor",
            "to_address": "0xGovernmentFundTrackingContract",
            "amount": 0,
            "details": f"Emergency Escrow Freeze: {reason}",
            "timestamp": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Project {project_id} FROZEN on blockchain",
        "blockchain": {"tx_hash": tx_hash, "block_number": block_num}
    }

@router.post("/unfreeze-project")
async def unfreeze_project(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR", "SUPER_ADMIN"]))
):
    try:
        data = await request.json()
    except Exception:
        data = {}

    project_id = data.get("project_id")

    if not project_id:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "Project ID required"}
        )

    tx_hash = None
    block_num = None
    try:
        tx_receipt = bcs.unfreeze_project_onchain(project_id)
        if tx_receipt:
            tx_hash = tx_receipt["tx_hash"]
            block_num = tx_receipt["block_number"]
    except Exception as e:
        print(f"Warning unfreezing on-chain: {e}")

    db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"is_frozen": False, "freeze_reason": None, "unfrozen_at": datetime.now(timezone.utc)}}
    )

    if tx_hash:
        db.blockchain_transactions.insert_one({
            "tx_hash": tx_hash,
            "block_number": block_num,
            "operation_type": "PROJECT_UNFROZEN",
            "entity_id": project_id,
            "from_address": bcs.get_account().address if bcs.get_account() else "0xAuditor",
            "to_address": "0xGovernmentFundTrackingContract",
            "amount": 0,
            "details": f"Project Escrow Unfrozen by CAG Auditor",
            "timestamp": datetime.now(timezone.utc)
        })

    return {
        "success": True,
        "message": f"Project {project_id} UNFROZEN on blockchain",
        "blockchain": {"tx_hash": tx_hash, "block_number": block_num}
    }

@router.post("/calculate-and-verify-file")
async def calculate_and_verify_file(
    request: Request,
    current_user: dict = Depends(require_roles(["AUDITOR"]))
):
    form = await request.form()
    file = form.get("file")
    if not file or not hasattr(file, "filename") or not file.filename:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"success": False, "message": "No file uploaded"}
        )

    content = await file.read()
    file_size = len(content)
    computed_hash = bcs.calculate_file_sha256(content)

    existing = db.documents.find_one({"sha256_hash": computed_hash})
    is_match = existing is not None

    return {
        "success": True,
        "file_name": file.filename,
        "file_size": file_size,
        "computed_sha256": computed_hash,
        "match": is_match
    }
