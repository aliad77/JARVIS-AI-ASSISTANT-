"""Trusted local launcher for allowlisted Windows applications.

Security properties:

* Only ``app_id`` values present in :data:`app.launcher.registry.APPS` can be
  launched. Anything else returns ``not_allowed``.
* Executables come from fixed, registry-defined locations (or a validated
  custom Roblox path). No user or AI text is ever placed on a command line.
* Processes are started with an argument list and ``shell=False``; neither
  ``cmd.exe`` nor PowerShell is involved.
* The result reflects what the operating system actually reported. "Started"
  means the process was created; it never means the app is fully ready.
"""

from __future__ import annotations

import ntpath
import os
import subprocess
import sys
import threading
import time
from dataclasses import asdict, dataclass
from enum import Enum
from typing import Callable, Mapping, Protocol

from app.launcher.registry import APPS, AppDefinition, is_valid_app_id

COOLDOWN_SECONDS = 5.0
STARTUP_WAIT_SECONDS = 1.0

_PLACEHOLDERS = {
    "%LOCALAPPDATA%": "LOCALAPPDATA",
    "%PROGRAMFILES%": "ProgramFiles",
    "%PROGRAMFILES(X86)%": "ProgramFiles(x86)",
    "%SYSTEMROOT%": "SystemRoot",
}


class LaunchStatus(str, Enum):
    STARTED = "started"            # process created and still running after a moment
    HANDED_OFF = "handed_off"      # Windows accepted the request (stub/Store app); window not confirmed
    NOT_INSTALLED = "not_installed"
    NOT_ALLOWED = "not_allowed"
    DISABLED = "disabled"
    UNSUPPORTED_OS = "unsupported_os"
    RATE_LIMITED = "rate_limited"
    FAILED = "failed"


@dataclass
class LaunchResult:
    app_id: str
    display_name: str
    status: LaunchStatus
    message: str
    method: str | None = None
    # JARVIS can only see that a process started; it never confirms readiness.
    ready_confirmed: bool = False

    @property
    def ok(self) -> bool:
        return self.status in (LaunchStatus.STARTED, LaunchStatus.HANDED_OFF)

    def to_dict(self) -> dict:
        data = asdict(self)
        data["status"] = self.status.value
        data["ok"] = self.ok
        return data


@dataclass
class ResolvedTarget:
    argv: list[str]
    method: str  # "exe" | "store" | "custom"
    path: str


class ProcessHandle(Protocol):
    def wait(self, timeout: float | None = None) -> int: ...


Spawner = Callable[[list[str]], ProcessHandle]


class FileSystem(Protocol):
    def is_file(self, path: str) -> bool: ...
    def is_dir(self, path: str) -> bool: ...
    def list_dir(self, path: str) -> list[str]: ...
    def mtime(self, path: str) -> float: ...


class RealFileSystem:
    def is_file(self, path: str) -> bool:
        return os.path.isfile(path)

    def is_dir(self, path: str) -> bool:
        return os.path.isdir(path)

    def list_dir(self, path: str) -> list[str]:
        try:
            return os.listdir(path)
        except OSError:
            return []

    def mtime(self, path: str) -> float:
        try:
            return os.path.getmtime(path)
        except OSError:
            return 0.0


def default_spawner(argv: list[str]) -> ProcessHandle:  # pragma: no cover - real OS call
    flags = 0
    if sys.platform == "win32":
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(  # noqa: S603 - argv is built only from the allowlist
        argv,
        shell=False,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        close_fds=True,
        creationflags=flags,
    )


class PathValidationError(ValueError):
    pass


