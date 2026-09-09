@echo off
title PFMS National Fund Allocation System Launcher
echo ======================================================================
echo    STARTING PFMS BLOCKCHAIN FUND ALLOCATION AND TRACKING SYSTEM
echo ======================================================================
echo.

REM 1. Start Backend FastAPI Server
echo [1/2] Starting Python FastAPI Backend on http://localhost:5000...
start "PFMS Backend Server" cmd /k "cd /d %~dp0backend && if exist venv\Scripts\activate (call venv\Scripts\activate) && python app.py"

REM 2. Start Frontend Vite Server
echo [2/2] Starting React Vite Frontend on http://localhost:5173...
start "PFMS Frontend Portal" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ======================================================================
echo  System is booting up!
echo  - Frontend Portal: http://localhost:5173
echo  - Backend API:     http://localhost:5000/api/health
echo  - API Docs:        http://localhost:5000/docs
echo ======================================================================
pause
