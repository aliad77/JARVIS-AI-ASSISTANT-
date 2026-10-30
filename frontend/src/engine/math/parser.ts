/**
 * Restricted math parser (TypeScript port of backend/app/math/parser.py).
 *
 * It never evaluates code: input is tokenised against a strict whitelist and
 * turned into a small AST. There is no `eval`, `Function`, or general-purpose
 * expression library. Anything outside the grammar throws MathParseError.
 *
 * Grammar (low -> high precedence):
 *   statement := expr ('=' expr)?
 *   expr      := term (('+'|'-') term)*
 *   term      := unary (('*'|'/') unary | implicit unary)*
 *   unary     := ('+'|'-') unary | power
 *   power     := postfix ('^' unary)?
 *   postfix   := primary ('!' | '°')*
 *   primary   := NUMBER | CONST | VAR | FUNC '(' expr ')' | '(' expr ')' | '|' expr '|'
 */
import type { FnName, Node, Parsed } from "./ast";
import { constValue } from "./evaluate";
import { Rational } from "./rational";

export const LIMITS = {
  inputLength: 200,
  tokens: 120,
  depth: 25,
  integerDigits: 15,
  absExponent: 100,
  factorial: 150,
  nodes: 400,
  resultBits: 8000,
};

export class MathParseError extends Error {}

const FUNCTIONS: Record<string, FnName> = {
  sqrt: "sqrt", cbrt: "cbrt", sin: "sin", cos: "cos", tan: "tan",
  asin: "asin", arcsin: "asin", acos: "acos", arccos: "acos", atan: "atan", arctan: "atan",
  log: "log", ln: "ln", exp: "exp", abs: "abs",
};
const CONSTANTS = new Set(["pi", "e"]);
// 'e' is Euler's number; i, l, o are avoided because they're easy to misread.
const VARIABLES = new Set("abcdfghjkmnpqrstuvwxyz".split(""));

const NORMALISE: [RegExp, string][] = [
  [/[×·⋅∙]/g, "*"], [/[÷∕]/g, "/"], [/[−–—]/g, "-"], [/²/g, "^2"], [/³/g, "^3"],
  [/√/g, "sqrt"], [/π/g, "pi"], [/\*\*/g, "^"], [/[[{]/g, "("], [/[\]}]/g, ")"],
];

type Tok = { kind: "num" | "var" | "const" | "func" | "op"; value: string };

export function normalise(text: string): string {
  let out = text;
  for (const [re, rep] of NORMALISE) out = out.replace(re, rep);
  return out.trim();
}

function splitIdent(word: string): Tok[] {
  if (word in FUNCTIONS) return [{ kind: "func", value: FUNCTIONS[word] }];
  if (CONSTANTS.has(word)) return [{ kind: "const", value: word }];
  if (word.length <= 4 && [...word].every((c) => VARIABLES.has(c) || c === "e")) {
    return [...word].map((c) => (c === "e" ? { kind: "const", value: "e" } : { kind: "var", value: c }));
  }
  throw new MathParseError(`'${word}' isn't a math function or variable I support.`);
}

export function tokenize(raw: string): Tok[] {
  if (typeof raw !== "string") throw new MathParseError("Expected text.");
  if (raw.length > LIMITS.inputLength) {
    throw new MathParseError(`That expression is too long (limit ${LIMITS.inputLength} characters).`);
  }
  const text = normalise(raw);
  const re = /\s+|(\d+(?:\.\d+)?|\.\d+)|([A-Za-z]+)|([+\-*/^()=!|°])/y;
  const toks: Tok[] = [];
  let pos = 0;
  while (pos < text.length) {
    re.lastIndex = pos;
    const m = re.exec(text);
    if (!m) throw new MathParseError(`I don't understand the symbol '${text[pos]}' in that expression.`);
    if (m[1]) {
      if (m[1].split(".")[0].length > LIMITS.integerDigits || m[1].length > LIMITS.integerDigits + 10) {
        throw new MathParseError("One of the numbers is too large for me to check safely.");
      }
      toks.push({ kind: "num", value: m[1] });
    } else if (m[2]) {
      toks.push(...splitIdent(m[2].toLowerCase()));
    } else if (m[3]) {
      toks.push({ kind: "op", value: m[3] });
    }
    pos = re.lastIndex;
    if (toks.length > LIMITS.tokens) throw new MathParseError("That expression is too long for me to check safely.");
  }
  if (!toks.length) throw new MathParseError("I didn't find a math expression to work with.");
  return toks;
}

