import type { Rational } from "./rational";

export type FnName = "sqrt" | "cbrt" | "sin" | "cos" | "tan" | "asin" | "acos" | "atan" | "log" | "ln" | "exp" | "abs";

export type Node =
  | { type: "num"; value: Rational }
  | { type: "var"; name: string }
  | { type: "const"; name: "pi" | "e" }
  | { type: "neg"; arg: Node }
  | { type: "bin"; op: "+" | "-" | "*" | "/" | "^"; left: Node; right: Node }
  | { type: "call"; fn: FnName; arg: Node }
  | { type: "fact"; arg: Node }
  | { type: "deg"; arg: Node };

export interface Parsed {
  lhs: Node;
  rhs: Node | null;
  /** Domain restrictions recorded while parsing. */
  nonzero: Node[]; // denominators
  nonnegative: Node[]; // even-root radicands, 1 - x^2 for asin/acos
  positive: Node[]; // log arguments
  variables: Set<string>;
  source: string;
}

export const isEquation = (p: Parsed): p is Parsed & { rhs: Node } => p.rhs !== null;
