/**
 * Exact rational numbers using BigInt. Every operation returns a reduced
 * fraction with a positive denominator, so 0.1 + 0.2 is exactly 3/10.
 */

export const MAX_BITS = 8000; // ~2400 decimal digits, same limit as the Python engine

export class MathLimitError extends Error {}

function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) [a, b] = [b, a % b];
  return a;
}

function bitLength(n: bigint): number {
  return (n < 0n ? -n : n).toString(2).length;
}

export class Rational {
  readonly n: bigint;
  readonly d: bigint;

  constructor(n: bigint, d: bigint = 1n) {
    if (d === 0n) throw new RangeError("division by zero");
    if (d < 0n) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
    if (bitLength(this.n) > MAX_BITS || bitLength(this.d) > MAX_BITS) {
      throw new MathLimitError("That number is too large to check safely.");
    }
  }

  static of(v: number | bigint): Rational {
    if (typeof v === "bigint") return new Rational(v);
    if (!Number.isInteger(v)) throw new TypeError("use Rational.parse for decimals");
    return new Rational(BigInt(v));
  }

  /** Parse "12", "0.25", ".5" exactly. */
  static parse(text: string): Rational {
    if (!/^(\d+(\.\d+)?|\.\d+)$/.test(text)) throw new TypeError("bad number");
    const [int, frac = ""] = text.split(".");
    const scale = 10n ** BigInt(frac.length);
    return new Rational(BigInt((int || "0") + frac), scale);
  }

  /** Parse a signed integer, decimal or fraction: "-5", "0.25", "-3/4". */
  static fromString(text: string): Rational {
    const t = text.trim();
    const m = /^(-?)(\d+(?:\.\d+)?|\.\d+)(?:\/(\d+))?$/.exec(t);
    if (!m) throw new TypeError("bad number");
    let r = Rational.parse(m[2]);
    if (m[3] !== undefined) r = r.div(new Rational(BigInt(m[3])));
    return m[1] ? r.neg() : r;
  }

  static readonly ZERO = new Rational(0n);
  static readonly ONE = new Rational(1n);

  add(o: Rational): Rational {
    return new Rational(this.n * o.d + o.n * this.d, this.d * o.d);
  }
  sub(o: Rational): Rational {
    return new Rational(this.n * o.d - o.n * this.d, this.d * o.d);
  }
  mul(o: Rational): Rational {
    return new Rational(this.n * o.n, this.d * o.d);
  }
  div(o: Rational): Rational {
    if (o.n === 0n) throw new RangeError("division by zero");
    return new Rational(this.n * o.d, this.d * o.n);
  }
  neg(): Rational {
    return new Rational(-this.n, this.d);
  }
  abs(): Rational {
    return this.n < 0n ? this.neg() : this;
  }
  /** Integer power (exponent must be an integer with |e| <= 100, enforced by the parser). */
  pow(e: number): Rational {
    if (!Number.isInteger(e)) throw new TypeError("integer exponent required");
    if (e < 0) {
      if (this.n === 0n) throw new RangeError("division by zero");
      return new Rational(this.d ** BigInt(-e), this.n ** BigInt(-e));
    }
    return new Rational(this.n ** BigInt(e), this.d ** BigInt(e));
  }
  isZero(): boolean {
    return this.n === 0n;
  }
  isInteger(): boolean {
    return this.d === 1n;
  }
  isNegative(): boolean {
    return this.n < 0n;
  }
  equals(o: Rational): boolean {
    return this.n === o.n && this.d === o.d;
  }
  compare(o: Rational): number {
    const diff = this.n * o.d - o.n * this.d;
    return diff === 0n ? 0 : diff < 0n ? -1 : 1;
  }
  bits(): number {
    return Math.max(bitLength(this.n), bitLength(this.d));
  }
  toNumber(): number {
    // Scale down huge values to keep precision reasonable.
    const nb = bitLength(this.n);
    const db = bitLength(this.d);
    if (nb < 1000 && db < 1000) return Number(this.n) / Number(this.d);
    const shift = BigInt(Math.max(nb, db) - 900);
    return Number(this.n >> shift) / Number(this.d >> shift);
  }
  toString(): string {
    return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`;
  }
  toLatex(): string {
    if (this.d === 1n) return this.n.toString();
    const sign = this.n < 0n ? "-" : "";
    return `${sign}\\frac{${(this.n < 0n ? -this.n : this.n).toString()}}{${this.d.toString()}}`;
  }
  /** Decimal approximation string, trimmed. */
  toDecimal(digits = 10): string {
    const v = this.toNumber();
    if (!Number.isFinite(v)) return this.toString();
    return Number(v.toPrecision(digits)).toString();
  }
}

/** Integer square root (floor) for non-negative BigInt. */
export function isqrt(n: bigint): bigint {
  if (n < 0n) throw new RangeError("negative");
  if (n < 2n) return n;
  // Newton's method from a starting point guaranteed to be >= sqrt(n).
  let x = 1n << BigInt(Math.ceil(bitLength(n) / 2) + 1);
  let y = (x + n / x) >> 1n;
  while (y < x) {
    x = y;
    y = (x + n / x) >> 1n;
  }
  return x;
}

/** Exact square root of a rational, or null if it isn't a perfect square. */
export function exactSqrt(r: Rational): Rational | null {
  if (r.isNegative()) return null;
  const a = isqrt(r.n);
  const b = isqrt(r.d);
  return a * a === r.n && b * b === r.d ? new Rational(a, b) : null;
}

/**
 * Simplify sqrt(r) for r >= 0 into coeff * sqrt(radicand) with integer radicand,
 * e.g. sqrt(8) = 2*sqrt(2), sqrt(1/2) = (1/2)*sqrt(2).
 */
export function simplifySqrt(r: Rational): { coeff: Rational; radicand: bigint } {
  if (r.isNegative()) throw new RangeError("negative radicand");
  // sqrt(n/d) = sqrt(n*d)/d
  let m = r.n * r.d;
  let outside = 1n;
  if (m > 10n ** 24n) return { coeff: new Rational(1n, r.d), radicand: m }; // too big to factor quickly
  for (let p = 2n; p * p <= m; p += p === 2n ? 1n : 2n) {
    while (m % (p * p) === 0n) {
      m /= p * p;
      outside *= p;
    }
    if (p > 100000n) break;
  }
  return { coeff: new Rational(outside, r.d), radicand: m };
}