def validate_custom_path(app: AppDefinition, path: str, fs: FileSystem) -> str:
    """Validate a user-configured executable path for an app that allows one."""
    if not app.custom_path_names:
        raise PathValidationError(f"{app.display_name} does not support a custom path.")
    if not isinstance(path, str) or not path.strip():
        raise PathValidationError("Please enter the full path to the program.")
    path = path.strip().strip('"')
    if len(path) > 260:
        raise PathValidationError("That path is too long.")
    if any(ch in path for ch in '<>|?*"\r\n\t') or "%" in path:
        raise PathValidationError("That path contains characters that are not allowed.")
    if path.startswith("\\\\"):
        raise PathValidationError("Network paths are not allowed; choose a file on this computer.")
    if not ntpath.isabs(path) or not ntpath.splitdrive(path)[0]:
        raise PathValidationError(r"Use a full path that starts with a drive letter, like C:\...")
    normalised = ntpath.normpath(path)
    name = ntpath.basename(normalised)
    allowed = {n.lower() for n in app.custom_path_names}
    if name.lower() not in allowed:
        raise PathValidationError(
            f"The file must be one of: {', '.join(app.custom_path_names)}."
        )
    if not fs.is_file(normalised):
        raise PathValidationError("I couldn't find that file. Check the path and try again.")
    return normalised


