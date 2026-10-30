@echo off
REM ============================================================
REM  JARVIS - development mode: backend + Vite dev server
REM  Opens two windows. Does NOT install anything.
REM ============================================================
setlocal
cd /d "%~dp0"

if not exist "backend\.venv\Scripts\python.exe" (
  echo  [JARVIS] backend\.venv not found. See docs\WINDOWS_SETUP.md
  pause
  exit /b 1
)
if not exist "frontend\node_modules" (
  echo  [JARVIS] frontend\node_modules not found. See docs\WINDOWS_SETUP.md
  pause
  exit /b 1
)

start "JARVIS backend" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m app"
start "JARVIS website" cmd /k "cd /d "%~dp0frontend" && npm run dev"
echo  [JARVIS] Waiting for the servers to start...
timeout /t 6 /nobreak >nul
start "" "http://localhost:5173"
endlocal
