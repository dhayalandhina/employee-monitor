// ============================================================
// Config — Agent configuration with defaults
// ============================================================

import Store from 'electron-store';
import os from 'os';

const defaults = {
  serverUrl: 'http://localhost:3001',
  deviceId: null,
  employeeId: null,
  hostname: os.hostname(),
  os: `${os.type()} ${os.release()}`,

  // Tracking intervals (in seconds)
  trackingInterval: 5,         // Check active window every 5 seconds
  screenshotInterval: 300,     // Screenshot every 5 minutes
  uploadInterval: 30,          // Upload to server every 30 seconds
  idleThreshold: 120,          // Consider idle after 2 minutes of no input

  // Quality settings
  screenshotQuality: 60,       // JPEG quality (0–100)
  maxQueueSize: 1000,          // Max offline queue size
  maxScreenshotSize: 500 * 1024, // 500KB max per screenshot

  // Auto-start
  autoStart: true,
  startMinimized: true,
};

export class Config {
  constructor() {
    this.store = new Store({ defaults });
  }

  get(key) {
    return this.store.get(key);
  }

  set(key, value) {
    this.store.set(key, value);
  }

  getAll() {
    return this.store.store;
  }
}
