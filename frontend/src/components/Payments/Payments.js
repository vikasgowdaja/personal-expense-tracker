import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { trainingEngagementAPI } from '../../services/api';
import { useNavigate } from 'react-router-dom';

const STATUS_ORDER = ['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'];
const SETTLEMENT_STATUS = ['Planned', 'Partially Paid', 'Paid'];
const DEFAULT_TDS_PERCENT = 10;
const PLACEHOLDER_TRAINER_PATTERN = /independent engagement/i;

const STATUS_COLORS = {
  Planned: 'pill-grey',
  Ongoing: 'pill-blue',
  Completed: 'received',
  Invoiced: 'pill-yellow',
  Paid: 'pill-green'
};

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function calcDaySpan(start, end) {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 0;
  const diff = Math.round((e - s) / 86400000) + 1;
  return diff > 0 ? diff : 0;
}

function daysSince(dateLike) {
  if (!dateLike) return 0;
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return 0;
  const now = new Date();
  const ms = now.setHours(0, 0, 0, 0) - dt.setHours(0, 0, 0, 0);
  const days = Math.floor(ms / 86400000);
  return days > 0 ? days : 0;
}

// ── Legacy localStorage sessions (teaching_sessions key) ────────────────
function getLegacySessions() {
  try {
    return JSON.parse(localStorage.getItem('teaching_sessions') || '[]');
  } catch {
    return [];
  }
}

