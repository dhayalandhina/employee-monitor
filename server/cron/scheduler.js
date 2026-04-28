// ============================================================
// Cron Scheduler — Runs daily at 6 PM
// ============================================================
// Orchestrates the processing engine and email service:
// 1. Sessionize raw activity logs
// 2. Aggregate daily data per employee
// 3. Calculate productivity scores
// 4. Generate & send daily report emails
// 5. Clean up old screenshots (7-day retention)
// ============================================================

import cron from 'node-cron';
import { ProcessingEngine } from './processing.js';
import { EmailService } from '../email/service.js';

export function startScheduler(db) {
  const processor = new ProcessingEngine(db);
  const emailService = new EmailService({
    provider: 'sendgrid',
    apiKey: process.env.SENDGRID_API_KEY,
    fromEmail: process.env.EMAIL_FROM || 'noreply@empmonitor.com',
  });

  // ─── DAILY JOB: 6:00 PM every day ────────────────────────
  cron.schedule('0 18 * * *', async () => {
    console.log('\n🕕 ═══════════════════════════════════════════');
    console.log('   DAILY PROCESSING JOB STARTED');
    console.log('═══════════════════════════════════════════\n');

    const today = new Date().toISOString().split('T')[0];

    try {
      // Step 1: Generate reports for all devices
      const reports = processor.runDailyJobs(today);

      // Step 2: Send individual reports to employees
      await emailService.sendDailyReports(reports);

      // Step 3: Send admin summary
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
      await emailService.sendAdminSummary(reports, adminEmail);

      console.log('✅ Daily processing complete');
    } catch (err) {
      console.error('❌ Daily processing error:', err);
    }
  }, {
    timezone: 'Asia/Kolkata'
  });

  // ─── CLEANUP JOB: 2:00 AM every day ──────────────────────
  cron.schedule('0 2 * * *', () => {
    console.log('🗑️ Running cleanup job...');
    processor.cleanupOldScreenshots(7);
  }, {
    timezone: 'Asia/Kolkata'
  });

  // ─── HOURLY AGGREGATION ───────────────────────────────────
  cron.schedule('0 * * * *', () => {
    const today = new Date().toISOString().split('T')[0];
    const devices = Array.from(db.devices.values());
    
    devices.forEach(device => {
      const report = processor.aggregateDaily(device.id, today);
      // Update daily report in DB
      const existingKey = Array.from(db.dailyReports.entries())
        .find(([, r]) => r.deviceId === device.id && r.date === today);
      
      if (existingKey) {
        db.dailyReports.set(existingKey[0], {
          ...db.dailyReports.get(existingKey[0]),
          ...report,
          id: existingKey[0],
          employeeId: device.employeeId,
        });
      }
    });
    
    console.log(`📊 Hourly aggregation complete for ${devices.length} devices`);
  });

  console.log('⏰ Cron scheduler started:');
  console.log('   • Daily report: 6:00 PM IST');
  console.log('   • Cleanup: 2:00 AM IST');
  console.log('   • Hourly aggregation: Every hour');
}
