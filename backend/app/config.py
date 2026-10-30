"""Application configuration loaded from environment variables / .env.

JARVIS needs no secrets or API keys. Nothing here is sent to the browser.
"""

from __future__ import annotations

import ipaddress
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(PROJECT_DIR / ".env"), str(BACKEND_DIR / ".env")),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- Network -----------------------------------------------------------
    host: str = Field(default="127.0.0.1", alias="JARVIS_HOST")
    port: int = Field(default=8765, alias="JARVIS_PORT", ge=1024, le=65535)
    # Vite dev server port; its origin is allowed only so local development works.
    dev_frontend_port: int = Field(default=5173, alias="JARVIS_DEV_FRONTEND_PORT", ge=1024, le=65535)
    allow_dev_origins: bool = Field(default=True, alias="JARVIS_ALLOW_DEV_ORIGINS")

    # --- Storage -----------------------------------------------------------
    db_path: Path = Field(default=BACKEND_DIR / "data" / "jarvis.sqlite3", alias="JARVIS_DB_PATH")

    # Conversation context kept for the (optional) provider interface.
    ai_history_messages: int = Field(default=12, alias="JARVIS_AI_HISTORY_MESSAGES", ge=0, le=40)

    # --- Launcher ----------------------------------------------------------
    roblox_path: str | None = Field(default=None, alias="JARVIS_ROBLOX_PATH")

    # --- Math engine -------------------------------------------------------
    math_timeout_seconds: float = Field(default=4.0, alias="JARVIS_MATH_TIMEOUT_SECONDS", ge=0.5, le=20)

    @field_validator("host")
    @classmethod
    def _loopback_only(cls, value: str) -> str:
        """JARVIS must never listen on a LAN or public interface."""
        if value == "localhost":
            return "127.0.0.1"
        try:
            ip = ipaddress.ip_address(value)
        except ValueError as exc:
            raise ValueError("JARVIS_HOST must be a loopback IP address such as 127.0.0.1") from exc
        if not ip.is_loopback:
            raise ValueError("JARVIS_HOST must be a loopback address; LAN/internet exposure is not allowed")
        return value

    def allowed_hosts(self) -> set[str]:
        """Host header values accepted by the server (defends against DNS rebinding)."""
        ports = [self.port]
        if self.allow_dev_origins:
            ports.append(self.dev_frontend_port)
        hosts: set[str] = set()
        for port in ports:
            for name in ("127.0.0.1", "localhost", "[::1]"):
                hosts.add(f"{name}:{port}")
        return hosts

    def allowed_origins(self) -> set[str]:
        return {f"http://{h}" for h in self.allowed_hosts()}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
