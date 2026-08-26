import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

export const SETTINGS_GROUPS = [
  {
    label: 'Account',
    items: [
      { to: '/settings/profile', label: 'Profile' },
      { to: '/settings/preferences', label: 'Preferences' },
      { to: '/settings/locale', label: 'Language & Region' }
    ]
  },
  {
    label: 'Expense Management',
    items: [
      { to: '/settings/expenses/categories', label: 'Categories' },
      { to: '/settings/expenses/subcategories', label: 'Subcategories' },
      { to: '/settings/expenses/payment-methods', label: 'Payment Methods' },
      { to: '/settings/expenses/tags', label: 'Tags' },
      { to: '/settings/expenses/recurring', label: 'Recurring Expenses' },
      { to: '/settings/expenses/rules', label: 'Expense Rules' },
      { to: '/settings/expenses/defaults', label: 'Defaults' }
    ]
  },
  {
    label: 'Income',
    items: [
      { to: '/settings/income/sources', label: 'Sources' },
      { to: '/settings/income/categories', label: 'Categories' },
      { to: '/settings/income/recurring', label: 'Recurring Income' }
    ]
  },
  {
    label: 'Budget & Finance',
    items: [
      { to: '/settings/budget/budgets', label: 'Budgets' },
      { to: '/settings/budget/limits', label: 'Spending Limits' },
      { to: '/settings/budget/savings-goals', label: 'Savings Goals' }
    ]
  },
  {
    label: 'Notifications',
    items: [
      { to: '/settings/notifications', label: 'Overview' },
      { to: '/settings/notifications/email', label: 'Email' },
      { to: '/settings/notifications/push', label: 'Push' },
      { to: '/settings/notifications/reminders', label: 'Reminders' },
      { to: '/settings/notifications/alerts', label: 'Alerts' }
    ]
  },
  {
    label: 'Reports & Data',
    items: [
      { to: '/settings/reports/preferences', label: 'Report Preferences' },
      { to: '/settings/reports/export', label: 'Export' },
      { to: '/settings/reports/import', label: 'Import' }
    ]
  },
  {
    label: 'Security',
    items: [
      { to: '/settings/security/password', label: 'Password' },
      { to: '/settings/security/2fa', label: 'Two-factor Authentication' },
      { to: '/settings/security/sessions', label: 'Sessions' },
      { to: '/settings/security/activity', label: 'Activity' }
    ]
  },
  {
    label: 'Integrations',
    items: [
      { to: '/settings/integrations/accounts', label: 'Financial Accounts' },
      { to: '/settings/integrations/api', label: 'API Access' }
    ]
  },
  {
    label: 'Workspace',
    items: [
      { to: '/settings/workspace', label: 'Workspace' },
      { to: '/settings/workspace/members', label: 'Members' },
      { to: '/settings/workspace/roles', label: 'Roles' },
      { to: '/settings/workspace/activity', label: 'Activity' }
    ]
  },
  {
    label: 'Danger Zone',
    items: [{ to: '/settings/danger-zone', label: 'Account and Data' }]
  }
];

function SettingsShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentItem = SETTINGS_GROUPS.flatMap((group) => group.items).find((item) => location.pathname === item.to);
  const currentLabel = currentItem?.label || 'Settings overview';

  return (
    <section className="settings-shell" aria-label="Settings">
      <div className="settings-mobile-bar">
        <label htmlFor="settings-category-select">Settings section</label>
        <select
          id="settings-category-select"
          value={location.pathname}
          onChange={(event) => navigate(event.target.value)}
        >
          <option value="/settings">Settings overview</option>
          {SETTINGS_GROUPS.flatMap((group) => group.items).map((item) => (
            <option key={item.to} value={item.to}>{item.label}</option>
          ))}
        </select>
      </div>

      <aside className={`settings-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="settings-sidebar-header">
          <span className="settings-kicker">Workspace</span>
          <h1>Settings</h1>
        </div>
        <nav aria-label="Settings navigation">
          {SETTINGS_GROUPS.map((group) => (
            <div className="settings-nav-group" key={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) => (
                <NavLink
                  className={({ isActive }) => `settings-nav-link${isActive ? ' is-active' : ''}`}
                  to={item.to}
                  key={item.to}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="settings-content">
        <button type="button" className="settings-mobile-toggle" onClick={() => setMobileOpen((open) => !open)} aria-expanded={mobileOpen}>
          {mobileOpen ? 'Close settings navigation' : `Settings navigation: ${currentLabel}`}
        </button>
        <Outlet />
      </div>
    </section>
  );
}

export default SettingsShell;
