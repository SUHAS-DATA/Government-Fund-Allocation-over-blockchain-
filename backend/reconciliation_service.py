from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor
from database import db, get_active_financial_year, serialize_doc
import blockchain_service as bcs
from audit_service import log_audit_event

def reconcile_financial_records(
    financial_year: Optional[str] = None,
    current_user: Optional[Dict[str, Any]] = None,
    limit: int = 100
) -> Dict[str, Any]:
    """
    Independently queries on-chain smart contract state and transaction receipts,
    reconciling them against MongoDB financial records.
    Identifies matched records, amount discrepancies, unconfirmed transfers, and reverted transactions.
    """
    now = datetime.now(timezone.utc)
    fy = financial_year or get_active_financial_year()

    report = {
        "financial_year": fy,
        "run_at": now.isoformat(),
        "reconciled_by": current_user.get("name") if current_user else "System Automated Service",
        "blockchain_connected": bcs.is_blockchain_connected(),
        "contract_address": bcs.contract_address,
        "total_records_checked": 0,
        "matched_count": 0,
        "discrepancy_count": 0,
        "unverified_count": 0,
        "discrepancies": [],
        "reconciled_items": []
    }

    if not report["blockchain_connected"]:
        report["status"] = "ERROR_RPC_UNREACHABLE"
        report["message"] = "Cannot reconcile with blockchain: RPC node is disconnected or unreachable."
        return report

    def _fetch_alloc_onchain(alloc_id):
        try:
            return alloc_id, bcs.get_onchain_budget_allocation(alloc_id)
        except Exception:
            return alloc_id, None

    def _fetch_trf_onchain(pair):
        trf_id, tx_hash = pair
        onchain = None
        v_res = None
        try:
            onchain = bcs.get_onchain_state_transfer(trf_id)
        except Exception:
            pass
        if tx_hash:
            try:
                v_res = bcs.verify_transaction_onchain(tx_hash, expected_contract=bcs.contract_address)
            except Exception:
                pass
        return trf_id, onchain, v_res

    def _fetch_dist_alloc_onchain(pair):
        dist_id, tx_hash = pair
        onchain = None
        v_res = None
        try:
            onchain = bcs.get_onchain_district_allocation(dist_id)
        except Exception:
            pass
        if tx_hash:
            try:
                v_res = bcs.verify_transaction_onchain(tx_hash, expected_contract=bcs.contract_address)
            except Exception:
                pass
        return dist_id, onchain, v_res

    # 1. Reconcile Central Budget Allocations
    alloc_query = {"financial_year": fy} if fy else {}
    allocations = list(db.budget_allocations.find(alloc_query).sort([("_id", -1)]).limit(limit))

    alloc_ids = [a.get("allocation_id") for a in allocations if a.get("allocation_id")]
    onchain_alloc_map = {}
    if alloc_ids:
        with ThreadPoolExecutor(max_workers=min(5, len(alloc_ids))) as executor:
            onchain_alloc_map = dict(executor.map(_fetch_alloc_onchain, alloc_ids))

    for alloc in allocations:
        report["total_records_checked"] += 1
        alloc_id = alloc.get("allocation_id")
        mongo_amount = float(alloc.get("amount", 0.0))
        mongo_disbursed = float(alloc.get("disbursed_amount", 0.0))

        onchain = onchain_alloc_map.get(alloc_id)
        item_status = "MATCHED"
        issue = None

        if not onchain or not onchain.get("exists"):
            item_status = "RECORD_NOT_ON_CHAIN"
            issue = f"Allocation '{alloc_id}' does not exist in smart contract storage."
        else:
            onchain_sanctioned = float(onchain.get("total_sanctioned", 0.0))
            onchain_disbursed = float(onchain.get("disbursed_to_states", 0.0))
            if abs(onchain_sanctioned - mongo_amount) > 0.01:
                item_status = "AMOUNT_MISMATCH"
                issue = f"Sanctioned amount mismatch: MongoDB={mongo_amount}, OnChain={onchain_sanctioned}."
            elif abs(onchain_disbursed - mongo_disbursed) > 0.01:
                item_status = "DISBURSED_AMOUNT_MISMATCH"
                issue = f"Disbursed amount mismatch: MongoDB={mongo_disbursed}, OnChain={onchain_disbursed}."

        # Update DB document
        db.budget_allocations.update_one(
            {"allocation_id": alloc_id},
            {"$set": {
                "reconciliation_status": item_status,
                "last_reconciled_at": now,
                "reconciliation_issue": issue
            }}
        )

        record_entry = {
            "type": "BUDGET_ALLOCATION",
            "id": alloc_id,
            "status": item_status,
            "mongo_amount": mongo_amount,
            "onchain_amount": onchain.get("total_sanctioned") if onchain else None,
            "issue": issue
        }

        if item_status == "MATCHED":
            report["matched_count"] += 1
        else:
            report["discrepancy_count"] += 1
            report["discrepancies"].append(record_entry)
        report["reconciled_items"].append(record_entry)

    # 2. Reconcile State Transfers
    st_query = {"financial_year": fy} if fy else {}
    transfers = list(db.state_transfers.find(st_query).sort([("_id", -1)]).limit(limit))

    trf_pairs = [(t.get("transfer_id"), t.get("blockchain_tx_hash")) for t in transfers if t.get("transfer_id")]
    onchain_trf_map = {}
    if trf_pairs:
        with ThreadPoolExecutor(max_workers=min(5, len(trf_pairs))) as executor:
            trf_results = list(executor.map(_fetch_trf_onchain, trf_pairs))
            onchain_trf_map = {r[0]: (r[1], r[2]) for r in trf_results}

    for trf in transfers:
        report["total_records_checked"] += 1
        trf_id = trf.get("transfer_id")
        mongo_amount = float(trf.get("amount", 0.0))
        tx_hash = trf.get("blockchain_tx_hash")

        onchain, v_res = onchain_trf_map.get(trf_id, (None, None))
        item_status = "MATCHED"
        issue = None

        if not onchain or not onchain.get("exists"):
            item_status = "RECORD_NOT_ON_CHAIN"
            issue = f"State transfer '{trf_id}' not found in smart contract state."
        else:
            onchain_amount = float(onchain.get("amount", 0.0))
            if abs(onchain_amount - mongo_amount) > 0.01:
                item_status = "AMOUNT_MISMATCH"
                issue = f"Transfer amount mismatch: MongoDB={mongo_amount}, OnChain={onchain_amount}."

        # Also verify the underlying transaction receipt if hash present
        if tx_hash:
            if not v_res or not v_res.get("verified"):
                item_status = "TRANSACTION_UNVERIFIED"
                msg = v_res.get("message") if v_res else "Verification lookup failed"
                issue = f"On-chain receipt unverified: {msg}"

        db.state_transfers.update_one(
            {"transfer_id": trf_id},
            {"$set": {
                "reconciliation_status": item_status,
                "last_reconciled_at": now,
                "reconciliation_issue": issue
            }}
        )

        record_entry = {
            "type": "STATE_TRANSFER",
            "id": trf_id,
            "tx_hash": tx_hash,
            "status": item_status,
            "mongo_amount": mongo_amount,
            "onchain_amount": onchain.get("amount") if onchain else None,
            "issue": issue
        }

        if item_status == "MATCHED":
            report["matched_count"] += 1
        else:
            report["discrepancy_count"] += 1
            report["discrepancies"].append(record_entry)
        report["reconciled_items"].append(record_entry)

    # 3. Reconcile District Allocations
    dist_allocs = list(db.district_allocations.find(st_query).sort([("_id", -1)]).limit(limit))
    dist_pairs = [(d.get("district_alloc_id"), d.get("blockchain_tx_hash")) for d in dist_allocs if d.get("district_alloc_id")]
    onchain_dist_map = {}
    if dist_pairs:
        with ThreadPoolExecutor(max_workers=min(5, len(dist_pairs))) as executor:
            dist_results = list(executor.map(_fetch_dist_alloc_onchain, dist_pairs))
            onchain_dist_map = {r[0]: (r[1], r[2]) for r in dist_results}

    for d_alloc in dist_allocs:
        report["total_records_checked"] += 1
        dist_id = d_alloc.get("district_alloc_id")
        mongo_amount = float(d_alloc.get("amount", 0.0))
        tx_hash = d_alloc.get("blockchain_tx_hash")

        onchain, v_res = onchain_dist_map.get(dist_id, (None, None))
        item_status = "MATCHED"
        issue = None

        if not onchain or not onchain.get("exists"):
            item_status = "RECORD_NOT_ON_CHAIN"
            issue = f"District allocation '{dist_id}' not found in smart contract state."
        else:
            onchain_amount = float(onchain.get("amount", 0.0))
            if abs(onchain_amount - mongo_amount) > 0.01:
                item_status = "AMOUNT_MISMATCH"
                issue = f"District allocation amount mismatch: MongoDB={mongo_amount}, OnChain={onchain_amount}."

        if tx_hash:
            if not v_res or not v_res.get("verified"):
                item_status = "TRANSACTION_UNVERIFIED"
                msg = v_res.get("message") if v_res else "Verification lookup failed"
                issue = f"On-chain receipt unverified: {msg}"

        db.district_allocations.update_one(
            {"district_alloc_id": dist_id},
            {"$set": {
                "reconciliation_status": item_status,
                "last_reconciled_at": now,
                "reconciliation_issue": issue
            }}
        )

        record_entry = {
            "type": "DISTRICT_ALLOCATION",
            "id": dist_id,
            "tx_hash": tx_hash,
            "status": item_status,
            "mongo_amount": mongo_amount,
            "onchain_amount": onchain.get("amount") if onchain else None,
            "issue": issue
        }

        if item_status == "MATCHED":
            report["matched_count"] += 1
        else:
            report["discrepancy_count"] += 1
            report["discrepancies"].append(record_entry)
        report["reconciled_items"].append(record_entry)

    report["status"] = "SUCCESS" if report["discrepancy_count"] == 0 else "DISCREPANCIES_DETECTED"

    # Audit log reconciliation run
    log_audit_event(
        event_type="FINANCIAL_RECONCILIATION_RUN",
        actor=current_user,
        target_id=f"RECON-{now.strftime('%Y%m%d%H%M%S')}",
        target_type="RECONCILIATION_REPORT",
        action="AUDIT_RECONCILE",
        status=report["status"],
        details=f"Checked {report['total_records_checked']} records. Matched: {report['matched_count']}, Discrepancies: {report['discrepancy_count']}.",
        financial_year=fy,
        extra_data={
            "matched_count": report["matched_count"],
            "discrepancy_count": report["discrepancy_count"],
            "total_records_checked": report["total_records_checked"]
        }
    )

    return report
