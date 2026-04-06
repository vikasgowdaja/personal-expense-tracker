import React, { useMemo, useState } from 'react';
import './CalendarHub.css';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function formatMonthLabel(date) {
  return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTrainingEngagements() {
  try {
    return JSON.parse(localStorage.getItem('training_engagements') || '[]');
  } catch {
    return [];
  }
}

function getTrainerSettlements() {
  try {
    return JSON.parse(localStorage.getItem('trainer_settlements') || '[]');
  } catch {
    return [];
  }
}

function normalizeDay(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function normalizeDateList(dateList) {
  return [...new Set((dateList || []).filter(Boolean))].sort((a, b) => new Date(a) - new Date(b));
}

function CalendarHub() {
  const [cursorMonth, setCursorMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => formatDateKey(new Date()));
  const [hoverDate, setHoverDate] = useState('');
  const [popupDate, setPopupDate] = useState('');

  const trainingEngagements = getTrainingEngagements();
  const trainerSettlements = getTrainerSettlements();

  const mergedByDate = useMemo(() => {
    const byDate = {};

    const ensureDay = (key) => {
      if (!byDate[key]) {
        byDate[key] = {
          date: key,
          engagementCount: 0,
          settlementCount: 0,
          paidSettlementCount: 0,
          engagements: [],
          settlements: []
        };
      }
      return byDate[key];
    };

    trainingEngagements.forEach((engagement) => {
      const explicitDates = normalizeDateList(engagement.selectedDates || []);
      const datesToMap = explicitDates.length > 0
        ? explicitDates
        : [engagement.startDate, engagement.endDate].filter(Boolean);

      if (explicitDates.length === 0 && datesToMap.length === 2) {
        const start = normalizeDay(engagement.startDate);
        const end = normalizeDay(engagement.endDate || engagement.startDate);
        if (!start || !end) return;
        const from = start.getTime() <= end.getTime() ? start : end;
        const to = start.getTime() <= end.getTime() ? end : start;
        const cursor = new Date(from);
        while (cursor.getTime() <= to.getTime()) {
          const key = formatDateKey(cursor);
          const day = ensureDay(key);
          day.engagementCount += 1;
          day.engagements.push({
            id: engagement.id,
            topic: engagement.topic || engagement.notes || 'Training Engagement',
            college: engagement.college || 'Unknown College',
            organization: engagement.organization || '—',
            trainerName: engagement.trainerName || 'Unknown Trainer',
            paymentStatus: engagement.paymentStatus || 'Invoiced'
          });
          cursor.setDate(cursor.getDate() + 1);
        }
        return;
      }

      datesToMap.forEach((dateValue) => {
        const normalized = normalizeDay(dateValue);
        if (!normalized) return;
        const key = formatDateKey(normalized);
        const day = ensureDay(key);
        day.engagementCount += 1;
        day.engagements.push({
          id: engagement.id,
          topic: engagement.topic || engagement.notes || 'Training Engagement',
          college: engagement.college || 'Unknown College',
          organization: engagement.organization || '—',
          trainerName: engagement.trainerName || 'Unknown Trainer',
          paymentStatus: engagement.paymentStatus || 'Invoiced'
        });
      });
    });

    trainerSettlements.forEach((settlement) => {
      const key = formatDateKey(new Date(settlement.paidDate || settlement.updatedAt || Date.now()));
      const day = ensureDay(key);
      day.settlementCount += 1;
      if (settlement.status === 'Paid') {
        day.paidSettlementCount += 1;
      }
      day.settlements.push({
        id: settlement.id,
        trainerName: settlement.trainerName || 'Unknown Trainer',
        engagementLabel: settlement.engagementLabel || '—',
        amount: Number(settlement.amount || 0),
        status: settlement.status || 'Planned'
      });
    });

    return byDate;
  }, [trainingEngagements, trainerSettlements]);

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
    engagementCount: 0,
    settlementCount: 0,
    paidSettlementCount: 0,
    engagements: [],
    settlements: []
  };

  const popupDetails = mergedByDate[popupDate] || selectedDetails;

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
        <p>TEMS-only calendar synced to training engagements and trainer settlements.</p>
      </div>

      <div className="summary-cards">
        <article className="ops-card stat-card">
          <p>Engagements on Day</p>
          <h3>{selectedDetails.engagementCount}</h3>
        </article>
        <article className="ops-card stat-card pending">
          <p>Settlements Logged</p>
          <h3>{selectedDetails.settlementCount}</h3>
        </article>
        <article className="ops-card stat-card received">
          <p>Settlements Paid</p>
          <h3>{selectedDetails.paidSettlementCount}</h3>
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
              const engagementCount = details?.engagementCount || 0;
              const settlementCount = details?.settlementCount || 0;
              const isSelected = selectedDate === cell.key;
              const isHovering = hoverDate === cell.key;

              return (
                <button
                  type="button"
                  key={cell.key}
                  className={`calendar-cell calendar-cell-day ${isSelected ? 'calendar-cell-selected' : ''}`}
                  onClick={() => {
                    setSelectedDate(cell.key);
                    setPopupDate(cell.key);
                  }}
                  onMouseEnter={() => setHoverDate(cell.key)}
                  onMouseLeave={() => setHoverDate('')}
                  onFocus={() => setHoverDate(cell.key)}
                  onBlur={() => setHoverDate('')}
                >
                  <div className="calendar-day-head">
                    <span>{cell.date.getDate()}</span>
                    <span className={`calendar-dot ${engagementCount > 0 ? 'calendar-dot-hustle' : 'calendar-dot-neutral'}`} />
                  </div>
                  <div className="calendar-cell-meta">
                    <small>{engagementCount} engagements</small>
                    <small>{settlementCount} settlements</small>
                  </div>
                  {isHovering && (
                    <div className="calendar-hover-popup" role="tooltip">
                      <strong>{fmtDate(cell.date)}</strong>
                      <span>{engagementCount} engagements</span>
                      <span>{settlementCount} settlements</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </article>

        <article className="ops-card">
          <h3>Day Details ({selectedDate})</h3>

          <div className="daily-feed-block">
            <h4>Training Engagements</h4>
            {selectedDetails.engagements.length === 0 && <p className="muted">No engagements on this day.</p>}
            {selectedDetails.engagements.map((eng, idx) => (
              <div key={`${eng.id}-${idx}`} className="daily-feed-item">
                <p><strong>{eng.topic}</strong></p>
                <p>{eng.college} | {eng.organization}</p>
                <p>Trainer: {eng.trainerName} | Status: {eng.paymentStatus}</p>
              </div>
            ))}
          </div>

          <div className="daily-feed-block">
            <h4>Trainer Settlements</h4>
            {selectedDetails.settlements.length === 0 && <p className="muted">No settlements logged on this day.</p>}
            {selectedDetails.settlements.map((settlement, index) => (
              <div key={`${settlement.id}-${index}`} className="daily-feed-item">
                <p><strong>{settlement.trainerName}</strong> | {settlement.engagementLabel}</p>
                <p>{fmt(settlement.amount)} | {settlement.status}</p>
              </div>
            ))}
          </div>
        </article>
      </div>

      {popupDate && (
        <div className="calendar-modal-backdrop" onClick={() => setPopupDate('')}>
          <div className="calendar-modal" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-head">
              <h3>{fmtDate(new Date(popupDate))}</h3>
              <button type="button" className="btn btn-secondary" onClick={() => setPopupDate('')}>Close</button>
            </div>
            <div className="calendar-modal-stats">
              <div className="ops-card"><p className="muted">Engagements</p><strong>{popupDetails.engagementCount}</strong></div>
              <div className="ops-card"><p className="muted">Settlements</p><strong>{popupDetails.settlementCount}</strong></div>
              <div className="ops-card"><p className="muted">Paid Settlements</p><strong>{popupDetails.paidSettlementCount}</strong></div>
            </div>
            <div className="calendar-modal-list">
              <h4>Engagement Details</h4>
              {popupDetails.engagements.length === 0 && <p className="muted">No engagements on this day.</p>}
              {popupDetails.engagements.map((eng, idx) => (
                <div key={`${eng.id}-popup-${idx}`} className="daily-feed-item">
                  <p><strong>{eng.topic}</strong></p>
                  <p>{eng.college} | {eng.organization}</p>
                  <p>Trainer: {eng.trainerName}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CalendarHub;
