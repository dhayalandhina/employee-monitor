// ============================================================
// EmpMonitor Windows Agent v2.1 — CommonJS (works on all Node.js versions)
// ============================================================
// Run: node agent.js "http://SERVER_IP:3001" "Employee Name" "AdminPassword"
// ============================================================

const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

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

let config = {
  serverUrl: process.argv[2] || 'http://localhost:3001',
  deviceId: null,
  employeeName: process.argv[3] || os.hostname(),
  agentPassword: process.argv[4] || 'admin@123',
  trackingInterval: 5,
  screenshotInterval: 300,
  uploadInterval: 30,
  idleThreshold: 120,
};

if (fs.existsSync(CONFIG_FILE)) {
  try {
    const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    config = Object.assign({}, config, saved);
  } catch (e) {}
}

function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function log(msg) {
  const line = '[' + new Date().toISOString() + '] ' + msg;
  console.log(line);
  try {
    fs.appendFileSync(LOG_FILE, line + '\n');
    const stats = fs.statSync(LOG_FILE);
    if (stats.size > 5 * 1024 * 1024) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      fs.writeFileSync(LOG_FILE, content.slice(content.length / 2));
    }
  } catch (e) {}
}

// ============================================================
// HTTP CLIENT
// ============================================================
function httpRequest(url, method, body) {
  return new Promise(function(resolve, reject) {
    var parsedUrl = new URL(url);
    var client = parsedUrl.protocol === 'https:' ? https : http;
    var options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method || 'GET',
      headers: { 'Content-Type': 'application/json' },
    };

    var req = client.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data: data }); }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, function() { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Upload screenshot via multipart
function uploadFile(url, filepath, fields) {
  return new Promise(function(resolve, reject) {
    var boundary = '----FormBoundary' + Date.now();
    var parsedUrl = new URL(url);
    var client = parsedUrl.protocol === 'https:' ? https : http;
    var filename = path.basename(filepath);
    var fileData = fs.readFileSync(filepath);

    var body = '';
    Object.keys(fields || {}).forEach(function(key) {
      body += '--' + boundary + '\r\nContent-Disposition: form-data; name="' + key + '"\r\n\r\n' + fields[key] + '\r\n';
    });
    var fileHeader = '--' + boundary + '\r\nContent-Disposition: form-data; name="screenshot"; filename="' + filename + '"\r\nContent-Type: image/png\r\n\r\n';
    var fileFooter = '\r\n--' + boundary + '--\r\n';

    var bodyBuffer = Buffer.concat([
      Buffer.from(body + fileHeader),
      fileData,
      Buffer.from(fileFooter)
    ]);

    var options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data; boundary=' + boundary,
        'Content-Length': bodyBuffer.length,
      },
    };

    var req = client.request(options, function(res) {
      var data = '';
      res.on('data', function(c) { data += c; });
      res.on('end', function() { resolve({ status: res.statusCode, data: data }); });
    });
    req.on('error', reject);
    req.write(bodyBuffer);
    req.end();
  });
}

// ============================================================
// OFFLINE QUEUE
// ============================================================
var eventQueue = [];
var screenshotQueue = [];

function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      var data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
      eventQueue = data.events || [];
      screenshotQueue = data.screenshots || [];
    }
  } catch (e) {}
}

function saveQueue() {
  try {
    fs.writeFileSync(QUEUE_FILE, JSON.stringify({ events: eventQueue, screenshots: screenshotQueue }));
  } catch (e) {}
}

// ============================================================
// DEVICE REGISTRATION
// ============================================================
function registerDevice() {
  return new Promise(function(resolve) {
    if (config.deviceId) {
      log('Device already registered: ' + config.deviceId);
      resolve();
      return;
    }

    httpRequest(config.serverUrl + '/api/devices/register', 'POST', {
      hostname: os.hostname(),
      os: 'Windows ' + os.release(),
      employeeName: config.employeeName,
      agentVersion: '2.1.0',
      agentPassword: config.agentPassword,
    }).then(function(res) {
      if (res.status === 201) {
        config.deviceId = res.data.deviceId;
        saveConfig();
        log('✅ Registered as ' + config.deviceId);
      } else {
        log('❌ Registration failed: ' + JSON.stringify(res.data));
        // Use a local ID so we can still queue data
        config.deviceId = 'LOCAL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        saveConfig();
      }
      resolve();
    }).catch(function(err) {
      log('❌ Cannot reach server: ' + err.message);
      config.deviceId = 'LOCAL-' + crypto.randomBytes(4).toString('hex').toUpperCase();
      saveConfig();
      resolve();
    });
  });
}

