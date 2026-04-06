import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/finance', label: 'Payments', icon: 'payments' },
  { to: '/trainer-settlements', label: 'Trainer Settlement', icon: 'payments' },
  { to: '/training-engagements', label: 'Training Engagements', icon: 'teaching' },
  { to: '/trainers', label: 'Trainers', icon: 'trainer' },
  { to: '/topics', label: 'Topics', icon: 'topic' },
  { to: '/colleges', label: 'Colleges', icon: 'college' },
  { to: '/organizations', label: 'Organizations', icon: 'organization' },
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
  if (name === 'payments') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <path d="M2 10h20" />
        <path d="M6 15h4M14 15h4" />
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
  if (name === 'trainer') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="7" r="4" />
        <path d="M2 21v-2a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v2" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      </svg>
    );
  }
  if (name === 'topic') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 4h16v4H4V4Zm0 6h16v4H4v-4Zm0 6h10v4H4v-4Z" />
      </svg>
    );
  }
  if (name === 'college') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2 8l10 5 10-5-10-5Z" />
        <path d="M5 11.5V16c0 2.2 3.1 4 7 4s7-1.8 7-4v-4.5l-7 3.5-7-3.5Z" />
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
  if (name === 'organization') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M3 21h18v-2H3v2Zm2-4h4V7H5v10Zm5 0h4V3h-4v14Zm5 0h4V10h-4v7Z" />
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
            <h2>Training Engagement Management System (TEMS)</h2>
            <p>Track training engagements, client operations, and cash flow in one loop.</p>
          </div>
          <div className="ops-topbar-actions">
            <button className="btn btn-secondary" onClick={() => navigate('/training-engagements')}>
              New Engagement
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
