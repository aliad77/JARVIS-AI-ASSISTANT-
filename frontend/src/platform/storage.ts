/**
 * On-device persistence (localStorage) for preferences, conversation history,
 * quiz attempts and progress. Nothing here leaves the device.
 *
 * Limits keep storage small on phones (browsers typically allow ~5 MB per
 * origin for localStorage): at most 40 conversations × 150 messages, 8 000
 * characters per message, and a ~3 MB overall budget. Oldest conversations are
 * pruned first. Every read is validated, so corrupted data falls back to defaults.
 */
import type { MathResult } from "../engine/math/types";

export const LIMITS = {
  conversations: 40,
  messagesPerConversation: 150,
  messageChars: 8000,
  quizAttempts: 100,
  robloxPlaces: 10,
  budgetChars: 3_000_000,
};

const PREFIX = "jarvis.v2.";

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
}

export class MemoryStorage implements KV {
  private m = new Map<string, string>();
  quota = Infinity;
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.has(k) ? this.m.get(k)! : null;
  }
  setItem(k: string, v: string) {
    const used = [...this.m.entries()].reduce((a, [kk, vv]) => a + (kk === k ? 0 : kk.length + vv.length), 0);
    if (used + k.length + v.length > this.quota) {
      const e = new Error("quota");
      e.name = "QuotaExceededError";
      throw e;
    }
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

function defaultBackend(): KV {
  try {
    const ls = globalThis.localStorage;
    const probe = `${PREFIX}probe`;
    ls.setItem(probe, "1");
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStorage(); // private mode / storage disabled: session-only
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Grade = 7 | 8 | 9 | 10 | 11 | 12;

export interface RobloxPlace {
  name: string;
  placeId: string;
}

export interface Preferences {
  grade: Grade;
  subject: string;
  voiceEnabled: boolean;
  voiceRate: number;
  voiceName: string;
  voiceLang: string;
  muteResponses: boolean;
  reducedMotion: boolean;
  soundEffects: boolean;
  saveHistory: boolean;
  localAI: { enabled: boolean; modelId: string; consentedModelId: string | null };
  robloxPlaces: RobloxPlace[];
}

export const DEFAULT_PREFS: Preferences = {
  grade: 7,
  subject: "general",
  voiceEnabled: true,
  voiceRate: 1,
  voiceName: "",
  voiceLang: "en-US",
  muteResponses: false,
  reducedMotion: false,
  soundEffects: true,
  saveHistory: true,
  localAI: { enabled: false, modelId: "", consentedModelId: null },
  robloxPlaces: [],
};

export interface MessageMeta {
  intent?: string;
  math?: MathResult;
  topicId?: string;
  action?: { type: "roblox"; placeId?: string; placeName?: string } | { type: "windows-launch"; appId: string } | { type: "quiz"; subject: string; grade: number } | { type: "open"; page: string };
  source?: "engine" | "curated" | "local-ai" | "fallback";
  aiNote?: string;
  practiceTopic?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  meta: MessageMeta;
  createdAt: string;
}

export interface Conversation {
  id: string;
  title: string;
  grade: number;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface QuizAttempt {
  id: string;
  title: string;
  subject: string;
  grade: number;
  score: number;
  total: number;
  createdAt: string;
}

export interface ProgressRow {
  subject: string;
  correct: number;
  attempted: number;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const GRADES = [7, 8, 9, 10, 11, 12];
const PLACE_ID = /^[1-9]\d{0,19}$/;

export function sanitizePrefs(raw: unknown): Preferences {
  const p = isObj(raw) ? raw : {};
  const out: Preferences = structuredClone(DEFAULT_PREFS);
  if (GRADES.includes(p.grade as number)) out.grade = p.grade as Grade;
  if (typeof p.subject === "string" && /^[a-z_]{1,20}$/.test(p.subject)) out.subject = p.subject;
  for (const k of ["voiceEnabled", "muteResponses", "reducedMotion", "soundEffects", "saveHistory"] as const) if (typeof p[k] === "boolean") out[k] = p[k] as boolean;
  if (typeof p.voiceRate === "number" && p.voiceRate >= 0.5 && p.voiceRate <= 2) out.voiceRate = Math.round(p.voiceRate * 10) / 10;
  if (typeof p.voiceName === "string") out.voiceName = p.voiceName.slice(0, 120);
  if (typeof p.voiceLang === "string" && /^[a-z]{2}-[A-Z]{2}$/.test(p.voiceLang)) out.voiceLang = p.voiceLang;
  if (isObj(p.localAI)) {
    const l = p.localAI;
    out.localAI = {
      enabled: l.enabled === true,
      modelId: typeof l.modelId === "string" ? l.modelId.slice(0, 80) : "",
      consentedModelId: typeof l.consentedModelId === "string" ? l.consentedModelId.slice(0, 80) : null,
    };
  }
  if (Array.isArray(p.robloxPlaces)) {
    out.robloxPlaces = p.robloxPlaces
      .filter((x): x is RobloxPlace => isObj(x) && typeof x.placeId === "string" && PLACE_ID.test(x.placeId) && typeof x.name === "string")
      .slice(0, LIMITS.robloxPlaces)
      .map((x) => ({ name: x.name.slice(0, 40), placeId: x.placeId }));
  }
  return out;
}

function validMessage(m: unknown): m is ChatMessage {
  return isObj(m) && typeof m.id === "string" && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && isObj(m.meta) && typeof m.createdAt === "string";
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export class LocalStore {
  constructor(private kv: KV = defaultBackend()) {}

  private read<T>(key: string): T | null {
    try {
      const raw = this.kv.getItem(PREFIX + key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown, protectId?: string): boolean {
    const text = JSON.stringify(value);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        this.kv.setItem(PREFIX + key, text);
        return true;
      } catch (e) {
        if (!(e instanceof Error) || !/quota/i.test(e.name + e.message)) return false;
        if (!this.pruneOldest(protectId)) return false; // nothing left to free
      }
    }
    return false;
  }

  /** Approximate characters used by JARVIS keys. */
  usage(): number {
    let total = 0;
    for (let i = 0; i < this.kv.length; i++) {
      const k = this.kv.key(i);
      if (k?.startsWith(PREFIX)) total += k.length + (this.kv.getItem(k)?.length ?? 0);
    }
    return total;
  }

  // -- preferences --------------------------------------------------------
  getPrefs(): Preferences {
    return sanitizePrefs(this.read("prefs"));
  }
  setPrefs(changes: Partial<Preferences>): Preferences {
    const next = sanitizePrefs({ ...this.getPrefs(), ...changes });
    this.write("prefs", next);
    return next;
  }

  // -- conversations -----------------------------------------------------
  listConversations(): Conversation[] {
    const list = this.read<Conversation[]>("conversations");
    return Array.isArray(list) ? list.filter((c) => isObj(c) && typeof c.id === "string").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : [];
  }

  getMessages(id: string): ChatMessage[] {
    const msgs = this.read<unknown[]>(`conv.${id}`);
    return Array.isArray(msgs) ? msgs.filter(validMessage) : [];
  }

  createConversation(title: string, grade: number): Conversation {
    const now = new Date().toISOString();
    const conv: Conversation = { id: newId(), title: title.slice(0, 60) || "New mission", grade, createdAt: now, updatedAt: now, messageCount: 0 };
    if (!this.getPrefs().saveHistory) return conv; // session-only: nothing written
    const list = [conv, ...this.listConversations()];
    while (list.length > LIMITS.conversations) {
      const old = list.pop()!;
      this.kv.removeItem(`${PREFIX}conv.${old.id}`);
    }
    this.write("conversations", list);
    return conv;
  }

  addMessage(convId: string, msg: Omit<ChatMessage, "id" | "createdAt">): ChatMessage {
    const full: ChatMessage = { ...msg, content: msg.content.slice(0, LIMITS.messageChars), id: newId(), createdAt: new Date().toISOString() };
    if (!this.getPrefs().saveHistory) return full;
    const msgs = [...this.getMessages(convId), full].slice(-LIMITS.messagesPerConversation);
    this.write(`conv.${convId}`, msgs, convId);
    const list = this.listConversations().map((c) => (c.id === convId ? { ...c, updatedAt: full.createdAt, messageCount: msgs.length } : c));
    this.write("conversations", list);
    this.enforceBudget();
    return full;
  }

  deleteConversation(id: string): void {
    this.kv.removeItem(`${PREFIX}conv.${id}`);
    this.write("conversations", this.listConversations().filter((c) => c.id !== id));
  }

  clearConversations(): number {
    const list = this.listConversations();
    for (const c of list) this.kv.removeItem(`${PREFIX}conv.${c.id}`);
    this.write("conversations", []);
    return list.length;
  }

  /** Delete the least recently used conversation, never the one being written. */
  private pruneOldest(protectId?: string): boolean {
    const list = this.listConversations();
    const idx = list.map((c) => c.id).lastIndexOf(list.filter((c) => c.id !== protectId).at(-1)?.id ?? "");
    if (idx < 0) return false;
    const [old] = list.splice(idx, 1);
    this.kv.removeItem(`${PREFIX}conv.${old.id}`);
    try {
      this.kv.setItem(`${PREFIX}conversations`, JSON.stringify(list));
    } catch {
      /* ignore */
    }
    return true;
  }

  private enforceBudget(): void {
    let guard = 0;
    while (this.usage() > LIMITS.budgetChars && guard++ < LIMITS.conversations && this.listConversations().length > 1) this.pruneOldest();
  }

  // -- quizzes & progress -----------------------------------------------
  listQuizAttempts(): QuizAttempt[] {
    const list = this.read<QuizAttempt[]>("quizAttempts");
    return Array.isArray(list) ? list.filter((a) => isObj(a) && typeof a.score === "number") : [];
  }

  addQuizAttempt(a: Omit<QuizAttempt, "id" | "createdAt">): QuizAttempt {
    const full = { ...a, id: newId(), createdAt: new Date().toISOString() };
    this.write("quizAttempts", [full, ...this.listQuizAttempts()].slice(0, LIMITS.quizAttempts));
    this.recordProgress(a.subject, a.score, a.total);
    return full;
  }

  getProgress(): ProgressRow[] {
    const rows = this.read<ProgressRow[]>("progress");
    return Array.isArray(rows) ? rows.filter((r) => isObj(r) && typeof r.correct === "number" && typeof r.attempted === "number") : [];
  }

  recordProgress(subject: string, correct: number, attempted: number): void {
    const rows = this.getProgress();
    const row = rows.find((r) => r.subject === subject);
    if (row) {
      row.correct += correct;
      row.attempted += attempted;
    } else rows.push({ subject, correct, attempted });
    this.write("progress", rows);
  }

  clearLearningData(): void {
    this.kv.removeItem(`${PREFIX}quizAttempts`);
    this.kv.removeItem(`${PREFIX}progress`);
  }

  /** Remove every JARVIS key from this device. */
  clearAll(): void {
    const keys: string[] = [];
    for (let i = 0; i < this.kv.length; i++) {
      const k = this.kv.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => this.kv.removeItem(k));
  }
}

export function newId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "");
  const bytes = new Uint8Array(16);
  c?.getRandomValues?.(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const store = new LocalStore();
