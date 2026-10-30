/**
 * Browser math engine: evaluate, simplify, and solve parsed expressions.
 *
 * Supported exactly: rational arithmetic (fractions, decimals, negatives, powers,
 * factorials, perfect roots), simplified square roots, sin/cos/tan at standard
 * angles, and equations in one variable that reduce to polynomials or rational
 * functions whose roots are rational or quadratic surds.
 * Supported approximately (clearly labelled): other trig/log/exp values.
 * Unsupported (reported honestly): equations with the variable inside roots,
 * logs, trig or absolute values; several unknowns; cubic+ without rational roots.
 */
import type { Node, Parsed } from "./ast";
import { constValue, exactTrig, numValue, UndefinedValueError } from "./evaluate";
import { toLatex } from "./latex";
import { MathParseError, parseMath } from "./parser";
import { degree, isZeroPoly, NotPolynomialError, polyToLatex, scaleP, solvePoly, toPoly, toRatFunc, type Poly } from "./poly";
import { MathLimitError, Rational, simplifySqrt } from "./rational";
import { surdToLatex, surdToNumber, surdToText, surdValue, type Surd } from "./surd";
import type { MathCategory, MathResult, MathStep } from "./types";

const TOL = 1e-9;

const approxEqual = (a: number, b: number) => Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b));

function fmt(x: number): string {
  if (!Number.isFinite(x)) return String(x);
  return Number(x.toPrecision(10)).toString();
}

function err(message: string): MathResult {
  return { status: "error", message, engine: "browser" };
}

function hasFn(n: Node, fns?: string[]): boolean {
  switch (n.type) {
    case "call":
      return !fns || fns.includes(n.fn) ? true : hasFn(n.arg, fns);
    case "bin":
      return hasFn(n.left, fns) || hasFn(n.right, fns);
    case "neg":
    case "fact":
    case "deg":
      return hasFn(n.arg, fns);
    default:
      return false;
  }
}

function hasNonInteger(n: Node): boolean {
  if (n.type === "num") return !n.value.isInteger();
  if (n.type === "bin") return n.op === "/" || hasNonInteger(n.left) || hasNonInteger(n.right);
  if (n.type === "neg" || n.type === "fact" || n.type === "deg") return hasNonInteger(n.arg);
  if (n.type === "call") return hasNonInteger(n.arg);
  return false;
}

function categorize(p: Parsed): MathCategory {
  const all = p.rhs ? [p.lhs, p.rhs] : [p.lhs];
  if (all.some((n) => hasFn(n, ["sin", "cos", "tan", "asin", "acos", "atan"]))) return "trigonometry";
  if (p.rhs && p.variables.size) return "equations";
  if (p.variables.size) return "algebra";
  if (/\^|sqrt|√/.test(p.source)) return "exponents";
  if (all.some(hasNonInteger)) return "fractions";
  return "arithmetic";
}

const PRACTICE_FOR: Record<MathCategory, string> = {
  arithmetic: "arithmetic", fractions: "fractions", percentages: "percentages", equations: "linear_equations",
  algebra: "linear_equations", geometry: "geometry", functions: "linear_equations", trigonometry: "exponents",
  statistics: "statistics", exponents: "exponents",
};

/** Domain problem for given variable values, or null. */
function domainProblem(p: Parsed, env: Record<string, number>): string | null {
  for (const d of p.nonzero) {
    const v = numValue(d, env);
    if (Number.isFinite(v) && Math.abs(v) < 1e-12) return `it makes a denominator equal to zero (${toText(d)} = 0), which is undefined`;
  }
  for (const r of p.nonnegative) {
    const v = numValue(r, env);
    if (Number.isFinite(v) && v < -1e-12) return `it makes a square root of a negative number (${toText(r)} < 0)`;
  }
  for (const a of p.positive) {
    const v = numValue(a, env);
    if (Number.isFinite(v) && v <= 0) return `it makes a logarithm of a number that is not positive (${toText(a)} ≤ 0)`;
  }
  return null;
}

