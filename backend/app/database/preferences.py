"""User preferences: an allowlisted, validated set of keys stored in SQLite."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.database.db import Database
from app.education.grades import DEFAULT_GRADE, SUPPORTED_GRADES
from app.education.subjects import SUBJECTS
from app.launcher.registry import APPS
from app.voice.settings import VOICE_LANGUAGES, VOICE_RATE_MAX, VOICE_RATE_MIN


class Preferences(BaseModel):
    model_config = ConfigDict(extra="forbid")

    grade: int = DEFAULT_GRADE
    subject: str = "general"
    voice_enabled: bool = True
    voice_rate: float = Field(default=1.0, ge=VOICE_RATE_MIN, le=VOICE_RATE_MAX)
    voice_name: str = Field(default="", max_length=120)
    voice_lang: str = "en-US"
    mute_responses: bool = False
    reduced_motion: bool = False
    sound_effects: bool = True
    apps_enabled: dict[str, bool] = Field(default_factory=lambda: {app_id: True for app_id in APPS})
    roblox_path: str | None = None

    @field_validator("grade")
    @classmethod
    def _grade(cls, v: int) -> int:
        if v not in SUPPORTED_GRADES:
            raise ValueError("grade must be between 7 and 12")
        return v

    @field_validator("subject")
    @classmethod
    def _subject(cls, v: str) -> str:
        if v not in SUBJECTS:
            raise ValueError("unknown subject")
        return v

    @field_validator("voice_lang")
    @classmethod
    def _lang(cls, v: str) -> str:
        if v not in VOICE_LANGUAGES:
            raise ValueError("unsupported voice language")
        return v

    @field_validator("apps_enabled")
    @classmethod
    def _apps(cls, v: dict[str, bool]) -> dict[str, bool]:
        unknown = set(v) - set(APPS)
        if unknown:
            raise ValueError("apps_enabled may only contain approved app ids")
        return {app_id: bool(v.get(app_id, True)) for app_id in APPS}


class PreferencesUpdate(BaseModel):
    """Partial update from the settings page. ``roblox_path`` has its own endpoint."""

    model_config = ConfigDict(extra="forbid")

    grade: int | None = None
    subject: str | None = None
    voice_enabled: bool | None = None
    voice_rate: float | None = None
    voice_name: str | None = None
    voice_lang: str | None = None
    mute_responses: bool | None = None
    reduced_motion: bool | None = None
    sound_effects: bool | None = None
    apps_enabled: dict[str, bool] | None = None


class PreferenceStore:
    def __init__(self, db: Database):
        self._db = db

    def get(self) -> Preferences:
        stored = self._db.get_preferences()
        known = {k: v for k, v in stored.items() if k in Preferences.model_fields}
        try:
            return Preferences(**known)
        except ValueError:
            return Preferences()

    def update(self, changes: dict[str, Any]) -> Preferences:
        current = self.get().model_dump()
        if "apps_enabled" in changes and changes["apps_enabled"] is not None:
            merged = dict(current["apps_enabled"])
            merged.update(changes["apps_enabled"])
            changes = {**changes, "apps_enabled": merged}
        current.update({k: v for k, v in changes.items() if v is not None or k == "roblox_path"})
        prefs = Preferences(**current)  # validates
        self._db.set_preferences(prefs.model_dump())
        return prefs
