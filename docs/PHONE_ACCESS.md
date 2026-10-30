# Using JARVIS on a phone (future HTTPS hosting)

> **Nothing has been built, deployed or published yet.** This page explains what to do later.

## Why `localhost` on the Mac won't work for the phone

`http://localhost:5173` means "this same device". On the phone, it points at the phone itself, not the Mac. A LAN address such as `http://192.168.x.x:5173` would load, but:

- it is plain HTTP, and phones only enable the microphone, service workers (offline use / installing), WebGPU (local AI) and reliable PWA installation on **HTTPS** pages
- it only works while the Mac is on and on the same Wi-Fi

The phone version of JARVIS needs **no server-side code at all**. It is a static website (HTML, JS, CSS and icons) that runs entirely in the browser. So the right setup is **static HTTPS hosting**.

## Recommended setup

1. **Build later.** `cd frontend && npm ci && npm run build` produces `frontend/dist/`. Not run yet, per instructions.
2. **Host `frontend/dist/` on any static HTTPS host.** Good free options:
   - **Cloudflare Pages** or **Netlify.** Both read `public/_headers` (copied into `dist/`), which sets the Content-Security-Policy and other security headers.
   - **GitHub Pages.** Works, but ignores `_headers`. Security headers would then need a proxy such as Cloudflare in front, or a `<meta http-equiv="Content-Security-Policy">` tag added to `index.html` at build time.
3. Use a single-page-app fallback so every path serves `index.html`. With Netlify, add a `_redirects` file containing `/*  /index.html  200`; Cloudflare Pages does this by default for SPAs.
4. **On the phone,** open the HTTPS address, then:
   - **iPhone/iPad (Safari):** Share → **Add to Home Screen**
   - **Android (Chrome):** ⋮ → **Install app** / **Add to Home screen**
5. Open it once while online so the service worker can cache the app. After that, lessons, math and quizzes work offline.

## What stays on the phone

- Settings, chat history, quiz scores and saved Roblox games are stored in the browser's localStorage on the phone. JARVIS caps this at about 3 MB and prunes the oldest chats.
- Deleting the home-screen app or clearing site data erases them. There is no account and no cloud sync.
- If the on-device AI model is downloaded, it lives in the browser's Cache Storage (about 214–296 MB). Clearing site data removes it.

## The Windows desktop backend is separate

The FastAPI backend (`backend/`) is only needed on a Windows PC, to open Calculator, Notepad, Paint, Chrome, Edge or the Roblox desktop app. It still binds only to `127.0.0.1` and must **never** be exposed to the internet or LAN. The hosted phone site does not talk to it. When the site is opened from the PC's own backend, it detects the backend automatically.

## Before relying on it

Test on the actual phones you plan to use (see `docs/TESTING.md`):

- Add to Home Screen
- offline launch
- microphone permission
- spoken replies
- Roblox installed and not installed
- local AI on a supported device and on an unsupported one
