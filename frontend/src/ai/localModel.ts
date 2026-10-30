/**
 * Optional on-device language model via WebLLM (@mlc-ai/web-llm, Apache-2.0).
 *
 * - Inference runs on the user's device through WebGPU. No API key, no remote inference.
 * - The model weights (hundreds of MB) are downloaded from Hugging Face and the
 *   WebGPU library from GitHub only after the user explicitly agrees; the browser
 *   then caches them.
 * - The WebLLM library itself is loaded lazily with a dynamic import so phones
 *   that never enable local AI don't download it.
 * - Status only becomes "ready" after engine initialization has resolved.
 */

export interface ModelInfo {
  id: string; // WebLLM prebuilt model id
  label: string;
  baseModel: string;
  license: string;
  /** Measured download size in MB (weights + WebGPU library), see docs/LOCAL_AI.md. */
  downloadMB: number;
  /** Approximate GPU memory needed, from WebLLM's prebuilt config (vram_required_MB). */
  vramMB: number;
  needsShaderF16: boolean;
  tier: "default" | "compat" | "lite";
}

export const MODELS: ModelInfo[] = [
  { id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC", label: "Qwen2.5 0.5B Instruct", baseModel: "Qwen/Qwen2.5-0.5B-Instruct", license: "Apache-2.0", downloadMB: 295, vramMB: 945, needsShaderF16: true, tier: "default" },
  { id: "Qwen2.5-0.5B-Instruct-q4f32_1-MLC", label: "Qwen2.5 0.5B Instruct (compatibility)", baseModel: "Qwen/Qwen2.5-0.5B-Instruct", license: "Apache-2.0", downloadMB: 296, vramMB: 1060, needsShaderF16: false, tier: "compat" },
  { id: "SmolLM2-360M-Instruct-q4f16_1-MLC", label: "SmolLM2 360M Instruct (lite)", baseModel: "HuggingFaceTB/SmolLM2-360M-Instruct", license: "Apache-2.0", downloadMB: 214, vramMB: 376, needsShaderF16: true, tier: "lite" },
];

export const getModel = (id: string) => MODELS.find((m) => m.id === id);

// ---------------------------------------------------------------------------
// Capability detection
// ---------------------------------------------------------------------------

export interface DeviceCapability {
  secureContext: boolean;
  webgpu: boolean;
  adapter: boolean;
  shaderF16: boolean;
  maxBufferMB: number | null;
  deviceMemoryGB: number | null; // Chrome-only hint, capped by the browser (often at 8)
  storageFreeMB: number | null;
  mobile: boolean;
  error?: string;
}

interface GpuLike {
  requestAdapter(): Promise<{ features: { has(f: string): boolean }; limits: { maxBufferSize?: number; maxStorageBufferBindingSize?: number } } | null>;
}

export interface CapabilityEnv {
  isSecureContext: boolean;
  navigator: {
    gpu?: GpuLike;
    deviceMemory?: number;
    userAgent?: string;
    storage?: { estimate?: () => Promise<{ quota?: number; usage?: number }> };
  };
}

function defaultEnv(): CapabilityEnv {
  return { isSecureContext: globalThis.isSecureContext ?? false, navigator: globalThis.navigator as unknown as CapabilityEnv["navigator"] };
}

export async function detectCapabilities(env: CapabilityEnv = defaultEnv()): Promise<DeviceCapability> {
  const nav = env.navigator ?? {};
  const cap: DeviceCapability = {
    secureContext: Boolean(env.isSecureContext),
    webgpu: Boolean(nav.gpu),
    adapter: false,
    shaderF16: false,
    maxBufferMB: null,
    deviceMemoryGB: typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    storageFreeMB: null,
    mobile: /android|iphone|ipad|ipod|mobile/i.test(nav.userAgent ?? ""),
  };
  try {
    const est = await nav.storage?.estimate?.();
    if (est && typeof est.quota === "number") cap.storageFreeMB = Math.floor((est.quota - (est.usage ?? 0)) / 1e6);
  } catch {
    /* unknown */
  }
  if (!cap.webgpu || !nav.gpu) return cap;
  try {
    const adapter = await nav.gpu.requestAdapter();
    if (adapter) {
      cap.adapter = true;
      cap.shaderF16 = adapter.features.has("shader-f16");
      const lim = adapter.limits;
      const bytes = Math.min(lim.maxBufferSize ?? Infinity, lim.maxStorageBufferBindingSize ?? Infinity);
      cap.maxBufferMB = Number.isFinite(bytes) ? Math.floor(bytes / (1024 * 1024)) : null;
    }
  } catch (e) {
    cap.error = e instanceof Error ? e.message : "WebGPU adapter request failed";
  }
  return cap;
}

export type SuitabilityLevel = "unsupported" | "insufficient" | "uncertain" | "likely";

export interface Suitability {
  level: SuitabilityLevel;
  reasons: string[];
}

/** Rough, conservative check. "likely" is not a guarantee — real limits are only known after loading. */
export function assessModel(cap: DeviceCapability, model: ModelInfo): Suitability {
  const reasons: string[] = [];
  if (!cap.secureContext) return { level: "unsupported", reasons: ["Local AI needs a secure (HTTPS or localhost) page."] };
  if (!cap.webgpu) return { level: "unsupported", reasons: ["This browser doesn't support WebGPU, which local AI needs."] };
  if (!cap.adapter) return { level: "unsupported", reasons: [cap.error ? `WebGPU isn't available: ${cap.error}` : "WebGPU is present but no compatible graphics adapter was found."] };
  let level: SuitabilityLevel = "likely";
  if (model.needsShaderF16 && !cap.shaderF16) return { level: "insufficient", reasons: ["This model needs the WebGPU 'shader-f16' feature, which this device doesn't offer."] };
  if (cap.maxBufferMB !== null && cap.maxBufferMB < 128) return { level: "insufficient", reasons: [`The GPU allows buffers of only ${cap.maxBufferMB} MB.`] };
  if (cap.storageFreeMB !== null && cap.storageFreeMB < model.downloadMB * 1.2) {
    return { level: "insufficient", reasons: [`Not enough free browser storage: about ${cap.storageFreeMB} MB free, ${Math.ceil(model.downloadMB * 1.2)} MB needed.`] };
  }
  if (cap.deviceMemoryGB !== null) {
    const needGB = (model.vramMB * 2.5) / 1024; // model + browser + OS headroom
    if (cap.deviceMemoryGB < needGB) return { level: "insufficient", reasons: [`This device reports about ${cap.deviceMemoryGB} GB of memory; about ${Math.ceil(needGB)} GB is recommended.`] };
  } else {
    level = "uncertain";
    reasons.push("The browser doesn't report device memory, so JARVIS can't be sure the model fits.");
  }
  if (cap.mobile) {
    if (level === "likely") level = "uncertain";
    reasons.push("Phones vary a lot; the model may run slowly or the browser may stop it if memory runs low.");
  }
  if (cap.storageFreeMB === null) reasons.push("Free storage couldn't be checked.");
  return { level, reasons };
}

/** Best model for this device, preferring quality, or null if none can run. */
export function recommendModel(cap: DeviceCapability): { model: ModelInfo; suitability: Suitability } | null {
  const order = cap.mobile ? ["lite", "default", "compat"] : ["default", "compat", "lite"];
  for (const tier of order) {
    const model = MODELS.find((m) => m.tier === tier)!;
    const s = assessModel(cap, model);
    if (s.level === "likely" || s.level === "uncertain") return { model, suitability: s };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Engine wrapper
// ---------------------------------------------------------------------------

export type LocalAIStatus =
  | { state: "idle" }
  | { state: "loading"; modelId: string; progress: number; text: string }
  | { state: "ready"; modelId: string }
  | { state: "error"; modelId?: string; message: string; kind: "unsupported" | "memory" | "network" | "aborted" | "unknown" };

export interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

/** The subset of the WebLLM engine API JARVIS uses. */
export interface EngineLike {
  chat: {
    completions: {
      create(req: { messages: ChatTurn[]; stream: true; max_tokens: number; temperature: number }): Promise<AsyncIterable<{ choices: { delta?: { content?: string | null } }[] }>>;
    };
  };
  interruptGenerate(): void;
  unload(): Promise<void>;
}

export type EngineFactory = (modelId: string, onProgress: (p: { progress: number; text: string }) => void) => Promise<EngineLike>;

export const webllmFactory: EngineFactory = async (modelId, onProgress) => {
  const webllm = await import("@mlc-ai/web-llm");
  const engine = await webllm.CreateMLCEngine(modelId, {
    initProgressCallback: (r: { progress: number; text: string }) => onProgress({ progress: r.progress, text: r.text }),
  });
  return engine as unknown as EngineLike;
};

export function classifyLoadError(e: unknown): { kind: "unsupported" | "memory" | "network" | "unknown"; message: string } {
  const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  if (/out of memory|oom|allocation|device (was )?lost|memory/i.test(msg)) return { kind: "memory", message: "This device ran out of memory loading the model. JARVIS will keep using its built-in lessons." };
  if (/webgpu|adapter|shader-f16|feature/i.test(msg)) return { kind: "unsupported", message: "This browser or device can't run the local model (WebGPU problem). JARVIS will keep using its built-in lessons." };
  if (/fetch|network|failed to load|quota|cache|404|load failed/i.test(msg)) return { kind: "network", message: "The model download failed or storage is full. Check your connection and free space, then try again." };
  return { kind: "unknown", message: "The local AI couldn't start. JARVIS will keep using its built-in lessons." };
}

export class LocalAI {
  private engine: EngineLike | null = null;
  private listeners = new Set<(s: LocalAIStatus) => void>();
  status: LocalAIStatus = { state: "idle" };
  private loadToken = 0;

  constructor(private factory: EngineFactory = webllmFactory) {}

  subscribe(fn: (s: LocalAIStatus) => void): () => void {
    this.listeners.add(fn);
    fn(this.status);
    return () => this.listeners.delete(fn);
  }

  private set(s: LocalAIStatus) {
    this.status = s;
    this.listeners.forEach((fn) => fn(s));
  }

  get ready(): boolean {
    return this.status.state === "ready" && this.engine !== null;
  }

  /**
   * Download (if needed) and initialise a model. `consent` must be true: callers
   * must only pass it after the user approved the shown download size.
   */
  async load(modelId: string, consent: boolean): Promise<boolean> {
    if (!consent) throw new Error("Model download requires explicit user consent.");
    if (!getModel(modelId)) throw new Error("Unknown model.");
    const token = ++this.loadToken;
    this.set({ state: "loading", modelId, progress: 0, text: "Starting…" });
    try {
      await this.unload(false); // free any previous model first
      const engine = await this.factory(modelId, (p) => {
        if (token === this.loadToken) this.set({ state: "loading", modelId, progress: Math.max(0, Math.min(1, p.progress)), text: p.text });
      });
      if (token !== this.loadToken) {
        await engine.unload().catch(() => undefined); // cancelled meanwhile
        return false;
      }
      this.engine = engine;
      this.set({ state: "ready", modelId });
      return true;
    } catch (e) {
      if (token !== this.loadToken) return false;
      const { kind, message } = classifyLoadError(e);
      this.engine = null;
      this.set({ state: "error", modelId, kind, message });
      return false;
    }
  }

  /** Cancel an in-progress load (the download can't always be stopped instantly). */
  cancel(): void {
    this.loadToken++;
    this.engine = null;
    this.set({ state: "error", kind: "aborted", message: "Loading was cancelled." });
  }

  async unload(notify = true): Promise<void> {
    const e = this.engine;
    this.engine = null;
    if (e) await e.unload().catch(() => undefined);
    if (notify) this.set({ state: "idle" });
  }

  /** Stream a reply. Throws if not ready. Stops after `timeoutMs`. */
  async generate(messages: ChatTurn[], opts: { maxTokens?: number; onToken?: (t: string) => void; timeoutMs?: number } = {}): Promise<string> {
    if (!this.engine || this.status.state !== "ready") throw new Error("Local AI is not ready.");
    const engine = this.engine;
    let out = "";
    const timer = setTimeout(() => engine.interruptGenerate(), opts.timeoutMs ?? 60_000);
    try {
      const stream = await engine.chat.completions.create({ messages, stream: true, max_tokens: opts.maxTokens ?? 350, temperature: 0.3 });
      for await (const chunk of stream) {
        const piece = chunk.choices[0]?.delta?.content ?? "";
        if (piece) {
          out += piece;
          opts.onToken?.(out);
        }
      }
    } finally {
      clearTimeout(timer);
    }
    return sanitizeModelOutput(out);
  }
}

/** Model output is untrusted: remove links and anything that looks like markup or a URL scheme. */
export function sanitizeModelOutput(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/\b(?:https?|ftp|file|javascript|data|roblox|intent|ms-[a-z-]+):\/?\/?\S*/gi, "[link removed]")
    .replace(/\bwww\.\S+/gi, "[link removed]")
    .slice(0, 4000)
    .trim();
}

export const localAI = new LocalAI();
