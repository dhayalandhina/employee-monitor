// ============================================================
// Activity Tracker — Tracks active app, window title, URL
// ============================================================
// Uses `active-win` to get the currently focused window every
// few seconds. Groups consecutive identical windows into
// sessions and queues them for upload.
// ============================================================

import activeWin from 'active-win';
import { v4 as uuidv4 } from 'uuid';

export class ActivityTracker {
  constructor(config, queue) {
    this.config = config;
    this.queue = queue;
    this.interval = null;
    this.isRunning = false;
    this.currentSession = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const intervalMs = this.config.get('trackingInterval') * 1000;

    this.interval = setInterval(async () => {
      try {
        await this.trackActiveWindow();
      } catch (err) {
        console.error('Tracking error:', err.message);
      }
    }, intervalMs);

    console.log(`📋 Activity Tracker started (every ${intervalMs / 1000}s)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    // Flush current session
    if (this.currentSession) {
      this.finalizeSession();
    }
    this.isRunning = false;
    console.log('📋 Activity Tracker stopped');
  }

  async trackActiveWindow() {
    const win = await activeWin();
    if (!win) return;

    const appName = win.owner?.name || 'Unknown';
    const windowTitle = win.title || '';
    const url = win.url || null; // Available with browser extension

    // Categorize the app
    const category = this.categorizeApp(appName, url);

    // If same app + title as current session, extend it
    if (
      this.currentSession &&
      this.currentSession.appName === appName &&
      this.currentSession.windowTitle === windowTitle
    ) {
      this.currentSession.endTime = new Date();
      this.currentSession.duration = Math.floor(
        (this.currentSession.endTime - this.currentSession.startTime) / 1000
      );
      return;
    }

    // Finalize previous session and start new one
    if (this.currentSession) {
      this.finalizeSession();
    }

    this.currentSession = {
      id: uuidv4(),
      deviceId: this.config.get('deviceId'),
      employeeId: this.config.get('employeeId'),
      appName,
      windowTitle,
      url,
      category,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
    };
  }

  finalizeSession() {
    if (!this.currentSession) return;

    const session = { ...this.currentSession };
    session.endTime = new Date();
    session.duration = Math.floor(
      (session.endTime - session.startTime) / 1000
    );

    // Only queue sessions longer than 3 seconds
    if (session.duration >= 3) {
      this.queue.enqueue('activity', {
        ...session,
        timestamp: session.startTime.toISOString(),
        endTime: session.endTime.toISOString(),
      });
    }

    this.currentSession = null;
  }

  categorizeApp(appName, url) {
    const name = appName.toLowerCase();

    // Productive apps
    const productive = [
      'visual studio code', 'code', 'vscode',
      'intellij', 'webstorm', 'pycharm', 'android studio',
      'sublime text', 'atom', 'vim', 'neovim',
      'terminal', 'cmd', 'powershell', 'iterm',
      'slack', 'teams', 'microsoft teams',
      'outlook', 'thunderbird',
      'figma', 'sketch', 'adobe',
      'postman', 'insomnia',
      'notion', 'obsidian',
      'excel', 'word', 'powerpoint',
      'jira', 'trello', 'asana',
    ];

    // Unproductive apps
    const unproductive = [
      'spotify', 'vlc', 'media player',
      'whatsapp', 'telegram', 'discord',
      'steam', 'epic games',
    ];

    if (productive.some(p => name.includes(p))) return 'productive';
    if (unproductive.some(u => name.includes(u))) return 'unproductive';

    // URL-based categorization for browsers
    if (url) {
      const urlLower = url.toLowerCase();
      const productiveUrls = ['github.com', 'gitlab.com', 'stackoverflow.com', 'docs.google.com', 'jira', 'confluence', 'figma.com'];
      const unproductiveUrls = ['youtube.com', 'facebook.com', 'instagram.com', 'twitter.com', 'reddit.com', 'tiktok.com'];

      if (productiveUrls.some(p => urlLower.includes(p))) return 'productive';
      if (unproductiveUrls.some(u => urlLower.includes(u))) return 'unproductive';
    }

    return 'neutral';
  }
}
