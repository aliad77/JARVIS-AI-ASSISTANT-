"""Generative-AI provider interface.

JARVIS no longer uses any hosted generative AI service (no Anthropic, OpenAI,
Gemini, or similar) and needs no API key. The desktop backend answers with its
SymPy math engine; the web app answers with its built-in lessons and an
optional on-device model that runs in the browser.

The :class:`AIProvider` protocol is kept so tests can plug in a fake provider and
so a future *local* provider could be added without touching the orchestrator.
The default, :class:`NoGenerativeAI`, never contacts any network service.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Protocol


class AIError(Exception):
    """A provider failure, already translated into something a student can read."""

    MESSAGES = {
        "not_configured": "The desktop service doesn't use an online AI. Math problems are answered by the math engine, "
                          "and the JARVIS web app has built-in science lessons and an optional on-device AI.",
        "rate_limit": "That's a lot of questions at once! Wait a minute and try again.",
        "bad_request": "I couldn't process that request. Try rephrasing your question.",
        "bad_output": "The AI gave an answer in a format I couldn't use. Please try again.",
        "unknown": "Something went wrong. Please try again.",
    }

    def __init__(self, kind: str, detail: str = ""):
        self.kind = kind if kind in self.MESSAGES else "unknown"
        self.user_message = self.MESSAGES[self.kind]
        self.detail = detail
        super().__init__(f"{self.kind}: {detail}" if detail else self.kind)


@dataclass
class AIReply:
    text: str
    model: str
    stop_reason: str | None
    input_tokens: int = 0
    output_tokens: int = 0

    @property
    def truncated(self) -> bool:
        return self.stop_reason == "max_tokens"


class AIProvider(Protocol):
    @property
    def configured(self) -> bool: ...

    def complete(self, system: str, messages: list[dict[str, str]], *, max_tokens: int | None = None,
                 json_schema: dict[str, Any] | None = None) -> AIReply: ...

    def complete_json(self, system: str, user: str, schema: dict[str, Any], max_tokens: int | None = None) -> Any: ...


class NoGenerativeAI:
    """Default provider: no generative AI at all. Never makes network calls."""

    configured = False

    def complete(self, system: str, messages: list[dict[str, str]], *, max_tokens: int | None = None,
                 json_schema: dict[str, Any] | None = None) -> AIReply:
        raise AIError("not_configured")

    def complete_json(self, system: str, user: str, schema: dict[str, Any], max_tokens: int | None = None) -> Any:
        raise AIError("not_configured")
