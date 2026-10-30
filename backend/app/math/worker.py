"""Runs math operations in an isolated worker process with a hard timeout.

SymPy can take a very long time on some inputs (huge polynomials, hard
transcendental equations). Running the work in a separate process means a
pathological input is killed after ``timeout`` seconds instead of tying up the
web server's CPU indefinitely.
"""

from __future__ import annotations

import logging
import multiprocessing as mp
import threading
from typing import Any

from app.math import engine

log = logging.getLogger(__name__)


class MathTimeoutError(RuntimeError):
    pass


def _worker_init() -> None:  # pragma: no cover - runs in child process
    # Best-effort memory cap on POSIX systems. Windows has no RLIMIT; the
    # timeout is the primary guard there.
    try:
        import resource

        limit = 768 * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    except (ImportError, ValueError, OSError):
        pass


class MathWorker:
    """Thread-safe facade over a small spawn-based process pool.

    ``inline=True`` runs operations in-process (used by fast unit tests; the
    parser's own limits still apply, but there is no hard timeout).
    """

    def __init__(self, timeout: float = 4.0, processes: int = 2, inline: bool = False):
        self.timeout = timeout
        self.processes = processes
        self.inline = inline
        self._pool: Any = None
        self._lock = threading.Lock()

    def _get_pool(self):
        with self._lock:
            if self._pool is None:
                ctx = mp.get_context("spawn")
                self._pool = ctx.Pool(processes=self.processes, initializer=_worker_init, maxtasksperchild=200)
            return self._pool

    def _reset(self, pool) -> None:
        with self._lock:
            if self._pool is pool:
                self._pool = None
        pool.terminate()  # kills the stuck worker(s)
        pool.join()

    def run(self, operation: str, **kwargs: Any) -> dict[str, Any]:
        if self.inline:
            return engine.dispatch(operation, kwargs)
        pool = self._get_pool()
        async_result = pool.apply_async(engine.dispatch, (operation, kwargs))
        try:
            return async_result.get(timeout=self.timeout)
        except mp.TimeoutError as exc:
            log.warning("Math operation %s timed out; restarting worker pool", operation)
            self._reset(pool)
            raise MathTimeoutError("That problem took too long for the math engine.") from exc

    def analyze(self, text: str, variable: str | None = None) -> dict[str, Any]:
        try:
            return self.run("analyze", text=text, variable=variable)
        except MathTimeoutError as exc:
            return {"status": "unsupported", "message": str(exc) + " I stopped it to keep JARVIS fast."}

    def check_answer(self, expected: str, answer: str) -> dict[str, Any]:
        try:
            return self.run("check_answer", expected=expected, answer=answer)
        except MathTimeoutError as exc:
            return {"status": "unsupported", "correct": False, "message": str(exc)}

    def close(self) -> None:
        with self._lock:
            pool, self._pool = self._pool, None
        if pool is not None:
            pool.terminate()
            pool.join()