class Parser {
  i = 0;
  depth = 0;
  nodes = 0;
  readonly out: Parsed;

  constructor(private toks: Tok[], source: string) {
    this.out = { lhs: { type: "num", value: Rational.ZERO }, rhs: null, nonzero: [], nonnegative: [], positive: [], variables: new Set(), source };
  }

  peek(): Tok | undefined {
    return this.toks[this.i];
  }
  take(): Tok {
    const t = this.toks[this.i++];
    if (!t) throw new MathParseError("The expression ended too early.");
    return t;
  }
  expect(v: string) {
    const t = this.take();
    if (t.value !== v) throw new MathParseError(`Expected '${v}' but found '${t.value}'.`);
  }
  node<T extends Node>(n: T): T {
    if (++this.nodes > LIMITS.nodes) throw new MathParseError("That expression is too complicated for me to check safely.");
    return n;
  }
  enter() {
    if (++this.depth > LIMITS.depth) throw new MathParseError("That expression is nested too deeply for me to check safely.");
  }
  leave() {
    this.depth--;
  }

  statement(): Parsed {
    this.out.lhs = this.expr();
    if (this.peek()?.value === "=") {
      this.take();
      this.out.rhs = this.expr();
    }
    const extra = this.peek();
    if (extra) throw new MathParseError(`Unexpected '${extra.value}' in the expression.`);
    return this.out;
  }

  expr(): Node {
    this.enter();
    let node = this.term();
    for (let t = this.peek(); t && t.kind === "op" && (t.value === "+" || t.value === "-"); t = this.peek()) {
      this.take();
      node = this.node({ type: "bin", op: t.value as "+" | "-", left: node, right: this.term() });
    }
    this.leave();
    return node;
  }

  startsPrimary(t: Tok | undefined): boolean {
    return !!t && (t.kind === "num" || t.kind === "var" || t.kind === "const" || t.kind === "func" || t.value === "(");
  }

  term(): Node {
    let node = this.unary();
    for (;;) {
      const t = this.peek();
      if (t && t.kind === "op" && (t.value === "*" || t.value === "/")) {
        this.take();
        const right = this.unary();
        if (t.value === "/") {
          const c = safeConst(right);
          if (c && c.isZero()) throw new MathParseError("Division by zero is undefined.");
          this.out.nonzero.push(right);
        }
        node = this.node({ type: "bin", op: t.value as "*" | "/", left: node, right });
      } else if (this.startsPrimary(t)) {
        if (t!.kind === "num" && this.toks[this.i - 1]?.kind === "num") {
          throw new MathParseError("Two numbers are next to each other without an operator.");
        }
        node = this.node({ type: "bin", op: "*", left: node, right: this.unary() });
      } else {
        return node;
      }
    }
  }

  unary(): Node {
    const t = this.peek();
    if (t && t.kind === "op" && (t.value === "+" || t.value === "-")) {
      this.take();
      this.enter();
      const arg = this.unary();
      this.leave();
      return t.value === "-" ? this.node({ type: "neg", arg }) : arg;
    }
    return this.power();
  }

