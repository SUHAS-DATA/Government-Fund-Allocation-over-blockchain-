import os
import sys
import time
import uuid
import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from fastapi.testclient import TestClient

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import app
from database import (
    db,
    get_active_financial_year,
    invalidate_active_financial_year_cache,
    _active_fy_cache
)
import blockchain_service as bcs
from reconciliation_service import reconcile_financial_records
from auth_middleware import generate_token

client = TestClient(app)

ADMIN_TOKEN = generate_token(
    user_id="test_super_admin",
    email="admin@govtfund.test",
    role="SUPER_ADMIN",
    name="Test Super Admin"
)
FINANCE_TOKEN = generate_token(
    user_id="test_finance",
    email="finance@govtfund.test",
    role="FINANCE",
    name="Test Finance"
)


def test_blockchain_metadata_caching():
    """Verify that Web3 metadata caching stores and invalidates correctly."""
    bcs.clear_blockchain_cache()

    # Test chain ID cache using PropertyMock for web3 eth property
    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(type(bcs.w3.eth), "chain_id", new_callable=PropertyMock, return_value=11155111):
        chain_id1 = bcs.get_cached_chain_id(force_refresh=True)
        assert chain_id1 == 11155111

        # Underlying property changes: cached value must persist without force_refresh
        with patch.object(type(bcs.w3.eth), "chain_id", new_callable=PropertyMock, return_value=99999):
            chain_id2 = bcs.get_cached_chain_id(force_refresh=False)
            assert chain_id2 == 11155111  # Still cached

    # Clearing cache forces fresh fetch
    bcs.clear_blockchain_cache()
    with patch.object(bcs, "is_blockchain_enabled", return_value=True), \
         patch.object(type(bcs.w3.eth), "chain_id", new_callable=PropertyMock, return_value=99999):
        chain_id3 = bcs.get_cached_chain_id(force_refresh=True)
        assert chain_id3 == 99999

    # Clean up
    bcs.clear_blockchain_cache()


def test_contract_deployment_caching():
    """Verify contract bytecode caching survives repeat requests."""
    bcs.clear_blockchain_cache()

    # Mock get_code returning non-empty bytecode
    with patch.object(bcs.w3.eth, "get_code", return_value=b"\x60\x80\x60\x40"):
        assert bcs.is_contract_deployed("0x103cdC78636491B20deadC5574755Bbd64B119c6", force_refresh=True) is True

    # When get_code raises an exception, the cached True status survives
    with patch.object(bcs.w3.eth, "get_code", side_effect=Exception("RPC down")):
        assert bcs.is_contract_deployed("0x103cdC78636491B20deadC5574755Bbd64B119c6", force_refresh=False) is True

    bcs.clear_blockchain_cache()


def test_active_financial_year_caching_and_invalidation():
    """Verify get_active_financial_year caches string result and is invalidated on demand."""
    invalidate_active_financial_year_cache()

    # 1. Fetch initial active year
    real_fy = get_active_financial_year(force_refresh=True)
    assert real_fy is not None
    assert _active_fy_cache["year"] == real_fy
    assert _active_fy_cache["expires_at"] > time.time()

    # 2. Modify cache to verify read hits in-memory cache without DB query
    _active_fy_cache["year"] = "TEST-CACHED-YEAR"
    cached = get_active_financial_year(force_refresh=False)
    assert cached == "TEST-CACHED-YEAR"

    # 3. Invalidate cache: forces fresh query from MongoDB
    invalidate_active_financial_year_cache()
    assert _active_fy_cache["year"] is None
    fresh = get_active_financial_year(force_refresh=False)
    assert fresh == real_fy
    assert _active_fy_cache["year"] == real_fy


def test_admin_dashboard_parallel_query_correctness():
    """Verify /api/admin/dashboard returns valid complete schema with parallel queries."""
    res = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {ADMIN_TOKEN}"})
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "metrics" in data
    metrics = data["metrics"]
    assert "allocated_to_schemes" in metrics
    assert "sanctioned_union_ceiling" in metrics
    assert "active_projects_count" in metrics
    assert "financial_years" in data


def test_public_stats_parallel_query_correctness():
    """Verify /api/public/stats returns valid aggregated statistics."""
    res = client.get("/api/public/stats")
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert "stats" in data
    stats = data["stats"]
    assert "total_allocated_budget" in stats
    assert "total_disbursed_funds" in stats
    assert "total_projects_count" in stats
    assert "states_supported" in stats


def test_reconciliation_parallel_rpc_bounded_safety():
    """Verify bounded parallel RPC checks in reconciliation complete cleanly."""
    test_alloc = {
        "allocation_id": "ALLOC-TEST-RECON-PERF",
        "financial_year": "FY-RECON-PERF-ISOLATED",
        "amount": 1000000,
        "disbursed_amount": 0,
        "blockchain_tx_hash": "0x" + "a" * 64,
        "reconciliation_status": "PENDING"
    }
    db.budget_allocations.update_one(
        {"allocation_id": test_alloc["allocation_id"]},
        {"$set": test_alloc},
        upsert=True
    )

    try:
        mock_receipt = {
            "status": 1,
            "blockNumber": 12345,
            "transactionHash": "0x" + "a" * 64
        }
        mock_onchain_alloc = {
            "exists": True,
            "total_sanctioned": 1000000.0,
            "disbursed_to_states": 0.0,
            "financial_year": "FY-RECON-PERF-ISOLATED"
        }
        with patch.object(bcs, "is_blockchain_connected", return_value=True), \
             patch.object(bcs.w3.eth, "get_transaction_receipt", return_value=mock_receipt), \
             patch.object(bcs, "is_contract_deployed", return_value=True), \
             patch.object(bcs, "get_onchain_budget_allocation", return_value=mock_onchain_alloc):
            result = reconcile_financial_records(financial_year="FY-RECON-PERF-ISOLATED")
            assert "total_records_checked" in result
            assert "reconciled_items" in result
            assert result["total_records_checked"] == 1
            assert result["matched_count"] == 1
    finally:
        db.budget_allocations.delete_one({"allocation_id": "ALLOC-TEST-RECON-PERF"})
