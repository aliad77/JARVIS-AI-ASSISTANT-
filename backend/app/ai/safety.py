"""Lightweight, local safety screening for a young user.

This is a backstop, not a full moderation system: the model's system
instruction carries most of the age-appropriate behaviour. Two things happen
locally before any text leaves the computer:

1. Messages that suggest the student may be in danger get an immediate,
   caring, deterministic reply (no AI call).
2. Obvious personal data (emails, phone numbers) is redacted before the text
   is sent to the AI provider.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_CRISIS = re.compile(
    r"\b(?:kill(?:ing)? myself|suicid\w*|end my life|want to die|self[- ]?harm\w*|hurt(?:ing)? myself|cut(?:ting)? myself)\b",
    re.IGNORECASE,
)
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE = re.compile(r"(?<!\w)(?:\+?\d[\s().-]?){9,14}\d(?!\w)")

CRISIS_REPLY = (
    "I'm really glad you told me. What you're feeling matters, and you deserve support from a real person "
    "right now. Please talk to a trusted adult — a parent, family member, teacher, or school counselor — "
    "as soon as you can.\n\n"
    "If you might be in danger, contact your local emergency number right away. Many countries also have "
    "free, confidential helplines for young people (for example, in the US you can call or text **988**, "
    "and in the UK you can call **Childline on 0800 1111**).\n\n"
    "I'm an AI study buddy, so I can't give you the help a real person can — but you don't have to go through this alone."
)


@dataclass
class ScreenResult:
    crisis: bool
    redacted_text: str
    personal_info_found: bool


def screen_message(text: str) -> ScreenResult:
    crisis = bool(_CRISIS.search(text))
    redacted = _EMAIL.sub("[email removed]", text)
    redacted = _PHONE.sub("[number removed]", redacted)
    return ScreenResult(crisis=crisis, redacted_text=redacted, personal_info_found=redacted != text)


PERSONAL_INFO_NOTE = (
    "(Quick tip: I hid what looked like an email or phone number before sending your message to the AI. "
    "It's safest not to share personal details online.)"
)
