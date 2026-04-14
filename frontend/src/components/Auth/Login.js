import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../../services/api';
import './Auth.css';

function Login({ onLogin }) {
  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [step, setStep] = useState('input');    // 'input' | 'verify' (OTP mode)
  const [formData, setFormData] = useState({ email: '', password: '', otp: '' });
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.login({ email: formData.email, password: formData.password });
      onLogin(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await authAPI.requestOTP({ email: formData.email });
      setInfo('OTP sent to your email. Check your inbox.');
      setStep('verify');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authAPI.loginOTP({ email: formData.email, otp: formData.otp });
      onLogin(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>

        <div className="auth-mode-tabs">
          <button
            className={`auth-tab ${mode === 'password' ? 'active' : ''}`}
            onClick={() => { setMode('password'); setStep('input'); setError(''); setInfo(''); }}
            type="button"
          >
            Password
          </button>
          <button
            className={`auth-tab ${mode === 'otp' ? 'active' : ''}`}
            onClick={() => { setMode('otp'); setStep('input'); setError(''); setInfo(''); }}
            type="button"
          >
            Email OTP
          </button>
        </div>

        {mode === 'password' && (
          <form onSubmit={handlePasswordLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                className="form-control"
                id="email"
                name="email"
                value={formData.email}
                onChange={onChange}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                type="password"
                className="form-control"
                id="password"
                name="password"
                value={formData.password}
                onChange={onChange}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Logging in…' : 'Login'}
            </button>
          </form>
        )}

        {mode === 'otp' && step === 'input' && (
          <form onSubmit={handleRequestOTP}>
            <div className="form-group">
              <label htmlFor="otp-email">Email</label>
              <input
                type="email"
                className="form-control"
                id="otp-email"
                name="email"
                value={formData.email}
                onChange={onChange}
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            {info && <div className="info">{info}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Sending OTP…' : 'Send OTP'}
            </button>
          </form>
        )}

        {mode === 'otp' && step === 'verify' && (
          <form onSubmit={handleOTPLogin}>
            <p className="info">{info}</p>
            <div className="form-group">
              <label htmlFor="otp">Enter OTP</label>
              <input
                type="text"
                className="form-control"
                id="otp"
                name="otp"
                value={formData.otp}
                onChange={onChange}
                maxLength={6}
                placeholder="6-digit code"
                required
              />
            </div>
            {error && <div className="error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Verifying…' : 'Login with OTP'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              onClick={() => setStep('input')}
              style={{ marginTop: '8px' }}
            >
              Back
            </button>
          </form>
        )}

        <p className="auth-link">
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;

