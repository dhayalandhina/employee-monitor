// ============================================================
// Local Queue — Offline event storage
// ============================================================
// Stores events in memory and persists to disk when offline.
// Ensures no data loss if the server is unreachable.
// ============================================================

import fs from 'fs';
import path from 'path';
import os from 'os';

const QUEUE_FILE = path.join(os.homedir(), '.empmonitor', 'queue.json');

export class LocalQueue {
  constructor() {
    this.events = [];
    this.screenshots = [];
    this.load();
  }

  enqueue(type, data) {
    if (type === 'screenshot') {
      this.screenshots.push(data);
    } else {
      this.events.push(data);
    }

    // Auto-persist every 50 events
    if ((this.events.length + this.screenshots.length) % 50 === 0) {
      this.persist();
    }
  }

  dequeueEvents(count = 50) {
    return this.events.splice(0, count);
  }

  dequeueScreenshots(count = 5) {
    return this.screenshots.splice(0, count);
  }

  size() {
    return this.events.length + this.screenshots.length;
  }

  persist() {
    try {
      const dir = path.dirname(QUEUE_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(QUEUE_FILE, JSON.stringify({
        events: this.events,
        screenshots: this.screenshots.map(s => ({ ...s, filepath: s.filepath })),
      }));
    } catch (err) {
      console.error('Queue persist error:', err.message);
    }
  }

  load() {
    try {
      if (fs.existsSync(QUEUE_FILE)) {
        const data = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
        this.events = data.events || [];
        this.screenshots = data.screenshots || [];
        console.log(`📦 Loaded ${this.size()} queued events from disk`);
      }
    } catch (err) {
      console.error('Queue load error:', err.message);
      this.events = [];
      this.screenshots = [];
    }
  }

  flush() {
    this.persist();
    console.log(`📦 Queue flushed: ${this.size()} events saved`);
  }

  clear() {
    this.events = [];
    this.screenshots = [];
    try {
      if (fs.existsSync(QUEUE_FILE)) fs.unlinkSync(QUEUE_FILE);
    } catch (e) { /* ignore */ }
  }
}
