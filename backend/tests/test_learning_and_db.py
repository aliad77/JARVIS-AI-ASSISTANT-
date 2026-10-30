"""Quiz scoring, practice generation, and database operations."""

from __future__ import annotations

import random

import pytest

from app.database.db import Database
from app.database.preferences import PreferenceStore
from app.education.practice import GENERATORS, generate_problem, to_multiple_choice
from app.education.quiz import QuizQuestion, build_math_quiz, parse_ai_quiz, score_quiz
from app.math.engine import check_answer


def q(correct):
    return QuizQuestion(question="Q1?", choices=["a", "b", "c", "d"], correct_index=correct, explanation="because")


def test_score_quiz():
    result = score_quiz([q(0), q(1), q(2), q(3)], [0, 1, None, 0])
    assert result["score"] == 2 and result["total"] == 4 and result["percent"] == 50
    assert [r["is_correct"] for r in result["results"]] == [True, True, False, False]


def test_score_perfect_and_short_answer_list():
    assert score_quiz([q(1), q(2)], [1, 2])["percent"] == 100
    assert score_quiz([q(1), q(2)], [1])["score"] == 1


@pytest.mark.parametrize("topic", sorted(GENERATORS))
@pytest.mark.parametrize("grade", [7, 9, 12])
def test_practice_answer_keys_are_engine_verified(topic, grade):
    rng = random.Random(grade * 100 + len(topic))
    for _ in range(5):
        p = generate_problem(topic, grade, rng)
        assert check_answer(p.expected, p.expected)["correct"] is True


@pytest.mark.parametrize("seed", range(20))
def test_multiple_choice_has_four_distinct_options_and_one_answer(seed):
    rng = random.Random(seed)
    p = to_multiple_choice(generate_problem(None, 7 + seed % 6, rng), rng)
    assert len(p.choices) == 4 and len(set(p.choices)) == 4
    assert 0 <= p.correct_index < 4


def test_math_quiz_build():
    quiz = build_math_quiz(8, "fractions", 5, random.Random(1))
    assert quiz.source == "engine" and len(quiz.questions) == 5
    public = quiz.public()
    assert public["verified"] is True
    assert all("correct_index" not in qq and "explanation" not in qq for qq in public["questions"])


def test_ai_quiz_validation_rejects_bad_output():
    good = {"title": "Cells", "questions": [
        {"question": f"Q{i}?", "choices": ["a", "b", "c", "d"], "correct_index": 1, "explanation": "x"} for i in range(3)]}
    assert parse_ai_quiz(good, "biology", "cells", 7, 3).source == "ai"
    for bad in [
        {"title": "x", "questions": []},
        {"title": "x", "questions": [{"question": "Q?", "choices": ["a", "a", "b", "c"], "correct_index": 0}] * 3},
        {"title": "x", "questions": [{"question": "Q?", "choices": ["a", "b", "c", "d"], "correct_index": 9}] * 3},
        "not even json",
    ]:
        with pytest.raises(ValueError):
            parse_ai_quiz(bad, "biology", "cells", 7, 3)


# --- database ------------------------------------------------------------------

@pytest.fixture
def db():
    d = Database(":memory:")
    yield d
    d.close()


def test_conversation_crud(db):
    conv = db.create_conversation("Fractions help", 7, "math")
    db.add_message(conv["id"], "user", "hi")
    db.add_message(conv["id"], "assistant", "hello", {"intent": "conversation_intent"})
    msgs = db.get_messages(conv["id"])
    assert [m["role"] for m in msgs] == ["user", "assistant"]
    assert msgs[1]["meta"]["intent"] == "conversation_intent"
    assert db.list_conversations()[0]["message_count"] == 2
    assert db.delete_conversation(conv["id"]) is True
    assert db.get_messages(conv["id"]) == []  # cascade


def test_history_limit_returns_latest_in_order(db):
    conv = db.create_conversation("t", 7, "general")
    for i in range(10):
        db.add_message(conv["id"], "user", f"m{i}")
    assert [m["content"] for m in db.get_messages(conv["id"], limit=3)] == ["m7", "m8", "m9"]


def test_sql_injection_is_inert(db):
    conv = db.create_conversation("x'); DROP TABLE messages; --", 7, "general")
    db.add_message(conv["id"], "user", "'; DELETE FROM conversations; --")
    assert db.get_conversation(conv["id"]) is not None
    assert db.get_messages(conv["id"])[0]["content"].startswith("';")


def test_clear_all(db):
    for _ in range(3):
        db.create_conversation("t", 7, "general")
    assert db.clear_conversations() == 3


def test_history_persists_across_restart(tmp_path):
    path = tmp_path / "jarvis.sqlite3"
    first = Database(path)
    conv = first.create_conversation("Persist me", 9, "physics")
    first.add_message(conv["id"], "user", "What is velocity?")
    first.close()
    second = Database(path)
    assert second.get_conversation(conv["id"])["title"] == "Persist me"
    assert second.get_messages(conv["id"])[0]["content"] == "What is velocity?"
    second.close()


def test_preferences_validation_and_persistence(db):
    store = PreferenceStore(db)
    assert store.get().grade == 7
    store.update({"grade": 11, "voice_rate": 1.5, "apps_enabled": {"chrome": False}})
    prefs = store.get()
    assert prefs.grade == 11 and prefs.voice_rate == 1.5
    assert prefs.apps_enabled["chrome"] is False and prefs.apps_enabled["roblox"] is True
    for bad in ({"grade": 6}, {"voice_rate": 9}, {"apps_enabled": {"cmd": True}}, {"subject": "hacking"}):
        with pytest.raises(ValueError):
            store.update(bad)


def test_progress_and_quiz_attempts(db):
    db.save_quiz("a" * 32, "math", "fractions", 7, "engine", "Quiz", [q(0).model_dump()])
    db.add_quiz_attempt("a" * 32, "math", 7, 1, 1, [0])
    db.add_quiz_attempt("a" * 32, "math", 7, 0, 1, [2])
    prog = db.get_progress()[0]
    assert prog["correct"] == 1 and prog["attempted"] == 2
    assert len(db.list_quiz_attempts()) == 2


def test_ai_usage_counter(db):
    assert db.ai_requests_today() == 0
    db.record_ai_usage(10, 20)
    db.record_ai_usage(1, 2)
    assert db.ai_usage_today() == {"requests": 2, "input_tokens": 11, "output_tokens": 22}
