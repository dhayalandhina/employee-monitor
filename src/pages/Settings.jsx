import { useState, useEffect } from 'react';

export default function Settings({ apiBase }) {
  const [keys, setKeys] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`${apiBase}/api/settings/api_keys`)
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          try {
            const parsed = JSON.parse(data.value);
            setKeys([parsed[0]||'', parsed[1]||'', parsed[2]||'']);
          } catch(e) {}
        }
      });
  }, [apiBase]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch(`${apiBase}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'api_keys', value: JSON.stringify(keys) })
      });
      setMessage('✅ API Keys saved successfully!');
    } catch(e) {
      setMessage('❌ Failed to save keys.');
    }
    setSaving(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div>
      <div className="topbar">
        <div className="topbar-left">
          <div><h2>⚙️ System Settings</h2><p>Configure Integrations and API Keys</p></div>
        </div>
      </div>
      <div className="page-content" style={{ maxWidth: 800 }}>
        <div className="card">
          <div className="card-header"><h3>AI Vision Analysis Pipeline</h3></div>
          <div className="card-body">
            <p style={{color:'var(--text-muted)', marginBottom: 20}}>
              Add your OpenAI-compatible API keys here. The system will automatically rotate through them when analyzing screenshots to prevent rate limiting.
            </p>
            <form onSubmit={handleSave} style={{display:'flex', flexDirection:'column', gap: 15}}>
              {[0, 1, 2].map(i => (
                <div key={i}>
                  <label style={{display:'block', marginBottom: 5, fontSize: 13, fontWeight: 600}}>API Key {i + 1} {i === 0 ? '(Primary)' : '(Fallback)'}</label>
                  <input type="password" value={keys[i]} onChange={e => { const newKeys = [...keys]; newKeys[i] = e.target.value; setKeys(newKeys); }} placeholder="sk-..." className="input" style={{width: '100%'}} />
                </div>
              ))}
              <div style={{display:'flex', gap: 15, alignItems:'center', marginTop: 10}}>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Keys'}</button>
                {message && <span style={{fontWeight:600}}>{message}</span>}
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}