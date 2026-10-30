"""Symbolic math verification built on SymPy.

Every public function here takes *untrusted text*, parses it with the
restricted parser, and returns a plain JSON-serialisable ``dict``. These
functions are executed inside the isolated worker process (see
:mod:`app.math.worker`) so a pathological input cannot stall the web server.

Status values returned to callers:

``verified``     the engine computed the result and checked it
``no_solution``  the engine found no real solution (complex ones may be listed)
``undefined``    the expression is undefined (for example, division by zero)
``unverified``   the engine produced a result it could not check by substitution
``unsupported``  the engine could not handle this problem
``error``        the input could not be parsed
"""

from __future__ import annotations

from typing import Any

import sympy as sp

from app.math.parser import MathParseError, ParsedMath, parse_math

MAX_SOLUTIONS = 10


def _tex(value: sp.Basic) -> str:
    return sp.latex(value)


def _txt(value: sp.Basic) -> str:
    return sp.sstr(value)


def _decimal(value: sp.Expr) -> str | None:
    if not value.is_number or value.is_Integer:
        return None
    try:
        approx = sp.N(value, 10)
    except Exception:  # noqa: BLE001 - numeric evaluation of odd values
        return None
    if approx.is_real is False:
        return None
    text = sp.sstr(approx)
    return text.rstrip("0").rstrip(".") if "." in text else text


def _is_bad(value: sp.Expr) -> bool:
    return value.has(sp.zoo, sp.nan, sp.oo, -sp.oo)


def _is_zero(value: sp.Expr) -> bool | None:
    """Exact zero test with a numeric fallback. ``None`` means unknown."""
    try:
        simplified = sp.simplify(value)
    except Exception:  # noqa: BLE001
        simplified = value
    if simplified == 0:
        return True
    if simplified.is_number:
        try:
            magnitude = abs(complex(sp.N(simplified, 30)))
        except (TypeError, ValueError):
            return None
        return magnitude < 1e-12
    zero = simplified.is_zero
    return zero


def _domain_problem(parsed: ParsedMath, subs: dict[sp.Symbol, sp.Expr]) -> str | None:
    """Return a human explanation if ``subs`` violates a recorded restriction."""
    for den in parsed.nonzero:
        val = den.subs(subs)
        if val.is_number and _is_zero(val):
            return f"it makes a denominator equal to zero ({_txt(den)} = 0), which is undefined"
    for rad in parsed.nonnegative:
        val = sp.N(rad.subs(subs))
        if val.is_number and val.is_real and val < -1e-12:
            return f"it makes a square root of a negative number ({_txt(rad)} < 0)"
    for arg in parsed.positive:
        val = sp.N(arg.subs(subs))
        if val.is_number and val.is_real and val <= 0:
            return f"it makes a logarithm of a number that is not positive ({_txt(arg)} <= 0)"
    return None


def _check_latex(lhs: sp.Expr, rhs: sp.Expr, var: sp.Symbol, cand: sp.Expr,
                 lhs_val: sp.Expr, rhs_val: sp.Expr) -> str:
    """Show the substitution, e.g. ``3 × 5 + 7 = 22``, without letting SymPy pre-evaluate it."""
    def shown(side: sp.Expr, value: sp.Expr) -> str:
        if not side.has(var):
            return _tex(value)
        return f"{sp.latex(side.subs(var, sp.UnevaluatedExpr(cand)), mul_symbol='times')} = {_tex(value)}"
    return rf"\text{{left: }} {shown(lhs, lhs_val)},\quad \text{{right: }} {shown(rhs, rhs_val)}"


def _error(message: str) -> dict[str, Any]:
    return {"status": "error", "message": message}


# ---------------------------------------------------------------------------
# Evaluate
# ---------------------------------------------------------------------------

def _evaluate(parsed: ParsedMath) -> dict[str, Any]:
    value = parsed.lhs
    base = {"kind": "evaluate", "input_latex": _tex(value)}
    problem = _domain_problem(parsed, {})
    if problem:
        return {**base, "status": "undefined", "message": f"This is undefined because {problem}."}
    if _is_bad(value):
        return {**base, "status": "undefined", "message": "This expression is undefined (for example, division by zero)."}
    simplified = sp.nsimplify(sp.simplify(value)) if not value.is_Rational else value
    if simplified.is_real is False:
        return {
            **base,
            "status": "undefined",
            "message": "This has no real-number value (it would need complex numbers).",
            "result_latex": _tex(simplified),
            "result_text": _txt(simplified),
        }
    check = _is_zero(simplified - value)
    return {
        **base,
        "status": "verified" if check else "unverified",
        "result_text": _txt(simplified),
        "result_latex": _tex(simplified),
        "decimal": _decimal(simplified),
        "message": "Calculated exactly by the symbolic math engine." if check else
                   "The engine calculated this but could not double-check the simplification.",
    }


