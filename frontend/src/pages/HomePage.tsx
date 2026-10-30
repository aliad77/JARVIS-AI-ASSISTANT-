import { motion } from "motion/react";
import { PixelAvatar, type AvatarState } from "../components/PixelAvatar";
import { QuickActions, type QuickAction } from "../components/QuickActions";
import { Notice, Panel } from "../components/ui";
import { Waveform } from "../components/Waveform";
import { useJarvis } from "../hooks/useJarvis";

export function HomePage({ avatarState, onQuickAction, voiceAvailable }: { avatarState: AvatarState; onQuickAction: (a: QuickAction) => void; voiceAvailable: boolean }) {
  const { prefs, store, online } = useJarvis();
  const progress = store.getProgress();
  const totals = progress.reduce((a, p) => ({ c: a.c + p.correct, n: a.n + p.attempted }), { c: 0, n: 0 });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-6">
      <Panel glow className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 text-center">
          <motion.div animate={avatarState === "idle" ? { y: [0, -4, 0] } : { y: 0 }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <PixelAvatar state={avatarState} size={176} />
          </motion.div>
          <Waveform active={avatarState === "listening" || avatarState === "speaking"} bars={16} />
          <h1 className="pixel-title neon text-[0.85rem] leading-relaxed text-ink sm:text-base">
            Hello, Player!
            <br />
            <span className="text-red">Ready for your next mission?</span>
          </h1>
          <p className="pixel-title text-[0.48rem] text-ink-dim">
            Grade {prefs.grade} · XP {totals.c * 10} · {totals.n ? `${Math.round((100 * totals.c) / totals.n)}% accuracy` : "no quizzes yet"}
          </p>
        </div>
      </Panel>
      <div className="space-y-4">
        {!online && <Notice tone="info">You're offline. Built-in lessons, math and quizzes still work.</Notice>}
        <QuickActions onAction={onQuickAction} voiceAvailable={voiceAvailable} />
      </div>
    </div>
  );
}
