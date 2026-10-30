"""Wires the application's components together (one instance per server)."""

from __future__ import annotations

from dataclasses import dataclass

from app.ai.orchestrator import ChatService
from app.ai.provider import AIProvider, NoGenerativeAI
from app.config import Settings
from app.database.db import Database
from app.database.preferences import PreferenceStore
from app.launcher.launcher import Launcher
from app.math.worker import MathWorker
from app.security.guard import SessionToken
from app.security.ratelimit import RateLimiter


@dataclass
class Services:
    settings: Settings
    db: Database
    prefs: PreferenceStore
    launcher: Launcher
    math: MathWorker
    ai: AIProvider
    limiter: RateLimiter
    token: SessionToken
    chat: ChatService

    def close(self) -> None:
        self.math.close()
        self.db.close()


def build_services(settings: Settings, *, db: Database | None = None, launcher: Launcher | None = None,
                   math: MathWorker | None = None, ai: AIProvider | None = None,
                   limiter: RateLimiter | None = None, token: SessionToken | None = None) -> Services:
    db = db or Database(settings.db_path)
    prefs = PreferenceStore(db)

    def roblox_path(app_id: str) -> str | None:
        if app_id != "roblox":
            return None
        return prefs.get().roblox_path or settings.roblox_path

    launcher = launcher or Launcher(
        is_enabled=lambda app_id: prefs.get().apps_enabled.get(app_id, False),
        custom_path=roblox_path,
    )
    math = math or MathWorker(timeout=settings.math_timeout_seconds)
    ai = ai or NoGenerativeAI()
    limiter = limiter or RateLimiter()
    chat = ChatService(settings=settings, db=db, prefs=prefs, launcher=launcher, math=math, ai=ai, limiter=limiter)
    return Services(settings, db, prefs, launcher, math, ai, limiter, token or SessionToken(), chat)
