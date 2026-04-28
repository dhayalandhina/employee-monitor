// ============================================================
// API Uploader — Sends queued data to backend server
// ============================================================
// Handles device registration, event upload, and screenshot
// upload. Retries on failure and respects offline mode.
// ============================================================

import fs from 'fs';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

export class ApiUploader {
  constructor(config, queue) {
    this.config = config;
    this.queue = queue;
    this.deviceId = config.get('deviceId');
    this.interval = null;
    this.lastUploadTime = null;
    this.isUploading = false;
    this.consecutiveFailures = 0;
  }

  async registerDevice() {
    if (this.deviceId) {
      console.log(`🖥️ Device already registered: ${this.deviceId}`);
      return;
    }

    try {
      const serverUrl = this.config.get('serverUrl');
      const res = await fetch(`${serverUrl}/api/devices/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname: os.hostname(),
          os: `${os.type()} ${os.release()}`,
          employeeId: this.config.get('employeeId'),
          agentVersion: '2.1.0',
        }),
      });

      const data = await res.json();
      this.deviceId = data.deviceId;
      this.config.set('deviceId', data.deviceId);
      console.log(`✅ Device registered: ${data.deviceId}`);
    } catch (err) {
      console.error('❌ Device registration failed:', err.message);
      // Generate a temporary local ID
      this.deviceId = `LOCAL-${uuidv4().slice(0, 8).toUpperCase()}`;
      this.config.set('deviceId', this.deviceId);
    }
  }

  startPeriodicUpload(intervalSeconds = 30) {
    this.interval = setInterval(() => {
      this.uploadAll();
    }, intervalSeconds * 1000);

    console.log(`📤 Uploader started (every ${intervalSeconds}s)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  async uploadAll() {
    if (this.isUploading) return;
    this.isUploading = true;

    try {
      // Upload activity events
      await this.uploadEvents();
      // Upload screenshots
      await this.uploadScreenshots();
      // Send heartbeat
      await this.sendHeartbeat();

      this.lastUploadTime = new Date();
      this.consecutiveFailures = 0;
    } catch (err) {
      this.consecutiveFailures++;
      console.error(`❌ Upload failed (attempt ${this.consecutiveFailures}):`, err.message);

      // Back off after consecutive failures
      if (this.consecutiveFailures >= 5) {
        console.warn('⚠️ Server unreachable — queueing events locally');
      }
    } finally {
      this.isUploading = false;
    }
  }

  async uploadEvents() {
    const events = this.queue.dequeueEvents(50);
    if (events.length === 0) return;

    try {
      const serverUrl = this.config.get('serverUrl');
      const res = await fetch(`${serverUrl}/api/activity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: this.deviceId, events }),
      });

      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      console.log(`📤 Uploaded ${data.saved} activity events`);
    } catch (err) {
      // Re-queue events on failure
      events.forEach(e => this.queue.enqueue('activity', e));
      throw err;
    }
  }

  async uploadScreenshots() {
    const screenshots = this.queue.dequeueScreenshots(3);
    if (screenshots.length === 0) return;

    for (const ss of screenshots) {
      try {
        if (!fs.existsSync(ss.filepath)) {
          console.warn(`⚠️ Screenshot file missing: ${ss.filepath}`);
          continue;
        }

        const serverUrl = this.config.get('serverUrl');
        const formData = new FormData();
        const fileBuffer = fs.readFileSync(ss.filepath);
        const blob = new Blob([fileBuffer], { type: 'image/png' });

        formData.append('screenshot', blob, ss.filename);
        formData.append('deviceId', this.deviceId);
        formData.append('employeeId', this.config.get('employeeId') || '');
        formData.append('appName', ss.appName || 'Unknown');
        formData.append('windowTitle', ss.windowTitle || '');

        const res = await fetch(`${serverUrl}/api/screenshots`, {
          method: 'POST',
          body: formData,
        });

        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        console.log(`📤 Uploaded screenshot: ${ss.filename}`);

        // Clean up local file after successful upload
        try { fs.unlinkSync(ss.filepath); } catch (e) { /* ignore */ }
      } catch (err) {
        // Re-queue on failure
        this.queue.enqueue('screenshot', ss);
        throw err;
      }
    }
  }

  async sendHeartbeat() {
    try {
      const serverUrl = this.config.get('serverUrl');
      await fetch(`${serverUrl}/api/devices/${this.deviceId}/heartbeat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestamp: new Date().toISOString() }),
      });
    } catch (err) {
      // Heartbeat failures are non-critical
    }
  }
}
