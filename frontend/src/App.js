import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import EmployeeDashboard from './components/Dashboard/EmployeeDashboard';
import ExpenseList from './components/Expenses/ExpenseList';
import UploadReceipt from './components/Expenses/UploadReceipt';
import AppShell from './components/Layout/AppShell';
import Payments from './components/Payments/Payments';
import Insights from './components/Insights/Insights';
import PlaceholderModule from './components/Common/PlaceholderModule';
import CalendarHub from './components/Calendar/CalendarHub';
import Profile from './components/Profile/Profile';
import TrainingEngagementsHub from './components/TrainingEngagements/TrainingEngagementsHub';
import Colleges from './components/Colleges/Colleges';
import Organizations from './components/Organizations/Organizations';
import Trainers from './components/Trainers/Trainers';
import Topics from './components/Topics/Topics';
import TrainersSettlement from './components/TrainersSettlement/TrainersSettlement';
import FinancialDashboard from './components/Dashboard/FinancialDashboard';
import EmployeeManager from './components/Admin/EmployeeManager';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import { authAPI } from './services/api';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const refreshToken = localStorage.getItem('refreshToken');

    const restoreSession = async () => {
      if (token && savedUser) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.exp && payload.exp * 1000 > Date.now()) {
            // Valid access token — restore immediately
            setIsAuthenticated(true);
            setUser(JSON.parse(savedUser));
            setLoading(false);
            return;
          }
        } catch {
          // Corrupt token — fall through to refresh attempt
        }
      }

      // Access token missing or expired — try refresh token silently
      if (refreshToken) {
        try {
          const res = await authAPI.refresh({ refreshToken });
          const { token: newToken, refreshToken: newRefresh } = res.data;
          localStorage.setItem('token', newToken);
          if (newRefresh) localStorage.setItem('refreshToken', newRefresh);

          // Fetch fresh user profile with the new token
          const { default: axios } = await import('axios');
          const userRes = await axios.get('/api/auth/user', {
            headers: { 'x-auth-token': newToken }
          });
          const freshUser = userRes.data;
          localStorage.setItem('user', JSON.stringify({
            id: freshUser._id,
            name: freshUser.name,
            email: freshUser.email,
            role: freshUser.role,
            adminCode: freshUser.adminCode || '',
            employeeId: freshUser.employeeId,
            defaultConnectionId: freshUser.defaultConnectionId || '',
            connections: freshUser.connections || [],
            mobile: freshUser.mobile,
            profilePhoto: freshUser.profilePhoto
          }));
          setUser({
            id: freshUser._id,
            name: freshUser.name,
            email: freshUser.email,
            role: freshUser.role,
            adminCode: freshUser.adminCode || '',
            employeeId: freshUser.employeeId,
            defaultConnectionId: freshUser.defaultConnectionId || '',
            connections: freshUser.connections || [],
            mobile: freshUser.mobile,
            profilePhoto: freshUser.profilePhoto
          });
          setIsAuthenticated(true);
        } catch {
          // Refresh also failed — clear everything and go to login
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
        }
      } else {
        // No tokens at all — clear stale user data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      setLoading(false);
    };

    restoreSession();
  }, []);

  const handleLogin = (token, userData, refreshToken) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = async () => {
    try { await authAPI.logout(); } catch (_) {}
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  const isPrivileged = user?.role === 'superadmin' || user?.role === 'platform_owner';

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route
            path="/login"
            element={!isAuthenticated ? <Login onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/register"
            element={!isAuthenticated ? <Register onLogin={handleLogin} /> : <Navigate to="/dashboard" />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <AppShell user={user} onLogout={handleLogout} /> : <Navigate to="/login" />}
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route
              path="dashboard"
              element={isPrivileged ? <Dashboard user={user} /> : <EmployeeDashboard user={user} />}
            />
            <Route path="calendar" element={<CalendarHub />} />
            <Route
              path="finance"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <Payments user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="trainer-settlements"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <TrainersSettlement user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="expenses"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <ExpenseList />
                </ProtectedRoute>
              }
            />
            <Route
              path="upload-receipt"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <UploadReceipt />
                </ProtectedRoute>
              }
            />
            <Route
              path="insights"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <Insights user={user} />
                </ProtectedRoute>
              }
            />
            <Route path="profile" element={<Profile />} />
            <Route
              path="teaching"
              element={<Navigate to="/training-engagements" replace />}
            />
            <Route
              path="training-engagements"
              element={<TrainingEngagementsHub user={user} />}
            />
            <Route
              path="vendor"
              element={<Navigate to="/training-engagements" replace />}
            />
            <Route path="trainers" element={<Trainers user={user} />} />
            <Route path="colleges" element={<Colleges />} />
            <Route path="topics" element={<Topics />} />
            <Route path="organizations" element={<Organizations />} />

            {/* Privileged routes (SuperAdmin + Platform Owner) */}
            <Route
              path="financial"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <FinancialDashboard user={user} />
                </ProtectedRoute>
              }
            />
            <Route
              path="employees"
              element={
                <ProtectedRoute user={user} requiredRoles={['superadmin', 'platform_owner']}>
                  <EmployeeManager />
                </ProtectedRoute>
              }
            />

            <Route
              path="settings"
              element={<PlaceholderModule title="Settings" description="Prepare role-based configuration and automation defaults." />}
            />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
