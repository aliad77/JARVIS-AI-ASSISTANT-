/**
 * Polynomials and rational functions with exact rational coefficients in one variable.
 * Used to solve linear, quadratic, and (when they have rational roots) higher-degree
 * and rational equations exactly.
 */
import type { Node } from "./ast";
import { constValue } from "./evaluate";
import { isqrt, Rational } from "./rational";
import { makeSurd, surdOf, type Surd } from "./surd";

export type Poly = Rational[]; // index = degree
export interface RatFunc {
  num: Poly;
  den: Poly;
}

export const MAX_DEGREE = 12;

export class NotPolynomialError extends Error {}

export function trim(p: Poly): Poly {
  const out = [...p];
  while (out.length > 1 && out[out.length - 1].isZero()) out.pop();
  return out.length ? out : [Rational.ZERO];
}

export const degree = (p: Poly): number => (trim(p).length === 1 && trim(p)[0].isZero() ? -Infinity : trim(p).length - 1);
export const isZeroPoly = (p: Poly) => degree(p) === -Infinity;

function addP(a: Poly, b: Poly): Poly {
  const out: Poly = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) out.push((a[i] ?? Rational.ZERO).add(b[i] ?? Rational.ZERO));
  return trim(out);
}
export function scaleP(a: Poly, k: Rational): Poly {
  return trim(a.map((c) => c.mul(k)));
}
function mulP(a: Poly, b: Poly): Poly {
  if (a.length + b.length - 2 > MAX_DEGREE) throw new NotPolynomialError("degree too high");
  const out: Poly = Array.from({ length: a.length + b.length - 1 }, () => Rational.ZERO);
  a.forEach((x, i) => b.forEach((y, j) => (out[i + j] = out[i + j].add(x.mul(y)))));
  return trim(out);
}
const constP = (r: Rational): Poly => [r];

export function evalPoly(p: Poly, x: Rational): Rational {
  return p.reduceRight((acc, c) => acc.mul(x).add(c), Rational.ZERO);
}

const rf = (num: Poly, den: Poly = constP(Rational.ONE)): RatFunc => ({ num, den });

function rfAdd(a: RatFunc, b: RatFunc, sign = 1): RatFunc {
  const right = mulP(b.num, a.den);
  return rf(addP(mulP(a.num, b.den), sign === 1 ? right : scaleP(right, Rational.ONE.neg())), mulP(a.den, b.den));
}

/** Convert an AST into a rational function of `v`. Throws NotPolynomialError when it isn't one. */
export function toRatFunc(n: Node, v: string): RatFunc {
  switch (n.type) {
    case "num":
      return rf(constP(n.value));
    case "var":
      if (n.name !== v) throw new NotPolynomialError("other variable");
      return rf([Rational.ZERO, Rational.ONE]);
    case "neg": {
      const a = toRatFunc(n.arg, v);
      return rf(scaleP(a.num, Rational.ONE.neg()), a.den);
    }
    case "bin": {
      if (n.op === "^") {
        const e = constValue(n.right);
        if (!e || !e.isInteger() || Math.abs(Number(e.n)) > MAX_DEGREE) throw new NotPolynomialError("non-integer power");
        const base = toRatFunc(n.left, v);
        let k = Number(e.n);
        let num: Poly = constP(Rational.ONE);
        let den: Poly = constP(Rational.ONE);
        const neg = k < 0;
        k = Math.abs(k);
        for (let i = 0; i < k; i++) {
          num = mulP(num, base.num);
          den = mulP(den, base.den);
        }
        return neg ? rf(den, num) : rf(num, den);
      }
      const a = toRatFunc(n.left, v);
      const b = toRatFunc(n.right, v);
      if (n.op === "+") return rfAdd(a, b);
      if (n.op === "-") return rfAdd(a, b, -1);
      if (n.op === "*") return rf(mulP(a.num, b.num), mulP(a.den, b.den));
      if (isZeroPoly(b.num)) throw new NotPolynomialError("division by zero");
      return rf(mulP(a.num, b.den), mulP(a.den, b.num));
    }
    default: {
      // functions, factorials, constants: allowed only when they are exact rational constants
      const c = constValue(n);
      if (c) return rf(constP(c));
      throw new NotPolynomialError("not a rational function");
    }
  }
}

