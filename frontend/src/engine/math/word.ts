/**
 * Natural-language math: find a checkable problem in a chat or voice message,
 * and solve common grade 7–12 "formula" problems (percentages, statistics,
 * geometry, functions) with exact arithmetic and explained steps.
 */
import { constValue } from "./evaluate";
import { toLatex } from "./latex";
import { parseMath } from "./parser";
import { Rational, exactSqrt, simplifySqrt } from "./rational";
import { analyze } from "./solve";
import { surdToLatex, surdToNumber } from "./surd";
import type { MathCategory, MathResult, MathStep } from "./types";

// ---------------------------------------------------------------------------
// Number words ("x plus five equals ten")
// ---------------------------------------------------------------------------

const SMALL: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

export function wordsToNumbers(text: string): string {
  const words = Object.keys(SMALL).concat(Object.keys(TENS), ["hundred", "thousand"]).join("|");
  const re = new RegExp(`\\b(?:${words})(?:[\\s-]+(?:and[\\s-]+)?(?:${words}))*\\b`, "gi");
  return text.replace(re, (match) => {
    let total = 0;
    let current = 0;
    for (const w of match.toLowerCase().split(/[\s-]+/)) {
      if (w === "and") continue;
      if (w in SMALL) current += SMALL[w];
      else if (w in TENS) current += TENS[w];
      else if (w === "hundred") current = (current || 1) * 100;
      else if (w === "thousand") {
        total += (current || 1) * 1000;
        current = 0;
      }
    }
    return String(total + current);
  });
}

const PHRASES: [RegExp, string][] = [
  [/\bmultiplied by\b/gi, " * "],
  [/\btimes\b/gi, " * "],
  [/\bplus\b/gi, " + "],
  [/\bminus\b/gi, " - "],
  [/\bnegative\s+(?=\d)/gi, " -"],
  [/\bdivided by\b/gi, " / "],
  [/\bover\b/gi, " / "],
  [/\bsquared\b/gi, " ^2 "],
  [/\bcubed\b/gi, " ^3 "],
  [/\bto the power of\b/gi, " ^ "],
  [/\bis equal to\b|\bequals\b|\bequal\b/gi, " = "],
  [/\bsquare root of\s+([\d.]+|[a-z])\b/gi, " sqrt($1) "],
  [/\bpi\b/gi, " pi "],
];

