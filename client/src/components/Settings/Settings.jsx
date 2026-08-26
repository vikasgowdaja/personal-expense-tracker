import React, { useState } from 'react';
import { authAPI } from '../../services/api';

function Settings() {
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSetPassword = async (event) => {
    event.preventDefault();
    setMessage('');
    setError('');

    if (passwordForm.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (passwordForm.password !== passwordForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSaving(true);
    try {
      await authAPI.updateUser({ password: passwordForm.password });
      setPasswordForm({ password: '', confirmPassword: '' });
      setMessage('Password updated successfully.');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Settings</h1>
        <p>Manage your password and account security.</p>
      </div>

      <article className="ops-card settings-card">
        <form onSubmit={handleSetPassword} className="settings-form">
          <div className="settings-section-heading">
            <h2>Password</h2>
            <p className="muted">Set or change the password used for password-based login.</p>
          </div>

          <div className="ops-grid-two">
            <div className="form-group">
              <label htmlFor="settings-password">New password</label>
              <div className="password-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control"
                  id="settings-password"
                  value={passwordForm.password}
                  onChange={(event) => setPasswordForm((previous) => ({ ...previous, password: event.target.value }))}
                  minLength="8"
                  required
                />
                <button type="button" className="password-toggle" onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="form-group">
              <label htmlFor="settings-confirm-password">Confirm password</label>
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control"
                  id="settings-confirm-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) => setPasswordForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                  minLength="8"
                  required
                />
                <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((visible) => !visible)}>
                  {showConfirmPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          </div>

          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Saving password...' : 'Save password'}
          </button>
        </form>
      </article>
    </section>
  );
}

export default Settings;