# ---------------------------------------------------------------------------
# Simplify
# ---------------------------------------------------------------------------

def _simplify(parsed: ParsedMath) -> dict[str, Any]:
    expr = parsed.lhs
    simplified = sp.simplify(expr)
    factored = sp.factor(expr)
    expanded = sp.expand(expr)
    ok = _is_zero(simplified - expr)
    return {
        "kind": "simplify",
        "status": "verified" if ok else "unverified",
        "input_latex": _tex(expr),
        "result_text": _txt(simplified),
        "result_latex": _tex(simplified),
        "forms": [
            {"label": "Simplified", "latex": _tex(simplified)},
            {"label": "Factored", "latex": _tex(factored)},
            {"label": "Expanded", "latex": _tex(expanded)},
        ],
        "restrictions": [f"{_txt(d)} ≠ 0" for d in parsed.nonzero if d.free_symbols],
        "message": "Equivalent forms checked by the symbolic engine." if ok else
                   "The engine could not confirm the forms are equivalent.",
    }


# ---------------------------------------------------------------------------
# Solve
# ---------------------------------------------------------------------------

def _pick_variable(parsed: ParsedMath, requested: str | None) -> sp.Symbol | None:
    syms = sorted(parsed.free_symbols, key=lambda s: s.name)
    if requested:
        for s in syms:
            if s.name == requested:
                return s
        return None
    for preferred in ("x", "y", "t", "n"):
        for s in syms:
            if s.name == preferred:
                return s
    return syms[0] if len(syms) == 1 else None


def _linear_steps(lhs: sp.Expr, rhs: sp.Expr, var: sp.Symbol) -> list[dict[str, str]] | None:
    try:
        pl, pr = sp.Poly(lhs, var), sp.Poly(rhs, var)
    except sp.PolynomialError:
        return None
    if max(pl.degree(), pr.degree()) > 1 or (pl - pr).degree() != 1:
        return None
    coeffs = [lhs.coeff(var, 1), lhs.coeff(var, 0), rhs.coeff(var, 1), rhs.coeff(var, 0)]
    if not all(c.is_number for c in coeffs):
        return None
    a1, b1, a2, b2 = (sp.nsimplify(c) for c in coeffs)
    steps = [{"text": "Start with the equation.", "latex": _tex(sp.Eq(lhs, rhs, evaluate=False))}]
    if a2 != 0:
        a1 = a1 - a2
        steps.append({
            "text": f"Subtract {_txt(a2 * var)} from both sides so all the {var} terms are on the left.",
            "latex": _tex(sp.Eq(a1 * var + b1, b2, evaluate=False)),
        })
    if b1 != 0:
        verb = f"Subtract {_txt(b1)} from" if b1 > 0 else f"Add {_txt(-b1)} to"
        b2 = b2 - b1
        steps.append({
            "text": f"{verb} both sides to get the {var} term by itself.",
            "latex": _tex(sp.Eq(a1 * var, b2, evaluate=False)),
        })
    if a1 != 1:
        steps.append({
            "text": f"Divide both sides by {_txt(a1)}.",
            "latex": _tex(sp.Eq(var, b2 / a1, evaluate=False)),
        })
    return steps


def _quadratic_steps(lhs: sp.Expr, rhs: sp.Expr, var: sp.Symbol) -> list[dict[str, str]] | None:
    expr = sp.expand(lhs - rhs)
    try:
        poly = sp.Poly(expr, var)
    except sp.PolynomialError:
        return None
    if poly.degree() != 2 or not all(c.is_number for c in poly.all_coeffs()):
        return None
    a, b, c = poly.all_coeffs()
    steps = [
        {"text": "Start with the equation.", "latex": _tex(sp.Eq(lhs, rhs, evaluate=False))},
        {"text": "Move every term to one side so the other side is 0.", "latex": _tex(sp.Eq(expr, 0, evaluate=False))},
        {"text": f"This is a quadratic with a = {_txt(a)}, b = {_txt(b)}, c = {_txt(c)}.",
         "latex": r"a" + f"{var}^2 + b{var} + c = 0"},
    ]
    factored = sp.factor(expr)
    is_factored = isinstance(factored, sp.Mul) or (isinstance(factored, sp.Pow) and factored.exp == 2)
    if factored != expr and is_factored:
        steps.append({"text": "Factor the left side.", "latex": _tex(sp.Eq(factored, 0, evaluate=False))})
        steps.append({"text": "A product is zero only when one of its factors is zero, so set each factor to 0.",
                      "latex": ""})
    disc = sp.simplify(b**2 - 4 * a * c)
    steps.append({"text": "Find the discriminant D = b² − 4ac. It tells us how many real solutions there are.",
                  "latex": rf"D = ({_tex(b)})^2 - 4({_tex(a)})({_tex(c)}) = {_tex(disc)}"})
    if disc < 0:
        steps.append({"text": "D is negative, so there are no real solutions.", "latex": ""})
    else:
        steps.append({"text": "Use the quadratic formula.",
                      "latex": rf"{var} = \frac{{-b \pm \sqrt{{D}}}}{{2a}} = \frac{{{_tex(-b)} \pm \sqrt{{{_tex(disc)}}}}}{{{_tex(2 * a)}}}"})
    return steps


