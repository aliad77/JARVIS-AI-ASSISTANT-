"""Shared fixtures. No test launches a real app or calls the real AI service."""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.ai.provider import AIError, AIReply
from app.config import Settings
from app.database.db import Database
from app.launcher.launcher import Launcher
from app.main import create_app
from app.math.worker import MathWorker
from app.security.guard import SessionToken
from app.services import build_services

TOKEN = "test-token-123"
BASE = "http://127.0.0.1:8765"


class FakeFS:
    """In-memory Windows-like filesystem for launcher tests."""

    def __init__(self, files: dict[str, float] | None = None, dirs: set[str] | None = None):
        self.files = {k.lower(): v for k, v in (files or {}).items()}
        self.dirs = {d.lower() for d in (dirs or set())}

    def is_file(self, path: str) -> bool:
        return path.lower() in self.files

    def is_dir(self, path: str) -> bool:
        return path.lower() in self.dirs

    def list_dir(self, path: str) -> list[str]:
        prefix = path.lower().rstrip("\\") + "\\"
        names = set()
        for p in list(self.files) + list(self.dirs):
            if p.startswith(prefix):
                names.add(p[len(prefix):].split("\\")[0])
        return sorted(names)

    def mtime(self, path: str) -> float:
        return self.files.get(path.lower(), 0.0)


class FakeProcess:
    def __init__(self, exit_code: int | None):
        self.exit_code = exit_code

    def wait(self, timeout: float | None = None) -> int:
        if self.exit_code is None:
            raise subprocess.TimeoutExpired("fake", timeout or 0)
        return self.exit_code


@dataclass
class RecordingSpawner:
    exit_code: int | None = None  # None = still running
    error: BaseException | None = None
    calls: list[list[str]] = field(default_factory=list)

    def __call__(self, argv: list[str]) -> FakeProcess:
        self.calls.append(list(argv))
        if self.error:
            raise self.error
        return FakeProcess(self.exit_code)


WIN_ENV = {
    "LOCALAPPDATA": r"C:\Users\kid\AppData\Local",
    "ProgramFiles": r"C:\Program Files",
    "ProgramFiles(x86)": r"C:\Program Files (x86)",
    "SystemRoot": r"C:\Windows",
}

ROBLOX_EXE = r"C:\Users\kid\AppData\Local\Roblox\Versions\version-abc123\RobloxPlayerBeta.exe"


def windows_fs() -> FakeFS:
    return FakeFS(
        files={
            ROBLOX_EXE: 200.0,
            r"C:\Users\kid\AppData\Local\Roblox\Versions\version-old000\RobloxPlayerBeta.exe": 100.0,
            r"C:\Windows\System32\calc.exe": 1.0,
            r"C:\Windows\System32\notepad.exe": 1.0,
            r"C:\Windows\explorer.exe": 1.0,
            r"C:\Program Files\Google\Chrome\Application\chrome.exe": 1.0,
        },
        dirs={
            r"C:\Users\kid\AppData\Local\Roblox\Versions",
            r"C:\Users\kid\AppData\Local\Roblox\Versions\version-abc123",
            r"C:\Users\kid\AppData\Local\Roblox\Versions\version-old000",
            r"C:\Users\kid\AppData\Local\Packages\Microsoft.Paint_8wekyb3d8bbwe",
        },
    )


class FakeAI:
    """Pluggable fake AI provider for tests. Records prompts; never hits the network."""

    def __init__(self, reply: str = "Great question! Here's how it works.", error: str | None = None,
                 json_data: Any = None, configured: bool = True):
        self.reply = reply
        self.error = error
        self.json_data = json_data
        self._configured = configured
        self.calls: list[dict[str, Any]] = []

    @property
    def configured(self) -> bool:
        return self._configured

    def complete(self, system, messages, *, max_tokens=None, json_schema=None) -> AIReply:
        self.calls.append({"system": system, "messages": messages, "json_schema": json_schema})
        if self.error:
            raise AIError(self.error)
        return AIReply(self.reply, "fake-model", "end_turn", 10, 20)

    def complete_json(self, system, user, schema, max_tokens=None):
        self.calls.append({"system": system, "messages": [{"role": "user", "content": user}], "json_schema": schema})
        if self.error:
            raise AIError(self.error)
        return self.json_data


@pytest.fixture
def settings() -> Settings:
    return Settings(JARVIS_DB_PATH=":memory:")


@pytest.fixture
def spawner() -> RecordingSpawner:
    return RecordingSpawner()


@pytest.fixture
def fake_ai() -> FakeAI:
    return FakeAI()


@pytest.fixture
def services(settings, spawner, fake_ai):
    db = Database(":memory:")
    from app.database.preferences import PreferenceStore

    prefs = PreferenceStore(db)
    launcher = Launcher(spawner=spawner, fs=windows_fs(), env=WIN_ENV, platform="win32", startup_wait=0,
                        is_enabled=lambda app_id: prefs.get().apps_enabled.get(app_id, False))
    svc = build_services(settings, db=db, launcher=launcher, math=MathWorker(inline=True), ai=fake_ai,
                         token=SessionToken(TOKEN))
    yield svc
    svc.close()


@pytest.fixture
def app(settings, services):
    return create_app(settings, services)


@pytest.fixture
def client(app):
    with TestClient(app, base_url=BASE, headers={"X-Jarvis-Token": TOKEN}) as c:
        yield c


@pytest.fixture
def anon_client(app):
    with TestClient(app, base_url=BASE) as c:
        yield c
