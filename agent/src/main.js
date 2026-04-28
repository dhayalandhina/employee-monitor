// ============================================================
// EmpMonitor Agent — Main Process (Electron)
// ============================================================
// This runs on employee Windows PCs. It:
// 1. Starts automatically on login
// 2. Tracks active app/window titles
// 3. Captures screenshots every 5–10 minutes
// 4. Detects idle time
// 5. Sends data to the backend API every 30–60 seconds
// 6. Queues events locally when offline
// ============================================================

import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { ActivityTracker } from './tracker.js';
import { ScreenshotEngine } from './screenshot.js';
import { IdleDetector } from './idle.js';
import { ApiUploader } from './uploader.js';
import { LocalQueue } from './queue.js';
import { Config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let tracker = null;
let screenshotEngine = null;
let idleDetector = null;
let uploader = null;
let queue = null;

// ============================================================
// APP LIFECYCLE
// ============================================================

app.whenReady().then(async () => {
  // Prevent multiple instances
  const gotLock = app.requestSingleInstanceLock();
  if (!gotLock) {
    app.quit();
    return;
  }

  console.log('🚀 EmpMonitor Agent starting...');

  // Initialize config
  const config = new Config();
  
  // Initialize local queue (offline support)
  queue = new LocalQueue();

  // Initialize API uploader
  uploader = new ApiUploader(config, queue);
  await uploader.registerDevice();

  // Initialize tracking modules
  tracker = new ActivityTracker(config, queue);
  screenshotEngine = new ScreenshotEngine(config, queue);
  idleDetector = new IdleDetector(config);

  // Start all trackers
  tracker.start();
  screenshotEngine.start();
  idleDetector.start();

  // Start uploading queued data every 30 seconds
  uploader.startPeriodicUpload(30);

  // Create system tray
  createTray();

  // Create hidden status window
  createWindow();

  console.log('✅ EmpMonitor Agent running');
  console.log(`📡 Server: ${config.get('serverUrl')}`);
  console.log(`🖥️ Device: ${config.get('deviceId')}`);
});

app.on('window-all-closed', (e) => {
  // Don't quit when window is closed — keep running in tray
  e.preventDefault();
});

app.on('before-quit', () => {
  // Flush remaining data before quit
  if (queue) queue.flush();
  if (tracker) tracker.stop();
  if (screenshotEngine) screenshotEngine.stop();
  if (idleDetector) idleDetector.stop();
});

// ============================================================
// SYSTEM TRAY
// ============================================================

function createTray() {
  // In production, use a proper icon file
  tray = new Tray(nativeImage.createEmpty());
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'EmpMonitor Agent v2.1.0', enabled: false },
    { type: 'separator' },
    {
      label: '📊 Status',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    {
      label: '⏸️ Pause Tracking',
      type: 'checkbox',
      checked: false,
      click: (menuItem) => {
        if (menuItem.checked) {
          tracker?.stop();
          screenshotEngine?.stop();
          console.log('⏸️ Tracking paused');
        } else {
          tracker?.start();
          screenshotEngine?.start();
          console.log('▶️ Tracking resumed');
        }
      }
    },
    { type: 'separator' },
    {
      label: '❌ Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setToolTip('EmpMonitor Agent — Tracking active');
  tray.setContextMenu(contextMenu);
}

// ============================================================
// STATUS WINDOW (hidden by default)
// ============================================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    show: false,
    resizable: false,
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'status.html'));

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

// ============================================================
// IPC HANDLERS (for renderer process)
// ============================================================

ipcMain.handle('get-status', () => {
  return {
    deviceId: uploader?.deviceId || 'Not registered',
    isTracking: tracker?.isRunning || false,
    eventsQueued: queue?.size() || 0,
    lastUpload: uploader?.lastUploadTime || null,
    screenshotCount: screenshotEngine?.captureCount || 0,
    uptime: process.uptime(),
  };
});

ipcMain.handle('get-config', () => {
  const config = new Config();
  return {
    serverUrl: config.get('serverUrl'),
    screenshotInterval: config.get('screenshotInterval'),
    trackingInterval: config.get('trackingInterval'),
    idleThreshold: config.get('idleThreshold'),
  };
});
