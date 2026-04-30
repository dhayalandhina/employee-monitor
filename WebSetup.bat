@echo off
:: ==========================================
:: EMPMONITOR 1-CLICK WEB INSTALLER
:: ==========================================

:: 1. AUTO-ELEVATE TO ADMINISTRATOR (Like PlayStore asking for permission)
net session >nul 2>&1
if %errorLevel% == 0 goto :admin
echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
"%temp%\getadmin.vbs"
del "%temp%\getadmin.vbs"
exit /B

:admin
color 0A
echo ==================================================
echo   EmpMonitor Agent Setup
echo ==================================================
echo.
set /p EMP_NAME="Enter Employee Name (Example: John): "
if "%EMP_NAME%"=="" set EMP_NAME=%USERNAME%
echo.
echo ==================================================
echo   Downloading and Installing EmpMonitor...
echo ==================================================

:: Hardcoded to your Mac Server IP
set SERVER_URL=http://192.168.1.186:3001
set TARGET_DIR=%USERPROFILE%\.empmonitor

:: 2. INSTALL NODE.JS (If missing)
echo [1/5] Checking System Requirements...
node -v >nul 2>&1
if %errorLevel% neq 0 (
    echo       Downloading Node.js (Please wait 1-2 minutes)...
    powershell -NoProfile -Command "Invoke-WebRequest 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%temp%\node.msi'"
    msiexec /i "%temp%\node.msi" /qn
    set "PATH=%PATH%;C:\Program Files\nodejs"
)

:: 3. DOWNLOAD DIRECTLY FROM GITHUB
echo [2/5] Downloading App from GitHub...
powershell -NoProfile -Command "Invoke-WebRequest 'https://github.com/dhayalandhina/employee-monitor/archive/refs/heads/main.zip' -OutFile '%temp%\empmonitor.zip'"

:: 4. EXTRACT AND SETUP 
echo [3/5] Extracting Files...
powershell -NoProfile -Command "Expand-Archive -Path '%temp%\empmonitor.zip' -DestinationPath '%temp%\emp_extract' -Force"

if not exist "%TARGET_DIR%" mkdir "%TARGET_DIR%"
xcopy /Y /E "%temp%\emp_extract\employee-monitor-main\agent\*" "%TARGET_DIR%\" >nul 2>&1

:: Clean up temp files
rmdir /S /Q "%temp%\emp_extract" >nul 2>&1
del "%temp%\empmonitor.zip" >nul 2>&1

:: 5. INSTALL DEPENDENCIES IN BACKGROUND
echo [4/5] Installing App Modules...
cd /d "%TARGET_DIR%"
call npm install >nul 2>&1

:: 6. CREATE BACKGROUND SERVICES (Silent Boot)
echo [5/5] Securing Background Service...
(
    echo @echo off
    echo cd /d "%TARGET_DIR%"
    echo :loop
    echo node agent.js "%SERVER_URL%" "%%EMP_NAME%%" "admin123"
    echo timeout /t 5 /nobreak ^>nul
    echo goto loop
) > "%TARGET_DIR%\start-agent.bat"

(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run """%TARGET_DIR%\start-agent.bat""", 0, False
) > "%TARGET_DIR%\launch.vbs"

:: Add to Windows Startup
schtasks /delete /tn "EmpMonitor Agent" /f >nul 2>&1
schtasks /create /tn "EmpMonitor Agent" /tr "wscript.exe \"%TARGET_DIR%\launch.vbs\"" /sc onlogon /rl highest /f >nul 2>&1
reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\Run" /v "EmpMonitorAgent" /t REG_SZ /d "wscript.exe \"%TARGET_DIR%\launch.vbs\"" /f >nul 2>&1

:: Start the Application right now
start "" wscript.exe "%TARGET_DIR%\launch.vbs"

echo ==================================================
echo   ✓ INSTALLATION SUCCESSFUL!
echo ==================================================
echo   The app is now running securely in the background.
timeout /t 5 >nul
del "%~s0"
