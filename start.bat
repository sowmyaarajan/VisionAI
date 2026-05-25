@echo off
setlocal
cd /d "%~dp0"

echo.
echo === VisionAI IXP — starting backend + frontend ===
echo.

start "VisionAI backend (uvicorn :8000)" cmd /k "cd /d ""%~dp0"" && python -m uvicorn backend.main:app --reload --port 8000"

start "VisionAI frontend (vite :5173)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo Waiting for servers to come up...
timeout /t 6 /nobreak >nul

start "" "http://localhost:5173"

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173  (opened in browser)
echo.
echo Close the two spawned terminal windows to stop the servers.
echo.
endlocal
