import { Bot, Cpu, Download, Power, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Notice, Panel, PixelButton, Toggle } from "../../components/ui";
import { useJarvis } from "../../hooks/useJarvis";
import { assessModel, detectCapabilities, MODELS, recommendModel, type DeviceCapability, type ModelInfo } from "../../ai/localModel";

const LEVEL_TEXT = {
  likely: { tone: "ok" as const, text: "Should work on this device." },
  uncertain: { tone: "warn" as const, text: "Might work — JARVIS can't be sure." },
  insufficient: { tone: "error" as const, text: "Probably won't work on this device." },
  unsupported: { tone: "error" as const, text: "Not supported in this browser." },
};

export function LocalAIPanel({ detect = detectCapabilities }: { detect?: () => Promise<DeviceCapability> }) {
  const { prefs, updatePrefs, ai, aiStatus, online } = useJarvis();
  const [cap, setCap] = useState<DeviceCapability | null>(null);
  const [modelId, setModelId] = useState<string>(prefs.localAI.modelId);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    void detect().then((c) => {
      if (!alive) return;
      setCap(c);
      if (!prefs.localAI.modelId) {
        const rec = recommendModel(c);
        if (rec) setModelId(rec.model.id);
      }
    });
    return () => {
      alive = false;
    };
  }, [detect, prefs.localAI.modelId]);

  const model: ModelInfo | undefined = MODELS.find((m) => m.id === modelId) ?? MODELS[0];
  const suit = cap && model ? assessModel(cap, model) : null;
  const canTry = suit && (suit.level === "likely" || suit.level === "uncertain");
  const cachedBefore = prefs.localAI.consentedModelId === model?.id;

  const start = () => {
    if (!model) return;
    setConfirming(false);
    updatePrefs({ localAI: { enabled: true, modelId: model.id, consentedModelId: model.id } });
    void ai.load(model.id, true);
  };

  return (
    <Panel title="On-device AI (optional)" icon={<Bot size={16} />}>
      <p className="text-sm text-ink-dim">
        JARVIS's lessons, math engine and quizzes work without any AI. You can optionally run a small AI model <strong className="text-ink">on this device</strong> to re-explain answers in different words. No API key, nothing is sent to an AI company — but the model itself must be downloaded once.
      </p>

      {!cap ? (
        <p className="mt-3 text-sm">Checking this device…</p>
      ) : (
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-ink-dim">WebGPU</dt>
          <dd>{cap.webgpu ? (cap.adapter ? "available" : "present, no adapter") : "not available"}</dd>
          <dt className="text-ink-dim">shader-f16</dt>
          <dd>{cap.adapter ? (cap.shaderF16 ? "yes" : "no") : "—"}</dd>
          <dt className="text-ink-dim">Memory hint</dt>
          <dd>{cap.deviceMemoryGB !== null ? `≈ ${cap.deviceMemoryGB} GB (browser estimate)` : "not reported by this browser"}</dd>
          <dt className="text-ink-dim">Free storage</dt>
          <dd>{cap.storageFreeMB !== null ? `≈ ${cap.storageFreeMB.toLocaleString()} MB` : "unknown"}</dd>
        </dl>
      )}

      <label className="mt-4 block text-sm">
        <span className="mb-1 block font-semibold">Model</span>
        <select value={model?.id} onChange={(e) => (setModelId(e.target.value), setConfirming(false))} disabled={aiStatus.state === "loading"} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3">
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — about {m.downloadMB} MB
            </option>
          ))}
        </select>
      </label>
      {model && (
        <p className="mt-2 text-xs text-ink-dim">
          {model.baseModel} · {model.license} · download ≈ <strong className="text-ink">{model.downloadMB} MB</strong> · needs ≈ {Math.round(model.vramMB)} MB of graphics memory{model.needsShaderF16 ? " · needs shader-f16" : ""}
        </p>
      )}
      {suit && (
        <div className="mt-3">
          <Notice tone={LEVEL_TEXT[suit.level].tone}>
            <strong>{LEVEL_TEXT[suit.level].text}</strong>
            {suit.reasons.length > 0 && (
              <ul className="mt-1 list-[square] pl-5">
                {suit.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
          </Notice>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {aiStatus.state === "loading" && (
          <div role="status" aria-live="polite">
            <div className="h-4 w-full border-2 border-[#3a2f48] bg-void" aria-hidden>
              <div className="h-full bg-red transition-all" style={{ width: `${Math.round(aiStatus.progress * 100)}%` }} />
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {Math.round(aiStatus.progress * 100)}% — {aiStatus.text.slice(0, 140)}
            </p>
            <PixelButton className="mt-2 min-h-11" onClick={() => ai.cancel()}>
              <X size={14} /> Cancel
            </PixelButton>
          </div>
        )}
        {aiStatus.state === "ready" && (
          <Notice tone="ok">
            Local AI is ready ({MODELS.find((m) => m.id === aiStatus.modelId)?.label}). It adds a labelled “On-device AI says” explanation under answers.
          </Notice>
        )}
        {aiStatus.state === "error" && <Notice tone="error">{aiStatus.message}</Notice>}

        {aiStatus.state !== "loading" && aiStatus.state !== "ready" && !confirming && (
          <PixelButton variant="primary" className="min-h-12 w-full sm:w-auto" disabled={!canTry} onClick={() => (cachedBefore ? start() : setConfirming(true))}>
            {cachedBefore ? <Power size={14} /> : <Download size={14} />} {cachedBefore ? "Start local AI" : `Download & start (≈ ${model?.downloadMB} MB)`}
          </PixelButton>
        )}
        {confirming && model && (
          <div className="border-2 border-warn bg-void p-3 text-sm">
            <p>
              This downloads about <strong>{model.downloadMB} MB</strong> from huggingface.co and github.com and stores it in this browser. Use Wi-Fi if you can — it may use your mobile data plan.
              {!online && " You're offline right now, so the download will fail."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PixelButton variant="primary" className="min-h-12" onClick={start}>
                Yes, download {model.downloadMB} MB
              </PixelButton>
              <PixelButton className="min-h-12" onClick={() => setConfirming(false)}>
                Not now
              </PixelButton>
            </div>
          </div>
        )}
        {aiStatus.state === "ready" && (
          <PixelButton className="min-h-11" onClick={() => void ai.unload()}>
            <Cpu size={14} /> Unload model (free memory)
          </PixelButton>
        )}
        <Toggle
          checked={prefs.localAI.enabled}
          onChange={(v) => updatePrefs({ localAI: { ...prefs.localAI, enabled: v } })}
          label="Use on-device AI in chat"
          description="When off, JARVIS answers only from its built-in lessons and math engine."
        />
      </div>
    </Panel>
  );
}