const TRIGGER =
  /^(?:(?:hey|ok|okay)\s+)?(?:jarvis[\s,:!.]*)?(?:please\s+)?(?:can you\s+|could you\s+|help me\s+)?(?:please\s+)?(solve|evaluate|calculate|compute|simplify|work out|what\s+is|what's|whats|how much is|find)\s+(?:for\s+([a-z])\s*(?:in|:|,)?\s*)?(.+)$/i;
const MATHY = /^[\d\s+\-*/^().=a-z×÷−·√π²³!|°,%]+$/i;

export interface DetectedMath {
  expression: string;
  variable: string | null;
}

export function normaliseSpoken(text: string): string {
  let out = wordsToNumbers(text);
  for (const [re, rep] of PHRASES) out = out.replace(re, rep);
  return out.replace(/\s+/g, " ").trim();
}

/** Extract a pure expression/equation from a sentence, or null. Conservative: it must parse. */
export function detectMath(message: string): DetectedMath | null {
  const raw = message.trim();
  if (!raw || raw.length > 400) return null;
  let text = normaliseSpoken(raw);
  // "12 x 8" means multiplication when there is no equation
  if (!text.includes("=")) text = text.replace(/(?<=\d)\s*[xX]\s*(?=\d)/g, " * ");
  const m = TRIGGER.exec(text);
  let body: string;
  let variable: string | null = null;
  if (m) {
    body = m[3];
    variable = m[2]?.toLowerCase() ?? null;
  } else if (MATHY.test(text) && /\d/.test(text) && /[+\-*/^=×÷−]/.test(text)) {
    body = text;
  } else {
    return null;
  }
  body = body.replace(/[?!.]+$/, "").replace(/\s+for\s+([a-z])$/i, (_s, v: string) => {
    variable = v.toLowerCase();
    return "";
  });
  body = body.replace(/([\d.]+)\s*%\s*of\s+/gi, "($1/100)*").replace(/([\d.]+)\s*%/g, "($1/100)");
  if (!body.includes("=")) body = body.replace(/(?<=\d)\s*[xX]\s*(?=\d)/g, "*");
  body = body.trim();
  if (!body || !/\d/.test(body) || !MATHY.test(body)) return null;
  try {
    parseMath(body);
  } catch {
    return null;
  }
  return { expression: body, variable };
}

// ---------------------------------------------------------------------------
// Word problems
// ---------------------------------------------------------------------------

const NUM = String.raw`(-?\d+(?:\.\d+)?)`;
const R = (s: string) => Rational.parse(s.replace(/^-/, "")).mul(s.startsWith("-") ? Rational.ONE.neg() : Rational.ONE);
const piLatex = (k: Rational) => (k.isZero() ? "0" : `${k.equals(Rational.ONE) ? "" : k.toLatex()}\\pi`);
const fmt = (x: number) => Number(x.toPrecision(10)).toString();

function result(category: MathCategory, steps: MathStep[], answerLatex: string, answerText: string, decimal: string | null, message: string, practice: string): MathResult {
  return {
    status: "verified",
    kind: "word",
    category,
    steps,
    result_latex: answerLatex,
    result_text: answerText,
    decimal,
    message,
    practice_topic: practice,
    engine: "browser",
  };
}

function percentage(t: string): MathResult | null {
  let m = new RegExp(`${NUM}\\s*%\\s*of\\s*${NUM}`, "i").exec(t);
  if (m) {
    const p = R(m[1]);
    const n = R(m[2]);
    const ans = p.div(Rational.of(100)).mul(n);
    return result("percentages", [
      { text: "Percent means “out of 100”, so change the percent to a fraction.", latex: `${p.toLatex()}\\% = \\frac{${p.toLatex()}}{100}` },
      { text: "Multiply by the amount.", latex: `\\frac{${p.toLatex()}}{100} \\times ${n.toLatex()} = ${ans.toLatex()}` },
    ], ans.toLatex(), ans.toString(), ans.isInteger() ? null : ans.toDecimal(), "Calculated exactly with fractions.", "percentages");
  }
  m = new RegExp(`${NUM}\\s+is\\s+what\\s+percent(?:age)?\\s+of\\s+${NUM}`, "i").exec(t) ?? new RegExp(`what\\s+percent(?:age)?\\s+of\\s+${NUM}\\s+is\\s+${NUM}`, "i").exec(t);
  if (m) {
    const swapped = /^what/i.test(m[0]);
    const part = R(swapped ? m[2] : m[1]);
    const whole = R(swapped ? m[1] : m[2]);
    if (whole.isZero()) return null;
    const pct = part.div(whole).mul(Rational.of(100));
    return result("percentages", [
      { text: "Write the part as a fraction of the whole.", latex: `\\frac{${part.toLatex()}}{${whole.toLatex()}}` },
      { text: "Multiply by 100 to turn it into a percent.", latex: `\\frac{${part.toLatex()}}{${whole.toLatex()}} \\times 100 = ${pct.toLatex()}\\%` },
    ], `${pct.toLatex()}\\%`, `${pct}%`, pct.isInteger() ? null : `${pct.toDecimal()}%`, "Calculated exactly with fractions.", "percentages");
  }
  m = new RegExp(`(increase|decrease)\\s+${NUM}\\s+by\\s+${NUM}\\s*%`, "i").exec(t);
  if (m) {
    const up = m[1].toLowerCase() === "increase";
    const n = R(m[2]);
    const p = R(m[3]);
    const change = n.mul(p).div(Rational.of(100));
    const ans = up ? n.add(change) : n.sub(change);
    return result("percentages", [
      { text: `Find ${p}% of ${n}.`, latex: `\\frac{${p.toLatex()}}{100} \\times ${n.toLatex()} = ${change.toLatex()}` },
      { text: up ? "Add it to the original amount." : "Subtract it from the original amount.", latex: `${n.toLatex()} ${up ? "+" : "-"} ${change.toLatex()} = ${ans.toLatex()}` },
    ], ans.toLatex(), ans.toString(), ans.isInteger() ? null : ans.toDecimal(), "Calculated exactly with fractions.", "percentages");
  }
  return null;
}

function statistics(t: string): MathResult | null {
  const m = /\b(mean|average|median|mode|range)\b(?:\s+value)?\s+(?:of|for)\s+(?:the\s+)?(?:numbers?|data|values?)?\s*:?\s*([-\d.,\s]+(?:and\s+-?[\d.]+)?)/i.exec(t);
  if (!m) return null;
  const nums = m[2].replace(/\band\b/gi, ",").split(/[,\s]+/).filter((s) => /^-?\d+(\.\d+)?$/.test(s));
  if (nums.length < 2 || nums.length > 50) return null;
  const vals = nums.map(R);
  const kind = m[1].toLowerCase() === "average" ? "mean" : m[1].toLowerCase();
  const list = vals.map((v) => v.toLatex()).join(", ");
  const sorted = [...vals].sort((a, b) => a.compare(b));
  let ans: Rational;
  const steps: MathStep[] = [];
  if (kind === "mean") {
    const sum = vals.reduce((a, b) => a.add(b), Rational.ZERO);
    ans = sum.div(Rational.of(vals.length));
    steps.push({ text: "Add all the numbers.", latex: `${vals.map((v) => v.toLatex()).join(" + ")} = ${sum.toLatex()}` });
    steps.push({ text: `Divide by how many numbers there are (${vals.length}).`, latex: `\\frac{${sum.toLatex()}}{${vals.length}} = ${ans.toLatex()}` });
  } else if (kind === "median") {
    steps.push({ text: "Put the numbers in order.", latex: sorted.map((v) => v.toLatex()).join(", ") });
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) {
      ans = sorted[mid];
      steps.push({ text: "There is an odd number of values, so the median is the middle one.", latex: ans.toLatex() });
    } else {
      ans = sorted[mid - 1].add(sorted[mid]).div(Rational.of(2));
      steps.push({ text: "There is an even number of values, so average the two middle ones.", latex: `\\frac{${sorted[mid - 1].toLatex()} + ${sorted[mid].toLatex()}}{2} = ${ans.toLatex()}` });
    }
  } else if (kind === "range") {
    ans = sorted[sorted.length - 1].sub(sorted[0]);
    steps.push({ text: "Range = largest value − smallest value.", latex: `${sorted[sorted.length - 1].toLatex()} - ${sorted[0].toLatex()} = ${ans.toLatex()}` });
  } else {
    const counts = new Map<string, { v: Rational; c: number }>();
    for (const v of vals) counts.set(v.toString(), { v, c: (counts.get(v.toString())?.c ?? 0) + 1 });
    const max = Math.max(...[...counts.values()].map((x) => x.c));
    const modes = [...counts.values()].filter((x) => x.c === max).map((x) => x.v);
    steps.push({ text: "Count how often each value appears.", latex: [...counts.values()].map((x) => `${x.v.toLatex()}\\!:\\,${x.c}`).join(",\\; ") });
    if (max === 1) {
      return { ...result("statistics", steps, "\\text{no mode}", "no mode", null, "Every value appears once, so there is no mode.", "statistics") };
    }
    steps.push({ text: "The mode is the value (or values) that appear most often.", latex: modes.map((x) => x.toLatex()).join(", ") });
    return result("statistics", steps, modes.map((x) => x.toLatex()).join(", "), modes.join(", "), null, "Counted exactly.", "statistics");
  }
  return result("statistics", [{ text: "The data:", latex: list }, ...steps], ans.toLatex(), ans.toString(), ans.isInteger() ? null : ans.toDecimal(), "Calculated exactly with fractions.", "statistics");
}

