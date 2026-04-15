import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';

const BASE_NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar' },
  { to: '/training-engagements', label: 'Training Engagements', icon: 'teaching' },
  { to: '/trainers', label: 'Trainers', icon: 'trainer' },
  { to: '/topics', label: 'Topics', icon: 'topic' },
  { to: '/colleges', label: 'Colleges', icon: 'college' },
  { to: '/organizations', label: 'Organizations', icon: 'organization' }
];

const SUPERADMIN_NAV_ITEMS = [
  { to: '/insights', label: 'Insights', icon: 'insights' },
  { to: '/financial', label: 'Financial Reports', icon: 'financial' },
  { to: '/finance', label: 'Payments', icon: 'payments' },
  { to: '/trainer-settlements', label: 'Trainer Settlement', icon: 'payments' },
  { to: '/employees', label: 'Employees', icon: 'employees' }
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
  if (name === 'financial') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
      </svg>
    );
  }
  if (name === 'employees') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm-5 9h10v2H7v-2Z" />
    </svg>
  );
}

function AppShell({ user, onLogout }) {
  const navigate = useNavigate();
  const isPrivileged = user?.role === 'superadmin' || user?.role === 'platform_owner';
  const navItems = isPrivileged
    ? [...BASE_NAV_ITEMS, ...SUPERADMIN_NAV_ITEMS]
    : BASE_NAV_ITEMS;
  const roleLabel =
    user?.role === 'platform_owner'
      ? 'Platform Owner'
      : user?.role === 'superadmin'
        ? 'Super Admin'
        : 'Employee';
  const profileInitial = user?.name?.trim()?.charAt(0)?.toUpperCase() || 'U';
  const profilePhoto = user?.profilePhoto || '';
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="ops-shell">
      <aside className="ops-sidebar">
        <div className="ops-brand">
          <img
            className="ops-brand-logo"
            src="/Infinite8.png"
            alt="Infinite8 logo"
          />
        </div>

        {isPrivileged && (
          <div style={{ padding: '4px 16px', marginBottom: '8px' }}>
            <span style={{
              display: 'inline-block',
              background: '#7c3aed',
              color: '#fff',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700,
              padding: '2px 8px',
              letterSpacing: '0.05em'
            }}>{user?.role === 'platform_owner' ? 'PLATFORM OWNER' : 'SUPER ADMIN'}</span>
          </div>
        )}

        <nav className="ops-nav" aria-label="Primary">
          {navItems.map((item) => (
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
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
            {user?.name} &bull; {user?.role}
          </div>
        </div>
      </aside>

      <div className="ops-main">
        <header className="ops-header">
          <div className="ops-header-content">
            <div className="ops-header-title">Dashboard</div>
            <div className="ops-header-actions" ref={profileMenuRef}>
              <button
                className="ops-profile-chip"
                onClick={() => setIsProfileMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={isProfileMenuOpen}
              >
                {profilePhoto ? (
                  <img className="ops-profile-chip-avatar" src={profilePhoto} alt={user?.name || 'Profile'} />
                ) : (
                  <span className="ops-profile-chip-avatar ops-profile-chip-avatar-fallback">{profileInitial}</span>
                )}
                <span className="ops-profile-chip-meta">
                  <strong>{user?.name || 'User'}</strong>
                  <small>{roleLabel}</small>
                </span>
                <span className="ops-profile-chip-caret">▾</span>
              </button>
              {isProfileMenuOpen && (
                <div className="ops-profile-menu" role="menu">
                  <button
                    className="ops-profile-menu-item"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/profile');
                    }}
                  >
                    Profile
                  </button>
                  <button
                    className="ops-profile-menu-item"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                  >
                    Settings
                  </button>
                  <button
                    className="ops-profile-menu-item ops-profile-menu-item-danger"
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      onLogout();
                    }}
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
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
