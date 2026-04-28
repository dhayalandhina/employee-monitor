import { useState } from 'react';

export default function Login({ onLogin, apiBase }) {
  const [email, setEmail] = useState('admin@company.com');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${apiBase}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      onLogin(data);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div style={{textAlign:'center',marginBottom:24}}>
          <div className="sidebar-logo" style={{width:56,height:56,fontSize:28,margin:'0 auto 16px',borderRadius:14}}>E</div>
        </div>
        <h2>Welcome Back</h2>
        <p className="subtitle">Sign in to Employee Monitoring Dashboard</p>
        {error && <div style={{background:'var(--danger-bg)',color:'var(--danger)',padding:'10px 16px',borderRadius:8,marginBottom:16,fontSize:13,fontWeight:600}}>{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@company.com" required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? '⏳ Signing in...' : '🔐 Sign In'}
          </button>
        </form>
        <p style={{textAlign:'center',marginTop:20,fontSize:12,color:'var(--text-muted)'}}>
          Demo: admin@company.com / admin123
        </p>
      </div>
    </div>
  );
}
