import { Medal, Swords, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { Panel, PixelButton } from "../components/ui";
import { MATH_TOPICS, type Grade } from "../engine/learn/practice";
import { buildQuiz, type Quiz } from "../engine/learn/quiz";
import { getTopic, SUBJECT_NAMES } from "../engine/science";
import { QuizRunner } from "../features/quiz/QuizRunner";
import { useJarvis } from "../hooks/useJarvis";

export interface QuizRequest {
  subject: string; // "math" | "science" | ScienceSubject | "topic:<id>"
  grade?: number;
  nonce: number;
}

const SUBJECT_OPTIONS: [string, string][] = [
  ["math", "Math"],
  ["science", "Science (mixed)"],
  ...Object.entries(SUBJECT_NAMES),
];

export function QuizzesPage({ request, onSfx }: { request: QuizRequest | null; onSfx: (s: "success" | "error") => void }) {
  const { prefs, store } = useJarvis();
  const [subject, setSubject] = useState("math");
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!request) return;
    const grade = (request.grade && request.grade >= 7 && request.grade <= 12 ? request.grade : prefs.grade) as Grade;
    if (request.subject.startsWith("topic:")) {
      const t = getTopic(request.subject.slice(6));
      if (t) setQuiz(buildQuiz(t.subject, grade, t.checks.length, t.id));
    } else {
      setQuiz(buildQuiz(request.subject, grade, 5));
    }
    // A new request object (nonce) starts a new quiz.
  }, [request, prefs.grade]);

  const attempts = store.listQuizAttempts().slice(0, 10);
  const progress = store.getProgress();
  const totals = progress.reduce((a, p) => ({ c: a.c + p.correct, n: a.n + p.attempted }), { c: 0, n: 0 });

  if (quiz) {
    return (
      <QuizRunner
        quiz={quiz}
        onDone={(r) => {
          store.addQuizAttempt({ title: quiz.title, subject: quiz.subject, grade: quiz.grade, score: r.score, total: r.total });
          onSfx(r.percent >= 50 ? "success" : "error");
        }}
        onExit={() => {
          setQuiz(null);
          setTick((t) => t + 1);
        }}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel glow title="New quiz" icon={<Swords size={16} />}>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Subject</span>
            <select value={subject} onChange={(e) => (setSubject(e.target.value), setTopic(""))} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3">
              {SUBJECT_OPTIONS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          {subject === "math" && (
            <label className="text-sm">
              <span className="mb-1 block font-semibold">Topic</span>
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3">
                <option value="">Mixed</option>
                {Object.entries(MATH_TOPICS).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="text-sm">
            <span className="mb-1 block font-semibold">Questions</span>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3">
              {[3, 5, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-3 text-xs text-ink-dim">
          {subject === "math"
            ? "Math questions are generated on your device; every answer key is computed exactly."
            : "Science questions come from JARVIS's curated lessons, checked against open textbooks."}
        </p>
        <PixelButton variant="primary" className="mt-4 min-h-12 w-full sm:w-auto" onClick={() => setQuiz(buildQuiz(subject, prefs.grade as Grade, count, topic || null))}>
          Start grade {prefs.grade} quiz
        </PixelButton>
      </Panel>

      <Panel title="Progress" icon={<Trophy size={16} />}>
        <div className="grid grid-cols-3 gap-2 text-center">
          {(
            [
              ["XP", totals.c * 10],
              ["Correct", totals.c],
              ["Accuracy", totals.n ? `${Math.round((100 * totals.c) / totals.n)}%` : "—"],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="border-2 border-[#2a2438] bg-void p-3">
              <p className="pixel-title neon text-sm text-red">{value}</p>
              <p className="pixel-title mt-2 text-[0.42rem] text-ink-dim">{label}</p>
            </div>
          ))}
        </div>
        <h3 className="pixel-title mt-5 mb-2 flex items-center gap-2 text-[0.5rem] text-red-hi">
          <Medal size={13} /> Recent quizzes
        </h3>
        {attempts.length === 0 ? (
          <p className="text-sm text-ink-dim">No quizzes yet. Your scores are saved on this device.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {attempts.map((a) => (
              <li key={a.id} className="flex justify-between gap-3 border-b border-[#2a2438] py-1.5">
                <span className="truncate">{a.title}</span>
                <span className="shrink-0 text-red-hi">
                  {a.score}/{a.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
