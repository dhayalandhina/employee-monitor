@echo off
:: ============================================================
:: EmpMonitor — One-Click Smart Installer
:: ============================================================
:: Staff just double-clicks this file. It does everything:
:: 1. Downloads agent automatically from server
:: 2. Shows a nice setup form (name, department)
:: 3. Installs Node.js if missing
:: 4. Configures everything
:: 5. Starts agent hidden in background
:: ============================================================

:: ===== ADMIN CONFIG — CHANGE THESE =====
set SERVER_URL=http://192.168.1.186:3001
set GITHUB_REPO=https://raw.githubusercontent.com/dhayalandhina/employee-monitor/main/agent
set ADMIN_PASSWORD=admin123
:: ========================================

title EmpMonitor Setup
color 0A

echo.
echo  =====================================================
echo       EmpMonitor — Employee Setup Wizard
echo  =====================================================
echo.

:: Show GUI Form using PowerShell
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing;" ^
  "$form = New-Object System.Windows.Forms.Form;" ^
  "$form.Text = 'EmpMonitor - Employee Setup';" ^
  "$form.Size = New-Object System.Drawing.Size(420,380);" ^
  "$form.StartPosition = 'CenterScreen';" ^
  "$form.FormBorderStyle = 'FixedDialog';" ^
  "$form.MaximizeBox = $false;" ^
  "$form.Font = New-Object System.Drawing.Font('Segoe UI',10);" ^
  "" ^
  "$logo = New-Object System.Windows.Forms.Label;" ^
  "$logo.Text = '🖥️ EmpMonitor Setup';" ^
  "$logo.Font = New-Object System.Drawing.Font('Segoe UI',16,'Bold');" ^
  "$logo.Location = New-Object System.Drawing.Point(20,15);" ^
  "$logo.Size = New-Object System.Drawing.Size(380,35);" ^
  "$form.Controls.Add($logo);" ^
  "" ^
  "$sub = New-Object System.Windows.Forms.Label;" ^
  "$sub.Text = 'Enter your details to set up workplace monitoring';" ^
  "$sub.ForeColor = [System.Drawing.Color]::Gray;" ^
  "$sub.Location = New-Object System.Drawing.Point(20,50);" ^
  "$sub.Size = New-Object System.Drawing.Size(380,20);" ^
  "$form.Controls.Add($sub);" ^
  "" ^
  "$lbl1 = New-Object System.Windows.Forms.Label; $lbl1.Text = 'Your Full Name *'; $lbl1.Location = New-Object System.Drawing.Point(20,90); $lbl1.Size = New-Object System.Drawing.Size(360,22); $form.Controls.Add($lbl1);" ^
  "$txt1 = New-Object System.Windows.Forms.TextBox; $txt1.Location = New-Object System.Drawing.Point(20,112); $txt1.Size = New-Object System.Drawing.Size(360,28); $form.Controls.Add($txt1);" ^
  "" ^
  "$lbl2 = New-Object System.Windows.Forms.Label; $lbl2.Text = 'Department'; $lbl2.Location = New-Object System.Drawing.Point(20,150); $lbl2.Size = New-Object System.Drawing.Size(360,22); $form.Controls.Add($lbl2);" ^
  "$cmb = New-Object System.Windows.Forms.ComboBox; $cmb.Location = New-Object System.Drawing.Point(20,172); $cmb.Size = New-Object System.Drawing.Size(360,28); $cmb.DropDownStyle = 'DropDownList';" ^
  "$cmb.Items.AddRange(@('Engineering','Design','Marketing','Sales','HR','Finance','Operations','Support','Management','Other'));" ^
  "$cmb.SelectedIndex = 0; $form.Controls.Add($cmb);" ^
  "" ^
  "$lbl3 = New-Object System.Windows.Forms.Label; $lbl3.Text = 'System Name (auto-detected)'; $lbl3.Location = New-Object System.Drawing.Point(20,210); $lbl3.Size = New-Object System.Drawing.Size(360,22); $form.Controls.Add($lbl3);" ^
  "$txt3 = New-Object System.Windows.Forms.TextBox; $txt3.Location = New-Object System.Drawing.Point(20,232); $txt3.Size = New-Object System.Drawing.Size(360,28); $txt3.Text = $env:COMPUTERNAME; $txt3.ReadOnly = $true; $txt3.BackColor = [System.Drawing.Color]::FromArgb(240,240,240); $form.Controls.Add($txt3);" ^
  "" ^
  "$btn = New-Object System.Windows.Forms.Button; $btn.Text = '✅ Install and Start Monitoring'; $btn.Location = New-Object System.Drawing.Point(20,280); $btn.Size = New-Object System.Drawing.Size(360,40);" ^
  "$btn.BackColor = [System.Drawing.Color]::FromArgb(76,175,80); $btn.ForeColor = [System.Drawing.Color]::White; $btn.FlatStyle = 'Flat'; $btn.Font = New-Object System.Drawing.Font('Segoe UI',11,'Bold');" ^
  "$btn.Add_Click({ if($txt1.Text.Trim() -eq '') { [System.Windows.Forms.MessageBox]::Show('Please enter your name','Error'); return }; $form.Tag = $txt1.Text.Trim() + '|' + $cmb.SelectedItem + '|' + $txt3.Text; $form.DialogResult = 'OK'; $form.Close() });" ^
  "$form.Controls.Add($btn);" ^
  "" ^
  "$form.AcceptButton = $btn;" ^
  "$result = $form.ShowDialog();" ^
  "if($result -eq 'OK' -and $form.Tag) { $form.Tag | Out-File -FilePath '%TEMP%\empmonitor_setup.txt' -Encoding UTF8 } else { 'CANCELLED' | Out-File -FilePath '%TEMP%\empmonitor_setup.txt' -Encoding UTF8 }"

