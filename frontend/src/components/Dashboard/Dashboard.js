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

function dayDiff(fromDateLike, toDateLike) {
  const from = new Date(fromDateLike);
  const to = new Date(toDateLike);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return null;
  }
  from.setHours(0, 0, 0, 0);
  to.setHours(0, 0, 0, 0);
  return Math.floor((to - from) / 86400000);
}

function getCycleAnchorDate(row) {
  return row.endDate || row.startDate || row.createdAt || null;
}

function getPaymentCompletionDate(row) {
  return row.paidDate || row.paymentReceivedDate || row.receivedDate || null;
}

function getOrgCycleStatus(row, ageDays) {
  const status = String(row.paymentStatus || '').toLowerCase();
  if (status === 'paid' || status === 'received') return 'Paid';
  if (ageDays <= 30) return 'Not Matured';
  if (ageDays <= 45) return 'Recovery Due';
  return 'Recovery Overdue';
}

function getTrainerSettlementStatus(settlementsForRow) {
  if (!settlementsForRow.length) return 'Not Started';
  const statuses = settlementsForRow.map((s) => String(s.status || '').toLowerCase());
  const paidCount = statuses.filter((s) => s === 'paid').length;
  if (paidCount === settlementsForRow.length) return 'Paid';
  if (paidCount > 0) return 'Partially Paid';
  return 'Not Started';
}

function statusPillStyle(status) {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'paid') {
    return { background: '#dcfce7', color: '#166534', border: '1px solid #86efac' };
  }
  if (normalized === 'recovery overdue') {
    return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
  }
  if (normalized === 'recovery due') {
    return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
  }
  if (normalized === 'partially paid') {
    return { background: '#ede9fe', color: '#5b21b6', border: '1px solid #c4b5fd' };
  }
  return { background: '#f3f4f6', color: '#6b7280', border: '1px solid #d1d5db' };
}

function isSettlementVisibleForUser(item, user, scopedEngagementIds) {
  if (item.trainingRecordId) {
    return scopedEngagementIds.has(item.trainingRecordId);
  }

  if (!user) return true;

  if (user.role === 'superadmin' || user.role === 'platform_owner') {
    if (item.ownerSuperadminId) {
      return String(item.ownerSuperadminId) === String(user.id);
    }
    return item.sourcedBy === user.employeeId || item.sourcedByName === user.name;
  }

  if (item.sourcedByUserId) {
    return String(item.sourcedByUserId) === String(user.id);
  }
  return item.sourcedBy === user.employeeId || item.sourcedByName === user.name;
}