function grab(t: string, names: string): Rational | null {
  const m = new RegExp(`(?:${names})\\s*(?:of|is|=|:)?\\s*${NUM}`, "i").exec(t);
  return m ? R(m[1]) : null;
}

function geometry(t: string): MathResult | null {
  const lower = t.toLowerCase();
  if (/circle/.test(lower) && /(area|circumference|perimeter)/.test(lower)) {
    let r = grab(t, "radius");
    const d = grab(t, "diameter");
    if (!r && d) r = d.div(Rational.of(2));
    if (!r || r.isNegative()) return null;
    if (/area/.test(lower)) {
      const k = r.mul(r);
      return result("geometry", [
        ...(d ? [{ text: "The radius is half the diameter.", latex: `r = \\frac{${d.toLatex()}}{2} = ${r.toLatex()}` }] : []),
        { text: "Area of a circle: A = πr².", latex: `A = \\pi (${r.toLatex()})^2 = ${piLatex(k)}` },
      ], piLatex(k), `${k}π`, fmt(k.toNumber() * Math.PI), "Exact answer in terms of π; the decimal is rounded.", "geometry");
    }
    const k = r.mul(Rational.of(2));
    return result("geometry", [{ text: "Circumference: C = 2πr.", latex: `C = 2\\pi (${r.toLatex()}) = ${piLatex(k)}` }], piLatex(k), `${k}π`, fmt(k.toNumber() * Math.PI), "Exact answer in terms of π; the decimal is rounded.", "geometry");
  }
  const by = new RegExp(`${NUM}\\s*(?:by|x|×)\\s*${NUM}`, "i").exec(t);
  if (/rectangle/.test(lower) && /(area|perimeter)/.test(lower)) {
    const l = grab(t, "length|long") ?? (by ? R(by[1]) : null);
    const w = grab(t, "width|wide") ?? (by ? R(by[2]) : null);
    if (!l || !w) return null;
    if (/area/.test(lower)) {
      const a = l.mul(w);
      return result("geometry", [{ text: "Area of a rectangle = length × width.", latex: `A = ${l.toLatex()} \\times ${w.toLatex()} = ${a.toLatex()}` }], a.toLatex(), a.toString(), null, "Calculated exactly.", "geometry");
    }
    const p = l.add(w).mul(Rational.of(2));
    return result("geometry", [{ text: "Perimeter of a rectangle = 2 × (length + width).", latex: `P = 2(${l.toLatex()} + ${w.toLatex()}) = ${p.toLatex()}` }], p.toLatex(), p.toString(), null, "Calculated exactly.", "geometry");
  }
  if (/square/.test(lower) && /(area|perimeter)/.test(lower) && !/root/.test(lower)) {
    const s = grab(t, "side(?: length)?|sides");
    if (!s) return null;
    const ans = /area/.test(lower) ? s.mul(s) : s.mul(Rational.of(4));
    return result("geometry", [{ text: /area/.test(lower) ? "Area of a square = side²." : "Perimeter of a square = 4 × side.", latex: /area/.test(lower) ? `A = (${s.toLatex()})^2 = ${ans.toLatex()}` : `P = 4 \\times ${s.toLatex()} = ${ans.toLatex()}` }], ans.toLatex(), ans.toString(), null, "Calculated exactly.", "geometry");
  }
  if (/triangle/.test(lower) && /area/.test(lower)) {
    const b = grab(t, "base");
    const h = grab(t, "height");
    if (!b || !h) return null;
    const a = b.mul(h).div(Rational.of(2));
    return result("geometry", [{ text: "Area of a triangle = ½ × base × height.", latex: `A = \\frac{1}{2} \\times ${b.toLatex()} \\times ${h.toLatex()} = ${a.toLatex()}` }], a.toLatex(), a.toString(), a.isInteger() ? null : a.toDecimal(), "Calculated exactly.", "geometry");
  }
  if (/hypotenuse|pythag/.test(lower)) {
    const m = new RegExp(`${NUM}\\s*(?:and|,)\\s*${NUM}`, "i").exec(t);
    if (!m) return null;
    const a = R(m[1]);
    const b = R(m[2]);
    if (a.isNegative() || b.isNegative()) return null;
    const sq = a.mul(a).add(b.mul(b));
    const exact = exactSqrt(sq);
    const { coeff, radicand } = simplifySqrt(sq);
    const surd = { a: Rational.ZERO, b: coeff, m: radicand };
    const tex = exact ? exact.toLatex() : surdToLatex(surd);
    return result("geometry", [
      { text: "Pythagorean theorem: c² = a² + b², where c is the hypotenuse (the longest side, opposite the right angle).", latex: `c^2 = ${a.toLatex()}^2 + ${b.toLatex()}^2 = ${sq.toLatex()}` },
      { text: "Take the square root of both sides.", latex: `c = \\sqrt{${sq.toLatex()}} = ${tex}` },
    ], tex, exact ? exact.toString() : `√${sq}`, exact?.isInteger() ? null : fmt(surdToNumber(surd)), "Calculated exactly.", "geometry");
  }
  if (/volume/.test(lower)) {
    if (/cube/.test(lower)) {
      const s = grab(t, "side(?: length)?|edge|sides");
      if (!s) return null;
      const v = s.pow(3);
      return result("geometry", [{ text: "Volume of a cube = side³.", latex: `V = (${s.toLatex()})^3 = ${v.toLatex()}` }], v.toLatex(), v.toString(), null, "Calculated exactly.", "geometry");
    }
    if (/cylinder/.test(lower)) {
      const r = grab(t, "radius");
      const h = grab(t, "height");
      if (!r || !h) return null;
      const k = r.mul(r).mul(h);
      return result("geometry", [{ text: "Volume of a cylinder = πr²h.", latex: `V = \\pi (${r.toLatex()})^2 (${h.toLatex()}) = ${piLatex(k)}` }], piLatex(k), `${k}π`, fmt(k.toNumber() * Math.PI), "Exact answer in terms of π; the decimal is rounded.", "geometry");
    }
    if (/(prism|box|cuboid)/.test(lower)) {
      const l = grab(t, "length");
      const w = grab(t, "width");
      const h = grab(t, "height");
      if (!l || !w || !h) return null;
      const v = l.mul(w).mul(h);
      return result("geometry", [{ text: "Volume of a rectangular prism = length × width × height.", latex: `V = ${l.toLatex()} \\times ${w.toLatex()} \\times ${h.toLatex()} = ${v.toLatex()}` }], v.toLatex(), v.toString(), null, "Calculated exactly.", "geometry");
    }
  }
  return null;
}

