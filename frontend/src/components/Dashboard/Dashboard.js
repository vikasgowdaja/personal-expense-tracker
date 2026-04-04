import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import './Dashboard.css';

const DEFAULT_TDS_PERCENT = 10;

function inr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function monthKey(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function parseAmount(row) {
  const gross = Number(
    row.grossAmount !== undefined
      ? row.grossAmount
      : row.ratePerDay !== undefined && row.totalDays !== undefined
        ? Number(row.ratePerDay || 0) * Number(row.totalDays || 0)
        : row.totalAmount || 0
  );

  const tds = row.tdsApplicable === false
    ? 0
    : Number(
        row.tdsAmount !== undefined
          ? row.tdsAmount
          : (gross * DEFAULT_TDS_PERCENT) / 100
      );

  const net = Number(
    row.totalAmount !== undefined
      ? row.totalAmount
      : gross - tds
  );

  return { gross, tds, net };
}

function Dashboard() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const engagements = useMemo(
    () => JSON.parse(localStorage.getItem('training_engagements') || '[]'),
    []
  );

  const trainers = useMemo(
    () => JSON.parse(localStorage.getItem('trainer_profiles') || '[]'),
    []
  );

  const settlements = useMemo(
    () => JSON.parse(localStorage.getItem('trainer_settlements') || '[]'),
    []
  );

  const analytics = useMemo(() => {
    const totals = engagements.reduce(
      (acc, row) => {
        const { gross, tds, net } = parseAmount(row);
        acc.gross += gross;
        acc.tds += tds;
        acc.net += net;
        return acc;
      },
      { gross: 0, tds: 0, net: 0 }
    );

    const settledPaidByEngagement = settlements
      .filter((item) => item.status === 'Paid' && item.trainingRecordId)
      .reduce((acc, item) => {
        acc[item.trainingRecordId] = (acc[item.trainingRecordId] || 0) + Number(item.amount || 0);
        return acc;
      }, {});

    const overallSettlementPaid = settlements
      .filter((item) => item.status === 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const overallMarginAmount = totals.net - overallSettlementPaid;
    const overallMarginPercent = totals.net > 0 ? (overallMarginAmount / totals.net) * 100 : 0;

    const monthMap = {};
    const yearMap = {};

    engagements.forEach((row) => {
      const dateRef = row.startDate || row.createdAt;
      const key = monthKey(dateRef);
      if (!key) return;

      const y = Number(key.slice(0, 4));
      const m = key.slice(5, 7);
      const { gross, tds, net } = parseAmount(row);

      if (!monthMap[key]) {
        monthMap[key] = { key, year: y, month: m, gross: 0, tds: 0, net: 0, count: 0 };
      }
      monthMap[key].gross += gross;
      monthMap[key].tds += tds;
      monthMap[key].net += net;
      monthMap[key].count += 1;

      if (!yearMap[y]) {
        yearMap[y] = { year: y, gross: 0, tds: 0, net: 0, count: 0 };
      }
      yearMap[y].gross += gross;
      yearMap[y].tds += tds;
      yearMap[y].net += net;
      yearMap[y].count += 1;
    });

    const monthRows = Object.values(monthMap).sort((a, b) => a.key.localeCompare(b.key));
    const yearlyRows = Object.values(yearMap).sort((a, b) => a.year - b.year);

    const availableYears = [...new Set(monthRows.map((m) => m.year))].sort((a, b) => a - b);
    const monthlyForSelectedYear = monthRows
      .filter((m) => m.year === selectedYear)
      .map((m) => ({
        ...m,
        label: new Date(`${m.key}-01`).toLocaleString('en-IN', { month: 'short' })
      }));

    const engagementMargins = engagements.map((row) => {
      const { net } = parseAmount(row);
      const settlementPaid = Number(settledPaidByEngagement[row.id] || 0);
      const marginAmount = net - settlementPaid;
      const marginPercent = net > 0 ? (marginAmount / net) * 100 : 0;

      return {
        id: row.id,
        label: `${row.college || 'Unknown College'} - ${row.topic || row.notes || 'Training Engagement'}`,
        netRevenue: net,
        settlementPaid,
        marginAmount,
        marginPercent
      };
    });

    return {
      totals,
      overallSettlementPaid,
      overallMarginAmount,
      overallMarginPercent,
      engagementMargins,
      monthlyForSelectedYear,
      yearlyRows,
      availableYears
    };
  }, [engagements, selectedYear, settlements]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>TEMS Revenue Dashboard</h1>
        <p>Overall TDS, overall revenue, in-hand revenue, counts, and month/year analysis.</p>
      </div>

      <div className="summary-cards dashboard-summary-grid">
        <div className="ops-card summary-card teaching-stat-card accent-green">
          <div className="stat-value">{inr(analytics.totals.gross)}</div>
          <div className="stat-label">Overall Revenue (Gross)</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-blue">
          <div className="stat-value">{inr(analytics.totals.tds)}</div>
          <div className="stat-label">Overall TDS</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-purple">
          <div className="stat-value">{inr(analytics.totals.net)}</div>
          <div className="stat-label">In-hand Revenue</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-blue">
          <div className="stat-value">{inr(analytics.overallSettlementPaid)}</div>
          <div className="stat-label">Trainer Settlement (Paid)</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-green">
          <div className="stat-value">{inr(analytics.overallMarginAmount)}</div>
          <div className="stat-label">Company Margin</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card">
          <div className="stat-value">{analytics.overallMarginPercent.toFixed(2)}%</div>
          <div className="stat-label">Margin %</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card">
          <div className="stat-value">{engagements.length}</div>
          <div className="stat-label">No. of Engagements</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card">
          <div className="stat-value">{trainers.length}</div>
          <div className="stat-label">No. of Trainers</div>
        </div>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card chart-card">
          <div className="dashboard-card-header">
            <h3>Per-Month Analysis</h3>
            <select
              className="form-control"
              style={{ width: '140px' }}
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {analytics.availableYears.length === 0 && (
                <option value={selectedYear}>{selectedYear}</option>
              )}
              {analytics.availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          {analytics.monthlyForSelectedYear.length === 0 ? (
            <p className="muted">No monthly data for the selected year.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.monthlyForSelectedYear}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip formatter={(value) => inr(value)} />
                <Bar dataKey="gross" name="Gross" fill="#16a34a" />
                <Bar dataKey="tds" name="TDS" fill="#f59e0b" />
                <Bar dataKey="net" name="In-hand" fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </article>

        <article className="ops-card">
          <h3>Per-Year Analysis</h3>
          {analytics.yearlyRows.length === 0 ? (
            <p className="muted">No yearly data available yet.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>Engagements</th>
                    <th>Gross Revenue</th>
                    <th>TDS</th>
                    <th>In-hand Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.yearlyRows.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td>{row.count}</td>
                      <td>{inr(row.gross)}</td>
                      <td>{inr(row.tds)}</td>
                      <td><strong>{inr(row.net)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </div>

      <article className="ops-card" style={{ marginTop: '1.2rem' }}>
        <h3>Engagement Margin Analysis</h3>
        {analytics.engagementMargins.length === 0 ? (
          <p className="muted">No engagement margin data available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Engagement</th>
                  <th>In-hand Revenue</th>
                  <th>Trainer Settlement (Paid)</th>
                  <th>Margin Amount</th>
                  <th>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.engagementMargins.map((row) => (
                  <tr key={row.id}>
                    <td>{row.label}</td>
                    <td>{inr(row.netRevenue)}</td>
                    <td>{inr(row.settlementPaid)}</td>
                    <td><strong>{inr(row.marginAmount)}</strong></td>
                    <td>{row.marginPercent.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export default Dashboard;
