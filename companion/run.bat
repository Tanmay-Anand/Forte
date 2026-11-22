@echo off
rem Starts Forte Companion. Needs Node.js 22.18 or newer, and Claude Code signed in.
cd /d "%~dp0"
start "" http://127.0.0.1:4174
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --disable-warning=ExperimentalWarning server.mjs
