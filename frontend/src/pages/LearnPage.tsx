import { Bot, Calculator, ChevronLeft, ExternalLink, FlaskConical, Lightbulb, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { rephrasePrompt } from "../ai/prompts";
import { MathText } from "../components/MathText";
import { Notice, Panel, PixelButton } from "../components/ui";
import { lessonReference, lessonText, mathToText } from "../engine/brain";
import { SUPPORTED_MATH, UNSUPPORTED_MATH, solveMathMessage } from "../engine/math/word";
import type { MathResult } from "../engine/math/types";
import { getTopic, levelFor, sourcesFor, SUBJECT_NAMES, topicsFor, type ScienceSubject } from "../engine/science";
import { PROVENANCE_NOTE } from "../engine/science/sources";
import { MathResultCard } from "../features/chat/MathResultCard";
import { PracticePanel } from "../features/quiz/PracticePanel";
import { useJarvis } from "../hooks/useJarvis";
import type { Grade } from "../engine/learn/practice";

export type LearnTab = "math" | "science";

export function LearnPage({ tab, onTab, initialPractice, onQuizTopic }: { tab: LearnTab; onTab: (t: LearnTab) => void; initialPractice?: string; onQuizTopic: (topicId: string) => void }) {
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Learn" className="grid grid-cols-2 gap-2">
        {(
          [
            ["math", "Math helper", Calculator],
            ["science", "Science lab", FlaskConical],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => onTab(id)}
            className={`pixel-title flex min-h-12 cursor-pointer items-center justify-center gap-2 border-2 text-[0.55rem] ${tab === id ? "border-red bg-red text-void" : "border-[#3a2f48] bg-panel text-ink-dim hover:border-red"}`}
          >
            <Icon size={16} aria-hidden /> {label}
          </button>
        ))}
      </div>
      {tab === "math" ? <MathHelper initialPractice={initialPractice} /> : <ScienceLab onQuizTopic={onQuizTopic} />}
    </div>
  );
}

function MathHelper({ initialPractice }: { initialPractice?: string }) {
  const { prefs, store } = useJarvis();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<MathResult | null>(null);
  const [notFound, setNotFound] = useState(false);

  const solve = (e: FormEvent) => {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    const r = solveMathMessage(/^(solve|what|calculate|find|simplify)/i.test(q) || /[=]/.test(q) ? q : `calculate ${q}`) ?? solveMathMessage(q);
    setResult(r);
    setNotFound(!r);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Math helper" icon={<Calculator size={16} />}>
        <form onSubmit={solve} className="flex gap-2">
          <label htmlFor="math-input" className="sr-only">
            Math problem
          </label>
          <input
            id="math-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            maxLength={200}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="e.g. 3x + 7 = 22"
            className="min-h-12 min-w-0 flex-1 border-2 border-[#3a2f48] bg-void px-3 font-mono text-base focus:border-red"
          />
          <PixelButton type="submit" variant="primary" className="min-h-12 w-12 px-0 sm:w-auto sm:px-4" aria-label="Solve">
            <Send size={16} aria-hidden /> <span className="hidden sm:inline">Solve</span>
          </PixelButton>
        </form>
        {notFound && (
          <div className="mt-3">
            <Notice tone="warn">I couldn't find a math problem I can check in that. Try something like “3x + 7 = 22” or “area of a circle with radius 3”.</Notice>
          </div>
        )}
        {result && (
          <div className="mt-3">
            <MathText content={mathToText(result)} />
            <MathResultCard result={result} />
          </div>
        )}
        <details className="mt-4 text-sm">
          <summary className="pixel-title cursor-pointer text-[0.5rem] text-red-hi">What can the math engine do?</summary>
          <ul className="mt-2 space-y-2">
            {SUPPORTED_MATH.map((s) => (
              <li key={s.category}>
                <span className="font-semibold capitalize">{s.category}</span> — {s.notes}.{" "}
                <span className="text-ink-dim">e.g. {s.examples.join(" · ")}</span>
              </li>
            ))}
          </ul>
          <p className="pixel-title mt-3 text-[0.48rem] text-warn">Not supported yet</p>
          <ul className="mt-1 list-[square] pl-5 text-ink-dim marker:text-red">
            {UNSUPPORTED_MATH.map((u) => (
              <li key={u}>{u}</li>
            ))}
          </ul>
        </details>
      </Panel>
      <PracticePanel key={initialPractice ?? "none"} grade={prefs.grade as Grade} initialTopic={initialPractice ?? ""} onResult={(ok) => store.recordProgress("math", ok ? 1 : 0, 1)} />
    </div>
  );
}

const SUBJECTS: (ScienceSubject | "all")[] = ["all", "biology", "chemistry", "physics", "earth_science", "general_science"];

