"""Find a checkable math problem inside a natural-language chat message.

Example: ``"What is 12 × 8?"`` -> ``"12*8"``; ``"Solve 3x + 7 = 22"`` ->
``"3x + 7 = 22"``. Detection is deliberately conservative: if the extracted
text does not parse with the restricted parser, no math request is returned
and the message is handled purely as a conversation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.math.parser import MAX_INPUT_LENGTH, MathParseError, parse_math

_TRIGGER = re.compile(
    r"^(?:(?:hey|ok|okay)\s+)?(?:jarvis[\s,:]+)?(?:please\s+)?(?:can you\s+|could you\s+|help me\s+)?(?:please\s+)?"
    r"(?P<verb>solve|evaluate|calculate|compute|simplify|work out|what\s+is|what's|whats|how much is|find)\s+"
    r"(?:for\s+(?P<var>[a-z])\s*(?:in|:|,)?\s*)?(?P<body>.+)$",
    re.IGNORECASE,
)

_WORDS = [
    (r"\bmultiplied by\b", "*"),
    (r"\btimes\b", "*"),
    (r"\bplus\b", "+"),
    (r"\bminus\b", "-"),
    (r"\bdivided by\b", "/"),
    (r"\bover\b", "/"),
    (r"\bsquared\b", "^2"),
    (r"\bcubed\b", "^3"),
    (r"\bto the power of\b", "^"),
    (r"\bequals\b", "="),
    (r"\bis equal to\b", "="),
]

_MATHY = re.compile(r"^[\d\s+\-*/^().=a-z×÷−·√π²³!|°,%]+$", re.IGNORECASE)


@dataclass(frozen=True)
class MathRequest:
    expression: str
    kind: str  # "solve" | "evaluate" | "simplify"
    variable: str | None = None


def _clean(body: str) -> str:
    body = body.strip().rstrip("?.!").strip()
    body = re.sub(r"\s+for\s+([a-z])$", "", body, flags=re.IGNORECASE)
    for pattern, repl in _WORDS:
        body = re.sub(pattern, f" {repl} ", body, flags=re.IGNORECASE)
    # "square root of 49" -> sqrt(49)
    body = re.sub(r"\bsquare root of\s+([\d.]+|[a-z])\b", r"sqrt(\1)", body, flags=re.IGNORECASE)
    # "20% of 50" -> (20/100)*50 ; a lone "15%" -> (15/100)
    body = re.sub(r"([\d.]+)\s*%\s*of\s+", r"(\1/100)*", body, flags=re.IGNORECASE)
    body = re.sub(r"([\d.]+)\s*%", r"(\1/100)", body)
    if "=" not in body:
        # "12 x 8" means multiplication when there is no equation
        body = re.sub(r"(?<=\d)\s*[xX]\s*(?=\d)", "*", body)
    return re.sub(r"\s+", " ", body).strip()


def detect_math(message: str) -> MathRequest | None:
    text = message.strip()
    if not text or len(text) > 400:
        return None
    match = _TRIGGER.match(text)
    if match:
        body = _clean(match.group("body"))
        verb = match.group("verb").lower()
        var = match.group("var")
    elif _MATHY.match(text) and re.search(r"\d", text) and re.search(r"[+\-*/^=×÷−]", text):
        body, verb, var = _clean(text), "evaluate", None
    else:
        return None

    if not body or len(body) > MAX_INPUT_LENGTH or not re.search(r"[\d]", body):
        return None
    if not _MATHY.match(body):
        return None
    try:
        parsed = parse_math(body)
    except MathParseError:
        return None
    if parsed.is_equation:
        kind = "solve"
    elif parsed.free_symbols:
        kind = "simplify"
    else:
        kind = "evaluate"
    # "What is x?" style questions with nothing to compute are not math requests
    if kind == "simplify" and verb.startswith("what") and len(parsed.free_symbols) == len(body.replace(" ", "")):
        return None
    return MathRequest(expression=body, kind=kind, variable=var.lower() if var else None)
