import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

export default function Screenshots({ apiBase }) {
  const { deviceId } = useParams();
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState(deviceId || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [screenshots, setScreenshots] = useState([]);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    fetch(`${apiBase}/api/devices`).then(r=>r.json()).then(d => {
      setDevices(d);
      if (!selected && d.length) setSelected(d[0].id);
    });
  }, [apiBase]);

  useEffect(() => {
    if (!selected) return;
    fetch(`${apiBase}/api/screenshots/${selected}?date=${date}`)
      .then(r=>r.json()).then(setScreenshots);
  }, [selected, date, apiBase]);

  const formatTime = (ts) => new Date(ts).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'});

  // Build the actual image URL from filename
  const getImageUrl = (ss) => {
    if (ss.filename) return `${apiBase}/screenshots/${ss.filename}`;
    return null;
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><div><h2>📸 Screenshots</h2><p>Periodic screen captures from employee devices</p></div></div>
      </div>
      <div className="page-content">
        <div className="flex-between mb-20">
          <div className="flex gap-12">
            <select className="select" value={selected} onChange={e=>setSelected(e.target.value)}>
              {devices.map(d=><option key={d.id} value={d.id}>{d.id} — {d.employee_name||d.employeeName||d.hostname}</option>)}
            </select>
            <input type="date" className="date-input" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
          <span style={{fontSize:13,color:'var(--text-muted)'}}>{screenshots.length} screenshots</span>
        </div>

        {screenshots.length === 0 ? (
          <div className="empty-state"><div className="icon">📸</div><h3>No screenshots yet</h3><p>Screenshots appear here when captured by the agent (every 5 minutes)</p></div>
        ) : (
          <div className="screenshot-grid">
            {screenshots.map(ss => {
              const imgUrl = getImageUrl(ss);
              return (
                <div className="screenshot-card" key={ss.id} onClick={()=>setPreview(ss)}>
                  <div className="screenshot-thumb">
                    {imgUrl ? (
                      <img src={imgUrl} alt={`Screenshot at ${formatTime(ss.timestamp)}`}
                        style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:6}}
                        onError={(e)=>{e.target.style.display='none'; e.target.parentNode.innerHTML='🖥️';}} />
                    ) : '🖥️'}
                  </div>
                  <div className="screenshot-meta">
                    <div className="time">{formatTime(ss.timestamp)}</div>
                    <div className="app">{ss.app_name||ss.appName||''} — {ss.window_title||ss.windowTitle||''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Preview Modal — shows real image */}
        {preview && (
          <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setPreview(null)}>
            <div className="card" style={{maxWidth:1100,width:'100%',maxHeight:'95vh',overflow:'auto'}} onClick={e=>e.stopPropagation()}>
              <div className="card-header">
                <h3>📸 {preview.app_name||preview.appName||'Screenshot'} — {formatTime(preview.timestamp)}</h3>
                <button className="btn-icon" onClick={()=>setPreview(null)}>✕</button>
              </div>
              <div className="card-body" style={{textAlign:'center',padding:8}}>
                {getImageUrl(preview) ? (
                  <img src={getImageUrl(preview)} alt="Screenshot"
                    style={{width:'100%',maxHeight:'80vh',objectFit:'contain',borderRadius:8,background:'#000'}}
                    onError={(e)=>{e.target.style.display='none';}} />
                ) : (
                  <div style={{background:'var(--bg-elevated)',borderRadius:8,padding:80,fontSize:64}}>🖥️</div>
                )}
                <p style={{marginTop:12,fontSize:13,color:'var(--text-muted)'}}>{preview.window_title||preview.windowTitle||''}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
