import { AppWindow, Database, Gamepad2, GraduationCap, History, Mic, MonitorCog, ShieldCheck, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Notice, Panel, PixelButton, Toggle } from "../components/ui";
import { LocalAIPanel } from "../features/localai/LocalAIPanel";
import { useJarvis } from "../hooks/useJarvis";
import { WINDOWS_APPS, launchWindowsApp } from "../platform/desktop";
import type { Grade } from "../platform/storage";

function ConfirmButton({ label, confirmLabel, onConfirm }: { label: string; confirmLabel: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return armed ? (
    <PixelButton variant="danger" className="min-h-11" onClick={() => (onConfirm(), setArmed(false))}>
      {confirmLabel}
    </PixelButton>
  ) : (
    <PixelButton className="min-h-11" onClick={() => setArmed(true)}>
      {label}
    </PixelButton>
  );
}

const LANGS: Record<string, string> = { "en-US": "English (US)", "en-GB": "English (UK)", "en-AU": "English (Australia)", "en-CA": "English (Canada)", "en-IN": "English (India)" };

export function SettingsPage({ voices, ttsSupported, sttSupported, onNavigate }: { voices: SpeechSynthesisVoice[]; ttsSupported: boolean; sttSupported: boolean; onNavigate: (p: "roblox" | "history") => void }) {
  const { prefs, updatePrefs, store, bridge, platform } = useJarvis();
  const [notice, setNotice] = useState<string | null>(null);
  const [pc, setPc] = useState<string | null>(null);
  const langVoices = voices.filter((v) => v.lang.replace("_", "-").startsWith(prefs.voiceLang.slice(0, 2)));
  const usageKB = Math.round(store.usage() / 1024);
  const standalone = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <PixelButton className="min-h-14" onClick={() => onNavigate("roblox")}>
          <Gamepad2 size={16} /> Roblox
        </PixelButton>
        <PixelButton className="min-h-14" onClick={() => onNavigate("history")}>
          <History size={16} /> History
        </PixelButton>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="School grade" icon={<GraduationCap size={16} />}>
          <div role="radiogroup" aria-label="School grade" className="grid grid-cols-6 gap-2">
            {([7, 8, 9, 10, 11, 12] as Grade[]).map((g) => (
              <button
                key={g}
                type="button"
                role="radio"
                aria-checked={prefs.grade === g}
                onClick={() => updatePrefs({ grade: g })}
                className={`pixel-title min-h-12 cursor-pointer border-2 text-xs ${prefs.grade === g ? "border-red bg-red text-void" : "border-[#3a2f48] bg-void hover:border-red"}`}
              >
                {g}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-dim">Grades 7–9 get simpler explanations; grades 10–12 get more advanced ones.</p>
        </Panel>

        <LocalAIPanel />

        <Panel title="Voice" icon={<Mic size={16} />}>
          {!sttSupported && <Notice tone="warn">This browser doesn't offer speech recognition. You can still type, and spoken replies may still work.</Notice>}
          <Toggle checked={prefs.voiceEnabled} onChange={(v) => updatePrefs({ voiceEnabled: v })} label="Voice input (push-to-talk)" description="The microphone turns on only while you tap the mic button. JARVIS never listens in the background." />
          <Toggle checked={!prefs.muteResponses} onChange={(v) => updatePrefs({ muteResponses: !v })} label="Spoken replies" description={ttsSupported ? "JARVIS reads answers aloud after you ask by voice." : "Not supported in this browser."} />
          <label className="block py-2 text-sm">
            <span className="mb-1 flex justify-between font-semibold">
              Voice speed <span className="text-red-hi">{prefs.voiceRate.toFixed(1)}×</span>
            </span>
            <input type="range" min={0.5} max={2} step={0.1} value={prefs.voiceRate} onChange={(e) => updatePrefs({ voiceRate: Number(e.target.value) })} className="h-8 w-full accent-[#FF4058]" aria-label="Voice speed" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Language</span>
              <select value={prefs.voiceLang} onChange={(e) => updatePrefs({ voiceLang: e.target.value })} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3">
                {Object.entries(LANGS).map(([id, n]) => (
                  <option key={id} value={id}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-semibold">Voice</span>
              <select value={prefs.voiceName} onChange={(e) => updatePrefs({ voiceName: e.target.value })} className="min-h-12 w-full border-2 border-[#3a2f48] bg-void px-3" disabled={!ttsSupported}>
                <option value="">Default</option>
                {langVoices.map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name}
                    {v.localService ? "" : " (online)"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="mt-3 text-xs text-ink-dim">
            Speech recognition is provided by your browser. In Chrome (including on Android) it usually sends audio to Google's speech service; on iPhone and iPad, Safari uses Apple's speech recognition, which may also run online. Speech is not processed by JARVIS itself.
          </p>
        </Panel>

        <Panel title="Display & sound" icon={<MonitorCog size={16} />}>
          <Toggle checked={prefs.reducedMotion} onChange={(v) => updatePrefs({ reducedMotion: v })} label="Reduced motion" description="Turns off animations." />
          <Toggle checked={prefs.soundEffects} onChange={(v) => updatePrefs({ soundEffects: v })} label="Sound effects" description="Retro blips when messages send and arrive." />
        </Panel>

        <Panel title="Your data (this device only)" icon={<Database size={16} />}>
          <Toggle checked={prefs.saveHistory} onChange={(v) => updatePrefs({ saveHistory: v })} label="Save chat history" description="Stored only in this browser. Turn off to keep nothing after you close the page." />
          <p className="my-2 text-xs text-ink-dim">Using about {usageKB} KB of this browser's storage (limit set by JARVIS: about 3 MB).</p>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton label="Delete all chats" confirmLabel="Tap again to delete" onConfirm={() => setNotice(`Deleted ${store.clearConversations()} conversation(s).`)} />
            <ConfirmButton
              label="Reset quiz progress"
              confirmLabel="Tap again to reset"
              onConfirm={() => {
                store.clearLearningData();
                setNotice("Quiz scores and progress reset.");
              }}
            />
          </div>
        </Panel>

        <Panel title="Install on your phone" icon={<Smartphone size={16} />}>
          {standalone ? (
            <Notice tone="ok">JARVIS is running as an installed app.</Notice>
          ) : (
            <ul className="list-[square] space-y-1 pl-5 text-sm marker:text-red">
              {platform === "ios" && <li>iPhone/iPad (Safari): tap the Share button, then “Add to Home Screen”.</li>}
              {platform === "android" && <li>Android (Chrome): open the ⋮ menu, then “Add to Home screen” or “Install app”.</li>}
              {platform !== "ios" && platform !== "android" && <li>On a phone, open JARVIS's HTTPS address and use “Add to Home Screen”.</li>}
              <li>Installing needs JARVIS to be hosted on an HTTPS website (see docs/PHONE_ACCESS.md).</li>
            </ul>
          )}
        </Panel>

        {bridge.canLaunchWindowsApps && (
          <Panel title="Windows apps (this PC)" icon={<AppWindow size={16} />}>
            <p className="mb-2 text-xs text-ink-dim">Connected to the JARVIS desktop service. Only these approved apps can be opened.</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(WINDOWS_APPS).map(([id, name]) => (
                <PixelButton key={id} className="min-h-11" onClick={() => void launchWindowsApp(id).then((r) => setPc(r.message))}>
                  {name}
                </PixelButton>
              ))}
            </div>
            {pc && (
              <div className="mt-2">
                <Notice>{pc}</Notice>
              </div>
            )}
          </Panel>
        )}

        <Panel title="Safety" icon={<ShieldCheck size={16} />}>
          <ul className="list-[square] space-y-1 pl-5 text-sm text-ink-dim marker:text-red">
            <li>No AI company or API key is used. Lessons and math run on this device.</li>
            <li>The optional on-device AI runs locally after a one-time download you approve.</li>
            <li>JARVIS only opens Roblox links built from Roblox's official formats — never links written by an AI.</li>
            <li>The microphone turns on only when you tap it.</li>
            <li>Chats and scores stay in this browser.</li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
