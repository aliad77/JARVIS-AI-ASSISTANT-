import { describe, expect, it, vi } from "vitest";
import {
  assessModel,
  classifyLoadError,
  detectCapabilities,
  LocalAI,
  MODELS,
  recommendModel,
  sanitizeModelOutput,
  type CapabilityEnv,
  type DeviceCapability,
  type EngineLike,
} from "../ai/localModel";

function gpu(opts: { adapter?: boolean; f16?: boolean; maxBuffer?: number; throws?: boolean } = {}): CapabilityEnv["navigator"]["gpu"] {
  return {
    requestAdapter: async () => {
      if (opts.throws) throw new Error("GPU process crashed");
      if (opts.adapter === false) return null;
      return { features: { has: (f: string) => f === "shader-f16" && Boolean(opts.f16) }, limits: { maxBufferSize: opts.maxBuffer ?? 2 ** 31, maxStorageBufferBindingSize: opts.maxBuffer ?? 2 ** 30 } };
    },
  };
}

const storage = (freeMB: number) => ({ estimate: async () => ({ quota: freeMB * 1e6, usage: 0 }) });

const DESKTOP_CHROME: CapabilityEnv = { isSecureContext: true, navigator: { gpu: gpu({ f16: true }), deviceMemory: 8, userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/140", storage: storage(50_000) } };
const ANDROID_LOW: CapabilityEnv = { isSecureContext: true, navigator: { gpu: gpu({ f16: true }), deviceMemory: 2, userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile Chrome/140", storage: storage(10_000) } };
const IPHONE_NO_WEBGPU: CapabilityEnv = { isSecureContext: true, navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari", storage: storage(5_000) } };
const IPHONE_WEBGPU: CapabilityEnv = { isSecureContext: true, navigator: { gpu: gpu({ f16: true }), userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Safari", storage: storage(5_000) } };

describe("device capability detection (simulated devices)", () => {
  it("desktop with WebGPU + f16 + 8 GB: default model likely works", async () => {
    const cap = await detectCapabilities(DESKTOP_CHROME);
    expect(cap).toMatchObject({ webgpu: true, adapter: true, shaderF16: true, deviceMemoryGB: 8, mobile: false });
    expect(recommendModel(cap)?.model.tier).toBe("default");
    expect(assessModel(cap, MODELS[0]).level).toBe("likely");
  });

  it("phone without WebGPU is unsupported, never 'ready'", async () => {
    const cap = await detectCapabilities(IPHONE_NO_WEBGPU);
    expect(cap.webgpu).toBe(false);
    expect(assessModel(cap, MODELS[0]).level).toBe("unsupported");
    expect(recommendModel(cap)).toBeNull();
  });

  it("phone with WebGPU but unknown memory is only 'uncertain', and prefers the lite model", async () => {
    const cap = await detectCapabilities(IPHONE_WEBGPU);
    const rec = recommendModel(cap);
    expect(rec?.model.tier).toBe("lite");
    expect(rec?.suitability.level).toBe("uncertain");
  });

  it("low-memory Android is flagged insufficient for the bigger models", async () => {
    const cap = await detectCapabilities(ANDROID_LOW);
    expect(assessModel(cap, MODELS.find((m) => m.tier === "default")!).level).toBe("insufficient");
  });

  it("needs a secure context and an adapter", async () => {
    expect(assessModel(await detectCapabilities({ ...DESKTOP_CHROME, isSecureContext: false }), MODELS[0]).level).toBe("unsupported");
    expect(assessModel(await detectCapabilities({ ...DESKTOP_CHROME, navigator: { ...DESKTOP_CHROME.navigator, gpu: gpu({ adapter: false }) } }), MODELS[0]).level).toBe("unsupported");
    const crashed = await detectCapabilities({ ...DESKTOP_CHROME, navigator: { ...DESKTOP_CHROME.navigator, gpu: gpu({ throws: true }) } });
    expect(crashed.error).toMatch(/crashed/);
  });

  it("without shader-f16 only the f32 model is suitable", async () => {
    const cap = await detectCapabilities({ ...DESKTOP_CHROME, navigator: { ...DESKTOP_CHROME.navigator, gpu: gpu({ f16: false }) } });
    expect(assessModel(cap, MODELS.find((m) => m.tier === "default")!).level).toBe("insufficient");
    expect(recommendModel(cap)?.model.tier).toBe("compat");
  });

  it("refuses when storage is too small for the download", () => {
    const cap: DeviceCapability = { secureContext: true, webgpu: true, adapter: true, shaderF16: true, maxBufferMB: 2048, deviceMemoryGB: 8, storageFreeMB: 100, mobile: false };
    expect(assessModel(cap, MODELS[0])).toMatchObject({ level: "insufficient" });
  });

  it("documents download sizes for every model", () => {
    for (const m of MODELS) {
      expect(m.downloadMB).toBeGreaterThan(100);
      expect(m.license).toBe("Apache-2.0");
    }
  });
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

function fakeEngine(tokens: string[] = ["Hello ", "student"]): EngineLike {
  return {
    chat: {
      completions: {
        create: async () =>
          (async function* () {
            for (const t of tokens) yield { choices: [{ delta: { content: t } }] };
          })(),
      },
    },
    interruptGenerate: vi.fn(),
    unload: vi.fn(async () => undefined),
  };
}

describe("LocalAI engine wrapper", () => {
  it("never downloads without explicit consent", async () => {
    const factory = vi.fn();
    const ai = new LocalAI(factory);
    await expect(ai.load(MODELS[0].id, false)).rejects.toThrow(/consent/);
    expect(factory).not.toHaveBeenCalled();
  });

  it("reports progress and is only 'ready' after initialisation resolves", async () => {
    const d = deferred<EngineLike>();
    let progress: ((p: { progress: number; text: string }) => void) | undefined;
    const ai = new LocalAI((_id, onProgress) => {
      progress = onProgress;
      return d.promise;
    });
    const states: string[] = [];
    ai.subscribe((s) => states.push(s.state));
    const loading = ai.load(MODELS[2].id, true);
    await Promise.resolve(); // let the previous-engine unload settle
    expect(ai.status.state).toBe("loading");
    await Promise.resolve();
    progress?.({ progress: 0.5, text: "Fetching param cache[5/10]" });
    expect(ai.status).toMatchObject({ state: "loading", progress: 0.5 });
    expect(ai.ready).toBe(false);
    await expect(ai.generate([{ role: "user", content: "hi" }])).rejects.toThrow(/not ready/);
    d.resolve(fakeEngine());
    await loading;
    expect(ai.ready).toBe(true);
    expect(states).toContain("loading");
    expect(states.at(-1)).toBe("ready");
  });

  it("falls back cleanly when the model fails to load (out of memory)", async () => {
    const ai = new LocalAI(async () => {
      throw new Error("Device was lost: out of memory");
    });
    expect(await ai.load(MODELS[0].id, true)).toBe(false);
    expect(ai.status).toMatchObject({ state: "error", kind: "memory" });
    expect(ai.ready).toBe(false);
  });

  it("classifies load errors", () => {
    expect(classifyLoadError(new Error("WebGPU is not supported")).kind).toBe("unsupported");
    expect(classifyLoadError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(classifyLoadError(new Error("weird")).kind).toBe("unknown");
  });

  it("cancelling a load never ends up 'ready'", async () => {
    const d = deferred<EngineLike>();
    const engine = fakeEngine();
    const ai = new LocalAI(() => d.promise);
    const p = ai.load(MODELS[0].id, true);
    ai.cancel();
    d.resolve(engine);
    expect(await p).toBe(false);
    expect(ai.ready).toBe(false);
    expect(engine.unload).toHaveBeenCalled();
  });

  it("streams and sanitises generated text", async () => {
    const ai = new LocalAI(async () => fakeEngine(["Visit https://evil.example ", "or <b>roblox://placeId=1</b> now"]));
    await ai.load(MODELS[0].id, true);
    const seen: string[] = [];
    const out = await ai.generate([{ role: "user", content: "hi" }], { onToken: (t) => seen.push(t) });
    expect(seen.length).toBe(2);
    expect(out).not.toMatch(/https?:|roblox:|<b>/);
    expect(out).toContain("[link removed]");
  });

  it("sanitizeModelOutput strips schemes and markup", () => {
    expect(sanitizeModelOutput('<img src=x onerror="alert(1)">javascript:alert(1) www.bad.com')).toBe("[link removed] [link removed]");
  });
});
