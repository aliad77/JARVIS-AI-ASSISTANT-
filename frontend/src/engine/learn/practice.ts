/**
 * Locally generated math practice (port of backend/app/education/practice.py).
 * Every answer key is an exact rational computed here and re-checked by the
 * browser math engine in tests.
 */
import { Rational } from "../math/rational";

export type Grade = 7 | 8 | 9 | 10 | 11 | 12;
export const GRADES: Grade[] = [7, 8, 9, 10, 11, 12];

export interface MathProblem {
  topic: string;
  prompt: string;
  latex: string;
  expected: string; // e.g. "5", "3/4", "2, 3"
  answerLatex: string;
  hint: string;
  choices?: string[]; // LaTeX
  correctIndex?: number;
}

/** Small seedable PRNG (mulberry32) so tests are reproducible. */
export function rng(seed = Date.now() >>> 0) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)],
    shuffle: <T,>(xs: T[]): T[] => {
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      return xs;
    },
  };
}
export type Rng = ReturnType<typeof rng>;

const SCALE: Record<Grade, number> = { 7: 12, 8: 15, 9: 20, 10: 25, 11: 30, 12: 40 };
const q = (n: number, d = 1) => new Rational(BigInt(n), BigInt(d));

function arithmetic(r: Rng, g: Grade): MathProblem {
  const top = SCALE[g];
  let a = r.int(2, top);
  let b = r.int(2, top);
  const op = r.pick(g >= 8 ? (["*", "+", "-", "neg"] as const) : (["*", "+", "-"] as const));
  if (op === "neg") {
    a = -a;
    return { topic: "arithmetic", prompt: "Calculate:", latex: `(${a}) \\times ${b}`, expected: String(a * b), answerLatex: String(a * b), hint: "A negative times a positive is negative." };
  }
  if (op === "*") return { topic: "arithmetic", prompt: "Calculate:", latex: `${a} \\times ${b}`, expected: String(a * b), answerLatex: String(a * b), hint: "Break one number into tens and ones, multiply each part, then add." };
  if (op === "+") {
    a *= 7;
    b *= 9;
    return { topic: "arithmetic", prompt: "Calculate:", latex: `${a} + ${b}`, expected: String(a + b), answerLatex: String(a + b), hint: "Add the ones, then the tens, then the hundreds." };
  }
  a *= 9;
  b *= 4;
  return { topic: "arithmetic", prompt: "Calculate:", latex: `${a} - ${b}`, expected: String(a - b), answerLatex: String(a - b), hint: "If the answer would go below zero, the result is negative." };
}

function fractions(r: Rng, g: Grade): MathProblem {
  const d1 = r.pick([2, 3, 4, 5, 6, 8]);
  const d2 = r.pick([2, 3, 4, 5, 6, 10]);
  const n1 = r.int(1, d1 - 1);
  const n2 = r.int(1, d2 - 1);
  const f1 = q(n1, d1);
  const f2 = q(n2, d2);
  const op = r.pick(g >= 8 ? (["+", "-", "*", "/"] as const) : (["+", "-", "*"] as const));
  const value = op === "+" ? f1.add(f2) : op === "-" ? f1.sub(f2) : op === "*" ? f1.mul(f2) : f1.div(f2);
  const tex = { "+": "+", "-": "-", "*": "\\times", "/": "\\div" }[op];
  const hint = {
    "+": "Find a common denominator, then add the numerators.",
    "-": "Find a common denominator, then subtract the numerators.",
    "*": "Multiply the tops together and the bottoms together, then simplify.",
    "/": "Dividing by a fraction is the same as multiplying by its reciprocal (flip it).",
  }[op];
  return { topic: "fractions", prompt: "Calculate and simplify:", latex: `\\frac{${n1}}{${d1}} ${tex} \\frac{${n2}}{${d2}}`, expected: value.toString(), answerLatex: value.toLatex(), hint };
}