function toText(n: Node): string {
  return toLatex(n).replace(/\\left|\\right/g, "").replace(/\\times/g, "×").replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, "($1)/($2)").replace(/[{}\\]/g, "");
}

// ---------------------------------------------------------------------------
// Evaluate (no variables)
// ---------------------------------------------------------------------------

function evaluate(p: Parsed): MathResult {
  const base: MathResult = { kind: "evaluate", input_latex: toLatex(p.lhs), status: "unsupported", engine: "browser" };
  const problem = domainProblem(p, {});
  if (problem) return { ...base, status: "undefined", message: `This is undefined because ${problem}.` };

  let exact: Rational | null = null;
  try {
    exact = constValue(p.lhs);
  } catch (e) {
    if (e instanceof RangeError) return { ...base, status: "undefined", message: "This expression is undefined (it divides by zero)." };
    throw e;
  }
  const approx = numValue(p.lhs);
  if (exact) {
    // Cross-check exact arithmetic against floating point as an independent sanity check.
    const agrees = !Number.isFinite(approx) || approxEqual(exact.toNumber(), approx) || exact.bits() > 900;
    return {
      ...base,
      status: agrees ? "verified" : "unverified",
      result_text: exact.toString(),
      result_latex: exact.toLatex(),
      decimal: exact.isInteger() ? null : exact.toDecimal(),
      message: agrees ? "Calculated exactly with fractions (no rounding), and cross-checked." : "Calculated exactly, but the cross-check disagreed.",
    };
  }

  // Exact surds: sqrt of a rational, or trig at a standard angle.
  let surd: Surd | null = null;
  try {
    if (p.lhs.type === "call" && (p.lhs.fn === "sin" || p.lhs.fn === "cos" || p.lhs.fn === "tan")) surd = exactTrig(p.lhs.fn, p.lhs.arg);
    if (p.lhs.type === "call" && p.lhs.fn === "sqrt") {
      const r = constValue(p.lhs.arg);
      if (r && !r.isNegative()) {
        const { coeff, radicand } = simplifySqrt(r);
        surd = { a: Rational.ZERO, b: coeff, m: radicand };
      }
    }
  } catch (e) {
    if (e instanceof UndefinedValueError) return { ...base, status: "undefined", message: e.message };
    throw e;
  }
  if (surd) {
    const ok = approxEqual(surdToNumber(surd), approx);
    return {
      ...base,
      status: ok ? "verified" : "unverified",
      result_text: surdToText(surd),
      result_latex: surdToLatex(surd),
      decimal: surdValue(surd)?.isInteger() ? null : fmt(surdToNumber(surd)),
      message: ok ? "Exact value, cross-checked numerically." : "Exact value found, but the numeric cross-check disagreed.",
    };
  }

  if (!Number.isFinite(approx)) return { ...base, status: "undefined", message: "This expression is undefined or not a real number." };
  return {
    ...base,
    status: "approximate",
    result_text: `≈ ${fmt(approx)}`,
    result_latex: `\\approx ${fmt(approx)}`,
    decimal: fmt(approx),
    message: "Calculated numerically (rounded to 10 significant digits). This is not an exact symbolic result.",
  };
}

// ---------------------------------------------------------------------------
// Simplify (variables, no '=')
// ---------------------------------------------------------------------------

