import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Dashboard({ apiBase }) {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState([]);
  const [devices, setDevices] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      fetch(`${apiBase}/api/dashboard/stats`).then(r=>r.json()),
      fetch(`${apiBase}/api/dashboard/trends`).then(r=>r.json()),
      fetch(`${apiBase}/api/devices`).then(r=>r.json()),
    ]).then(([s,t,d]) => {
      setStats(s); setTrends(t); setDevices(d);
    }).catch(console.error);
  }, [apiBase]);

  const pieData = stats ? [
    { name:'Online', value:stats.onlineDevices, color:'#10b981' },
    { name:'Idle', value:stats.idleDevices, color:'#f59e0b' },
    { name:'Offline', value:stats.offlineDevices, color:'#ef4444' },
  ] : [];

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div><h2>Dashboard</h2><p>Real-time employee monitoring overview</p></div>
        </div>
        <div className="topbar-right">
          <span style={{fontSize:13,color:'var(--text-muted)'}}>
            {new Date().toLocaleDateString('en-IN',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}
          </span>
        </div>
      </div>
      <div className="page-content">
        {/* Stats Cards */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon green">🖥️</div>
            <div className="stat-value">{stats?.onlineDevices || 0}<span style={{fontSize:16,color:'var(--text-muted)'}}>/{stats?.totalDevices || 0}</span></div>
            <div className="stat-label">Online Devices</div>
            <div className="stat-change up">↑ Active now</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon purple">📈</div>
            <div className="stat-value">{stats?.avgProductivity || 0}%</div>
            <div className="stat-label">Avg Productivity</div>
            <div className="stat-change up">↑ +3% from yesterday</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon blue">👥</div>
            <div className="stat-value">{stats?.totalEmployees || 0}</div>
            <div className="stat-label">Total Employees</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon yellow">📸</div>
            <div className="stat-value">{stats?.totalScreenshots || 0}</div>
            <div className="stat-label">Screenshots Today</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid-2-1 mb-28">
          <div className="card">
            <div className="card-header"><h3>📊 Productivity Trend (7 Days)</h3></div>
            <div className="card-body">
              <div className="chart-container">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trends}>
                    <defs>
                      <linearGradient id="colorProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#2a3555" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={v=>v.slice(5)} />
                    <YAxis stroke="#64748b" fontSize={11} domain={[0,100]} />
                    <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3555',borderRadius:8,fontSize:12}} />
                    <Area type="monotone" dataKey="avgProductivity" stroke="#6366f1" fill="url(#colorProd)" strokeWidth={2} name="Productivity %" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>🟢 Device Status</h3></div>
            <div className="card-body">
              <div className="chart-container" style={{height:200}}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={4}>
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Legend formatter={(v)=>v} wrapperStyle={{fontSize:12}} />
                    <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3555',borderRadius:8,fontSize:12}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Active Hours Chart */}
        <div className="card mb-28">
          <div className="card-header"><h3>⏰ Active Hours (7 Days)</h3></div>
          <div className="card-body">
            <div className="chart-container" style={{height:250}}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a3555" />
                  <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={v=>v.slice(5)} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip contentStyle={{background:'#1a2035',border:'1px solid #2a3555',borderRadius:8,fontSize:12}} />
                  <Bar dataKey="totalActiveHours" fill="#6366f1" radius={[6,6,0,0]} name="Active Hours" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Devices Table */}
        <div className="card">
          <div className="card-header">
            <h3>🖥️ Active Devices</h3>
            <button className="btn btn-secondary btn-sm" onClick={()=>navigate('/devices')}>View All →</button>
          </div>
          <div className="card-body" style={{padding:0}}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Status</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {devices.slice(0,5).map(dev => (
                    <tr key={dev.id}>
                      <td>
                        <div className="device-cell">
                          <div className="device-icon">🖥️</div>
                          <div className="device-info">
                            <span className="name">{dev.id}</span>
                            <span className="sub">{dev.hostname} · {dev.os}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{color:'var(--text-primary)',fontWeight:500}}>{dev.employee_name || dev.employeeName || '—'}</td>
                      <td>{dev.department || '—'}</td>
                      <td><span className={`status-badge ${dev.status}`}>{dev.status}</span></td>
                      <td style={{fontSize:12,color:'var(--text-muted)'}}>
                        {dev.last_seen || dev.lastSeen
                          ? new Date(dev.last_seen || dev.lastSeen).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})
                          : '—'}
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn-icon" title="Timeline" onClick={()=>navigate(`/timeline/${dev.id}`)}>⏱️</button>
                          <button className="btn-icon" title="Screenshots" onClick={()=>navigate(`/screenshots/${dev.id}`)}>📸</button>
                          <button className="btn-icon" title="Live View" onClick={()=>navigate(`/live/${dev.id}`)}>🔴</button>
                        </div>
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