// ============================================================
// ACTIVE WINDOW TRACKING (PowerShell)
// ============================================================
var currentApp = null;
var currentTitle = null;
var sessionStart = null;

function getActiveWindow() {
  return new Promise(function(resolve) {
    var cmd = 'powershell -NoProfile -NonInteractive -Command "' +
      'try {' +
      'Add-Type -AssemblyName System.Windows.Forms;' +
      '$hwnd = [System.Windows.Forms.Form]::ActiveForm;' +
      '$proc = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object CPU -Descending | Select-Object -First 1;' +
      'Write-Output ($proc.ProcessName + \\"|\\\" + $proc.MainWindowTitle)' +
      '} catch { Write-Output \\"explorer|Desktop\\" }"';

    exec(cmd, { timeout: 5000 }, function(err, stdout) {
      if (err || !stdout.trim()) { resolve(null); return; }
      var parts = stdout.trim().split('|');
      resolve({
        appName: parts[0] || 'Unknown',
        windowTitle: parts.slice(1).join('|') || 'Unknown',
      });
    });
  });
}

function categorizeApp(appName) {
  var name = (appName || '').toLowerCase();
  var productive = ['code', 'devenv', 'idea', 'pycharm', 'webstorm', 'cmd', 'powershell', 'windowsterminal', 'slack', 'teams', 'outlook', 'excel', 'winword', 'powerpnt', 'figma', 'postman', 'notion', 'chrome', 'msedge', 'firefox'];
  var unproductive = ['spotify', 'whatsapp', 'telegram', 'discord', 'steam', 'vlc', 'netflix'];
  if (productive.some(function(p) { return name.includes(p); })) return 'productive';
  if (unproductive.some(function(u) { return name.includes(u); })) return 'unproductive';
  if (name === 'idle') return 'idle';
  return 'neutral';
}

function trackWindow() {
  return getActiveWindow().then(function(win) {
    if (!win) return;

    if (win.appName === currentApp && win.windowTitle === currentTitle) return;

    if (currentApp && sessionStart) {
      var duration = Math.floor((Date.now() - sessionStart) / 1000);
      if (duration >= 3) {
        eventQueue.push({
          deviceId: config.deviceId,
          appName: currentApp,
          windowTitle: currentTitle,
          category: categorizeApp(currentApp),
          duration: duration,
          timestamp: new Date(sessionStart).toISOString(),
          endTime: new Date().toISOString(),
          icon: '📱',
        });
      }
    }

    currentApp = win.appName;
    currentTitle = win.windowTitle;
    sessionStart = Date.now();
  }).catch(function() {});
}

// ============================================================
// SCREENSHOT CAPTURE (PowerShell)
// ============================================================
function captureScreenshot() {
  var filename = 'ss_' + Date.now() + '.png';
  var filepath = path.join(SCREENSHOT_DIR, filename);
  var safePath = filepath.replace(/\\/g, '\\\\');

  var cmd = 'powershell -NoProfile -NonInteractive -Command "' +
    'Add-Type -AssemblyName System.Windows.Forms;' +
    'Add-Type -AssemblyName System.Drawing;' +
    '$s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;' +
    '$b = New-Object System.Drawing.Bitmap($s.Width, $s.Height);' +
    '$g = [System.Drawing.Graphics]::FromImage($b);' +
    '$g.CopyFromScreen($s.Location, [System.Drawing.Point]::Empty, $s.Size);' +
    '$b.Save(\\\"' + safePath + '\\\", [System.Drawing.Imaging.ImageFormat]::Png);' +
    '$g.Dispose(); $b.Dispose()"';

  exec(cmd, { timeout: 20000 }, function(err) {
    if (err) { log('Screenshot error: ' + err.message); return; }
    if (fs.existsSync(filepath)) {
      screenshotQueue.push({
        filepath: filepath,
        appName: currentApp || 'Unknown',
        windowTitle: currentTitle || '',
      });
      log('📸 Screenshot captured: ' + filename);
      // Clean up old screenshots (keep last 20)
      try {
        var files = fs.readdirSync(SCREENSHOT_DIR);
        if (files.length > 20) {
          files.sort().slice(0, files.length - 20).forEach(function(f) {
            try { fs.unlinkSync(path.join(SCREENSHOT_DIR, f)); } catch (e) {}
          });
        }
      } catch (e) {}
    }
  });
}

