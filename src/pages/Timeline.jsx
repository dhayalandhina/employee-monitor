import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Timeline({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r=>r.json()).then(d => {
      setDevices(d);
      setSelected(prev => prev || d[0]?.id || '');
    });
  }, [apiBase]);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    fetch(`${apiBase}/api/activity/${selected}?date=${date}`)
      .then(r=>r.json()).then(d => { setLogs(d); setLoading(false); });
  }, [selected, date, apiBase]);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  const formatDuration = (s) => { const m=Math.floor(s/60); return m>=60?`${Math.floor(m/60)}h ${m%60}m`:`${m}m`; };

  const stats = {
    productive: logs.filter(l=>l.category==='productive').reduce((s,l)=>s+l.duration,0),
    unproductive: logs.filter(l=>l.category==='unproductive').reduce((s,l)=>s+l.duration,0),
    idle: logs.filter(l=>l.category==='idle').reduce((s,l)=>s+l.duration,0),
    neutral: logs.filter(l=>l.category==='neutral').reduce((s,l)=>s+l.duration,0),
  };
  const total = stats.productive+stats.unproductive+stats.idle+stats.neutral || 1;

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><div><h2>⏱️ Activity Timeline</h2><p>Detailed app & URL tracking for each device</p></div></div>
      </div>
      <div className="page-content">
        <div className="flex-between mb-20">
          <div className="flex gap-12">
            <select className="select" value={selected} onChange={e=>setSelected(e.target.value)}>
              {devices.map(d=><option key={d.id} value={d.id}>{d.id} — {d.employeeName||d.hostname}</option>)}
            </select>
            <input type="date" className="date-input" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <div className="flex gap-8">
            <span className="category-badge productive">Productive: {formatDuration(stats.productive)}</span>
            <span className="category-badge unproductive">Unproductive: {formatDuration(stats.unproductive)}</span>
            <span className="category-badge idle">Idle: {formatDuration(stats.idle)}</span>
          </div>
        </div>

        {/* Productivity bar */}
        <div className="card mb-20">
          <div className="card-body">
            <div className="flex-between mb-20" style={{marginBottom:12}}>
              <span style={{fontSize:13,fontWeight:600}}>Day Summary</span>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Total: {formatDuration(total)}</span>
            </div>
            <div className="productivity-bar" style={{height:14,borderRadius:7}}>
              <div className="segment" style={{width:`${stats.productive/total*100}%`,background:'var(--productive)'}} />
              <div className="segment" style={{width:`${stats.neutral/total*100}%`,background:'var(--neutral)'}} />
              <div className="segment" style={{width:`${stats.unproductive/total*100}%`,background:'var(--unproductive)'}} />
              <div className="segment" style={{width:`${stats.idle/total*100}%`,background:'var(--idle)'}} />
            </div>
            <div className="flex gap-16 mt-16" style={{marginTop:10}}>
              <span style={{fontSize:11,color:'var(--productive)'}}>● Productive {Math.round(stats.productive/total*100)}%</span>
              <span style={{fontSize:11,color:'var(--neutral)'}}>● Neutral {Math.round(stats.neutral/total*100)}%</span>
              <span style={{fontSize:11,color:'var(--unproductive)'}}>● Unproductive {Math.round(stats.unproductive/total*100)}%</span>
              <span style={{fontSize:11,color:'var(--idle)'}}>● Idle {Math.round(stats.idle/total*100)}%</span>
            </div>
          </div>
        </div>

        {/* Timeline */}
        {loading ? (
          <div className="empty-state"><div className="icon">⏳</div><h3>Loading timeline...</h3></div>
        ) : logs.length === 0 ? (
          <div className="empty-state"><div className="icon">📭</div><h3>No activity found</h3><p>No logs for this device on {date}</p></div>
        ) : (
          <div className="timeline">
            {logs.map(log => (
              <div className="timeline-item" key={log.id}>
                <div className="timeline-time">{formatTime(log.timestamp)} — {formatTime(log.end_time || log.endTime || log.timestamp)}</div>
                <div className="timeline-app">
                  <span>{log.icon}</span>
                  <span>{log.appName}</span>
                  <span className={`category-badge ${log.category}`}>{log.category}</span>
                </div>
                <div className="timeline-window">{log.windowTitle}</div>
                {log.url && <div style={{fontSize:11,color:'var(--info)',marginTop:4}}>🔗 {log.url}</div>}
                <div className="timeline-duration">Duration: {formatDuration(log.duration)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
