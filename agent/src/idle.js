// ============================================================
// Idle Detector — Monitors user input activity
// ============================================================
// Uses Electron's powerMonitor to detect system idle time.
// When idle exceeds threshold, logs an idle event.
// ============================================================

import { powerMonitor } from 'electron';

export class IdleDetector {
  constructor(config) {
    this.config = config;
    this.interval = null;
    this.isRunning = false;
    this.isIdle = false;
    this.idleStartTime = null;
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    const thresholdSeconds = this.config.get('idleThreshold');

    // Check idle state every 10 seconds
    this.interval = setInterval(() => {
      const idleTime = powerMonitor.getSystemIdleTime(); // in seconds

      if (idleTime >= thresholdSeconds && !this.isIdle) {
        // Transitioned to idle
        this.isIdle = true;
        this.idleStartTime = new Date(Date.now() - idleTime * 1000);
        console.log(`💤 System idle detected (${idleTime}s)`);
      } else if (idleTime < thresholdSeconds && this.isIdle) {
        // Returned from idle
        const idleDuration = Math.floor((Date.now() - this.idleStartTime.getTime()) / 1000);
        this.isIdle = false;
        this.idleStartTime = null;
        console.log(`🔄 Returned from idle (was idle for ${idleDuration}s)`);
      }
    }, 10000);

    console.log(`💤 Idle Detector started (threshold: ${thresholdSeconds}s)`);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    console.log('💤 Idle Detector stopped');
  }

  getIdleState() {
    return {
      isIdle: this.isIdle,
      idleSince: this.idleStartTime,
      currentIdleTime: this.isIdle
        ? Math.floor((Date.now() - this.idleStartTime.getTime()) / 1000)
        : 0,
    };
  }
}