// ============================================================
// IDLE DETECTION (PowerShell)
// ============================================================
var isIdle = false;

function checkIdle() {
  return new Promise(function(resolve) {
    var cmd = 'powershell -NoProfile -NonInteractive -Command "' +
      'Add-Type @\\"\\nusing System;\\nusing System.Runtime.InteropServices;\\n' +
      'public struct LASTINPUTINFO { public uint cbSize; public uint dwTime; }\\n' +
      'public class IdleTime {\\n' +
      '  [DllImport(\\\\\\"user32.dll\\\\\\")] public static extern bool GetLastInputInfo(ref LASTINPUTINFO p);\\n' +
      '  public static uint Get() { LASTINPUTINFO l = new LASTINPUTINFO(); l.cbSize = (uint)System.Runtime.InteropServices.Marshal.SizeOf(l); GetLastInputInfo(ref l); return ((uint)Environment.TickCount - l.dwTime)/1000; }\\n' +
      '}\\n\\"@\\n' +
      'Write-Output ([IdleTime]::Get())"';

    exec(cmd, { timeout: 5000 }, function(err, stdout) {
      if (err) { resolve(0); return; }
      resolve(parseInt(stdout.trim()) || 0);
    });
  });
}

// ============================================================
// DATA UPLOAD
// ============================================================
function uploadData() {
  if (!config.deviceId) return;

  // Check if device still active on server
  httpRequest(config.serverUrl + '/api/devices/' + config.deviceId + '/status').then(function(res) {
    if (res.data && res.data.active === false) {
      log('⚠️ Device was removed by admin. Re-registering...');
      config.deviceId = null;
      saveConfig();
      registerDevice();
    }
  }).catch(function() {
    // Server unreachable — keep queuing locally
  });

  // Upload activity events
  if (eventQueue.length > 0) {
    var batch = eventQueue.splice(0, 50);
    httpRequest(config.serverUrl + '/api/activity', 'POST', {
      deviceId: config.deviceId,
      events: batch,
    }).then(function(res) {
      log('📤 Uploaded ' + batch.length + ' events');
    }).catch(function(err) {
      eventQueue.unshift.apply(eventQueue, batch);
      log('⚠️ Upload failed, queued: ' + eventQueue.length);
    });
  }

  // Upload screenshot
  if (screenshotQueue.length > 0) {
    var ss = screenshotQueue.shift();
    if (ss && fs.existsSync(ss.filepath)) {
      uploadFile(config.serverUrl + '/api/screenshots', ss.filepath, {
        deviceId: config.deviceId,
        appName: ss.appName || '',
        windowTitle: ss.windowTitle || '',
      }).then(function() {
        log('📤 Uploaded screenshot');
        try { fs.unlinkSync(ss.filepath); } catch (e) {}
      }).catch(function(err) {
        screenshotQueue.unshift(ss);
      });
    }
  }

  // Heartbeat
  httpRequest(config.serverUrl + '/api/devices/' + config.deviceId + '/heartbeat', 'POST', {}).catch(function() {});

  saveQueue();
}

