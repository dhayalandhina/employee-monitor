# EmpMonitor — Employee Monitoring System

Production-ready employee monitoring platform with real-time tracking, screenshot capture, timeline replay, productivity analytics, and automated daily reports.

## 🏗️ Architecture

```
[Windows Agent (Electron)]
    ↓ (every 30s)
[Backend API (Express + Node.js)]
    ↓
[Processing Engine (Cron Jobs)]
    ↓
[Storage: PostgreSQL + S3]
    ↓
[Admin Dashboard (React + Vite)]  ←  [Email Service (SendGrid)]
```

## 📁 Project Structure

```
employee-monitor/
├── agent/                    # Windows Desktop Agent (Electron)
│   ├── src/
│   │   ├── main.js          # Electron main process
│   │   ├── tracker.js       # App/window activity tracker
│   │   ├── screenshot.js    # Screenshot capture engine
│   │   ├── idle.js          # Idle time detector
│   │   ├── queue.js         # Offline event queue
│   │   ├── uploader.js      # API data uploader
│   │   └── config.js        # Agent configuration
│   └── package.json         # Electron build config
│
├── server/                   # Backend API
│   ├── index.js             # Express server + all API routes
│   ├── cron/
│   │   ├── processing.js    # Sessionizer, aggregator, reports
│   │   └── scheduler.js     # Cron job orchestrator
│   └── email/
│       └── service.js       # Email templates + SendGrid
│
├── src/                      # Admin Dashboard (React)
│   ├── App.jsx              # Root with routing
│   ├── index.css            # Design system
│   ├── components/
│   │   └── Layout.jsx       # Sidebar + navigation
│   └── pages/
│       ├── Login.jsx        # Auth page
│       ├── Dashboard.jsx    # Stats + charts overview
│       ├── Devices.jsx      # Device management
│       ├── Timeline.jsx     # Activity timeline replay
│       ├── Screenshots.jsx  # Screenshot gallery
│       ├── Reports.jsx      # Productivity reports
│       └── LiveView.jsx     # Real-time monitoring
│
└── package.json
```

## 🚀 Quick Start

### 1. Start Backend API
```bash
node server/index.js
# → API on http://localhost:3001
```

### 2. Start Dashboard
```bash
npm run dev
# → Dashboard on http://localhost:5173
```

### 3. Login
```
Email: admin@company.com
Password: admin123
```

## 🖥️ Building the Windows Agent

```bash
cd agent
npm install
npm run build          # Creates installer (.exe)
npm run build:portable # Creates portable version
```

## ⚙️ Environment Variables

```env
PORT=3001
SENDGRID_API_KEY=your-key
ADMIN_EMAIL=admin@company.com
EMAIL_FROM=noreply@empmonitor.com
```

## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Admin login |
| GET | `/api/devices` | List all devices |
| POST | `/api/devices/register` | Register new agent |
| POST | `/api/devices/:id/heartbeat` | Agent heartbeat |
| POST | `/api/activity` | Submit activity events |
| GET | `/api/activity/:deviceId` | Get device timeline |
| POST | `/api/screenshots` | Upload screenshot |
| GET | `/api/screenshots/:deviceId` | Get device screenshots |
| GET | `/api/reports/daily` | Daily reports |
| GET | `/api/reports/weekly` | Weekly trends |
| GET | `/api/dashboard/stats` | Dashboard stats |
| GET | `/api/dashboard/trends` | Productivity trends |
| GET | `/api/employees` | Employee list |

## 📅 Cron Schedule

| Job | Time | Description |
|-----|------|-------------|
| Daily Report | 6:00 PM IST | Generate & email reports |
| Cleanup | 2:00 AM IST | Delete screenshots > 7 days |
| Aggregation | Every hour | Update daily summaries |
