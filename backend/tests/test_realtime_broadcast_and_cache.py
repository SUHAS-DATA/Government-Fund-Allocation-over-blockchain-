import os
import sys
import pytest
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from cache_service import SafeDataCache, public_cache
from realtime_manager import realtime_manager


def test_safe_data_cache_basic_and_invalidation():
    cache = SafeDataCache(default_ttl_seconds=60)
    
    # Store
    cache.set("public_stats:2026-27", {"total_budget": 500000000})
    cache.set("public_schemes:2026-27", [{"scheme_id": "SCH-1"}])
    cache.set("other_key", "value")

    assert cache.get("public_stats:2026-27") == {"total_budget": 500000000}
    assert cache.get("public_schemes:2026-27") == [{"scheme_id": "SCH-1"}]
    assert cache.get("other_key") == "value"

    # Invalidate by prefix
    invalidated_count = cache.invalidate("public_")
    assert invalidated_count == 2
    assert cache.get("public_stats:2026-27") is None
    assert cache.get("public_schemes:2026-27") is None
    assert cache.get("other_key") == "value"

    # Full invalidate
    cache.invalidate()
    assert cache.get("other_key") is None


def test_safe_data_cache_expiration():
    cache = SafeDataCache(default_ttl_seconds=1)
    cache.set("expiring_key", {"data": 123}, ttl_seconds=0.1)
    
    assert cache.get("expiring_key") == {"data": 123}
    time.sleep(0.15)
    assert cache.get("expiring_key") is None


def test_realtime_manager_broadcast_invalidates_public_cache():
    # Prime public cache
    public_cache.set("public_stats:2026-27", {"test": True})
    assert public_cache.get("public_stats:2026-27") is not None

    # Trigger a broadcast
    realtime_manager.trigger_broadcast("PROJECT_CREATED", {"project_id": "PRJ-TEST-001"})

    # Public cache must be automatically invalidated
    assert public_cache.get("public_stats:2026-27") is None


def test_realtime_broadcast_payload_and_counter():
    initial_counter = realtime_manager.mutation_counter
    
    # Required 9 scenarios broadcast types
    scenario_events = [
        ("FINANCIAL_YEAR_UPDATED", {"year": "2026-27"}),
        ("SCHEME_CREATED", {"scheme_code": "PMGSY"}),
        ("BUDGET_ALLOCATED", {"amount": 100000000}),
        ("DISTRICT_ALLOCATED", {"district": "Belagavi"}),
        ("PROJECT_ASSIGNED", {"contractor_id": "CON-101"}),
        ("PROJECT_ACCEPTED", {"project_id": "PRJ-101"}),
        ("WORK_EVIDENCE_SUBMITTED", {"milestone_index": 1}),
        ("MILESTONE_VERIFIED", {"milestone_index": 1}),
        ("FUNDS_RECEIVED", {"project_id": "PRJ-101", "phase": 1})
    ]

    for event_type, payload in scenario_events:
        realtime_manager.trigger_broadcast(event_type, payload)

    assert realtime_manager.mutation_counter == initial_counter + len(scenario_events)
    status = realtime_manager.get_status()
    assert status["mutation_counter"] == initial_counter + len(scenario_events)
    assert status["last_mutation_time"] > 0
