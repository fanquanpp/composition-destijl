@echo off
REM Serve the game and open it in the default browser.
cd /d "%~dp0"
start "" http://127.0.0.1:8080/
node tools/serve.mjs
