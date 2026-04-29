import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

export default function LiveView({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [device, setDevice] = useState(null);
  const [lastActivity, setLastActivity] = useState(null);
  const [latestScreenshot, setLatestScreenshot] = useState(null);
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r=>r.json()).then(d => {
      setDevices(d);
      if (!selected && d.length) setSelected(d[0].id);
    });
  }, [apiBase]);

  // Fetch device info, latest activity, and latest screenshot
  const fetchLiveData = useCallback(() => {
    if (!selected) return;

    // Device info
    fetch(`${apiBase}/api/devices`).then(r=>r.json()).then(devs => {
      setDevices(devs);
      const dev = devs.find(d=>d.id===selected);
      setDevice(dev);
    });

    // Latest activity
    fetch(`${apiBase}/api/activity/${selected}`).then(r=>r.json()).then(logs => {
      if (logs.length) setLastActivity(logs[logs.length-1]);
    });

    // Latest screenshot
    const today = new Date().toISOString().split('T')[0];
    fetch(`${apiBase}/api/screenshots/${selected}?date=${today}`).then(r=>r.json()).then(screenshots => {
      if (screenshots.length) {
        setLatestScreenshot(screenshots[screenshots.length-1]);
      }
    });
  }, [selected, apiBase]);

  // Fetch on select change
  useEffect(() => {
    fetchLiveData();
  }, [fetchLiveData]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLiveData();
      setRefreshCount(c => c + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  const getScreenshotUrl = (ss) => {
    if (ss && ss.filename) return `${apiBase}/screenshots/${ss.filename}`;
    return null;
  };

  const formatTime = (ts) => {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  };

  const getStatusColor = (status) => {
    if (status === 'online') return '#4caf50';
    if (status === 'idle') return '#ff9800';
    return '#f44336';
  };

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
            {devices.map(d=><option key={d.id} value={d.id}>{d.id} — {d.employee_name||d.employeeName||d.hostname} ({d.status})</option>)}
          </select>
          <div style={{display:'flex',alignItems:'center',gap:12}}>
            {device && <span className={`status-badge ${device.status}`}>{device.status}</span>}
            <span style={{fontSize:11,color:'var(--text-muted)'}}>⟳ Auto-refresh #{refreshCount}</span>
          </div>
        </div>

        <div className="grid-2-1">
          {/* Live Screen */}
          <div className="card">
            <div className="card-header">
              <h3><span className="live-dot"></span> Live Screen — {selected}</h3>
              <span style={{fontSize:12,color:'var(--text-muted)'}}>Auto-refreshes every 10s</span>
            </div>
            <div className="card-body">
              <div style={{background:'#0a0a0a',borderRadius:8,aspectRatio:'16/9',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',position:'relative'}}>
                {getScreenshotUrl(latestScreenshot) ? (
                  <>
                    <img
                      src={`${getScreenshotUrl(latestScreenshot)}?t=${refreshCount}`}
                      alt="Live Screen"
                      style={{width:'100%',height:'100%',objectFit:'contain'}}
                      onError={(e)=>{e.target.style.display='none';}}
                    />
                    <div style={{position:'absolute',top:8,left:8,background:'rgba(244,67,54,0.9)',color:'#fff',padding:'2px 10px',borderRadius:4,fontSize:11,fontWeight:700,display:'flex',alignItems:'center',gap:4}}>
                      <span style={{width:6,height:6,borderRadius:'50%',background:'#fff',animation:'pulse 1s infinite'}}></span>
                      LIVE
                    </div>
                    <div style={{position:'absolute',bottom:8,right:8,background:'rgba(0,0,0,0.7)',color:'#fff',padding:'2px 8px',borderRadius:4,fontSize:11}}>
                      📸 {formatTime(latestScreenshot.timestamp)}
                    </div>
                  </>
                ) : (
                  <div style={{textAlign:'center'}}>
                    <span style={{fontSize:64}}>🖥️</span>
                    <p style={{fontSize:14,color:'#888',marginTop:8}}>
                      {device?.status==='online' ? 'Waiting for first screenshot...' : device?.status==='idle' ? 'Device is Idle' : 'Device is Offline'}
                    </p>
                    <p style={{fontSize:12,color:'#666'}}>Screenshots appear every 5 minutes</p>
                  </div>
                )}
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
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Employee</span><span style={{fontWeight:600}}>{device.employee_name||device.employeeName||'—'}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Department</span><span>{device.department||'—'}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Hostname</span><span style={{fontWeight:600}}>{device.hostname}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>OS</span><span>{device.os}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>IP</span><span style={{fontFamily:'monospace'}}>{device.ip}</span></div>
                    <div className="flex-between">
                      <span style={{color:'var(--text-muted)'}}>Status</span>
                      <span style={{color:getStatusColor(device.status),fontWeight:700}}>● {device.status?.toUpperCase()}</span>
                    </div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Last Seen</span><span>{formatTime(device.last_seen||device.lastSeen)}</span></div>
                    <div className="flex-between"><span style={{color:'var(--text-muted)'}}>Agent</span><span className="category-badge neutral">v{device.agent_version||device.agentVersion||'2.1'}</span></div>
                  </div>
                ) : <p style={{color:'var(--text-muted)'}}>Select a device</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>🔄 Current Activity</h3></div>
              <div className="card-body">
                {lastActivity ? (
                  <div style={{display:'grid',gap:10,fontSize:13}}>
                    <div><span style={{color:'var(--text-muted)'}}>App: </span><span style={{fontWeight:600}}>{lastActivity.app_name||lastActivity.appName||'—'}</span></div>
                    <div><span style={{color:'var(--text-muted)'}}>Window: </span><span>{lastActivity.window_title||lastActivity.windowTitle||'—'}</span></div>
                    <div><span style={{color:'var(--text-muted)'}}>Duration: </span><span>{lastActivity.duration||0}s</span></div>
                    <div><span style={{color:'var(--text-muted)'}}>Category: </span><span className={`category-badge ${lastActivity.category}`}>{lastActivity.category}</span></div>
                    <div><span style={{color:'var(--text-muted)'}}>Time: </span><span>{formatTime(lastActivity.timestamp)}</span></div>
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
