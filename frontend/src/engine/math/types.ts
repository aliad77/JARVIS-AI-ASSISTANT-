export type MathStatus =
  | "verified" // computed exactly and checked
  | "approximate" // computed numerically (e.g. sin 20°); not an exact symbolic result
  | "no_solution"
  | "undefined"
  | "unverified"
  | "unsupported"
  | "error";

export type MathCategory =
  | "arithmetic"
  | "fractions"
  | "percentages"
  | "equations"
  | "algebra"
  | "geometry"
  | "functions"
  | "trigonometry"
  | "statistics"
  | "exponents";

export interface MathStep {
  text: string;
  latex: string;
}

export interface MathSolution {
  value_text: string;
  value_latex: string;
  decimal?: string | null;
  check?: { latex: string; ok: boolean; method?: "exact" | "numeric" };
}

export interface MathResult {
  status: MathStatus;
  kind?: "evaluate" | "simplify" | "solve" | "check" | "word";
  category?: MathCategory;
  message?: string;
  input_latex?: string;
  result_text?: string;
  result_latex?: string;
  decimal?: string | null;
  variable?: string;
  steps?: MathStep[];
  solutions?: MathSolution[];
  excluded?: { value_text: string; value_latex: string; reason: string }[];
  complex_solutions?: { value_text: string; value_latex: string }[];
  forms?: { label: string; latex: string }[];
  restrictions?: string[];
  /** Practice topic to offer next (see engine/learn/practice.ts). */
  practice_topic?: string;
  /** Which engine produced this: "browser" (TypeScript) or "sympy" (desktop backend). */
  engine?: "browser" | "sympy";
}
