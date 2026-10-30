import { describe, expect, it } from "vitest";
import { respond } from "../engine/brain";
import { classify } from "../engine/intent";
import { GENERATORS, GRADES, generateProblem, rng, toMultipleChoice } from "../engine/learn/practice";
import { buildQuiz, scoreQuiz } from "../engine/learn/quiz";
import { checkAnswer } from "../engine/math/solve";
import { buildScienceQuiz, levelFor, searchTopics, sourcesFor, TOPICS, topicsFor } from "../engine/science";
import { SOURCES } from "../engine/science/sources";

const ctx = { grade: 8, savedPlaces: [{ name: "Adopt Me", placeId: "920587237" }], windowsLaunch: false };

describe("science knowledge base", () => {
  it("every topic is complete, well-formed and has real provenance", () => {
    const ids = new Set<string>();
    for (const t of TOPICS) {
      expect(ids.has(t.id)).toBe(false);
      ids.add(t.id);
      expect(t.grades[0]).toBeGreaterThanOrEqual(7);
      expect(t.grades[1]).toBeLessThanOrEqual(12);
      expect(t.summary.basic.length).toBeGreaterThan(40);
      expect(t.summary.advanced.length).toBeGreaterThan(40);
      expect(t.definitions.length).toBeGreaterThan(0);
      expect(t.checks.length).toBeGreaterThanOrEqual(3);
      for (const c of t.checks) {
        expect(new Set(c.choices).size).toBe(4);
        expect(c.answer).toBeGreaterThanOrEqual(0);
        expect(c.answer).toBeLessThan(4);
        expect(c.explanation.length).toBeGreaterThan(10);
      }
      expect(t.sources.length).toBeGreaterThan(0);
      for (const s of t.sources) expect(SOURCES[s]?.url).toMatch(/^https:\/\//);
      expect(sourcesFor(t).length).toBe(t.sources.length);
    }
  });

  it("covers all five subjects", () => {
    expect(new Set(TOPICS.map((t) => t.subject))).toEqual(new Set(["biology", "chemistry", "physics", "earth_science", "general_science"]));
  });

  it.each([
    ["Explain photosynthesis", "photosynthesis"],
    ["Jarvis, explain photosynthesis.", "photosynthesis"],
    ["what is DNA?", "dna-genetics"],
    ["how do earthquakes happen", "plate-tectonics"],
    ["tell me about the periodic table", "periodic-table"],
    ["what is ohm's law and current", "electricity"],
    ["why do we have seasons", "seasons-solar-system"],
    ["what is a hypothesis", "scientific-method"],
  ])("retrieves %s → %s", (q, id) => {
    expect(searchTopics(q, { grade: 8 })[0]?.topic.id).toBe(id);
  });

  it("returns nothing for unrelated questions instead of guessing", () => {
    expect(searchTopics("who won the football game")).toEqual([]);
  });

  it("selects explanation level by grade", () => {
    expect(levelFor(7)).toBe("basic");
    expect(levelFor(9)).toBe("basic");
    expect(levelFor(10)).toBe("advanced");
    expect(levelFor(12)).toBe("advanced");
    expect(topicsFor("all", 7).every((t) => t.grades[0] <= 7)).toBe(true);
  });

  it("builds science quizzes whose shuffled answers still point at the right choice", () => {
    const qs = buildScienceQuiz("physics", 9, 5, rng(42));
    expect(qs.length).toBe(5);
    for (const q of qs) {
      const original = TOPICS.find((t) => t.id === q.topicId)!.checks.find((c) => c.question === q.question)!;
      expect(q.choices[q.answer]).toBe(original.choices[original.answer]);
    }
  });
});

describe("practice and quizzes", () => {
  it.each(Object.keys(GENERATORS))("answer keys for %s are verified by the math engine", (topic) => {
    const r = rng(7);
    for (const g of GRADES) {
      for (let i = 0; i < 5; i++) {
        const p = generateProblem(topic, g, r);
        expect(checkAnswer(p.expected, p.expected).correct).toBe(true);
      }
    }
  });

  it("generated linear equations really have the stated solution", () => {
    const r = rng(3);
    for (let i = 0; i < 40; i++) {
      const p = generateProblem("linear_equations", 10, r);
      const res = checkAnswer(p.expected, p.expected);
      expect(res.correct).toBe(true);
      expect(p.latex).not.toMatch(/(^|[^\d])[01]x/); // no "0x"/"1x"
    }
  });

  it("multiple choice has four distinct options and one correct index", () => {
    const r = rng(11);
    for (let i = 0; i < 60; i++) {
      const p = toMultipleChoice(generateProblem(null, GRADES[i % 6], r), r);
      expect(new Set(p.choices).size).toBe(4);
      expect(p.correctIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it("scores quizzes", () => {
    const quiz = buildQuiz("math", 7, 4, "fractions", rng(5));
    expect(quiz.source).toBe("math-engine");
    const perfect = scoreQuiz(quiz.questions, quiz.questions.map((q) => q.answer));
    expect(perfect).toMatchObject({ score: 4, total: 4, percent: 100 });
    const none = scoreQuiz(quiz.questions, [null, null]);
    expect(none.score).toBe(0);
    expect(none.results[0].given).toBeNull();
  });

  it("clamps quiz size", () => {
    expect(buildQuiz("biology", 9, 99).questions.length).toBeLessThanOrEqual(10);
    expect(buildQuiz("chemistry", 9, 0).questions.length).toBeGreaterThanOrEqual(3);
  });
});

describe("assistant routing (voice examples from the spec)", () => {
  it("“Jarvis, open Roblox.” offers a tap-to-launch button, never auto-launches", () => {
    const r = respond("Jarvis, open Roblox.", ctx);
    expect(r.meta.action).toEqual({ type: "roblox", placeId: undefined, placeName: undefined });
    expect(r.content).toMatch(/Tap the button/);
  });

  it("opens a saved favourite by name", () => {
    const r = respond("open roblox adopt me", ctx);
    expect(r.meta.action).toMatchObject({ type: "roblox", placeId: "920587237" });
  });

  it("“Jarvis, explain photosynthesis.” uses the curated lesson with sources", () => {
    const r = respond("Jarvis, explain photosynthesis.", ctx);
    expect(r.meta).toMatchObject({ intent: "science", topicId: "photosynthesis", source: "curated" });
    expect(r.content).toContain("6CO₂ + 6H₂O");
    expect(r.content).toContain("OpenStax");
    expect(r.aiTask?.kind).toBe("rephrase");
  });

  it("“Jarvis, solve x plus five equals ten.” is solved and verified", () => {
    const r = respond("Jarvis, solve x plus five equals ten.", ctx);
    expect(r.meta.math?.status).toBe("verified");
    expect(r.meta.math?.result_text).toBe("x = 5");
    expect(r.meta.practiceTopic).toBeTruthy();
  });

  it("“Jarvis, quiz me on grade eight science.” starts the right quiz", () => {
    expect(classify("Jarvis, quiz me on grade eight science.")).toMatchObject({ type: "quiz", grade: 8, subject: "science" });
    expect(respond("Jarvis, quiz me on grade eight science.", ctx).meta.action).toEqual({ type: "quiz", subject: "science", grade: 8 });
  });

  it("rejects unapproved apps and doesn't offer PC apps on phones", () => {
    expect(respond("open fortnite", ctx).content).toMatch(/isn't on my approved list/);
    expect(respond("open notepad", ctx).meta.action).toBeUndefined();
    expect(respond("open notepad", { ...ctx, windowsLaunch: true }).meta.action).toEqual({ type: "windows-launch", appId: "notepad" });
  });

  it("changes grade by voice", () => {
    expect(respond("set my grade to nine", ctx).settings).toEqual({ grade: 9 });
    expect(respond("set my grade to 4", ctx).settings).toBeUndefined();
  });

  it("answers crisis messages with care and no AI task", () => {
    const r = respond("I want to hurt myself", ctx);
    expect(r.content).toMatch(/trusted adult/);
    expect(r.aiTask).toBeUndefined();
  });

  it("says what it can do when it has no lesson, instead of inventing one", () => {
    const r = respond("who is the best footballer", ctx);
    expect(r.content).toMatch(/can't find that in my built-in lessons/);
    expect(r.meta.source).toBe("fallback");
  });

  it("ambiguous mentions only offer a button", () => {
    const r = respond("I want to play roblox after homework", ctx);
    expect(r.meta.action).toEqual({ type: "roblox" });
    expect(r.meta.intent).toBe("conversation");
  });
});