:: Read the form result
set /p FORM_RESULT=<"%TEMP%\empmonitor_setup.txt"
del "%TEMP%\empmonitor_setup.txt" >nul 2>&1

if "%FORM_RESULT%"=="CANCELLED" (
    echo  Setup cancelled.
    pause
    exit /b 0
)

:: Parse the form data
for /f "tokens=1,2,3 delims=|" %%a in ("%FORM_RESULT%") do (
    set EMPLOYEE_NAME=%%a
    set DEPARTMENT=%%b
    set SYSTEM_NAME=%%c
)

echo.
echo  Employee: %EMPLOYEE_NAME%
echo  Department: %DEPARTMENT%
echo  System: %SYSTEM_NAME%
echo.

:: ─── CHECK NODE.JS ─────────────────────────────────────────
echo  [1/5] Checking Node.js...
node --version >nul 2>&1
if %errorLevel% neq 0 (
    echo  [..] Node.js not found. Installing...
    powershell -NoProfile -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-setup.msi'"
    echo  [..] Running Node.js installer...
    msiexec /i "%TEMP%\node-setup.msi" /qn
    set "PATH=%PATH%;C:\Program Files\nodejs"
    timeout /t 5 /nobreak >nul
)
echo  [OK] Node.js ready

:: ─── CREATE INSTALL DIRECTORY ──────────────────────────────
set INSTALL_DIR=%USERPROFILE%\EmpMonitor
echo  [2/5] Setting up...
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: ─── DOWNLOAD AGENT FROM GITHUB ────────────────────────────
echo  [3/5] Downloading agent...
powershell -NoProfile -Command "Invoke-WebRequest -Uri '%GITHUB_REPO%/agent.js' -OutFile '%INSTALL_DIR%\agent.js'"
if not exist "%INSTALL_DIR%\agent.js" (
    echo  [..] GitHub download failed, trying local copy...
    copy /Y "%~dp0agent.js" "%INSTALL_DIR%\agent.js" >nul 2>&1
)
if not exist "%INSTALL_DIR%\agent.js" (
    echo  [ERROR] Could not download agent. Check internet connection.
    pause
    exit /b 1
)
echo  [OK] Agent downloaded

:: ─── DELETE OLD CONFIG ─────────────────────────────────────
del "%USERPROFILE%\.empmonitor\config.json" >nul 2>&1

:: ─── CREATE HIDDEN LAUNCHER ────────────────────────────────
echo  [4/5] Configuring auto-start...

(
echo @echo off
echo :loop
echo node "%INSTALL_DIR%\agent.js" "%SERVER_URL%" "%EMPLOYEE_NAME%" "%ADMIN_PASSWORD%"
echo timeout /t 10 /nobreak ^>nul
echo goto loop
) > "%INSTALL_DIR%\start.bat"

(
echo Set WshShell = CreateObject("WScript.Shell"^)
echo WshShell.Run """%INSTALL_DIR%\start.bat""", 0, False
) > "%INSTALL_DIR%\hidden-start.vbs"

:: Add to Startup folder
set STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup
copy /Y "%INSTALL_DIR%\hidden-start.vbs" "%STARTUP_DIR%\EmpMonitor.vbs" >nul 2>&1

:: Task Scheduler backup
schtasks /delete /tn "EmpMonitor" /f >nul 2>&1
schtasks /create /tn "EmpMonitor" /tr "wscript.exe \"%INSTALL_DIR%\hidden-start.vbs\"" /sc onlogon /rl highest /f >nul 2>&1

echo  [OK] Auto-start configured

:: ─── START AGENT NOW ───────────────────────────────────────
echo  [5/5] Starting monitoring...
start "" wscript.exe "%INSTALL_DIR%\hidden-start.vbs"
timeout /t 3 /nobreak >nul
echo  [OK] Agent running in background

:: ─── SHOW SUCCESS MESSAGE ──────────────────────────────────
powershell -NoProfile -Command ^
  "Add-Type -AssemblyName System.Windows.Forms;" ^
  "[System.Windows.Forms.MessageBox]::Show('Setup Complete!' + [char]10 + [char]10 + 'Employee: %EMPLOYEE_NAME%' + [char]10 + 'Department: %DEPARTMENT%' + [char]10 + 'System: %SYSTEM_NAME%' + [char]10 + [char]10 + 'The monitoring agent is now running in the background.' + [char]10 + 'It will start automatically when Windows boots.' + [char]10 + [char]10 + 'You can close this window.', 'EmpMonitor - Setup Complete', 'OK', 'Information')"

echo.
echo  =====================================================
echo   SETUP COMPLETE!
echo  =====================================================
echo.
echo   %EMPLOYEE_NAME% (%DEPARTMENT%) is now being monitored.
echo   System: %SYSTEM_NAME%
echo   Server: %SERVER_URL%
echo.
echo   Agent runs hidden. Auto-starts on boot.
echo  =====================================================
echo.
pause
