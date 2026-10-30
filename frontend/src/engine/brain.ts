/**
 * JARVIS's offline assistant ("System B"). Works with no network and no AI model.
 *
 * respond() routes a message, then builds an answer from trusted local sources:
 * the browser math engine or the curated science lessons. It also says whether
 * the optional on-device model ("System A") may *rephrase* the answer, and with
 * which reference text. The UI always shows the checked answer itself.
 */
import { APP_ALIASES, classify } from "./intent";
import type { MathResult } from "./math/types";
import { solveMathMessage } from "./math/word";
import { CRISIS_REPLY, PERSONAL_INFO_NOTE, screen } from "./safety";
import { levelFor, searchTopics, sourcesFor, SUBJECT_NAMES, type ScienceTopic } from "./science";
import type { MessageMeta, RobloxPlace } from "../platform/storage";

export interface BrainContext {
  grade: number;
  savedPlaces: RobloxPlace[];
  windowsLaunch: boolean; // desktop backend on Windows available
}

export interface BrainReply {
  content: string;
  meta: MessageMeta;
  /** If set, the local model may produce an extra, clearly-labelled explanation. */
  aiTask?: { kind: "rephrase" | "math" | "open"; reference: string };
  settings?: { grade?: number; open?: string };
}

const APP_NAMES: Record<string, string> = { roblox: "Roblox", chrome: "Google Chrome", edge: "Microsoft Edge", calculator: "Calculator", notepad: "Notepad", paint: "Paint" };

export function mathToText(r: MathResult): string {
  const lines: string[] = [];
  if ((r.status === "verified" || r.status === "unverified" || r.status === "approximate") && r.result_latex) {
    const tag = r.status === "verified" ? "checked" : r.status === "approximate" ? "approximate" : "not fully checked";
    lines.push(`**Answer (${tag}):**`, `$$${r.result_latex}$$`);
    if (r.decimal && r.status !== "approximate") lines.push(`That's about **${r.decimal}**.`);
  } else if (r.message) {
    lines.push(`**Math engine:** ${r.message}`);
  }
  if (r.steps?.length) {
    lines.push("**Steps:**");
    r.steps.forEach((s, i) => {
      lines.push(`${i + 1}. ${s.text}`);
      if (s.latex) lines.push(`$$${s.latex}$$`);
    });
  }
  for (const ex of r.excluded ?? []) lines.push(`- $${ex.value_latex}$ — ${ex.reason}`);
  return lines.join("\n\n");
}

export function mathSummary(question: string, r: MathResult): string {
  const parts = [`Problem: ${question}`, `Final answer: ${r.result_text ?? "none"}`, `Status: ${r.status}`];
  r.steps?.forEach((s, i) => parts.push(`Step ${i + 1}: ${s.text} ${s.latex}`));
  if (r.message) parts.push(`Note: ${r.message}`);
  return parts.join("\n");
}

export function lessonText(t: ScienceTopic, grade: number): string {
  const level = levelFor(grade);
  const src = sourcesFor(t).map((s) => `${s.publisher}, *${s.title}*`).join("; ");
  const parts = [
    `### ${t.title}`,
    t.summary[level],
    "**Key points:**",
    ...t.keyPoints.map((k) => `- ${k}`),
    "**Words to know:**",
    ...t.definitions.map((d) => `- **${d.term}:** ${d.meaning}`),
    `**Example — ${t.example.title}:** ${t.example.body}`,
  ];
  if (t.uncertainty) parts.push(`**What scientists are less sure about:** ${t.uncertainty}`);
  parts.push(`**Check yourself:** ${t.practice[0].question}`);
  parts.push(`_Checked against: ${src}._`);
  return parts.join("\n\n");
}

export function lessonReference(t: ScienceTopic, grade: number): string {
  return [t.title, t.summary[levelFor(grade)], ...t.keyPoints, ...t.definitions.map((d) => `${d.term}: ${d.meaning}`), `Example: ${t.example.body}`, t.uncertainty ? `Uncertain: ${t.uncertainty}` : ""].filter(Boolean).join("\n");
}

const HELP = `I can't find that in my built-in lessons yet. Here's what I can do on this device:

- **Math:** arithmetic, fractions, percentages, equations, algebra, geometry formulas, functions, trig values and statistics — e.g. *“Solve 3x + 7 = 22”*.
- **Science:** lessons on cells, photosynthesis, DNA, atoms, the periodic table, forces, energy, waves, electricity, plate tectonics, the water cycle and more — e.g. *“Explain photosynthesis”*.
- **Quizzes:** *“Quiz me on grade 8 science”*.
- **Roblox:** *“Open Roblox”*.`;

