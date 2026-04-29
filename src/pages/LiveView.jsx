import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function LiveView({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [device, setDevice] = useState(null);
  const [lastActivity, setLastActivity] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const socketRef = useRef(null);
  const selectedRef = useRef('');
  const prevWatchRef = useRef('');
  const fpsCountRef = useRef(0);

  // Keep selectedRef in sync
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  // Connect Socket.io ONCE
  useEffect(() => {
    const socket = io(apiBase, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('live:frame', (data) => {
      if (data.deviceId === selectedRef.current) {
        setLiveFrame(data.frame);
        setIsLive(true);
        setFrameCount(c => c + 1);
        fpsCountRef.current++;
        if (data.appName) {
          setLastActivity({
            app_name: data.appName,
            window_title: data.windowTitle,
            timestamp: data.timestamp,
          });
        }
      }
    });

    socket.on('activity:new', (data) => {
      if (data.deviceId === selectedRef.current && data.latest) {
        setLastActivity({
          app_name: data.latest.appName,
          window_title: data.latest.windowTitle,
          category: data.latest.category,
          duration: data.latest.duration,
          timestamp: data.latest.timestamp,
        });
      }
    });

    // FPS counter
    const fpsInterval = setInterval(() => {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
    }, 1000);

    return () => {
      // Stop watching on unmount
      if (prevWatchRef.current) {
        socket.emit('live:stop', prevWatchRef.current);
      }
      socket.disconnect();
      clearInterval(fpsInterval);
    };
  }, [apiBase]);

  // Fetch devices list
  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r => r.json()).then(d => {
      setDevices(d);
      if (!selected && d.length) setSelected(d[0].id);
    });
    const interval = setInterval(() => {
      fetch(`${apiBase}/api/devices`).then(r => r.json()).then(setDevices).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, [apiBase]);

  // When selected device changes: switch watching
  useEffect(() => {
    if (!selected || !socketRef.current) return;

    // Stop watching previous device
    if (prevWatchRef.current && prevWatchRef.current !== selected) {
      socketRef.current.emit('live:stop', prevWatchRef.current);
    }

    // Reset state for new device
    setLiveFrame(null);
    setIsLive(false);
    setLastActivity(null);
    setFrameCount(0);

    // Find device info
    const dev = devices.find(d => d.id === selected);
    setDevice(dev || null);

    // Start watching new device
    socketRef.current.emit('live:watch', selected);
    prevWatchRef.current = selected;

    // Fetch latest activity
    fetch(`${apiBase}/api/activity/${selected}`).then(r => r.json()).then(logs => {
      if (logs && logs.length) setLastActivity(logs[logs.length - 1]);
    }).catch(() => {});

    // Fetch latest screenshot as initial fallback
    const today = new Date().toISOString().split('T')[0];
    fetch(`${apiBase}/api/screenshots/${selected}?date=${today}`).then(r => r.json()).then(ss => {
      if (ss && ss.length) {
        const latest = ss[ss.length - 1];
        if (latest.filename) {
          setLiveFrame(`${apiBase}/screenshots/${latest.filename}`);
        }
      }
    }).catch(() => {});

  }, [selected]); // Only depends on selected — NOT devices

  // Update device info when devices list refreshes
  useEffect(() => {
    if (selected && devices.length) {
      const dev = devices.find(d => d.id === selected);
      if (dev) setDevice(dev);
    }
  }, [devices]);

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getStatusColor = (s) => {
    if (s === 'online') return '#4caf50';
    if (s === 'idle') return '#ff9800';
    return '#f44336';
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <h2><span className="live-dot"></span> Live Monitoring</h2>
            <p>Real-time screen streaming from employee devices</p>
          </div>
        </div>
      </div>
      <div className="page-content">
        <div className="flex-between mb-20">
          <select className="select" value={selected} onChange={e => setSelected(e.target.value)}>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.status === 'online' ? '🟢' : d.status === 'idle' ? '🟡' : '🔴'} {d.id} — {d.employee_name || d.employeeName || d.hostname}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isLive && (
              <span style={{ background: '#f44336', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                🔴 LIVE — {fps} FPS
              </span>
            )}
            {device && <span className={`status-badge ${device.status}`}>{device.status}</span>}
          </div>
        </div>

        <div className="grid-2-1">
          <div className="card">
            <div className="card-header">
              <h3>
                {isLive ? <span style={{ color: '#f44336' }}>●</span> : <span style={{ color: '#666' }}>○</span>}
                {' '}Live Screen — {device?.employee_name || device?.employeeName || selected}
              </h3>
              <span style={{ fontSize: 12, color: isLive ? '#4caf50' : 'var(--text-muted)' }}>
                {isLive ? '⚡ Streaming live' : '⏳ Waiting for stream...'}
              </span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              <div style={{ background: '#000', borderRadius: '0 0 8px 8px', aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
                {liveFrame ? (
                  <>
                    <img
                      src={liveFrame}
                      alt="Live Screen"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                    {isLive && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(244,67,54,0.9)', color: '#fff', padding: '3px 12px', borderRadius: 4, fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }}></span>
                        LIVE
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.75)', color: '#fff', padding: '3px 10px', borderRadius: 4, fontSize: 11 }}>
                      {lastActivity?.app_name || ''} | {formatTime(new Date().toISOString())}
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>
                    <span style={{ fontSize: 64 }}>🖥️</span>
                    <p style={{ fontSize: 14, color: '#888', marginTop: 8 }}>
                      {device?.status === 'online'
                        ? 'Connecting to live stream...'
                        : `${device?.employee_name || selected} is ${device?.status || 'offline'}`}
                    </p>
                    <p style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
                      {device?.status === 'online' ? 'Stream starts within 5 seconds' : 'Device must be online'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="card">
              <div className="card-header"><h3>📋 Device Info</h3></div>
              <div className="card-body" style={{ fontSize: 13 }}>
                {device ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div className="flex-between"><span style={{ color: 'var(--text-muted)' }}>Device</span><span style={{ fontWeight: 600 }}>{device.id}</span></div>
                    <div className="flex-between"><span style={{ color: 'var(--text-muted)' }}>Employee</span><span style={{ fontWeight: 600 }}>{device.employee_name || device.employeeName || '—'}</span></div>
                    <div className="flex-between"><span style={{ color: 'var(--text-muted)' }}>Hostname</span><span>{device.hostname}</span></div>
                    <div className="flex-between"><span style={{ color: 'var(--text-muted)' }}>OS</span><span>{device.os}</span></div>
                    <div className="flex-between"><span style={{ color: 'var(--text-muted)' }}>IP</span><span style={{ fontFamily: 'monospace' }}>{device.ip}</span></div>
                    <div className="flex-between">
                      <span style={{ color: 'var(--text-muted)' }}>Status</span>
                      <span style={{ color: getStatusColor(device.status), fontWeight: 700 }}>● {(device.status || '').toUpperCase()}</span>
                    </div>
                  </div>
                ) : <p style={{ color: 'var(--text-muted)' }}>Loading...</p>}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h3>🔄 Current Activity</h3></div>
              <div className="card-body">
                {lastActivity ? (
                  <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
                    <div><span style={{ color: 'var(--text-muted)' }}>App: </span><span style={{ fontWeight: 600 }}>{lastActivity.app_name || lastActivity.appName || '—'}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Window: </span><span>{lastActivity.window_title || lastActivity.windowTitle || '—'}</span></div>
                    <div><span style={{ color: 'var(--text-muted)' }}>Time: </span><span>{formatTime(lastActivity.timestamp)}</span></div>
                  </div>
                ) : <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Waiting for activity...</p>}
              </div>
            </div>

            <div className="card" style={{ background: isLive ? 'rgba(76,175,80,0.1)' : 'var(--bg-card)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
                <div style={{ fontSize: 24 }}>{isLive ? '🟢' : '⏳'}</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>
                  {isLive ? 'Streaming Live' : 'Connecting...'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                  {isLive ? `${frameCount} frames | ${fps} FPS` : 'Agent checks every 3s'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
