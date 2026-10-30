# Architecture

```
Phone / tablet / desktop browser  (static PWA, HTTPS)
├── UI (React + Tailwind + Motion, pixel theme, bottom nav on phones)
├── Brain  engine/brain.ts  — deterministic, offline ("System B")
│   ├── intent router  engine/intent.ts   (launch / quiz / settings / math / science / chat)
│   ├── math engine    engine/math/*      (restricted parser → exact rationals/surds → verify → steps)
│   ├── science KB     engine/science/*   (24 curated topics + sources)
│   └── practice/quiz  engine/learn/*
├── On-device AI  ai/localModel.ts  — optional WebLLM + WebGPU ("System A"), rephrases checked answers
├── Platform
│   ├── storage.ts   localStorage with validation and limits
│   ├── roblox.ts    documented deep links, allowlist, handoff detection
│   ├── desktop.ts   optional bridge to the Windows backend (same origin only)
│   └── pwa.ts + public/sw.js, manifest.webmanifest, _headers
└── Voice  hooks/useSpeechRecognition.ts, useSpeechSynthesis.ts (Web Speech API, push-to-talk)

Optional: Windows PC
└── FastAPI on 127.0.0.1 (backend/) — SymPy math, SQLite, allowlisted Windows app launcher.
    No generative AI. It can also serve a future frontend build.
```

## Answer pipeline

1. **Safety screen.** Crisis messages get a fixed, caring reply.
2. **Intent routing.** Deterministic, using the user's words only.
3. **Trusted answer:**
   - math: browser math engine (with a "verified", "approximate", "unsupported" etc. status)
   - science: the curated lesson for the student's grade level, with sources
   - otherwise: an honest "here's what I can do"
4. **Optional rephrase.** If local AI is enabled and ready, it gets the trusted answer as a REFERENCE and writes a friendlier version. This is shown separately and labelled. If it fails, nothing changes.
5. **Actions.** Roblox, quizzes, practice and PC apps appear as buttons the user must tap.

## Browser math engine: supported classes

| Category | Exact | Notes |
|---|---|---|
| Arithmetic, negatives, powers, factorials | ✔ | BigInt fractions, no rounding |
| Fractions and decimals | ✔ | 0.1 + 0.2 = 3/10 |
| Percentages | ✔ | percent of, part-of-whole, increase/decrease |
| Linear equations | ✔ | step-by-step explanation |
| Quadratic equations | ✔ | factoring or quadratic formula; surd answers (e.g. √2) checked numerically to 9 digits |
| Rational equations, cubic+ with rational roots | ✔ | extraneous roots rejected using recorded domain restrictions |
| Algebra (expand/combine, one variable) | ✔ | verified at sample points |
| Geometry formulas | ✔ | areas, perimeters, circumference, volumes, Pythagoras; π kept exact |
| Functions | ✔ | evaluate f(a) for polynomial/fraction functions; slope of a line |
| Trigonometry | ✔ / ≈ | exact at 0/30/45/60/90° multiples; other angles labelled **approximate** |
| Statistics | ✔ | mean, median, mode, range |
| Logs, exp | ≈ | exact only for powers of 10; otherwise approximate |
| **Not supported** | — | unknown inside roots/logs/trig/abs, several unknowns, inequalities, cubic+ without rational roots, calculus, proofs |

Each solution is substituted back into the **original** equation. Only results that pass are marked verified.

## Dependencies (versions used in testing)

Frontend: React 19.3.1, Vite 8.3.5, Tailwind CSS 4.3.3, KaTeX 0.19.1, Motion 14.9.0, lucide-react 1.65.0, TypeScript 7.0.2, Vitest 5.0.5, @mlc-ai/web-llm 0.2.87 (lazy-loaded), @fontsource fonts (bundled).

Backend: FastAPI 0.162.0, Uvicorn 0.54.0, Pydantic 2.14.2, pydantic-settings 2.16.2, SymPy 1.14.0. **The anthropic SDK has been removed.**