class Launcher:
    def __init__(
        self,
        *,
        spawner: Spawner = default_spawner,
        fs: FileSystem | None = None,
        env: Mapping[str, str] | None = None,
        platform: str | None = None,
        is_enabled: Callable[[str], bool] | None = None,
        custom_path: Callable[[str], str | None] | None = None,
        clock: Callable[[], float] = time.monotonic,
        startup_wait: float = STARTUP_WAIT_SECONDS,
    ):
        self._spawner = spawner
        self._fs = fs or RealFileSystem()
        self._env = env if env is not None else os.environ
        self._platform = platform or sys.platform
        self._is_enabled = is_enabled or (lambda _app_id: True)
        self._custom_path = custom_path or (lambda _app_id: None)
        self._clock = clock
        self._startup_wait = startup_wait
        self._last_launch: dict[str, float] = {}
        self._lock = threading.Lock()

    # -- path resolution ---------------------------------------------------
    def _expand(self, template: str) -> str | None:
        out = template
        for placeholder, var in _PLACEHOLDERS.items():
            if placeholder in out.upper():
                value = self._env.get(var)
                if not value:
                    return None
                idx = out.upper().index(placeholder)
                out = out[:idx] + value + out[idx + len(placeholder):]
        return out

    def _versioned(self, app: AppDefinition) -> str | None:
        if not app.versioned_dir or not app.versioned_exe:
            return None
        base = self._expand(app.versioned_dir)
        if not base or not self._fs.is_dir(base):
            return None
        found = []
        for entry in self._fs.list_dir(base):
            if not entry.lower().startswith("version-"):
                continue
            candidate = ntpath.join(base, entry, app.versioned_exe)
            if self._fs.is_file(candidate):
                found.append((self._fs.mtime(candidate), candidate))
        return max(found)[1] if found else None

    def _store_installed(self, app: AppDefinition) -> bool:
        if app.store_app is None:
            return False
        local = self._env.get("LOCALAPPDATA")
        return bool(local) and self._fs.is_dir(ntpath.join(local, "Packages", app.store_app.package_family))

    def resolve(self, app_id: str) -> ResolvedTarget | None:
        app = APPS[app_id]
        custom = self._custom_path(app_id)
        if custom:
            try:
                path = validate_custom_path(app, custom, self._fs)
                return ResolvedTarget([path, *app.fixed_args], "custom", path)
            except PathValidationError:
                pass  # fall through to standard locations
        versioned = self._versioned(app)
        if versioned:
            return ResolvedTarget([versioned, *app.fixed_args], "exe", versioned)
        for template in app.exe_candidates:
            path = self._expand(template)
            if path and self._fs.is_file(path):
                return ResolvedTarget([path, *app.fixed_args], "exe", path)
        if self._store_installed(app):
            explorer = self._expand(r"%SYSTEMROOT%\explorer.exe")
            if explorer and self._fs.is_file(explorer):
                arg = "shell:AppsFolder\\" + app.store_app.aumid  # fixed registry value
                return ResolvedTarget([explorer, arg], "store", app.store_app.aumid)
        return None

    def availability(self, app_id: str) -> dict:
        if not is_valid_app_id(app_id):
            return {"installed": False, "method": None, "path": None}
        if self._platform != "win32":
            return {"installed": False, "method": None, "path": None, "reason": "unsupported_os"}
        target = self.resolve(app_id)
        if target is None:
            return {"installed": False, "method": None, "path": None}
        return {"installed": True, "method": target.method, "path": target.path}

    # -- launching ---------------------------------------------------------
    def launch(self, app_id: object) -> LaunchResult:
        if not is_valid_app_id(app_id):
            return LaunchResult(str(app_id)[:40], "Unknown app", LaunchStatus.NOT_ALLOWED,
                                "That app is not on JARVIS's approved list, so I can't open it.")
        app = APPS[app_id]  # type: ignore[index]
        name = app.display_name
        if not self._is_enabled(app.app_id):
            return LaunchResult(app.app_id, name, LaunchStatus.DISABLED,
                                f"{name} is turned off in JARVIS settings.")
        if self._platform != "win32":
            return LaunchResult(app.app_id, name, LaunchStatus.UNSUPPORTED_OS,
                                f"I can only open apps on Windows. This computer is running '{self._platform}'.")
        with self._lock:
            now = self._clock()
            last = self._last_launch.get(app.app_id)
            if last is not None and now - last < COOLDOWN_SECONDS:
                return LaunchResult(app.app_id, name, LaunchStatus.RATE_LIMITED,
                                    f"I just asked Windows to open {name}. Give it a few seconds.")
            self._last_launch[app.app_id] = now

        target = self.resolve(app.app_id)
        if target is None:
            with self._lock:
                self._last_launch.pop(app.app_id, None)
            hint = ""
            if app.app_id == "roblox":
                hint = (" If Roblox is installed somewhere unusual, open Settings → Roblox and paste the full "
                        "path to RobloxPlayerBeta.exe (usually inside %LOCALAPPDATA%\\Roblox\\Versions\\version-…).")
            return LaunchResult(app.app_id, name, LaunchStatus.NOT_INSTALLED,
                                f"I couldn't find {name} on this computer.{hint}")
        try:
            proc = self._spawner(target.argv)
        except FileNotFoundError:
            return LaunchResult(app.app_id, name, LaunchStatus.NOT_INSTALLED,
                                f"Windows couldn't find the {name} program file.", target.method)
        except PermissionError:
            return LaunchResult(app.app_id, name, LaunchStatus.FAILED,
                                f"Windows didn't give permission to start {name}.", target.method)
        except OSError as exc:
            return LaunchResult(app.app_id, name, LaunchStatus.FAILED,
                                f"Windows reported an error starting {name}: {exc.strerror or exc}.", target.method)

        try:
            code = proc.wait(timeout=self._startup_wait)
        except subprocess.TimeoutExpired:
            return LaunchResult(app.app_id, name, LaunchStatus.STARTED,
                                f"{name} is starting. It may take a moment to appear on screen.", target.method)

        if target.method == "store":
            # explorer.exe exits immediately (often with code 1) after handing off.
            return LaunchResult(app.app_id, name, LaunchStatus.HANDED_OFF,
                                f"I asked Windows to open {name}. It should appear shortly, but I can't confirm the window opened.",
                                target.method)
        if code == 0 and app.exits_after_handoff:
            return LaunchResult(app.app_id, name, LaunchStatus.HANDED_OFF,
                                f"Windows accepted the request to open {name}. It should appear shortly.", target.method)
        if code == 0:
            return LaunchResult(app.app_id, name, LaunchStatus.HANDED_OFF,
                                f"{name}'s launcher ran and closed. The app may open in a new window.", target.method)
        return LaunchResult(app.app_id, name, LaunchStatus.FAILED,
                            f"{name} closed right away with error code {code}, so it probably didn't open.", target.method)
