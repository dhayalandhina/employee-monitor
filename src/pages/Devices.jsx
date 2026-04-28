import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Devices({ apiBase }) {
  const [devices, setDevices] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRemoveModal, setShowRemoveModal] = useState(null);
  const [newEmployee, setNewEmployee] = useState({ name: '', email: '', department: '' });
  const navigate = useNavigate();

  const loadData = () => {
    fetch(`${apiBase}/api/devices`).then(r => r.json()).then(setDevices).catch(console.error);
    fetch(`${apiBase}/api/employees`).then(r => r.json()).then(setEmployees).catch(console.error);
  };

  useEffect(() => { loadData(); }, [apiBase]);

  const filtered = devices.filter(d => {
    const matchSearch = d.id.toLowerCase().includes(search.toLowerCase()) ||
      (d.hostname || '').toLowerCase().includes(search.toLowerCase()) ||
      (d.employee_name || '').toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || d.status === filter;
    return matchSearch && matchFilter;
  });

  const handleAddEmployee = async (e) => {
    e.preventDefault();
    try {
      await fetch(`${apiBase}/api/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEmployee),
      });
      setNewEmployee({ name: '', email: '', department: '' });
      setShowAddModal(false);
      loadData();
    } catch (err) { console.error(err); }
  };

  const handleRemoveDevice = async (deviceId) => {
    try {
      await fetch(`${apiBase}/api/devices/${deviceId}`, { method: 'DELETE' });
      setShowRemoveModal(null);
      loadData();
    } catch (err) { console.error(err); }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-left"><div><h2>🖥️ Devices</h2><p>Manage employee devices — Add, remove, monitor</p></div></div>
        <div className="topbar-right">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>➕ Add Employee</button>
        </div>
      </div>
      <div className="page-content">
        {/* Filters */}
        <div className="flex-between mb-20">
          <div className="flex gap-12">
            <div className="input-group">
              <span className="input-icon">🔍</span>
              <input placeholder="Search devices..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: 280 }} />
            </div>
            <select className="select" value={filter} onChange={e => setFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="online">Online</option>
              <option value="idle">Idle</option>
              <option value="offline">Offline</option>
            </select>
          </div>
          <div className="flex gap-8">
            <span className="status-badge online">{devices.filter(d => d.status === 'online').length} Online</span>
            <span className="status-badge idle">{devices.filter(d => d.status === 'idle').length} Idle</span>
            <span className="status-badge offline">{devices.filter(d => d.status === 'offline').length} Offline</span>
          </div>
        </div>

        {/* Device setup instructions */}
        <div className="card mb-20" style={{borderColor:'var(--accent)',borderStyle:'dashed'}}>
          <div className="card-body" style={{display:'flex',alignItems:'center',gap:16}}>
            <span style={{fontSize:28}}>💡</span>
            <div>
              <p style={{fontWeight:600,fontSize:14,marginBottom:4}}>How to connect a new staff PC</p>
              <p style={{fontSize:12,color:'var(--text-muted)'}}>
                1. Add employee above → 2. Install <strong>EmpMonitor-Setup.exe</strong> on their Windows PC →
                3. Enter this server URL: <code style={{background:'var(--bg-elevated)',padding:'2px 8px',borderRadius:4,color:'var(--accent-hover)'}}>{apiBase}</code> →
                4. Device appears here automatically
              </p>
            </div>
          </div>
        </div>

        {/* Devices Table */}
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>OS</th>
                  <th>IP Address</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{textAlign:'center',padding:40,color:'var(--text-muted)'}}>No devices found. Install the agent on a staff PC to get started.</td></tr>
                ) : filtered.map(dev => (
                  <tr key={dev.id}>
                    <td>
                      <div className="device-cell">
                        <div className="device-icon">🖥️</div>
                        <div className="device-info">
                          <span className="name">{dev.id}</span>
                          <span className="sub">{dev.hostname}</span>
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{dev.employee_name || '—'}</td>
                    <td>{dev.department || '—'}</td>
                    <td style={{ fontSize: 12 }}>{dev.os}</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{dev.ip}</td>
                    <td><span className={`status-badge ${dev.status}`}>{dev.status}</span></td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {dev.last_seen ? new Date(dev.last_seen).toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }) : '—'}
                    </td>
                    <td>
                      <div className="flex gap-8">
                        <button className="btn-icon" title="Timeline" onClick={() => navigate(`/timeline/${dev.id}`)}>⏱️</button>
                        <button className="btn-icon" title="Screenshots" onClick={() => navigate(`/screenshots/${dev.id}`)}>📸</button>
                        <button className="btn-icon" title="Live" onClick={() => navigate(`/live/${dev.id}`)}>🔴</button>
                        <button className="btn-icon" title="Remove Device" onClick={() => setShowRemoveModal(dev)} style={{borderColor:'var(--danger)',color:'var(--danger)'}}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAddModal(false)}>
          <div className="card" style={{ maxWidth: 440, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <h3>➕ Add New Employee</h3>
              <button className="btn-icon" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="card-body">
              <form onSubmit={handleAddEmployee}>
                <div className="form-group">
                  <label>Employee Name *</label>
                  <input value={newEmployee.name} onChange={e => setNewEmployee({ ...newEmployee, name: e.target.value })} required placeholder="e.g. Rajesh Kumar" />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={newEmployee.email} onChange={e => setNewEmployee({ ...newEmployee, email: e.target.value })} placeholder="e.g. rajesh@company.com" />
                </div>
                <div className="form-group">
                  <label>Department</label>
                  <input value={newEmployee.department} onChange={e => setNewEmployee({ ...newEmployee, department: e.target.value })} placeholder="e.g. Engineering" />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>✅ Add Employee</button>
              </form>
              <div style={{marginTop:16,padding:16,background:'var(--bg-elevated)',borderRadius:8,fontSize:12,color:'var(--text-muted)'}}>
                <strong>Next step:</strong> After adding, install <strong>EmpMonitor-Setup.exe</strong> on their Windows PC. The agent will auto-register with this server.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Device Modal */}
      {showRemoveModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowRemoveModal(null)}>
          <div className="card" style={{ maxWidth: 400, width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="card-header"><h3>⚠️ Remove Device</h3></div>
            <div className="card-body" style={{textAlign:'center'}}>
              <p style={{fontSize:48,marginBottom:12}}>🗑️</p>
              <p style={{fontWeight:600,fontSize:15,marginBottom:8}}>Remove {showRemoveModal.id}?</p>
              <p style={{fontSize:13,color:'var(--text-muted)',marginBottom:20}}>
                This will stop monitoring <strong>{showRemoveModal.employee_name || showRemoveModal.hostname}</strong>.
                The agent on their PC will stop sending data.
              </p>
              <div className="flex gap-12" style={{justifyContent:'center'}}>
                <button className="btn btn-secondary" onClick={() => setShowRemoveModal(null)}>Cancel</button>
                <button className="btn" style={{background:'var(--danger)',color:'#fff',border:'none'}} onClick={() => handleRemoveDevice(showRemoveModal.id)}>🗑️ Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
