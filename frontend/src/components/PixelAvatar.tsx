/** JARVIS's pixel-art face, drawn as an SVG grid (no external images). */
export type AvatarState = "idle" | "listening" | "thinking" | "speaking" | "error";

// 16x16 sprite. Legend: R frame red, D deep red, H highlight, P face plate,
// A antenna light, E eye, M mouth, S shine.
const SPRITE = [
  ".......AA.......",
  ".......DD.......",
  "...RRRRRRRRRR...",
  "..RHHHHHHHHHHR..",
  "..RPPPPPPPPPPR..",
  ".DRPEEPPPPEEPRD.",
  ".DRPEEPPPPEEPRD.",
  ".DRPPPPPPPPPPRD.",
  "..RPPMMMMMMPPR..",
  "..RPPPPPPPPPPR..",
  "..RRRRRRRRRRRR..",
  ".....DDDDDD.....",
  "...RRRRRRRRRR...",
  "..RRDDRSSRDDRR..",
  "..RRRRRRRRRRRR..",
  "................",
];

const COLORS: Record<string, string> = {
  R: "#FF4058",
  D: "#991B32",
  H: "#FF6979",
  P: "#1D1B28",
  A: "#FF6979",
  E: "#F5F5F7",
  M: "#FF4058",
  S: "#F5F5F7",
};

function cells(filter: (ch: string) => boolean) {
  const out: { x: number; y: number; ch: string }[] = [];
  SPRITE.forEach((row, y) => [...row].forEach((ch, x) => ch !== "." && filter(ch) && out.push({ x, y, ch })));
  return out;
}

const BODY = cells((c) => !"EAM".includes(c));
const EYES = cells((c) => c === "E");
const MOUTH = cells((c) => c === "M");
const ANTENNA = cells((c) => c === "A");

const LABELS: Record<AvatarState, string> = {
  idle: "JARVIS is ready",
  listening: "JARVIS is listening",
  thinking: "JARVIS is thinking",
  speaking: "JARVIS is speaking",
  error: "JARVIS hit a problem",
};

export function PixelAvatar({ state = "idle", size = 192 }: { state?: AvatarState; size?: number }) {
  const eyeColor = state === "error" ? "#FFC857" : state === "listening" ? "#FF6979" : COLORS.E;
  return (
    <div className="relative inline-block" style={{ width: size, height: size }}>
      <div
        aria-hidden
        className="absolute inset-[12%] rounded-full blur-2xl transition-opacity"
        style={{ background: "radial-gradient(circle, rgba(255,64,88,0.45), transparent 70%)", opacity: state === "idle" ? 0.5 : 0.9 }}
      />
      <svg
        role="img"
        aria-label={LABELS[state]}
        viewBox="0 0 16 16"
        width={size}
        height={size}
        className="pixelated relative"
      >
        {BODY.map(({ x, y, ch }) => (
          <rect key={`b${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={COLORS[ch]} />
        ))}
        <g className={state === "thinking" || state === "listening" ? "animate-pulse-red" : undefined}>
          {ANTENNA.map(({ x, y }) => (
            <rect key={`a${x}`} x={x} y={y} width={1.02} height={1.02} fill={state === "error" ? "#FFC857" : COLORS.A} />
          ))}
        </g>
        <g
          className={state === "idle" || state === "speaking" ? "animate-blink" : undefined}
          style={{ transformOrigin: "8px 6px", transformBox: "view-box" }}
        >
          {EYES.map(({ x, y }) => (
            <rect
              key={`e${x}-${y}`}
              x={state === "thinking" ? x + (y === 5 ? 0.5 : 0.5) : x}
              y={y}
              width={1.02}
              height={1.02}
              fill={eyeColor}
            />
          ))}
        </g>
        <g>
          {MOUTH.map(({ x, y }, i) => (
            <rect
              key={`m${x}`}
              x={x}
              y={y}
              width={1.02}
              height={1.02}
              fill={COLORS.M}
              className={state === "speaking" ? "wave-bar" : undefined}
              style={state === "speaking" ? { animationDelay: `${(i % 3) * 120}ms`, transformBox: "fill-box" } : undefined}
            />
          ))}
        </g>
      </svg>
    </div>
  );
}
