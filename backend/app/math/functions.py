"""Whitelisted math functions for the restricted parser.

Each entry maps a lowercase name to a builder ``(arg, parsed) -> sympy.Expr``.
Builders record domain restrictions on ``parsed`` so solutions can later be
checked against them (for example, ``sqrt(x - 3)`` requires ``x - 3 >= 0``).
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Callable

import sympy as sp

if TYPE_CHECKING:
    from app.math.parser import ParsedMath


def _sqrt(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.nonnegative.append(arg)
    return sp.sqrt(arg)


def _cbrt(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    return sp.real_root(arg, 3)


def _log10(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.positive.append(arg)
    return sp.log(arg, 10)


def _ln(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.positive.append(arg)
    return sp.log(arg)


def _tan(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.nonzero.append(sp.cos(arg))
    return sp.tan(arg)


def _asin(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.nonnegative.append(1 - arg**2)
    return sp.asin(arg)


def _acos(arg: sp.Expr, parsed: "ParsedMath") -> sp.Expr:
    parsed.nonnegative.append(1 - arg**2)
    return sp.acos(arg)


def _simple(fn: Callable[[sp.Expr], sp.Expr]) -> Callable[[sp.Expr, "ParsedMath"], sp.Expr]:
    return lambda arg, parsed: fn(arg)


FUNCTIONS: dict[str, Callable[[sp.Expr, "ParsedMath"], sp.Expr]] = {
    "sqrt": _sqrt,
    "cbrt": _cbrt,
    "sin": _simple(sp.sin),
    "cos": _simple(sp.cos),
    "tan": _tan,
    "asin": _asin,
    "arcsin": _asin,
    "acos": _acos,
    "arccos": _acos,
    "atan": _simple(sp.atan),
    "arctan": _simple(sp.atan),
    "log": _log10,
    "ln": _ln,
    "exp": _simple(sp.exp),
    "abs": _simple(sp.Abs),
}
