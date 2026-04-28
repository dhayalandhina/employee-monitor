// ============================================================
// EmpMonitor Windows Agent — Standalone (pkg-compatible)
// ============================================================
// This is a lightweight Node.js agent that runs on Windows PCs.
// It uses PowerShell for native Windows features (no native npm deps).
// Package with: npx pkg agent.js -t node18-win-x64 -o EmpMonitor.exe
// ============================================================

import { exec, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import http from 'http';

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG_DIR = path.join(os.homedir(), '.empmonitor');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const QUEUE_FILE = path.join(CONFIG_DIR, 'queue.json');
const SCREENSHOT_DIR = path.join(CONFIG_DIR, 'screenshots');
const LOG_FILE = path.join(CONFIG_DIR, 'agent.log');

if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// Default config
let config = {
  serverUrl: process.argv[2] || 'http://localhost:3001',
  deviceId: null,
  employeeName: process.argv[3] || os.hostname(),
  agentPassword: process.argv[4] || 'admin@123',
  trackingInterval: 5,      // seconds
  screenshotInterval: 300,   // 5 minutes
  uploadInterval: 30,        // 30 seconds
  idleThreshold: 120,        // 2 minutes
};

// Load saved config
if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = { ...config, ...saved };
  } catch (e) { /* use defaults */ }
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
    // Keep log file under 5MB
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 5 * 1024 * 1024) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      fs.writeFileSync(LOG_FILE, content.slice(content.length / 2));
    }
  } catch (e) { /* ignore */ }
}

// ============================================================
// HTTP CLIENT (no dependencies needed)
// ============================================================
function httpRequest(url, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Upload file via multipart form (for screenshots)
function uploadFile(url, filepath, fields = {}) {
  return new Promise((resolve, reject) => {
    const boundary = `----FormBoundary${Date.now()}`;
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    const filename = path.basename(filepath);
    const fileData = fs.readFileSync(filepath);

    let body = '';
    for (const [key, val] of Object.entries(fields)) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`;
    }
    const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="screenshot"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`;
    const fileFooter = `\r\n--${boundary}--\r\n`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(body + fileHeader),
      fileData,
      Buffer.from(fileFooter)
    ]);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': bodyBuffer.length,
      },
    };

    const req = client.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ============================================================
// OFFLINE QUEUE
// ============================================================
let eventQueue = [];
let screenshotQueue = [];

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      eventQueue = data.events || [];
      screenshotQueue = data.screenshots || [];
    }
  } catch (e) { /* ignore */ }
}

function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ events: eventQueue, screenshots: screenshotQueue }));
  } catch (e) { /* ignore */ }
}

// ============================================================
// DEVICE REGISTRATION
// ============================================================
async function registerDevice() {
  if (config.deviceId) {
    log(`Device already registered: ${config.deviceId}`);
    return;
  }

  try {
    const res = await httpRequest(`${config.serverUrl}/api/devices/register`, 'POST', {
      hostname: os.hostname(),
      os: `Windows ${os.release()}`,
      employeeName: config.employeeName,
      agentVersion: '2.1.0',
      agentPassword: config.agentPassword,
    });

    if (res.status === 201) {
      config.deviceId = res.data.deviceId;
      saveConfig();
      log(`✅ Registered as ${config.deviceId}`);
    } else {
      log(`❌ Registration failed: ${JSON.stringify(res.data)}`);
    }
  } catch (err) {
    log(`❌ Registration error: ${err.message}`);
  }
}

// ============================================================
// ACTIVE WINDOW TRACKING (PowerShell)
// ============================================================
let currentApp = null;
let currentTitle = null;
let sessionStart = null;

