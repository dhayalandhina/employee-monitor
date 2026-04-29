import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';

export default function LiveView({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [device, setDevice] = useState(null);
  const [liveFrame, setLiveFrame] = useState(null);
  const [isLive, setIsLive] = useState(false);
  const [staffIdle, setStaffIdle] = useState(false);
  const [currentApp, setCurrentApp] = useState('');
  const [currentWindow, setCurrentWindow] = useState('');
  const [frameCount, setFrameCount] = useState(0);
  const socketRef = useRef(null);
  const selectedRef = useRef('');
  const prevWatchRef = useRef('');

  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Socket.io connection — ONCE
  useEffect(() => {
    const socket = io(apiBase, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('live:frame', (data) => {
      if (data.deviceId === selectedRef.current) {
        setLiveFrame(data.frame);
        setIsLive(true);
        setStaffIdle(data.isIdle || false);
        setCurrentApp(data.appName || '');
        setCurrentWindow(data.windowTitle || '');
        setFrameCount(c => c + 1);
      }
    });

    socket.on('activity:new', (data) => {
      if (data.deviceId === selectedRef.current && data.latest) {
        setCurrentApp(data.latest.appName || '');
        setCurrentWindow(data.latest.windowTitle || '');
      }
    });

    return () => {
      if (prevWatchRef.current) socket.emit('live:stop', prevWatchRef.current);
      socket.disconnect();
    };
  }, [apiBase]);

  // Fetch devices
  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r => r.json()).then(d => {
      setDevices(d);
      if (!selected && d.length) setSelected(d[0].id);
    });
    const i = setInterval(() => {
      fetch(`${apiBase}/api/devices`).then(r => r.json()).then(setDevices).catch(() => {});
    }, 15000);
    return () => clearInterval(i);
  }, [apiBase]);

  // Switch device watching
  useEffect(() => {
    if (!selected || !socketRef.current) return;
    if (prevWatchRef.current && prevWatchRef.current !== selected) {
      socketRef.current.emit('live:stop', prevWatchRef.current);
    }
    setLiveFrame(null);
    setIsLive(false);
    setStaffIdle(false);
    setCurrentApp('');
    setCurrentWindow('');
    setFrameCount(0);

    const dev = devices.find(d => d.id === selected);
    setDevice(dev || null);
    socketRef.current.emit('live:watch', selected);
    prevWatchRef.current = selected;

    // Load last screenshot as initial view
    const today = new Date().toISOString().split('T')[0];
    fetch(`${apiBase}/api/screenshots/${selected}?date=${today}`).then(r => r.json()).then(ss => {
      if (ss && ss.length) {
        const latest = ss[ss.length - 1];
        if (latest.filename) setLiveFrame(`${apiBase}/screenshots/${latest.filename}`);
      }
    }).catch(() => {});
  }, [selected]);

  // Update device when list refreshes
  useEffect(() => {
    if (selected && devices.length) {
      const dev = devices.find(d => d.id === selected);
      if (dev) setDevice(dev);
    }
  }, [devices]);

  const formatTime = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <h2><span className="live-dot"></span> Live Monitoring</h2>
            <p>Real-time screen view of employee devices</p>
          </div>
        </div>
      </div>
      <div className="page-content">
        {/* Device Selector */}
        <div className="flex-between mb-20">
          <select className="select" value={selected} onChange={e => setSelected(e.target.value)} style={{ minWidth: 280 }}>
            {devices.map(d => (
              <option key={d.id} value={d.id}>
                {d.status === 'online' ? '🟢' : d.status === 'idle' ? '🟡' : '🔴'} {d.employee_name || d.employeeName || d.hostname} ({d.id})
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {isLive && staffIdle && (
              <span style={{ background: '#ff9800', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                💤 IDLE
              </span>
            )}
            {isLive && !staffIdle && (
              <span style={{ background: '#4caf50', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
                ⚡ ACTIVE
              </span>
            )}
            {isLive && (
              <span style={{ background: '#f44336', color: '#fff', padding: '4px 12px', borderRadius: 6, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }}></span>
                LIVE
              </span>
            )}
          </div>
        </div>

        {/* Main Live View */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: 0 }}>
            <div style={{ background: '#000', borderRadius: 8, aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' }}>
              {liveFrame ? (
                <>
                  <img
                    src={liveFrame}
                    alt="Live Screen"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                  {/* LIVE badge */}
                  {isLive && (
                    <div style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(244,67,54,0.9)', color: '#fff', padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }}></span>
                      LIVE
                    </div>
                  )}
                  {/* Idle overlay */}
                  {isLive && staffIdle && (
                    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'rgba(0,0,0,0.7)', padding: '20px 40px', borderRadius: 12, textAlign: 'center' }}>
                      <div style={{ fontSize: 48 }}>💤</div>
                      <div style={{ color: '#ff9800', fontSize: 18, fontWeight: 700, marginTop: 8 }}>Staff is Idle</div>
                      <div style={{ color: '#aaa', fontSize: 13, marginTop: 4 }}>No keyboard or mouse activity detected</div>
                    </div>
                  )}
                  {/* Bottom info bar */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', padding: '20px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                    <div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>
                        {device?.employee_name || device?.employeeName || selected}
                      </div>
                      <div style={{ color: '#aaa', fontSize: 12, marginTop: 2 }}>
                        {currentApp && currentApp !== 'Idle' ? `📱 ${currentApp}` : ''} {currentWindow ? `— ${currentWindow}` : ''}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ color: '#aaa', fontSize: 11 }}>{device?.hostname} | {device?.ip}</div>
                      <div style={{ color: '#888', fontSize: 11 }}>{formatTime()} | Frame #{frameCount}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: 64 }}>🖥️</span>
                  <p style={{ fontSize: 16, color: '#888', marginTop: 12 }}>
                    {device?.status === 'online'
                      ? 'Connecting to live stream...'
                      : `${device?.employee_name || device?.employeeName || selected} is ${device?.status || 'offline'}`}
                  </p>
                  <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>
                    {device?.status === 'online' ? 'Stream will start within 5 seconds' : 'Device must be online to view live'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Info Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28 }}>{isLive ? (staffIdle ? '💤' : '⚡') : '⏳'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6, color: staffIdle ? '#ff9800' : '#4caf50' }}>
                {isLive ? (staffIdle ? 'Idle' : 'Active') : 'Connecting'}
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28 }}>📱</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{currentApp || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{currentWindow ? currentWindow.substring(0, 40) : '—'}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28 }}>🖥️</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{device?.hostname || '—'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{device?.os || '—'}</div>
            </div>
          </div>
          <div className="card">
            <div className="card-body" style={{ textAlign: 'center', padding: 16 }}>
              <div style={{ fontSize: 28 }}>{isLive ? '🟢' : '🔴'}</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginTop: 6 }}>{isLive ? 'Streaming' : 'Waiting'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Frames: {frameCount}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
