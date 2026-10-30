import { afterEach, describe, expect, it, vi } from "vitest";
import { MathParseError, parseMath } from "../engine/math/parser";
import { analyze, checkAnswer } from "../engine/math/solve";
import { detectMath, solveMathMessage, wordsToNumbers } from "../engine/math/word";

describe("math engine: correctness", () => {
  it.each([
    ["12 × 8", "96"],
    ["-3 * -4", "12"],
    ["3/4 + 1/6", "11/12"],
    ["0.1 + 0.2", "3/10"],
    ["2^10", "1024"],
    ["5!", "120"],
    ["sqrt(49)", "7"],
    ["sqrt(72)", "6√2"],
    ["log(1000)", "3"],
    ["sin(30°)", "1/2"],
    ["cos(60°)", "1/2"],
    ["sin(45°)", "√2/2"],
    ["tan(45°)", "1"],
    ["|−7| + 2", "9"],
  ])("%s = %s (verified)", (q, expected) => {
    const r = analyze(q);
    expect(r.status).toBe("verified");
    expect(r.result_text).toBe(expected);
  });

  it("solves linear equations with steps and an exact substitution check", () => {
    const r = analyze("3x + 7 = 22");
    expect(r.status).toBe("verified");
    expect(r.result_text).toBe("x = 5");
    expect(r.solutions?.[0].check?.method).toBe("exact");
    expect(r.steps?.map((s) => s.text)).toEqual(["Start with the equation.", "Subtract 7 from both sides to get the x term by itself.", "Divide both sides by 3."]);
  });

  it.each([
    ["x^2 - 5x + 6 = 0", "x = 2, x = 3"],
    ["2x^2 + 3x - 2 = 0", "x = -2, x = 1/2"],
    ["x^2 - 4x + 4 = 0", "x = 2"],
    ["x^2 = 2", "x = -√2, x = √2"],
    ["x^3 - 6x^2 + 11x - 6 = 0", "x = 1, x = 2, x = 3"],
    ["2(x+3) = 4x - 2", "x = 4"],
    ["2x/3 = -4", "x = -6"],
    ["1/x = 2", "x = 1/2"],
  ])("solves %s", (q, expected) => {
    const r = analyze(q);
    expect(r.status).toBe("verified");
    expect(r.result_text).toBe(expected);
    expect(r.solutions?.every((s) => s.check?.ok)).toBe(true);
  });

  it("rejects extraneous roots that break a domain restriction", () => {
    const r = analyze("(x^2 - 1)/(x - 1) = 2");
    expect(r.status).toBe("no_solution");
    expect(r.excluded?.[0].value_text).toBe("1");
    expect(r.excluded?.[0].reason).toMatch(/denominator/);
  });

  it("reports no real solutions honestly, listing complex ones", () => {
    const r = analyze("x^2 + 1 = 0");
    expect(r.status).toBe("no_solution");
    expect(r.complex_solutions?.length).toBe(2);
  });

  it("handles identities with restrictions and contradictions", () => {
    expect(analyze("x/x = 1")).toMatchObject({ status: "verified", result_text: "all real numbers", restrictions: ["x ≠ 0"] });
    expect(analyze("x + 1 = x + 2").status).toBe("no_solution");
  });

  it("labels non-standard trig as approximate, not verified", () => {
    const r = analyze("sin(20°)");
    expect(r.status).toBe("approximate");
    expect(r.message).toMatch(/not an exact/);
  });

  it("detects undefined values", () => {
    expect(analyze("1/0").status).toBe("error");
    expect(analyze("1/(2-2)").status).toMatch(/undefined|error/);
    expect(analyze("log(-1)").status).toBe("undefined");
    expect(analyze("sqrt(-4)").status).toBe("undefined");
    expect(analyze("tan(90°)").status).toBe("undefined");
  });

  it("is honest about unsupported problem classes", () => {
    expect(analyze("sqrt(x) = 2").status).toBe("unsupported");
    expect(analyze("x + y = 3").status).toBe("unsupported");
    expect(analyze("x^5 + x + 1 = 0").status).toBe("unsupported");
  });

  it("simplifies one-variable polynomials and fractions", () => {
    expect(analyze("(x+1)^2")).toMatchObject({ status: "verified", result_latex: "x^{2} + 2x + 1" });
    expect(analyze("1/x + 1/(x+1)").status).toBe("verified");
  });

  it("checks student answers exactly, in any order", () => {
    expect(checkAnswer("5", "x = 5").correct).toBe(true);
    expect(checkAnswer("2, 3", "x = 3 or x = 2").correct).toBe(true);
    expect(checkAnswer("3/4", "0.75").correct).toBe(true);
    expect(checkAnswer("3/4", "0.7").correct).toBe(false);
    expect(checkAnswer("2, 3", "2").correct).toBe(false);
    expect(checkAnswer("5", "import os").status).toBe("error");
  });
});

