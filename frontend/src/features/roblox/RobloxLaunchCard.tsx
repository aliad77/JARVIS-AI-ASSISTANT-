import { ExternalLink, Gamepad2, Monitor } from "lucide-react";
import { useState } from "react";
import { Notice, PixelButton } from "../../components/ui";
import { useJarvis } from "../../hooks/useJarvis";
import { launchWindowsApp } from "../../platform/desktop";
import { buildLaunchPlan, openRobloxUrl, type HandoffOutcome } from "../../platform/roblox";

/**
 * Every launch happens inside the button's click handler (a real user gesture).
 * The result message only reports what JARVIS could observe — whether the page
 * was left — never that Roblox definitely opened.
 */
export function RobloxLaunchCard({ placeId, placeName, compact = false }: { placeId?: string; placeName?: string; compact?: boolean }) {
  const { platform, bridge } = useJarvis();
  const plan = buildLaunchPlan(platform, placeId);
  const [outcome, setOutcome] = useState<HandoffOutcome | "error" | null>(null);
  const [pcMessage, setPcMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const go = (url: string, target: "same" | "new") => {
    setOutcome(null);
    openRobloxUrl(url, target).then(setOutcome, () => setOutcome("error"));
  };

  return (
    <div className={`border-2 border-red bg-void/70 ${compact ? "p-3" : "p-4"} space-y-3`}>
      <p className="pixel-title flex items-center gap-2 text-[0.55rem] text-red-hi">
        <Gamepad2 size={14} aria-hidden /> {placeName ? `Roblox · ${placeName}` : "Roblox launcher"}
      </p>
      <PixelButton variant="primary" className="w-full py-4 text-[0.7rem]" onClick={() => go(plan.primary, plan.primaryTarget)}>
        <Gamepad2 size={18} aria-hidden /> {plan.primaryLabel}
      </PixelButton>
      {bridge.canLaunchWindowsApps && !placeId && (
        <PixelButton
          className="w-full"
          onClick={() => {
            setPcMessage(null);
            void launchWindowsApp("roblox").then((r) => setPcMessage({ ok: r.ok, text: r.message }));
          }}
        >
          <Monitor size={14} aria-hidden /> Open the Roblox app on this PC
        </PixelButton>
      )}
      {pcMessage && <Notice tone={pcMessage.ok ? "ok" : "warn"}>{pcMessage.text}</Notice>}
      {outcome === "left-page" && (
        <Notice tone="ok">Your device switched away from JARVIS, so Roblox (or the store) probably opened. If it didn't, try an option below.</Notice>
      )}
      {outcome === "stayed" && <Notice tone="warn">It looks like nothing opened. Roblox might not be installed, or your browser blocked it. Try one of these:</Notice>}
      {outcome === "error" && <Notice tone="error">That link was blocked because it isn't an approved Roblox link.</Notice>}
      <div className="flex flex-wrap gap-2">
        {plan.fallbacks.map((f) => (
          <PixelButton key={f.url} className="px-3 py-2 text-[0.5rem]" onClick={() => go(f.url, f.url.startsWith("roblox://") ? "same" : "new")}>
            <ExternalLink size={12} aria-hidden /> {f.label}
          </PixelButton>
        ))}
      </div>
      {!compact && (
        <ul className="list-[square] space-y-1 pl-5 text-xs text-ink-dim marker:text-red">
          {plan.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
