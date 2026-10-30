/** Animated pixel voice waveform. Static and dim when inactive. */
export function Waveform({ active, bars = 18, label }: { active: boolean; bars?: number; label?: string }) {
  return (
    <div className="flex h-10 items-center justify-center gap-[3px]" role="img" aria-label={label ?? (active ? "Voice active" : "Voice idle")}>
      {Array.from({ length: bars }, (_, i) => {
        const base = 0.25 + 0.75 * Math.abs(Math.sin((i + 1) * 1.7));
        return (
          <span
            key={i}
            className={`block w-[5px] ${active ? "wave-bar bg-red" : "bg-red-deep/60"}`}
            style={{
              height: `${Math.round(base * 100)}%`,
              animationDelay: active ? `${(i * 73) % 600}ms` : undefined,
              animationDuration: active ? `${700 + ((i * 131) % 500)}ms` : undefined,
              transform: active ? undefined : "scaleY(0.3)",
            }}
          />
        );
      })}
    </div>
  );
}
