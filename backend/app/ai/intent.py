"""Deterministic intent routing for chat messages.

The router decides whether a message is a request to open an app, change a
setting, ask a school question, or just chat. It is rule-based on purpose: an
app is only ever launched when the *user's own words* match a launch command
for an allowlisted alias. The AI model never decides to launch anything and
cannot invent app identifiers.

Examples::

    "Open Roblox"                         -> launch (roblox)
    "Jarvis, can you open my calculator?" -> launch (calculator)
    "Open Fortnite"                       -> launch (unknown app -> rejected)
    "How do calculators work?"            -> educational
    "Explain how Roblox games are made"   -> educational
    "What is 8 times 7?"                  -> educational (math)
    "Set my grade to 9"                   -> settings
    "I want to play roblox later"         -> ambiguous launch (asks to confirm)
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum

from app.launcher.registry import all_aliases, resolve_alias
from app.math.detect import MathRequest, detect_math


class IntentType(str, Enum):
    LAUNCH = "launch_intent"
    EDUCATIONAL = "educational_intent"
    SETTINGS = "settings_intent"
    CONVERSATION = "conversation_intent"


@dataclass
class Intent:
    type: IntentType
    app_id: str | None = None           # for LAUNCH: approved id, or None if not on the list
    requested_app: str | None = None    # the name the user said (for messages only)
    confirm_app_id: str | None = None   # suggest a launch the user must confirm with a button
    setting: dict = field(default_factory=dict)
    math: MathRequest | None = None
    subject_hint: str | None = None


_PREFIX = r"^(?:(?:hey|hi|ok|okay|yo)\s+)?(?:jarvis\b[\s,:!.-]*)?(?:(?:please|pls)\s+)?" \
          r"(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:(?:please|pls)\s+)?"
_LAUNCH_VERBS = r"(?:open|launch|start|run|load|fire up|boot up|start up|bring up|play)"
_LAUNCH_RE = re.compile(_PREFIX + _LAUNCH_VERBS + r"\s+(?:up\s+)?(?P<target>.+?)\s*(?:for me)?\s*(?:please)?[.!?]*$",
                        re.IGNORECASE)
_FILLER = re.compile(r"^(?:the|my|a|an|up)\s+", re.IGNORECASE)
_SUFFIX = re.compile(r"\s+(?:app|application|program|now|please)$", re.IGNORECASE)

_GRADE_RE = re.compile(
    _PREFIX + r"(?:set|change|switch|make|put)\s+(?:my\s+|the\s+)?(?:school\s+)?(?:grade|year|level)(?:\s+level)?\s+(?:to\s+)?"
    r"(?:grade\s+)?(?P<grade>\d{1,2})(?:th)?\b",
    re.IGNORECASE,
)
_GRADE_RE2 = re.compile(r"^(?:jarvis[\s,]*)?i(?:'m| am)\s+in\s+(?:grade\s+(?P<g1>\d{1,2})|(?P<g2>\d{1,2})(?:st|nd|rd|th)\s+grade)\b",
                        re.IGNORECASE)
_SETTINGS_WORDS = re.compile(
    _PREFIX + r"(?:(?:turn|switch)\s+(?:on|off)\s+|(?:enable|disable|mute|unmute)\s+)(?:the\s+|my\s+)?"
    r"(?P<what>voice|sound|sounds|sound effects|animations|motion|speech)\b",
    re.IGNORECASE,
)

_SUBJECT_KEYWORDS = {
    "math": ("math", "algebra", "equation", "fraction", "percent", "geometry", "angle", "triangle",
             "trigonometry", "function", "graph", "statistics", "probability", "calculus", "derivative",
             "integral", "number", "multiply", "divide", "sum", "solve"),
    "biology": ("biology", "cell", "dna", "gene", "photosynthesis", "organism", "evolution", "ecosystem", "plant", "animal"),
    "chemistry": ("chemistry", "atom", "molecule", "element", "reaction", "acid", "base", "periodic", "electron", "compound"),
    "physics": ("physics", "force", "energy", "gravity", "velocity", "acceleration", "newton", "wave", "electricity", "magnet", "light"),
    "earth_science": ("earth science", "volcano", "earthquake", "weather", "climate", "rock", "planet", "plate tectonics", "ocean"),
    "science": ("science", "experiment", "scientist", "hypothesis"),
}
_QUESTION = re.compile(r"^(?:what|why|how|when|where|who|which|explain|describe|define|teach|tell me about|help me (?:understand|with)|can you explain|is it true)\b",
                       re.IGNORECASE)


def _clean_target(raw: str) -> str:
    target = raw.strip().strip("\"'").strip()
    for _ in range(3):
        target = _FILLER.sub("", target)
        target = _SUFFIX.sub("", target)
    return target.strip().rstrip(".!?").strip().lower()


def _subject_hint(text: str) -> str | None:
    lowered = text.lower()
    for subject, words in _SUBJECT_KEYWORDS.items():
        if any(re.search(rf"\b{re.escape(w)}", lowered) for w in words):
            return subject
    return None


def classify(message: str) -> Intent:
    text = message.strip()

    m = _GRADE_RE.match(text) or _GRADE_RE2.match(text)
    if m:
        grade_str = m.groupdict().get("grade") or m.groupdict().get("g1") or m.groupdict().get("g2")
        return Intent(IntentType.SETTINGS, setting={"grade": int(grade_str)})
    m = _SETTINGS_WORDS.match(text)
    if m:
        return Intent(IntentType.SETTINGS, setting={"open_settings": m.group("what").lower()})

    m = _LAUNCH_RE.match(text)
    if m:
        raw_target = m.group("target")
        target = _clean_target(raw_target)
        app_id = resolve_alias(target)
        # A launch verb followed by a long phrase is probably not a command
        # ("start learning about fractions"), so only short targets count.
        if app_id is not None:
            return Intent(IntentType.LAUNCH, app_id=app_id, requested_app=target)
        if len(target.split()) <= 3 and not detect_math(target) and not _QUESTION.match(target):
            if not _subject_hint(target):
                return Intent(IntentType.LAUNCH, app_id=None, requested_app=target[:40])

    math = detect_math(text)
    if math is not None:
        return Intent(IntentType.EDUCATIONAL, math=math, subject_hint="math")

    subject = _subject_hint(text)
    lowered = text.lower()
    # Mentioning an app with "play"/"open" somewhere else in the sentence is
    # ambiguous: offer a confirmation button instead of launching.
    if not _QUESTION.match(text) and re.search(r"\b(?:play|open|launch)\b", lowered):
        for alias in all_aliases():
            if re.search(rf"\b{re.escape(alias)}\b", lowered):
                return Intent(IntentType.CONVERSATION, confirm_app_id=resolve_alias(alias), subject_hint=subject)

    if subject or _QUESTION.match(text) or text.endswith("?"):
        return Intent(IntentType.EDUCATIONAL, subject_hint=subject)
    return Intent(IntentType.CONVERSATION, subject_hint=subject)