function functions(t: string): MathResult | null {
  // f(x) = 2x + 3, find f(4)   |   if g(x) = x^2 + 1 what is g(-2)
  const m = /\b([fgh])\s*\(\s*([a-z])\s*\)\s*=\s*([^,;]+?)\s*(?:[,;.]|\bfind\b|\bwhat\b|\bevaluate\b|\bcalculate\b).*?\b\1\s*\(\s*(-?[\d.]+(?:\s*\/\s*\d+)?)\s*\)/i.exec(t);
  const slope = new RegExp(`slope.*?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*\\).*?\\(\\s*${NUM}\\s*,\\s*${NUM}\\s*\\)`, "i").exec(t);
  if (slope) {
    const [x1, y1, x2, y2] = slope.slice(1, 5).map(R);
    if (x1.equals(x2)) {
      return { status: "undefined", kind: "word", category: "functions", engine: "browser", message: "The two points have the same x value, so the line is vertical and its slope is undefined." };
    }
    const s = y2.sub(y1).div(x2.sub(x1));
    return result("functions", [
      { text: "Slope = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁).", latex: `m = \\frac{${y2.toLatex()} - ${y1.toLatex()}}{${x2.toLatex()} - ${x1.toLatex()}} = ${s.toLatex()}` },
    ], s.toLatex(), s.toString(), s.isInteger() ? null : s.toDecimal(), "Calculated exactly.", "linear_equations");
  }
  if (!m) return null;
  const [, f, v, body, arg] = m;
  let parsed;
  try {
    parsed = parseMath(body);
  } catch {
    return null;
  }
  if (parsed.rhs || [...parsed.variables].some((x) => x !== v.toLowerCase())) return null;
  let xVal: Rational;
  try {
    const p2 = parseMath(arg.replace(/\s/g, ""));
    const c = constValue(p2.lhs);
    if (!c) return null;
    xVal = c;
  } catch {
    return null;
  }
  let value: Rational | null = null;
  try {
    value = constValue(parsed.lhs, { [v.toLowerCase()]: xVal });
  } catch {
    return { status: "undefined", kind: "word", category: "functions", engine: "browser", message: `${f}(${xVal}) is undefined: it divides by zero.` };
  }
  const sub = toLatex(parsed.lhs, { [v.toLowerCase()]: xVal.toLatex() });
  if (!value) {
    const approx = analyze(sub.replace(/\\left\(|\\right\)/g, "")).decimal;
    return { status: "unsupported", kind: "word", category: "functions", engine: "browser", message: approx ? `About ${approx}, but I can only give exact answers for polynomial and fraction functions.` : "I can evaluate polynomial and fraction functions exactly." };
  }
  return result("functions", [
    { text: `Start with the function.`, latex: `${f}(${v}) = ${toLatex(parsed.lhs)}` },
    { text: `Replace every ${v} with ${xVal}.`, latex: `${f}(${xVal.toLatex()}) = ${sub}` },
    { text: "Work it out using the order of operations.", latex: `${f}(${xVal.toLatex()}) = ${value.toLatex()}` },
  ], value.toLatex(), value.toString(), value.isInteger() ? null : value.toDecimal(), "Calculated exactly by substitution.", "linear_equations");
}

