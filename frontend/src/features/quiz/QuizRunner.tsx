import { BadgeCheck, BookMarked, Check, X } from "lucide-react";
import { useState } from "react";
import { MathText } from "../../components/MathText";
import { Panel, PixelButton } from "../../components/ui";
import { scoreQuiz, type Quiz, type QuizResult } from "../../engine/learn/quiz";

export function QuizRunner({ quiz, onDone, onExit }: { quiz: Quiz; onDone: (r: QuizResult) => void; onExit: () => void }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => quiz.questions.map(() => null));
  const [result, setResult] = useState<QuizResult | null>(null);
  const answered = answers.filter((a) => a !== null).length;

  const submit = () => {
    const r = scoreQuiz(quiz.questions, answers);
    setResult(r);
    onDone(r);
  };

  return (
    <Panel
      glow
      title={quiz.title}
      actions={
        <span className="pixel-title flex items-center gap-1 text-[0.46rem] text-ok">
          {quiz.source === "math-engine" ? <BadgeCheck size={13} /> : <BookMarked size={13} />}
          {quiz.source === "math-engine" ? "Answers checked by the math engine" : "From JARVIS's curated lessons"}
        </span>
      }
    >
      {result && (
        <div className="mb-5 border-2 border-red bg-void p-4 text-center" role="status">
          <p className="pixel-title neon text-2xl text-red">
            {result.score}/{result.total}
          </p>
          <p className="mt-2">{result.feedback}</p>
        </div>
      )}
      <ol className="space-y-4">
        {quiz.questions.map((q, qi) => {
          const r = result?.results[qi];
          return (
            <li key={qi} className="border-2 border-[#2a2438] bg-deck p-3 sm:p-4">
              <fieldset>
                <legend className="mb-3">
                  <span className="pixel-title mr-2 text-[0.5rem] text-red">Q{qi + 1}</span>
                  <span className="font-semibold">{q.question}</span>
                  {q.latex && <MathText content={`$$${q.latex}$$`} />}
                </legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.choices.map((choice, ci) => {
                    const chosen = answers[qi] === ci;
                    const isCorrect = r && r.correct === ci;
                    const isWrong = r && chosen && !r.isCorrect;
                    return (
                      <label
                        key={ci}
                        className={`flex min-h-12 cursor-pointer items-center gap-3 border-2 px-3 py-2 transition-colors ${
                          isCorrect ? "border-ok bg-ok/10" : isWrong ? "border-red bg-red/10" : chosen ? "border-red-hi bg-panel-hi" : "border-[#3a2f48] bg-void hover:border-red"
                        }`}
                      >
                        <input type="radio" name={`q${quiz.id}-${qi}`} checked={chosen} disabled={Boolean(result)} onChange={() => setAnswers((a) => a.map((v, i) => (i === qi ? ci : v)))} className="h-5 w-5 accent-[#FF4058]" />
                        <MathText content={choice} />
                        {isCorrect && <Check size={18} className="ml-auto shrink-0 text-ok" aria-label="correct answer" />}
                        {isWrong && <X size={18} className="ml-auto shrink-0 text-red" aria-label="your answer, incorrect" />}
                      </label>
                    );
                  })}
                </div>
                {r && (
                  <div className="mt-3 text-sm text-ink-dim">
                    <MathText content={r.explanation} />
                  </div>
                )}
              </fieldset>
            </li>
          );
        })}
      </ol>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        {!result && (
          <PixelButton variant="primary" onClick={submit} disabled={answered === 0} className="min-h-12">
            Submit ({answered}/{quiz.questions.length})
          </PixelButton>
        )}
        <PixelButton onClick={onExit} className="min-h-12">
          {result ? "Back to quizzes" : "Quit"}
        </PixelButton>
      </div>
    </Panel>
  );
}