function Dashboard({ user }) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [cycleTrainerFilter, setCycleTrainerFilter] = useState('');
  const [cycleCollegeFilter, setCycleCollegeFilter] = useState('');
  const [cycleOrgFilter, setCycleOrgFilter] = useState('');
  const [cycleOrgStatusFilter, setCycleOrgStatusFilter] = useState('');
  const [cycleSettlementStatusFilter, setCycleSettlementStatusFilter] = useState('');
  const [cycleFromDate, setCycleFromDate] = useState('');
  const [cycleToDate, setCycleToDate] = useState('');
  const [cycleSortBy, setCycleSortBy] = useState('ageDays');
  const [cycleSortDirection, setCycleSortDirection] = useState('desc');

  const engagements = useMemo(() => {
    const all = JSON.parse(localStorage.getItem('training_engagements') || '[]');
    if (!user) return all;

    if (user.role === 'superadmin' || user.role === 'platform_owner') {
      return all.filter((row) => {
        if (row.ownerSuperadminId) {
          return String(row.ownerSuperadminId) === String(user.id);
        }
        // Legacy fallback rows (before ownerSuperadminId existed)
        return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
      });
    }

    return all.filter((row) => {
      if (row.sourcedByUserId) {
        return String(row.sourcedByUserId) === String(user.id);
      }
      return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
    });
  }, [user]);

  const trainers = useMemo(
    () => JSON.parse(localStorage.getItem('trainer_profiles') || '[]'),
    []
  );

  const settlements = useMemo(() => {
    const all = JSON.parse(localStorage.getItem('trainer_settlements') || '[]');
    const scopedEngagementIds = new Set(engagements.map((row) => row.id));
    return all.filter((item) => isSettlementVisibleForUser(item, user, scopedEngagementIds));
  }, [engagements, user]);

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
      .filter((item) => String(item.status || '').toLowerCase() === 'paid' && item.trainingRecordId)
      .reduce((acc, item) => {
        acc[item.trainingRecordId] = (acc[item.trainingRecordId] || 0) + Number(item.amount || 0);
        return acc;
      }, {});

    const overallSettlementPaid = settlements
      .filter((item) => String(item.status || '').toLowerCase() === 'paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const pendingSettlements = settlements.filter((item) => String(item.status || '').toLowerCase() !== 'paid');
    const pendingSettlementAmount = pendingSettlements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const pendingSettlementCount = pendingSettlements.length;

    const payerPendingRows = engagements.filter((row) => (row.paymentStatus || 'Invoiced').toLowerCase() !== 'paid');
    const pendingRecoveryFromPayers = payerPendingRows.reduce((sum, row) => sum + parseAmount(row).net, 0);
    const pendingRecoveryCount = payerPendingRows.length;

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
        college: row.college || 'Unknown College',
        topic: row.topic || row.notes || 'Training Engagement',
        netRevenue: net,
        settlementPaid,
        marginAmount,
        marginPercent
      };
    });

    const cycleBuckets = {
      dueWithin30: { count: 0, amount: 0 },
      due31to45: { count: 0, amount: 0 },
      dueOver45: { count: 0, amount: 0 },
      paidWithin30: { count: 0, amount: 0 },
      paidWithin45: { count: 0, amount: 0 },
      paidAfter45: { count: 0, amount: 0 },
      paidCycleUnknown: { count: 0, amount: 0 }
    };

    engagements.forEach((row) => {
      const { net } = parseAmount(row);
      const status = String(row.paymentStatus || '').toLowerCase();
      const isPaid = status === 'paid' || status === 'received';
      const anchorDate = getCycleAnchorDate(row);
      if (!anchorDate) {
        return;
      }

      if (!isPaid) {
        const outstandingDays = dayDiff(anchorDate, new Date());
        if (outstandingDays === null || outstandingDays < 0) {
          return;
        }
        if (outstandingDays <= 30) {
          cycleBuckets.dueWithin30.count += 1;
          cycleBuckets.dueWithin30.amount += net;
        } else if (outstandingDays <= 45) {
          cycleBuckets.due31to45.count += 1;
          cycleBuckets.due31to45.amount += net;
        } else {
          cycleBuckets.dueOver45.count += 1;
          cycleBuckets.dueOver45.amount += net;
        }
        return;
      }

      const paidOn = getPaymentCompletionDate(row);
      if (!paidOn) {
        cycleBuckets.paidCycleUnknown.count += 1;
        cycleBuckets.paidCycleUnknown.amount += net;
        return;
      }

      const closureDays = dayDiff(anchorDate, paidOn);
      if (closureDays === null || closureDays < 0) {
        cycleBuckets.paidCycleUnknown.count += 1;
        cycleBuckets.paidCycleUnknown.amount += net;
      } else if (closureDays <= 30) {
        cycleBuckets.paidWithin30.count += 1;
        cycleBuckets.paidWithin30.amount += net;
      } else if (closureDays <= 45) {
        cycleBuckets.paidWithin45.count += 1;
        cycleBuckets.paidWithin45.amount += net;
      } else {
        cycleBuckets.paidAfter45.count += 1;
        cycleBuckets.paidAfter45.amount += net;
      }
    });

    const totalOpenCycleAmount =
      cycleBuckets.dueWithin30.amount +
      cycleBuckets.due31to45.amount +
      cycleBuckets.dueOver45.amount;

    const totalPaidKnownCycleAmount =
      cycleBuckets.paidWithin30.amount +
      cycleBuckets.paidWithin45.amount +
      cycleBuckets.paidAfter45.amount;

    const collectionIn45Rate =
      totalPaidKnownCycleAmount > 0
        ? ((cycleBuckets.paidWithin30.amount + cycleBuckets.paidWithin45.amount) / totalPaidKnownCycleAmount) * 100
        : 0;

    const cycleDetailedBaseRecords = engagements.map((row) => {
      const { net } = parseAmount(row);
      const anchorDate = getCycleAnchorDate(row);
      const ageDays = anchorDate ? Math.max(dayDiff(anchorDate, new Date()) || 0, 0) : 0;
      const orgCycleStatus = getOrgCycleStatus(row, ageDays);
      const settlementsForRow = settlements.filter((s) => s.trainingRecordId === row.id || s.engagementId === row.id);
      const trainerSettlementStatus = getTrainerSettlementStatus(settlementsForRow);
      const paidSettlementAmount = settlementsForRow
        .filter((s) => String(s.status || '').toLowerCase() === 'paid')
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const isOrgPaid = orgCycleStatus === 'Paid';
      const paidFromCompanyPocket = isOrgPaid ? 0 : paidSettlementAmount;
      const yetToRecover = isOrgPaid ? 0 : Math.max(net - paidSettlementAmount, 0);
      const marginLeft = net - paidSettlementAmount;

      return {
        id: row.id,
        trainerName: row.trainerName || 'Independent Engagement',
        college: row.college || 'Unknown College',
        organization: row.organization || 'Unknown Organization',
        engagement: `${row.college || 'Unknown College'} - ${row.topic || row.notes || 'Training Engagement'}`,
        endDate: row.endDate || row.startDate || row.createdAt || null,
        ageDays,
        indicator: ageDays <= 30 ? 'Within 30 days' : ageDays <= 45 ? 'Crossed 30 days' : 'Crossed 45 days',
        orgCycleStatus,
        trainerSettlementStatus,
        paidFromCompanyPocket,
        yetToRecover,
        marginLeft
      };
    });

    return {
      totals,
      overallSettlementPaid,
      pendingSettlementAmount,
      pendingSettlementCount,
      pendingRecoveryFromPayers,
      pendingRecoveryCount,
      overallMarginAmount,
      overallMarginPercent,
      engagementMargins,
      cycleBuckets,
      totalOpenCycleAmount,
      totalPaidKnownCycleAmount,
      collectionIn45Rate,
      cycleDetailedBaseRecords,
      monthlyForSelectedYear,
      yearlyRows,
      availableYears
    };
  }, [engagements, selectedYear, settlements]);

  const cycleFilterOptions = useMemo(() => {
    const trainers = [...new Set(analytics.cycleDetailedBaseRecords.map((r) => r.trainerName))].sort((a, b) => a.localeCompare(b));
    const colleges = [...new Set(analytics.cycleDetailedBaseRecords.map((r) => r.college))].sort((a, b) => a.localeCompare(b));
    const organizations = [...new Set(analytics.cycleDetailedBaseRecords.map((r) => r.organization))].sort((a, b) => a.localeCompare(b));
    return { trainers, colleges, organizations };
  }, [analytics.cycleDetailedBaseRecords]);

  const cycleRows = useMemo(() => {
    const rows = analytics.cycleDetailedBaseRecords.filter((row) => {
      if (cycleTrainerFilter && row.trainerName !== cycleTrainerFilter) return false;
      if (cycleCollegeFilter && row.college !== cycleCollegeFilter) return false;
      if (cycleOrgFilter && row.organization !== cycleOrgFilter) return false;
      if (cycleOrgStatusFilter && row.orgCycleStatus !== cycleOrgStatusFilter) return false;
      if (cycleSettlementStatusFilter && row.trainerSettlementStatus !== cycleSettlementStatusFilter) return false;
      if (cycleFromDate && row.endDate && new Date(row.endDate) < new Date(cycleFromDate)) return false;
      if (cycleToDate && row.endDate && new Date(row.endDate) > new Date(cycleToDate)) return false;
      return true;
    });

    const sorted = [...rows].sort((a, b) => {
      let comparison = 0;
      if (cycleSortBy === 'ageDays') {
        comparison = a.ageDays - b.ageDays;
      } else if (cycleSortBy === 'endDate') {
        comparison = new Date(a.endDate || 0) - new Date(b.endDate || 0);
      } else if (cycleSortBy === 'yetToRecover') {
        comparison = a.yetToRecover - b.yetToRecover;
      } else if (cycleSortBy === 'marginLeft') {
        comparison = a.marginLeft - b.marginLeft;
      }
      return cycleSortDirection === 'asc' ? comparison : -comparison;
    });

    return sorted;
  }, [
    analytics.cycleDetailedBaseRecords,
    cycleTrainerFilter,
    cycleCollegeFilter,
    cycleOrgFilter,
    cycleOrgStatusFilter,
    cycleSettlementStatusFilter,
    cycleFromDate,
    cycleToDate,
    cycleSortBy,
    cycleSortDirection
  ]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>TEMS Revenue Dashboard</h1>
        <p>Overall TDS, overall revenue, in-hand revenue, counts, and month/year analysis.</p>
      </div>

      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
        <div style={{
          background: 'linear-gradient(90deg, #7c3aed 0%, #6366f1 100%)',
          color: '#fff',
          borderRadius: '10px',
          padding: '14px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          <span style={{ fontWeight: 700, fontSize: '14px' }}>SuperAdmin Access</span>
          <a href="/financial" style={{ color: '#e0d9ff', fontSize: '13px', textDecoration: 'underline' }}>
            Financial Reports
          </a>
          <a href="/employees" style={{ color: '#e0d9ff', fontSize: '13px', textDecoration: 'underline' }}>
            Manage Employees
          </a>
        </div>
      )}

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
        {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
          <div className="ops-card summary-card teaching-stat-card accent-blue">
            <div className="stat-value">{inr(analytics.overallSettlementPaid)}</div>
            <div className="stat-label">Trainer Settlement (Paid)</div>
          </div>
        )}
        {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
          <div className="ops-card summary-card teaching-stat-card" style={{ borderLeftColor: '#d97706' }}>
            <div className="stat-value" style={{ color: '#d97706' }}>{inr(analytics.pendingSettlementAmount)}</div>
            <div className="stat-label">Pending Settlements</div>
            <div className="muted" style={{ marginTop: 6, fontSize: '0.75rem' }}>{analytics.pendingSettlementCount} open item(s)</div>
          </div>
        )}
        <div className="ops-card summary-card teaching-stat-card" style={{ borderLeftColor: '#dc2626' }}>
          <div className="stat-value" style={{ color: '#dc2626' }}>{inr(analytics.pendingRecoveryFromPayers)}</div>
          <div className="stat-label">Pending Recovery from Payers</div>
          <div className="muted" style={{ marginTop: 6, fontSize: '0.75rem' }}>{analytics.pendingRecoveryCount} engagement(s) unpaid</div>
        </div>
        {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
          <div className="ops-card summary-card teaching-stat-card accent-green">
            <div className="stat-value">{inr(analytics.overallMarginAmount)}</div>
            <div className="stat-label">Company Margin</div>
          </div>
        )}
        {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
          <div className="ops-card summary-card teaching-stat-card">
            <div className="stat-value">{analytics.overallMarginPercent.toFixed(2)}%</div>
            <div className="stat-label">Margin %</div>
          </div>
        )}
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
                    <th className="sno-th">#</th>
                    <th>Year</th>
                    <th>Engagements</th>
                    <th>Gross Revenue</th>
                    <th>TDS</th>
                    <th>In-hand Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.yearlyRows.map((row, i) => (
                    <tr key={row.year}>
                      <td className="sno-cell">{i + 1}</td>
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

      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
      <article className="ops-card" style={{ marginTop: '1.2rem' }}>
        <h3>30 / 45 Day Cycle Tracking</h3>

        <div style={{ marginTop: '1rem', marginBottom: '0.6rem', fontWeight: 600 }}>Detailed Tracking Records</div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '0.6rem',
          marginBottom: '0.9rem'
        }}>
          <select className="form-control" value={cycleTrainerFilter} onChange={(e) => setCycleTrainerFilter(e.target.value)}>
            <option value="">All Trainers</option>
            {cycleFilterOptions.trainers.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>

          <select className="form-control" value={cycleCollegeFilter} onChange={(e) => setCycleCollegeFilter(e.target.value)}>
            <option value="">All Colleges</option>
            {cycleFilterOptions.colleges.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>

          <select className="form-control" value={cycleOrgFilter} onChange={(e) => setCycleOrgFilter(e.target.value)}>
            <option value="">All Organizations</option>
            {cycleFilterOptions.organizations.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>

          <select className="form-control" value={cycleOrgStatusFilter} onChange={(e) => setCycleOrgStatusFilter(e.target.value)}>
            <option value="">All Org Status</option>
            <option value="Paid">Paid</option>
            <option value="Not Matured">Not Matured</option>
            <option value="Recovery Due">Recovery Due</option>
            <option value="Recovery Overdue">Recovery Overdue</option>
          </select>

          <select className="form-control" value={cycleSettlementStatusFilter} onChange={(e) => setCycleSettlementStatusFilter(e.target.value)}>
            <option value="">All Trainer Status</option>
            <option value="Paid">Paid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Not Started">Not Started</option>
          </select>

          <input className="form-control" type="date" value={cycleFromDate} onChange={(e) => setCycleFromDate(e.target.value)} />
          <input className="form-control" type="date" value={cycleToDate} onChange={(e) => setCycleToDate(e.target.value)} />

          <select className="form-control" value={cycleSortBy} onChange={(e) => setCycleSortBy(e.target.value)}>
            <option value="ageDays">Sort by Age (Days)</option>
            <option value="endDate">Sort by End Date</option>
            <option value="yetToRecover">Sort by Yet To Recover</option>
            <option value="marginLeft">Sort by Margin Left</option>
          </select>

          <select className="form-control" value={cycleSortDirection} onChange={(e) => setCycleSortDirection(e.target.value)}>
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table">
            <thead>
              <tr>
                <th className="sno-th">#</th>
                <th>Trainer</th>
                <th>College</th>
                <th>Organization</th>
                <th>Engagement</th>
                <th>End Date</th>
                <th>Age (Days)</th>
                <th>Indicator</th>
                <th>Org Payment Status</th>
                <th>Trainer Settlement Status</th>
                <th>Paid from Company Pocket</th>
                <th>Yet to Recover</th>
                <th>Margin Left</th>
              </tr>
            </thead>
            <tbody>
              {cycleRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="sno-cell">{index + 1}</td>
                  <td>{row.trainerName}</td>
                  <td><span className="college-cell-badge">{row.college}</span></td>
                  <td>{row.organization}</td>
                  <td>{row.engagement}</td>
                  <td>{row.endDate ? new Date(row.endDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td>{row.ageDays}</td>
                  <td>{row.indicator}</td>
                  <td>
                    <span style={{ ...statusPillStyle(row.orgCycleStatus), padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                      {row.orgCycleStatus}
                    </span>
                  </td>
                  <td>
                    <span style={{ ...statusPillStyle(row.trainerSettlementStatus), padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
                      {row.trainerSettlementStatus}
                    </span>
                  </td>
                  <td style={{ color: row.paidFromCompanyPocket > 0 ? '#dc2626' : '#9ca3af', fontWeight: 600 }}>
                    {row.paidFromCompanyPocket > 0 ? `-${inr(row.paidFromCompanyPocket).replace('₹', '₹')}` : '—'}
                  </td>
                  <td style={{ color: row.yetToRecover > 0 ? '#dc2626' : '#9ca3af', fontWeight: 600 }}>
                    {row.yetToRecover > 0 ? `-${inr(row.yetToRecover).replace('₹', '₹')}` : '—'}
                  </td>
                  <td style={{ color: row.marginLeft >= 0 ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{inr(row.marginLeft)}</td>
                </tr>
              ))}
              {cycleRows.length === 0 && (
                <tr>
                  <td colSpan={13} style={{ textAlign: 'center', color: '#9ca3af', padding: '1rem' }}>
                    No records match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      )}

      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
      <article className="ops-card" style={{ marginTop: '1.2rem' }}>
        <h3>Engagement Margin Analysis</h3>
        {analytics.engagementMargins.length === 0 ? (
          <p className="muted">No engagement margin data available.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th className="sno-th">#</th>
                  <th>College</th>
                  <th>Topic</th>
                  <th>In-hand Revenue</th>
                  <th>Trainer Settlement (Paid)</th>
                  <th>Margin Amount</th>
                  <th>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {analytics.engagementMargins.map((row, i) => (
                  <tr key={row.id}>
                    <td className="sno-cell">{i + 1}</td>
                    <td><span className="college-cell-badge">{row.college}</span></td>
                    <td>{row.topic}</td>
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
      )}
    </section>
  );
}

export default Dashboard;
