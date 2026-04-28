// ============================================================
// Email Service — Daily Report Sender
// ============================================================
// Generates HTML email reports and sends via SendGrid or SES.
// Triggered by cron job at 6 PM daily.
// ============================================================

export class EmailService {
  constructor(config = {}) {
    this.provider = config.provider || 'sendgrid'; // 'sendgrid' | 'ses'
    this.apiKey = config.apiKey || process.env.SENDGRID_API_KEY;
    this.fromEmail = config.fromEmail || 'noreply@empmonitor.com';
    this.fromName = config.fromName || 'EmpMonitor Reports';
  }

  // ─── GENERATE HTML REPORT EMAIL ───────────────────────────
  generateReportHtml(report) {
    const formatTime = (seconds) => {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      return `${h}h ${m}m`;
    };

    const prodColor = report.productivityScore >= 70 ? '#10b981' :
                      report.productivityScore >= 50 ? '#f59e0b' : '#ef4444';

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif;color:#f1f5f9;">
  <div style="max-width:600px;margin:0 auto;padding:24px;">
    
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#a78bfa);border-radius:12px;padding:32px;text-align:center;margin-bottom:24px;">
      <h1 style="margin:0;font-size:24px;color:#fff;">📊 Daily Activity Report</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:14px;">${report.date} — ${report.employee?.name || 'Employee'}</p>
    </div>
    
    <!-- Productivity Score -->
    <div style="background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:24px;text-align:center;margin-bottom:16px;">
      <p style="margin:0;font-size:13px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Productivity Score</p>
      <p style="margin:8px 0;font-size:48px;font-weight:800;color:${prodColor};">${report.productivityScore}%</p>
    </div>

    <!-- Time Summary -->
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <div style="flex:1;background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">TOTAL ACTIVE</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;">${formatTime(report.totalActiveTime)}</p>
      </div>
      <div style="flex:1;background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#10b981;">PRODUCTIVE</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#10b981;">${formatTime(report.productiveTime)}</p>
      </div>
      <div style="flex:1;background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:16px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#ef4444;">IDLE</p>
        <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ef4444;">${formatTime(report.idleTime)}</p>
      </div>
    </div>

    <!-- Work Hours -->
    <div style="background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#94a3b8;">⏰ Work Hours</h3>
      <p style="margin:0;font-size:14px;">
        Login: <strong>${report.loginTime || '—'}</strong> &nbsp;|&nbsp; 
        Logout: <strong>${report.logoutTime || '—'}</strong>
      </p>
    </div>

    <!-- Top Apps -->
    <div style="background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#94a3b8;">📱 Top Applications</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${(report.topApps || []).map((app, i) => `
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#f1f5f9;">${i + 1}. ${app.name}</td>
            <td style="padding:6px 0;font-size:13px;color:#94a3b8;text-align:right;">${formatTime(app.duration)}</td>
          </tr>
        `).join('')}
      </table>
    </div>

    <!-- Top URLs -->
    ${(report.topUrls && report.topUrls.length > 0) ? `
    <div style="background:#1a2035;border:1px solid #2a3555;border-radius:12px;padding:20px;margin-bottom:16px;">
      <h3 style="margin:0 0 12px;font-size:14px;color:#94a3b8;">🌐 Top Websites</h3>
      <table style="width:100%;border-collapse:collapse;">
        ${report.topUrls.map((u, i) => `
          <tr>
            <td style="padding:6px 0;font-size:13px;color:#f1f5f9;">${i + 1}. ${u.url}</td>
            <td style="padding:6px 0;font-size:13px;color:#94a3b8;text-align:right;">${formatTime(u.duration)}</td>
          </tr>
        `).join('')}
      </table>
    </div>
    ` : ''}

    <!-- Footer -->
    <div style="text-align:center;padding:20px;font-size:12px;color:#64748b;">
      <p>Generated by EmpMonitor at ${new Date().toLocaleString('en-IN')}</p>
      <p>This is an automated report. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
  }

  // ─── SEND EMAIL (SendGrid) ────────────────────────────────
  async sendViaSendGrid(to, subject, htmlContent) {
    if (!this.apiKey) {
      console.warn('⚠️ SendGrid API key not configured — email skipped');
      return false;
    }

    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: this.fromEmail, name: this.fromName },
          subject,
          content: [{ type: 'text/html', value: htmlContent }],
        }),
      });

      if (res.status === 202) {
        console.log(`📧 Email sent to ${to}: ${subject}`);
        return true;
      } else {
        console.error(`❌ SendGrid error: ${res.status}`);
        return false;
      }
    } catch (err) {
      console.error('❌ Email send error:', err.message);
      return false;
    }
  }

  // ─── SEND DAILY REPORTS TO ALL EMPLOYEES ──────────────────
  async sendDailyReports(reports, employees) {
    console.log(`\n📧 Sending daily reports to ${reports.length} employees...`);
    let sent = 0;

    for (const report of reports) {
      if (!report.employee?.email) continue;

      const subject = `📊 Daily Report — ${report.date} | Productivity: ${report.productivityScore}%`;
      const html = this.generateReportHtml(report);

      const success = await this.sendViaSendGrid(report.employee.email, subject, html);
      if (success) sent++;
    }

    console.log(`✅ Sent ${sent}/${reports.length} daily reports\n`);
    return sent;
  }

  // ─── SEND ADMIN SUMMARY ──────────────────────────────────
  async sendAdminSummary(reports, adminEmail) {
    const avgScore = reports.length > 0
      ? Math.round(reports.reduce((s, r) => s + r.productivityScore, 0) / reports.length)
      : 0;

    const subject = `📊 Team Summary — ${reports[0]?.date || 'Today'} | Avg: ${avgScore}%`;
    const html = `
<div style="font-family:Arial;max-width:600px;margin:0 auto;padding:24px;background:#0a0e1a;color:#f1f5f9;">
  <h2>📊 Team Daily Summary</h2>
  <p>Average Productivity: <strong style="color:${avgScore>=70?'#10b981':'#f59e0b'}">${avgScore}%</strong></p>
  <table style="width:100%;border-collapse:collapse;margin-top:16px;">
    <tr style="background:#1a2035;"><th style="padding:8px;text-align:left;font-size:12px;color:#94a3b8;">Employee</th><th style="padding:8px;text-align:right;font-size:12px;color:#94a3b8;">Score</th></tr>
    ${reports.map(r => `<tr><td style="padding:8px;font-size:13px;">${r.employee?.name||r.deviceId}</td><td style="padding:8px;text-align:right;font-weight:700;color:${r.productivityScore>=70?'#10b981':r.productivityScore>=50?'#f59e0b':'#ef4444'}">${r.productivityScore}%</td></tr>`).join('')}
  </table>
</div>`;

    return this.sendViaSendGrid(adminEmail, subject, html);
  }
}
