"""Request bodies. Every field is length- and type-limited; unknown fields are rejected."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field

ID_PATTERN = r"^[a-f0-9]{32}$"


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class ChatRequest(_Strict):
    message: str = Field(min_length=1, max_length=2000)
    conversation_id: str | None = Field(default=None, pattern=ID_PATTERN)
    grade: int | None = Field(default=None, ge=7, le=12)
    subject: str | None = Field(default=None, max_length=30)
    mode: str | None = Field(default=None, max_length=20)


class NewConversationRequest(_Strict):
    title: str | None = Field(default=None, max_length=80)
    grade: int | None = Field(default=None, ge=7, le=12)
    subject: str | None = Field(default=None, max_length=30)
    mode: str | None = Field(default=None, max_length=20)


class LaunchRequest(_Strict):
    app_id: str = Field(min_length=1, max_length=40, pattern=r"^[a-z0-9_]+$")


class RobloxPathRequest(_Strict):
    path: str | None = Field(default=None, max_length=260)


class MathRequest(_Strict):
    expression: str = Field(min_length=1, max_length=200)
    variable: str | None = Field(default=None, pattern=r"^[a-z]$")


class PracticeRequest(_Strict):
    topic: str | None = Field(default=None, max_length=40)
    grade: int | None = Field(default=None, ge=7, le=12)


class PracticeCheckRequest(_Strict):
    answer: str = Field(default="", max_length=100)
    reveal: bool = False


class QuizRequest(_Strict):
    subject: str = Field(max_length=30)
    topic: str | None = Field(default=None, max_length=60, pattern=r"^[A-Za-z0-9 ,'()\-_]*$")
    grade: int | None = Field(default=None, ge=7, le=12)
    count: int = Field(default=5, ge=3, le=10)


class QuizSubmitRequest(_Strict):
    answers: list[int | None] = Field(max_length=10)