function simplify(p: Parsed): MathResult {
  const vars = [...p.variables];
  const base: MathResult = { kind: "simplify", input_latex: toLatex(p.lhs), status: "unsupported", engine: "browser" };
  if (vars.length !== 1) {
    return { ...base, message: "I can simplify expressions with one variable. This one has " + (vars.length ? vars.join(", ") : "none") + "." };
  }
  const v = vars[0];
  try {
    const rfn = toRatFunc(p.lhs, v);
    const lead = rfn.den[rfn.den.length - 1];
    const num = scaleP(rfn.num, Rational.ONE.div(lead));
    const den = scaleP(rfn.den, Rational.ONE.div(lead));
    const latex = degree(den) === 0 ? polyToLatex(scaleP(num, Rational.ONE.div(den[0])), v) : `\\frac{${polyToLatex(num, v)}}{${polyToLatex(den, v)}}`;
    // Verify equivalence by evaluating both forms at several points.
    const ok = [-3.7, -1.3, 0.5, 2.1, 4.9].every((x) => {
      const orig = numValue(p.lhs, { [v]: x });
      const n = num.reduceRight((acc, c) => acc * x + c.toNumber(), 0);
      const d = den.reduceRight((acc, c) => acc * x + c.toNumber(), 0);
      return !Number.isFinite(orig) || Math.abs(d) < 1e-12 || approxEqual(orig, n / d);
    });
    return {
      ...base,
      status: ok ? "verified" : "unverified",
      result_latex: latex,
      result_text: latex,
      forms: [{ label: degree(den) === 0 ? "Expanded" : "Combined", latex }],
      restrictions: p.nonzero.filter((d) => d.type !== "num").map((d) => `${toText(d)} ≠ 0`),
      message: ok ? "Simplified exactly and checked at several sample values." : "Simplified, but the sample-value check failed.",
    };
  } catch (e) {
    if (e instanceof NotPolynomialError) return { ...base, message: "I can only simplify polynomial and fraction expressions (not roots, trig or logs of a variable)." };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Solve (one equation, one unknown)
// ---------------------------------------------------------------------------

function linearSteps(lhs: Poly, rhs: Poly, v: string, inputLatex: string): MathStep[] | null {
  if (degree(lhs) > 1 || degree(rhs) > 1 || Math.max(degree(lhs), degree(rhs)) < 1) return null;
  let [b1, a1] = [lhs[0] ?? Rational.ZERO, lhs[1] ?? Rational.ZERO];
  let [b2, a2] = [rhs[0] ?? Rational.ZERO, rhs[1] ?? Rational.ZERO];
  if (a1.equals(a2)) return null;
  const term = (a: Rational) => polyToLatex([Rational.ZERO, a], v);
  const steps: MathStep[] = [{ text: "Start with the equation.", latex: inputLatex }];
  if (!a2.isZero()) {
    steps.push({
      text: `${a2.isNegative() ? "Add" : "Subtract"} ${a2.abs().equals(Rational.ONE) ? "" : a2.abs().toString()}${v} ${a2.isNegative() ? "to" : "from"} both sides so all the ${v} terms are on the left.`,
      latex: `${polyToLatex([b1, a1.sub(a2)], v)} = ${b2.toLatex()}`,
    });
    a1 = a1.sub(a2);
    a2 = Rational.ZERO;
  }
  if (!b1.isZero()) {
    steps.push({
      text: `${b1.isNegative() ? `Add ${b1.abs()} to` : `Subtract ${b1} from`} both sides to get the ${v} term by itself.`,
      latex: `${term(a1)} = ${b2.sub(b1).toLatex()}`,
    });
    b2 = b2.sub(b1);
    b1 = Rational.ZERO;
  }
  if (!a1.equals(Rational.ONE)) {
    steps.push({ text: `Divide both sides by ${a1}.`, latex: `${v} = ${b2.div(a1).toLatex()}` });
  }
  return steps;
}

function quadraticSteps(lhs: Poly, rhs: Poly, v: string, inputLatex: string, roots: Surd[]): MathStep[] | null {
  const all = trimTo(subP(lhs, rhs));
  if (degree(all) !== 2) return null;
  const [c, b, a] = all;
  const disc = b.mul(b).sub(Rational.of(4).mul(a).mul(c));
  const steps: MathStep[] = [
    { text: "Start with the equation.", latex: inputLatex },
    { text: "Move every term to one side so the other side is 0.", latex: `${polyToLatex(all, v)} = 0` },
    { text: `This is a quadratic with a = ${a}, b = ${b}, c = ${c}.`, latex: `a${v}^2 + b${v} + c = 0` },
  ];
  const rational = roots.filter((r) => surdValue(r) !== null);
  if (rational.length === roots.length && roots.length > 0) {
    const factors = roots.map((r) => {
      const val = surdValue(r)!;
      return val.isZero() ? v : `\\left(${v} ${val.isNegative() ? "+" : "-"} ${val.abs().toLatex()}\\right)`;
    });
    const lead = a.equals(Rational.ONE) ? "" : a.toLatex();
    const fact = roots.length === 1 ? `${lead}${factors[0]}^2` : `${lead}${factors.join("")}`;
    steps.push({ text: "Factor the left side.", latex: `${fact} = 0` });
    steps.push({ text: "A product is zero only when one of its factors is zero, so set each factor equal to 0.", latex: "" });
  }
  steps.push({
    text: "Check with the discriminant D = b² − 4ac. It tells us how many real solutions there are.",
    latex: `D = (${b.toLatex()})^2 - 4(${a.toLatex()})(${c.toLatex()}) = ${disc.toLatex()}`,
  });
  if (disc.isNegative()) steps.push({ text: "D is negative, so there are no real solutions.", latex: "" });
  else
    steps.push({
      text: "Use the quadratic formula.",
      latex: `${v} = \\frac{-b \\pm \\sqrt{D}}{2a} = \\frac{${b.neg().toLatex()} \\pm \\sqrt{${disc.toLatex()}}}{${a.mul(Rational.of(2)).toLatex()}}`,
    });
  return steps;
}

function subP(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push((a[i] ?? Rational.ZERO).sub(b[i] ?? Rational.ZERO));
  return out;
}
function trimTo(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1].isZero()) out.pop();
  return out;
}

