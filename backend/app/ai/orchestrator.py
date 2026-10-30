"""Chat orchestration: route a message, call the right trusted component, store the result.

The AI model only ever produces *text*. App launches and settings changes are
decided by the deterministic intent router from the user's own words and are
carried out by trusted local code, which then reports what really happened.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.ai.intent import Intent, IntentType, classify
from app.ai.prompts import build_system_prompt
from app.ai.provider import AIError, AIProvider
from app.ai.safety import CRISIS_REPLY, PERSONAL_INFO_NOTE, screen_message
from app.config import Settings
from app.database.db import Database
from app.database.preferences import PreferenceStore
from app.education.grades import SUPPORTED_GRADES, normalise_grade
from app.education.subjects import normalise_mode, normalise_subject
from app.launcher.launcher import Launcher
from app.launcher.registry import APPS
from app.math.worker import MathWorker
from app.security.ratelimit import RateLimiter

log = logging.getLogger(__name__)


@dataclass
class ChatInput:
    message: str
    conversation_id: str | None = None
    grade: int | None = None
    subject: str | None = None
    mode: str | None = None


def math_fallback_text(result: dict[str, Any]) -> str:
    """Explain an engine result without the AI (used when the AI is unavailable)."""
    status = result.get("status")
    lines: list[str] = []
    if status in ("verified", "unverified") and result.get("result_latex"):
        tag = "checked" if status == "verified" else "calculated (not fully checked)"
        lines.append(f"**Math engine answer ({tag}):**")
        lines.append(f"$${result['result_latex']}$$")
        if result.get("decimal"):
            lines.append(f"That's about **{result['decimal']}**.")
    elif result.get("message"):
        lines.append(f"**Math engine:** {result['message']}")
    steps = result.get("steps") or []
    if steps:
        lines.append("**Steps:**")
        for i, step in enumerate(steps, 1):
            lines.append(f"{i}. {step['text']}")
            if step.get("latex"):
                lines.append(f"$${step['latex']}$$")
    for sol in result.get("solutions") or []:
        check = sol.get("check") or {}
        if check.get("latex") and check.get("ok"):
            var = result.get("variable", "x")
            lines.append(f"Check ${var} = {sol['value_latex']}$: ${check['latex']}$ ✔")
    for ex in result.get("excluded") or []:
        lines.append(f"- ${ex['value_latex']}$ — {ex['reason']}")
    return "\n\n".join(line for line in lines if line)


class ChatService:
    def __init__(self, *, settings: Settings, db: Database, prefs: PreferenceStore, launcher: Launcher,
                 math: MathWorker, ai: AIProvider, limiter: RateLimiter):
        self.settings = settings
        self.db = db
        self.prefs = prefs
        self.launcher = launcher
        self.math = math
        self.ai = ai
        self.limiter = limiter

    # ------------------------------------------------------------------
    def handle(self, req: ChatInput) -> dict[str, Any]:
        prefs = self.prefs.get()
        grade = normalise_grade(req.grade if req.grade is not None else prefs.grade)
        subject = normalise_subject(req.subject or prefs.subject)
        mode = normalise_mode(req.mode)

        conv = self.db.get_conversation(req.conversation_id) if req.conversation_id else None
        if conv is None:
            conv = self.db.create_conversation(_title_from(req.message), grade, subject, mode)
        else:
            self.db.update_conversation(conv["id"], grade=grade, subject=subject, mode=mode)
        cid = conv["id"]

        user_msg = self.db.add_message(cid, "user", req.message)
        screen = screen_message(req.message)
        settings_changed = None

        if screen.crisis:
            content, meta = CRISIS_REPLY, {"intent": "safety"}
        else:
            intent = classify(req.message)
            if intent.type is IntentType.LAUNCH:
                content, meta = self._launch(intent)
            elif intent.type is IntentType.SETTINGS:
                content, meta, settings_changed = self._settings(intent, cid)
            else:
                content, meta = self._tutor(intent, cid, grade, subject, mode)
            if screen.personal_info_found and meta.get("intent") not in ("launch_intent",):
                content = f"{content}\n\n{PERSONAL_INFO_NOTE}"

        meta.update({"grade": grade, "subject": subject, "mode": mode})
        assistant_msg = self.db.add_message(cid, "assistant", content, meta)
        return {
            "conversation": self.db.get_conversation(cid),
            "user_message": user_msg,
            "assistant_message": assistant_msg,
            "settings": settings_changed,
        }

    # ------------------------------------------------------------------
    def _launch(self, intent: Intent) -> tuple[str, dict[str, Any]]:
        if intent.app_id is None:
            approved = ", ".join(app.display_name for app in APPS.values())
            name = intent.requested_app or "that app"
            return (f"Sorry, \"{name}\" isn't on my approved app list, so I can't open it. "
                    f"I can open: {approved}.",
                    {"intent": IntentType.LAUNCH.value, "launch": {"status": "not_allowed", "ok": False,
                                                                    "app_id": None}})
        if not self.limiter.allow("launch"):
            return ("Whoa, that's a lot of app launches! Wait a minute and try again.",
                    {"intent": IntentType.LAUNCH.value, "launch": {"status": "rate_limited", "ok": False,
                                                                    "app_id": intent.app_id}})
        result = self.launcher.launch(intent.app_id)
        return result.message, {"intent": IntentType.LAUNCH.value, "launch": result.to_dict()}

    def _settings(self, intent: Intent, cid: str) -> tuple[str, dict[str, Any], dict[str, Any] | None]:
        meta: dict[str, Any] = {"intent": IntentType.SETTINGS.value}
        if "grade" in intent.setting:
            grade = intent.setting["grade"]
            if grade not in SUPPORTED_GRADES:
                return ("I can help with grades 7 to 12. Which of those grades are you in?", meta, None)
            prefs = self.prefs.update({"grade": grade})
            self.db.update_conversation(cid, grade=grade)
            meta["action"] = "grade_changed"
            return (f"Level up! I've set your grade to **{grade}**. I'll explain things at a grade {grade} level from now on.",
                    meta, prefs.model_dump())
        what = intent.setting.get("open_settings", "that")
        meta["action"] = "open_settings"
        return (f"You can change {what} settings on the **Settings** page (the gear icon at the top right).", meta, None)

    def _tutor(self, intent: Intent, cid: str, grade: int, subject: str, mode: str) -> tuple[str, dict[str, Any]]:
        meta: dict[str, Any] = {"intent": intent.type.value}
        if intent.subject_hint and subject == "general":
            subject = intent.subject_hint
        math_result = None
        if intent.math is not None:
            math_result = self.math.analyze(intent.math.expression, intent.math.variable)
            meta["math"] = math_result
        if intent.confirm_app_id:
            app = APPS[intent.confirm_app_id]
            meta["suggestion"] = {"type": "launch", "app_id": app.app_id, "label": f"Open {app.display_name}"}

        if not self.limiter.allow("chat"):
            meta["ai"] = {"status": "error", "kind": "rate_limit"}
            fallback = math_fallback_text(math_result) if math_result else ""
            return (fallback or "You're sending messages really fast! Take a breath and try again in a minute.", meta)

        history = self.db.get_messages(cid, limit=max(1, self.settings.ai_history_messages))
        ai_messages = [{"role": m["role"], "content": screen_message(m["content"]).redacted_text} for m in history]
        system = build_system_prompt(grade, mode, subject, math_result)
        try:
            reply = self.ai.complete(system, ai_messages)
        except AIError as err:
            log.info("AI unavailable: %s", err)
            meta["ai"] = {"status": "error", "kind": err.kind, "message": err.user_message}
            if math_result and math_result.get("status") not in (None, "error"):
                note = "" if err.kind == "not_configured" else f"\n\n_({err.user_message})_"
                return (math_fallback_text(math_result) + note, meta)
            return (err.user_message, meta)
        meta["ai"] = {"status": "ok", "model": reply.model, "truncated": reply.truncated}
        text = reply.text
        if reply.truncated:
            text += "\n\n_(I ran out of space for this answer. Ask me to continue!)_"
        return text, meta


def _title_from(message: str) -> str:
    title = " ".join(message.split())
    return (title[:57] + "…") if len(title) > 60 else (title or "New mission")