def _solve(parsed: ParsedMath, requested_var: str | None = None) -> dict[str, Any]:
    lhs, rhs = parsed.lhs, parsed.rhs
    assert rhs is not None
    base: dict[str, Any] = {"kind": "solve", "input_latex": _tex(sp.Eq(lhs, rhs, evaluate=False))}
    restrictions = [f"{_txt(d)} ≠ 0" for d in parsed.nonzero if d.free_symbols]
    if not parsed.free_symbols and parsed.seen_symbols:
        # e.g. "x/x = 1": SymPy simplified the variable away, but the
        # restrictions recorded while parsing still apply.
        if _is_zero(lhs - rhs):
            return {**base, "status": "verified", "identity": True, "steps": [],
                    "result_text": "all real numbers", "result_latex": r"\text{all real numbers}",
                    "restrictions": restrictions,
                    "message": "Both sides are always equal, so every real number works"
                               + (f" as long as {', '.join(restrictions)}." if restrictions else ".")}
        return {**base, "status": "no_solution", "steps": [], "solutions": [],
                "message": "The two sides can never be equal, so there is no solution."}
    if not parsed.free_symbols:
        same = _is_zero(lhs - rhs)
        return {
            **base,
            "kind": "check",
            "status": "verified",
            "is_true": bool(same),
            "result_text": "true" if same else "false",
            "result_latex": r"\text{true}" if same else r"\text{false}",
            "message": "The engine checked whether both sides are equal: "
                       + ("they are." if same else "they are not."),
        }
    var = _pick_variable(parsed, requested_var)
    if var is None:
        names = ", ".join(sorted(s.name for s in parsed.free_symbols))
        return {**base, "status": "unsupported",
                "message": f"This equation has several letters ({names}). Tell me which one to solve for."}
    base["variable"] = var.name
    expr = lhs - rhs
    others = expr.free_symbols - {var}

    if others:
        candidates = sp.solve(sp.Eq(lhs, rhs), var)
        solution_set: sp.Set = sp.FiniteSet(*candidates) if candidates else sp.S.EmptySet
    else:
        solution_set = sp.solveset(expr, var, domain=sp.S.Reals)

    steps = _linear_steps(lhs, rhs, var) or _quadratic_steps(lhs, rhs, var) or []

    if solution_set == sp.S.Reals or (isinstance(solution_set, sp.Interval) and solution_set == sp.S.Reals):
        if _is_zero(expr):
            return {**base, "status": "verified", "steps": steps, "identity": True,
                    "result_text": "all real numbers", "result_latex": r"\text{all real numbers}",
                    "restrictions": [f"{_txt(d)} ≠ 0" for d in parsed.nonzero if d.free_symbols],
                    "message": "Both sides are always equal, so every real number works (except values that make the expression undefined)."}
    if solution_set == sp.S.EmptySet:
        excluded = []
        if parsed.nonzero and not others:
            # Explain candidates that were rejected by a domain restriction.
            numerator = sp.fraction(sp.together(expr))[0]
            raw = sp.solveset(numerator, var, domain=sp.S.Reals)
            if isinstance(raw, sp.FiniteSet) and len(raw) <= MAX_SOLUTIONS:
                for cand in raw:
                    problem = _domain_problem(parsed, {var: cand})
                    if problem:
                        excluded.append({"value_text": _txt(cand), "value_latex": _tex(cand),
                                         "reason": f"Rejected because {problem}."})
        complex_set = sp.solveset(expr, var, domain=sp.S.Complexes) if not others else sp.S.EmptySet
        complex_solutions = []
        if isinstance(complex_set, sp.FiniteSet) and len(complex_set) <= MAX_SOLUTIONS:
            complex_solutions = [{"value_text": _txt(s), "value_latex": _tex(s)} for s in complex_set]
        return {**base, "status": "no_solution", "steps": steps, "solutions": [],
                "complex_solutions": complex_solutions, "excluded": excluded,
                "message": "The symbolic engine found no real-number solutions." +
                           (" There are complex-number solutions (studied in advanced classes)." if complex_solutions else "")}
    if not isinstance(solution_set, sp.FiniteSet):
        if isinstance(solution_set, sp.ConditionSet):
            return {**base, "status": "unsupported", "steps": steps,
                    "message": "The symbolic engine could not solve this equation exactly."}
        return {**base, "status": "unverified", "steps": steps,
                "result_latex": _tex(solution_set), "result_text": _txt(solution_set),
                "message": "The engine found a general (infinite) solution set, but individual values were not checked by substitution."}

    candidates = list(solution_set)
    if len(candidates) > MAX_SOLUTIONS:
        return {**base, "status": "unsupported", "message": "This equation has too many solutions to list."}

    solutions, excluded, all_checked = [], [], True
    for cand in sorted(candidates, key=lambda c: sp.N(c) if c.is_number and c.is_real else 0):
        subs = {var: cand}
        problem = _domain_problem(parsed, subs)
        if problem:
            excluded.append({"value_text": _txt(cand), "value_latex": _tex(cand),
                             "reason": f"Rejected because {problem}."})
            continue
        lhs_val = sp.simplify(lhs.subs(subs))
        rhs_val = sp.simplify(rhs.subs(subs))
        ok = _is_zero(lhs_val - rhs_val)
        if ok is False:
            excluded.append({"value_text": _txt(cand), "value_latex": _tex(cand),
                             "reason": "Rejected because substituting it back does not make both sides equal."})
            continue
        if ok is None:
            all_checked = False
        solutions.append({
            "value_text": _txt(cand),
            "value_latex": _tex(cand),
            "decimal": _decimal(cand),
            "check": {
                "latex": _check_latex(lhs, rhs, var, cand, lhs_val, rhs_val),
                "ok": bool(ok),
            },
        })

    if not solutions:
        return {**base, "status": "no_solution", "steps": steps, "solutions": [], "excluded": excluded,
                "message": "Every candidate the engine found failed the check, so there is no valid real solution."}

    result_latex = ", ".join(rf"{var.name} = {s['value_latex']}" for s in solutions)
    return {
        **base,
        "status": "verified" if all_checked else "unverified",
        "steps": steps,
        "solutions": solutions,
        "excluded": excluded,
        "result_latex": result_latex,
        "result_text": ", ".join(f"{var.name} = {s['value_text']}" for s in solutions),
        "message": ("Each solution was checked by substituting it back into the original equation."
                    if all_checked else "Solutions found, but at least one could not be fully checked."),
    }


