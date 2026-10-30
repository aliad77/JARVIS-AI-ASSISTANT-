import { Dumbbell, Lightbulb } from "lucide-react";
import { useState, type FormEvent } from "react";
import { MathText } from "../../components/MathText";
import { Notice, Panel, PixelButton } from "../../components/ui";
import { generateProblem, MATH_TOPICS, type Grade, type MathProblem } from "../../engine/learn/practice";
import { checkAnswer } from "../../engine/math/solve";

export function PracticePanel({ grade, initialTopic = "", onResult }: { grade: Grade; initialTopic?: string; onResult: (ok: boolean) => void }) {
  const [topic, setTopic] = useState(initialTopic);
  const [problem, setProblem] = useState<MathProblem | null>(() => (initialTopic ? generateProblem(initialTopic, grade) : null));
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn" | "info" | "error"; text: string; reveal?: string } | null>(null);
  const [hint, setHint] = useState(false);
  const [counted, setCounted] = useState(false);

  const next = () => {
    setProblem(generateProblem(topic || null, grade));
    setAnswer("");
    setFeedback(null);
    setHint(false);
    setCounted(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!problem || !answer.trim()) return;
    const r = checkAnswer(problem.expected, answer);
    if (r.status === "error") return setFeedback({ tone: "error", text: r.message });
    if (!counted) {
      onResult(r.correct);
      setCounted(true);
    }
    setFeedback(r.correct ? { tone: "ok", text: r.message, reveal: problem.answerLatex } : { tone: "warn", text: `${r.message} Hint: ${problem.hint}` });
  };

  const solved = feedback?.tone === "ok" || feedback?.tone === "info";

  return (
    <Panel title="Math practice" icon={<Dumbbell size={16} />}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block font-semibold">Topic</span>
          <select value={topic} onChange={(e) => setTopic(e.target.value)} className="min-h-12 border-2 border-[#3a2f48] bg-void px-3">
            <option value="">Mixed (grade {grade})</option>
            {Object.entries(MATH_TOPICS).map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <PixelButton variant="primary" onClick={next} className="min-h-12">
          {problem ? "Next problem" : "Start practice"}
        </PixelButton>
      </div>
      {problem && (
        <div className="mt-4 border-2 border-[#2a2438] bg-deck p-4">
          <p className="font-semibold">{problem.prompt}</p>
          <MathText content={`$$${problem.latex}$$`} />
          <form onSubmit={submit} className="mt-2 flex flex-wrap gap-2">
            <label htmlFor="practice-answer" className="sr-only">
              Your answer
            </label>
            <input
              id="practice-answer"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              maxLength={100}
              inputMode="text"
              autoComplete="off"
              placeholder="e.g. 5 or 3/4 or 2, -3"
              className="min-h-12 min-w-0 flex-1 border-2 border-[#3a2f48] bg-void px-3 font-mono text-base focus:border-red"
              disabled={solved}
            />
            <PixelButton type="submit" variant="primary" disabled={!answer.trim() || solved} className="min-h-12">
              Check
            </PixelButton>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <PixelButton onClick={() => setHint(true)} className="min-h-11 px-3">
              <Lightbulb size={13} /> Hint
            </PixelButton>
            <PixelButton onClick={() => setFeedback({ tone: "info", text: "Here's the answer. Try a new one to keep your streak going!", reveal: problem.answerLatex })} className="min-h-11 px-3" disabled={solved}>
              Show answer
            </PixelButton>
          </div>
          {hint && <p className="mt-3 text-sm text-warn">Hint: {problem.hint}</p>}
          {feedback && (
            <div className="mt-3">
              <Notice tone={feedback.tone}>
                {feedback.text}
                {feedback.reveal && <MathText content={`Answer: $${feedback.reveal}$`} />}
              </Notice>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
