"""
In-memory cache service with explicit invalidation triggers and safe TTLs.
Preserves role isolation by caching only public, non-sensitive, aggregated responses.
Explicitly invalidated on mutation events (financial year change, allocations, disbursements, projects).
"""
import time
import logging
from typing import Any, Optional, Dict, Tuple

logger = logging.getLogger("CacheService")

class SafeDataCache:
    def __init__(self, default_ttl_seconds: int = 20):
        self.default_ttl = default_ttl_seconds
        self._store: Dict[str, Tuple[Any, float]] = {}

    def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if not entry:
            return None
        value, expires_at = entry
        if time.time() > expires_at:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl_seconds: Optional[float] = None) -> None:
        ttl = ttl_seconds if ttl_seconds is not None else self.default_ttl
        self._store[key] = (value, time.time() + ttl)

    def invalidate(self, prefix: Optional[str] = None) -> int:
        if prefix is None:
            count = len(self._store)
            self._store.clear()
            logger.info("[CACHE] Full cache invalidated.")
            return count
        else:
            keys = [k for k in self._store if k.startswith(prefix)]
            for k in keys:
                self._store.pop(k, None)
            if keys:
                logger.info(f"[CACHE] Invalidated {len(keys)} keys with prefix: {prefix}")
            return len(keys)

# Global singleton
public_cache = SafeDataCache()
