import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export default function Reports({ apiBase }) {
  const [reports, setReports] = useState([]);
  const [weekly, setWeekly] = useState([]);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetch(`${apiBase}/api/reports/daily?date=${date}`).then(r=>r.json()).then(setReports);
    fetch(`${apiBase}/api/reports/weekly`).then(r=>r.json()).then(setWeekly);
  }, [apiBase, date]);

  const formatDuration = (s) => { const h=Math.floor(s/3600); const m=Math.floor((s%3600)/60); return `${h}h ${m}m`; };
  // Aggregate for pie chart
  const totals = reports.reduce((acc,r) => {
    acc.productive += r.productiveTime ?? r.productive_time ?? 0;
    acc.unproductive += r.unproductiveTime ?? r.unproductive_time ?? 0;
    acc.idle += r.idleTime ?? r.idle_time ?? 0;
    return acc;
  }, { productive:0, unproductive:0, idle:0 });

  const pieData = [
    { name:'Productive', value:totals.productive, color:'#10b981' },
    { name:'Unproductive', value:totals.unproductive, color:'#ef4444' },
    { name:'Idle', value:totals.idle, color:'#f59e0b' },
  ];

  // Weekly trend by date
  const weeklyByDate = {};
  weekly.forEach(r => {
    if (!weeklyByDate[r.date]) weeklyByDate[r.date] = { date:r.date, productivity:[], hours:[] };
    weeklyByDate[r.date].productivity.push(r.productivityScore ?? r.productivity_score ?? 0);
    weeklyByDate[r.date].hours.push((r.totalActiveTime ?? r.total_active_time ?? 0)/3600);
  });
  const weeklyTrend = Object.values(weeklyByDate).map(d => ({
    date: d.date, avgProd: Math.round(d.productivity.reduce((a,b)=>a+b,0)/d.productivity.length),
    avgHours: +(d.hours.reduce((a,b)=>a+b,0)/d.hours.length).toFixed(1),
  })).sort((a,b)=>a.date.localeCompare(b.date));

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><div><h2>📄 Reports</h2><p>Daily & weekly productivity analysis</p></div></div>
        <div className="topbar-right">
          <input type="date" className="date-input" value={date} onChange={e=>setDate(e.target.value)} />
        </div>
      </div>
      <div className="page-content">
        {/* Summary Cards */}
        <div className="stats-grid mb-28">
          <div className="stat-card">
            <div className="stat-icon green">✅</div>
            <div className="stat-value">{formatDuration(totals.productive)}</div>
            <div className="stat-label">Total Productive Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon red">❌</div>
            <div className="stat-value">{formatDuration(totals.unproductive)}</div>
            <div className="stat-label">Total Unproductive</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">💤</div>
            <div className="stat-value">{formatDuration(totals.idle)}</div>
            <div className="stat-label">Total Idle Time</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">📊</div>
            <div className="stat-value">
              {reports.length > 0
                ? Math.round(reports.reduce((s,r)=>s+(r.productivityScore ?? r.productivity_score ?? 0),0)/reports.length)
                : 0}%
            </div>
            <div className="stat-label">Avg Productivity Score</div>
          </div>
        </div>

        <div className="grid-2 mb-28">
          {/* Pie Chart */}
          <div className="card">
            <div className="card-header"><h3>📊 Time Distribution</h3></div>
            <div className="card-body">
              <div className="chart-container" style={{height:280}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={3} label={({name,percent})=>`${name} ${(percent*100).toFixed(0)}%`}>
                      {pieData.map((entry,i)=><Cell key={i} fill={entry.color}/>)}
                    </Pie>
                    <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3555',borderRadius:8,fontSize:12}} formatter={(v)=>formatDuration(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="card">
            <div className="card-header"><h3>📈 Weekly Trend</h3></div>
            <div className="card-body">
              <div className="chart-container" style={{height:280}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weeklyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3555"/>
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={v=>v.slice(5)}/>
                    <YAxis stroke="#64748b" fontSize={11}/>
                    <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3555',borderRadius:8,fontSize:12}}/>
                    <Bar dataKey="avgProd" fill="#6366f1" radius={[4,4,0,0]} name="Productivity %"/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Employee Reports Table */}
        <div className="card">
          <div className="card-header"><h3>👥 Employee Reports — {date}</h3></div>
          <div className="card-body" style={{padding:0}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Login</th>
                  <th>Logout</th>
                  <th>Active Time</th>
                  <th>Productivity</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => (
                  <tr key={r.id}>
                    <td style={{fontWeight:600,color:'var(--text-primary)'}}>{r.employeeName || r.employee_name || r.deviceId || r.device_id}</td>
                    <td>{r.department||'—'}</td>
                    <td style={{fontSize:12}}>{r.loginTime || r.login_time || '—'}</td>
                    <td style={{fontSize:12}}>{r.logoutTime || r.logout_time || '—'}</td>
                    <td>{formatDuration(r.totalActiveTime ?? r.total_active_time ?? 0)}</td>
                    <td style={{width:180}}>
                      {(() => {
                        const score = r.productivityScore ?? r.productivity_score ?? 0;
                        const totalActive = r.totalActiveTime ?? r.total_active_time ?? 0;
                        const idle = r.idleTime ?? r.idle_time ?? 0;
                        const idlePct = totalActive > 0 ? (idle / totalActive * 100) : 0;
                        const unprodPct = Math.max(0, 100 - score - idlePct);
                        return (
                      <div className="productivity-bar" style={{height:8}}>
                        <div className="segment" style={{width:`${score}%`,background:'var(--productive)'}}/>
                        <div className="segment" style={{width:`${unprodPct}%`,background:'var(--unproductive)'}}/>
                        <div className="segment" style={{width:`${idlePct}%`,background:'var(--idle)'}}/>
                      </div>
                        );
                      })()}
                    </td>
                    <td>
                      {(() => {
                        const score = r.productivityScore ?? r.productivity_score ?? 0;
                        return (
                      <span style={{fontWeight:700,color:score>=70?'var(--productive)':score>=50?'var(--warning)':'var(--danger)'}}>
                        {score}%
                      </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
