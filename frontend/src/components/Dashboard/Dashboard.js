import React, { useState, useEffect } from 'react';
import { expenseAPI } from '../../services/api';
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import './Dashboard.css';

const SPLIT_COLORS = {
  fullTime: '#3b82f6',
  hustle: '#16a34a',
  both: '#7c3aed'
};

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

  const logs = JSON.parse(localStorage.getItem('daily_logs') || '[]');

  const dayTypeBreakdown = logs.reduce(
    (acc, entry) => {
      if (entry.dayType === 'full-time') acc.fullTime += 1;
      if (entry.dayType === 'hustle') acc.hustle += 1;
      if (entry.dayType === 'both') acc.both += 1;
      return acc;
    },
    { fullTime: 0, hustle: 0, both: 0 }
  );

  const splitData = [
    { name: 'Full-time', value: dayTypeBreakdown.fullTime, color: SPLIT_COLORS.fullTime },
    { name: 'Hustle', value: dayTypeBreakdown.hustle, color: SPLIT_COLORS.hustle },
    { name: 'Both', value: dayTypeBreakdown.both, color: SPLIT_COLORS.both }
  ];

  const weeklyTrend = Array.from({ length: 7 }).map((_, index) => {
    const expense = recentExpenses[index]?.amount || 0;
    const productivity = logs[index]?.dayType === 'both' ? 90 : logs[index]?.dayType === 'hustle' ? 70 : 50;
    return {
      day: `D${index + 1}`,
      expense,
      productivity
    };
  });

  const pendingPayments = logs
    .filter((item) => item.finance?.status === 'pending')
    .reduce((sum, item) => sum + Number(item.finance?.amount || 0), 0);

  const totalReceived = logs
    .filter((item) => item.finance?.status === 'received')
    .reduce((sum, item) => sum + Number(item.finance?.amount || 0), 0);

  const todayBadge = dayTypeBreakdown.both > 0 ? 'BOTH' : dayTypeBreakdown.hustle > dayTypeBreakdown.fullTime ? 'HUSTLE' : 'FULL-TIME';

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Smart Dashboard</h1>
        <p>Single-glance status with trend context and suggested focus.</p>
      </div>

      <div className="summary-cards">
        <div className="ops-card stat-card">
          <p>Day Classification</p>
          <h3>{todayBadge}</h3>
          <span className={`status-pill ${todayBadge === 'FULL-TIME' ? 'full-time' : todayBadge === 'HUSTLE' ? 'hustle' : 'both'}`}>
            Today signal
          </span>
        </div>

        <div className="ops-card stat-card received">
          <p>Earnings Snapshot</p>
          <h3>${totalReceived.toFixed(2)}</h3>
          <span className="muted">Captured from structured daily logs</span>
        </div>

        <div className="ops-card stat-card pending">
          <p>Pending Payments</p>
          <h3>${pendingPayments.toFixed(2)}</h3>
          <span className="muted">Red indicates follow-up needed</span>
        </div>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card chart-card">
          <h3>Productivity Split</h3>
          {splitData.some((item) => item.value > 0) ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={splitData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={86}
                  dataKey="value"
                >
                  {splitData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted">No daily logs yet. Add your first voice log to see split analytics.</p>
          )}
        </article>

        <article className="ops-card chart-card">
          <h3>Today vs Weekly Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={weeklyTrend}>
              <defs>
                <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip />
              <Area type="monotone" dataKey="expense" stroke="#ef4444" fillOpacity={1} fill="url(#colorExpense)" />
              <Area type="monotone" dataKey="productivity" stroke="#3b82f6" fillOpacity={0} />
            </AreaChart>
          </ResponsiveContainer>
        </article>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card">
          <h3>Activity Timeline</h3>
          {recentExpenses.length > 0 ? (
            <div className="timeline">
              {recentExpenses.map((expense) => (
                <div key={expense._id} className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <strong>{expense.title}</strong>
                    <p className="muted">{expense.category}</p>
                  </div>
                  <div className="expense-amount">${expense.amount.toFixed(2)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">No activity entries yet.</p>
          )}
        </article>

        <article className="ops-card">
          <h3>AI Insight Snapshot</h3>
          <div className="insight-stack">
            <p className="insight-inline">
              {todayBadge === 'BOTH'
                ? 'Balanced day profile detected. Protect deep-work blocks to avoid context switching overhead.'
                : 'Single-mode day profile detected. Consider adding one focused hustle block to diversify earnings.'}
            </p>
            <p className="insight-inline">
              {pendingPayments > 0
                ? `Pending payments at $${pendingPayments.toFixed(2)}. Trigger follow-up reminders today.`
                : 'No pending payouts. Cash flow is clean for the current snapshot.'}
            </p>
            <p className="insight-inline">Total tracked expenses: ${stats?.total?.toFixed(2) || '0.00'} across {stats?.count || 0} entries.</p>
          </div>
        </article>
      </div>
    </section>
  );
}

export default Dashboard;
