import { BookOpen, Gamepad2, History, House, MessageSquare, Settings, Trophy } from "lucide-react";
import { useJarvis } from "../hooks/useJarvis";
import { StatusPill } from "./ui";

export type Page = "home" | "chat" | "learn" | "quiz" | "roblox" | "history" | "settings";

export const NAV: { id: Page; label: string; Icon: typeof House; mobile: boolean }[] = [
  { id: "home", label: "Base", Icon: House, mobile: true },
  { id: "chat", label: "Chat", Icon: MessageSquare, mobile: true },
  { id: "learn", label: "Learn", Icon: BookOpen, mobile: true },
  { id: "quiz", label: "Quizzes", Icon: Trophy, mobile: true },
  { id: "roblox", label: "Roblox", Icon: Gamepad2, mobile: false },
  { id: "history", label: "History", Icon: History, mobile: false },
  { id: "settings", label: "More", Icon: Settings, mobile: true },
];

export function SystemStatus() {
  const { online, aiStatus, prefs } = useJarvis();
  const ai =
    aiStatus.state === "ready"
      ? { ok: true as boolean | null, label: "Local AI ready" }
      : aiStatus.state === "loading"
        ? { ok: null, label: `AI loading ${Math.round(aiStatus.progress * 100)}%` }
        : { ok: false, label: prefs.localAI.enabled ? "Local AI off" : "Lessons mode" };
  return (
    <div className="relative flex max-w-full gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="System status">
      <StatusPill ok={true} label="System online" pulse />
      <StatusPill ok={true} label="Math engine" detail="Runs on this device" />
      <StatusPill ok={ai.ok} label={ai.label} detail="On-device AI is optional; lessons and math work without it" />
      <StatusPill ok={online} label={online ? "Network" : "Offline"} detail={online ? "Connected" : "No connection — built-in lessons still work"} />
    </div>
  );
}

export function Header({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <header className="sticky top-0 z-30 border-b-4 border-red-deep bg-void/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 md:py-3">
        <button type="button" onClick={() => onNavigate("home")} className="flex min-h-11 cursor-pointer items-center gap-3" aria-label="JARVIS home">
          <span aria-hidden className="grid h-9 w-9 place-items-center bg-red shadow-[0_0_16px_-2px_rgba(255,64,88,0.9)]">
            <span className="block h-3 w-5 bg-void shadow-[inset_4px_0_0_#F5F5F7,inset_-4px_0_0_#F5F5F7]" />
          </span>
          <span className="pixel-title neon text-base text-red sm:text-lg">JARVIS</span>
        </button>
        <nav aria-label="Main" className="ml-auto hidden gap-1 md:flex">
          {NAV.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={page === id ? "page" : undefined}
              className={`pixel-title flex min-h-11 cursor-pointer items-center gap-2 border-2 px-2.5 text-[0.5rem] transition-colors ${page === id ? "border-red bg-red text-void" : "border-transparent text-ink-dim hover:border-[#3a2f48] hover:text-ink"}`}
            >
              <Icon size={14} aria-hidden />
              {id === "settings" ? "Settings" : label}
            </button>
          ))}
        </nav>
        <div className="w-full min-w-0">
          <SystemStatus />
        </div>
      </div>
    </header>
  );
}

/** Thumb-friendly bottom navigation for phones (hidden on wider screens). */
export function BottomNav({ page, onNavigate }: { page: Page; onNavigate: (p: Page) => void }) {
  return (
    <nav aria-label="Main" data-testid="bottom-nav" className="fixed inset-x-0 bottom-0 z-30 border-t-4 border-red-deep bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {NAV.filter((n) => n.mobile).map(({ id, label, Icon }) => {
          const active = page === id || (id === "settings" && (page === "history" || page === "roblox"));
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onNavigate(id)}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-1 ${active ? "text-red" : "text-ink-dim"}`}
              >
                <span className={`grid h-7 w-10 place-items-center ${active ? "bg-red text-void shadow-[0_0_12px_-2px_rgba(255,64,88,0.9)]" : ""}`}>
                  <Icon size={18} aria-hidden />
                </span>
                <span className="pixel-title text-[0.42rem]">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