  power(): Node {
    const base = this.postfix();
    if (this.peek()?.value !== "^") return base;
    this.take();
    this.enter();
    const exponent = this.unary();
    this.leave();
    const e = safeConst(exponent);
    const hasVar = (n: Node) => containsVar(n);
    if (e) {
      if (Math.abs(e.toNumber()) > LIMITS.absExponent) {
        throw new MathParseError(`Exponents larger than ${LIMITS.absExponent} are too big to check safely.`);
      }
      const b = safeConst(base);
      if (b && b.bits() * Math.abs(e.toNumber()) > LIMITS.resultBits) {
        throw new MathParseError("That power would make a number too large to check safely.");
      }
      if (b && b.isZero() && e.isNegative()) {
        throw new MathParseError("Zero to a negative power is undefined (it means dividing by zero).");
      }
      if (e.isNegative()) this.out.nonzero.push(base);
      if (!e.isInteger() && e.d % 2n === 0n) this.out.nonnegative.push(base);
    } else if (hasVar(base) && hasVar(exponent)) {
      throw new MathParseError("Variables in both the base and the exponent are not supported.");
    }
    return this.node({ type: "bin", op: "^", left: base, right: exponent });
  }

  postfix(): Node {
    let node = this.primary();
    for (let t = this.peek(); t && (t.value === "!" || t.value === "°"); t = this.peek()) {
      this.take();
      if (t.value === "!") {
        const c = safeConst(node);
        if (c) {
          if (!c.isInteger() || c.isNegative()) throw new MathParseError("Factorial needs a whole number that is 0 or more.");
          if (c.toNumber() > LIMITS.factorial) throw new MathParseError(`Factorials above ${LIMITS.factorial}! are too large to check safely.`);
        } else {
          throw new MathParseError("Factorials of variables are not supported.");
        }
        node = this.node({ type: "fact", arg: node });
      } else {
        node = this.node({ type: "deg", arg: node });
      }
    }
    return node;
  }

  primary(): Node {
    const t = this.take();
    if (t.kind === "num") return this.node({ type: "num", value: Rational.parse(t.value) });
    if (t.kind === "const") return this.node({ type: "const", name: t.value as "pi" | "e" });
    if (t.kind === "var") {
      this.out.variables.add(t.value);
      return this.node({ type: "var", name: t.value });
    }
    if (t.kind === "func") {
      const fn = t.value as FnName;
      if (this.peek()?.value !== "(") throw new MathParseError(`Use brackets with ${fn}, like ${fn}(x).`);
      this.take();
      this.enter();
      const arg = this.expr();
      this.leave();
      this.expect(")");
      if (fn === "sqrt") this.out.nonnegative.push(arg);
      if (fn === "log" || fn === "ln") this.out.positive.push(arg);
      if (fn === "asin" || fn === "acos") {
        this.out.nonnegative.push({ type: "bin", op: "-", left: { type: "num", value: Rational.ONE }, right: { type: "bin", op: "^", left: arg, right: { type: "num", value: Rational.of(2) } } });
      }
      if (fn === "tan") this.out.nonzero.push({ type: "call", fn: "cos", arg });
      return this.node({ type: "call", fn, arg });
    }
    if (t.value === "(") {
      this.enter();
      const n = this.expr();
      this.leave();
      this.expect(")");
      return n;
    }
    if (t.value === "|") {
      this.enter();
      const n = this.expr();
      this.leave();
      this.expect("|");
      return this.node({ type: "call", fn: "abs", arg: n });
    }
    throw new MathParseError(`Unexpected '${t.value}' in the expression.`);
  }
}

export function containsVar(n: Node): boolean {
  switch (n.type) {
    case "var":
      return true;
    case "num":
    case "const":
      return false;
    case "bin":
      return containsVar(n.left) || containsVar(n.right);
    default:
      return containsVar(n.arg);
  }
}

/** Exact value of a constant subtree, or null; converts arithmetic errors into parse errors. */
function safeConst(n: Node): Rational | null {
  try {
    return constValue(n);
  } catch (err) {
    if (err instanceof RangeError) throw new MathParseError("That expression divides by zero, which is undefined.");
    throw new MathParseError(err instanceof Error ? err.message : "That expression is not supported.");
  }
}

export function parseMath(text: string): Parsed {
  const toks = tokenize(text);
  if (toks.filter((t) => t.value === "=").length > 1) {
    throw new MathParseError("Please give just one equation with a single '=' sign.");
  }
  return new Parser(toks, text).statement();
}
