@echo off
cd /d "%~dp0"
echo Starting local server...
echo.
echo Do not close this window while playing.
echo To stop server - just close this window.
echo.
start "" http://localhost:8000
python -m http.server 8000