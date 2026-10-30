"""Math parser restrictions, verification results, and worker isolation."""

from __future__ import annotations

import time

import pytest
import sympy as sp

from app.math.detect import detect_math
from app.math.engine import analyze, check_answer
from app.math.parser import MathParseError, parse_math
from app.math.worker import MathWorker

# --- parser security ---------------------------------------------------------

MALICIOUS = [
    "__import__('os').system('calc')",
    "exec('print(1)')",
    "eval('2+2')",
    "().__class__.__bases__[0].__subclasses__()",
    "lambda: 1",
    "open('C:/Windows/win.ini')",
    "x.__class__",
    "import os",
    "1; import os",
    "globals()",
    "Symbol('x')",
    "sympify('x')",
    "`ls`",
    "$(whoami)",
    "x @ y",
    "\"2+2\"",
]


@pytest.mark.parametrize("text", MALICIOUS)
def test_parser_rejects_code(text):
    with pytest.raises(MathParseError):
        parse_math(text)


@pytest.mark.parametrize("text", MALICIOUS)
def test_engine_reports_error_for_code(text):
    assert analyze(text)["status"] == "error"


def test_parser_never_calls_eval(monkeypatch):
    import builtins

    def boom(*_a, **_k):
        raise AssertionError("eval/exec must never be called")

    monkeypatch.setattr(builtins, "eval", boom)
    monkeypatch.setattr(builtins, "exec", boom)
    monkeypatch.setattr(sp, "sympify", boom)
    parse_math("3x + 7 = 22")
    parse_math("sqrt(16) + sin(30°) - 2^3 / |−4|")


@pytest.mark.parametrize("text, reason", [
    ("1" * 300, "too long"),
    ("9" * 20, "too large"),
    ("2^1000", "Exponents"),
    ("2^2^2^2^2", "Exponents"),
    ("(99999999^99)^99", "too large"),
    ("1000!", "Factorials"),
    ("(" * 40 + "1" + ")" * 40, "nested"),
    ("x^x", "base and the exponent"),
    ("1/0", "zero"),
    ("0^-1", "undefined"),
    ("2 3", "next to each other"),
    ("x = 1 = 2", "single"),
    ("hello", "isn't a math function"),
])
def test_parser_limits(text, reason):
    with pytest.raises(MathParseError, match=reason):
        parse_math(text)


def test_parser_handles_unicode_and_implicit_multiplication():
    assert parse_math("12 × 8").lhs == 96
    assert parse_math("12 ÷ 4 − 1").lhs == 2
    assert parse_math("2(3+4)").lhs == 14
    x = sp.Symbol("x", real=True)
    assert parse_math("3x").lhs == 3 * x
    assert parse_math("x²").lhs == x**2


def test_decimals_are_exact_fractions():
    assert parse_math("0.1 + 0.2").lhs == sp.Rational(3, 10)


# --- engine results ----------------------------------------------------------

def test_acceptance_b_multiplication():
    r = analyze("12 × 8")
    assert r["status"] == "verified" and r["result_text"] == "96"


def test_acceptance_c_linear_equation_with_steps():
    r = analyze("3x + 7 = 22")
    assert r["status"] == "verified"
    assert [s["value_text"] for s in r["solutions"]] == ["5"]
    assert r["solutions"][0]["check"]["ok"] is True
    assert len(r["steps"]) >= 3
    assert "Subtract 7" in r["steps"][1]["text"]
    assert "Divide both sides by 3" in r["steps"][2]["text"]


def test_multiple_solutions():
    r = analyze("x^2 - 5x + 6 = 0")
    assert r["status"] == "verified"
    assert sorted(s["value_text"] for s in r["solutions"]) == ["2", "3"]


def test_negative_numbers_and_fractions():
    assert analyze("-3 * -4")["result_text"] == "12"
    assert analyze("3/4 + 1/6")["result_text"] == "11/12"
    assert analyze("2x/3 = -4")["result_text"] == "x = -6"


def test_domain_restriction_rejects_extraneous_solution():
    r = analyze("(x^2 - 1)/(x - 1) = 2")
    assert r["status"] == "no_solution"
    assert r["excluded"] and "denominator" in r["excluded"][0]["reason"]


def test_sqrt_has_no_negative_solution():
    assert analyze("sqrt(x) = -2")["status"] == "no_solution"


def test_no_real_solutions_lists_complex():
    r = analyze("x^2 + 1 = 0")
    assert r["status"] == "no_solution"
    assert len(r["complex_solutions"]) == 2


def test_undefined_expressions():
    assert analyze("1/0")["status"] == "error"
    assert analyze("1/(2-2)")["status"] in ("error", "undefined")
    assert analyze("log(-1)")["status"] == "undefined"
    assert analyze("sqrt(-4)")["status"] == "undefined"


def test_identity_keeps_restrictions():
    r = analyze("x/x = 1")
    assert r["status"] == "verified" and r["identity"] is True
    assert r["restrictions"] == ["x ≠ 0"]


def test_trig_degrees():
    assert analyze("sin(30°)")["result_text"] == "1/2"


def test_check_answer():
    assert check_answer("5", "x = 5")["correct"] is True
    assert check_answer("5", "6")["correct"] is False
    assert check_answer("2, 3", "3, 2")["correct"] is True
    assert check_answer("2, 3", "2")["correct"] is False
    assert check_answer("3/4", "0.75")["correct"] is True
    assert check_answer("3/4", "import os")["status"] == "error"


# --- natural language detection ----------------------------------------------

@pytest.mark.parametrize("message, expr, kind", [
    ("What is 12 × 8?", "12 × 8", "evaluate"),
    ("what is 8 times 7", "8 * 7", "evaluate"),
    ("Solve 3x + 7 = 22", "3x + 7 = 22", "solve"),
    ("Jarvis, can you calculate 12 x 8?", "12*8", "evaluate"),
    ("what is 20% of 50", "(20/100)*50", "evaluate"),
    ("3x+7=22", "3x+7=22", "solve"),
])
def test_detect_math(message, expr, kind):
    req = detect_math(message)
    assert req is not None and req.expression == expr and req.kind == kind


@pytest.mark.parametrize("message", ["What is photosynthesis?", "how do calculators work", "open roblox", "solve this riddle"])
def test_detect_math_ignores_non_math(message):
    assert detect_math(message) is None


# --- worker isolation ---------------------------------------------------------

def test_worker_runs_in_subprocess_and_returns_results():
    worker = MathWorker(timeout=30, processes=1)
    try:
        assert worker.analyze("12*8")["result_text"] == "96"
    finally:
        worker.close()


def test_worker_kills_slow_operations(monkeypatch):
    worker = MathWorker(timeout=0.5, processes=1)
    try:
        worker.analyze("1+1")  # warm up the pool (spawn + sympy import)
        start = time.monotonic()
        # time.sleep is not reachable from user input; this simulates a SymPy hang.
        pool = worker._get_pool()
        res = pool.apply_async(time.sleep, (10,))
        worker._reset(pool)
        assert time.monotonic() - start < 5
        with pytest.raises(Exception):
            res.get(timeout=0.1)
        # The worker recovers with a fresh pool.
        assert worker.analyze("2+2")["result_text"] == "4"
    finally:
        worker.close()


def test_worker_timeout_returns_friendly_result(monkeypatch):
    worker = MathWorker(timeout=0.01, processes=1)
    try:
        r = worker.analyze("x^2 - 5x + 6 = 0")  # cold start alone exceeds 10 ms
        assert r["status"] == "unsupported" and "too long" in r["message"]
    finally:
        worker.close()
