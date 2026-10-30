# Testing

Automated tests use simulated devices. They never download a model, open a real app, call a paid API, or run a build.

## Frontend (Vitest + Testing Library, jsdom)

```bash
cd frontend
npm run typecheck
npm test
```

| File | Covers |
|---|---|
| `math.test.ts` | Exact arithmetic, fractions, surds, trig values, linear/quadratic/cubic/rational equations, substitution checks, extraneous roots, no-solution cases, approximate vs verified, unsupported classes, answer checking. Code-injection inputs rejected; `eval`/`Function` never called; resource limits. Natural-language and voice phrasing ("x plus five equals ten"), plus percent, statistics, geometry and function word problems. |
| `learning.test.ts` | Science knowledge base integrity and provenance, topic retrieval, grade levels, science quizzes, practice answer keys verified by the engine, multiple-choice validity, quiz scoring. The assistant's routing of the four voice examples, app allowlist, grade change, crisis reply, honest fallback. |
| `localModel.test.ts` | WebGPU and device detection on simulated desktop / Android / iPhone (with and without WebGPU), suitability, consent requirement, progress, "ready only after init", cancel, out-of-memory fallback, error classification, output sanitising. |
| `platform.test.ts` | Roblox place-ID and link validation, platform detection (incl. iPadOS), deep-link plans, URL allowlist, handoff outcome detection, desktop-bridge detection, PWA manifest, service-worker rules, CSP headers, no hosted-AI SDKs in `package.json`. |
| `storage.test.ts` | Persistence across a restart, validation of corrupted data, conversation and message caps, quota pruning that never deletes the active chat, history-off mode, deletion. |
| `components.test.tsx` | Mobile bottom navigation (5 targets, `min-h-14`, safe-area), page navigation, dashboard, grade persistence, chat with the engine, **local-model failure fallback**, labelled AI explanation, no automatic model loading, Roblox needs a tap. |
| `voice.test.tsx` | Speech recognition feature detection, push-to-talk (not continuous), permission denied. |
| `MathText.test.tsx` | Safe Markdown + KaTeX rendering, no HTML injection, no links, no KaTeX `\href`. |

## Backend (pytest)

```bash
cd backend
.venv/bin/python -m pytest        # Windows: .venv\Scripts\python.exe -m pytest
```

Covers the SymPy engine, Windows launcher (mocked), intent routing, API, security guard and SQLite. It also checks that no hosted-AI SDK is imported.

## Manual tests still required on real devices

| Check | iPhone (Safari) | Android (Chrome) | Windows PC |
|---|---|---|---|
| Layout and bottom nav on a small screen, rotation, safe areas | ☐ | ☐ | — |
| Add to Home Screen, launch offline after first visit | ☐ | ☐ | ☐ |
| Mic permission prompt, allow and deny, push-to-talk | ☐ | ☐ | ☐ |
| Spoken replies, voice speed, voice choice | ☐ | ☐ | ☐ |
| “Open Roblox” with Roblox installed / not installed | ☐ | ☐ | ☐ |
| Saved game launch via deep link (app installed / not installed) | ☐ | ☐ | ☐ |
| Local AI: capability report, consent, download progress, ready, answer, unload | ☐ | ☐ | ☐ |
| Local AI on a device without WebGPU shows "not supported" | ☐ | ☐ | — |
| Windows apps via the desktop backend | — | — | ☐ |
