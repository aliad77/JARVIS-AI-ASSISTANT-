# JARVIS — Windows setup guide

This guide is for a parent or student setting JARVIS up on a Windows 10/11 PC.
You only do steps 1–4 once.

> The start scripts never install software or change system settings. Every install below is a step you do yourself.

## 1. Install the tools (one time)

1. **Python 3.11 or newer**: download it from <https://www.python.org/downloads/windows/>.
   In the installer, tick **"Add python.exe to PATH"**.
2. **Node.js LTS (20.19 or newer)**: download it from <https://nodejs.org/>. You only need it for the website part.
3. Optional: **Google Chrome** or **Microsoft Edge**. You need one of them for voice input.

Check them in a new **Command Prompt**:

```bat
py --version
node --version
```

## 2. Install JARVIS's libraries (one time)

Open Command Prompt in the `jarvis` folder (the one that holds `start-jarvis.bat`):

```bat
cd backend
py -3 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
cd ..\frontend
npm ci
cd ..
```

## 3. No API key needed

JARVIS doesn't use any online AI service. The PC backend answers math with SymPy and opens approved apps. Science lessons, quizzes and the optional on-device AI live in the web app.

## 4. Start JARVIS

Double-click **`start-jarvis-dev.bat`**. Two windows open (the backend and the website), and then your browser opens
<http://localhost:5173>. Keep both windows open while you use JARVIS. Close them to stop it.

PowerShell alternative: `powershell -ExecutionPolicy Bypass -File .\start-jarvis.ps1 -Dev`

> **Later (optional):** after someone runs the production build (`cd frontend` then `npm run build`), `start-jarvis.bat` serves
> everything from <http://127.0.0.1:8765> with one window. This build step has not been run yet.

## 5. Set up Roblox

JARVIS looks for Roblox here automatically:

- `%LOCALAPPDATA%\Roblox\Versions\version-…\RobloxPlayerBeta.exe` (the normal install from roblox.com)
- the Microsoft Store version of Roblox

If **Open Roblox** says it couldn't find it:

1. Press **Win + R**, type `%LOCALAPPDATA%\Roblox\Versions`, and press Enter.
2. Open the newest `version-…` folder that contains `RobloxPlayerBeta.exe`.
3. Shift + right-click the file, choose **Copy as path**, and paste it into **Settings → Roblox setup → Save path**.

Only a file named `RobloxPlayerBeta.exe` or `RobloxPlayerLauncher.exe` is accepted.

## 6. Ask a question

On the **Base** screen, type *"Solve 3x + 7 = 22"* or *"Explain photosynthesis"* and press Enter.
Pick your grade under **Settings → School grade** so the explanations match your level.

## 7. Use voice mode

1. Use Chrome or Edge. Firefox doesn't support speech recognition.
2. Click the **microphone** button (or **VOICE MODE**). The browser asks for microphone permission the first time; click **Allow**.
3. Speak your question. JARVIS stops listening after you finish and sends it.
4. Answers to voice questions are read aloud unless spoken answers are muted (speaker button, or Settings → Voice).

The microphone only turns on when you click it. In Chrome and Edge, speech is turned into text by the browser maker's online service.

## Troubleshooting

| Problem | Fix |
|---|---|
| "Can't reach the JARVIS local service" | Make sure the backend window is open and shows `Uvicorn running on http://127.0.0.1:8765`. |
| Mic button greyed out | Voice is off in Settings, or the browser doesn't support it (use Chrome or Edge). |
| Microphone blocked | Click the padlock icon in the address bar → Microphone → Allow, then reload. |
| Port already in use | Another program uses 8765 or 5173. Close it, or change `JARVIS_PORT` in `.env`. |
