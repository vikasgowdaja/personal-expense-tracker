import React from 'react';
import { Link } from 'react-router-dom';

export function SettingsOverview() {
  return (
    <section className="ops-page settings-page">
      <div className="ops-page-header">
        <span className="settings-breadcrumb">Settings</span>
        <h1>Settings overview</h1>
        <p>Configure your account, financial workflows, notifications, and security from one place.</p>
      </div>
      <div className="settings-overview-grid">
        <Link className="settings-overview-card" to="/settings/profile"><strong>Account</strong><span>Personal details and preferences</span></Link>
        <Link className="settings-overview-card" to="/settings/expenses/categories"><strong>Expense management</strong><span>Categories, rules, and defaults</span></Link>
        <Link className="settings-overview-card" to="/settings/budget/budgets"><strong>Budget & finance</strong><span>Budgets, limits, and goals</span></Link>
        <Link className="settings-overview-card" to="/settings/security/password"><strong>Security</strong><span>Password and account access</span></Link>
        <Link className="settings-overview-card" to="/settings/notifications"><strong>Notifications</strong><span>Alerts, reminders, and summaries</span></Link>
        <Link className="settings-overview-card" to="/settings/reports/export"><strong>Reports & data</strong><span>Export and reporting preferences</span></Link>
      </div>
    </section>
  );
}

export function SettingsDependencyPage({ title, description }) {
  return (
    <section className="ops-page settings-page">
      <div className="ops-page-header">
        <span className="settings-breadcrumb">Settings</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <article className="ops-card settings-dependency-card">
        <h2>This setting is not connected yet</h2>
        <p className="muted">This page is ready in the settings navigation. It will become editable when its database model and API are available.</p>
        <p className="muted">No changes are saved from this screen.</p>
      </article>
    </section>
  );
}
