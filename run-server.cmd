@echo off
cd /d "%~dp0"
echo Open in browser: http://localhost:8000
echo Press Ctrl+C to stop.
where py >nul 2>&1
if %ERRORLEVEL%==0 (
  py -3 -m http.server 8000
  goto :eof
)
where python >nul 2>&1
if %ERRORLEVEL%==0 (
  python -m http.server 8000
  goto :eof
)
echo Python not found. Run instead: npm start
pause