function percentages(r: Rng, g: Grade): MathProblem {
  const pct = r.pick([5, 10, 15, 20, 25, 30, 40, 50, 75, ...(g >= 9 ? [12, 35, 65] : [])]);
  const base = r.pick([20, 40, 60, 80, 120, 200, 250, 360, 400]);
  const v = q(pct, 100).mul(q(base));
  return { topic: "percentages", prompt: `What is ${pct}% of ${base}?`, latex: `${pct}\\% \\times ${base}`, expected: v.toString(), answerLatex: v.toLatex(), hint: "Percent means 'out of 100'. Change the percent to a fraction, then multiply." };
}

function linear(r: Rng, g: Grade): MathProblem {
  const sol = r.int(g >= 8 ? -9 : 1, 12);
  const a = r.pick([2, 3, 4, 5, 6, 7, ...(g >= 9 ? [-2, -3, -5] : [])]);
  const b = r.int(-15, 20);
  const c = a * sol + b;
  const term = (coef: number, k: number) => `${coef}x ${k < 0 ? "-" : "+"} ${Math.abs(k)}`;
  let latex = `${term(a, b)} = ${c}`;
  const k = r.pick([1, 2, 3]);
  if (g >= 9 && r.next() < 0.5 && Math.abs(a + k) > 1) {
    latex = `${term(a + k, b)} = ${k === 1 ? "" : k}x ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
  }
  return { topic: "linear_equations", prompt: "Solve for x:", latex, expected: String(sol), answerLatex: `x = ${sol}`, hint: "Undo the adding or subtracting first, then undo the multiplying by dividing both sides." };
}

function quadratics(r: Rng): MathProblem {
  const r1 = r.int(-7, 7);
  const r2 = r.int(-7, 7);
  const b = -(r1 + r2);
  const c = r1 * r2;
  const roots = [...new Set([r1, r2])].sort((x, y) => x - y);
  const bt = b === 0 ? "" : ` ${b < 0 ? "-" : "+"} ${Math.abs(b) === 1 ? "" : Math.abs(b)}x`;
  const ct = c === 0 ? "" : ` ${c < 0 ? "-" : "+"} ${Math.abs(c)}`;
  return {
    topic: "quadratics",
    prompt: "Solve for x (give every solution, separated by commas):",
    latex: `x^{2}${bt}${ct} = 0`,
    expected: roots.join(", "),
    answerLatex: roots.map((x) => `x = ${x}`).join(", "),
    hint: "Look for two numbers that multiply to the constant term and add to the x coefficient.",
  };
}

function exponents(r: Rng, g: Grade): MathProblem {
  const base = r.int(2, 6);
  const e1 = r.int(1, 4);
  const e2 = r.int(1, 3);
  if (g >= 9 && r.next() < 0.4) {
    const v = q(base).pow(e1 - e2 - 1);
    return { topic: "exponents", prompt: "Calculate:", latex: `\\frac{${base}^{${e1}}}{${base}^{${e2 + 1}}}`, expected: v.toString(), answerLatex: v.toLatex(), hint: "When dividing powers with the same base, subtract the exponents." };
  }
  const v = q(base).pow(e1 + e2);
  return { topic: "exponents", prompt: "Calculate:", latex: `${base}^{${e1}} \\times ${base}^{${e2}}`, expected: v.toString(), answerLatex: v.toLatex(), hint: "When multiplying powers with the same base, add the exponents." };
}

function geometry(r: Rng): MathProblem {
  if (r.next() < 0.5) {
    const w = r.int(3, 15);
    const h = r.int(3, 15);
    return { topic: "geometry", prompt: `A rectangle is ${w} cm wide and ${h} cm tall. What is its area in cm²?`, latex: `A = ${w} \\times ${h}`, expected: String(w * h), answerLatex: String(w * h), hint: "Area of a rectangle = width × height." };
  }
  const b = r.int(2, 14) * 2;
  const h = r.int(3, 12);
  return { topic: "geometry", prompt: `A triangle has base ${b} cm and height ${h} cm. What is its area in cm²?`, latex: `A = \\tfrac{1}{2} \\times ${b} \\times ${h}`, expected: String((b * h) / 2), answerLatex: String((b * h) / 2), hint: "Area of a triangle = ½ × base × height." };
}

function statistics(r: Rng): MathProblem {
  const n = r.pick([4, 5]);
  const vals = Array.from({ length: n }, () => r.int(1, 20));
  const mean = q(vals.reduce((a, b) => a + b, 0), n);
  return { topic: "statistics", prompt: `Find the mean of these numbers: ${vals.join(", ")}`, latex: `\\text{mean} = \\frac{${vals.join(" + ")}}{${n}}`, expected: mean.toString(), answerLatex: mean.toLatex(), hint: "Add all the numbers, then divide by how many numbers there are." };
}

export const GENERATORS: Record<string, (r: Rng, g: Grade) => MathProblem> = {
  arithmetic, fractions, percentages, linear_equations: linear, quadratics: (r) => quadratics(r),
  exponents, geometry: (r) => geometry(r), statistics: (r) => statistics(r),
};

export const MATH_TOPICS: Record<string, string> = {
  arithmetic: "Arithmetic", fractions: "Fractions", percentages: "Percentages", linear_equations: "Linear equations",
  quadratics: "Quadratic equations", exponents: "Exponents", geometry: "Geometry (area)", statistics: "Statistics (mean)",
};

export const GRADE_TOPICS: Record<Grade, string[]> = {
  7: ["arithmetic", "fractions", "percentages", "linear_equations", "geometry", "statistics"],
  8: ["arithmetic", "fractions", "percentages", "linear_equations", "exponents", "geometry", "statistics"],
  9: ["fractions", "percentages", "linear_equations", "quadratics", "exponents", "statistics"],
  10: ["linear_equations", "quadratics", "exponents", "geometry", "statistics", "percentages"],
  11: ["linear_equations", "quadratics", "exponents", "statistics"],
  12: ["linear_equations", "quadratics", "exponents", "statistics"],
};

export function generateProblem(topic: string | null | undefined, grade: Grade, r: Rng = rng()): MathProblem {
  const t = topic && topic in GENERATORS ? topic : r.pick(GRADE_TOPICS[grade]);
  return GENERATORS[t](r, grade);
}

/** Attach four distinct choices (one correct). */
export function toMultipleChoice(p: MathProblem, r: Rng = rng()): MathProblem {
  const parts = p.expected.split(",").map((s) => s.trim());
  let correct: string;
  const options = new Set<string>();
  if (parts.length > 1) {
    const roots = parts.map((s) => Rational.fromString(s));
    const show = (rs: Rational[]) => [...rs].sort((a, b) => a.compare(b)).map((x) => `x = ${x.toLatex()}`).join(", ");
    correct = show(roots);
    options.add(correct);
    for (const fake of [roots.map((x) => x.neg()), roots.map((x) => x.add(Rational.ONE)), roots.map((x) => x.mul(q(2))), [roots[0], roots[1].neg()]]) {
      const s = show(fake);
      if (s !== correct) options.add(s);
      if (options.size === 4) break;
    }
    let k = 10;
    while (options.size < 4) options.add(`x = ${k++}`);
  } else {
    const v = Rational.fromString(parts[0]);
    const prefix = p.topic === "linear_equations" ? "x = " : "";
    correct = prefix + v.toLatex();
    options.add(correct);
    const pool = [v.neg(), v.add(Rational.ONE), v.sub(Rational.ONE), v.mul(q(2)), v.add(q(10)), v.sub(q(2)), v.add(q(1, 2))];
    if (!v.isInteger() && !v.isZero()) pool.push(new Rational(v.d, v.n));
    for (const c of r.shuffle(pool)) {
      if (!c.equals(v)) options.add(prefix + c.toLatex());
      if (options.size === 4) break;
    }
  }
  const choices = r.shuffle([...options]);
  return { ...p, choices, correctIndex: choices.indexOf(correct) };
}
