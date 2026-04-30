@echo off
:: ============================================================
:: EmpMonitor Agent — ONE-CLICK AUTO INSTALLER
:: ============================================================
title EmpMonitor Agent Auto-Installer
color 0A
setlocal ENABLEDELAYEDEXPANSION

:: ─── CHECK ADMIN PRIVILEGES ────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERROR] You must run this as Administrator!
    echo  Right-click auto-install.bat and select "Run as administrator"
    pause
    exit /b 1
)

:: ─── AUTO CONFIGURATION ────────────────────────────────────
:: Hardcoded to point to your Mac's IP automatically
set SERVER_URL=http://192.168.1.186:3001
:: Automatically uses the Windows Staff account name
set EMPLOYEE_NAME=%USERNAME%
:: Default admin password
set ADMIN_PASSWORD=admin123

echo  [1/6] Installing EmpMonitor for %EMPLOYEE_NAME%...
echo  Server: %SERVER_URL%

:: ─── CHECK IF NODE.JS IS INSTALLED ─────────────────────────
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [2/6] Node.js not found. Downloading silently (this may take 2 mins)...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-setup.msi'"
    msiexec /i "%TEMP%\node-setup.msi" /qn
    call refreshenv >nul 2>&1
    set "PATH=%PATH%;C:\Program Files\nodejs"
)

:: ─── CREATE INSTALL DIRECTORY ──────────────────────────────
set INSTALL_DIR=%USERPROFILE%\.empmonitor
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"

:: ─── COPY AGENT FILE ───────────────────────────────────────
echo  [3/6] Setting up agent...
copy /Y "%~dp0agent.js" "!INSTALL_DIR!\agent.js" >nul 2>&1

:: ─── WRITE STARTUP LAUNCHER ────────────────────────────────
echo  [4/6] Creating background launcher...
(
    echo @echo off
    echo cd /d "!INSTALL_DIR!"
    echo :loop
    echo node agent.js "!SERVER_URL!" "!EMPLOYEE_NAME!" "!ADMIN_PASSWORD!"
    echo timeout /t 5 /nobreak ^>nul
    echo goto loop
) > "!INSTALL_DIR!\start-agent.bat"

(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run """!INSTALL_DIR!\start-agent.bat""", 0, False
) > "!INSTALL_DIR!\launch.vbs"

:: ─── ADD TO WINDOWS STARTUP ────────────────────────────────
echo  [5/6] Ensuring startup on boot...
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "EmpMonitorAgent" /t REG_SZ /d "wscript.exe \"!INSTALL_DIR!\launch.vbs\"" /f >nul 2>&1
schtasks /delete /tn "EmpMonitor Agent" /f >nul 2>&1
schtasks /create /tn "EmpMonitor Agent" /tr "wscript.exe \"!INSTALL_DIR!\launch.vbs\"" /sc onlogon /rl highest /f >nul 2>&1

:: ─── START THE AGENT NOW ───────────────────────────────────
echo  [6/6] Starting agent...
start "" wscript.exe "!INSTALL_DIR!\launch.vbs"
timeout /t 3 /nobreak >nul

echo.
echo  =====================================================
echo   SUCCESS! Agent is now running hidden in background.
echo  =====================================================
echo   You can close this window.
timeout /t 5
