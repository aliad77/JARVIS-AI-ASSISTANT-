# Security, safety and privacy

## Data flows

| Data | Where it goes |
|---|---|
| Chat messages, answers, quiz scores, settings, saved Roblox games | Stay in the browser on the device (localStorage, capped at ~3 MB). No server, no account. |
| On-device AI | The model is downloaded once (only after the user approves the shown size) from huggingface.co / raw.githubusercontent.com. All inference is local; prompts never leave the device. |
| Voice input | Handled by the browser's speech recognition. In Chrome (desktop and Android) this normally sends audio to Google's speech service. On iOS, Safari uses Apple's speech recognition, which may run online. JARVIS never receives or stores audio. |
| Spoken replies | Browser speech synthesis. Some voices are marked "online" in Settings. |
| Roblox | Opening a Roblox link sends the user to roblox.com / ro.blox.com / the app store, as any link would. |
| Hosted generative AI | **None.** No Anthropic, OpenAI, Gemini or other hosted LLM, and no API keys anywhere (enforced by tests in both suites). |

## Controls in the phone/web app

- **No privileged actions from text.** Launch, quiz and settings actions come only from the deterministic intent router working on the **user's own words**. Each needs a tap on a button. Model output can't trigger anything.
- **Roblox links:**
  - built from constants plus a numeric place ID validated by `parsePlaceId`
  - every URL checked against an allowlist (`isAllowedRobloxUrl`) right before navigation
  - user-pasted links are only accepted from `https://(www.)roblox.com/games/<id>`
- **Rendering.** Messages are rendered as React text plus a small Markdown subset. Links are never made clickable. KaTeX runs with `trust: false` and size limits. Local-AI text has URLs and markup stripped.
- **Math input:**
  - a hand-written whitelist parser; no `eval`, `Function` or expression library
  - limits: 200 characters, 120 tokens, depth 25, 400 AST nodes, |exponent| ≤ 100, n! ≤ 150, results ≤ 8000 bits
- **Content Security Policy** (`public/_headers`):
  - `script-src 'self' 'wasm-unsafe-eval'` (WebAssembly only, no JS eval)
  - `connect-src` limited to self plus the model hosts
  - `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'none'`
  - plus HSTS, nosniff, `Referrer-Policy: no-referrer`, and a Permissions-Policy that only allows the microphone, and only for this site
- **Service worker.** Caches only same-origin static files. It never caches `/api/` or cross-origin requests. Old caches are deleted and the asset cache is size-capped.
- **Storage.** Stored data is validated on read (corrupted data falls back to defaults). No secrets are stored. Chat history can be turned off or deleted.
- **Microphone.** Push-to-talk only: `continuous = false`, started from a tap. There is no wake word or background listening.
- **Child safety.** A local screen answers self-harm messages with a caring fixed reply that points to trusted adults and helplines. Shared emails or phone numbers get a privacy tip. The local model's prompt requires age-appropriate, grounded answers.

## Controls in the Windows desktop backend (unchanged)

- Binds to loopback only.
- Host allowlist (DNS-rebinding defence) and origin / Fetch-Metadata checks.
- Per-start session token, JSON-only bodies and a size cap.
- Allowlisted app launcher with `shell=False`.
- SymPy runs in a separate process with a timeout.
- The CSP now also allows WebAssembly and the model hosts, so on-device AI works when the frontend is served by the backend.

## Known limitations

- The safety screen is keyword-based and English-only. The small local model can still say wrong or odd things. It is labelled and never treated as authoritative.
- localStorage is readable by any script on the same origin. That's why no third-party scripts are loaded and the CSP is strict. Anyone holding the unlocked phone can read the history.
- Browser speech recognition may be cloud-based. JARVIS can't make it offline.
- The Roblox deep-link formats are documented but marked **deprecated** by Roblox, so they could stop working.
- The science content has not been reviewed by a teacher (see `SCIENCE_CONTENT.md`).