describe("math engine: safety", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    "__import__('os').system('calc')",
    "constructor.constructor('alert(1)')()",
    "eval('2+2')",
    "Function('return 1')()",
    "fetch('https://x')",
    "x.__proto__",
    "alert(1)",
    "process.exit()",
    "<script>",
    "${1+1}",
    "`ls`",
    "x @ y",
    "\"2+2\"",
  ])("rejects %s", (q) => {
    expect(() => parseMath(q)).toThrow(MathParseError);
    expect(analyze(q).status).toBe("error");
  });

  it("never uses eval or Function", () => {
    const evalSpy = vi.spyOn(globalThis, "eval");
    const FnSpy = vi.spyOn(globalThis, "Function");
    analyze("3x + 7 = 22");
    analyze("sqrt(72) + sin(30°) - 2^3 / |−4|");
    solveMathMessage("area of a circle with radius 3");
    expect(evalSpy).not.toHaveBeenCalled();
    expect(FnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["1".repeat(300), /too long/],
    ["9".repeat(20), /too large/],
    ["2^1000", /Exponents/],
    ["2^2^2^2^2", /Exponents/],
    ["(99999999^99)^99", /too large/],
    ["1000!", /Factorials/],
    ["(".repeat(40) + "1" + ")".repeat(40), /nested/],
    ["x^x", /base and the exponent/],
    ["0^-1", /undefined/],
    ["2 3", /next to each other/],
    ["x = 1 = 2", /single/],
  ])("enforces resource limits: %s", (q, msg) => {
    expect(() => parseMath(q)).toThrow(msg);
  });

  it("finishes large-but-allowed inputs quickly", () => {
    const t = performance.now();
    analyze("99999999999^100");
    analyze("x^12 - 1 = 0");
    expect(performance.now() - t).toBeLessThan(2000);
  });
});

describe("natural language and voice phrasing", () => {
  it("turns number words into digits", () => {
    expect(wordsToNumbers("x plus five equals ten")).toBe("x plus 5 equals 10");
    expect(wordsToNumbers("twenty five times four")).toBe("25 times 4");
    expect(wordsToNumbers("one hundred and two")).toBe("102");
  });

  it.each([
    ["Jarvis, solve x plus five equals ten", "x = 5"],
    ["What is 12 × 8?", "96"],
    ["what is twenty five times four", "100"],
    ["Solve 3x + 7 = 22", "x = 5"],
    ["what is 20% of 50", "10"],
    ["15 is what percent of 60", "25%"],
    ["increase 80 by 25%", "100"],
    ["find the mean of 4, 8, 15, 16", "43/4"],
    ["median of 3, 1, 7, 9", "5"],
    ["mode of 2, 3, 3, 5", "3"],
    ["area of a circle with radius 3", "9π"],
    ["area of a triangle with base 6 and height 5", "15"],
    ["hypotenuse of 3 and 4", "5"],
    ["volume of a cylinder with radius 2 and height 5", "20π"],
    ["f(x) = 2x + 3, find f(4)", "11"],
    ["if g(x) = x^2 + 1 what is g(-2)", "5"],
    ["slope between (1, 2) and (3, 8)", "3"],
  ])("%s → %s", (q, expected) => {
    const r = solveMathMessage(q);
    expect(r?.status).toBe("verified");
    expect(r?.result_text).toBe(expected);
  });

  it("does not mistake ordinary questions for math", () => {
    for (const q of ["What is photosynthesis?", "how do calculators work", "open roblox", "solve this riddle", "what is one cell"]) {
      expect(solveMathMessage(q)).toBeNull();
    }
    expect(detectMath("12 x 8")?.expression).toBe("12 * 8");
  });
});