function pickVariable(p: Parsed, requested?: string | null): string | null {
  const vars = [...p.variables].sort();
  if (requested) return vars.includes(requested) ? requested : null;
  for (const pref of ["x", "y", "t", "n"]) if (vars.includes(pref) && vars.length === 1) return pref;
  return vars.length === 1 ? vars[0] : null;
}

function solve(p: Parsed & { rhs: Node }, requested?: string | null): MathResult {
  const inputLatex = `${toLatex(p.lhs)} = ${toLatex(p.rhs)}`;
  const base: MathResult = { kind: "solve", input_latex: inputLatex, status: "unsupported", engine: "browser" };

  if (p.variables.size === 0) {
    const l = constValue(p.lhs);
    const r = constValue(p.rhs);
    const same = l && r ? l.equals(r) : approxEqual(numValue(p.lhs), numValue(p.rhs));
    return {
      ...base,
      kind: "check",
      status: l && r ? "verified" : "approximate",
      result_text: same ? "true" : "false",
      result_latex: same ? "\\text{true}" : "\\text{false}",
      message: `I checked whether both sides are equal: ${same ? "they are" : "they are not"}.`,
    };
  }
  const v = pickVariable(p, requested);
  if (!v) {
    return { ...base, message: `This equation has several letters (${[...p.variables].sort().join(", ")}). The browser engine solves equations with one unknown.` };
  }
  base.variable = v;

  const vars = [p.lhs, p.rhs];
  if (vars.some((n) => hasFn(n, ["sin", "cos", "tan", "asin", "acos", "atan", "log", "ln", "exp", "abs", "sqrt", "cbrt"]) && toPolySafe(n, v) === null)) {
    return { ...base, message: "Equations with the unknown inside a root, log, trig function or absolute value aren't supported by the browser math engine yet." };
  }

  let numPoly: Poly;
  try {
    const rf = toRatFunc({ type: "bin", op: "-", left: p.lhs, right: p.rhs }, v);
    numPoly = rf.num;
  } catch (e) {
    if (e instanceof NotPolynomialError) return { ...base, message: "This equation is outside what the browser engine can solve exactly (for example, the unknown in an exponent or a very high power)." };
    throw e;
  }

  const lhsPoly = toPoly(p.lhs, v);
  const rhsPoly = toPoly(p.rhs, v);
  const restrictions = p.nonzero.filter((d) => d.type !== "num").map((d) => `${toText(d)} ≠ 0`);

  if (isZeroPoly(numPoly)) {
    return {
      ...base,
      status: "verified",
      result_text: "all real numbers",
      result_latex: "\\text{all real numbers}",
      restrictions,
      steps: [],
      message: "Both sides are always equal, so every real number works" + (restrictions.length ? ` as long as ${restrictions.join(", ")}.` : "."),
    };
  }
  if (degree(numPoly) === 0) {
    return { ...base, status: "no_solution", solutions: [], steps: [], message: "The two sides can never be equal, so there is no solution." };
  }

  const roots = solvePoly(numPoly);
  if (!roots.complete) {
    return { ...base, message: "This polynomial doesn't have rational roots I can find, so I can't solve it exactly in the browser." };
  }

  const steps =
    (lhsPoly && rhsPoly && (linearSteps(lhsPoly, rhsPoly, v, inputLatex) ?? quadraticSteps(lhsPoly, rhsPoly, v, inputLatex, roots.real))) || [];

  const solutions: NonNullable<MathResult["solutions"]> = [];
  const excluded: NonNullable<MathResult["excluded"]> = [];
  let allExact = true;
  const sorted = [...roots.real].sort((x, y) => surdToNumber(x) - surdToNumber(y));
  for (const root of sorted) {
    const xNum = surdToNumber(root);
    const problem = domainProblem(p, { [v]: xNum });
    if (problem) {
      excluded.push({ value_text: surdToText(root), value_latex: surdToLatex(root), reason: `Rejected because ${problem}.` });
      continue;
    }
    // Substitute back into the ORIGINAL equation.
    const exactRoot = surdValue(root);
    let ok = false;
    let method: "exact" | "numeric" = "numeric";
    let lhsShown = "";
    let rhsShown = "";
    try {
      if (exactRoot) {
        const l = constValue(p.lhs, { [v]: exactRoot });
        const r = constValue(p.rhs, { [v]: exactRoot });
        if (l && r) {
          ok = l.equals(r);
          method = "exact";
          lhsShown = l.toLatex();
          rhsShown = r.toLatex();
        }
      }
    } catch {
      ok = false;
    }
    if (method === "numeric") {
      const l = numValue(p.lhs, { [v]: xNum });
      const r = numValue(p.rhs, { [v]: xNum });
      ok = Number.isFinite(l) && Number.isFinite(r) && approxEqual(l, r);
      allExact = false;
      lhsShown = `\\approx ${fmt(l)}`;
      rhsShown = `\\approx ${fmt(r)}`;
    }
    if (!ok) {
      excluded.push({ value_text: surdToText(root), value_latex: surdToLatex(root), reason: "Rejected because substituting it back does not make both sides equal." });
      continue;
    }
    const sub = { [v]: surdToLatex(root) };
    solutions.push({
      value_text: surdToText(root),
      value_latex: surdToLatex(root),
      decimal: exactRoot?.isInteger() ? null : fmt(xNum),
      check: {
        latex: `\\text{left: } ${toLatex(p.lhs, sub)} = ${lhsShown},\\quad \\text{right: } ${toLatex(p.rhs, sub)} = ${rhsShown}`,
        ok: true,
        method,
      },
    });
  }

  const complexSolutions = roots.complex.flatMap(({ re, imSq }) => {
    const im = surdToLatex({ a: Rational.ZERO, ...sqrtSurd(imSq) });
    const reTex = re.isZero() ? "" : `${re.toLatex()} `;
    return [
      { value_text: `${re} + ${im}i`, value_latex: `${reTex}${re.isZero() ? "" : "+ "}${im}i` },
      { value_text: `${re} - ${im}i`, value_latex: `${reTex}- ${im}i` },
    ];
  });

  if (!solutions.length) {
    return {
      ...base,
      status: "no_solution",
      steps,
      solutions: [],
      excluded,
      complex_solutions: complexSolutions,
      message:
        excluded.length > 0
          ? "Every candidate failed the check, so there is no valid real solution."
          : "There are no real-number solutions." + (complexSolutions.length ? " (There are complex-number solutions, studied in advanced classes.)" : ""),
    };
  }
  return {
    ...base,
    status: "verified",
    steps,
    solutions,
    excluded,
    restrictions,
    result_latex: solutions.map((s) => `${v} = ${s.value_latex}`).join(",\\; "),
    result_text: solutions.map((s) => `${v} = ${s.value_text}`).join(", "),
    message: allExact
      ? "Each solution was checked exactly by substituting it back into the original equation."
      : "Each solution was checked by substituting it back into the original equation (to 9 significant digits for square-root answers).",
  };
}

