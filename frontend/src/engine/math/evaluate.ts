/** Exact and numeric evaluation of parsed expressions. Pure functions over the AST; no code execution. */
import type { Node } from "./ast";
import { exactSqrt, Rational } from "./rational";
import { makeSurd, surdOf, type Surd } from "./surd";

export class UndefinedValueError extends Error {}

/**
 * Exact rational value of `n` (with optional exact variable values), or null if
 * the value is not an exact rational (pi, most roots, trig, logs) or a variable is unknown.
 * Throws RangeError on division by zero.
 */
export function constValue(n: Node, env: Record<string, Rational> = {}): Rational | null {
  switch (n.type) {
    case "num":
      return n.value;
    case "var":
      return env[n.name] ?? null;
    case "const":
      return null;
    case "neg": {
      const v = constValue(n.arg, env);
      return v ? v.neg() : null;
    }
    case "bin": {
      const l = constValue(n.left, env);
      const r = constValue(n.right, env);
      if (!l || !r) {
        // 0 * anything-defined and similar shortcuts are intentionally not applied:
        // they could hide undefined sub-expressions.
        return null;
      }
      switch (n.op) {
        case "+":
          return l.add(r);
        case "-":
          return l.sub(r);
        case "*":
          return l.mul(r);
        case "/":
          return l.div(r);
        case "^": {
          if (Math.abs(r.toNumber()) > 100) return null;
          if (r.isInteger()) return l.pow(Number(r.n));
          if (r.d === 2n) {
            const root = exactSqrt(l);
            return root ? root.pow(Number(r.n)) : null;
          }
          return null;
        }
      }
      return null;
    }
    case "call": {
      const v = constValue(n.arg, env);
      if (!v) return null;
      switch (n.fn) {
        case "abs":
          return v.abs();
        case "sqrt":
          return exactSqrt(v);
        case "cbrt": {
          const guess = Math.round(Math.cbrt(v.toNumber()) * 1e6) / 1e6;
          if (!Number.isFinite(guess)) return null;
          for (const cand of [Math.round(guess)]) {
            const c = Rational.of(cand);
            if (c.pow(3).equals(v)) return c;
          }
          return null;
        }
        case "log": {
          // exact only for powers of ten
          if (v.isNegative() || v.isZero()) return null;
          const s = v.isInteger() ? v.n.toString() : v.n === 1n ? v.d.toString() : "";
          if (/^10*$/.test(s)) return Rational.of((v.isInteger() ? 1 : -1) * (s.length - 1));
          return null;
        }
        default:
          return null;
      }
    }
    case "fact": {
      const v = constValue(n.arg, env);
      if (!v || !v.isInteger() || v.isNegative() || v.toNumber() > 150) return null;
      let acc = 1n;
      for (let i = 2n; i <= v.n; i++) acc *= i;
      return new Rational(acc);
    }
    case "deg":
      return null;
  }
}

/** Floating-point value. Returns NaN/Infinity for undefined results; callers must check. */
export function numValue(n: Node, env: Record<string, number> = {}): number {
  switch (n.type) {
    case "num":
      return n.value.toNumber();
    case "var":
      return n.name in env ? env[n.name] : NaN;
    case "const":
      return n.name === "pi" ? Math.PI : Math.E;
    case "neg":
      return -numValue(n.arg, env);
    case "bin": {
      const l = numValue(n.left, env);
      const r = numValue(n.right, env);
      switch (n.op) {
        case "+":
          return l + r;
        case "-":
          return l - r;
        case "*":
          return l * r;
        case "/":
          return r === 0 ? NaN : l / r;
        case "^":
          return Math.pow(l, r);
      }
      return NaN;
    }
    case "call": {
      const v = numValue(n.arg, env);
      switch (n.fn) {
        case "sqrt":
          return v < 0 ? NaN : Math.sqrt(v);
        case "cbrt":
          return Math.cbrt(v);
        case "sin":
          return Math.sin(v);
        case "cos":
          return Math.cos(v);
        case "tan":
          return Math.abs(Math.cos(v)) < 1e-12 ? NaN : Math.tan(v);
        case "asin":
          return Math.asin(v);
        case "acos":
          return Math.acos(v);
        case "atan":
          return Math.atan(v);
        case "log":
          return v <= 0 ? NaN : Math.log10(v);
        case "ln":
          return v <= 0 ? NaN : Math.log(v);
        case "exp":
          return Math.exp(v);
        case "abs":
          return Math.abs(v);
      }
      return NaN;
    }
    case "fact": {
      const v = numValue(n.arg, env);
      if (!Number.isInteger(v) || v < 0 || v > 170) return NaN;
      let acc = 1;
      for (let i = 2; i <= v; i++) acc *= i;
      return acc;
    }
    case "deg":
      return (numValue(n.arg, env) * Math.PI) / 180;
  }
}

