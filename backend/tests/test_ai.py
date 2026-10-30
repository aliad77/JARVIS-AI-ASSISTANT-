"""Provider interface (no hosted AI), grade-aware prompts and safety screen. No network, no cost."""

from __future__ import annotations

import pytest

from app.ai.prompts import BASE_INSTRUCTIONS, build_system_prompt, format_math_result
from app.ai.provider import AIError, NoGenerativeAI
from app.ai.safety import screen_message
from app.config import Settings

def test_default_provider_never_calls_a_network_service():
    provider = NoGenerativeAI()
    assert provider.configured is False
    with pytest.raises(AIError) as exc:
        provider.complete("sys", [{"role": "user", "content": "hi"}])
    assert exc.value.kind == "not_configured"
    with pytest.raises(AIError):
        provider.complete_json("sys", "quiz", {"type": "object"})


def test_no_hosted_ai_sdk_is_imported_anywhere():
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "app"
    for path in root.rglob("*.py"):
        text = path.read_text()
        for sdk in ("import anthropic", "import openai", "google.generativeai", "from anthropic", "from openai"):
            assert sdk not in text, f"{path} imports a hosted AI SDK"


def test_settings_have_no_api_key_fields():
    assert not any("key" in name.lower() for name in Settings.model_fields)


# --- prompts -------------------------------------------------------------------

def test_grade_7_prompt_is_simple():
    p = build_system_prompt(7, "explain", "science")
    assert "GRADE 7" in p and "short, simple sentences" in p and "Mode: EXPLAIN" in p


def test_grade_12_prompt_is_advanced():
    p = build_system_prompt(12, "solve", "math")
    assert "GRADE 12" in p and "calculus" in p and "derivations" in p


def test_prompt_contains_child_safety_and_honesty_rules():
    for phrase in ("age-appropriate", "Never invent facts", "CANNOT open apps", "trusted adult", "not sure"):
        assert phrase in BASE_INSTRUCTIONS


def test_math_result_is_passed_and_unverified_flagged():
    text = format_math_result({"status": "verified", "result_latex": "x = 5", "input_latex": "3x+7=22"})
    assert "VERIFIED" in text and "x = 5" in text
    assert "NOT check" in format_math_result({"status": "unsupported", "message": "nope"})


def test_safety_screen():
    assert screen_message("I want to hurt myself").crisis
    r = screen_message("my email is kid@example.com and phone 555 123 4567")
    assert "kid@example.com" not in r.redacted_text and "555 123 4567" not in r.redacted_text
    assert r.personal_info_found
