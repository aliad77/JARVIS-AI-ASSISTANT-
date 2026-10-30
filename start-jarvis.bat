@echo off
REM ============================================================
REM  JARVIS - start the local assistant (Windows)
REM  This script does NOT install anything or change settings.
REM  First-time setup: see docs\WINDOWS_SETUP.md
REM ============================================================
setlocal
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
  echo.
  echo  [JARVIS] Python environment not found in backend\.venv
  echo  [JARVIS] Follow the setup steps in docs\WINDOWS_SETUP.md first.
  echo.
  pause
  exit /b 1
)

if not exist "..\frontend\dist\index.html" (
  echo  [JARVIS] Note: the web interface has not been built yet.
  echo  [JARVIS] Use start-jarvis-dev.bat for the development version of the website.
)

echo  [JARVIS] Starting at http://127.0.0.1:8765  (press Ctrl+C to stop)
start "" "http://127.0.0.1:8765"
".venv\Scripts\python.exe" -m app
endlocal
