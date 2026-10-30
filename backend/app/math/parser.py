"""A restricted, hand-written math parser that builds SymPy objects directly.

Why not ``sympify`` / ``parse_expr``? Both ultimately call Python ``eval`` on
the input string, which is unsafe for untrusted text. This parser never
evaluates Python code: it tokenises the input against a strict whitelist and
constructs SymPy expression trees node by node. Anything outside the grammar is
rejected with a :class:`MathParseError`.

Grammar (precedence low -> high)::

    statement := expr ( '=' expr )?
    expr      := term ( ('+' | '-') term )*
    term      := unary ( ('*' | '/') unary | <implicit-multiply> unary )*
    unary     := ('+' | '-') unary | power
    power     := postfix ( '^' unary )?          # right associative
    postfix   := primary ( '!' | '°' )*
    primary   := NUMBER | CONSTANT | VARIABLE
               | FUNCTION '(' expr ')' | '(' expr ')' | '|' expr '|'

Resource limits (input length, token count, nesting depth, literal size,
exponent size, factorial size, result size) keep a single parse cheap. Solving
and simplification additionally run in an isolated worker process with a hard
timeout (see :mod:`app.math.worker`).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

import sympy as sp

MAX_INPUT_LENGTH = 200
MAX_TOKENS = 120
MAX_DEPTH = 25
MAX_INTEGER_DIGITS = 15
MAX_ABS_EXPONENT = 100
MAX_FACTORIAL = 150
MAX_RESULT_BITS = 8000  # ~2400 decimal digits

ALLOWED_VARIABLES = frozenset("abcdfghjkmnpqrstuvwxyz")  # 'e' is Euler's number; i, l, o avoided for clarity

CONSTANTS = {
    "pi": sp.pi,
    "e": sp.E,
}


class MathParseError(ValueError):
    """Raised when input is not an allowed math expression."""


@dataclass
class ParsedMath:
    """Result of parsing: one expression, or an equation lhs = rhs.

    ``conditions`` records domain restrictions collected while parsing,
    *before* SymPy's automatic simplification can hide them (``x/x`` would
    otherwise silently become ``1``).
    """

    lhs: sp.Expr
    rhs: sp.Expr | None = None
    nonzero: list[sp.Expr] = field(default_factory=list)       # denominators
    nonnegative: list[sp.Expr] = field(default_factory=list)   # even-root radicands
    positive: list[sp.Expr] = field(default_factory=list)      # log arguments
    source: str = ""
    seen_symbols: set[sp.Symbol] = field(default_factory=set)  # before auto-simplification

    @property
    def is_equation(self) -> bool:
        return self.rhs is not None

    @property
    def free_symbols(self) -> set[sp.Symbol]:
        syms = set(self.lhs.free_symbols)
        if self.rhs is not None:
            syms |= self.rhs.free_symbols
        return syms


_NORMALISE = [
    ("×", "*"), ("·", "*"), ("⋅", "*"), ("∙", "*"),
    ("÷", "/"), ("∕", "/"),
    ("−", "-"), ("–", "-"), ("—", "-"),
    ("²", "^2"), ("³", "^3"),
    ("√", "sqrt"), ("π", "pi"),
    ("**", "^"),
    ("[", "("), ("]", ")"), ("{", "("), ("}", ")"),
]

_TOKEN_RE = re.compile(
    r"""
    (?P<ws>\s+)
  | (?P<number>\d+(?:\.\d+)?|\.\d+)
  | (?P<ident>[A-Za-z]+)
  | (?P<op>[+\-*/^()=!|,°])
    """,
    re.VERBOSE,
)


@dataclass(frozen=True)
class Token:
    kind: str
    value: str
    pos: int


def normalise(text: str) -> str:
    for old, new in _NORMALISE:
        text = text.replace(old, new)
    return text.strip()


def tokenize(text: str) -> list[Token]:
    if len(text) > MAX_INPUT_LENGTH:
        raise MathParseError(f"That expression is too long (limit {MAX_INPUT_LENGTH} characters).")
    text = normalise(text)
    tokens: list[Token] = []
    pos = 0
    while pos < len(text):
        m = _TOKEN_RE.match(text, pos)
        if not m:
            raise MathParseError(f"I don't understand the symbol '{text[pos]}' in that expression.")
        kind = m.lastgroup
        value = m.group()
        if kind == "number":
            int_part = value.split(".")[0]
            if len(int_part) > MAX_INTEGER_DIGITS or len(value) > MAX_INTEGER_DIGITS + 10:
                raise MathParseError("One of the numbers is too large for me to check safely.")
            tokens.append(Token("number", value, pos))
        elif kind == "ident":
            tokens.extend(_split_identifier(value.lower(), pos))
        elif kind == "op":
            tokens.append(Token("op", value, pos))
        pos = m.end()
        if len(tokens) > MAX_TOKENS:
            raise MathParseError("That expression is too long for me to check safely.")
    if not tokens:
        raise MathParseError("I didn't find a math expression to work with.")
    return tokens


def _split_identifier(word: str, pos: int) -> list[Token]:
    """Resolve an identifier to function/constant names or single-letter variables.

    ``sin`` -> function, ``pi`` -> constant, ``xy`` -> x * y (implicit product),
    ``2ab`` -> 2 * a * b. Unknown words are rejected (no arbitrary names).
    """
    from app.math.functions import FUNCTIONS

    if word in FUNCTIONS:
        return [Token("func", word, pos)]
    if word in CONSTANTS:
        return [Token("const", word, pos)]
    # Allow a word made only of known function/constant prefixes + letters,
    # e.g. "xsin" is rejected (ambiguous) but "xy" is accepted.
    if len(word) <= 4 and all(ch in ALLOWED_VARIABLES or ch == "e" for ch in word):
        out = []
        for offset, ch in enumerate(word):
            if ch == "e":
                out.append(Token("const", "e", pos + offset))
            else:
                out.append(Token("var", ch, pos + offset))
        return out
    raise MathParseError(f"'{word}' isn't a math function or variable I support.")


class _Parser:
    def __init__(self, tokens: list[Token], source: str):
        self.tokens = tokens
        self.i = 0
        self.depth = 0
        self.result = ParsedMath(lhs=sp.Integer(0), source=source)

    # -- helpers -----------------------------------------------------------
    def peek(self) -> Token | None:
        return self.tokens[self.i] if self.i < len(self.tokens) else None

    def take(self) -> Token:
        tok = self.peek()
        if tok is None:
            raise MathParseError("The expression ended too early.")
        self.i += 1
        return tok

    def expect(self, value: str) -> None:
        tok = self.take()
        if tok.value != value:
            raise MathParseError(f"Expected '{value}' but found '{tok.value}'.")

    def enter(self) -> None:
        self.depth += 1
        if self.depth > MAX_DEPTH:
            raise MathParseError("That expression is nested too deeply for me to check safely.")

    def leave(self) -> None:
        self.depth -= 1

    # -- grammar -----------------------------------------------------------
    def statement(self) -> ParsedMath:
        lhs = self.expr()
        rhs = None
        tok = self.peek()
        if tok is not None and tok.value == "=":
            self.take()
            rhs = self.expr()
        if self.peek() is not None:
            raise MathParseError(f"Unexpected '{self.peek().value}' in the expression.")
        self.result.lhs = lhs
        self.result.rhs = rhs
        return self.result

    def expr(self) -> sp.Expr:
        self.enter()
        node = self.term()
        while (tok := self.peek()) is not None and tok.value in "+-" and tok.kind == "op":
            self.take()
            right = self.term()
            node = _check_size(node + right if tok.value == "+" else node - right)
        self.leave()
        return node

    def _starts_primary(self, tok: Token | None) -> bool:
        if tok is None:
            return False
        return tok.kind in ("number", "var", "const", "func") or tok.value == "("

    def term(self) -> sp.Expr:
        node = self.unary()
        while True:
            tok = self.peek()
            if tok is not None and tok.kind == "op" and tok.value in "*/":
                self.take()
                right = self.unary()
                if tok.value == "*":
                    node = _check_size(node * right)
                else:
                    self.result.nonzero.append(right)
                    if right == 0:
                        raise MathParseError("Division by zero is undefined.")
                    node = _check_size(node / right)
            elif self._starts_primary(tok):
                if tok.kind == "number" and self.tokens[self.i - 1].kind == "number":
                    raise MathParseError("Two numbers are next to each other without an operator.")
                right = self.unary()
                node = _check_size(node * right)
            else:
                return node

    def unary(self) -> sp.Expr:
        tok = self.peek()
        if tok is not None and tok.kind == "op" and tok.value in "+-":
            self.take()
            self.enter()
            operand = self.unary()
            self.leave()
            return -operand if tok.value == "-" else operand
        return self.power()

    def power(self) -> sp.Expr:
        base = self.postfix()
        tok = self.peek()
        if tok is not None and tok.value == "^":
            self.take()
            self.enter()
            exponent = self.unary()
            self.leave()
            return _safe_pow(base, exponent, self.result)
        return base

    def postfix(self) -> sp.Expr:
        node = self.primary()
        while (tok := self.peek()) is not None and tok.value in ("!", "°"):
            self.take()
            if tok.value == "!":
                if node.is_number:
                    if not (node.is_integer and node >= 0):
                        raise MathParseError("Factorial needs a whole number that is 0 or more.")
                    if node > MAX_FACTORIAL:
                        raise MathParseError(f"Factorials above {MAX_FACTORIAL}! are too large to check safely.")
                node = sp.factorial(node)
            else:
                node = node * sp.pi / 180
        return node

    def primary(self) -> sp.Expr:
        from app.math.functions import FUNCTIONS

        tok = self.take()
        if tok.kind == "number":
            return sp.Rational(tok.value)  # exact: 0.5 -> 1/2
        if tok.kind == "const":
            return CONSTANTS[tok.value]
        if tok.kind == "var":
            sym = sp.Symbol(tok.value, real=True)
            self.result.seen_symbols.add(sym)
            return sym
        if tok.kind == "func":
            nxt = self.peek()
            if nxt is None or nxt.value != "(":
                raise MathParseError(f"Use brackets with {tok.value}, like {tok.value}(x).")
            self.take()
            self.enter()
            arg = self.expr()
            self.leave()
            self.expect(")")
            return FUNCTIONS[tok.value](arg, self.result)
        if tok.value == "(":
            self.enter()
            node = self.expr()
            self.leave()
            self.expect(")")
            return node
        if tok.value == "|":
            self.enter()
            node = self.expr()
            self.leave()
            self.expect("|")
            return sp.Abs(node)
        raise MathParseError(f"Unexpected '{tok.value}' in the expression.")


def _numeric_bits(value: sp.Expr) -> int:
    if value.is_Rational:
        return max(int(abs(value.p)).bit_length(), int(abs(value.q)).bit_length())
    return 0


def _safe_pow(base: sp.Expr, exponent: sp.Expr, result: ParsedMath) -> sp.Expr:
    if exponent.is_number:
        if exponent.is_real is False:
            raise MathParseError("Complex exponents are not supported.")
        try:
            magnitude = abs(float(exponent))
        except (TypeError, ValueError) as exc:
            raise MathParseError("That exponent is not supported.") from exc
        if magnitude > MAX_ABS_EXPONENT:
            raise MathParseError(f"Exponents larger than {MAX_ABS_EXPONENT} are too big to check safely.")
        if base.is_Rational and _numeric_bits(base) * magnitude > MAX_RESULT_BITS:
            raise MathParseError("That power would make a number too large to check safely.")
        if exponent.is_negative:
            result.nonzero.append(base)
        if exponent.is_Rational and not exponent.is_integer and exponent.q % 2 == 0:
            result.nonnegative.append(base)
    elif not base.is_number or base.free_symbols:
        # Symbolic exponent on a symbolic base (x^x) is beyond school scope.
        raise MathParseError("Variables in both the base and the exponent are not supported.")
    else:
        # numeric base, symbolic exponent such as 2^x: fine.
        pass
    if base == 0 and exponent.is_number and exponent.is_negative:
        raise MathParseError("Zero to a negative power is undefined (it means dividing by zero).")
    return _check_size(sp.Pow(base, exponent))


def _check_size(value: sp.Expr) -> sp.Expr:
    if value.is_Rational and _numeric_bits(value) > MAX_RESULT_BITS:
        raise MathParseError("That number is too large to check safely.")
    if sp.count_ops(value, visual=False) > 400:
        raise MathParseError("That expression is too complicated for me to check safely.")
    return value


def parse_math(text: str) -> ParsedMath:
    """Parse untrusted text into a :class:`ParsedMath`. Never evaluates code."""
    if not isinstance(text, str):
        raise MathParseError("Expected text.")
    tokens = tokenize(text)
    if sum(1 for t in tokens if t.value == "=") > 1:
        raise MathParseError("Please give just one equation with a single '=' sign.")
    return _Parser(tokens, text).statement()
