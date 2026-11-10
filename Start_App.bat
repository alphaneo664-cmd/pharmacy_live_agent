@echo off
setlocal

rem Start the hidden launcher and close this temporary batch window.
cd /d "%~dp0"
wscript.exe "%~dp0startup.vbs"

exit /b 0