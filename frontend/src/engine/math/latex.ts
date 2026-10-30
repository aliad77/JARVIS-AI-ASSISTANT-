import type { Node } from "./ast";

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 4 };

function prec(n: Node): number {
  if (n.type === "bin") return PREC[n.op];
  if (n.type === "neg") return 3;
  return 5;
}

function wrap(s: string, need: boolean): string {
  return need ? `\\left(${s}\\right)` : s;
}

const FN_TEX: Record<string, string> = {
  sin: "\\sin", cos: "\\cos", tan: "\\tan", asin: "\\arcsin", acos: "\\arccos", atan: "\\arctan",
  log: "\\log", ln: "\\ln", exp: "\\exp",
};

/** LaTeX for an AST, with optional variable substitution text (for showing checks like 3 × 5 + 7). */
export function toLatex(n: Node, subs: Record<string, string> = {}): string {
  switch (n.type) {
    case "num":
      return n.value.toLatex();
    case "var":
      return n.name in subs ? `\\left(${subs[n.name]}\\right)` : n.name;
    case "const":
      return n.name === "pi" ? "\\pi" : "e";
    case "neg":
      return `-${wrap(toLatex(n.arg, subs), prec(n.arg) <= 2 || (n.arg.type === "num" && n.arg.value.isNegative()))}`;
    case "deg":
      return `${wrap(toLatex(n.arg, subs), prec(n.arg) < 5)}^{\\circ}`;
    case "fact":
      return `${wrap(toLatex(n.arg, subs), prec(n.arg) < 5)}!`;
    case "call":
      if (n.fn === "sqrt") return `\\sqrt{${toLatex(n.arg, subs)}}`;
      if (n.fn === "cbrt") return `\\sqrt[3]{${toLatex(n.arg, subs)}}`;
      if (n.fn === "abs") return `\\left|${toLatex(n.arg, subs)}\\right|`;
      return `${FN_TEX[n.fn]}\\left(${toLatex(n.arg, subs)}\\right)`;
    case "bin": {
      const l = toLatex(n.left, subs);
      const r = toLatex(n.right, subs);
      switch (n.op) {
        case "/":
          return `\\frac{${l}}{${r}}`;
        case "^":
          return `${wrap(l, prec(n.left) < 5 || (n.left.type === "num" && (n.left.value.isNegative() || !n.left.value.isInteger())))}^{${r}}`;
        case "*": {
          // implicit multiplication for number·variable, explicit × otherwise or when substituting
          const implicit =
            Object.keys(subs).length === 0 &&
            n.left.type === "num" &&
            (n.right.type === "var" || n.right.type === "const" || (n.right.type === "bin" && n.right.op === "^" && n.right.left.type === "var"));
          const ls = wrap(l, prec(n.left) < 2);
          const rs = wrap(r, prec(n.right) < 2 || n.right.type === "neg" || (n.right.type === "num" && n.right.value.isNegative()));
          return implicit ? `${ls}${rs}` : `${ls} \\times ${rs}`;
        }
        case "+":
          return `${l} + ${wrap(r, n.right.type === "neg")}`;
        case "-":
          return `${l} - ${wrap(r, prec(n.right) <= 1 || n.right.type === "neg")}`;
      }
    }
  }
}
