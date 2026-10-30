"""Quiz creation and scoring.

* Math quizzes are generated locally; every answer key is computed by SymPy
  (``source = "engine"``).
* Other subjects use the AI provider with a strict JSON schema
  (``source = "ai"``). Those answer keys are AI-generated and are labelled as
  not machine-verified.

Answer keys stay on the server. The browser only receives questions and
choices; scoring happens here.
"""

from __future__ import annotations

import random
import uuid
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, Field, ValidationError, field_validator

from app.education.practice import generate_problem, to_multiple_choice

MIN_QUESTIONS, MAX_QUESTIONS = 3, 10


class QuizQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=400)
    question_latex: str = Field(default="", max_length=300)
    choices: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str = Field(default="", max_length=600)

    @field_validator("choices")
    @classmethod
    def _distinct(cls, value: list[str]) -> list[str]:
        cleaned = [c.strip()[:200] for c in value]
        if any(not c for c in cleaned) or len({c.lower() for c in cleaned}) != len(cleaned):
            raise ValueError("choices must be non-empty and distinct")
        return cleaned


class GeneratedQuiz(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    questions: list[QuizQuestion] = Field(min_length=MIN_QUESTIONS, max_length=MAX_QUESTIONS)


# JSON schema handed to the AI provider (structured output).
AI_QUIZ_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "questions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "question": {"type": "string"},
                    "choices": {"type": "array", "items": {"type": "string"}},
                    "correct_index": {"type": "integer"},
                    "explanation": {"type": "string"},
                },
                "required": ["question", "choices", "correct_index", "explanation"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["title", "questions"],
    "additionalProperties": False,
}


@dataclass
class Quiz:
    id: str
    subject: str
    topic: str
    grade: int
    source: str  # "engine" | "ai"
    title: str
    questions: list[QuizQuestion]

    def public(self) -> dict[str, Any]:
        """The view sent to the browser: no answer keys or explanations."""
        return {
            "id": self.id,
            "subject": self.subject,
            "topic": self.topic,
            "grade": self.grade,
            "source": self.source,
            "verified": self.source == "engine",
            "title": self.title,
            "questions": [
                {"index": i, "question": q.question, "question_latex": q.question_latex, "choices": q.choices}
                for i, q in enumerate(self.questions)
            ],
        }

    def to_storage(self) -> list[dict[str, Any]]:
        return [q.model_dump() for q in self.questions]


def clamp_count(count: object) -> int:
    try:
        n = int(count)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        n = 5
    return max(MIN_QUESTIONS, min(MAX_QUESTIONS, n))


def build_math_quiz(grade: int, topic: str | None, count: int, rng: random.Random | None = None) -> Quiz:
    rng = rng or random.Random()
    questions = []
    seen: set[str] = set()
    attempts = 0
    while len(questions) < count and attempts < count * 10:
        attempts += 1
        problem = to_multiple_choice(generate_problem(topic, grade, rng), rng)
        if problem.latex in seen:
            continue
        seen.add(problem.latex)
        questions.append(QuizQuestion(
            question=problem.prompt,
            question_latex=problem.latex,
            choices=problem.choices,
            correct_index=problem.correct_index,
            explanation=f"The answer is ${problem.answer_latex}$. Hint: {problem.hint}",
        ))
    label = (topic or "mixed").replace("_", " ")
    return Quiz(uuid.uuid4().hex, "math", topic or "mixed", grade, "engine", f"Math mission: {label}", questions)


def parse_ai_quiz(data: object, subject: str, topic: str, grade: int, count: int) -> Quiz:
    """Validate untrusted AI output into a :class:`Quiz` or raise ``ValueError``."""
    try:
        generated = GeneratedQuiz.model_validate(data)
    except ValidationError as exc:
        raise ValueError("The AI returned a quiz in an unexpected format.") from exc
    return Quiz(uuid.uuid4().hex, subject, topic, grade, "ai", generated.title, generated.questions[:count])


def score_quiz(questions: list[QuizQuestion], answers: list[int | None]) -> dict[str, Any]:
    """Score answers (choice indexes; ``None`` = skipped). Pure function."""
    results = []
    correct = 0
    for i, q in enumerate(questions):
        given = answers[i] if i < len(answers) else None
        is_correct = given is not None and given == q.correct_index
        correct += int(is_correct)
        results.append({
            "index": i,
            "given": given,
            "correct_index": q.correct_index,
            "is_correct": is_correct,
            "explanation": q.explanation,
        })
    total = len(questions)
    pct = round(100 * correct / total) if total else 0
    if pct == 100:
        feedback = "PERFECT SCORE! Mission complete, legend!"
    elif pct >= 80:
        feedback = "Great job! You really know this. Check the one you missed and you'll be unstoppable."
    elif pct >= 50:
        feedback = "Nice work! You're getting there. Review the explanations below and try again."
    else:
        feedback = "Every expert started as a beginner. Read the explanations, then let's try another round."
    return {"score": correct, "total": total, "percent": pct, "feedback": feedback, "results": results}
