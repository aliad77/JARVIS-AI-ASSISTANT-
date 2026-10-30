"""The explicit allowlist of applications JARVIS may open.

This file is the *only* source of launchable programs. Each entry lists fixed
candidate locations built from well-known Windows folders. Nothing here is
derived from AI output or free-form user text: chat messages are resolved to
an ``app_id`` by exact alias match, and the launcher then looks up the entry
below. Adding an application means editing this file in code review.
"""

from __future__ import annotations

from dataclasses import dataclass, field

# Microsoft Store package family names / app user model IDs for Store builds.
ROBLOX_STORE_FAMILY = "ROBLOXCORPORATION.ROBLOX_55nm5eh3cm0pr"
PAINT_STORE_FAMILY = "Microsoft.Paint_8wekyb3d8bbwe"


@dataclass(frozen=True)
class StoreApp:
    """A Microsoft Store (MSIX) app launched via ``shell:AppsFolder``."""

    package_family: str
    app_id: str = "App"

    @property
    def aumid(self) -> str:
        return f"{self.package_family}!{self.app_id}"


@dataclass(frozen=True)
class AppDefinition:
    app_id: str
    display_name: str
    aliases: tuple[str, ...]
    # Paths may use only the placeholders %LOCALAPPDATA%, %PROGRAMFILES%,
    # %PROGRAMFILES(X86)% and %SYSTEMROOT%, which are resolved from the OS.
    exe_candidates: tuple[str, ...] = ()
    # A directory to search for versioned installs, with the exe name inside.
    versioned_dir: str | None = None
    versioned_exe: str | None = None
    store_app: StoreApp | None = None
    # Executable file names accepted for a user-configured custom path.
    custom_path_names: tuple[str, ...] = ()
    # Fixed, non-user-controlled command-line arguments (usually empty).
    fixed_args: tuple[str, ...] = ()
    # Some system "apps" are tiny stubs that hand off to a Store app and exit.
    exits_after_handoff: bool = False
    description: str = ""
    tags: tuple[str, ...] = field(default_factory=tuple)


APPS: dict[str, AppDefinition] = {
    "roblox": AppDefinition(
        app_id="roblox",
        display_name="Roblox",
        aliases=("roblox", "roblox player", "roblox app", "roblox game", "roblox games"),
        versioned_dir=r"%LOCALAPPDATA%\Roblox\Versions",
        versioned_exe="RobloxPlayerBeta.exe",
        exe_candidates=(
            r"%PROGRAMFILES(X86)%\Roblox\Versions\RobloxPlayerLauncher.exe",
        ),
        store_app=StoreApp(ROBLOX_STORE_FAMILY),
        custom_path_names=("RobloxPlayerBeta.exe", "RobloxPlayerLauncher.exe"),
        description="Roblox game player",
        tags=("game",),
    ),
    "chrome": AppDefinition(
        app_id="chrome",
        display_name="Google Chrome",
        aliases=("chrome", "google chrome", "chrome browser"),
        exe_candidates=(
            r"%PROGRAMFILES%\Google\Chrome\Application\chrome.exe",
            r"%PROGRAMFILES(X86)%\Google\Chrome\Application\chrome.exe",
            r"%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe",
        ),
        description="Web browser",
        tags=("browser",),
    ),
    "edge": AppDefinition(
        app_id="edge",
        display_name="Microsoft Edge",
        aliases=("edge", "microsoft edge", "edge browser"),
        exe_candidates=(
            r"%PROGRAMFILES(X86)%\Microsoft\Edge\Application\msedge.exe",
            r"%PROGRAMFILES%\Microsoft\Edge\Application\msedge.exe",
        ),
        description="Web browser",
        tags=("browser",),
    ),
    "calculator": AppDefinition(
        app_id="calculator",
        display_name="Calculator",
        aliases=("calculator", "calc", "windows calculator", "the calculator"),
        exe_candidates=(r"%SYSTEMROOT%\System32\calc.exe",),
        exits_after_handoff=True,
        description="Windows Calculator",
        tags=("tool",),
    ),
    "notepad": AppDefinition(
        app_id="notepad",
        display_name="Notepad",
        aliases=("notepad", "note pad", "notes app"),
        exe_candidates=(r"%SYSTEMROOT%\System32\notepad.exe", r"%SYSTEMROOT%\notepad.exe"),
        exits_after_handoff=True,
        description="Plain text editor",
        tags=("tool",),
    ),
    "paint": AppDefinition(
        app_id="paint",
        display_name="Paint",
        aliases=("paint", "ms paint", "microsoft paint", "mspaint"),
        exe_candidates=(
            r"%SYSTEMROOT%\System32\mspaint.exe",
            r"%LOCALAPPDATA%\Microsoft\WindowsApps\mspaint.exe",
        ),
        store_app=StoreApp(PAINT_STORE_FAMILY),
        exits_after_handoff=True,
        description="Drawing app",
        tags=("creative",),
    ),
}

_ALIAS_INDEX: dict[str, str] = {alias: app.app_id for app in APPS.values() for alias in app.aliases}


def resolve_alias(name: str) -> str | None:
    """Map a spoken/typed app name to an approved ``app_id`` (exact match only)."""
    return _ALIAS_INDEX.get(name.strip().lower())


def is_valid_app_id(app_id: object) -> bool:
    return isinstance(app_id, str) and app_id in APPS


def all_aliases() -> list[str]:
    return sorted(_ALIAS_INDEX, key=len, reverse=True)
