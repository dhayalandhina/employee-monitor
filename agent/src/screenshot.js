// ============================================================
// Screenshot Engine — Captures screen periodically
// ============================================================
// Uses `screenshot-desktop` to capture the full screen at
// configured intervals. Compresses to JPEG and queues for upload.
// ============================================================

import screenshot from 'screenshot-desktop';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class ScreenshotEngine {
  constructor(config, queue) {
    this.config = config;
    this.queue = queue;
    this.interval = null;
    this.isRunning = false;
    this.captureCount = 0;
    this.tempDir = path.join(os.tmpdir(), 'empmonitor-screenshots');

    // Ensure temp directory exists
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const intervalMs = this.config.get('screenshotInterval') * 1000;

    // Capture immediately on start
    this.capture();

    this.interval = setInterval(() => {
      this.capture();
    }, intervalMs);

    console.log(`📸 Screenshot Engine started (every ${intervalMs / 1000}s)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('📸 Screenshot Engine stopped');
  }

  async capture() {
    try {
      // Capture screen as PNG buffer
      const imgBuffer = await screenshot({ format: 'png' });

      const filename = `screenshot_${Date.now()}_${uuidv4().slice(0, 8)}.png`;
      const filepath = path.join(this.tempDir, filename);

      // Save to temp directory
      fs.writeFileSync(filepath, imgBuffer);

      // Check file size
      const stats = fs.statSync(filepath);
      const maxSize = this.config.get('maxScreenshotSize');

      if (stats.size > maxSize) {
        console.warn(`⚠️ Screenshot too large (${(stats.size/1024).toFixed(0)}KB), skipping`);
        fs.unlinkSync(filepath);
        return;
      }

      // Queue for upload
      this.queue.enqueue('screenshot', {
        id: uuidv4(),
        deviceId: this.config.get('deviceId'),
        employeeId: this.config.get('employeeId'),
        timestamp: new Date().toISOString(),
        filepath,
        filename,
        size: stats.size,
      });

      this.captureCount++;
      console.log(`📸 Screenshot captured: ${filename} (${(stats.size/1024).toFixed(0)}KB)`);

      // Clean up old temp files (keep last 20)
      this.cleanupTempFiles();
    } catch (err) {
      console.error('Screenshot capture error:', err.message);
    }
  }

  cleanupTempFiles() {
    try {
      const files = fs.readdirSync(this.tempDir)
        .map(f => ({ name: f, time: fs.statSync(path.join(this.tempDir, f)).mtimeMs }))
        .sort((a, b) => b.time - a.time);

      // Keep only last 20 files
      files.slice(20).forEach(f => {
        try {
          fs.unlinkSync(path.join(this.tempDir, f.name));
        } catch (e) { /* ignore */ }
      });
    } catch (e) { /* ignore */ }
  }
}
