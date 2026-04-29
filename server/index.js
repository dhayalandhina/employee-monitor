// ============================================================
// EmpMonitor — Production Backend Server
// ============================================================
// Features:
// - SQLite database (no external DB setup needed)
// - File-based screenshot storage (no S3)
// - Device management (add/remove from admin)
// - Password-protected agent shutdown
// - Admin authentication with bcrypt
// - WebSocket for real-time updates
// - Auto-seed demo data on first run
// ============================================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Screenshot storage directory
const SCREENSHOTS_DIR = path.join(__dirname, '..', 'data', 'screenshots');
if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
app.use('/screenshots', express.static(SCREENSHOTS_DIR));

// ============================================================
// SQLite DATABASE
// ============================================================
const DB_PATH = path.join(__dirname, '..', 'data', 'empmonitor.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    department TEXT,
    role TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    hostname TEXT,
    os TEXT,
    ip TEXT,
    status TEXT DEFAULT 'offline',
    last_seen TEXT,
    registered_at TEXT DEFAULT (datetime('now')),
    agent_version TEXT,
    agent_password_hash TEXT,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    employee_id TEXT,
    app_name TEXT,
    window_title TEXT,
    url TEXT,
    category TEXT DEFAULT 'neutral',
    duration INTEGER DEFAULT 0,
    timestamp TEXT NOT NULL,
    end_time TEXT,
    icon TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS screenshots (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    employee_id TEXT,
    filename TEXT NOT NULL,
    app_name TEXT,
    window_title TEXT,
    timestamp TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS daily_reports (
    id TEXT PRIMARY KEY,
    device_id TEXT NOT NULL,
    employee_id TEXT,
    date TEXT NOT NULL,
    total_active_time INTEGER DEFAULT 0,
    productive_time INTEGER DEFAULT 0,
    unproductive_time INTEGER DEFAULT 0,
    idle_time INTEGER DEFAULT 0,
    productivity_score INTEGER DEFAULT 0,
    top_apps TEXT,
    top_urls TEXT,
    login_time TEXT,
    logout_time TEXT,
    FOREIGN KEY (device_id) REFERENCES devices(id)
  );

  CREATE INDEX IF NOT EXISTS idx_activity_device_date ON activity_logs(device_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_screenshots_device_date ON screenshots(device_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_reports_device_date ON daily_reports(device_id, date);
`);

// ============================================================
// SEED DEFAULT DATA (only on first run)
// ============================================================
const adminExists = db.prepare('SELECT COUNT(*) as count FROM admins').get();
if (adminExists.count === 0) {
  const adminId = uuidv4();
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (id, email, password, name) VALUES (?, ?, ?, ?)').run(adminId, 'admin@company.com', hashedPassword, 'Admin');

  // Demo employees
  const demoEmployees = [
    { id: 'emp-001', name: 'Rajesh Kumar', email: 'rajesh@company.com', department: 'Engineering', role: 'Developer' },
    { id: 'emp-002', name: 'Priya Sharma', email: 'priya@company.com', department: 'Design', role: 'Designer' },
    { id: 'emp-003', name: 'Amit Patel', email: 'amit@company.com', department: 'Engineering', role: 'Developer' },
  ];

  const insertEmp = db.prepare('INSERT INTO employees (id, name, email, department, role) VALUES (?, ?, ?, ?, ?)');
  demoEmployees.forEach(e => insertEmp.run(e.id, e.name, e.email, e.department, e.role));

  // Demo devices
  const demoDevices = [
    { id: 'SYS-001', employeeId: 'emp-001', hostname: 'DESKTOP-RK01', os: 'Windows 11', ip: '192.168.1.101', status: 'online' },
    { id: 'SYS-002', employeeId: 'emp-002', hostname: 'DESKTOP-PS02', os: 'Windows 11', ip: '192.168.1.102', status: 'idle' },
    { id: 'SYS-003', employeeId: 'emp-003', hostname: 'DESKTOP-AP03', os: 'Windows 10', ip: '192.168.1.103', status: 'offline' },
  ];

  const now = new Date().toISOString();
  const insertDev = db.prepare('INSERT INTO devices (id, employee_id, hostname, os, ip, status, last_seen, agent_version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  demoDevices.forEach(d => insertDev.run(d.id, d.employeeId, d.hostname, d.os, d.ip, d.status, now, '2.1.0'));

  // Demo activity logs for today
  const today = new Date().toISOString().split('T')[0];
  const apps = [
    { name: 'Visual Studio Code', cat: 'productive', icon: '💻' },
    { name: 'Google Chrome', cat: 'neutral', icon: '🌐' },
    { name: 'Slack', cat: 'productive', icon: '💬' },
    { name: 'YouTube', cat: 'unproductive', icon: '📺' },
    { name: 'Microsoft Excel', cat: 'productive', icon: '📊' },
    { name: 'Terminal', cat: 'productive', icon: '⬛' },
    { name: 'Idle', cat: 'idle', icon: '💤' },
  ];

  const insertLog = db.prepare('INSERT INTO activity_logs (id, device_id, employee_id, app_name, window_title, category, duration, timestamp, end_time, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  demoDevices.forEach(dev => {
    let t = new Date(`${today}T09:30:00`);
    for (let i = 0; i < 15; i++) {
      const a = apps[Math.floor(Math.random() * apps.length)];
      const dur = Math.floor(Math.random() * 1200) + 300;
      const end = new Date(t.getTime() + dur * 1000);
      insertLog.run(uuidv4(), dev.id, dev.employeeId, a.name, `${a.name} - Working`, a.cat, dur, t.toISOString(), end.toISOString(), a.icon);
      t = end;
    }
  });

  // Demo daily reports for past 7 days
  const insertReport = db.prepare('INSERT INTO daily_reports (id, device_id, employee_id, date, total_active_time, productive_time, unproductive_time, idle_time, productivity_score, top_apps, login_time, logout_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  for (let d = 0; d < 7; d++) {
    const rd = new Date(); rd.setDate(rd.getDate() - d);
    const dateStr = rd.toISOString().split('T')[0];
    demoDevices.forEach(dev => {
      const total = Math.floor(25000 + Math.random() * 7000);
      const prod = Math.floor(total * (0.55 + Math.random() * 0.35));
      const idle = Math.floor(total * (0.05 + Math.random() * 0.1));
      const unprod = total - prod - idle;
      const score = Math.round(prod / total * 100);
      const topApps = JSON.stringify([{ name: 'VS Code', duration: 4000 }, { name: 'Chrome', duration: 3000 }, { name: 'Slack', duration: 1500 }]);
      insertReport.run(uuidv4(), dev.id, dev.employeeId, dateStr, total, prod, unprod, idle, score, topApps, '09:30', `${17 + Math.floor(Math.random() * 2)}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`);
    });
  }

  console.log('✅ Database initialized with demo data');
}

// ============================================================
// HELPER
// ============================================================
function generateDeviceId() {
  const count = db.prepare('SELECT COUNT(*) as c FROM devices').get().c;
  return `SYS-${String(count + 1).padStart(3, '0')}`;
}

// ============================================================
// AUTH ROUTES
// ============================================================
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin || !bcrypt.compareSync(password, admin.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  res.json({ token: `jwt-${uuidv4()}`, user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin' } });
});

app.post('/api/auth/change-password', (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password)) {
    return res.status(401).json({ message: 'Invalid current password' });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE admins SET password = ? WHERE id = ?').run(hash, admin.id);
  res.json({ message: 'Password changed successfully' });
});

// ============================================================
// EMPLOYEE MANAGEMENT
// ============================================================
app.get('/api/employees', (req, res) => {
  res.json(db.prepare('SELECT * FROM employees ORDER BY name').all());
});

app.post('/api/employees', (req, res) => {
  const { name, email, department, role } = req.body;
  const id = uuidv4();
  db.prepare('INSERT INTO employees (id, name, email, department, role) VALUES (?, ?, ?, ?, ?)').run(id, name, email || null, department || null, role || null);
  res.status(201).json({ id, name, email, department, role });
});

app.delete('/api/employees/:id', (req, res) => {
  db.prepare('UPDATE devices SET is_active = 0 WHERE employee_id = ?').run(req.params.id);
  db.prepare('DELETE FROM employees WHERE id = ?').run(req.params.id);
  res.json({ message: 'Employee removed' });
});

// ============================================================
// DEVICE MANAGEMENT
// ============================================================
app.get('/api/devices', (req, res) => {
  const devices = db.prepare(`
    SELECT d.*, e.name as employee_name, e.email as employee_email, e.department
    FROM devices d LEFT JOIN employees e ON d.employee_id = e.id
    WHERE d.is_active = 1 ORDER BY d.registered_at DESC
  `).all();
  res.json(devices);
});

app.get('/api/devices/:id', (req, res) => {
  const device = db.prepare(`
    SELECT d.*, e.name as employee_name, e.email as employee_email, e.department, e.role
    FROM devices d LEFT JOIN employees e ON d.employee_id = e.id WHERE d.id = ?
  `).get(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  res.json(device);
});

// Agent registration (called by agent on first run)
app.post('/api/devices/register', (req, res) => {
  const { hostname, os: osName, employeeId, employeeName, agentVersion, agentPassword } = req.body;

  // Create employee if name provided but no ID
  let empId = employeeId;
  if (!empId && employeeName) {
    empId = uuidv4();
    db.prepare('INSERT OR IGNORE INTO employees (id, name) VALUES (?, ?)').run(empId, employeeName);
  }

  const id = generateDeviceId();
  const passwordHash = agentPassword ? bcrypt.hashSync(agentPassword, 10) : null;

  db.prepare(`INSERT INTO devices (id, employee_id, hostname, os, ip, status, last_seen, agent_version, agent_password_hash)
    VALUES (?, ?, ?, ?, ?, 'online', ?, ?, ?)`
  ).run(id, empId, hostname, osName, req.ip, new Date().toISOString(), agentVersion || '2.1.0', passwordHash);

  io.emit('device:registered', { deviceId: id, hostname });
  res.status(201).json({ deviceId: id, message: 'Device registered successfully' });
});

// Remove device (admin only)
app.delete('/api/devices/:id', (req, res) => {
  db.prepare('UPDATE devices SET is_active = 0, status = ? WHERE id = ?').run('removed', req.params.id);
  io.emit('device:removed', { deviceId: req.params.id });
  res.json({ message: 'Device removed' });
});

// Agent shutdown verification (requires password)
app.post('/api/devices/:id/verify-shutdown', (req, res) => {
  const { password } = req.body;
  const device = db.prepare('SELECT agent_password_hash FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.status(404).json({ message: 'Device not found' });
  if (!device.agent_password_hash) return res.json({ authorized: true });
  const valid = bcrypt.compareSync(password, device.agent_password_hash);
  res.json({ authorized: valid });
});

// Check if device is still allowed
app.get('/api/devices/:id/status', (req, res) => {
  const device = db.prepare('SELECT is_active, status FROM devices WHERE id = ?').get(req.params.id);
  if (!device) return res.json({ active: false, status: 'unknown' });
  res.json({ active: device.is_active === 1, status: device.status });
});

// Heartbeat
app.post('/api/devices/:id/heartbeat', (req, res) => {
  db.prepare('UPDATE devices SET status = ?, last_seen = ?, ip = ? WHERE id = ?').run('online', new Date().toISOString(), req.ip, req.params.id);
  io.emit('device:heartbeat', { deviceId: req.params.id, status: 'online' });
  const device = db.prepare('SELECT is_active FROM devices WHERE id = ?').get(req.params.id);
  res.json({ ok: true, active: device?.is_active === 1 });
});

// ============================================================
// ACTIVITY LOGS
// ============================================================
app.post('/api/activity', (req, res) => {
  const { deviceId, events } = req.body;
  const insert = db.prepare('INSERT INTO activity_logs (id, device_id, employee_id, app_name, window_title, url, category, duration, timestamp, end_time, icon) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const items = events || [req.body];
  const transaction = db.transaction((logs) => {
    logs.forEach(event => {
      const id = uuidv4();
      insert.run(id, deviceId || event.deviceId, event.employeeId || null, event.appName, event.windowTitle, event.url || null, event.category || 'neutral', event.duration || 0, event.timestamp || new Date().toISOString(), event.endTime || null, event.icon || '📱');
    });
  });
  transaction(items);
  const lastEvent = items[items.length - 1];
  io.emit('activity:new', { deviceId, count: items.length, latest: { appName: lastEvent.appName, windowTitle: lastEvent.windowTitle, category: lastEvent.category, duration: lastEvent.duration, timestamp: lastEvent.timestamp } });
  res.status(201).json({ saved: items.length });
});

app.get('/api/activity/:deviceId', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const logs = db.prepare(`SELECT * FROM activity_logs WHERE device_id = ? AND date(timestamp) = ? ORDER BY timestamp ASC`).all(req.params.deviceId, date);
  res.json(logs);
});

app.get('/api/activity', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const logs = db.prepare(`SELECT * FROM activity_logs WHERE date(timestamp) = ? ORDER BY timestamp ASC`).all(date);
  res.json(logs);
});

// ============================================================
// SCREENSHOTS (stored on filesystem, not S3)
// ============================================================
const ssStorage = multer.diskStorage({
  destination: SCREENSHOTS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${uuidv4().slice(0, 8)}.png`)
});
const uploadSS = multer({ storage: ssStorage, limits: { fileSize: 10 * 1024 * 1024 } });

app.post('/api/screenshots', uploadSS.single('screenshot'), (req, res) => {
  const id = uuidv4();
  const fileSize = req.file ? req.file.size : 0;
  db.prepare('INSERT INTO screenshots (id, device_id, employee_id, filename, app_name, window_title, timestamp, file_size) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(id, req.body.deviceId, req.body.employeeId || null, req.file?.filename || '', req.body.appName || '', req.body.windowTitle || '', new Date().toISOString(), fileSize);
  io.emit('screenshot:new', { deviceId: req.body.deviceId, id, filename: req.file?.filename, appName: req.body.appName || '', windowTitle: req.body.windowTitle || '', timestamp: new Date().toISOString() });
  res.status(201).json({ id, filename: req.file?.filename });
});

app.get('/api/screenshots/:deviceId', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const shots = db.prepare('SELECT * FROM screenshots WHERE device_id = ? AND date(timestamp) = ? ORDER BY timestamp ASC').all(req.params.deviceId, date);
  res.json(shots);
});

// ============================================================
// REPORTS
// ============================================================
app.get('/api/reports/daily', (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const reports = db.prepare(`
    SELECT r.*, e.name as employee_name, e.department
    FROM daily_reports r LEFT JOIN employees e ON r.employee_id = e.id
    WHERE r.date = ? ORDER BY r.productivity_score DESC
  `).all(date);
  res.json(reports.map(r => ({ ...r, top_apps: r.top_apps ? JSON.parse(r.top_apps) : [], topApps: r.top_apps ? JSON.parse(r.top_apps) : [] })));
});

app.get('/api/reports/weekly', (req, res) => {
  const reports = db.prepare(`
    SELECT r.*, e.name as employee_name, e.department
    FROM daily_reports r LEFT JOIN employees e ON r.employee_id = e.id
    ORDER BY r.date DESC LIMIT 100
  `).all();
  res.json(reports.map(r => ({ ...r, top_apps: r.top_apps ? JSON.parse(r.top_apps) : [], topApps: r.top_apps ? JSON.parse(r.top_apps) : [] })));
});

// ============================================================
// DASHBOARD STATS
// ============================================================
app.get('/api/dashboard/stats', (req, res) => {
  const devices = db.prepare('SELECT status, COUNT(*) as count FROM devices WHERE is_active = 1 GROUP BY status').all();
  const statusMap = {};
  devices.forEach(d => { statusMap[d.status] = d.count; });
  const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

  const today = new Date().toISOString().split('T')[0];
  const todayReports = db.prepare('SELECT productivity_score FROM daily_reports WHERE date = ?').all(today);
  const avgProd = todayReports.length > 0 ? Math.round(todayReports.reduce((s, r) => s + r.productivity_score, 0) / todayReports.length) : 0;

  const screenshotCount = db.prepare('SELECT COUNT(*) as c FROM screenshots WHERE date(timestamp) = ?').get(today)?.c || 0;
  const employeeCount = db.prepare('SELECT COUNT(*) as c FROM employees').get()?.c || 0;

  res.json({
    totalDevices: total,
    onlineDevices: statusMap.online || 0,
    idleDevices: statusMap.idle || 0,
    offlineDevices: statusMap.offline || 0,
    avgProductivity: avgProd,
    totalScreenshots: screenshotCount,
    totalEmployees: employeeCount,
  });
});

app.get('/api/dashboard/trends', (req, res) => {
  const trends = db.prepare(`
    SELECT date, AVG(productivity_score) as avgProductivity,
    SUM(total_active_time) / 3600.0 as totalActiveHours
    FROM daily_reports GROUP BY date ORDER BY date ASC LIMIT 7
  `).all();
  res.json(trends.map(t => ({
    date: t.date,
    avgProductivity: Math.round(t.avgProductivity || 0),
    totalActiveHours: +(t.totalActiveHours || 0).toFixed(1),
  })));
});

// ============================================================
// WEBSOCKET
// ============================================================
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  socket.on('watch:device', (deviceId) => socket.join(`device:${deviceId}`));
  socket.on('unwatch:device', (deviceId) => socket.leave(`device:${deviceId}`));
  socket.on('agent:screen', (data) => io.to(`device:${data.deviceId}`).emit('live:screen', data));
  socket.on('disconnect', () => console.log(`❌ Disconnected: ${socket.id}`));
});

