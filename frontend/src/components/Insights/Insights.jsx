import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { expenseAPI, trainerSettlementAPI, trainingEngagementAPI } from '../../services/api';
import InsightDetailPage from './InsightDetailPage';

const DEFAULT_TDS_PERCENT = 10;

function inr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function formatDate(value) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN');
}

function parsePaymentStatus(description) {
  const tagged = (description || '').match(/PaymentStatus:(pending|received)/i);
  if (tagged) return tagged[1].toLowerCase();
  return (description || '').toLowerCase().includes('pending') ? 'pending' : 'received';
}

function isDebtExpenseRecord(row) {
  const entryType = String(row?.entryType || '').toLowerCase();
  if (entryType === 'debt' || entryType === 'credit_card_bill') return true;
  const paymentState = String(row?.paymentState || '').toLowerCase();
  if (paymentState === 'pending' || paymentState === 'partially_paid') {
    const scope = String(row?.expenseScope || '').toLowerCase();
    if (scope.startsWith('trainer_') || scope === 'general') return true;
  }
  const text = `${row?.title || ''} ${row?.description || ''}`.toLowerCase();
  if (!text.trim()) return false;
  return /(credit\s*card|cc\s*bill|card\s*bill|emi|loan|debt|liabilit|interest|minimum\s*due|outstanding)/i.test(text);
}

function parseEngagementNet(row) {
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
  return Number(row.totalAmount !== undefined ? row.totalAmount : gross - tds);
}

function normalizeApiEngagement(row) {
  const firstTrainer = Array.isArray(row.trainers) && row.trainers.length > 0 ? row.trainers[0] : null;
  const trainerDoc = firstTrainer?.trainerId;
  return {
    id: row._id,
    trainerId: trainerDoc?._id || firstTrainer?.trainerId || '',
    trainerName: trainerDoc?.fullName || '',
    college: row.institutionId?.name || '',
    organization: row.clientId?.name || '',
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    totalDays: Number(row.totalDays || 0),
    paymentStatus: row.status || 'Invoiced',
    topic: firstTrainer?.trainingTopic || row.engagementTitle || row.notes || 'Training',
    notes: row.notes || '',
    ratePerDay: Number(firstTrainer?.dailyRate || 0),
    grossAmount: Number(row.grossAmount !== undefined ? row.grossAmount : row.totalAmount || 0),
    tdsApplicable: row.tdsApplicable !== false,
    tdsAmount: Number(row.tdsAmount || 0),
    totalAmount: Number(row.totalAmount || 0),
    ownerSuperadminId: row.ownerSuperadminId || '',
    sourcedByUserId: row.sourcedByUserId || '',
    sourcedBy: row.sourcedBy || '',
    sourcedByName: row.sourcedByName || ''
  };
}

function normalizeSettlementRow(row) {
  const trainingId = typeof row.trainingEngagementId === 'object'
    ? row.trainingEngagementId?._id
    : row.trainingEngagementId;

  return {
    id: row._id,
    trainingRecordId: trainingId ? String(trainingId) : '',
    status: row.status || 'Planned',
    amount: Number(row.amount || 0),
    paidDate: row.paidDate || null
  };
}

function ProfitLossBadge({ isProfit, isBreakEven }) {
  if (isBreakEven) {
    return (
      <span className="status-pill" style={{ color: '#92400e', background: '#fef3c7', fontSize: '1rem', padding: '6px 16px' }}>
        BREAK-EVEN
      </span>
    );
  }
  if (isProfit) {
    return (
      <span className="status-pill received" style={{ fontSize: '1rem', padding: '6px 16px' }}>
        IN PROFIT
      </span>
    );
  }
  return (
    <span className="status-pill pending" style={{ fontSize: '1rem', padding: '6px 16px' }}>
      IN LOSS
    </span>
  );
}

function RecoveryBar({ recovered, total }) {
  const pct = total > 0 ? Math.min(100, (recovered / total) * 100) : 0;
  const color = pct >= 80 ? '#16a34a' : pct >= 40 ? '#d97706' : '#dc2626';
  return (
    <div style={{ marginTop: 8 }}>
      <div className="teaching-bar-track" style={{ height: 12, borderRadius: 999 }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 999,
            transition: 'width 0.5s ease'
          }}
        />
      </div>
      <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
        {pct.toFixed(1)}% recovered from payers / debtor organizations
      </p>
    </div>
  );
}

