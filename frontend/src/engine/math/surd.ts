/** Numbers of the form a + b·√m (m a square-free positive integer), e.g. quadratic roots and exact trig values. */
import { Rational, simplifySqrt } from "./rational";

export interface Surd {
  a: Rational;
  b: Rational;
  m: bigint; // 1 means "no radical"
}

export const surdOf = (a: Rational): Surd => ({ a, b: Rational.ZERO, m: 1n });

export function isRational(s: Surd): boolean {
  return s.b.isZero() || s.m === 1n;
}

export function surdValue(s: Surd): Rational | null {
  if (s.b.isZero()) return s.a;
  if (s.m === 1n) return s.a.add(s.b);
  return null;
}

/** a + b·sqrt(r) for rational r >= 0, simplified. */
export function makeSurd(a: Rational, b: Rational, r: Rational): Surd {
  if (b.isZero() || r.isZero()) return surdOf(a);
  const { coeff, radicand } = simplifySqrt(r);
  if (radicand === 1n) return surdOf(a.add(b.mul(coeff)));
  return { a, b: b.mul(coeff), m: radicand };
}

export function surdToNumber(s: Surd): number {
  return s.a.toNumber() + s.b.toNumber() * Math.sqrt(Number(s.m));
}

function sqrtPart(b: Rational, m: bigint, forText: boolean): string {
  const absB = b.abs();
  const root = forText ? `√${m}` : `\\sqrt{${m}}`;
  if (absB.equals(Rational.ONE)) return root;
  if (absB.isInteger()) return forText ? `${absB}${root}` : `${absB}${root}`;
  // (p/q)·√m -> p√m / q
  return forText
    ? `${absB.n === 1n ? "" : absB.n}${root}/${absB.d}`
    : `\\frac{${absB.n === 1n ? "" : absB.n}${root}}{${absB.d}}`;
}

export function surdToLatex(s: Surd): string {
  const v = surdValue(s);
  if (v) return v.toLatex();
  const rad = sqrtPart(s.b, s.m, false);
  if (s.a.isZero()) return (s.b.isNegative() ? "-" : "") + rad;
  return `${s.a.toLatex()} ${s.b.isNegative() ? "-" : "+"} ${rad}`;
}

export function surdToText(s: Surd): string {
  const v = surdValue(s);
  if (v) return v.toString();
  const rad = sqrtPart(s.b, s.m, true);
  if (s.a.isZero()) return (s.b.isNegative() ? "-" : "") + rad;
  return `${s.a} ${s.b.isNegative() ? "-" : "+"} ${rad}`;
}
