/** Quiz building and scoring that runs entirely in the browser. */
import { buildScienceQuiz, type QuizQuestion, type ScienceSubject } from "../science";
import { generateProblem, rng, toMultipleChoice, type Grade, type Rng } from "./practice";

export interface Quiz {
  id: string;
  subject: string;
  topic: string;
  grade: Grade;
  source: "math-engine" | "curated";
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizResult {
  score: number;
  total: number;
  percent: number;
  feedback: string;
  results: { index: number; given: number | null; correct: number; isCorrect: boolean; explanation: string }[];
}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, "").slice(0, 32);

export function buildMathQuiz(grade: Grade, topic: string | null, count: number, r: Rng = rng()): Quiz {
  const questions: QuizQuestion[] = [];
  const seen = new Set<string>();
  for (let tries = 0; questions.length < count && tries < count * 10; tries++) {
    const p = toMultipleChoice(generateProblem(topic, grade, r), r);
    if (seen.has(p.latex)) continue;
    seen.add(p.latex);
    questions.push({
      question: p.prompt,
      latex: p.latex,
      choices: p.choices!.map((c) => `$${c}$`),
      answer: p.correctIndex!,
      explanation: `The answer is $${p.answerLatex}$. Hint: ${p.hint}`,
      topicId: p.topic,
    });
  }
  return { id: newId(), subject: "math", topic: topic ?? "mixed", grade, source: "math-engine", title: `Math mission: ${(topic ?? "mixed").replace("_", " ")}`, questions, createdAt: new Date().toISOString() };
}

export function buildQuiz(subject: string, grade: Grade, count: number, topic: string | null = null, r: Rng = rng()): Quiz {
  const n = Math.max(3, Math.min(10, Math.round(count) || 5));
  if (subject === "math") return buildMathQuiz(grade, topic, n, r);
  const subj = (subject === "science" ? "all" : subject) as ScienceSubject | "all";
  const questions = buildScienceQuiz(subj, grade, n, r, topic ?? undefined);
  return {
    id: newId(),
    subject,
    topic: topic ?? "mixed",
    grade,
    source: "curated",
    title: `Science mission: ${subject.replace("_", " ")}`,
    questions,
    createdAt: new Date().toISOString(),
  };
}

export function scoreQuiz(questions: QuizQuestion[], answers: (number | null)[]): QuizResult {
  let score = 0;
  const results = questions.map((q, i) => {
    const given = answers[i] ?? null;
    const isCorrect = given !== null && given === q.answer;
    if (isCorrect) score++;
    return { index: i, given, correct: q.answer, isCorrect, explanation: q.explanation };
  });
  const total = questions.length;
  const percent = total ? Math.round((100 * score) / total) : 0;
  const feedback =
    percent === 100
      ? "PERFECT SCORE! Mission complete, legend!"
      : percent >= 80
        ? "Great job! You really know this. Check the one you missed and you'll be unstoppable."
        : percent >= 50
          ? "Nice work! You're getting there. Review the explanations below and try again."
          : "Every expert started as a beginner. Read the explanations, then let's try another round.";
  return { score, total, percent, feedback, results };
}