/** If `n` is an exact rational multiple of pi (e.g. 30°, pi/6, 2pi), return that multiple. */
export function piMultiple(n: Node): Rational | null {
  try {
    if (n.type === "const" && n.name === "pi") return Rational.ONE;
    if (n.type === "deg") {
      const v = constValue(n.arg);
      return v ? v.div(Rational.of(180)) : null;
    }
    if (n.type === "neg") return piMultiple(n.arg)?.neg() ?? null;
    if (n.type === "bin" && n.op === "*") {
      const lp = piMultiple(n.left);
      const rc = constValue(n.right);
      if (lp && rc) return lp.mul(rc);
      const rp = piMultiple(n.right);
      const lc = constValue(n.left);
      if (rp && lc) return rp.mul(lc);
    }
    if (n.type === "bin" && n.op === "/") {
      const lp = piMultiple(n.left);
      const rc = constValue(n.right);
      if (lp && rc && !rc.isZero()) return lp.div(rc);
    }
    const c = constValue(n);
    if (c && c.isZero()) return Rational.ZERO;
  } catch {
    return null;
  }
  return null;
}

const HALF = new Rational(1n, 2n);

/** sin(k·pi) for k a multiple of 1/12 that hits a standard angle (0, 30, 45, 60, 90 ... degrees). */
function sinOfPiMultiple(k: Rational): Surd | null {
  // reduce angle to degrees in [0, 360)
  const deg = k.mul(Rational.of(180));
  if (!deg.isInteger()) return null;
  let d = Number(((deg.n % 360n) + 360n) % 360n);
  let sign = Rational.ONE;
  if (d >= 180) {
    d -= 180;
    sign = sign.neg();
  }
  if (d > 90) d = 180 - d;
  const table: Record<number, Surd> = {
    0: surdOf(Rational.ZERO),
    30: surdOf(HALF),
    45: makeSurd(Rational.ZERO, HALF, Rational.of(2)),
    60: makeSurd(Rational.ZERO, HALF, Rational.of(3)),
    90: surdOf(Rational.ONE),
  };
  const v = table[d];
  return v ? { a: v.a.mul(sign), b: v.b.mul(sign), m: v.m } : null;
}

/** Exact value of sin/cos/tan at a standard angle, or null. Throws UndefinedValueError for tan(90°) etc. */
export function exactTrig(fn: "sin" | "cos" | "tan", arg: Node): Surd | null {
  const k = piMultiple(arg);
  if (!k) return null;
  if (fn === "sin") return sinOfPiMultiple(k);
  if (fn === "cos") return sinOfPiMultiple(HALF.sub(k)); // cos x = sin(90° - x)
  const s = sinOfPiMultiple(k);
  const c = sinOfPiMultiple(HALF.sub(k));
  if (!s || !c) return null;
  const sv = s.b.isZero() ? s.a : null;
  const cv = c.b.isZero() ? c.a : null;
  if (cv && cv.isZero()) throw new UndefinedValueError("tan is undefined at this angle (cos = 0).");
  if (sv && cv) return surdOf(sv.div(cv));
  // tan 30 = √3/3, tan 60 = √3, tan 45 = 1 handled numerically then matched
  const ratio = numValue({ type: "call", fn: "tan", arg });
  for (const cand of [makeSurd(Rational.ZERO, new Rational(1n, 3n), Rational.of(3)), makeSurd(Rational.ZERO, Rational.ONE, Rational.of(3))]) {
    for (const sgn of [1, -1]) {
      const val = sgn * cand.b.toNumber() * Math.sqrt(Number(cand.m));
      if (Math.abs(val - ratio) < 1e-12) return { a: Rational.ZERO, b: sgn === 1 ? cand.b : cand.b.neg(), m: cand.m };
    }
  }
  return Math.abs(ratio - 1) < 1e-12 ? surdOf(Rational.ONE) : Math.abs(ratio + 1) < 1e-12 ? surdOf(Rational.ONE.neg()) : null;
}
