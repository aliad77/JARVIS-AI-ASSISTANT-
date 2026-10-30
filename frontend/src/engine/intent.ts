/**
 * Deterministic intent routing (port of backend/app/ai/intent.py).
 * Launching anything is decided ONLY here, from the user's own words — never by
 * AI output — and only for allowlisted names.
 */
import { detectMath, solveWordProblem, wordsToNumbers } from "./math/word";

export type IntentType = "launch" | "settings" | "quiz" | "math" | "science" | "conversation";

export interface Intent {
  type: IntentType;
  app?: { id: string | null; requested: string; place?: string }; // launch
  grade?: number; // settings: grade change, quiz grade
  setting?: string; // settings: open a section
  subject?: string; // quiz subject
  confirmApp?: string; // ambiguous mention of an app → offer a button
}

export const APP_ALIASES: Record<string, string> = {
  roblox: "roblox", "roblox app": "roblox", "roblox player": "roblox", "roblox game": "roblox", "roblox games": "roblox",
  chrome: "chrome", "google chrome": "chrome",
  edge: "edge", "microsoft edge": "edge",
  calculator: "calculator", calc: "calculator", "windows calculator": "calculator",
  notepad: "notepad", "note pad": "notepad",
  paint: "paint", "ms paint": "paint", "microsoft paint": "paint", mspaint: "paint",
};

const PREFIX = String.raw`^(?:(?:hey|hi|ok|okay|yo)\s+)?(?:jarvis\b[\s,:!.-]*)?(?:(?:please|pls)\s+)?(?:(?:can|could|would|will)\s+you\s+(?:please\s+)?)?(?:(?:please|pls)\s+)?`;
const LAUNCH = new RegExp(PREFIX + String.raw`(?:open|launch|start|run|load|fire up|boot up|start up|bring up|play)\s+(?:up\s+)?(.+?)\s*(?:for me)?\s*(?:please)?[.!?]*$`, "i");
const GRADE = new RegExp(PREFIX + String.raw`(?:set|change|switch|make|put)\s+(?:my\s+|the\s+)?(?:school\s+)?(?:grade|year|level)(?:\s+level)?\s+(?:to\s+)?(?:grade\s+)?(\d{1,2})(?:th)?\b`, "i");
const GRADE2 = /^(?:jarvis[\s,]*)?i(?:'m| am)\s+in\s+(?:grade\s+(\d{1,2})|(\d{1,2})(?:st|nd|rd|th)\s+grade)\b/i;
const TOGGLE = new RegExp(PREFIX + String.raw`(?:(?:turn|switch)\s+(?:on|off)\s+|(?:enable|disable|mute|unmute)\s+)(?:the\s+|my\s+)?(voice|sound|sounds|sound effects|animations|motion|speech|local ai|ai)\b`, "i");
const QUIZ = new RegExp(PREFIX + String.raw`(?:quiz|test)\s+me(?:\s+on)?(.*)$|^` + PREFIX.slice(1) + String.raw`(?:give me|start|make|do|take)\s+(?:a\s+)?(?:quick\s+)?(?:quiz|test)(?:\s+(?:on|about))?(.*)$`, "i");
const QUESTION = /^(?:what|why|how|when|where|who|which|explain|describe|define|teach|tell me about|help me (?:understand|with)|can you explain|is it true)\b/i;

const SUBJECT_WORDS: [RegExp, string][] = [
  [/\bmath(s|ematics)?\b|\balgebra\b|\bfractions?\b|\bgeometry\b|\bequations?\b/i, "math"],
  [/\bbiology\b|\bcells?\b|\bgenetics\b/i, "biology"],
  [/\bchemistry\b|\batoms?\b|\bperiodic\b/i, "chemistry"],
  [/\bphysics\b|\bforces?\b|\benergy\b/i, "physics"],
  [/\bearth science\b|\bgeology\b|\bweather\b|\bclimate\b/i, "earth_science"],
  [/\bscience\b/i, "science"],
];

function cleanTarget(raw: string): string {
  let t = raw.trim().replace(/^["']|["']$/g, "");
  for (let i = 0; i < 3; i++) t = t.replace(/^(?:the|my|a|an|up)\s+/i, "").replace(/\s+(?:app|application|program|now|please)$/i, "");
  return t.replace(/[.!?]+$/, "").trim().toLowerCase();
}

function subjectOf(text: string): string | undefined {
  return SUBJECT_WORDS.find(([re]) => re.test(text))?.[1];
}

export function classify(message: string, savedPlaces: { name: string; placeId: string }[] = []): Intent {
  const text = wordsToNumbers(message.trim());

  let m = GRADE.exec(text) ?? GRADE2.exec(text);
  if (m) return { type: "settings", grade: Number(m[1] ?? m[2]) };
  m = TOGGLE.exec(text);
  if (m) return { type: "settings", setting: m[1].toLowerCase() };

  m = QUIZ.exec(text);
  if (m) {
    const rest = (m[1] ?? m[2] ?? "").trim();
    const g = /\bgrade\s+(\d{1,2})\b|\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/i.exec(rest);
    return { type: "quiz", grade: g ? Number(g[1] ?? g[2]) : undefined, subject: subjectOf(rest) ?? (rest ? undefined : "math") };
  }

  m = LAUNCH.exec(text);
  if (m) {
    const target = cleanTarget(m[1]);
    // "open roblox adopt me" → a saved favourite place
    if (target.startsWith("roblox")) {
      const rest = target.replace(/^roblox\s*/, "");
      if (!rest || APP_ALIASES[target]) return { type: "launch", app: { id: "roblox", requested: target } };
      const place = savedPlaces.find((p) => p.name.toLowerCase() === rest);
      if (place) return { type: "launch", app: { id: "roblox", requested: target, place: place.placeId } };
    }
    const savedOnly = savedPlaces.find((p) => p.name.toLowerCase() === target);
    if (savedOnly) return { type: "launch", app: { id: "roblox", requested: target, place: savedOnly.placeId } };
    const id = APP_ALIASES[target];
    if (id) return { type: "launch", app: { id, requested: target } };
    if (target.split(/\s+/).length <= 3 && !detectMath(target) && !QUESTION.test(target) && !subjectOf(target)) {
      return { type: "launch", app: { id: null, requested: target.slice(0, 40) } };
    }
  }

  if (solveWordProblem(text) || detectMath(text)) return { type: "math" };

  const lower = text.toLowerCase();
  if (!QUESTION.test(text) && /\b(?:play|open|launch)\b/.test(lower)) {
    for (const alias of Object.keys(APP_ALIASES).sort((a, b) => b.length - a.length)) {
      if (new RegExp(`\\b${alias.replace(/ /g, "\\s+")}\\b`).test(lower)) return { type: "conversation", confirmApp: APP_ALIASES[alias] };
    }
  }
  if (subjectOf(text) || QUESTION.test(text) || text.endsWith("?")) return { type: "science" };
  return { type: "conversation" };
}