function ScienceLab({ onQuizTopic }: { onQuizTopic: (topicId: string) => void }) {
  const { prefs, ai } = useJarvis();
  const [subject, setSubject] = useState<ScienceSubject | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [allGrades, setAllGrades] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const topics = useMemo(() => topicsFor(subject, allGrades ? undefined : prefs.grade), [subject, allGrades, prefs.grade]);
  const topic = openId ? getTopic(openId) : undefined;
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  if (topic) {
    const explain = async () => {
      setAiBusy(true);
      setAiText("");
      try {
        setAiText(await ai.generate(rephrasePrompt(prefs.grade, `Explain ${topic.title}`, lessonReference(topic, prefs.grade)), { onToken: setAiText }));
      } catch {
        setAiText(null);
      } finally {
        setAiBusy(false);
      }
    };
    return (
      <Panel
        title={SUBJECT_NAMES[topic.subject]}
        icon={<FlaskConical size={16} />}
        actions={
          <PixelButton onClick={() => (setOpenId(null), setAiText(null), setRevealed(new Set()))} className="min-h-11 px-3">
            <ChevronLeft size={14} /> Topics
          </PixelButton>
        }
      >
        <p className="pixel-title mb-2 text-[0.46rem] text-ink-dim">
          Grades {topic.grades[0]}–{topic.grades[1]} · showing the {levelFor(prefs.grade) === "basic" ? "simpler" : "more advanced"} explanation for grade {prefs.grade}
        </p>
        <MathText content={lessonText(topic, prefs.grade)} />
        {prefs.localAI.enabled && ai.ready && (
          <div className="mt-4">
            <PixelButton onClick={() => void explain()} disabled={aiBusy} className="min-h-11">
              <Bot size={14} /> Explain it differently (on-device AI)
            </PixelButton>
            {aiText !== null && (
              <section className="mt-3 border-2 border-dashed border-warn/50 bg-void/60 p-3">
                <p className="pixel-title mb-1 text-[0.46rem] text-warn">On-device AI rephrasing — can be wrong; the lesson above is the checked version</p>
                <MathText content={aiText || "…"} className="text-sm" />
              </section>
            )}
          </div>
        )}
        <h3 className="pixel-title mt-5 mb-2 flex items-center gap-2 text-[0.5rem] text-red-hi">
          <Lightbulb size={13} /> Practice questions
        </h3>
        <ul className="space-y-2">
          {topic.practice.map((p, i) => (
            <li key={i} className="border-2 border-[#2a2438] bg-deck p-3 text-sm">
              <p className="font-semibold">{p.question}</p>
              {revealed.has(i) ? (
                <p className="mt-2 text-ok">{p.answer}</p>
              ) : (
                <button type="button" className="mt-2 min-h-10 cursor-pointer text-red-hi underline" onClick={() => setRevealed(new Set(revealed).add(i))}>
                  Show a model answer
                </button>
              )}
            </li>
          ))}
        </ul>
        <PixelButton variant="primary" className="mt-4 min-h-12" onClick={() => onQuizTopic(topic.id)}>
          Concept check quiz ({topic.checks.length} questions)
        </PixelButton>
        <div className="mt-5 border-t-2 border-[#2a2438] pt-3 text-xs text-ink-dim">
          <p>{PROVENANCE_NOTE}</p>
          <ul className="mt-1 space-y-1">
            {sourcesFor(topic).map((s) => (
              <li key={s.id}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 text-red-hi underline">
                  {s.publisher} — {s.title} <ExternalLink size={11} aria-hidden />
                </a>{" "}
                ({s.license})
              </li>
            ))}
          </ul>
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Science lab" icon={<FlaskConical size={16} />}>
      <div className="flex gap-2 overflow-x-auto pb-2" role="radiogroup" aria-label="Subject">
        {SUBJECTS.map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={subject === s}
            onClick={() => setSubject(s)}
            className={`pixel-title min-h-10 shrink-0 cursor-pointer border-2 px-3 text-[0.46rem] ${subject === s ? "border-red bg-red text-void" : "border-[#3a2f48] bg-void text-ink-dim"}`}
          >
            {s === "all" ? "All" : SUBJECT_NAMES[s]}
          </button>
        ))}
      </div>
      <label className="mt-2 flex min-h-10 items-center gap-2 text-sm text-ink-dim">
        <input type="checkbox" checked={allGrades} onChange={(e) => setAllGrades(e.target.checked)} className="h-5 w-5 accent-[#FF4058]" /> Show topics for all grades
      </label>
      {topics.length === 0 ? (
        <p className="py-4 text-ink-dim">No topics here for grade {prefs.grade} yet. Tick “all grades” to see more.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {topics.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setOpenId(t.id)} className="flex min-h-16 w-full cursor-pointer flex-col items-start border-2 border-[#3a2f48] bg-deck p-3 text-left hover:border-red">
                <span className="font-semibold">{t.title}</span>
                <span className="text-xs text-ink-dim">
                  {SUBJECT_NAMES[t.subject]} · grades {t.grades[0]}–{t.grades[1]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-dim">
        {topics.length} curated topics shown. This is a starter library, not a complete grade 7–12 curriculum.
      </p>
    </Panel>
  );
}
