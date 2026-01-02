import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './Dashboard.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658'];

function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, expensesRes] = await Promise.all([
        expenseAPI.getStats(),
        expenseAPI.getAll()
      ]);
      setStats(statsRes.data);
      setRecentExpenses(expensesRes.data.slice(0, 5));
      setLoading(false);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const chartData = stats?.byCategory ? 
    Object.entries(stats.byCategory).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="container">
      <h1>Dashboard</h1>
      
      <div className="dashboard-grid">
        <div className="card">
          <h3>Total Expenses</h3>
          <div className="stat-value">${stats?.total?.toFixed(2) || '0.00'}</div>
        </div>
        
        <div className="card">
          <h3>Total Transactions</h3>
          <div className="stat-value">{stats?.count || 0}</div>
        </div>
      </div>

      <div className="dashboard-content">
        <div className="card chart-card">
          <h3>Expenses by Category</h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p>No expense data available</p>
          )}
        </div>

        <div className="card">
          <h3>Recent Expenses</h3>
          {recentExpenses.length > 0 ? (
            <div className="recent-expenses">
              {recentExpenses.map((expense) => (
                <div key={expense._id} className="expense-item">
                  <div className="expense-info">
                    <div className="expense-title">{expense.title}</div>
                    <div className="expense-category">{expense.category}</div>
                  </div>
                  <div className="expense-amount">${expense.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p>No expenses yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
