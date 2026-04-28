// ============================================================
// Processing Engine — Cron Jobs
// ============================================================
// Runs scheduled tasks:
// 1. Sessionizer: Converts raw activity logs → sessions
// 2. Aggregator: Generates daily summary data
// 3. Productivity Calculator: Scores each employee
// 4. Report Generator: Creates downloadable reports
// 5. Cleanup: Auto-deletes screenshots older than 7 days
// ============================================================

export class ProcessingEngine {
  constructor(db) {
    this.db = db;
  }

  // ─── SESSIONIZER ─────────────────────────────────────────
  // Groups consecutive activity logs from the same app into sessions
  sessionize(deviceId, date) {
    const logs = Array.from(this.db.activityLogs.values())
      .filter(l => l.deviceId === deviceId && l.timestamp.toISOString().split('T')[0] === date)
      .sort((a, b) => a.timestamp - b.timestamp);

    const sessions = [];
    let current = null;

    for (const log of logs) {
      if (current && current.appName === log.appName &&
          (log.timestamp - current.endTime) < 60000) { // Within 1 min gap
        current.endTime = log.endTime || log.timestamp;
        current.duration += log.duration;
        current.events.push(log.id);
      } else {
        if (current) sessions.push(current);
        current = {
          deviceId,
          appName: log.appName,
          category: log.category,
          startTime: log.timestamp,
          endTime: log.endTime || log.timestamp,
          duration: log.duration,
          events: [log.id],
        };
      }
    }
    if (current) sessions.push(current);

    console.log(`📊 Sessionized ${logs.length} logs → ${sessions.length} sessions for ${deviceId}`);
    return sessions;
  }

  // ─── DAILY AGGREGATOR ─────────────────────────────────────
  // Creates daily summary for a device
  aggregateDaily(deviceId, date) {
    const logs = Array.from(this.db.activityLogs.values())
      .filter(l => l.deviceId === deviceId && l.timestamp.toISOString().split('T')[0] === date);

    const totalActive = logs.reduce((sum, l) => sum + (l.duration || 0), 0);
    const productive = logs.filter(l => l.category === 'productive').reduce((sum, l) => sum + (l.duration || 0), 0);
    const unproductive = logs.filter(l => l.category === 'unproductive').reduce((sum, l) => sum + (l.duration || 0), 0);
    const idle = logs.filter(l => l.category === 'idle').reduce((sum, l) => sum + (l.duration || 0), 0);

    // Top apps by duration
    const appDurations = {};
    logs.forEach(l => {
      appDurations[l.appName] = (appDurations[l.appName] || 0) + (l.duration || 0);
    });
    const topApps = Object.entries(appDurations)
      .map(([name, duration]) => ({ name, duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Top URLs
    const urlDurations = {};
    logs.filter(l => l.url).forEach(l => {
      try {
        const hostname = new URL(l.url).hostname;
        urlDurations[hostname] = (urlDurations[hostname] || 0) + (l.duration || 0);
      } catch (e) { /* ignore invalid URLs */ }
    });
    const topUrls = Object.entries(urlDurations)
      .map(([url, duration]) => ({ url, duration }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    // Login/logout times
    const sortedLogs = [...logs].sort((a, b) => a.timestamp - b.timestamp);
    const loginTime = sortedLogs[0]?.timestamp;
    const logoutTime = sortedLogs[sortedLogs.length - 1]?.endTime || sortedLogs[sortedLogs.length - 1]?.timestamp;

    return {
      deviceId,
      date,
      totalActiveTime: totalActive,
      productiveTime: productive,
      unproductiveTime: unproductive,
      idleTime: idle,
      productivityScore: totalActive > 0 ? Math.round((productive / totalActive) * 100) : 0,
      topApps,
      topUrls,
      loginTime: loginTime ? loginTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
      logoutTime: logoutTime ? logoutTime.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : null,
      totalEvents: logs.length,
    };
  }

  // ─── PRODUCTIVITY CALCULATOR ──────────────────────────────
  // Calculates weighted productivity score
  calculateProductivity(report) {
    const { productiveTime, unproductiveTime, idleTime, totalActiveTime } = report;
    if (totalActiveTime === 0) return 0;

    // Weighted scoring:
    // Productive time: +1.0 weight
    // Neutral time: +0.5 weight
    // Idle time: -0.2 weight
    // Unproductive time: -0.5 weight
    const neutralTime = totalActiveTime - productiveTime - unproductiveTime - idleTime;
    const score = (
      (productiveTime * 1.0) +
      (neutralTime * 0.5) +
      (idleTime * -0.2) +
      (unproductiveTime * -0.5)
    ) / totalActiveTime * 100;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  // ─── REPORT GENERATOR ─────────────────────────────────────
  // Generates a structured daily report object for email/PDF
  generateReport(deviceId, date) {
    const report = this.aggregateDaily(deviceId, date);
    const device = this.db.devices.get(deviceId);
    const employee = device ? this.db.employees.get(device.employeeId) : null;
    const sessions = this.sessionize(deviceId, date);

    const screenshots = Array.from(this.db.screenshots.values())
      .filter(s => s.deviceId === deviceId && s.timestamp.toISOString().split('T')[0] === date);

    return {
      ...report,
      productivityScore: this.calculateProductivity(report),
      employee: employee ? { name: employee.name, email: employee.email, department: employee.department } : null,
      device: device ? { hostname: device.hostname, os: device.os } : null,
      sessions,
      screenshotCount: screenshots.length,
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── CLEANUP ──────────────────────────────────────────────
  // Deletes screenshots older than 7 days
  cleanupOldScreenshots(retentionDays = 7) {
    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (const [id, ss] of this.db.screenshots) {
      if (ss.timestamp < cutoff) {
        this.db.screenshots.delete(id);
        deleted++;
      }
    }

    console.log(`🗑️ Cleaned up ${deleted} screenshots older than ${retentionDays} days`);
    return deleted;
  }

  // ─── RUN ALL DAILY JOBS ───────────────────────────────────
  runDailyJobs(date) {
    console.log(`\n⚙️ Running daily processing jobs for ${date}...`);

    const devices = Array.from(this.db.devices.values());
    const reports = [];

    for (const device of devices) {
      const report = this.generateReport(device.id, date);
      reports.push(report);
      console.log(`  📄 ${device.id}: ${report.productivityScore}% productivity, ${report.totalEvents} events`);
    }

    // Cleanup old data
    this.cleanupOldScreenshots(7);

    console.log(`✅ Daily jobs complete: ${reports.length} reports generated\n`);
    return reports;
  }
}
