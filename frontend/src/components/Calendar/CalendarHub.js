import React, { useEffect, useMemo, useState } from 'react';
import { expenseAPI } from '../../services/api';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function getDayTypeClass(dayType) {
  if (dayType === 'full-time') return 'calendar-dot-full-time';
  if (dayType === 'hustle') return 'calendar-dot-hustle';
  if (dayType === 'both') return 'calendar-dot-both';
  return 'calendar-dot-neutral';
}

function CalendarHub() {
  const [cursorMonth, setCursorMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));

  useEffect(() => {
    const load = async () => {
      try {
        const res = await expenseAPI.getAll();
        setExpenses(res.data || []);
      } catch (error) {
        console.error('Calendar expense sync failed:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const dailyLogs = useMemo(() => {
    return JSON.parse(localStorage.getItem('daily_logs') || '[]');
  }, []);

  const mergedByDate = useMemo(() => {
    const byDate = {};

    dailyLogs.forEach((log) => {
      const key = formatDateKey(new Date(log.createdAt || Date.now()));
      if (!byDate[key]) {
        byDate[key] = {
          date: key,
          logs: [],
          payments: [],
          expenses: [],
          dayType: 'unknown'
        };
      }

      byDate[key].logs.push(log);
      byDate[key].dayType = log.dayType || byDate[key].dayType;

      if (log.finance?.amount) {
        byDate[key].payments.push({
          amount: Number(log.finance.amount || 0),
          status: log.finance.status || 'received',
          source: 'voice-log'
        });
      }
    });

    expenses.forEach((expense) => {
      const key = formatDateKey(new Date(expense.date || Date.now()));
      if (!byDate[key]) {
        byDate[key] = {
          date: key,
          logs: [],
          payments: [],
          expenses: [],
          dayType: 'unknown'
        };
      }

      byDate[key].expenses.push(expense);
      const status = expense.description?.toLowerCase().includes('pending') ? 'pending' : 'received';
      byDate[key].payments.push({
        amount: Number(expense.amount || 0),
        status,
        source: expense.category || 'expense'
      });
    });

    return byDate;
  }, [dailyLogs, expenses]);

  const monthCells = useMemo(() => {
    const startDay = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), 1);
    const endDay = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth() + 1, 0);

    const totalDays = endDay.getDate();
    const leadingBlanks = startDay.getDay();

    const cells = [];

    for (let i = 0; i < leadingBlanks; i += 1) {
      cells.push({ key: `blank-${i}`, isCurrentMonth: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(cursorMonth.getFullYear(), cursorMonth.getMonth(), day);
      const key = formatDateKey(date);
      cells.push({
        key,
        date,
        isCurrentMonth: true,
        details: mergedByDate[key]
      });
    }

    return cells;
  }, [cursorMonth, mergedByDate]);

  const selectedDetails = mergedByDate[selectedDate] || {
    date: selectedDate,
    logs: [],
    payments: [],
    expenses: [],
    dayType: 'unknown'
  };

  const selectedPending = selectedDetails.payments
    .filter((item) => item.status === 'pending')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const selectedReceived = selectedDetails.payments
    .filter((item) => item.status === 'received')
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const goToPrevMonth = () => {
    setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCursorMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Calendar Sync</h1>
        <p>Daily command center synced with schedule, payments, and activity logs.</p>
      </div>

      <div className="summary-cards">
        <article className="ops-card stat-card">
          <p>Selected Day Type</p>
          <h3>{selectedDetails.dayType.toUpperCase()}</h3>
        </article>
        <article className="ops-card stat-card pending">
          <p>Pending on Day</p>
          <h3>${selectedPending.toFixed(2)}</h3>
        </article>
        <article className="ops-card stat-card received">
          <p>Received on Day</p>
          <h3>${selectedReceived.toFixed(2)}</h3>
        </article>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card">
          <div className="calendar-toolbar">
            <button className="btn btn-secondary" onClick={goToPrevMonth}>Previous</button>
            <h3>{formatMonthLabel(cursorMonth)}</h3>
            <button className="btn btn-secondary" onClick={goToNextMonth}>Next</button>
          </div>

          <div className="calendar-grid calendar-head">
            {WEEK_DAYS.map((label) => (
              <span key={label} className="calendar-head-cell">{label}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {monthCells.map((cell) => {
              if (!cell.isCurrentMonth) {
                return <div key={cell.key} className="calendar-cell calendar-cell-blank" />;
              }

              const details = cell.details;
              const paymentCount = details?.payments?.length || 0;
              const logCount = details?.logs?.length || 0;
              const isSelected = selectedDate === cell.key;

              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`calendar-cell calendar-cell-day ${isSelected ? 'calendar-cell-selected' : ''}`}
                  onClick={() => setSelectedDate(cell.key)}
                >
                  <div className="calendar-day-head">
                    <span>{cell.date.getDate()}</span>
                    <span className={`calendar-dot ${getDayTypeClass(details?.dayType)}`} />
                  </div>
                  <div className="calendar-cell-meta">
                    <small>{logCount} logs</small>
                    <small>{paymentCount} payments</small>
                  </div>
                </button>
              );
            })}
          </div>
        </article>

        <article className="ops-card">
          <h3>Daily Unified Feed ({selectedDate})</h3>
          {loading && <p className="muted">Syncing backend expenses...</p>}

          <div className="daily-feed-block">
            <h4>Work and Schedule</h4>
            {selectedDetails.logs.length === 0 && <p className="muted">No voice logs for this day.</p>}
            {selectedDetails.logs.map((log) => (
              <div key={log.id} className="daily-feed-item">
                <span className={`status-pill ${log.dayType || 'full-time'}`}>{log.dayType || 'unknown'}</span>
                <p>{log.transcript || 'No transcript text provided.'}</p>
              </div>
            ))}
          </div>

          <div className="daily-feed-block">
            <h4>Payments</h4>
            {selectedDetails.payments.length === 0 && <p className="muted">No payment events for this day.</p>}
            {selectedDetails.payments.map((payment, index) => (
              <div key={`${payment.source}-${index}`} className="daily-feed-item">
                <span className={`status-pill ${payment.status}`}>{payment.status}</span>
                <p>{payment.source}: ${Number(payment.amount || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="daily-feed-block">
            <h4>Expense Records</h4>
            {selectedDetails.expenses.length === 0 && <p className="muted">No expense entries on this date.</p>}
            {selectedDetails.expenses.map((expense) => (
              <div key={expense._id} className="daily-feed-item">
                <p>
                  {expense.title} ({expense.category}) - ${Number(expense.amount || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </article>
      </div>
    </section>
  );
}

export default CalendarHub;
