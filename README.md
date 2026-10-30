# JARVIS — mobile-first study & gaming assistant

A red-and-black pixel-gaming assistant for a grade 7–12 student, built to run **in a phone's browser** with **no AI API and no API keys**.

- **Verified math.** On-device engine: arithmetic, fractions, percentages, equations, algebra, geometry, functions, trig, statistics. Shows steps and substitution checks, says honestly what it can't do, and offers practice problems.
- **Science lab.** 24 curated grade 7–12 topics (biology, chemistry, physics, earth science, general science) with definitions, worked examples, concept checks, practice questions and source references.
- **Quizzes and practice.** Progress is saved on the device.
- **Roblox launcher.** Uses Roblox's documented deep links, with favourite games by place ID and website / app-store fallbacks.
- **Voice.** Push-to-talk input and spoken replies, where the browser supports them.
- **Optional on-device AI.** WebLLM + WebGPU, only after the user approves the download size. It rephrases checked answers and is never the source of facts.
- **PWA.** Installable, works offline after the first visit.
- **Optional Windows backend** (`backend/`) for launching approved PC apps. It no longer uses any hosted AI.

## Quick start (development)

```bash
cd frontend
npm ci
npm run dev        # http://localhost:5173 (desktop browser)
npm test           # 191 tests
```

To use it on a phone, see **[docs/PHONE_ACCESS.md](docs/PHONE_ACCESS.md)**. It needs static HTTPS hosting; nothing has been deployed.
For Windows desktop app launching, see **[docs/WINDOWS_SETUP.md](docs/WINDOWS_SETUP.md)**.

## Docs

- [Audit of the previous version](docs/AUDIT.md)
- [Architecture & supported math](docs/ARCHITECTURE.md)
- [On-device AI](docs/LOCAL_AI.md)
- [Science content & provenance](docs/SCIENCE_CONTENT.md)
- [Security, safety & privacy](docs/SECURITY.md)
- [Testing & device checklist](docs/TESTING.md)
