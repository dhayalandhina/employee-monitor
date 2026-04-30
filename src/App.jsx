import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Timeline from './pages/Timeline';
import Screenshots from './pages/Screenshots';
import Reports from './pages/Reports';
import LiveView from './pages/LiveView';
import Settings from './pages/Settings';
import Layout from './components/Layout';
import './index.css';

const API = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
  ? 'http://localhost:3001'
  : `${window.location.protocol}//${window.location.hostname}:3001`;

function App() {
  const [auth, setAuth] = useState(() => {
    const saved = localStorage.getItem('em_auth');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (data) => {
    localStorage.setItem('em_auth', JSON.stringify(data));
    setAuth(data);
  };

  const logout = () => {
    localStorage.removeItem('em_auth');
    setAuth(null);
  };

  if (!auth) {
    return <Login onLogin={login} apiBase={API} />;
  }

  return (
    <BrowserRouter>
      <Layout user={auth.user} onLogout={logout}>
        <Routes>
          <Route path="/" element={<Dashboard apiBase={API} />} />
          <Route path="/devices" element={<Devices apiBase={API} />} />
          <Route path="/timeline/:deviceId?" element={<Timeline apiBase={API} />} />
          <Route path="/screenshots/:deviceId?" element={<Screenshots apiBase={API} />} />
          <Route path="/reports" element={<Reports apiBase={API} />} />
          <Route path="/live/:deviceId?" element={<LiveView apiBase={API} />} />          <Route path="/settings" element={<Settings apiBase={API} />} />          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
