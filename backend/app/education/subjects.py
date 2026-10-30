"""Supported subjects and tutoring modes."""

from __future__ import annotations

SUBJECTS: dict[str, str] = {
    "general": "General school questions",
    "math": "Mathematics",
    "science": "General science",
    "biology": "Biology",
    "chemistry": "Chemistry",
    "physics": "Physics",
    "earth_science": "Earth science",
}

MATH_TOPICS: dict[str, str] = {
    "arithmetic": "Arithmetic",
    "fractions": "Fractions",
    "percentages": "Percentages",
    "linear_equations": "Linear equations",
    "quadratics": "Quadratic equations",
    "exponents": "Exponents",
    "geometry": "Geometry (area)",
    "statistics": "Statistics (mean)",
}

MODES: dict[str, str] = {
    "chat": "Chat",
    "explain": "Explain",
    "solve": "Solve",
    "practice": "Practice",
    "quiz": "Quiz",
    "homework": "Homework help",
}


def normalise_subject(value: object) -> str:
    return value if isinstance(value, str) and value in SUBJECTS else "general"


def normalise_mode(value: object) -> str:
    return value if isinstance(value, str) and value in MODES else "chat"