/** Try the formula-style solvers. */
export function solveWordProblem(message: string): MathResult | null {
  const t = normaliseSpoken(message);
  for (const solver of [functions, percentage, statistics, geometry]) {
    try {
      const r = solver(t);
      if (r) return r;
    } catch {
      /* fall through to the next solver */
    }
  }
  return null;
}

/** Full entry point used by the assistant: word problems first, then expressions/equations. */
export function solveMathMessage(message: string): MathResult | null {
  const word = solveWordProblem(message);
  if (word) return word;
  const detected = detectMath(message);
  if (!detected) return null;
  return analyze(detected.expression, detected.variable);
}

export const SUPPORTED_MATH: { category: MathCategory; examples: string[]; notes: string }[] = [
  { category: "arithmetic", examples: ["12 × 8", "-3 * -4", "5!"], notes: "Exact whole-number and negative arithmetic, powers up to 100, factorials up to 150!" },
  { category: "fractions", examples: ["3/4 + 1/6", "0.1 + 0.2"], notes: "Exact fractions and decimals (no rounding)" },
  { category: "percentages", examples: ["20% of 50", "15 is what percent of 60", "increase 80 by 25%"], notes: "Percent of, percent change, part-of-whole" },
  { category: "equations", examples: ["3x + 7 = 22", "x^2 - 5x + 6 = 0", "x^2 = 2", "(x^2-1)/(x-1) = 2"], notes: "One unknown: linear, quadratic, rational equations, and cubic+ with rational roots; every solution is substituted back" },
  { category: "algebra", examples: ["(x+1)^2", "1/x + 1/(x+1)"], notes: "Expand and combine one-variable polynomials and fractions" },
  { category: "geometry", examples: ["area of a circle with radius 3", "hypotenuse of 3 and 4", "volume of a cylinder radius 2 height 5"], notes: "Area, perimeter, circumference, volume, Pythagorean theorem" },
  { category: "functions", examples: ["f(x) = 2x + 3, find f(4)", "slope between (1, 2) and (3, 8)"], notes: "Evaluate polynomial/fraction functions; slope of a line" },
  { category: "trigonometry", examples: ["sin(30°)", "cos(pi/3)", "tan(45°)"], notes: "Exact values at standard angles; other angles are labelled approximate" },
  { category: "statistics", examples: ["mean of 4, 8, 15, 16", "median of 3, 1, 7, 9"], notes: "Mean, median, mode, range" },
  { category: "exponents", examples: ["sqrt(72)", "2^10", "log(1000)"], notes: "Exact square roots (simplified surds), powers, logs of powers of 10" },
];

export const UNSUPPORTED_MATH = [
  "Equations with the unknown inside a square root, log, trig function or absolute value",
  "Equations or systems with more than one unknown",
  "Inequalities",
  "Polynomials of degree 3+ without rational roots",
  "Calculus (derivatives and integrals)",
  "Proofs and geometry problems that need a diagram",
];
