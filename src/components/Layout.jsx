import { useLocation, useNavigate } from 'react-router-dom';

export default function Layout({ children, user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

  const navItems = [
    { section: 'Overview', items: [
      { path: '/', label: 'Dashboard', icon: '📊' },
      { path: '/devices', label: 'Devices', icon: '🖥️' },
    ]},
    { section: 'Monitoring', items: [
      { path: '/timeline', label: 'Timeline', icon: '⏱️' },
      { path: '/screenshots', label: 'Screenshots', icon: '📸' },
      { path: '/live', label: 'Live View', icon: '🔴' },
    ]},
    { section: 'Analytics', items: [
      { path: '/reports', label: 'Reports', icon: '📄' },
    ]},
  ];

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">E</div>
          <div className="sidebar-brand">
            <h1>EmpMonitor</h1>
            <p>Admin Panel</p>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(section => (
            <div className="nav-section" key={section.section}>
              <div className="nav-section-title">{section.section}</div>
              {section.items.map(item => (
                <button
                  key={item.path}
                  className={`nav-item ${path === item.path || (item.path !== '/' && path.startsWith(item.path)) ? 'active' : ''}`}
                  onClick={() => navigate(item.path)}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                  {item.path === '/live' && <span className="nav-badge">LIVE</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-avatar">{user?.name?.[0] || 'A'}</div>
            <div className="sidebar-user-info">
              <p>{user?.name || 'Admin'}</p>
              <p>{user?.email || ''}</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" style={{width:'100%',marginTop:10}} onClick={onLogout}>
            🚪 Logout
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