function InsightSummaryCard({ accentClass = '', borderLeftColor, valueColor, value, label, helperText, onClick }) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`ops-card summary-card teaching-stat-card ${accentClass}`.trim()}
      style={{ borderLeftColor, cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
    >
      <div className="stat-value" style={valueColor ? { color: valueColor } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      <div className="muted" style={{ marginTop: 6, fontSize: '0.75rem' }}>{helperText || 'More info'}</div>
    </div>
  );
}

function isEngagementVisibleForUser(row, user) {
  if (!user) return true;

  if (user.role === 'platform_owner') {
    return true;
  }

  if (user.role === 'superadmin') {
    if (row.ownerSuperadminId) {
      return String(row.ownerSuperadminId) === String(user.id);
    }
    return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
  }

  if (row.sourcedByUserId) {
    return String(row.sourcedByUserId) === String(user.id);
  }
  return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
}

function Insights({ user }) {
  const navigate = useNavigate();
  const { detailKey } = useParams();
  const [financeRecords, setFinanceRecords] = useState([]);
  const [loadingFinance, setLoadingFinance] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [logs, setLogs] = useState([]);
  const [allEngagements, setAllEngagements] = useState([]);
  const [allSettlements, setAllSettlements] = useState([]);

  const triggerRefresh = useCallback(() => {
    setRefreshKey((v) => v + 1);
  }, []);

  const loadFinancialInputs = useCallback(async () => {
    setLoadingFinance(true);
    try {
      const [expenseRes, engagementRes, settlementRes] = await Promise.all([
        expenseAPI.getAll(),
        trainingEngagementAPI.getAll(),
        trainerSettlementAPI.getAll()
      ]);

      const expenseRows = Array.isArray(expenseRes.data) ? expenseRes.data : [];
      const engagementRows = Array.isArray(engagementRes.data) ? engagementRes.data : [];
      const settlementRows = Array.isArray(settlementRes.data) ? settlementRes.data : [];

      setFinanceRecords(expenseRows);
      setAllEngagements(engagementRows.map(normalizeApiEngagement));
      setAllSettlements(settlementRows.map(normalizeSettlementRow));
    } catch {
      setFinanceRecords([]);
      setAllEngagements([]);
      setAllSettlements([]);
    } finally {
      setLoadingFinance(false);
    }
  }, []);

  useEffect(() => {
    try {
      setLogs(JSON.parse(localStorage.getItem('daily_logs') || '[]'));
    } catch {
      setLogs([]);
    }
  }, [refreshKey]);

  const engagements = useMemo(() => {
    return allEngagements.filter((row) => isEngagementVisibleForUser(row, user));
  }, [allEngagements, user]);

  const settlements = useMemo(() => {
    const engagementIds = new Set(engagements.map((row) => row.id));

    return allSettlements.filter((item) => {
      if (item.trainingRecordId) {
        return engagementIds.has(item.trainingRecordId);
      }

      return true;
    });
  }, [allSettlements, engagements]);

  useEffect(() => {
    const keysToWatch = new Set(['training_engagements', 'trainer_settlements', 'daily_logs']);
    const onStorage = (event) => {
      if (keysToWatch.has(event.key)) triggerRefresh();
    };
    const onDataChanged = (event) => {
      if (keysToWatch.has(event?.detail?.key)) triggerRefresh();
    };
    const onFinancialSync = () => triggerRefresh();
    const onFocus = () => triggerRefresh();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') triggerRefresh();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('ops-data-changed', onDataChanged);
    window.addEventListener('ops-financial-sync', onFinancialSync);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ops-data-changed', onDataChanged);
      window.removeEventListener('ops-financial-sync', onFinancialSync);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [triggerRefresh]);

  useEffect(() => {
    loadFinancialInputs();
  }, [loadFinancialInputs, refreshKey]);

  // ── Daily log aggregates ──────────────────────────────────────────────────
  const logAggregate = useMemo(() => {
    const base = { fullTimeDays: 0, hustleDays: 0, bothDays: 0, topTopic: 'N/A' };
    const topicCount = {};
    logs.forEach((log) => {
      if (log.dayType === 'full-time') base.fullTimeDays += 1;
      if (log.dayType === 'hustle') base.hustleDays += 1;
      if (log.dayType === 'both') base.bothDays += 1;
      const topic = (log.teaching?.topic || '').trim();
      if (topic) topicCount[topic] = (topicCount[topic] || 0) + 1;
    });
    let highest = 0;
    Object.entries(topicCount).forEach(([topic, count]) => {
      if (count > highest) { highest = count; base.topTopic = topic; }
    });
    return base;
  }, [logs]);

  // ── Core profit / loss engine ─────────────────────────────────────────────
  const profitEngine = useMemo(() => {
    // 1. Total revenue billed to client organizations (training engagements)
    const totalBilled = engagements.reduce((sum, row) => sum + parseEngagementNet(row), 0);

    // 2. Trainer cost: amounts the company has ALREADY paid out to trainers
    const trainersPaid = settlements
      .filter((s) => (s.status || '').toLowerCase() === 'paid')
      .reduce((sum, s) => sum + Number(s.amount || 0), 0);

    const pendingSettlements = settlements.filter((s) => (s.status || '').toLowerCase() !== 'paid');
    const pendingSettlementAmount = pendingSettlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);
    const pendingSettlementCount = pendingSettlements.length;

    const payerPendingRows = engagements.filter((row) => (row.paymentStatus || 'Invoiced').toLowerCase() !== 'paid');
    const pendingRecoveryFromPayers = payerPendingRows.reduce((sum, row) => sum + parseEngagementNet(row), 0);
    const pendingRecoveryCount = payerPendingRows.length;

    // 3. Finance records split: pending = company paid from pocket but NOT yet recovered
    const financeReceived = financeRecords
      .filter((r) => parsePaymentStatus(r.description) === 'received')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const financePending = financeRecords
      .filter((r) => parsePaymentStatus(r.description) === 'pending')
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);

    const creditCardDebt = financeRecords
      .filter((r) => isDebtExpenseRecord(r))
      .reduce((sum, r) => sum + Number(r.amount || 0), 0);
    const totalExpenses = financeRecords.reduce((sum, r) => sum + Number(r.amount || 0), 0);

    // 4. Total money company has paid out (trainers + any pending finance outflows)
    const totalPaidOut = trainersPaid + financePending;

    // 5. Source-of-truth recovered cash from organizations (Paid engagements)
    const totalRecovered = engagements
      .filter((row) => (row.paymentStatus || 'Invoiced').toLowerCase() === 'paid')
      .reduce((sum, row) => sum + parseEngagementNet(row), 0);

    // 6. Gross margin: what the company earned over trainer cost (based on billings)
    const grossMargin = totalBilled - trainersPaid;
    const grossMarginPct = totalBilled > 0 ? (grossMargin / totalBilled) * 100 : 0;

    // 7. Net cash position: recovered cash minus what the company paid from pocket
    const netCashPosition = totalRecovered - totalPaidOut;

    // 8. Outstanding: billed but not yet in hand
    const outstandingFromOrgs = totalBilled - totalRecovered;

    // 9. Status
    const isProfit = grossMargin > 0;
    const isBreakEven = grossMargin === 0 && totalBilled > 0;

    // 10. Recovery ratio
    const recoveryRatio = totalBilled > 0 ? totalRecovered / totalBilled : 0;

    // 11. Per-engagement settlement breakdown
    const settledPaidByEngagement = settlements
      .filter((s) => (s.status || '').toLowerCase() === 'paid' && s.trainingRecordId)
      .reduce((acc, s) => {
        acc[s.trainingRecordId] = (acc[s.trainingRecordId] || 0) + Number(s.amount || 0);
        return acc;
      }, {});

    const engagementMargins = engagements.map((row) => {
      const net = parseEngagementNet(row);
      const settlementPaid = Number(settledPaidByEngagement[row.id] || 0);
      const marginAmount = net - settlementPaid;
      const marginPct = net > 0 ? (marginAmount / net) * 100 : 0;
        const orgHasPaid = (row.paymentStatus || '').toLowerCase() === 'paid';
        const companyOutOfPocket = !orgHasPaid && settlementPaid > 0;
        return {
          id: row.id,
          label: `${row.college || row.organization || 'Unknown Org'} — ${row.topic || row.notes || 'Training'}`,
          college: row.college || row.organization || 'Unknown Org',
          topic: row.topic || row.notes || 'Training',
          netRevenue: net,
          settlementPaid,
          marginAmount,
          marginPct,
          isLoss: marginAmount < 0,
          orgHasPaid,
          paymentStatus: row.paymentStatus || 'Invoiced',
          companyOutOfPocket
        };
    });

      // 12. Advance exposure: trainer already paid but org hasn't paid the company yet
      const advanceExposureRows = engagementMargins.filter((r) => r.companyOutOfPocket);
      const totalAdvanceExposure = advanceExposureRows.reduce((sum, r) => sum + r.settlementPaid, 0);
      const advanceExpectedRevenueTotal = advanceExposureRows.reduce((sum, r) => sum + r.netRevenue, 0);

    // 13. Debt clearance and final in-hand projections
    const expectedRevenueTotal = totalBilled;
    const totalDebtToClear = pendingSettlementAmount + financePending + creditCardDebt;
    const ultimateInHandAfterDebtClearance = expectedRevenueTotal - trainersPaid - totalDebtToClear;
    const receivableAfterDebtClearance = pendingRecoveryFromPayers - totalDebtToClear;
    const actualLeftAfterTotalExpenses = expectedRevenueTotal - totalExpenses;

    return {
      totalBilled,
      trainersPaid,
      pendingSettlementAmount,
      pendingSettlementCount,
      pendingRecoveryFromPayers,
      pendingRecoveryCount,
      financeReceived,
      financePending,
      totalPaidOut,
      totalRecovered,
      grossMargin,
      grossMarginPct,
      netCashPosition,
      outstandingFromOrgs,
      creditCardDebt,
      totalExpenses,
      expectedRevenueTotal,
      totalDebtToClear,
      ultimateInHandAfterDebtClearance,
      receivableAfterDebtClearance,
      actualLeftAfterTotalExpenses,
      isProfit,
      isBreakEven,
      recoveryRatio,
        engagementMargins,
        advanceExposureRows,
        totalAdvanceExposure,
        advanceExpectedRevenueTotal
    };
  }, [engagements, settlements, financeRecords]);

  // ── AI Insight text ───────────────────────────────────────────────────────
  const aiVerdict = useMemo(() => {
    const { isProfit, isBreakEven, grossMargin, grossMarginPct, financePending, outstandingFromOrgs, recoveryRatio } = profitEngine;

    if (isBreakEven) {
      return 'Company is at break-even. Revenue exactly covers trainer costs. No margin buffer — any unrecovered amount flips this to a loss.';
    }
    if (!isProfit) {
      const reasons = [];
      if (financePending > 0) reasons.push(`₹${Number(financePending).toLocaleString('en-IN')} paid from company pocket not yet recovered from payer organizations`);
      if (outstandingFromOrgs > 0) reasons.push(`₹${Number(outstandingFromOrgs).toLocaleString('en-IN')} billed but not yet collected from debtor institutions`);
      const recoveryPct = (recoveryRatio * 100).toFixed(1);
      return `Company is in LOSS. Trainer costs exceed recovered revenue. ${reasons.join('; ')}. Only ${recoveryPct}% of billed amount has been recovered. Follow up with payer organizations urgently to close this gap.`;
    }
    if (recoveryRatio < 0.5) {
      return `Company shows a gross margin of ${grossMarginPct.toFixed(1)}% on paper (${inr(grossMargin)}), but less than 50% has been recovered from client organizations. Cash flow is under strain — the company is funding operations from its own pocket until payments arrive.`;
    }
    if (recoveryRatio < 0.8) {
      return `Gross margin is ${grossMarginPct.toFixed(1)}% (${inr(grossMargin)}). Recovery rate is moderate at ${(recoveryRatio * 100).toFixed(1)}%. Pending amounts from debtor organizations are creating a temporary cash lag. Prioritize collection to strengthen actual profit realization.`;
    }
    return `Company is in profit with a ${grossMarginPct.toFixed(1)}% gross margin (${inr(grossMargin)}). Recovery rate is strong at ${(recoveryRatio * 100).toFixed(1)}%. Continue consistent collection cycles to maintain this trajectory.`;
  }, [profitEngine]);

  const debtRegisterRows = useMemo(() => {
    return financeRecords
      .filter((row) => isDebtExpenseRecord(row))
      .map((row) => ({
        id: row._id,
        title: row.title || 'Debt Entry',
        entryType: row.entryType || 'expense',
        scope: row.expenseScope || 'general',
        paymentState: row.paymentState || 'paid',
        amount: Number(row.amount || 0),
        outstandingAmount: Number(row.outstandingAmount || 0),
        dueDate: row.dueDate
      }))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [financeRecords]);

  const expenseRows = useMemo(() => {
    return financeRecords
      .map((row) => ({
        id: row._id,
        title: row.title || 'Expense Record',
        category: row.category || 'Other',
        entryType: row.entryType || 'expense',
        scope: row.expenseScope || 'general',
        paymentState: row.paymentState || 'paid',
        taggedRecoveryState: parsePaymentStatus(row.description),
        amount: Number(row.amount || 0),
        outstandingAmount: Number(row.outstandingAmount || 0),
        dueDate: row.dueDate,
        date: row.date,
        description: row.description || ''
      }))
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [financeRecords]);

  const pendingPocketRows = useMemo(() => {
    return expenseRows.filter((row) => row.taggedRecoveryState === 'pending');
  }, [expenseRows]);

  const pendingSettlementDetailRows = useMemo(() => {
    const engagementMap = new Map(engagements.map((row) => [row.id, row]));
    return settlements
      .filter((row) => (row.status || '').toLowerCase() !== 'paid')
      .map((row) => {
        const engagement = engagementMap.get(row.trainingRecordId) || {};
        return {
          id: row.id,
          trainerName: engagement.trainerName || '—',
          organization: engagement.organization || '—',
          college: engagement.college || '—',
          amount: Number(row.amount || 0),
          status: row.status || 'Planned',
          paidDate: row.paidDate || null
        };
      })
      .sort((a, b) => (b.amount || 0) - (a.amount || 0));
  }, [settlements, engagements]);

  if (loadingFinance) {
    return <div className="loading">Analyzing company financials...</div>;
  }

  const {
    totalBilled,
    trainersPaid,
    pendingSettlementAmount,
    pendingRecoveryFromPayers,
    totalRecovered,
    financePending,
    grossMargin,
    outstandingFromOrgs,
    isProfit,
    isBreakEven,
    grossMarginPct,
    engagementMargins,
    advanceExposureRows,
    totalAdvanceExposure,
    advanceExpectedRevenueTotal,
    expectedRevenueTotal,
    creditCardDebt,
    totalExpenses,
    totalDebtToClear,
    ultimateInHandAfterDebtClearance,
    receivableAfterDebtClearance,
    actualLeftAfterTotalExpenses
  } = profitEngine;

  const derivedDetailPages = {
    'actual-left': {
      title: 'Actual Left After Total Expenses',
      description: 'This formula compares expected engagement revenue against all currently loaded expense records from the database.',
      summaryCards: [
        { label: 'Expected Revenue', value: inr(expectedRevenueTotal), tone: 'blue' },
        { label: 'Total Expenses', value: inr(totalExpenses), tone: 'red' },
        { label: 'Actual Left', value: `${actualLeftAfterTotalExpenses >= 0 ? '+' : '−'} ${inr(Math.abs(actualLeftAfterTotalExpenses))}`, tone: actualLeftAfterTotalExpenses >= 0 ? 'green' : 'red' }
      ],
      actions: [
        { label: 'Open Training Engagements', to: '/training-engagements' },
        { label: 'Open Expenses', to: '/expenses' }
      ],
      sections: [
        {
          title: 'Largest Expense Records',
          description: 'These entries are currently driving the total expense value in the formula.',
          table: {
            emptyMessage: 'No expense records found.',
            columns: [
              { key: 'title', label: 'Title' },
              { key: 'entryType', label: 'Type', render: (_, row) => String(row.entryType).replace(/_/g, ' ') },
              { key: 'paymentState', label: 'Payment State' },
              { key: 'date', label: 'Date', render: (_, row) => formatDate(row.date) },
              { key: 'amount', label: 'Amount', align: 'right', render: (_, row) => inr(row.amount) }
            ],
            rows: expenseRows.slice(0, 12)
          }
        }
      ]
    },
    'debt-clearance': {
      title: 'Total Debt To Clear',
      description: 'This combines open trainer settlements, unrecovered company-pocket outflows, and debt or credit-card liabilities.',
      summaryCards: [
        { label: 'Pending Settlements', value: inr(pendingSettlementAmount), tone: 'amber' },
        { label: 'Company Pocket', value: inr(financePending), tone: 'red' },
        { label: 'Debt Register', value: inr(creditCardDebt), tone: 'red' },
        { label: 'Total Debt To Clear', value: inr(totalDebtToClear), tone: 'amber' }
      ],
      actions: [
        { label: 'Open Trainer Settlements', to: '/trainer-settlements?trainerStatus=open' },
        { label: 'Open Liability Expenses', to: '/expenses?type=liability' }
      ],
      sections: [
        {
          title: 'Pending Trainer Settlement Records',
          description: 'Uncleared trainer settlement rows feeding the debt total.',
          table: {
            emptyMessage: 'No pending settlement records found.',
            columns: [
              { key: 'trainerName', label: 'Trainer' },
              { key: 'organization', label: 'Organization' },
              { key: 'college', label: 'College' },
              { key: 'status', label: 'Status' },
              { key: 'amount', label: 'Amount', align: 'right', render: (_, row) => inr(row.amount) }
            ],
            rows: pendingSettlementDetailRows
          }
        },
        {
          title: 'Unrecovered Company-Pocket Records',
          description: 'Expense rows still tagged as pending recovery from the payer side.',
          table: {
            emptyMessage: 'No unrecovered company-pocket records found.',
            columns: [
              { key: 'title', label: 'Title' },
              { key: 'category', label: 'Category' },
              { key: 'taggedRecoveryState', label: 'Recovery State' },
              { key: 'amount', label: 'Amount', align: 'right', render: (_, row) => inr(row.amount) }
            ],
            rows: pendingPocketRows
          }
        },
        {
          title: 'Debt Register Records',
          description: 'Credit-card and debt rows counted in the liability bucket.',
          table: {
            emptyMessage: 'No debt records found.',
            columns: [
              { key: 'title', label: 'Title' },
              { key: 'entryType', label: 'Type', render: (_, row) => String(row.entryType).replace(/_/g, ' ') },
              { key: 'paymentState', label: 'Payment State' },
              { key: 'amount', label: 'Amount', align: 'right', render: (_, row) => inr(row.amount) },
              { key: 'outstandingAmount', label: 'Outstanding', align: 'right', render: (_, row) => inr(row.outstandingAmount) }
            ],
            rows: debtRegisterRows
          }
        }
      ]
    },
    'ultimate-in-hand': {
      title: 'Ultimate In-Hand After Clearance',
      description: 'This is the final projected in-hand amount after trainer payouts and all debt-clearance buckets are resolved.',
      summaryCards: [
        { label: 'Expected Revenue', value: inr(expectedRevenueTotal), tone: 'blue' },
        { label: 'Paid To Trainers', value: inr(trainersPaid), tone: 'blue' },
        { label: 'Debt To Clear', value: inr(totalDebtToClear), tone: 'amber' },
        { label: 'Ultimate In-Hand', value: `${ultimateInHandAfterDebtClearance >= 0 ? '+' : '−'} ${inr(Math.abs(ultimateInHandAfterDebtClearance))}`, tone: ultimateInHandAfterDebtClearance >= 0 ? 'green' : 'red' },
        { label: 'Net Receivable After Clearance', value: `${receivableAfterDebtClearance >= 0 ? '+' : '−'} ${inr(Math.abs(receivableAfterDebtClearance))}`, tone: receivableAfterDebtClearance >= 0 ? 'green' : 'red' }
      ],
      actions: [
        { label: 'Open Pending Recovery', to: '/training-engagements?status=unpaid' },
        { label: 'Open Debt Clearance Detail', to: '/insights/debt-clearance' }
      ],
      sections: [
        {
          title: 'Formula Inputs',
          description: 'These are the exact buckets used in the final projection.',
          summaryCards: [
            { label: 'Pending Recovery From Payers', value: inr(pendingRecoveryFromPayers), tone: 'red' },
            { label: 'Pending Settlement To Trainers', value: inr(pendingSettlementAmount), tone: 'amber' },
            { label: 'Paid From Company Pocket', value: inr(financePending), tone: 'red' },
            { label: 'Credit Card / Debt', value: inr(creditCardDebt), tone: 'red' }
          ]
        }
      ]
    }
  };

  if (detailKey) {
    const detailPage = derivedDetailPages[detailKey];
    if (!detailPage) {
      return (
        <InsightDetailPage
          title="Insight Detail Not Found"
          description="This insight page is not available. Use the insights overview to open a valid detail page."
          actions={[{ label: 'Back To Insights', to: '/insights' }]}
        />
      );
    }

    return <InsightDetailPage {...detailPage} />;
  }
  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>AI Insights</h1>
          <p>Company profit/loss analysis — recovery vs outflow from payer organizations.</p>
        </div>
        <ProfitLossBadge isProfit={isProfit} isBreakEven={isBreakEven} />
      </div>

        {/* ── Advance Exposure Alert: Trainer Paid but Org Not Yet Paid ── */}
        {advanceExposureRows.length > 0 && (
          <div
            className="ops-card"
            style={{ marginTop: 16, borderLeft: '4px solid #dc2626', background: '#fef2f2' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: '#991b1b', fontSize: '0.95rem' }}>
                  Company Advance Exposure — Trainer Paid, Org Not Yet Paid
                </h3>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#7f1d1d' }}>
                  {advanceExposureRows.length} engagement(s) where trainer settlement is already paid from company pocket
                  but the client organization has NOT yet paid the invoice. Company is currently funding this gap.
                </p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#dc2626' }}>− {inr(totalAdvanceExposure)}</div>
                <div style={{ fontSize: '0.75rem', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Total Out of Pocket</div>
              </div>
            </div>
            <div style={{ overflowX: 'auto', marginTop: 14 }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th className="sno-th">#</th>
                    <th>College</th>
                    <th style={{ textAlign: 'center' }}>Org Payment Status</th>
                    <th style={{ textAlign: 'right' }}>Expected Revenue</th>
                    <th style={{ textAlign: 'right' }}>Trainer Paid (Pocket)</th>
                    <th style={{ textAlign: 'right' }}>Company Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {advanceExposureRows.map((row, i) => (
                    <tr key={row.id} style={{ background: '#fff5f5' }}>
                      <td className="sno-cell">{i + 1}</td>
                      <td><span className="college-cell-badge">{row.college}</span></td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="status-pill pending">{row.paymentStatus}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: '#6b7280' }}>{inr(row.netRevenue)}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 600 }}>
                        − {inr(row.settlementPaid)}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                        − {inr(row.settlementPaid)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #fca5a5' }}>
                    <td colSpan={3} style={{ fontWeight: 600, color: '#991b1b' }}>
                      Total awaiting recovery from payer organizations (Expected Revenue)
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#6b7280' }}>
                      {inr(advanceExpectedRevenueTotal)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                      − {inr(totalAdvanceExposure)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: '#dc2626' }}>
                      − {inr(totalAdvanceExposure)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

      {/* ── Company P&L Summary Cards ── */}
      <div className="summary-cards dashboard-summary-grid" style={{ marginTop: 20 }}>
        <InsightSummaryCard
          accentClass={totalBilled > 0 ? 'accent-green' : ''}
          value={inr(totalBilled)}
          label="Total Billed to Client Orgs"
          helperText="Open training engagements"
          onClick={() => navigate('/training-engagements')}
        />
        <InsightSummaryCard
          accentClass="accent-blue"
          value={inr(trainersPaid)}
          label="Paid Out to Trainers"
          helperText="Open trainer settlements"
          onClick={() => navigate('/trainer-settlements')}
        />
        <InsightSummaryCard
          accentClass={grossMargin >= 0 ? 'accent-green' : 'accent-red'}
          value={`${grossMargin >= 0 ? '+' : ''}${inr(grossMargin)}`}
          valueColor={grossMargin >= 0 ? '#16a34a' : '#dc2626'}
          label="Gross Margin"
          helperText="Open financial reports"
          onClick={() => navigate('/financial-reports')}
        />
      </div>

      {/* ── Recovery / Settlement / Exposure Cards ── */}
      <div className="summary-cards dashboard-summary-grid" style={{ marginTop: 14 }}>
        <InsightSummaryCard
          accentClass="received"
          borderLeftColor="#16a34a"
          valueColor="#16a34a"
          value={inr(totalRecovered)}
          label="Recovered from Client Orgs"
          helperText="Open paid engagements"
          onClick={() => navigate('/training-engagements?status=Paid')}
        />
        <InsightSummaryCard
          borderLeftColor="#dc2626"
          valueColor="#dc2626"
          value={inr(pendingRecoveryFromPayers)}
          label="Pending Recovery from Payers"
          helperText="Open unpaid engagements"
          onClick={() => navigate('/training-engagements?status=unpaid')}
        />
        <InsightSummaryCard
          borderLeftColor="#d97706"
          valueColor="#d97706"
          value={inr(pendingSettlementAmount)}
          label="Pending Settlement to Trainers"
          helperText="Open uncleared settlements"
          onClick={() => navigate('/trainer-settlements?trainerStatus=open')}
        />
        <InsightSummaryCard
          borderLeftColor="#dc2626"
          valueColor="#dc2626"
          value={inr(financePending)}
          label="Paid from Company Pocket (Unrecovered)"
          helperText="Open unrecovered expense records"
          onClick={() => navigate('/expenses?insight=unrecovered-pocket')}
        />
      </div>

      {/* ── Recovery Progress Bar ── */}
      <div className="ops-card" style={{ marginTop: 14 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem' }}>
          Recovery Progress — Billed vs Collected
        </h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#6b7280', marginBottom: 4 }}>
          <span>Collected: {inr(totalRecovered)}</span>
          <span>Outstanding from debtors: {inr(outstandingFromOrgs)}</span>
        </div>
        <RecoveryBar recovered={totalRecovered} total={totalBilled} />
      </div>

      {/* ── Expected Revenue vs Debts (Ultimate In-Hand) ── */}
      <div className="ops-card" style={{ marginTop: 14, borderLeft: '4px solid #0f766e', background: '#f0fdfa' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', color: '#115e59' }}>
          Expected Revenue vs Debt Clearance — Ultimate In-Hand
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#0f766e' }}>
          This shows your expected total collection from organizations and what remains after trainer costs,
          pending settlements, unrecovered pocket expenses, and credit-card/debt expenses.
        </p>
        <div className="summary-cards dashboard-summary-grid">
          <InsightSummaryCard
            accentClass="accent-blue"
            value={inr(expectedRevenueTotal)}
            label="Expected Revenue (Full Collection)"
            helperText="Open training engagements"
            onClick={() => navigate('/training-engagements')}
          />
          <InsightSummaryCard
            value={inr(totalExpenses)}
            valueColor="#b91c1c"
            label="Total Expenses (From Expenses Page)"
            helperText="Open expenses"
            onClick={() => navigate('/expenses')}
          />
          <InsightSummaryCard
            borderLeftColor={actualLeftAfterTotalExpenses >= 0 ? '#16a34a' : '#dc2626'}
            valueColor={actualLeftAfterTotalExpenses >= 0 ? '#16a34a' : '#dc2626'}
            value={`${actualLeftAfterTotalExpenses >= 0 ? '+' : '−'} ${inr(Math.abs(actualLeftAfterTotalExpenses))}`}
            label="Actual Left (Expected Revenue − Total Expenses)"
            helperText="Open formula detail"
            onClick={() => navigate('/insights/actual-left')}
          />
          <InsightSummaryCard
            borderLeftColor="#dc2626"
            valueColor="#dc2626"
            value={inr(creditCardDebt)}
            label="Credit Card / Debt Expenses"
            helperText="Open liability expenses"
            onClick={() => navigate('/expenses?type=liability')}
          />
          <InsightSummaryCard
            borderLeftColor="#d97706"
            valueColor="#d97706"
            value={inr(totalDebtToClear)}
            label="Total Debt to Clear"
            helperText="Open formula detail"
            onClick={() => navigate('/insights/debt-clearance')}
          />
          <InsightSummaryCard
            borderLeftColor={ultimateInHandAfterDebtClearance >= 0 ? '#16a34a' : '#dc2626'}
            valueColor={ultimateInHandAfterDebtClearance >= 0 ? '#16a34a' : '#dc2626'}
            value={`${ultimateInHandAfterDebtClearance >= 0 ? '+' : '−'} ${inr(Math.abs(ultimateInHandAfterDebtClearance))}`}
            label="Ultimate In-Hand After Clearance"
            helperText="Open formula detail"
            onClick={() => navigate('/insights/ultimate-in-hand')}
          />
        </div>
        <div style={{ marginTop: 12, fontSize: '0.82rem', color: '#334155' }}>
          <strong>Net receivable after debt clearance (from unpaid orgs):</strong> {receivableAfterDebtClearance >= 0 ? '+' : '−'} {inr(Math.abs(receivableAfterDebtClearance))}
        </div>
      </div>

      <div className="ops-card" style={{ marginTop: 14 }}>
        <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem' }}>
          Debt Register Snapshot
        </h3>
        <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#6b7280' }}>
          Credit card bills, debts, and pending out-of-pocket records used in your final in-hand projection.
        </p>
        {debtRegisterRows.length > 0 ? (
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th className="sno-th">#</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Scope</th>
                  <th>Payment State</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>Outstanding</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                {debtRegisterRows.map((row, idx) => (
                  <tr key={row.id || `${row.title}-${idx}`}>
                    <td className="sno-cell">{idx + 1}</td>
                    <td>{row.title}</td>
                    <td>{String(row.entryType).replace(/_/g, ' ')}</td>
                    <td>{String(row.scope).replace(/_/g, ' ')}</td>
                    <td><span className="status-pill pending">{row.paymentState}</span></td>
                    <td style={{ textAlign: 'right' }}>{inr(row.amount)}</td>
                    <td style={{ textAlign: 'right', color: row.outstandingAmount > 0 ? '#dc2626' : '#16a34a' }}>{inr(row.outstandingAmount)}</td>
                    <td>{row.dueDate ? new Date(row.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted" style={{ margin: 0 }}>No debt records yet. Add them in Expenses & Debts page.</p>
        )}
      </div>

      {/* ── AI Verdict ── */}
      <div
        className="ops-card"
        style={{
          marginTop: 14,
          borderLeft: `4px solid ${isProfit ? '#16a34a' : isBreakEven ? '#d97706' : '#dc2626'}`,
          background: isProfit ? '#f0fdf4' : isBreakEven ? '#fffbeb' : '#fef2f2'
        }}
      >
        <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem', color: isProfit ? '#15803d' : isBreakEven ? '#92400e' : '#991b1b' }}>
          AI Verdict — Company Financial Health
        </h3>
        <p style={{ margin: 0, lineHeight: 1.6, color: '#1f2937' }}>{aiVerdict}</p>
      </div>

      {/* ── Margin Breakdown ── */}
      {totalBilled > 0 && (
        <div className="ops-card" style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>Margin Breakdown</h3>
          <div className="teaching-bar-chart">
            {[
              { label: 'Revenue Billed', value: totalBilled, max: totalBilled, color: '#2563eb' },
              { label: 'Trainer Cost', value: trainersPaid, max: totalBilled, color: '#dc2626' },
              { label: 'Gross Margin', value: Math.max(0, grossMargin), max: totalBilled, color: '#16a34a' },
                { label: 'Recovered Cash', value: totalRecovered, max: totalBilled, color: '#0284c7' },
                { label: 'Pending Recovery', value: pendingRecoveryFromPayers, max: totalBilled, color: '#f59e0b' }
            ].map((row) => (
              <div key={row.label} className="teaching-bar-row">
                <span className="teaching-bar-label">{row.label}</span>
                <div className="teaching-bar-track">
                  <div
                    style={{
                      height: '100%',
                      width: `${row.max > 0 ? Math.min(100, (row.value / row.max) * 100) : 0}%`,
                      background: row.color,
                      borderRadius: 999
                    }}
                  />
                </div>
                <span style={{ fontSize: '0.75rem', color: '#374151', textAlign: 'right', fontWeight: 600 }}>
                  {inr(row.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Gross Margin % ── */}
      {totalBilled > 0 && (
        <div className="ops-grid-two" style={{ marginTop: 14 }}>
          <div className="ops-card summary-card teaching-stat-card accent-purple">
            <div className="stat-value">{grossMarginPct.toFixed(1)}%</div>
            <div className="stat-label">Gross Margin %</div>
          </div>
          <div className="ops-card summary-card teaching-stat-card" style={{ borderLeftColor: outstandingFromOrgs > 0 ? '#dc2626' : '#16a34a' }}>
            <div className="stat-value" style={{ color: outstandingFromOrgs > 0 ? '#dc2626' : '#16a34a' }}>
              {inr(outstandingFromOrgs)}
            </div>
            <div className="stat-label">Outstanding from Debtor Orgs</div>
          </div>
        </div>
      )}

      {/* ── Per-Engagement Settlement vs Margin ── */}
      {engagementMargins.length > 0 && (
        <div className="ops-card" style={{ marginTop: 14 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '0.95rem' }}>
            Per-Engagement — Trainer Settlement &amp; Margin
          </h3>
          <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#6b7280' }}>
            Red rows = trainer paid but org hasn't paid the company yet (company out of pocket). Orange = trainer paid and org also paid but margin is thin.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table">
              <thead>
                <tr>
                  <th className="sno-th">#</th>
                  <th>College</th>
                  <th style={{ textAlign: 'center' }}>Org Status</th>
                  <th style={{ textAlign: 'right' }}>In-hand Revenue</th>
                  <th style={{ textAlign: 'right' }}>Trainer Paid</th>
                  <th style={{ textAlign: 'right' }}>Margin</th>
                  <th style={{ textAlign: 'right' }}>Margin %</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {engagementMargins.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      background: row.companyOutOfPocket ? '#fef2f2' : row.marginPct < 10 && row.settlementPaid > 0 ? '#fffbeb' : 'transparent'
                    }}
                  >
                    <td className="sno-cell">{i + 1}</td>
                    <td><span className="college-cell-badge">{row.college}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-pill ${row.orgHasPaid ? 'received' : 'pending'}`}>
                        {row.paymentStatus}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>{inr(row.netRevenue)}</td>
                    <td style={{ textAlign: 'right', color: row.settlementPaid > 0 ? '#dc2626' : '#6b7280' }}>
                      {row.settlementPaid > 0 ? `− ${inr(row.settlementPaid)}` : '—'}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: row.marginAmount < 0 ? '#dc2626' : '#16a34a' }}>
                      {row.marginAmount < 0 ? `− ${inr(Math.abs(row.marginAmount))}` : `+ ${inr(row.marginAmount)}`}
                    </td>
                    <td style={{ textAlign: 'right', color: row.marginAmount < 0 ? '#dc2626' : '#374151' }}>
                      {row.netRevenue > 0 ? `${row.marginPct.toFixed(1)}%` : '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {row.companyOutOfPocket ? (
                        <span className="status-pill pending">OUT OF POCKET</span>
                      ) : row.isLoss ? (
                        <span className="status-pill pending">LOSS</span>
                      ) : row.marginPct < 10 ? (
                        <span className="status-pill" style={{ color: '#92400e', background: '#fef3c7' }}>LOW</span>
                      ) : (
                        <span className="status-pill received">PROFIT</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Behaviour & Focus Insights ── */}
      <div className="insight-stack" style={{ marginTop: 14 }}>
        <article className="ops-card insight-card">
          <h3>Time Allocation</h3>
          <p className="insight-inline">
            {logAggregate.bothDays > 0
              ? `Mixed-focus days detected ${logAggregate.bothDays} time(s). You may be balancing stable work with high-value hustle.`
              : 'No mixed-focus days logged yet. Use daily voice logs to unlock this insight.'}
          </p>
        </article>
        <article className="ops-card insight-card">
          <h3>Teaching Focus</h3>
          <p className="insight-inline">
            Most taught topic: <strong>{logAggregate.topTopic}</strong>. Reuse assets around this topic to increase delivery speed.
          </p>
        </article>
      </div>
    </section>
  );
}

export default Insights;
