import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function LiveView({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [device, setDevice] = useState(null);
  const [lastActivity, setLastActivity] = useState(null);

  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r=>r.json()).then(d => {
      setDevices(d);
      if (!selected && d.length) setSelected(d[0].id);
    });
  }, [apiBase]);

  useEffect(() => {
    if (!selected) return;
    const dev = devices.find(d=>d.id===selected);
    setDevice(dev);
    // Fetch latest activity
    fetch(`${apiBase}/api/activity/${selected}`).then(r=>r.json()).then(logs => {
      if (logs.length) setLastActivity(logs[logs.length-1]);
    });
  }, [selected, devices, apiBase]);

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <h2><span className="live-dot"></span> Live Monitoring</h2>
            <p>Real-time screen view & activity tracking</p>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="flex-between mb-20">
          <select className="select" value={selected} onChange={e=>setSelected(e.target.value)}>
            {devices.map(d=><option key={d.id} value={d.id}>{d.id} — {d.employeeName||d.hostname} ({d.status})</option>)}
          </select>
          {device && <span className={`status-badge ${device.status}`}>{device.status}</span>}
        </div>

        <div className="grid-2-1">
          {/* Live Screen */}
          <div className="card">
            <div className="card-header">
              <h3><span className="live-dot"></span> Live Screen — {selected}</h3>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Auto-refreshes every 10s</span>
            </div>
            <div className="card-body">
              <div style={{background:'var(--bg-elevated)',borderRadius:8,aspectRatio:'16/9',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
                <span style={{fontSize:64}}>🖥️</span>
                <span style={{fontSize:14,color:'var(--text-secondary)',fontWeight:600}}>
                  {device?.status==='online' ? 'Live Screen Feed' : device?.status==='idle' ? 'Device is Idle' : 'Device is Offline'}
                </span>
                <span style={{fontSize:12,color:'var(--text-muted)'}}>
                  {device?.status==='online'
                    ? 'Connect the Windows Agent to enable live screen streaming'
                    : 'Waiting for device to come online...'}
                </span>
              </div>
            </div>
          </div>

          {/* Info Panel */}
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div className="card">
              <div className="card-header"><h3>📋 Device Info</h3></div>
              <div className="card-body" style={{fontSize:13}}>
                {device ? (
                  <div style={{display:'grid',gap:12}}>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Device ID</span><span style={{fontWeight:600}}>{device.id}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Hostname</span><span style={{fontWeight:600}}>{device.hostname}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>OS</span><span>{device.os}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>IP</span><span style={{fontFamily:'monospace'}}>{device.ip}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Employee</span><span style={{fontWeight:600}}>{device.employeeName}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Agent</span><span className="category-badge neutral">v{device.agentVersion}</span></div>
                  </div>
                ) : <p style={{color:'var(--text-muted)'}}>Select a device</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>🔄 Current Activity</h3></div>
              <div className="card-body">
                {lastActivity ? (
                  <div style={{display:'grid',gap:10,fontSize:13}}>
                    <div><span style={{color:'var(--text-muted)'}}>App: </span><span style={{fontWeight:600}}>{lastActivity.icon} {lastActivity.appName}</span></div>
                    <div><span style={{color:'var(--text-muted)'}}>Window: </span><span>{lastActivity.windowTitle}</span></div>
                    {lastActivity.url && <div><span style={{color:'var(--text-muted)'}}>URL: </span><span style={{color:'var(--info)'}}>{lastActivity.url}</span></div>}
                    <div><span className={`category-badge ${lastActivity.category}`}>{lastActivity.category}</span></div>
                  </div>
                ) : <p style={{color:'var(--text-muted)',fontSize:13}}>No recent activity</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
