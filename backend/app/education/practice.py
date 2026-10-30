"""Locally generated, engine-verified math practice problems.

These problems do not need the AI service: values are generated with a
random number generator and the correct answer is computed by SymPy, so every
answer key is exact.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field

import sympy as sp

from app.education.grades import normalise_grade

x = sp.Symbol("x", real=True)


@dataclass
class MathProblem:
    topic: str
    prompt: str            # plain-language question
    latex: str             # the math part, for KaTeX
    expected: str          # answer in parser syntax, e.g. "5" or "2, 3" or "3/4"
    answer_latex: str
    hint: str
    choices: list[str] = field(default_factory=list)  # LaTeX strings for multiple choice
    correct_index: int = 0


def _fmt(value: sp.Expr) -> str:
    return sp.sstr(value)


def _scale(grade: int) -> int:
    return {7: 12, 8: 15, 9: 20, 10: 25, 11: 30, 12: 40}[grade]


def _arithmetic(rng: random.Random, grade: int) -> MathProblem:
    top = _scale(grade)
    a, b = rng.randint(2, top), rng.randint(2, top)
    op = rng.choice(["*", "+", "-"] + (["neg"] if grade >= 8 else []))
    if op == "neg":
        a = -a
        expr = sp.Mul(a, b)
        latex = f"({a}) \\times {b}"
        hint = "A negative times a positive is negative."
    elif op == "*":
        expr = sp.Integer(a) * b
        latex = f"{a} \\times {b}"
        hint = "Break one number into tens and ones, multiply each part, then add."
    elif op == "+":
        a, b = a * 7, b * 9
        expr = sp.Integer(a) + b
        latex = f"{a} + {b}"
        hint = "Add the ones, then the tens, then the hundreds."
    else:
        a, b = a * 9, b * 4
        expr = sp.Integer(a) - b
        latex = f"{a} - {b}"
        hint = "If the answer would go below zero, the result is negative."
    return MathProblem("arithmetic", "Calculate:", latex, _fmt(expr), sp.latex(expr), hint)


def _fractions(rng: random.Random, grade: int) -> MathProblem:
    d1, d2 = rng.choice([2, 3, 4, 5, 6, 8]), rng.choice([2, 3, 4, 5, 6, 10])
    n1, n2 = rng.randint(1, d1 - 1) if d1 > 1 else 1, rng.randint(1, d2 - 1) if d2 > 1 else 1
    f1, f2 = sp.Rational(n1, d1), sp.Rational(n2, d2)
    op = rng.choice(["+", "-", "*"] + (["/"] if grade >= 8 else []))
    value = {"+": f1 + f2, "-": f1 - f2, "*": f1 * f2, "/": f1 / f2}[op]
    tex_op = {"+": "+", "-": "-", "*": "\\times", "/": "\\div"}[op]
    hints = {
        "+": "Find a common denominator, then add the numerators.",
        "-": "Find a common denominator, then subtract the numerators.",
        "*": "Multiply the tops together and the bottoms together, then simplify.",
        "/": "Dividing by a fraction is the same as multiplying by its reciprocal (flip it).",
    }
    latex = f"\\frac{{{n1}}}{{{d1}}} {tex_op} \\frac{{{n2}}}{{{d2}}}"
    return MathProblem("fractions", "Calculate and simplify:", latex, _fmt(value), sp.latex(value), hints[op])


def _percentages(rng: random.Random, grade: int) -> MathProblem:
    pct = rng.choice([5, 10, 15, 20, 25, 30, 40, 50, 75] + ([12, 35, 65] if grade >= 9 else []))
    base = rng.choice([20, 40, 60, 80, 120, 200, 250, 360, 400])
    value = sp.Rational(pct, 100) * base
    return MathProblem("percentages", f"What is {pct}% of {base}?", f"{pct}\\% \\times {base}", _fmt(value),
                       sp.latex(value), "Percent means 'out of 100'. Change the percent to a decimal or fraction, then multiply.")


def _linear(rng: random.Random, grade: int) -> MathProblem:
    sol = rng.randint(-9 if grade >= 8 else 1, 12)
    a = rng.choice([2, 3, 4, 5, 6, 7] + ([-2, -3, -5] if grade >= 9 else []))
    b = rng.randint(-15, 20)
    c = a * sol + b
    lhs = a * x + b
    if grade >= 9 and rng.random() < 0.5:
        k = rng.choice([1, 2, 3])
        lhs, rhs = lhs + k * x, c + k * x
        latex = f"{sp.latex(lhs)} = {sp.latex(rhs)}"
    else:
        latex = f"{sp.latex(lhs)} = {c}"
    return MathProblem("linear_equations", "Solve for x:", latex, str(sol), f"x = {sol}",
                       "Undo the adding or subtracting first, then undo the multiplying by dividing both sides.")


def _quadratic(rng: random.Random, grade: int) -> MathProblem:
    r1, r2 = rng.randint(-7, 7), rng.randint(-7, 7)
    expr = sp.expand((x - r1) * (x - r2))
    roots = sorted({r1, r2})
    expected = ", ".join(str(r) for r in roots)
    return MathProblem("quadratics", "Solve for x (give every solution, separated by commas):",
                       f"{sp.latex(expr)} = 0", expected, ", ".join(f"x = {r}" for r in roots),
                       "Look for two numbers that multiply to the constant term and add to the x coefficient.")


def _exponents(rng: random.Random, grade: int) -> MathProblem:
    base = rng.randint(2, 6)
    e1, e2 = rng.randint(1, 4), rng.randint(1, 3)
    if grade >= 9 and rng.random() < 0.4:
        value = sp.Integer(base) ** (e1 - e2 - 1)
        latex = f"\\frac{{{base}^{{{e1}}}}}{{{base}^{{{e2 + 1}}}}}"
        hint = "When dividing powers with the same base, subtract the exponents."
    else:
        value = sp.Integer(base) ** (e1 + e2)
        latex = f"{base}^{{{e1}}} \\times {base}^{{{e2}}}"
        hint = "When multiplying powers with the same base, add the exponents."
    return MathProblem("exponents", "Calculate:", latex, _fmt(value), sp.latex(value), hint)


def _geometry(rng: random.Random, grade: int) -> MathProblem:
    if rng.random() < 0.5:
        w, h = rng.randint(3, 15), rng.randint(3, 15)
        return MathProblem("geometry", f"A rectangle is {w} cm wide and {h} cm tall. What is its area in cm²?",
                           f"A = {w} \\times {h}", str(w * h), f"{w * h}", "Area of a rectangle = width × height.")
    b, h = rng.randint(2, 14) * 2, rng.randint(3, 12)
    value = sp.Rational(b * h, 2)
    return MathProblem("geometry", f"A triangle has base {b} cm and height {h} cm. What is its area in cm²?",
                       f"A = \\tfrac{{1}}{{2}} \\times {b} \\times {h}", _fmt(value), sp.latex(value),
                       "Area of a triangle = ½ × base × height.")


def _statistics(rng: random.Random, grade: int) -> MathProblem:
    n = rng.choice([4, 5])
    values = [rng.randint(1, 20) for _ in range(n)]
    mean = sp.Rational(sum(values), n)
    data = ", ".join(str(v) for v in values)
    return MathProblem("statistics", f"Find the mean of these numbers: {data}",
                       f"\\text{{mean}} = \\frac{{{' + '.join(map(str, values))}}}{{{n}}}", _fmt(mean), sp.latex(mean),
                       "Add all the numbers, then divide by how many numbers there are.")


GENERATORS = {
    "arithmetic": _arithmetic,
    "fractions": _fractions,
    "percentages": _percentages,
    "linear_equations": _linear,
    "quadratics": _quadratic,
    "exponents": _exponents,
    "geometry": _geometry,
    "statistics": _statistics,
}

GRADE_TOPICS = {
    7: ["arithmetic", "fractions", "percentages", "linear_equations", "geometry", "statistics"],
    8: ["arithmetic", "fractions", "percentages", "linear_equations", "exponents", "geometry", "statistics"],
    9: ["fractions", "percentages", "linear_equations", "quadratics", "exponents", "statistics"],
    10: ["linear_equations", "quadratics", "exponents", "geometry", "statistics", "percentages"],
    11: ["linear_equations", "quadratics", "exponents", "statistics"],
    12: ["linear_equations", "quadratics", "exponents", "statistics"],
}


def generate_problem(topic: str | None, grade: object, rng: random.Random | None = None) -> MathProblem:
    g = normalise_grade(grade)
    rng = rng or random.Random()
    if topic not in GENERATORS:
        topic = rng.choice(GRADE_TOPICS[g])
    return GENERATORS[topic](rng, g)


def _distractors(expected: str, rng: random.Random) -> list[sp.Expr]:
    # Answer keys are always exact rationals produced by this module.
    value = sp.Rational(expected.split(",")[0].strip())
    pool: list[sp.Expr] = [-value if value != 0 else sp.Integer(1), value + 1, value - 1, value * 2, value + 10,
                           value - 2, value + sp.Rational(1, 2)]
    if value.q != 1:  # fraction: swap numerator and denominator
        pool.append(sp.Rational(value.q, value.p) if value.p else sp.Integer(2))
    out: list[sp.Expr] = []
    rng.shuffle(pool)
    for cand in pool:
        if cand != value and cand not in out:
            out.append(cand)
        if len(out) == 3:
            break
    return out


def to_multiple_choice(problem: MathProblem, rng: random.Random | None = None) -> MathProblem:
    """Attach 4 choices (1 correct, 3 distinct distractors) to a problem."""
    rng = rng or random.Random()
    parts = [p.strip() for p in problem.expected.split(",")]
    if len(parts) > 1:
        roots = [sp.Rational(p) for p in parts]
        correct = ", ".join(f"x = {sp.latex(r)}" for r in roots)
        options = {correct}
        fakes = [[-r for r in roots], [r + 1 for r in roots], [r * 2 for r in roots], [roots[0], -roots[-1]]]
        for fake in fakes:
            fake_sorted = sorted(set(fake))
            if fake_sorted != sorted(roots):
                options.add(", ".join(f"x = {sp.latex(r)}" for r in fake_sorted))
            if len(options) == 4:
                break
        choices = list(options)
        while len(choices) < 4:
            choices.append(f"x = {len(choices) + 10}")
    else:
        correct_val = sp.Rational(parts[0])
        correct = sp.latex(correct_val) if problem.topic != "linear_equations" else f"x = {sp.latex(correct_val)}"
        prefix = "x = " if problem.topic == "linear_equations" else ""
        choices = [correct] + [prefix + sp.latex(d) for d in _distractors(parts[0], rng)]
    rng.shuffle(choices)
    problem.choices = choices
    problem.correct_index = choices.index(correct)
    return problem