function getActiveWindow() {
  return new Promise((resolve) => {
    // PowerShell command to get the active window title and process name
    const cmd = `powershell -NoProfile -Command "
      Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win32 {
  [DllImport(\\"user32.dll\\")]
  public static extern IntPtr GetForegroundWindow();
  [DllImport(\\"user32.dll\\")]
  public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport(\\"user32.dll\\", SetLastError=true)]
  public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
}
'@
      $hwnd = [Win32]::GetForegroundWindow()
      $sb = New-Object System.Text.StringBuilder 256
      [Win32]::GetWindowText($hwnd, $sb, 256) | Out-Null
      $title = $sb.ToString()
      $pid = 0
      [Win32]::GetWindowThreadProcessId($hwnd, [ref]$pid) | Out-Null
      $proc = Get-Process -Id $pid -ErrorAction SilentlyContinue
      Write-Output \\"$($proc.ProcessName)|$title\\"
    "`;

    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(null); return; }
      const [processName, ...titleParts] = stdout.trim().split('|');
      resolve({
        appName: processName || 'Unknown',
        windowTitle: titleParts.join('|') || 'Unknown',
      });
    });
  });
}

function categorizeApp(appName) {
  const name = (appName || '').toLowerCase();
  const productive = ['code', 'devenv', 'idea', 'pycharm', 'webstorm', 'cmd', 'powershell', 'windowsterminal', 'slack', 'teams', 'outlook', 'excel', 'winword', 'powerpnt', 'figma', 'postman', 'notion'];
  const unproductive = ['spotify', 'whatsapp', 'telegram', 'discord', 'steam', 'vlc'];
  if (productive.some(p => name.includes(p))) return 'productive';
  if (unproductive.some(u => name.includes(u))) return 'unproductive';
  if (name === 'idle') return 'idle';
  return 'neutral';
}

async function trackWindow() {
  const win = await getActiveWindow();
  if (!win) return;

  if (win.appName === currentApp && win.windowTitle === currentTitle) return;

  // Save previous session
  if (currentApp && sessionStart) {
    const duration = Math.floor((Date.now() - sessionStart) / 1000);
    if (duration >= 3) {
      eventQueue.push({
        deviceId: config.deviceId,
        appName: currentApp,
        windowTitle: currentTitle,
        category: categorizeApp(currentApp),
        duration,
        timestamp: new Date(sessionStart).toISOString(),
        endTime: new Date().toISOString(),
        icon: '📱',
      });
    }
  }

  currentApp = win.appName;
  currentTitle = win.windowTitle;
  sessionStart = Date.now();
}

// ============================================================
// SCREENSHOT CAPTURE (PowerShell)
// ============================================================
function captureScreenshot() {
  return new Promise((resolve) => {
    const filename = `ss_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOT_DIR, filename);

    const cmd = `powershell -NoProfile -Command "
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      $graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
      $bitmap.Save('${filepath.replace(/\\/g, '\\\\')}', [System.Drawing.Imaging.ImageFormat]::Png)
      $graphics.Dispose()
      $bitmap.Dispose()
    "`;

    exec(cmd, { timeout: 15000 }, (err) => {
      if (err) { log(`Screenshot error: ${err.message}`); resolve(null); return; }
      if (fs.existsSync(filepath)) {
        screenshotQueue.push({
          filepath,
          appName: currentApp || 'Unknown',
          windowTitle: currentTitle || '',
        });
        log(`📸 Screenshot captured: ${filename}`);
        resolve(filepath);
      } else {
        resolve(null);
      }
    });
  });
}

// ============================================================
// IDLE DETECTION (PowerShell)
// ============================================================
let isIdle = false;

function checkIdle() {
  return new Promise((resolve) => {
    const cmd = `powershell -NoProfile -Command "
      Add-Type @'
using System;
using System.Runtime.InteropServices;
public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }
public class IdleTime {
  [DllImport(\\"user32.dll\\")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO plii);
  public static uint Get() {
    LASTINPUTINFO lii = new LASTINPUTINFO();
    lii.cbSize = (uint)Marshal.SizeOf(typeof(LASTINPUTINFO));
    GetLastInputInfo(ref lii);
    return ((uint)Environment.TickCount - lii.dwTime) / 1000;
  }
}
'@
      Write-Output ([IdleTime]::Get())
    "`;

    exec(cmd, { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(0); return; }
      resolve(parseInt(stdout.trim()) || 0);
    });
  });
}