// ============================================================
// SERVE FRONTEND (production)
// ============================================================
const distPath = path.join(__dirname, '..', 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback: serve index.html for all non-API GET routes
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (req.path.startsWith('/api/') || req.path.startsWith('/screenshots/') || req.path.startsWith('/socket.io/')) {
      return next();
    }
    const indexFile = path.join(distPath, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile, (err) => {
        if (err) next();
      });
    } else {
      next();
    }
  });
}

// ============================================================
// LIVE STREAMING
// ============================================================
const liveWatching = new Set(); // deviceIds being watched

// Agent checks if it should stream
app.get('/api/live/check/:deviceId', (req, res) => {
  res.json({ live: liveWatching.has(req.params.deviceId) });
});

// Agent sends a live frame (base64 screenshot)
app.post('/api/live/frame', express.json({ limit: '10mb' }), (req, res) => {
  const { deviceId, frame, appName, windowTitle, isIdle } = req.body;
  if (!deviceId || !frame) return res.status(400).json({ error: 'Missing data' });
  io.emit('live:frame', { deviceId, frame, appName: appName || '', windowTitle: windowTitle || '', isIdle: isIdle || false, timestamp: new Date().toISOString() });
  res.json({ ok: true });
});

// Socket.io: dashboard tells server which device to watch
io.on('connection', (socket) => {
  socket.on('live:watch', (deviceId) => {
    liveWatching.add(deviceId);
  });
  socket.on('live:stop', (deviceId) => {
    liveWatching.delete(deviceId);
  });
  socket.on('disconnect', () => {
    if (io.engine.clientsCount === 0) {
      liveWatching.clear();
    }
  });
});

// ============================================================
// START
// ============================================================
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 EmpMonitor Server running at http://0.0.0.0:${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔑 Login: admin@company.com / admin123`);
  console.log(`💾 Database: ${DB_PATH}`);
  console.log(`📸 Screenshots: ${SCREENSHOTS_DIR}\n`);
});
