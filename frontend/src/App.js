import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import Dashboard from './components/Dashboard/Dashboard';
import ExpenseList from './components/Expenses/ExpenseList';
import AddExpense from './components/Expenses/AddExpense';
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

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  const handleLogin = (token) => {
    localStorage.setItem('token', token);
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setIsAuthenticated(false);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

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
            element={isAuthenticated ? <AppShell onLogout={handleLogout} /> : <Navigate to="/login" />}
          >
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="calendar" element={<CalendarHub />} />
            <Route path="finance" element={<Payments />} />
            <Route path="expenses" element={<ExpenseList />} />
            <Route path="insights" element={<Insights />} />
            <Route path="profile" element={<Profile />} />
            <Route path="add-expense" element={<AddExpense />} />
            <Route path="upload-receipt" element={<UploadReceipt />} />
            <Route
              path="teaching"
              element={<Navigate to="/training-engagements" replace />}
            />
            <Route
              path="training-engagements"
              element={<TrainingEngagementsHub />}
            />
            <Route
              path="vendor"
              element={<Navigate to="/training-engagements" replace />}
            />
            <Route
              path="trainers"
              element={<Trainers />}
            />
            <Route
              path="colleges"
              element={<Colleges />}
            />
            <Route
              path="topics"
              element={<Topics />}
            />
            <Route
              path="organizations"
              element={<Organizations />}
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
