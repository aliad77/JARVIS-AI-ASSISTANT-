import { rng, type Rng } from "../learn/practice";
import { SOURCES, type SourceRef } from "./sources";
import { TOPICS, type ConceptCheck, type ScienceSubject, type ScienceTopic } from "./topics";

export { TOPICS, SUBJECT_NAMES } from "./topics";
export type { ScienceTopic, ScienceSubject, ConceptCheck } from "./topics";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Rank topics for a free-text question. Keyword/phrase matching only (deterministic, offline). */
export function searchTopics(query: string, opts: { grade?: number; subject?: ScienceSubject | null; limit?: number } = {}): { topic: ScienceTopic; score: number }[] {
  const q = ` ${norm(query)} `;
  if (q.trim().length < 3) return [];
  const scored = TOPICS.map((topic) => {
    let score = 0;
    for (const kw of topic.keywords) {
      const k = norm(kw);
      if (q.includes(` ${k} `) || q.includes(` ${k}s `)) score += 3 + k.split(" ").length;
    }
    for (const word of norm(topic.title).split(" ")) if (word.length > 4 && q.includes(` ${word} `)) score += 1;
    if (opts.subject && topic.subject === opts.subject) score += 0.5;
    if (opts.grade && (opts.grade < topic.grades[0] || opts.grade > topic.grades[1])) score -= 0.5;
    return { topic, score };
  }).filter((x) => x.score >= 3);
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, opts.limit ?? 3);
}

export function getTopic(id: string): ScienceTopic | undefined {
  return TOPICS.find((t) => t.id === id);
}

export function topicsFor(subject: ScienceSubject | "all", grade?: number): ScienceTopic[] {
  return TOPICS.filter((t) => (subject === "all" || t.subject === subject) && (!grade || (grade >= t.grades[0] && grade <= t.grades[1])));
}

export function sourcesFor(topic: ScienceTopic): SourceRef[] {
  return topic.sources.map((id) => SOURCES[id]).filter(Boolean);
}

/** Grade-appropriate explanation level. */
export function levelFor(grade: number): "basic" | "advanced" {
  return grade >= 10 ? "advanced" : "basic";
}

export interface QuizQuestion {
  question: string;
  choices: string[];
  answer: number;
  explanation: string;
  topicId: string;
  latex?: string;
}

/** Build a science quiz from curated concept checks. Choices are shuffled, answers tracked. */
export function buildScienceQuiz(subject: ScienceSubject | "all", grade: number, count: number, r: Rng = rng(), topicId?: string): QuizQuestion[] {
  const pool = (topicId ? TOPICS.filter((t) => t.id === topicId) : topicsFor(subject, grade)).flatMap((t) => t.checks.map((c) => ({ c, t })));
  const fallbackPool = topicsFor(subject).flatMap((t) => t.checks.map((c) => ({ c, t })));
  const chosen = r.shuffle([...(pool.length >= count ? pool : fallbackPool)]).slice(0, count);
  return chosen.map(({ c, t }) => shuffleChoices(c, t.id, r));
}

function shuffleChoices(c: ConceptCheck, topicId: string, r: Rng): QuizQuestion {
  const order = r.shuffle([0, 1, 2, 3]);
  return {
    question: c.question,
    choices: order.map((i) => c.choices[i]),
    answer: order.indexOf(c.answer),
    explanation: c.explanation,
    topicId,
  };
}