export function respond(message: string, ctx: BrainContext): BrainReply {
  const text = message.trim();
  const sc = screen(text);
  if (sc.crisis) return { content: CRISIS_REPLY, meta: { intent: "safety", source: "fallback" } };
  const reply = route(text, ctx);
  if (sc.personalInfo) reply.content += `\n\n${PERSONAL_INFO_NOTE}`;
  return reply;
}

function route(text: string, ctx: BrainContext): BrainReply {
  const intent = classify(text, ctx.savedPlaces);

  switch (intent.type) {
    case "settings": {
      if (intent.grade !== undefined) {
        if (intent.grade < 7 || intent.grade > 12) return { content: "I can help with grades 7 to 12. Which of those grades are you in?", meta: { intent: "settings" } };
        return { content: `Level up! I've set your grade to **${intent.grade}**. I'll explain things at a grade ${intent.grade} level from now on.`, meta: { intent: "settings" }, settings: { grade: intent.grade } };
      }
      return { content: `You can change ${intent.setting} settings on the **Settings** screen.`, meta: { intent: "settings", action: { type: "open", page: "settings" } }, settings: { open: "settings" } };
    }

    case "quiz": {
      const grade = intent.grade && intent.grade >= 7 && intent.grade <= 12 ? intent.grade : ctx.grade;
      const subject = intent.subject ?? "science";
      const name = subject === "math" ? "math" : subject === "science" ? "science" : SUBJECT_NAMES[subject as keyof typeof SUBJECT_NAMES] ?? subject;
      return {
        content: `Quiz time! Tap the button to start a **grade ${grade} ${name}** quiz.`,
        meta: { intent: "quiz", action: { type: "quiz", subject, grade } },
      };
    }

    case "launch": {
      const app = intent.app!;
      if (!app.id) {
        return { content: `Sorry, “${app.requested}” isn't on my approved list, so I can't open it. I can open Roblox${ctx.windowsLaunch ? ", Chrome, Edge, Calculator, Notepad and Paint on this PC" : ""}.`, meta: { intent: "launch" } };
      }
      if (app.id === "roblox") {
        const place = app.place ? ctx.savedPlaces.find((p) => p.placeId === app.place) : undefined;
        return {
          content: place
            ? `Ready to launch **${place.name}**! Tap the button below — your phone needs a tap from you to switch to Roblox.`
            : "Ready! Tap the button below to open Roblox. Your browser needs a tap from you before it can switch to another app.",
          meta: { intent: "launch", action: { type: "roblox", placeId: place?.placeId, placeName: place?.name } },
        };
      }
      if (ctx.windowsLaunch) {
        return { content: `Tap the button to open **${APP_NAMES[app.id]}** on this PC.`, meta: { intent: "launch", action: { type: "windows-launch", appId: app.id } } };
      }
      return { content: `I can only open ${APP_NAMES[app.id]} when JARVIS runs on your Windows PC with its desktop service. On a phone I can open Roblox.`, meta: { intent: "launch" } };
    }

    case "math": {
      const r = solveMathMessage(text);
      if (!r) break;
      const usable = r.status === "verified" || r.status === "approximate" || r.status === "unverified";
      return {
        content: mathToText(r),
        meta: { intent: "math", math: r, source: "engine", practiceTopic: r.practice_topic },
        aiTask: usable && r.steps?.length ? { kind: "math", reference: mathSummary(text, r) } : undefined,
      };
    }

    case "science":
    case "conversation": {
      const greeting = /^(hi|hello|hey|yo|sup|good (morning|afternoon|evening))\b|^(hi|hello|hey)\s+jarvis\b/i.test(text);
      if (greeting && text.length < 40) {
        return { content: "Hello, Player! Ready for your next mission? Ask me a math or science question, start a quiz, or say “open Roblox”.", meta: { intent: "conversation" } };
      }
      const hits = searchTopics(text, { grade: ctx.grade });
      if (hits.length) {
        const t = hits[0].topic;
        return {
          content: lessonText(t, ctx.grade),
          meta: { intent: "science", topicId: t.id, source: "curated" },
          aiTask: { kind: "rephrase", reference: lessonReference(t, ctx.grade) },
        };
      }
      const meta: MessageMeta = { intent: intent.type, source: "fallback" };
      if (intent.confirmApp === "roblox") meta.action = { type: "roblox" };
      return { content: HELP, meta, aiTask: { kind: "open", reference: "" } };
    }
  }
  return { content: HELP, meta: { intent: "conversation", source: "fallback" }, aiTask: { kind: "open", reference: "" } };
}

export { APP_ALIASES };
