@echo off
title Nostalgia Server
cd /d "%~dp0"
echo.
echo  ========================================
echo   Nostalgia — local server
echo   Site:  http://localhost:8000
echo   Admin: http://localhost:8000/admin
echo  ========================================
echo.
echo  Keep this window OPEN while you browse the site.
echo  Press Ctrl+C to stop the server.
echo.
where node >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo Node.js not found. Install from https://nodejs.org then run: npm start
  pause
  exit /b 1
)
call npm start
if %ERRORLEVEL% neq 0 pause
