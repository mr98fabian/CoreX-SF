@echo off
echo ==========================================
echo   KOREX FINANCIAL SYSTEM - DEV LAUNCHER
echo ==========================================
echo.
echo [1/2] Starting Backend Service (FastAPI)...
start "KoreX Backend" /D "backend" python -m uvicorn main:app --reload --port 8000
echo Backend launching in new window...
echo.
echo [2/2] Starting Frontend Interface (Vite)...
cd frontend
npm run dev
