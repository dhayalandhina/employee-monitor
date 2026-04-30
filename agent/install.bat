@echo off
:: ============================================================
:: EmpMonitor Agent — Smart Windows Installer v2.1
:: ============================================================
:: Right-click this file and select "Run as administrator"
:: ============================================================

title EmpMonitor Agent Installer
color 0A
setlocal ENABLEDELAYEDEXPANSION

echo.
echo  =====================================================
echo       EmpMonitor Agent Installer v2.1.0
echo       Employee Monitoring System
echo  =====================================================
echo.

:: ─── CHECK ADMIN PRIVILEGES ────────────────────────────────
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  [ERROR] You must run this as Administrator!
    echo.
    echo  How to fix:
    echo  1. Right-click install.bat
    echo  2. Click "Run as administrator"
    echo.
    pause
    exit /b 1
)
echo  [OK] Running as Administrator

:: ─── CHECK IF NODE.JS IS INSTALLED ─────────────────────────
echo  [..] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [!!] Node.js not found. Downloading now...
    echo.
    :: Download Node.js LTS installer using PowerShell
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-setup.msi'"
    echo  [..] Installing Node.js silently...
    msiexec /i "%TEMP%\node-setup.msi" /qn
    :: Refresh PATH
    call refreshenv >nul 2>&1
    set "PATH=%PATH%;C:\Program Files\nodejs"
    node --version >nul 2>&1
    if !errorLevel! neq 0 (
        echo  [ERROR] Node.js installation failed.
        echo  Please install manually from https://nodejs.org
        pause
        exit /b 1
    )
)
echo  [OK] Node.js is installed

:: ─── GET CONFIGURATION ─────────────────────────────────────
echo.
echo  ─────────────────────────────────────────────────────
echo   Please enter the following details:
echo  ─────────────────────────────────────────────────────
echo.

:: Server URL
set /p SERVER_URL="  Server URL (e.g. http://203.0.113.50:3001): "
if "!SERVER_URL!"=="" (
    echo  [ERROR] Server URL cannot be empty.
    pause
    exit /b 1
)

:: Employee Name
set /p EMPLOYEE_NAME="  Employee Full Name (e.g. Rajesh Kumar): "
if "!EMPLOYEE_NAME!"=="" (
    echo  [ERROR] Employee name cannot be empty.
    pause
    exit /b 1
)

:: Admin Password
set /p ADMIN_PASSWORD="  Admin Password (staff cannot stop agent without this): "
if "!ADMIN_PASSWORD!"=="" (
    echo  [ERROR] Password cannot be empty.
    pause
    exit /b 1
)

echo.
echo  ─────────────────────────────────────────────────────
echo   Configuration:
echo    Server  : !SERVER_URL!
echo    Employee: !EMPLOYEE_NAME!
echo    Password: ****
echo  ─────────────────────────────────────────────────────
echo.

:: ─── CREATE INSTALL DIRECTORY ──────────────────────────────
set INSTALL_DIR=%USERPROFILE%\.empmonitor
echo  [1/6] Creating installation directory...
if not exist "!INSTALL_DIR!" mkdir "!INSTALL_DIR!"
echo  [OK] Directory: !INSTALL_DIR!

:: ─── COPY AGENT FILE ───────────────────────────────────────
echo  [2/6] Installing agent...
copy /Y "%~dp0agent.js" "!INSTALL_DIR!\agent.js" >nul 2>&1
if not exist "!INSTALL_DIR!\agent.js" (
    echo  [ERROR] Could not copy agent.js
    echo  Make sure agent.js is in the same folder as install.bat
    pause
    exit /b 1
)
echo  [OK] Agent copied

:: ─── WRITE STARTUP LAUNCHER ────────────────────────────────
echo  [3/6] Creating startup launcher...
(
    echo @echo off
    echo cd /d "!INSTALL_DIR!"
    echo :loop
    echo node agent.js "!SERVER_URL!" "!EMPLOYEE_NAME!" "!ADMIN_PASSWORD!"
    echo timeout /t 5 /nobreak ^>nul
    echo goto loop
) > "!INSTALL_DIR!\start-agent.bat"

:: Create a hidden VBScript launcher (so no black window on startup)
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run """!INSTALL_DIR!\start-agent.bat""", 0, False
) > "!INSTALL_DIR!\launch.vbs"

echo  [OK] Launcher created

:: ─── ADD TO WINDOWS STARTUP ────────────────────────────────
echo  [4/6] Setting up auto-start on Windows boot...

:: Method 1: Registry (all users)
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "EmpMonitorAgent" /t REG_SZ /d "wscript.exe \"!INSTALL_DIR!\launch.vbs\"" /f >nul 2>&1

:: Method 2: Task Scheduler (more reliable, runs even before login)
schtasks /delete /tn "EmpMonitor Agent" /f >nul 2>&1
schtasks /create /tn "EmpMonitor Agent" /tr "wscript.exe \"!INSTALL_DIR!\launch.vbs\"" /sc onlogon /rl highest /f >nul 2>&1

echo  [OK] Auto-start configured

:: ─── TEST SERVER CONNECTION ────────────────────────────────
echo  [5/6] Testing connection to server...
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri '!SERVER_URL!/api/dashboard/stats' -TimeoutSec 5 -UseBasicParsing; Write-Output 'OK' } catch { Write-Output 'FAIL' }" > "%TEMP%\conntest.txt" 2>&1
set /p CONN_RESULT=<"%TEMP%\conntest.txt"
if "!CONN_RESULT!"=="OK" (
    echo  [OK] Server connection successful!
) else (
    echo  [WARN] Could not reach server at !SERVER_URL!
    echo         The agent will keep retrying when internet is available.
)

:: ─── START THE AGENT NOW ───────────────────────────────────
echo  [6/6] Starting agent...
start "" wscript.exe "!INSTALL_DIR!\launch.vbs"
timeout /t 3 /nobreak >nul
echo  [OK] Agent started

:: ─── DONE ──────────────────────────────────────────────────
echo.
echo  =====================================================
echo   INSTALLATION COMPLETE!
echo  =====================================================
echo.
echo   The EmpMonitor agent is now:
echo    - Running in the background
echo    - Set to start automatically on Windows boot
echo    - Sending data to: !SERVER_URL!
echo    - Registered as: !EMPLOYEE_NAME!
echo.
echo   Check the admin dashboard to verify this PC appears.
echo.
echo   To UNINSTALL: Run uninstall.bat as Administrator
echo  =====================================================
echo.

:: Create uninstaller
(
    echo @echo off
    echo net session ^>nul 2^>^&1
    echo if %%errorLevel%% neq 0 ^(echo Run as Administrator ^& pause ^& exit /b 1^)
    echo set /p PASS="Enter Admin Password: "
    echo if NOT "%%PASS%%"=="!ADMIN_PASSWORD!" ^(echo Wrong password! ^& pause ^& exit /b 1^)
    echo taskkill /F /IM node.exe /FI "WINDOWTITLE eq EmpMonitor*" ^>nul 2^>^&1
    echo schtasks /delete /tn "EmpMonitor Agent" /f ^>nul 2^>^&1
    echo reg delete "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "EmpMonitorAgent" /f ^>nul 2^>^&1
    echo rmdir /S /Q "%USERPROFILE%\.empmonitor" ^>nul 2^>^&1
    echo echo Uninstalled successfully.
    echo pause
) > "!INSTALL_DIR!\uninstall.bat"

pause
