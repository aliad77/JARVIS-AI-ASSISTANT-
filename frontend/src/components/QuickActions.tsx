import { BookOpen, Calculator, FlaskConical, Gamepad2, Mic, Trophy } from "lucide-react";
import { motion } from "motion/react";

export type QuickAction = "roblox" | "study" | "math" | "science" | "voice" | "quizzes";

const ACTIONS: { id: QuickAction; label: string; hint: string; Icon: typeof Gamepad2 }[] = [
  { id: "roblox", label: "Open Roblox", hint: "Launch the game", Icon: Gamepad2 },
  { id: "study", label: "Study Mode", hint: "Explain any topic", Icon: BookOpen },
  { id: "math", label: "Math Helper", hint: "Solve & verify", Icon: Calculator },
  { id: "science", label: "Science Lab", hint: "Bio · Chem · Physics", Icon: FlaskConical },
  { id: "voice", label: "Voice Mode", hint: "Push to talk", Icon: Mic },
  { id: "quizzes", label: "My Quizzes", hint: "Test your skills", Icon: Trophy },
];

export function QuickActions({
  onAction,
  busy,
  voiceAvailable,
}: {
  onAction: (a: QuickAction) => void;
  busy?: QuickAction | null;
  voiceAvailable: boolean;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Quick actions">
      {ACTIONS.map(({ id, label, hint, Icon }, i) => {
        const disabled = (id === "voice" && !voiceAvailable) || busy === id;
        return (
          <motion.li key={id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <motion.button
              type="button"
              whileHover={disabled ? undefined : { y: -3 }}
              whileTap={disabled ? undefined : { y: 1 }}
              onClick={() => onAction(id)}
              disabled={disabled}
              title={id === "voice" && !voiceAvailable ? "Voice input isn't available in this browser or is turned off" : hint}
              className="group flex h-full w-full cursor-pointer flex-col items-start gap-3 border-2 border-[#3a2f48] bg-panel p-3 text-left shadow-[4px_4px_0_0_#0B0B10] transition-colors hover:border-red hover:bg-panel-hi hover:shadow-[4px_4px_0_0_#991B32,0_0_20px_-6px_rgba(255,64,88,0.8)] disabled:cursor-not-allowed disabled:opacity-50 sm:p-4"
            >
              <span className="grid h-10 w-10 place-items-center bg-red-deep text-ink transition-colors group-hover:bg-red group-hover:text-void">
                <Icon size={20} aria-hidden />
              </span>
              <span>
                <span className="pixel-title block text-[0.58rem] text-ink group-hover:text-red-hi">{busy === id ? "Working…" : label}</span>
                <span className="mt-1 block text-xs text-ink-dim">{hint}</span>
              </span>
            </motion.button>
          </motion.li>
        );
      })}
    </ul>
  );
}
