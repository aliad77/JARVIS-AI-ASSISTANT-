"""A tiny in-memory sliding-window rate limiter (single local user)."""

from __future__ import annotations

import threading
import time
from collections import defaultdict, deque
from typing import Callable

LIMITS: dict[str, tuple[int, float]] = {
    # bucket: (max requests, per seconds)
    "chat": (20, 60.0),
    "launch": (8, 60.0),
    "quiz": (10, 60.0),
    "math": (60, 60.0),
}


class RateLimiter:
    def __init__(self, limits: dict[str, tuple[int, float]] | None = None, clock: Callable[[], float] = time.monotonic):
        self.limits = limits or LIMITS
        self._clock = clock
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def allow(self, bucket: str) -> bool:
        limit, window = self.limits.get(bucket, (60, 60.0))
        now = self._clock()
        with self._lock:
            hits = self._hits[bucket]
            while hits and now - hits[0] > window:
                hits.popleft()
            if len(hits) >= limit:
                return False
            hits.append(now)
            return True
