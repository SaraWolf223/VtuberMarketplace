@echo off
REM Run as Administrator: right-click -> Run as administrator
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0enable-windows-long-paths.ps1"
pause