# ---------------------------------------------------------------------------
# Public operations (run inside the worker)
# ---------------------------------------------------------------------------

def analyze(text: str, variable: str | None = None) -> dict[str, Any]:
    """Evaluate, simplify, or solve ``text`` depending on its shape."""
    try:
        parsed = parse_math(text)
    except MathParseError as exc:
        return _error(str(exc))
    try:
        if parsed.is_equation:
            return _solve(parsed, variable)
        if parsed.free_symbols:
            return _simplify(parsed)
        return _evaluate(parsed)
    except (NotImplementedError, sp.PolynomialError, ValueError, TypeError, ZeroDivisionError):
        return {"status": "unsupported", "message": "The symbolic engine could not handle this problem."}


def check_answer(expected: str, answer: str) -> dict[str, Any]:
    """Check a student's answer against an expected value or solution list.

    ``expected`` may be a single expression ("3/4") or a comma separated list
    of solutions ("2, -3"). ``answer`` may optionally be written as "x = 5".
    Order does not matter for lists.
    """
    def split(text: str) -> list[str]:
        parts = []
        for chunk in text.replace(" or ", ",").replace(" and ", ",").split(","):
            chunk = chunk.strip()
            if "=" in chunk:
                chunk = chunk.split("=", 1)[1].strip()
            if chunk:
                parts.append(chunk)
        return parts

    try:
        exp_vals = [parse_math(p).lhs for p in split(expected)]
        ans_parts = split(answer)
        if not ans_parts:
            return {"status": "error", "correct": False, "message": "Please type an answer."}
        ans_vals = [parse_math(p).lhs for p in ans_parts]
    except MathParseError as exc:
        return {"status": "error", "correct": False, "message": f"I couldn't read that answer: {exc}"}

    if len(exp_vals) != len(ans_vals):
        return {"status": "verified", "correct": False,
                "message": f"Expected {len(exp_vals)} value(s) but got {len(ans_vals)}."}
    remaining = list(exp_vals)
    for val in ans_vals:
        match = next((e for e in remaining if _is_zero(sp.nsimplify(val) - e)), None)
        if match is None:
            return {"status": "verified", "correct": False, "message": "That answer doesn't match."}
        remaining.remove(match)
    return {"status": "verified", "correct": True, "message": "Correct! The math engine confirmed your answer."}


OPERATIONS = {
    "analyze": analyze,
    "check_answer": check_answer,
}


def dispatch(operation: str, kwargs: dict[str, Any]) -> dict[str, Any]:
    fn = OPERATIONS.get(operation)
    if fn is None:
        return _error("Unknown math operation.")
    return fn(**kwargs)
