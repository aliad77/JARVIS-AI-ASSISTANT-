"""Grade-level profiles (grades 7-12) that shape how JARVIS explains things."""

from __future__ import annotations

from dataclasses import dataclass

SUPPORTED_GRADES = (7, 8, 9, 10, 11, 12)
DEFAULT_GRADE = 7


@dataclass(frozen=True)
class GradeProfile:
    grade: int
    typical_age: str
    sentence_style: str
    vocabulary: str
    math_scope: str
    science_scope: str
    depth: str


GRADE_PROFILES: dict[int, GradeProfile] = {
    7: GradeProfile(
        7, "12-13",
        "Use short, simple sentences (mostly under 15 words). One idea per sentence.",
        "Use everyday words. Whenever a science or math word appears, explain it right away in plain language.",
        "arithmetic, fractions, decimals, ratios, percentages, integers, simple one-step and two-step equations, area and perimeter",
        "cells, simple ecosystems, states of matter, forces and motion basics, the water cycle, Earth's layers",
        "Focus on the main idea with one concrete, real-life example. Avoid formal proofs and heavy notation.",
    ),
    8: GradeProfile(
        8, "13-14",
        "Use short, clear sentences. Break explanations into small numbered steps.",
        "Introduce key vocabulary gently and define each new term.",
        "linear equations, slope, the Pythagorean theorem, exponents and scientific notation, basic statistics, volume",
        "atoms and elements, chemical vs physical changes, energy, waves, genetics basics, plate tectonics",
        "Give the idea, one worked example, and a quick check-for-understanding question.",
    ),
    9: GradeProfile(
        9, "14-15",
        "Use clear sentences of moderate length. Use numbered steps for procedures.",
        "Use correct subject vocabulary and define less common terms.",
        "Algebra I: linear functions, systems of equations, inequalities, polynomials, factoring, quadratics, intro probability",
        "biology (cells, DNA, evolution), intro chemistry (atomic structure, the periodic table), intro physics (motion, forces)",
        "Explain why each step works, not just how. Connect to earlier ideas.",
    ),
    10: GradeProfile(
        10, "15-16",
        "Use well-structured explanations with headings or steps when helpful.",
        "Use precise subject vocabulary.",
        "geometry (proofs, similarity, trigonometric ratios), quadratic functions, exponential functions, statistics",
        "chemistry (bonding, reactions, stoichiometry, moles), biology (genetics, ecology), physics (energy, momentum)",
        "Include reasoning and justification. Mention common mistakes to avoid.",
    ),
    11: GradeProfile(
        11, "16-17",
        "Use precise, structured explanations; longer sentences are fine.",
        "Use formal terminology and standard notation.",
        "Algebra II and precalculus: functions and transformations, logarithms, trigonometric functions and identities, sequences, probability",
        "physics (kinematics, Newton's laws, circuits, waves), chemistry (equilibrium, acids and bases, gas laws), biology (molecular biology)",
        "Give rigorous reasoning, connect representations (equations, graphs, tables), and note assumptions and limitations.",
    ),
    12: GradeProfile(
        12, "17-18",
        "Use precise, well-organised explanations at an advanced high-school level.",
        "Use formal terminology, standard notation, and mathematical language confidently.",
        "precalculus and introductory calculus (limits, derivatives, basic integrals), statistics and probability distributions",
        "advanced physics (energy, fields, modern physics intro), chemistry (thermochemistry, kinetics), biology (biochemistry, genetics)",
        "Give full derivations where useful, discuss edge cases, domain restrictions, and how ideas connect to university-level topics.",
    ),
}


def normalise_grade(value: object) -> int:
    try:
        grade = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return DEFAULT_GRADE
    return grade if grade in SUPPORTED_GRADES else DEFAULT_GRADE


def profile_for(grade: object) -> GradeProfile:
    return GRADE_PROFILES[normalise_grade(grade)]
