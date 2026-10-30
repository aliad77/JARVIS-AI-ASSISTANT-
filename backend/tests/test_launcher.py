"""Launcher allowlist and OS-result reporting, using a mocked spawner (no real apps start)."""

from __future__ import annotations

import inspect

import pytest

from app.launcher import launcher as launcher_module
from app.launcher.launcher import LaunchStatus, Launcher, PathValidationError, validate_custom_path
from app.launcher.registry import APPS, resolve_alias
from tests.conftest import ROBLOX_EXE, WIN_ENV, FakeFS, RecordingSpawner, windows_fs


def make(spawner=None, **kw):
    spawner = spawner or RecordingSpawner()
    opts = dict(spawner=spawner, fs=windows_fs(), env=WIN_ENV, platform="win32", startup_wait=0)
    opts.update(kw)
    return Launcher(**opts), spawner


def test_allowlist_contains_exactly_the_supported_apps():
    assert set(APPS) == {"roblox", "chrome", "edge", "calculator", "notepad", "paint"}


def test_roblox_launches_newest_version_with_argv_list():
    launcher, spawner = make()
    result = launcher.launch("roblox")
    assert result.status is LaunchStatus.STARTED and result.ok
    assert result.ready_confirmed is False
    assert spawner.calls == [[ROBLOX_EXE]]


@pytest.mark.parametrize("bad", ["cmd", "powershell", "regedit", "../../calc", "roblox; del *", "", None, 42, "ROBLOX"])
def test_unapproved_ids_are_rejected_without_spawning(bad):
    launcher, spawner = make()
    result = launcher.launch(bad)
    assert result.status is LaunchStatus.NOT_ALLOWED and not result.ok
    assert spawner.calls == []


def test_missing_app_reports_not_installed_with_roblox_help():
    launcher, spawner = make(fs=FakeFS())
    result = launcher.launch("roblox")
    assert result.status is LaunchStatus.NOT_INSTALLED
    assert "Settings" in result.message and "RobloxPlayerBeta.exe" in result.message
    assert spawner.calls == []


def test_non_windows_is_reported_honestly():
    launcher, spawner = make(platform="darwin")
    result = launcher.launch("notepad")
    assert result.status is LaunchStatus.UNSUPPORTED_OS
    assert spawner.calls == []


def test_disabled_app_is_not_launched():
    launcher, spawner = make(is_enabled=lambda app_id: app_id != "chrome")
    assert launcher.launch("chrome").status is LaunchStatus.DISABLED
    assert spawner.calls == []


def test_stub_app_that_exits_zero_is_handed_off_not_ready():
    launcher, _ = make(RecordingSpawner(exit_code=0))
    result = launcher.launch("calculator")
    assert result.status is LaunchStatus.HANDED_OFF and result.ready_confirmed is False


def test_immediate_failure_is_reported():
    launcher, _ = make(RecordingSpawner(exit_code=3))
    result = launcher.launch("chrome")
    assert result.status is LaunchStatus.FAILED and "error code 3" in result.message


def test_spawn_errors_are_reported():
    launcher, _ = make(RecordingSpawner(error=PermissionError()))
    assert launcher.launch("notepad").status is LaunchStatus.FAILED
    launcher, _ = make(RecordingSpawner(error=FileNotFoundError()))
    assert launcher.launch("notepad").status is LaunchStatus.NOT_INSTALLED


def test_store_app_uses_fixed_shell_appsfolder_argument():
    launcher, spawner = make(RecordingSpawner(exit_code=1))
    result = launcher.launch("paint")
    assert result.status is LaunchStatus.HANDED_OFF
    assert spawner.calls == [[r"C:\Windows\explorer.exe", r"shell:AppsFolder\Microsoft.Paint_8wekyb3d8bbwe!App"]]


def test_cooldown_prevents_spam():
    t = [0.0]
    launcher, spawner = make(clock=lambda: t[0])
    assert launcher.launch("notepad").ok
    assert launcher.launch("notepad").status is LaunchStatus.RATE_LIMITED
    t[0] = 10.0
    assert launcher.launch("notepad").ok
    assert len(spawner.calls) == 2


def test_custom_roblox_path_is_used_when_valid():
    custom = r"D:\Games\Roblox\RobloxPlayerBeta.exe"
    fs = FakeFS(files={custom: 1.0})
    launcher, spawner = make(fs=fs, custom_path=lambda app_id: custom if app_id == "roblox" else None)
    assert launcher.launch("roblox").ok
    assert spawner.calls == [[custom]]


@pytest.mark.parametrize("path", [
    r"C:\Windows\System32\cmd.exe",
    r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
    r"relative\RobloxPlayerBeta.exe",
    r"\\server\share\RobloxPlayerBeta.exe",
    r"C:\Games\RobloxPlayerBeta.exe & calc",
    r"%TEMP%\RobloxPlayerBeta.exe",
    r"C:\Games\RobloxPlayerBeta.bat",
    r"C:\Missing\RobloxPlayerBeta.exe",
    "",
])
def test_custom_path_validation_rejects_unsafe_paths(path):
    fs = FakeFS(files={r"C:\Windows\System32\cmd.exe": 1.0})
    with pytest.raises(PathValidationError):
        validate_custom_path(APPS["roblox"], path, fs)


def test_custom_path_not_allowed_for_other_apps():
    with pytest.raises(PathValidationError):
        validate_custom_path(APPS["chrome"], r"C:\chrome.exe", FakeFS(files={r"C:\chrome.exe": 1}))


def test_alias_resolution_is_exact():
    assert resolve_alias("Roblox") == "roblox"
    assert resolve_alias("roblox.exe") is None
    assert resolve_alias("calc && whoami") is None


def test_launcher_source_never_uses_a_shell():
    source = inspect.getsource(launcher_module)
    assert "shell=False" in source
    assert "shell=True" not in source
    for forbidden in ("os.system", "os.startfile", "os.popen", "subprocess.run(", "subprocess.call("):
        assert forbidden not in source


def test_availability():
    launcher, _ = make()
    assert launcher.availability("roblox")["installed"] is True
    assert launcher.availability("edge")["installed"] is False
    assert launcher.availability("nope")["installed"] is False
