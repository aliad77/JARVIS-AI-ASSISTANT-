# JARVIS - start the local assistant (PowerShell).
# Does NOT install software or change system settings.
# If PowerShell blocks scripts, run it once with:
#   powershell -ExecutionPolicy Bypass -File .\start-jarvis.ps1
param([switch]$Dev)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root "backend\.venv\Scripts\python.exe"

if (-not (Test-Path $python)) {
    Write-Host "[JARVIS] backend\.venv not found. Follow docs\WINDOWS_SETUP.md first." -ForegroundColor Red
    exit 1
}

if ($Dev) {
    if (-not (Test-Path (Join-Path $root "frontend\node_modules"))) {
        Write-Host "[JARVIS] frontend\node_modules not found. See docs\WINDOWS_SETUP.md" -ForegroundColor Red
        exit 1
    }
    Start-Process -FilePath $python -ArgumentList "-m", "app" -WorkingDirectory (Join-Path $root "backend")
    Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory (Join-Path $root "frontend")
    Start-Sleep -Seconds 6
    Start-Process "http://localhost:5173"
} else {
    Write-Host "[JARVIS] Starting at http://127.0.0.1:8765 (Ctrl+C to stop)" -ForegroundColor Red
    Start-Process "http://127.0.0.1:8765"
    Push-Location (Join-Path $root "backend")
    try { & $python -m app } finally { Pop-Location }
}
