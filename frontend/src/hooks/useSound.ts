/** Tiny 8-bit sound effects synthesised with Web Audio (no audio files). */
import { useCallback, useRef } from "react";

type Sfx = "send" | "receive" | "error" | "success" | "click";

const PATTERNS: Record<Sfx, [number, number][]> = {
  // [frequency Hz, duration ms]
  send: [[660, 50], [880, 60]],
  receive: [[523, 50], [784, 70]],
  error: [[220, 90], [165, 120]],
  success: [[523, 60], [659, 60], [784, 60], [1047, 110]],
  click: [[1200, 25]],
};

export function useSound(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  return useCallback(
    (name: Sfx) => {
      if (!enabled || typeof window === "undefined") return;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      try {
        ctxRef.current ??= new Ctx();
        const ctx = ctxRef.current;
        let t = ctx.currentTime;
        for (const [freq, ms] of PATTERNS[name]) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.04, t);
          gain.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + ms / 1000);
          t += ms / 1000;
        }
      } catch {
        /* audio is optional */
      }
    },
    [enabled],
  );
}