/** If the node is a polynomial in v (no division by v), return its coefficients. */
export function toPoly(n: Node, v: string): Poly | null {
  try {
    const r = toRatFunc(n, v);
    if (degree(r.den) !== 0) return null;
    return scaleP(r.num, Rational.ONE.div(r.den[0]));
  } catch {
    return null;
  }
}

function divisors(n: bigint): bigint[] {
  n = n < 0n ? -n : n;
  if (n === 0n || n > 10n ** 12n) return [];
  const out: bigint[] = [];
  const limit = isqrt(n);
  for (let i = 1n; i <= limit && i <= 1000000n; i++) {
    if (n % i === 0n) {
      out.push(i);
      if (i !== n / i) out.push(n / i);
    }
  }
  return out;
}

/** Divide p by (x - r) (r must be a root). */
function deflate(p: Poly, r: Rational): Poly {
  const n = p.length - 1;
  const out: Rational[] = Array.from({ length: n }, () => Rational.ZERO);
  let carry = Rational.ZERO;
  for (let i = n; i >= 1; i--) {
    carry = carry.mul(r).add(p[i]);
    out[i - 1] = carry;
  }
  return trim(out);
}

export interface RootResult {
  real: Surd[]; // distinct real roots
  complex: { re: Rational; imSq: Rational }[]; // re ± i·sqrt(imSq)
  complete: boolean; // false when part of the polynomial couldn't be solved exactly
}

/** Exact real roots for polynomials that factor into rational roots plus at most one quadratic. */
export function solvePoly(input: Poly): RootResult {
  let p = trim(input);
  const real: Surd[] = [];
  const seen = new Set<string>();
  const push = (s: Surd) => {
    const key = `${s.a}|${s.b}|${s.m}`;
    if (!seen.has(key)) {
      seen.add(key);
      real.push(s);
    }
  };
  // factor out x = 0
  while (degree(p) > 0 && p[0].isZero()) {
    push(surdOf(Rational.ZERO));
    p = trim(p.slice(1));
  }
  // rational root theorem on the integer-scaled polynomial
  while (degree(p) > 2) {
    const lcm = p.reduce((acc, c) => (acc * c.d) / gcdBig(acc, c.d), 1n);
    const ints = p.map((c) => c.mul(new Rational(lcm)).n);
    const cands: Rational[] = [];
    for (const a of divisors(ints[0])) for (const b of divisors(ints[ints.length - 1])) cands.push(new Rational(a, b), new Rational(-a, b));
    const root = cands.find((c) => evalPoly(p, c).isZero());
    if (!root) return { real, complex: [], complete: false };
    push(surdOf(root));
    p = deflate(p, root);
    while (degree(p) > 0 && evalPoly(p, root).isZero()) p = deflate(p, root);
  }
  const complex: RootResult["complex"] = [];
  if (degree(p) === 1) {
    push(surdOf(p[0].neg().div(p[1])));
  } else if (degree(p) === 2) {
    const [c, b, a] = p;
    const disc = b.mul(b).sub(Rational.of(4).mul(a).mul(c));
    const twoA = Rational.of(2).mul(a);
    const re = b.neg().div(twoA);
    if (disc.isNegative()) {
      complex.push({ re, imSq: disc.neg().div(twoA.mul(twoA)) });
    } else {
      const half = Rational.ONE.div(twoA.abs());
      push(makeSurd(re, half.neg(), disc));
      push(makeSurd(re, half, disc));
    }
  }
  return { real, complex, complete: true };
}

function gcdBig(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a || 1n;
}

export function polyToLatex(p: Poly, v: string): string {
  const parts: string[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const c = p[i];
    if (c.isZero()) continue;
    const abs = c.abs();
    const coef = i === 0 ? abs.toLatex() : abs.equals(Rational.ONE) ? "" : abs.toLatex();
    const term = i === 0 ? coef : `${coef}${v}${i > 1 ? `^{${i}}` : ""}`;
    parts.push(parts.length === 0 ? (c.isNegative() ? `-${term}` : term) : `${c.isNegative() ? "-" : "+"} ${term}`);
  }
  return parts.length ? parts.join(" ") : "0";
}