// ============================================================
// PASSWORD-PROTECTED SHUTDOWN
// ============================================================
process.on('SIGINT', function() {
  console.log('\n⚠️  Enter admin password to stop the agent:');
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  var timeout = setTimeout(function() {
    console.log('❌ No password entered. Agent continues running.');
    process.stdin.pause();
  }, 15000);

  process.stdin.once('data', function(input) {
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

// ============================================================
// LIVE STREAMING — Real-time screen capture
// ============================================================
var isLiveMode = false;
var liveInterval = null;

function checkLiveMode() {
  if (!config.deviceId) return;
  httpRequest(config.serverUrl + '/api/live/check/' + config.deviceId).then(function(res) {
    if (res.data && res.data.live === true) {
      if (!isLiveMode) {
        isLiveMode = true;
        log('🔴 LIVE MODE ON — Admin is watching');
        startLiveStream();
      }
    } else {
      if (isLiveMode) {
        isLiveMode = false;
        log('⏹️ LIVE MODE OFF');
        stopLiveStream();
      }
    }
  }).catch(function() {});
}

function startLiveStream() {
  if (liveInterval) clearInterval(liveInterval);
  // Capture and send every 2 seconds
  liveInterval = setInterval(captureLiveFrame, 2000);
  // Send first frame immediately
  captureLiveFrame();
}

function stopLiveStream() {
  if (liveInterval) {
    clearInterval(liveInterval);
    liveInterval = null;
  }
}

function captureLiveFrame() {
  var tmpFile = path.join(os.tmpdir(), 'empmon_live.png');
  var psScript = path.join(os.tmpdir(), 'empmon_capture.ps1');

  // Write PowerShell script to a file (avoids all escaping issues)
  var script = [
    'Add-Type -AssemblyName System.Windows.Forms',
    'Add-Type -AssemblyName System.Drawing',
    '$s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds',
    '$w = [int][Math]::Floor($s.Width / 2)',
    '$h = [int][Math]::Floor($s.Height / 2)',
    '$full = New-Object System.Drawing.Bitmap($s.Width, $s.Height)',
    '$g = [System.Drawing.Graphics]::FromImage($full)',
    '$g.CopyFromScreen($s.Location, [System.Drawing.Point]::Empty, $s.Size)',
    '$thumb = New-Object System.Drawing.Bitmap($w, $h)',
    '$g2 = [System.Drawing.Graphics]::FromImage($thumb)',
    '$g2.DrawImage($full, 0, 0, $w, $h)',
    '$thumb.Save(\'' + tmpFile + '\', [System.Drawing.Imaging.ImageFormat]::Png)',
    '$g.Dispose(); $g2.Dispose(); $full.Dispose(); $thumb.Dispose()',
  ].join('\n');

  try { fs.writeFileSync(psScript, script); } catch(e) { return; }

  exec('powershell -NoProfile -ExecutionPolicy Bypass -File "' + psScript + '"', { timeout: 5000 }, function(err) {
    if (err) { log('Live capture error: ' + err.message); return; }
    try {
      if (!fs.existsSync(tmpFile)) return;
      var data = fs.readFileSync(tmpFile);
      var base64 = data.toString('base64');
      httpRequest(config.serverUrl + '/api/live/frame', 'POST', {
        deviceId: config.deviceId,
        frame: 'data:image/png;base64,' + base64,
        appName: currentApp || 'Desktop',
        windowTitle: currentTitle || '',
        isIdle: isIdle,
      }).catch(function() {});
    } catch(e) {}
  });
}

// ============================================================
// MAIN
// ============================================================
function main() {
  log('🚀 EmpMonitor Agent starting...');
  log('📡 Server: ' + config.serverUrl);
  log('👤 Employee: ' + config.employeeName);

  loadQueue();

  registerDevice().then(function() {
    log('✅ Agent running — Device: ' + config.deviceId);

    // Track active window every 5 seconds
    setInterval(function() {
      checkIdle().then(function(idleSeconds) {
        if (idleSeconds >= config.idleThreshold) {
          if (!isIdle) {
            isIdle = true;
            currentApp = 'Idle';
            currentTitle = 'System Idle';
            sessionStart = Date.now();
            log('💤 Idle: ' + idleSeconds + 's');
          }
        } else {
          if (isIdle) { isIdle = false; log('🔄 Back from idle'); }
          trackWindow();
        }
      }).catch(function() { trackWindow(); });
    }, config.trackingInterval * 1000);

    // Screenshot every 5 minutes (for history)
    setInterval(function() {
      if (!isIdle) captureScreenshot();
    }, config.screenshotInterval * 1000);

    // Upload activity data every 30 seconds
    setInterval(uploadData, config.uploadInterval * 1000);

    // Check if admin is watching (live mode) every 3 seconds
    setInterval(checkLiveMode, 3000);

    // First screenshot after 10 seconds
    setTimeout(captureScreenshot, 10000);

    log('✅ All trackers started. Agent is monitoring.');
    log('📺 Live streaming ready — waiting for admin to watch.');
  });
}

main();

