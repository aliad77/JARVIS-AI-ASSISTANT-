# Phase 1 audit: desktop JARVIS → mobile-first JARVIS (2026-10-30)

This audit was done on the existing code before the mobile upgrade.

## Findings

| Area | What existed | Problem for phones / new requirements | Action taken |
|---|---|---|---|
| Anthropic dependency | `backend/app/ai/provider.py` (Anthropic SDK), `ANTHROPIC_API_KEY` in `config.py`, `.env.example`, `requirements.txt`, tests, docs, Settings page | The owner no longer wants any hosted generative-AI API or keys | **Removed.** No hosted-AI SDK is installed or imported (enforced by tests). A `NoGenerativeAI` provider keeps the backend interface. |
| Math engine | Python + SymPy, run in a worker process | A phone browser can't run Python, and the website must not need a server | **Ported** the restricted parser and solver to TypeScript (`frontend/src/engine/math`). It uses exact BigInt fractions and has no `eval`. The SymPy backend is kept for desktop. |
| Chat, history, settings, quizzes | All went through FastAPI + SQLite on `127.0.0.1` | Not reachable from a phone; localhost on a Mac is not the phone's localhost | **Moved into the browser.** The brain, lessons, quizzes and storage (localStorage with limits) all run client-side. |
| Science answers | Came only from the Anthropic model | No curated content, so nothing worked without the API | **Added** a curated knowledge base: 24 topics in 5 subjects, each with sources (`engine/science`). |
| App launcher | Windows-only `subprocess` launcher | Phones can't run Windows programs | **Added** a Roblox launcher built on documented deep links. The Windows launcher is kept and reached through an optional "desktop bridge". |
| Voice | Web Speech API hooks (push-to-talk) | Already browser-only, good. Docs didn't explain the cloud processing on mobile. | **Kept.** Added a voice-mode quick action, number-word parsing ("x plus five") and an explanation of platform speech services. |
| Layout | Responsive grid with a top header nav | No bottom navigation; some touch targets under 44 px; no safe-area handling | **Added** a bottom nav, ≥ 44–56 px targets, `viewport-fit=cover` with safe-area padding, and a `100dvh` chat layout. |
| PWA | None | Can't be installed, no offline use | **Added** a manifest, icons, service worker and hosting headers. |
| Tests | 261 backend + 24 frontend tests, many tied to the Anthropic provider and backend API | Didn't cover the browser engine, mobile layout or local AI | Backend tests updated (248). Frontend suite rewritten (191). |

## Privacy and security risks found

1. **Data leaving the device.** Previously every chat message went to Anthropic. Now chat and lessons stay on the device. Network traffic only happens for:
   - the optional, consented model download
   - browser speech recognition (a platform service, see the Settings page)
   - Roblox links the user taps
2. **AI output as an attack surface.** This is still relevant with a local model. Model text is sanitised (links and markup removed) and rendered without HTML. It can never trigger actions: launches come only from the deterministic intent router and a user tap.
3. **URL schemes.** Roblox URLs are built from constants plus a validated numeric place ID, then checked against an allowlist before navigation.
4. **Static hosting has no server-side auth.** The phone build has no privileged endpoints at all. The Windows backend keeps its host, origin and token protections, and stays loopback-only.
5. **Storage.** localStorage can be read by any script on the same origin. The app ships no third-party scripts and uses a strict CSP. It stores no secrets.