function getVendorTrainerProfiles() {
  try {
    return JSON.parse(localStorage.getItem('trainer_profiles') || '[]');
  } catch {
    return [];
  }
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

// ── Build a flat list of "trainer payment rows" from backend engagements ──
function flattenEngagements(engagements) {
  const rows = [];
  engagements.forEach((eng) => {
    const orgName = eng.institutionId?.name || 'Unknown Institution';
    const clientName = eng.clientId?.name || 'Unknown Client';
    const orgId = eng.institutionId?._id || eng.institutionId || 'unknown';
    (eng.trainers || []).forEach((t) => {
      rows.push({
        sourceType: 'backend',
        engagementId: eng._id,
        engagementTitle: eng.engagementTitle || `${orgName} — ${fmtDate(eng.startDate)}`,
        orgId,
        orgName,
        clientName,
        startDate: eng.startDate,
        endDate: eng.endDate,
        totalDays: eng.totalDays,
        status: eng.status,
        trainerId: t.trainerId?._id || t.trainerId || t._id,
        trainerName: t.trainerId?.fullName || 'Unknown Trainer',
        trainerEmail: t.trainerId?.email || '',
        subjectArea: t.subjectArea || '—',
        trainingTopic: t.trainingTopic || '—',
        dailyRate: Number(t.dailyRate || 0),
        amount: Number(t.amount || 0)
      });
    });
  });
  return rows;
}

// ── Build legacy rows from localStorage teaching_sessions ────────────────
function flattenLegacy(sessions) {
  return sessions.map((s) => ({
    sourceType: 'legacy',
    engagementId: `legacy-${s.id}`,
    engagementTitle: s.topic || s.organization || 'Legacy Session',
    orgId: `legacy-org-${(s.organization || '').toLowerCase().replace(/\s+/g, '-')}`,
    orgName: s.organization || 'Unknown Institution',
    clientName: '—',
    startDate: s.date,
    endDate: s.date,
    totalDays: 1,
    status: s.paymentStatus === 'received' ? 'Paid' : s.paymentStatus === 'pending' ? 'Invoiced' : 'Completed',
    trainerId: `legacy-trainer-${(s.trainerName || '').toLowerCase().replace(/\s+/g, '-')}`,
    trainerName: s.trainerName || 'Unknown Trainer',
    trainerEmail: '',
    subjectArea: s.topic || '—',
    trainingTopic: s.topic || '—',
    dailyRate: Number(s.totalFee || 0),
    amount: Number(s.totalFee || 0),
    isLegacy: true
  }));
}

function flattenVendorRecords(profiles) {
  const rows = [];
  profiles.forEach((trainer) => {
    (trainer.records || []).forEach((record) => {
      const statusText = (record.paymentStatus || '').toLowerCase();
      const mappedStatus = statusText === 'paid' || statusText === 'received'
        ? 'Paid'
        : statusText === 'planned' || statusText === 'ongoing' || statusText === 'completed'
          ? `${record.paymentStatus}`
          : 'Invoiced';

      rows.push({
        sourceType: 'vendor',
        engagementId: `vendor-${trainer.id}-${record.id}`,
        engagementTitle: record.notes || `Vendor record - ${trainer.trainerName || 'Trainer'}`,
        orgId: `vendor-org-${(trainer.institution || trainer.college || 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
        orgName: trainer.institution || trainer.college || 'Unknown Institution',
        clientName: '—',
        startDate: record.date || trainer.createdAt,
        endDate: record.date || trainer.createdAt,
        totalDays: 1,
        status: STATUS_ORDER.includes(mappedStatus) ? mappedStatus : 'Invoiced',
        trainerId: trainer.id,
        trainerName: trainer.trainerName || 'Unknown Trainer',
        trainerEmail: trainer.userProfile?.email || '',
        subjectArea: record.type || 'Vendor Record',
        trainingTopic: record.notes || '—',
        dailyRate: Number(record.amount || 0),
        amount: Number(record.amount || 0),
        vendorTrainerId: trainer.id,
        vendorRecordId: record.id
      });
    });
  });
  return rows;
}

function flattenTrainingRecords(engagements) {
  return engagements.map((row) => ({
    sourceType: 'training',
    tdsApplicable: row.tdsApplicable !== false,
    tdsPercent: Number(row.tdsPercent || DEFAULT_TDS_PERCENT),
    grossAmount: Number(row.grossAmount || row.totalAmount || 0),
    tdsAmount:
      row.tdsApplicable === false
        ? 0
        : Number(
            row.tdsAmount !== undefined
              ? row.tdsAmount
              : ((row.grossAmount || row.totalAmount || 0) * DEFAULT_TDS_PERCENT) / 100
          ),
    engagementId: `training-${row.id}`,
    engagementTitle: row.topic || 'Training Engagement',
    orgId: `training-org-${(row.college || 'unknown').toLowerCase().replace(/\s+/g, '-')}`,
    orgName: row.college || 'Unknown College',
    clientName: row.organization || '—',
    startDate: row.startDate,
    endDate: row.endDate,
    totalDays: Number(row.totalDays || 0),
    status: row.paymentStatus || 'Invoiced',
    trainerId: `training-${row.id}`,
    trainerName: 'Independent Engagement',
    trainerEmail: '',
    subjectArea: row.engagementType || 'Training',
    trainingTopic: row.topic || row.notes || '—',
    dailyRate: Number(row.ratePerDay || 0),
    amount:
      row.grossAmount === undefined && row.tdsAmount === undefined && row.tdsApplicable === undefined
        ? Number((row.totalAmount || 0) - ((row.totalAmount || 0) * DEFAULT_TDS_PERCENT) / 100)
        : row.totalAmount !== undefined
          ? Number(row.totalAmount || 0)
          : row.tdsApplicable === false
            ? Number(row.grossAmount || 0)
            : Number((row.grossAmount || 0) - ((row.grossAmount || 0) * DEFAULT_TDS_PERCENT) / 100),
    trainingRecordId: row.id
  }));
}

// ── Tabs ─────────────────────────────────────────────────────────────────
const TABS = ['By Organization', 'By Trainer', 'All Engagements'];

export default function Payments() {
  const navigate = useNavigate();
  const SHOW_SETTLEMENT_IN_PAYMENTS = false;
  const [engagements, setEngagements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');
  const [activeTab, setActiveTab] = useState('By Organization');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [agingTrainerFilter, setAgingTrainerFilter] = useState('');
  const [agingFromDate, setAgingFromDate] = useState('');
  const [agingToDate, setAgingToDate] = useState('');
  const [expandedOrgs, setExpandedOrgs] = useState({});
  const [expandedTrainers, setExpandedTrainers] = useState({});
  const [updatingId, setUpdatingId] = useState('');
  const [, setLocalVersion] = useState(0);
  const [settlementForm, setSettlementForm] = useState({
    id: '',
    trainingRecordId: '',
    engagementLabel: '',
    trainerId: '',
    trainerName: '',
    collegeName: '',
    organizationName: '',
    startDate: '',
    endDate: '',
    totalDays: 0,
    perDayPayment: '',
    orgId: '',
    orgName: '',
    amount: '',
    paidDate: new Date().toISOString().slice(0, 10),
    status: 'Planned',
    notes: ''
  });

  const updateTrainerSettlements = (updater) => {
    const current = getTrainerSettlements();
    const next = updater(current);
    localStorage.setItem('trainer_settlements', JSON.stringify(next));
    setLocalVersion((v) => v + 1);
  };

  const updateTrainingRecords = (updater) => {
    const current = getTrainingEngagements();
    const next = updater(current);
    localStorage.setItem('training_engagements', JSON.stringify(next));
    setLocalVersion((v) => v + 1);
  };

  const loadEngagements = useCallback(async () => {
    try {
      setLoading(true);
      setFetchError('');
      const res = await trainingEngagementAPI.getAll();
      setEngagements(res.data || []);
    } catch (err) {
      setFetchError('Could not load training engagements from server. Showing local data only.');
      setEngagements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEngagements();
  }, [loadEngagements]);

  // Combine backend + training + legacy + vendor tracker rows
  const allRows = (() => {
    const backendRows = flattenEngagements(engagements);
    const trainingRows = flattenTrainingRecords(getTrainingEngagements());
    const legacyRows = flattenLegacy(getLegacySessions());
    const vendorRows = flattenVendorRecords(getVendorTrainerProfiles());
    return [...trainingRows, ...backendRows, ...legacyRows, ...vendorRows];
  })();

  const trainingEngagementOptions = getTrainingEngagements().map((row) => {
      const gross = Number(
        row.grossAmount !== undefined
          ? row.grossAmount
          : row.ratePerDay !== undefined && row.totalDays !== undefined
            ? Number(row.ratePerDay || 0) * Number(row.totalDays || 0)
            : row.totalAmount || 0
      );
      const tds = row.tdsApplicable === false
        ? 0
        : Number(row.tdsAmount !== undefined ? row.tdsAmount : (gross * DEFAULT_TDS_PERCENT) / 100);
      const net = Number(row.totalAmount !== undefined ? row.totalAmount : gross - tds);
      return {
        id: row.id,
        trainerId: row.trainerId || '',
        trainerName: row.trainerName || '',
        college: row.college || 'Unknown College',
        organization: row.organization || '—',
        startDate: row.startDate || '',
        endDate: row.endDate || '',
        totalDays: Number(row.totalDays || calcDaySpan(row.startDate, row.endDate) || 0),
        topic: row.topic || row.notes || 'Training Engagement',
        label: `${row.college || 'Unknown College'} - ${row.topic || 'Training Engagement'}`,
        netAmount: net
      };
    });

  const settlements = getTrainerSettlements();

  const filteredSettlementEngagementOptions = useMemo(() => {
    if (!settlementForm.trainerId && !settlementForm.trainerName) {
      return trainingEngagementOptions;
    }

    const selectedName = (settlementForm.trainerName || '').trim().toLowerCase();
    return trainingEngagementOptions.filter((item) => {
      if (settlementForm.trainerId && item.trainerId && item.trainerId === settlementForm.trainerId) {
        return true;
      }
      if (selectedName && item.trainerName && item.trainerName.trim().toLowerCase() === selectedName) {
        return true;
      }
      return false;
    });
  }, [trainingEngagementOptions, settlementForm.trainerId, settlementForm.trainerName]);

  const settlementOptionBuckets = useMemo(() => {
    const hasPaidSettlementByEngagement = settlements
      .filter((item) => item.status === 'Paid' && item.trainingRecordId)
      .reduce((acc, item) => {
        acc[item.trainingRecordId] = true;
        return acc;
      }, {});

    const paidByEngagement = settlements
      .filter((item) => item.status === 'Paid' && item.trainingRecordId)
      .reduce((acc, item) => {
        acc[item.trainingRecordId] = (acc[item.trainingRecordId] || 0) + Number(item.amount || 0);
        return acc;
      }, {});

    const open = [];
    const done = [];

    filteredSettlementEngagementOptions.forEach((item) => {
      const paid = Number(paidByEngagement[item.id] || 0);
      const isDoneByPaidStatus = Boolean(hasPaidSettlementByEngagement[item.id]);
      const isDoneByAmount = Number(item.netAmount || 0) > 0 && paid >= Number(item.netAmount || 0);
      const isDone = isDoneByPaidStatus || isDoneByAmount;
      const option = { ...item, paid, isDone };
      if (isDone) {
        done.push(option);
      } else {
        open.push(option);
      }
    });

    return { open, done };
  }, [filteredSettlementEngagementOptions, settlements]);

  const doneEngagementIds = useMemo(
    () => new Set(settlementOptionBuckets.done.map((item) => item.id)),
    [settlementOptionBuckets]
  );


  // Summary totals
  const summary = useMemo(() => {
    const total = allRows.reduce((s, r) => s + r.amount, 0);
    const paid = allRows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
    const pending = total - paid;
    return { total, paid, pending, count: allRows.length };
  }, [allRows]);

  // Unique orgs and trainers for filter dropdowns
  const orgs = useMemo(() => {
    const map = {};
    allRows.forEach((r) => { map[r.orgId] = r.orgName; });
    return Object.entries(map).map(([id, name]) => ({ id, name }));
  }, [allRows]);

  const trainerNames = useMemo(() => {
    const byName = new Map();

    // Prefer trainer master/vendor profiles when available.
    getVendorTrainerProfiles().forEach((trainer) => {
      const name = (trainer.trainerName || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          id: trainer.id || `trainer-${key.replace(/\s+/g, '-')}`,
          name
        });
      }
    });

    // Add non-placeholder trainers from all payment rows.
    allRows.forEach((row) => {
      const name = (row.trainerName || '').trim();
      if (!name) return;
      if (PLACEHOLDER_TRAINER_PATTERN.test(name)) return;
      const key = name.toLowerCase();
      if (!byName.has(key)) {
        byName.set(key, {
          id: row.trainerId || `trainer-${key.replace(/\s+/g, '-')}`,
          name
        });
      }
    });

    // Keep placeholder only as a last-resort single option when no trainer master exists.
    if (byName.size === 0) {
      const fallback = allRows.find((row) => (row.trainerName || '').trim());
      if (fallback) {
        byName.set((fallback.trainerName || '').toLowerCase(), {
          id: fallback.trainerId,
          name: fallback.trainerName
        });
      }
    }

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allRows]);

  const financialBridge = useMemo(() => {
    const incomingRevenue = summary.paid;
    const outgoingPaid = settlements
      .filter((item) => item.status === 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const outgoingPlanned = settlements
      .filter((item) => item.status !== 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidByEngagement = allRows
      .filter((row) => row.status === 'Paid')
      .reduce((acc, row) => {
        const key = row.engagementId;
        acc[key] = (acc[key] || 0) + Number(row.amount || 0);
        return acc;
      }, {});

    const paidSettlementByEngagement = settlements
      .filter((item) => item.status === 'Paid' && item.trainingRecordId)
      .reduce((acc, item) => {
        const key = item.trainingRecordId;
        acc[key] = (acc[key] || 0) + Number(item.amount || 0);
        return acc;
      }, {});

    const engagementMargins = trainingEngagementOptions.map((eng) => {
      const incoming = Number(paidByEngagement[`training-${eng.id}`] || 0);
      const outgoing = Number(paidSettlementByEngagement[eng.id] || 0);
      const marginAmount = incoming - outgoing;
      const marginPercent = incoming > 0 ? (marginAmount / incoming) * 100 : 0;
      return {
        id: eng.id,
        label: eng.label,
        incoming,
        outgoing,
        marginAmount,
        marginPercent,
        netAmount: eng.netAmount
      };
    });

    const profit = incomingRevenue - outgoingPaid;
    const marginPercent = incomingRevenue > 0 ? (profit / incomingRevenue) * 100 : 0;

    return {
      incomingRevenue,
      outgoingPaid,
      outgoingPlanned,
      profit,
      marginPercent,
      engagementMargins
    };
  }, [summary.paid, settlements, allRows, trainingEngagementOptions]);

  // Filtered rows
  const visibleRows = useMemo(() => {
    return allRows.filter((r) => {
      if (filterOrg && r.orgId !== filterOrg) return false;
      if (filterTrainer && r.trainerId !== filterTrainer) return false;
      if (filterStatus && r.status !== filterStatus) return false;
      return true;
    });
  }, [allRows, filterOrg, filterTrainer, filterStatus]);

  // Group by organization
  const byOrg = useMemo(() => {
    const map = {};
    visibleRows.forEach((r) => {
      if (!map[r.orgId]) {
        map[r.orgId] = { orgId: r.orgId, orgName: r.orgName, clientName: r.clientName, rows: [] };
      }
      map[r.orgId].rows.push(r);
    });
    return Object.values(map);
  }, [visibleRows]);

  // Group by trainer
  const byTrainer = useMemo(() => {
    const map = {};
    visibleRows.forEach((r) => {
      if (!map[r.trainerId]) {
        map[r.trainerId] = { trainerId: r.trainerId, trainerName: r.trainerName, trainerEmail: r.trainerEmail, rows: [] };
      }
      map[r.trainerId].rows.push(r);
    });
    return Object.values(map);
  }, [visibleRows]);

  const toggleOrg = (id) =>
    setExpandedOrgs((prev) => ({ ...prev, [id]: !prev[id] }));

  const toggleTrainer = (id) =>
    setExpandedTrainers((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleStatusUpdate = async (row, nextStatus) => {
    const rowId = row.engagementId;
    if (!STATUS_ORDER.includes(nextStatus)) {
      return;
    }

    if (row.sourceType === 'legacy') {
      const sessions = getLegacySessions().map((s) => {
        if (`legacy-${s.id}` !== row.engagementId) {
          return s;
        }
        return {
          ...s,
          paymentStatus: nextStatus === 'Paid' ? 'received' : 'pending'
        };
      });
      localStorage.setItem('teaching_sessions', JSON.stringify(sessions));
      setLocalVersion((v) => v + 1);
      return;
    }

    if (row.sourceType === 'training') {
      updateTrainingRecords((records) => records.map((item) => (
        item.id === row.trainingRecordId
          ? { ...item, paymentStatus: nextStatus }
          : item
      )));
      return;
    }

    if (row.sourceType === 'vendor') {
      const profiles = getVendorTrainerProfiles().map((trainer) => {
        if (trainer.id !== row.vendorTrainerId) {
          return trainer;
        }
        return {
          ...trainer,
          records: (trainer.records || []).map((record) => (
            record.id === row.vendorRecordId
              ? { ...record, paymentStatus: nextStatus }
              : record
          ))
        };
      });
      localStorage.setItem('trainer_profiles', JSON.stringify(profiles));
      setLocalVersion((v) => v + 1);
      return;
    }

    try {
      setUpdatingId(rowId);
      await trainingEngagementAPI.update(rowId, { status: nextStatus });
      await loadEngagements();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Could not update status');
    } finally {
      setUpdatingId('');
    }
  };

  const handleDeleteRow = async (row) => {
    if (!window.confirm('Delete this payment record?')) {
      return;
    }

    if (row.sourceType === 'training') {
      updateTrainingRecords((records) => records.filter((item) => item.id !== row.trainingRecordId));
      return;
    }

    if (row.sourceType === 'legacy') {
      const sessions = getLegacySessions().filter((s) => `legacy-${s.id}` !== row.engagementId);
      localStorage.setItem('teaching_sessions', JSON.stringify(sessions));
      setLocalVersion((v) => v + 1);
      return;
    }

    if (row.sourceType === 'vendor') {
      const profiles = getVendorTrainerProfiles().map((trainer) => {
        if (trainer.id !== row.vendorTrainerId) {
          return trainer;
        }
        return {
          ...trainer,
          records: (trainer.records || []).filter((record) => record.id !== row.vendorRecordId)
        };
      });
      localStorage.setItem('trainer_profiles', JSON.stringify(profiles));
      setLocalVersion((v) => v + 1);
      return;
    }

    try {
      setUpdatingId(row.engagementId);
      await trainingEngagementAPI.delete(row.engagementId);
      await loadEngagements();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Could not delete record');
    } finally {
      setUpdatingId('');
    }
  };

  const handleEditAmount = (row) => {
    const entered = window.prompt('Enter new gross amount before TDS (INR):', String(Number(row.grossAmount || row.amount || 0)));
    if (entered === null) {
      return;
    }
    const nextAmount = Number(entered);
    if (Number.isNaN(nextAmount) || nextAmount < 0) {
      window.alert('Please enter a valid amount.');
      return;
    }

    if (row.sourceType === 'training') {
      updateTrainingRecords((records) => records.map((item) => (
        item.id === row.trainingRecordId
          ? {
              ...item,
              grossAmount: nextAmount,
              tdsAmount: item.tdsApplicable === false ? 0 : (nextAmount * DEFAULT_TDS_PERCENT) / 100,
              totalAmount: item.tdsApplicable === false ? nextAmount : nextAmount - (nextAmount * DEFAULT_TDS_PERCENT) / 100,
              ratePerDay: Number(item.totalDays || 1) > 0 ? nextAmount / Number(item.totalDays || 1) : nextAmount
            }
          : item
      )));
      return;
    }

    if (row.sourceType === 'legacy') {
      const sessions = getLegacySessions().map((s) => (
        `legacy-${s.id}` === row.engagementId
          ? { ...s, totalFee: nextAmount }
          : s
      ));
      localStorage.setItem('teaching_sessions', JSON.stringify(sessions));
      setLocalVersion((v) => v + 1);
      return;
    }

    if (row.sourceType === 'vendor') {
      const profiles = getVendorTrainerProfiles().map((trainer) => {
        if (trainer.id !== row.vendorTrainerId) {
          return trainer;
        }
        return {
          ...trainer,
          records: (trainer.records || []).map((record) => (
            record.id === row.vendorRecordId
              ? { ...record, amount: nextAmount }
              : record
          ))
        };
      });
      localStorage.setItem('trainer_profiles', JSON.stringify(profiles));
      setLocalVersion((v) => v + 1);
      return;
    }

    window.alert('Amount edit for backend records is not enabled from this screen.');
  };

  const handleCreateFinanceRecord = () => {
    const college = window.prompt('College / Institution name:');
    if (!college) return;
    const organization = window.prompt('Organization / EdTech name:');
    if (!organization) return;
    const topic = window.prompt('Training Topic:', 'General Training') || 'General Training';
    const startDate = window.prompt('Start date (YYYY-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!startDate) return;
    const endDate = window.prompt('End date (YYYY-MM-DD):', startDate) || startDate;
    const totalDays = Math.max(1, Math.round((new Date(endDate) - new Date(startDate)) / 86400000) + 1);
    const amountRaw = window.prompt('Gross Amount before TDS (INR):', '0');
    const amount = Number(amountRaw || 0);
    if (Number.isNaN(amount) || amount < 0) {
      window.alert('Amount must be a valid number.');
      return;
    }

    const newRecord = {
      id: Date.now().toString(),
      topic,
      engagementType: 'Finance Added',
      college,
      organization,
      startDate,
      endDate,
      totalDays,
      dailyHours: 0,
      ratePerDay: totalDays > 0 ? amount / totalDays : amount,
      grossAmount: amount,
      tdsApplicable: true,
      tdsPercent: DEFAULT_TDS_PERCENT,
      tdsAmount: (amount * DEFAULT_TDS_PERCENT) / 100,
      totalAmount: amount - (amount * DEFAULT_TDS_PERCENT) / 100,
      learners: 0,
      notes: 'Created from Payments dashboard',
      paymentStatus: 'Invoiced',
      createdAt: new Date().toISOString()
    };

    updateTrainingRecords((records) => [newRecord, ...records]);
  };

  const resetSettlementForm = () => {
    setSettlementForm({
      id: '',
      trainingRecordId: '',
      engagementLabel: '',
      trainerId: '',
      trainerName: '',
      collegeName: '',
      organizationName: '',
      startDate: '',
      endDate: '',
      totalDays: 0,
      perDayPayment: '',
      orgId: '',
      orgName: '',
      amount: '',
      paidDate: new Date().toISOString().slice(0, 10),
      status: 'Planned',
      notes: ''
    });
  };

  const handleSettlementTrainerChange = (trainerId) => {
    const selected = trainerNames.find((t) => t.id === trainerId);
    const selectedTrainerName = selected?.name || '';
    setSettlementForm((prev) => ({
      ...prev,
      trainerId,
      trainerName: selectedTrainerName,
      trainingRecordId: '',
      engagementLabel: '',
      collegeName: '',
      organizationName: '',
      startDate: '',
      endDate: '',
      totalDays: 0,
      perDayPayment: '',
      amount: ''
    }));
  };

  const handleSettlementEngagementChange = (trainingRecordId) => {
    if (!settlementForm.id && doneEngagementIds.has(trainingRecordId)) {
      window.alert('This engagement is already settled and cannot be selected again.');
      return;
    }
    const selected = trainingEngagementOptions.find((item) => item.id === trainingRecordId);
    setSettlementForm((prev) => ({
      ...prev,
      trainingRecordId,
      engagementLabel: selected?.label || '',
      trainerId: selected?.trainerId || prev.trainerId,
      trainerName: selected?.trainerName || prev.trainerName,
      collegeName: selected?.college || '',
      organizationName: selected?.organization || '',
      startDate: selected?.startDate || '',
      endDate: selected?.endDate || '',
      totalDays: Number(selected?.totalDays || 0),
      perDayPayment: '',
      amount: '',
      orgName: selected?.college || prev.orgName
    }));
  };

  const handlePerDaySettlementChange = (value) => {
    const perDayPayment = Number(value || 0);
    setSettlementForm((prev) => {
      const totalDays = Number(prev.totalDays || 0);
      const amount = perDayPayment > 0 && totalDays > 0 ? perDayPayment * totalDays : 0;
      return {
        ...prev,
        perDayPayment: value,
        amount: amount > 0 ? amount.toFixed(2) : ''
      };
    });
  };

  const handleSaveSettlement = () => {
    const amount = Number(settlementForm.amount || 0);
    if (!settlementForm.trainingRecordId) {
      window.alert('Select the engagement this settlement belongs to.');
      return;
    }
    if (!settlementForm.trainerId || !settlementForm.trainerName) {
      window.alert('Select a trainer for settlement.');
      return;
    }
    if (!settlementForm.id && doneEngagementIds.has(settlementForm.trainingRecordId)) {
      window.alert('This engagement is already settled. Choose an open engagement.');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      window.alert('Settlement amount must be greater than zero.');
      return;
    }

    const record = {
      id: settlementForm.id || `set-${Date.now()}`,
      trainingRecordId: settlementForm.trainingRecordId,
      engagementLabel: settlementForm.engagementLabel,
      trainerId: settlementForm.trainerId,
      trainerName: settlementForm.trainerName,
      collegeName: settlementForm.collegeName,
      organizationName: settlementForm.organizationName,
      startDate: settlementForm.startDate,
      endDate: settlementForm.endDate,
      totalDays: Number(settlementForm.totalDays || 0),
      perDayPayment: Number(settlementForm.perDayPayment || 0),
      orgId: settlementForm.orgId,
      orgName: settlementForm.orgName,
      amount,
      paidDate: settlementForm.paidDate || new Date().toISOString().slice(0, 10),
      status: settlementForm.status,
      notes: settlementForm.notes || '',
      updatedAt: new Date().toISOString()
    };

    updateTrainerSettlements((current) => {
      const idx = current.findIndex((item) => item.id === record.id);
      if (idx === -1) {
        return [record, ...current];
      }
      const next = [...current];
      next[idx] = record;
      return next;
    });

    resetSettlementForm();
  };

  const handleEditSettlement = (item) => {
    setSettlementForm({
      id: item.id,
      trainingRecordId: item.trainingRecordId || '',
      engagementLabel: item.engagementLabel || '',
      trainerId: item.trainerId || '',
      trainerName: item.trainerName || '',
      collegeName: item.collegeName || item.orgName || '',
      organizationName: item.organizationName || '',
      startDate: item.startDate || '',
      endDate: item.endDate || '',
      totalDays: Number(item.totalDays || 0),
      perDayPayment:
        item.perDayPayment !== undefined
          ? String(Number(item.perDayPayment || 0))
          : Number(item.totalDays || 0) > 0
            ? String(Number(item.amount || 0) / Number(item.totalDays || 1))
            : '',
      orgId: item.orgId || '',
      orgName: item.orgName || '',
      amount: String(Number(item.amount || 0)),
      paidDate: item.paidDate || new Date().toISOString().slice(0, 10),
      status: item.status || 'Planned',
      notes: item.notes || ''
    });
  };

  const handleDeleteSettlement = (id) => {
    if (!window.confirm('Delete this trainer settlement record?')) {
      return;
    }
    updateTrainerSettlements((current) => current.filter((item) => item.id !== id));
    if (settlementForm.id === id) {
      resetSettlementForm();
    }
  };

  const handleSetSettlementPaid = (id) => {
    updateTrainerSettlements((current) => current.map((item) => (
      item.id === id
        ? {
            ...item,
            status: 'Paid',
            paidDate: item.paidDate || new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString()
          }
        : item
    )));
  };

  const selectedEngagementMetrics = useMemo(() => {
    if (!settlementForm.trainingRecordId) {
      return null;
    }
    const engagement = financialBridge.engagementMargins.find((item) => item.id === settlementForm.trainingRecordId);
    if (!engagement) {
      return null;
    }

    const totalLogged = settlements
      .filter((item) => item.trainingRecordId === settlementForm.trainingRecordId)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const totalPaid = settlements
      .filter((item) => item.trainingRecordId === settlementForm.trainingRecordId && item.status === 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const currentInput = Number(settlementForm.amount || 0);

    return {
      netAmount: Number(engagement.netAmount || 0),
      totalLogged,
      totalPaid,
      marginLeftAfterCurrent: Number(engagement.netAmount || 0) - (totalLogged + currentInput)
    };
  }, [settlementForm.trainingRecordId, settlementForm.amount, settlements, financialBridge.engagementMargins]);

  const agingRows = useMemo(() => {
    const marginByEngagement = financialBridge.engagementMargins.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {});

    return trainingEngagementOptions
      .map((eng) => {
        const refDate = eng.endDate || eng.startDate || '';
        const ageDays = daysSince(refDate);
        const margin = marginByEngagement[eng.id] || { incoming: 0, outgoing: 0, marginAmount: 0 };
        const indicator = ageDays >= 45
          ? 'Crossed 45 days'
          : ageDays >= 30
            ? 'Crossed 30 days'
            : 'Within 30 days';

        const companyPaymentReceived = Number(margin.incoming || 0) > 0;
        const trainerSettlementPaid = Number(margin.outgoing || 0) >= Number(margin.incoming || 0) && Number(margin.incoming || 0) > 0;

        let nextAction = 'Monitor';
        if (!companyPaymentReceived && ageDays >= 30) {
          nextAction = 'Follow up company payment';
        } else if (companyPaymentReceived && !trainerSettlementPaid) {
          nextAction = 'Ready to settle trainer';
        } else if (trainerSettlementPaid) {
          nextAction = 'Settlement done';
        }

        return {
          ...eng,
          refDate,
          ageDays,
          indicator,
          incoming: Number(margin.incoming || 0),
          outgoing: Number(margin.outgoing || 0),
          marginLeft: Number(margin.marginAmount || 0),
          companyPaymentReceived,
          trainerSettlementPaid,
          nextAction
        };
      })
      .filter((row) => {
        if (agingTrainerFilter) {
          const trainerMatch = row.trainerId === agingTrainerFilter || row.trainerName === trainerNames.find((t) => t.id === agingTrainerFilter)?.name;
          if (!trainerMatch) return false;
        }
        if (agingFromDate) {
          if (!row.refDate || new Date(row.refDate) < new Date(agingFromDate)) return false;
        }
        if (agingToDate) {
          if (!row.refDate || new Date(row.refDate) > new Date(agingToDate)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const ad = new Date(a.refDate || 0).getTime();
        const bd = new Date(b.refDate || 0).getTime();
        return ad - bd;
      });
  }, [trainingEngagementOptions, financialBridge.engagementMargins, agingTrainerFilter, agingFromDate, agingToDate, trainerNames]);

  if (loading) {
    return (
      <section className="ops-page">
        <div className="ops-page-header">
          <h1>Payments</h1>
        </div>
        <p className="muted">Loading payment data…</p>
      </section>
    );
  }

  return (
    <section className="ops-page">
      {/* ── Page Header ── */}
      <div className="ops-page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h1>Payments Dashboard</h1>
            <p>Synced payment records across training engagements, organizations, and trainer/vendor records.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={loadEngagements}>Refresh</button>
            <button className="btn btn-primary" onClick={handleCreateFinanceRecord}>+ Add Payment</button>
          </div>
        </div>
        {fetchError && <p className="warning" style={{ marginTop: '0.5rem' }}>{fetchError}</p>}
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Engagements', value: summary.count, accent: false },
          { label: 'Total Payable', value: fmt(summary.total), accent: false },
          { label: 'Paid', value: fmt(summary.paid), accent: true, color: '#22c55e' },
          { label: 'Pending / Due', value: fmt(summary.pending), accent: true, color: '#f59e0b' }
        ].map((card) => (
          <div key={card.label} className="ops-card" style={{ padding: '1rem 1.25rem', textAlign: 'center' }}>
            <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>{card.label}</p>
            <strong style={{ fontSize: '1.35rem', color: card.color || 'inherit' }}>{card.value}</strong>
          </div>
        ))}
      </div>

      <article className="ops-card" style={{ marginBottom: '1.2rem', display: 'flex', justifyContent: 'space-between', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: 0 }}>Trainer Settlement Moved</h3>
          <p className="muted" style={{ margin: '0.3rem 0 0' }}>
            Use the dedicated Trainer Settlement section for cleared/pending view, pending reasons, and 30/45-day cycle tracking.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/trainer-settlements')}>
          Open Trainer Settlement
        </button>
      </article>

      {SHOW_SETTLEMENT_IN_PAYMENTS && (
      <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
        <div className="ops-card" style={{ padding: '1rem 1.25rem' }}>
          <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Incoming Revenue (Received)</p>
          <strong style={{ fontSize: '1.2rem' }}>{fmt(financialBridge.incomingRevenue)}</strong>
        </div>
        <div className="ops-card" style={{ padding: '1rem 1.25rem' }}>
          <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Outgoing Settlement (Paid)</p>
          <strong style={{ fontSize: '1.2rem', color: '#ef4444' }}>{fmt(financialBridge.outgoingPaid)}</strong>
        </div>
        <div className="ops-card" style={{ padding: '1rem 1.25rem' }}>
          <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Current Profit</p>
          <strong style={{ fontSize: '1.2rem', color: financialBridge.profit >= 0 ? '#22c55e' : '#ef4444' }}>
            {fmt(financialBridge.profit)}
          </strong>
        </div>
        <div className="ops-card" style={{ padding: '1rem 1.25rem' }}>
          <p className="muted" style={{ fontSize: '0.75rem', marginBottom: '0.3rem' }}>Margin</p>
          <strong style={{ fontSize: '1.2rem' }}>{financialBridge.marginPercent.toFixed(2)}%</strong>
          <p className="muted" style={{ fontSize: '0.72rem', marginTop: '0.2rem' }}>
            Planned settlement: {fmt(financialBridge.outgoingPlanned)}
          </p>
        </div>
      </div>

      <article className="ops-card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Trainer Settlement</h3>
            <p className="muted" style={{ margin: '0.25rem 0 0' }}>
              Track outgoing trainer payouts and keep company profit and margin synced with finance inflow.
            </p>
          </div>
          {settlementForm.id && (
            <button className="btn btn-secondary" onClick={resetSettlementForm}>Cancel Edit</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginBottom: '0.9rem' }}>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Trainer</span>
            <select
              className="form-control"
              value={settlementForm.trainerId}
              onChange={(e) => handleSettlementTrainerChange(e.target.value)}
            >
              <option value="">Select Trainer</option>
              {trainerNames.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Training Engagement</span>
            <select
              className="form-control"
              value={settlementForm.trainingRecordId}
              disabled={!settlementForm.trainerId}
              onChange={(e) => handleSettlementEngagementChange(e.target.value)}
            >
              <option value="">Select Engagement</option>
              {settlementOptionBuckets.open.length > 0 && (
                <optgroup label="Open Engagements">
                  {settlementOptionBuckets.open.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </optgroup>
              )}
              {settlementOptionBuckets.done.length > 0 && (
                <optgroup label="Settled / Done (Read Only)">
                  {settlementOptionBuckets.done.map((item) => (
                    <option key={item.id} value={item.id} disabled>{item.label} (Done)</option>
                  ))}
                </optgroup>
              )}
            </select>
            {!settlementForm.trainerId && (
              <span className="muted" style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
                Select trainer first to filter engagements.
              </span>
            )}
            {settlementForm.trainerId && settlementOptionBuckets.open.length === 0 && settlementOptionBuckets.done.length > 0 && (
              <span className="muted" style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
                All trainer engagements are fully settled.
              </span>
            )}
            {settlementForm.trainerId && settlementOptionBuckets.open.length === 0 && settlementOptionBuckets.done.length === 0 && (
              <span className="muted" style={{ fontSize: '0.7rem', display: 'block', marginTop: '4px' }}>
                No engagements found for the selected trainer.
              </span>
            )}
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>College</span>
            <input
              className="form-control"
              type="text"
              value={settlementForm.collegeName}
              placeholder="Auto from engagement"
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Organization (EdTech)</span>
            <input
              className="form-control"
              type="text"
              value={settlementForm.organizationName}
              placeholder="Auto from engagement"
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Start Date</span>
            <input
              className="form-control"
              type="date"
              value={settlementForm.startDate}
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>End Date</span>
            <input
              className="form-control"
              type="date"
              value={settlementForm.endDate}
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>No. of Days</span>
            <input
              className="form-control"
              type="number"
              value={settlementForm.totalDays}
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Per Day Payment</span>
            <input
              className="form-control"
              type="number"
              min="0"
              step="0.01"
              value={settlementForm.perDayPayment}
              onChange={(e) => handlePerDaySettlementChange(e.target.value)}
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Total Settlement Amount</span>
            <input
              className="form-control"
              type="number"
              min="0"
              step="0.01"
              value={settlementForm.amount}
              readOnly
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Settlement Date</span>
            <input
              className="form-control"
              type="date"
              value={settlementForm.paidDate}
              onChange={(e) => setSettlementForm((prev) => ({ ...prev, paidDate: e.target.value }))}
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Status</span>
            <select
              className="form-control"
              value={settlementForm.status}
              onChange={(e) => setSettlementForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              {SETTLEMENT_STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label style={{ gridColumn: '1 / -1' }}>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Notes</span>
            <input
              className="form-control"
              type="text"
              value={settlementForm.notes}
              onChange={(e) => setSettlementForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="UTR / remarks / split payout details"
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <button className="btn btn-primary" onClick={handleSaveSettlement}>
            {settlementForm.id ? 'Update Settlement' : '+ Add Settlement'}
          </button>
        </div>

        {selectedEngagementMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginBottom: '0.9rem' }}>
            <div className="ops-card" style={{ padding: '0.8rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Overall Project Net</p>
              <strong>{fmt(selectedEngagementMetrics.netAmount)}</strong>
            </div>
            <div className="ops-card" style={{ padding: '0.8rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Total Paid (This Project)</p>
              <strong>{fmt(selectedEngagementMetrics.totalPaid)}</strong>
            </div>
            <div className="ops-card" style={{ padding: '0.8rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Total Logged Settlement</p>
              <strong>{fmt(selectedEngagementMetrics.totalLogged)}</strong>
            </div>
            <div className="ops-card" style={{ padding: '0.8rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Margin Left (After Current Entry)</p>
              <strong style={{ color: selectedEngagementMetrics.marginLeftAfterCurrent >= 0 ? '#22c55e' : '#ef4444' }}>
                {fmt(selectedEngagementMetrics.marginLeftAfterCurrent)}
              </strong>
            </div>
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Engagement</th>
                <th>Trainer</th>
                <th>College</th>
                <th>Organization</th>
                <th>Dates</th>
                <th>Days</th>
                <th>Per Day</th>
                <th>Settlement Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 && (
                <tr>
                  <td colSpan="12" className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                    No trainer settlement records yet.
                  </td>
                </tr>
              )}
              {settlements.map((item) => (
                <tr key={item.id}>
                  <td>{item.engagementLabel || '—'}</td>
                  <td><strong>{item.trainerName || 'Unknown Trainer'}</strong></td>
                  <td>{item.collegeName || item.orgName || '—'}</td>
                  <td>{item.organizationName || '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(item.startDate)}
                    {item.startDate && item.endDate && item.startDate !== item.endDate && <> → {fmtDate(item.endDate)}</>}
                  </td>
                  <td>{Number(item.totalDays || 0)}</td>
                  <td>{fmt(item.perDayPayment || (Number(item.totalDays || 0) > 0 ? Number(item.amount || 0) / Number(item.totalDays || 1) : 0))}</td>
                  <td>{fmtDate(item.paidDate)}</td>
                  <td><strong>{fmt(item.amount)}</strong></td>
                  <td>
                    <span className={`status-pill ${item.status === 'Paid' ? 'pill-green' : item.status === 'Partially Paid' ? 'pill-yellow' : 'pill-grey'}`}>
                      {item.status}
                    </span>
                  </td>
                  <td>{item.notes || '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {item.status !== 'Paid' && (
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleSetSettlementPaid(item.id)}
                        >
                          Mark Paid
                        </button>
                      )}
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => handleEditSettlement(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                        onClick={() => handleDeleteSettlement(item.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="ops-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.8rem' }}>Engagement Margin Tracker</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
          Margin per engagement = paid incoming revenue - paid trainer settlement from the same engagement.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Engagement</th>
                <th>Expected Net</th>
                <th>Incoming (Paid)</th>
                <th>Trainer Settlement (Paid)</th>
                <th>Margin Amount</th>
                <th>Margin %</th>
              </tr>
            </thead>
            <tbody>
              {financialBridge.engagementMargins.length === 0 && (
                <tr>
                  <td colSpan="6" className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                    No engagement records available.
                  </td>
                </tr>
              )}
              {financialBridge.engagementMargins.map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{fmt(item.netAmount)}</td>
                  <td>{fmt(item.incoming)}</td>
                  <td>{fmt(item.outgoing)}</td>
                  <td>
                    <strong style={{ color: item.marginAmount >= 0 ? '#22c55e' : '#ef4444' }}>
                      {fmt(item.marginAmount)}
                    </strong>
                  </td>
                  <td>{item.marginPercent.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className="ops-card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>Payment Aging Indicator (30 / 45 Days)</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: '0.9rem' }}>
          Oldest trainings first. Track crossed 30/45 day lines to know when company payment is due and when trainer settlement can be released.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginBottom: '0.9rem' }}>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Trainer</span>
            <select
              className="form-control"
              value={agingTrainerFilter}
              onChange={(e) => setAgingTrainerFilter(e.target.value)}
            >
              <option value="">All Trainers</option>
              {trainerNames.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>From Date</span>
            <input
              className="form-control"
              type="date"
              value={agingFromDate}
              onChange={(e) => setAgingFromDate(e.target.value)}
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>To Date</span>
            <input
              className="form-control"
              type="date"
              value={agingToDate}
              onChange={(e) => setAgingToDate(e.target.value)}
            />
          </label>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Trainer</th>
                <th>Engagement</th>
                <th>Training Dates</th>
                <th>Age (Days)</th>
                <th>Indicator</th>
                <th>Company Received</th>
                <th>Trainer Settled</th>
                <th>Margin Left</th>
                <th>Next Action</th>
              </tr>
            </thead>
            <tbody>
              {agingRows.length === 0 && (
                <tr>
                  <td colSpan="9" className="muted" style={{ textAlign: 'center', padding: '1rem' }}>
                    No engagements match the selected filters.
                  </td>
                </tr>
              )}
              {agingRows.map((row) => (
                <tr key={`aging-${row.id}`}>
                  <td>{row.trainerName || '—'}</td>
                  <td>{row.label}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {fmtDate(row.startDate)}
                    {row.startDate && row.endDate && row.startDate !== row.endDate && <> → {fmtDate(row.endDate)}</>}
                  </td>
                  <td>{row.ageDays}</td>
                  <td>
                    <span className={`status-pill ${row.ageDays >= 45 ? 'pill-red' : row.ageDays >= 30 ? 'pill-yellow' : 'pill-grey'}`}>
                      {row.indicator}
                    </span>
                  </td>
                  <td>{row.companyPaymentReceived ? 'Yes' : 'No'}</td>
                  <td>{row.trainerSettlementPaid ? 'Yes' : 'No'}</td>
                  <td>{fmt(row.marginLeft)}</td>
                  <td>{row.nextAction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      </>
      )}

      {/* ── Filters ── */}
      <div className="ops-card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ flex: '1 1 180px' }}>
            <span className="muted" style={{ fontSize: '0.76rem', display: 'block', marginBottom: '3px' }}>Filter by Organization</span>
            <select className="form-control" value={filterOrg} onChange={(e) => setFilterOrg(e.target.value)}>
              <option value="">All Organizations</option>
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label style={{ flex: '1 1 180px' }}>
            <span className="muted" style={{ fontSize: '0.76rem', display: 'block', marginBottom: '3px' }}>Filter by Trainer</span>
            <select className="form-control" value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)}>
              <option value="">All Trainers</option>
              {trainerNames.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label style={{ flex: '1 1 150px' }}>
            <span className="muted" style={{ fontSize: '0.76rem', display: 'block', marginBottom: '3px' }}>Filter by Status</span>
            <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Statuses</option>
              {STATUS_ORDER.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          {(filterOrg || filterTrainer || filterStatus) && (
            <button
              className="btn btn-secondary"
              style={{ alignSelf: 'flex-end', padding: '7px 14px', fontSize: '0.82rem' }}
              onClick={() => { setFilterOrg(''); setFilterTrainer(''); setFilterStatus(''); }}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: 'flex', gap: '0', borderBottom: '2px solid var(--ops-border)', marginBottom: '1.25rem' }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: 'none',
              border: 'none',
              padding: '0.6rem 1.25rem',
              cursor: 'pointer',
              fontSize: '0.88rem',
              fontWeight: activeTab === tab ? '600' : '400',
              color: activeTab === tab ? 'var(--ops-accent)' : 'var(--ops-text-secondary)',
              borderBottom: activeTab === tab ? '2.5px solid var(--ops-accent)' : '2.5px solid transparent',
              marginBottom: '-2px',
              transition: 'color 0.15s'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── BY ORGANIZATION ── */}
      {activeTab === 'By Organization' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {byOrg.length === 0 && (
            <article className="ops-card">
              <p className="muted">No payment records found. Create training engagements to see payments here.</p>
            </article>
          )}
          {byOrg.map((group) => {
            const groupTotal = group.rows.reduce((s, r) => s + r.amount, 0);
            const groupPaid = group.rows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
            const isOpen = expandedOrgs[group.orgId] !== false; // default open

            return (
              <article className="ops-card" key={group.orgId} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Group Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    background: 'var(--ops-card-bg)',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                  onClick={() => toggleOrg(group.orgId)}
                >
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{group.orgName}</strong>
                    {group.clientName && group.clientName !== '—' && (
                      <span className="muted" style={{ fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                        Client: {group.clientName}
                      </span>
                    )}
                    <span className="muted" style={{ fontSize: '0.76rem', display: 'block', marginTop: '2px' }}>
                      {group.rows.length} trainer assignment{group.rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Total Payable</p>
                      <strong style={{ fontSize: '1.05rem' }}>{fmt(groupTotal)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Paid</p>
                      <strong style={{ color: '#22c55e' }}>{fmt(groupPaid)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Pending</p>
                      <strong style={{ color: '#f59e0b' }}>{fmt(groupTotal - groupPaid)}</strong>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--ops-text-secondary)' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                </div>

                {/* Trainer rows */}
                {isOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="ops-table" style={{ margin: 0, borderTop: '1px solid var(--ops-border)' }}>
                      <thead>
                        <tr>
                          <th>Trainer</th>
                          <th>Subject Area</th>
                          <th>Topic</th>
                          <th>Dates</th>
                          <th>Days</th>
                          <th>Daily Rate</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, idx) => (
                          <tr key={`${row.engagementId}-${row.trainerId}-${idx}`}>
                            <td>
                              <strong style={{ display: 'block' }}>{row.trainerName}</strong>
                              {row.trainerEmail && (
                                <span className="muted" style={{ fontSize: '0.72rem' }}>{row.trainerEmail}</span>
                              )}
                            </td>
                            <td>{row.subjectArea}</td>
                            <td>{row.trainingTopic}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                              {fmtDate(row.startDate)}
                              {row.startDate !== row.endDate && <> → {fmtDate(row.endDate)}</>}
                            </td>
                            <td>{row.totalDays}</td>
                            <td>{fmt(row.dailyRate)}</td>
                            <td><strong>{fmt(row.amount)}</strong></td>
                            <td>
                              <span className={`status-pill ${STATUS_COLORS[row.status] || ''}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <select
                                  className="form-control"
                                  style={{ minWidth: '118px', fontSize: '0.76rem', padding: '4px 8px' }}
                                  value={row.status}
                                  disabled={updatingId === row.engagementId}
                                  onChange={(e) => handleStatusUpdate(row, e.target.value)}
                                >
                                  {STATUS_ORDER.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                  onClick={() => handleEditAmount(row)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                  onClick={() => handleDeleteRow(row)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--ops-row-alt, rgba(0,0,0,0.03))' }}>
                          <td colSpan="6" style={{ textAlign: 'right', fontWeight: '600', padding: '0.6rem 1rem' }}>
                            Organization Total
                          </td>
                          <td colSpan="3" style={{ fontWeight: '700', padding: '0.6rem 1rem' }}>
                            {fmt(groupTotal)}
                            <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.76rem' }}>
                              ({fmt(groupPaid)} paid)
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── BY TRAINER ── */}
      {activeTab === 'By Trainer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {byTrainer.length === 0 && (
            <article className="ops-card">
              <p className="muted">No payment records found.</p>
            </article>
          )}
          {byTrainer.map((group) => {
            const trainerTotal = group.rows.reduce((s, r) => s + r.amount, 0);
            const trainerPaid = group.rows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amount, 0);
            const isOpen = expandedTrainers[group.trainerId] !== false; // default open

            return (
              <article className="ops-card" key={group.trainerId} style={{ padding: 0, overflow: 'hidden' }}>
                {/* Trainer Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    cursor: 'pointer',
                    background: 'var(--ops-card-bg)',
                    gap: '1rem',
                    flexWrap: 'wrap'
                  }}
                  onClick={() => toggleTrainer(group.trainerId)}
                >
                  <div>
                    <strong style={{ fontSize: '1rem' }}>{group.trainerName}</strong>
                    {group.trainerEmail && (
                      <span className="muted" style={{ fontSize: '0.78rem', marginLeft: '0.5rem' }}>
                        {group.trainerEmail}
                      </span>
                    )}
                    <span className="muted" style={{ fontSize: '0.76rem', display: 'block', marginTop: '2px' }}>
                      {group.rows.length} engagement{group.rows.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Total Payable</p>
                      <strong style={{ fontSize: '1.05rem' }}>{fmt(trainerTotal)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Paid</p>
                      <strong style={{ color: '#22c55e' }}>{fmt(trainerPaid)}</strong>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p className="muted" style={{ fontSize: '0.72rem', marginBottom: '2px' }}>Pending</p>
                      <strong style={{ color: '#f59e0b' }}>{fmt(trainerTotal - trainerPaid)}</strong>
                    </div>
                    <span style={{ fontSize: '1.2rem', color: 'var(--ops-text-secondary)' }}>{isOpen ? '▾' : '▸'}</span>
                  </div>
                </div>

                {/* Engagement rows for this trainer */}
                {isOpen && (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="ops-table" style={{ margin: 0, borderTop: '1px solid var(--ops-border)' }}>
                      <thead>
                        <tr>
                          <th>Institution / College</th>
                          <th>Client Org</th>
                          <th>Subject</th>
                          <th>Topic</th>
                          <th>Dates</th>
                          <th>Days</th>
                          <th>Rate</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row, idx) => (
                          <tr key={`${row.engagementId}-${idx}`}>
                            <td><strong>{row.orgName}</strong></td>
                            <td>{row.clientName}</td>
                            <td>{row.subjectArea}</td>
                            <td>{row.trainingTopic}</td>
                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                              {fmtDate(row.startDate)}
                              {row.startDate !== row.endDate && <> → {fmtDate(row.endDate)}</>}
                            </td>
                            <td>{row.totalDays}</td>
                            <td>{fmt(row.dailyRate)}</td>
                            <td><strong>{fmt(row.amount)}</strong></td>
                            <td>
                              <span className={`status-pill ${STATUS_COLORS[row.status] || ''}`}>
                                {row.status}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <select
                                  className="form-control"
                                  style={{ minWidth: '118px', fontSize: '0.76rem', padding: '4px 8px' }}
                                  value={row.status}
                                  disabled={updatingId === row.engagementId}
                                  onChange={(e) => handleStatusUpdate(row, e.target.value)}
                                >
                                  {STATUS_ORDER.map((status) => (
                                    <option key={status} value={status}>{status}</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                  onClick={() => handleEditAmount(row)}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                                  onClick={() => handleDeleteRow(row)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--ops-row-alt, rgba(0,0,0,0.03))' }}>
                          <td colSpan="7" style={{ textAlign: 'right', fontWeight: '600', padding: '0.6rem 1rem' }}>
                            Trainer Total
                          </td>
                          <td colSpan="3" style={{ fontWeight: '700', padding: '0.6rem 1rem' }}>
                            {fmt(trainerTotal)}
                            <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.76rem' }}>
                              ({fmt(trainerPaid)} paid)
                            </span>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {/* ── ALL ENGAGEMENTS ── */}
      {activeTab === 'All Engagements' && (
        <article className="ops-card" style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="ops-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Client Org</th>
                  <th>Trainer</th>
                  <th>Subject</th>
                  <th>Topic</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Rate/Day</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 && (
                  <tr>
                    <td colSpan="11" className="muted" style={{ textAlign: 'center', padding: '2rem' }}>
                      No records match the selected filters.
                    </td>
                  </tr>
                )}
                {visibleRows.map((row, idx) => (
                  <tr key={`${row.engagementId}-${row.trainerId}-${idx}`}>
                    <td><strong>{row.orgName}</strong></td>
                    <td>{row.clientName}</td>
                    <td>
                      <strong style={{ display: 'block' }}>{row.trainerName}</strong>
                      {row.trainerEmail && (
                        <span className="muted" style={{ fontSize: '0.72rem' }}>{row.trainerEmail}</span>
                      )}
                    </td>
                    <td>{row.subjectArea}</td>
                    <td>{row.trainingTopic}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                      {fmtDate(row.startDate)}
                      {row.startDate !== row.endDate && <> →<br />{fmtDate(row.endDate)}</>}
                    </td>
                    <td>{row.totalDays}</td>
                    <td>{fmt(row.dailyRate)}</td>
                    <td><strong>{fmt(row.amount)}</strong></td>
                    <td>
                      <span className={`status-pill ${STATUS_COLORS[row.status] || ''}`}>
                        {row.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          className="form-control"
                          style={{ minWidth: '118px', fontSize: '0.76rem', padding: '4px 8px' }}
                          value={row.status}
                          disabled={updatingId === row.engagementId}
                          onChange={(e) => handleStatusUpdate(row, e.target.value)}
                        >
                          {STATUS_ORDER.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleEditAmount(row)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                          onClick={() => handleDeleteRow(row)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              {visibleRows.length > 0 && (
                <tfoot>
                  <tr style={{ background: 'var(--ops-row-alt, rgba(0,0,0,0.03))' }}>
                    <td colSpan="8" style={{ textAlign: 'right', fontWeight: '600', padding: '0.6rem 1rem' }}>
                      Grand Total
                    </td>
                    <td colSpan="3" style={{ fontWeight: '700', padding: '0.6rem 1rem' }}>
                      {fmt(visibleRows.reduce((s, r) => s + r.amount, 0))}
                      <span className="muted" style={{ marginLeft: '0.75rem', fontSize: '0.76rem' }}>
                        ({fmt(visibleRows.filter((r) => r.status === 'Paid').reduce((s, r) => s + r.amount, 0))} paid)
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </article>
      )}
    </section>
  );
}