// ============================================================
// DATA UPLOAD
// ============================================================
async function uploadData() {
  if (!config.deviceId) return;

  // Check if device is still active
  try {
    const statusRes = await httpRequest(`${config.serverUrl}/api/devices/${config.deviceId}/status`);
    if (statusRes.data && statusRes.data.active === false) {
      log('⛔ Device has been removed by admin. Stopping agent.');
      process.exit(0);
    }
  } catch (e) { /* server unreachable, continue queuing */ }

  // Upload activity events
  if (eventQueue.length > 0) {
    const batch = eventQueue.splice(0, 50);
    try {
      await httpRequest(`${config.serverUrl}/api/activity`, 'POST', {
        deviceId: config.deviceId,
        events: batch,
      });
      log(`📤 Uploaded ${batch.length} events`);
    } catch (err) {
      eventQueue.unshift(...batch); // re-queue on failure
      log(`⚠️ Upload failed, ${eventQueue.length} events queued`);
    }
  }

  // Upload screenshots
  if (screenshotQueue.length > 0) {
    const ss = screenshotQueue.shift();
    try {
      if (fs.existsSync(ss.filepath)) {
        await uploadFile(`${config.serverUrl}/api/screenshots`, ss.filepath, {
          deviceId: config.deviceId,
          appName: ss.appName || '',
          windowTitle: ss.windowTitle || '',
        });
        log(`📤 Uploaded screenshot`);
        // Clean up local file
        try { fs.unlinkSync(ss.filepath); } catch (e) { /* ignore */ }
      }
    } catch (err) {
      screenshotQueue.unshift(ss);
      log(`⚠️ Screenshot upload failed`);
    }
  }

  // Heartbeat
  try {
    await httpRequest(`${config.serverUrl}/api/devices/${config.deviceId}/heartbeat`, 'POST', {});
  } catch (e) { /* ignore */ }

  saveQueue();
}

// ============================================================
// PASSWORD-PROTECTED SHUTDOWN
// ============================================================
// Prevent Ctrl+C without password
process.on('SIGINT', () => {
  console.log('\n⚠️ Enter admin password to stop agent (or wait 10s to cancel):');
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  const timeout = setTimeout(() => {
    console.log('❌ Shutdown cancelled.');
    process.stdin.pause();
  }, 10000);

  process.stdin.once('data', (input) => {
    clearTimeout(timeout);
    if (input.trim() === config.agentPassword) {
      console.log('✅ Password correct. Shutting down...');
      saveQueue();
      process.exit(0);
    } else {
      console.log('❌ Wrong password. Agent continues running.');
      process.stdin.pause();
    }
  });
});

// Prevent window close
process.on('SIGHUP', () => { log('SIGHUP received — ignoring'); });

// ============================================================
// MAIN LOOP
// ============================================================
async function main() {
  log('🚀 EmpMonitor Agent starting...');
  log(`📡 Server: ${config.serverUrl}`);
  log(`👤 Employee: ${config.employeeName}`);

  loadQueue();

  // Register device
  await registerDevice();

  if (!config.deviceId) {
    log('❌ Could not register device. Retrying in 30s...');
    setTimeout(main, 30000);
    return;
  }

  log(`✅ Agent running — Device: ${config.deviceId}`);
  log(`   Tracking: every ${config.trackingInterval}s`);
  log(`   Screenshots: every ${config.screenshotInterval}s`);
  log(`   Uploads: every ${config.uploadInterval}s`);

  // Start tracking loops
  setInterval(async () => {
    try {
      const idleSeconds = await checkIdle();
      if (idleSeconds >= config.idleThreshold) {
        if (!isIdle) {
          isIdle = true;
          currentApp = 'Idle';
          currentTitle = 'System Idle';
          sessionStart = Date.now();
          log(`💤 Idle detected (${idleSeconds}s)`);
        }
      } else {
        if (isIdle) {
          isIdle = false;
          log('🔄 Back from idle');
        }
        await trackWindow();
      }
    } catch (e) { /* ignore */ }
  }, config.trackingInterval * 1000);

  // Screenshot timer
  setInterval(() => {
    if (!isIdle) captureScreenshot();
  }, config.screenshotInterval * 1000);

  // Upload timer
  setInterval(() => uploadData(), config.uploadInterval * 1000);

  // Initial screenshot
  setTimeout(() => captureScreenshot(), 5000);

  log('✅ All trackers started');
}

main();
