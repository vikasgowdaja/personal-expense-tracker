import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/daily-log', label: 'Daily Log', icon: 'log' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/finance', label: 'Finance', icon: 'finance' },
  { to: '/teaching', label: 'Teaching', icon: 'teaching' },
  { to: '/vendor', label: 'Vendor', icon: 'vendor' },
  { to: '/insights', label: 'Insights', icon: 'insights' },
  { to: '/profile', label: 'Profile', icon: 'profile' },
  { to: '/settings', label: 'Settings', icon: 'settings' }
];

function Icon({ name }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2.5 10.5l1.3 1.6L5 11.2V20h5.8v-5.4h2.4V20H19v-8.8l1.2.9 1.3-1.6L12 3Z" />
      </svg>
    );
  }
  if (name === 'log') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm8 1.8V9h4.2" />
        <path d="M8 12h8M8 16h8" />
      </svg>
    );
  }
  if (name === 'finance') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm.9 4v1.5c1.5.2 2.6 1.2 2.7 2.6h-2.1c-.1-.5-.5-.8-1.1-.8-.6 0-1 .3-1 .8 0 .6.6.8 1.7 1.1 1.7.4 2.8 1.1 2.8 2.8 0 1.4-1.1 2.5-2.9 2.7V18h-1.8v-1.5c-1.8-.2-2.9-1.3-3-2.8h2.1c.1.6.6 1 1.3 1 .7 0 1.2-.3 1.2-.9 0-.6-.5-.8-1.7-1.1-1.6-.4-2.8-1-2.8-2.8 0-1.4 1.1-2.4 2.8-2.7V6h1.8Z" />
      </svg>
    );
  }
  if (name === 'calendar') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 2h2v2h6V2h2v2h2a2 2 0 0 1 2 2v13a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a2 2 0 0 1 2-2h2V2Zm12 8H5v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9Z" />
      </svg>
    );
  }
  if (name === 'teaching') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 8l10 5 8.5-4.3V15H22V8L12 3Z" />
        <path d="M6 12.5V16c0 2.2 2.7 4 6 4s6-1.8 6-4v-3.5l-6 3-6-3Z" />
      </svg>
    );
  }
  if (name === 'vendor') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 7h18l-1.2 13H4.2L3 7Zm3.2-3h11.6l1.2 2H5l1.2-2Z" />
      </svg>
    );
  }
  if (name === 'insights') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2a8 8 0 0 0-5.4 13.9c.5.4.8 1 .8 1.7V19a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1v-1.4c0-.7.3-1.3.8-1.7A8 8 0 0 0 12 2Z" />
        <path d="M9 22h6" />
      </svg>
    );
  }
  if (name === 'profile') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-5 9h10v2H7v-2Z" />
    </svg>
  );
}

function AppShell({ onLogout }) {
  const navigate = useNavigate();

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <div className="ops-brand-dot" />
          <div>
            <h1>Ops Intelligence</h1>
            <p>Capture to optimize</p>
          </div>
        </div>

        <nav className="ops-nav" aria-label="Primary">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'ops-nav-item ops-nav-item-active' : 'ops-nav-item'
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="ops-sidebar-footer">
          <button className="btn btn-danger" onClick={onLogout}>Logout</button>
        </div>
      </aside>

      <div className="ops-main">
        <header className="ops-topbar">
          <div>
            <h2>Decision Support Workspace</h2>
            <p>Track schedule, teaching, vendor ops and cash flow in one loop.</p>
          </div>
          <div className="ops-topbar-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/daily-log')}>
              Voice Input
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/add-expense')}>
              Quick Add
            </button>
          </div>
        </header>

        <main className="ops-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default AppShell;
