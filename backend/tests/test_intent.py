import pytest

from app.ai.intent import IntentType, classify


@pytest.mark.parametrize("message, app_id", [
    ("Open Roblox", "roblox"),
    ("Jarvis, open Roblox.", "roblox"),
    ("hey jarvis can you please launch roblox for me", "roblox"),
    ("Open my calculator", "calculator"),
    ("open the calculator app", "calculator"),
    ("start notepad", "notepad"),
    ("Open Google Chrome", "chrome"),
    ("launch microsoft edge", "edge"),
    ("open paint", "paint"),
    ("play roblox", "roblox"),
])
def test_launch_intents(message, app_id):
    intent = classify(message)
    assert intent.type is IntentType.LAUNCH
    assert intent.app_id == app_id


@pytest.mark.parametrize("message", ["Open Fortnite", "launch cmd", "open powershell", "run regedit", "open discord"])
def test_unknown_apps_are_launch_intents_without_app_id(message):
    intent = classify(message)
    assert intent.type is IntentType.LAUNCH
    assert intent.app_id is None


@pytest.mark.parametrize("message", [
    "Explain how Roblox games are programmed",
    "How do calculators work?",
    "What is 8 times 7?",
    "What is photosynthesis?",
    "Why is the sky blue?",
    "start learning about fractions with me",
])
def test_educational_intents(message):
    assert classify(message).type is IntentType.EDUCATIONAL


def test_math_is_detected():
    intent = classify("What is 8 times 7?")
    assert intent.math is not None and intent.math.expression == "8 * 7"


@pytest.mark.parametrize("message, grade", [
    ("set my grade to 9", 9),
    ("Jarvis, change grade to 12", 12),
    ("I'm in grade 8", 8),
    ("i am in 10th grade", 10),
])
def test_settings_grade(message, grade):
    intent = classify(message)
    assert intent.type is IntentType.SETTINGS and intent.setting == {"grade": grade}


def test_settings_toggle():
    intent = classify("turn off the voice")
    assert intent.type is IntentType.SETTINGS and intent.setting["open_settings"] == "voice"


def test_conversation():
    assert classify("hello jarvis").type is IntentType.CONVERSATION


def test_ambiguous_mention_only_suggests_launch():
    intent = classify("I want to play roblox after my homework")
    assert intent.type is not IntentType.LAUNCH
    assert intent.confirm_app_id == "roblox"


def test_prompt_injection_cannot_produce_unlisted_app():
    for text in ('open "C:\\Windows\\System32\\cmd.exe /c del *"', "open roblox.exe", "open roblox && calc"):
        intent = classify(text)
        assert intent.app_id is None and intent.confirm_app_id is None