function sqrtSurd(r: Rational): { b: Rational; m: bigint } {
  const { coeff, radicand } = simplifySqrt(r);
  return { b: coeff, m: radicand };
}

function toPolySafe(n: Node, v: string): Poly | null {
  try {
    return toPoly(n, v);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function analyze(text: string, variable?: string | null): MathResult {
  let p: Parsed;
  try {
    p = parseMath(text);
  } catch (e) {
    if (e instanceof MathParseError || e instanceof MathLimitError) return err(e.message);
    return err("I couldn't read that math expression.");
  }
  const category = categorize(p);
  try {
    const r = p.rhs ? solve(p as Parsed & { rhs: Node }, variable) : p.variables.size ? simplify(p) : evaluate(p);
    return { ...r, category, practice_topic: PRACTICE_FOR[category] };
  } catch (e) {
    if (e instanceof MathLimitError) return err(e.message);
    if (e instanceof RangeError) return { status: "undefined", message: "This expression divides by zero, so it is undefined.", engine: "browser", category };
    if (e instanceof NotPolynomialError) return { status: "unsupported", message: "That's beyond what the browser math engine can do exactly.", engine: "browser", category };
    return { status: "unsupported", message: "The math engine couldn't handle this problem.", engine: "browser", category };
  }
}

/** Compare a student's answer with an expected answer list ("2, -3"). Order doesn't matter. */
export function checkAnswer(expected: string, answer: string): { status: "verified" | "error"; correct: boolean; message: string } {
  const split = (t: string) =>
    t
      .replace(/\bor\b|\band\b/gi, ",")
      .split(",")
      .map((s) => (s.includes("=") ? s.split("=")[1] : s).trim())
      .filter(Boolean);
  const valueOf = (s: string): { exact: Rational | null; num: number } => {
    const p = parseMath(s);
    if (p.rhs || p.variables.size) throw new MathParseError("Please type just a number.");
    return { exact: constValue(p.lhs), num: numValue(p.lhs) };
  };
  try {
    const exp = split(expected).map(valueOf);
    const parts = split(answer);
    if (!parts.length) return { status: "error", correct: false, message: "Please type an answer." };
    const ans = parts.map(valueOf);
    if (exp.length !== ans.length) return { status: "verified", correct: false, message: `Expected ${exp.length} value(s) but got ${ans.length}.` };
    const remaining = [...exp];
    for (const a of ans) {
      const idx = remaining.findIndex((e) => (e.exact && a.exact ? e.exact.equals(a.exact) : approxEqual(e.num, a.num)));
      if (idx < 0) return { status: "verified", correct: false, message: "That answer doesn't match. Check your work and try again!" };
      remaining.splice(idx, 1);
    }
    return { status: "verified", correct: true, message: "Correct! The math engine confirmed your answer." };
  } catch (e) {
    return { status: "error", correct: false, message: `I couldn't read that answer: ${e instanceof Error ? e.message : "invalid"}` };
  }
}
