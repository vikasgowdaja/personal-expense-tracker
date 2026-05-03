import React, { useEffect, useMemo, useRef, useState } from 'react';
import { clientAPI, employeeAPI, institutionAPI, topicAPI, trainerAPI, trainerSettlementAPI, trainingEngagementAPI } from '../../services/api';
import ProfitJarAnimation from '../Common/ProfitJarAnimation';
import WheelPagination from '../ui/WheelPagination';

const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const ENGAGEMENT_TYPES = [
  'Batch Training',
  'Workshop',
  'Corporate Bootcamp',
  'Lab Session',
  'Mentoring',
  'Webinar',
  'Certification Prep'
];

const DEFAULT_TDS_PERCENT = 10;

const MARK_ORG_PAID_GOLD_STYLE = {
  padding: '4px 10px',
  fontSize: '0.76rem',
  marginRight: '6px',
  border: '1px solid #b8860b',
  borderRadius: '8px',
  color: '#3d2c00',
  fontWeight: 700,
  backgroundImage: 'linear-gradient(135deg, #fff3b0 0%, #ffd95a 40%, #f4b400 72%, #d99600 100%)',
  boxShadow: '0 2px 8px rgba(244, 180, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.75)',
  textShadow: '0 1px 0 rgba(255, 255, 255, 0.45)',
  letterSpacing: '0.2px'
};

const MARK_ORG_PAID_LOCKED_STYLE = {
  padding: '4px 10px',
  fontSize: '0.76rem',
  marginRight: '6px',
  border: '1px solid #6b7280',
  borderRadius: '8px',
  color: '#f9fafb',
  fontWeight: 700,
  backgroundImage: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 42%, #6b7280 75%, #4b5563 100%)',
  boxShadow: '0 2px 8px rgba(75, 85, 99, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
  textShadow: '0 1px 0 rgba(17, 24, 39, 0.35)',
  letterSpacing: '0.2px'
};

const SETTLE_TRAINER_RESPONSIBILITY_STYLE = {
  padding: '4px 10px',
  fontSize: '0.76rem',
  marginRight: '6px',
  border: '1px solid #b91c1c',
  borderRadius: '8px',
  color: '#ffffff',
  fontWeight: 700,
  backgroundImage: 'linear-gradient(135deg, #ef4444 0%, #dc2626 48%, #b91c1c 100%)',
  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.22)',
  textShadow: '0 1px 0 rgba(127, 29, 29, 0.45)',
  letterSpacing: '0.2px'
};

const CONFIRM_TONE_STYLES = {
  default: {
    border: '1px solid #1d4ed8',
    background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
  },
  danger: {
    border: '1px solid #b91c1c',
    background: 'linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)'
  },
  success: {
    border: '1px solid #b8860b',
    background: 'linear-gradient(135deg, #f5cf62 0%, #d4af37 72%, #b8860b 100%)'
  }
};

function toLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const TODAY_KEY = toLocalDateKey(new Date());

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDateListFromRange(startDate, endDate) {
  if (!startDate || !endDate) return [];
  const dates = [];
  const cursor = new Date(startDate);
  const end = new Date(endDate);
  cursor.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    dates.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function normalizeApiEngagement(row) {
  const firstTrainer = Array.isArray(row.trainers) && row.trainers.length > 0 ? row.trainers[0] : null;
  const trainerDoc = firstTrainer?.trainerId;
  const startDate = toDateInputValue(row.startDate);
  const endDate = toDateInputValue(row.endDate);
  const selectedDates = Array.isArray(row.selectedDates) && row.selectedDates.length > 0
    ? normalizeDateList(row.selectedDates)
    : buildDateListFromRange(startDate, endDate);

  return {
    id: row._id,
    topic: firstTrainer?.trainingTopic || '',
    engagementType: row.engagementTitle || 'Batch Training',
    trainerId: trainerDoc?._id || firstTrainer?.trainerId || '',
    trainerName: trainerDoc?.fullName || '',
    college: row.institutionId?.name || '',
    organization: row.clientId?.name || '',
    dateMode: 'selected',
    startDate,
    endDate,
    selectedDates,
    totalDays: Number(row.totalDays || selectedDates.length || 0),
    dailyHours: Number(row.dailyHours || 0),
    learners: Number(row.learners || 0),
    ratePerDay: Number(firstTrainer?.dailyRate || 0),
    grossAmount: Number(row.grossAmount !== undefined ? row.grossAmount : row.totalAmount || 0),
    tdsApplicable: row.tdsApplicable !== false,
    tdsPercent: Number(row.tdsPercent !== undefined ? row.tdsPercent : DEFAULT_TDS_PERCENT),
    tdsAmount: Number(row.tdsAmount || 0),
    totalAmount: Number(row.totalAmount || 0),
    notes: row.notes || '',
    paymentStatus: row.status || 'Invoiced',
    orgPaymentReceivedAt: row.orgPaymentReceivedAt || null,
    ownerSuperadminId: row.ownerSuperadminId || '',
    connectionId: row.connectionId || '',
    sourcedByUserId: row.sourcedByUserId || '',
    sourcedBy: row.sourcedBy || '',
    sourcedByName: row.sourcedByName || '',
    createdAt: row.createdAt || new Date().toISOString()
  };
}

const EMPTY_FORM = {
  topic: '',
  customTopic: '',
  engagementType: 'Batch Training',
  trainerId: '',
  trainerName: '',
  college: '',
  customCollege: '',
  organization: '',
  customOrganization: '',
  dateMode: 'selected',
  startDate: TODAY_KEY,
  endDate: TODAY_KEY,
  selectedDates: [TODAY_KEY],
  bulkDateInput: TODAY_KEY,
  dailyHours: '',
  learners: '',
  ratePerDay: '',
  notes: '',
  tdsApplicable: true,
  paymentStatus: 'Invoiced',
  connectionId: '',
  sourcedBy: '',
  sourcedByName: ''
};

function normalizeDateList(dateList) {
  return [...new Set((dateList || []).filter(Boolean))].sort((a, b) => new Date(a) - new Date(b));
}

function parseBulkDates(value) {
  return normalizeDateList(
    String(value || '')
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item))
  );
}

function getEffectiveDates(rowOrForm) {
  if (rowOrForm.dateMode === 'selected') {
    return normalizeDateList(rowOrForm.selectedDates || []);
  }
  if (!rowOrForm.startDate || !rowOrForm.endDate) {
    return [];
  }
  const dates = [];
  const cursor = new Date(rowOrForm.startDate);
  const end = new Date(rowOrForm.endDate);
  while (cursor <= end) {
    dates.push(toLocalDateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function getTotalDays(rowOrForm) {
  return getEffectiveDates(rowOrForm).length;
}

function getDateRangeFromDates(dateList) {
  const normalized = normalizeDateList(dateList);
  if (normalized.length === 0) {
    return { startDate: '', endDate: '' };
  }
  return {
    startDate: normalized[0],
    endDate: normalized[normalized.length - 1]
  };
}

function formatDateSummary(row) {
  const dates = normalizeDateList(row.selectedDates || []);
  if ((row.dateMode || 'range') === 'selected' && dates.length > 0) {
    return `${formatDate(dates[0])} → ${formatDate(dates[dates.length - 1])}`;
  }
  return `${formatDate(row.startDate)} → ${formatDate(row.endDate)}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatMonthLabel(date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function toInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function getGrossAmount(row) {
  return Number(row.grossAmount !== undefined ? row.grossAmount : row.totalAmount || 0);
}

function getTdsAmount(row) {
  if (row.tdsApplicable === false) {
    return 0;
  }
  if (row.tdsAmount !== undefined) {
    return Number(row.tdsAmount || 0);
  }
  return (getGrossAmount(row) * DEFAULT_TDS_PERCENT) / 100;
}

function getNetAmount(row) {
  if (row.grossAmount === undefined && row.tdsAmount === undefined && row.tdsApplicable === undefined) {
    return getGrossAmount(row) - getTdsAmount(row);
  }
  if (row.totalAmount !== undefined) {
    return Number(row.totalAmount || 0);
  }
  return getGrossAmount(row) - getTdsAmount(row);
}

function getUserDefaultConnection(user) {
  if (!user) return '';
  if (user.defaultConnectionId) return user.defaultConnectionId;
  const activeConnections = (user.connections || []).filter((c) => c.isActive !== false);
  return activeConnections[0]?.connectionId || '';
}

function getEmployeeConnectionContext(user, selectedConnectionId) {
  const activeConnections = (user?.connections || []).filter((c) => c.isActive !== false);
  if (!activeConnections.length) return null;
  if (selectedConnectionId) {
    const match = activeConnections.find((c) => c.connectionId === selectedConnectionId);
    if (match) return match;
  }
  return activeConnections[0];
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
    perDayPayment: Number(row.perDayPayment || 0),
    totalDays: Number(row.totalDays || 0),
    paidDate: row.paidDate || null,
    trainerName: row.trainerName || '',
    notes: row.notes || ''
  };
}

function TrainingEngagementsHub({ user }) {
  const [engagements, setEngagements] = useState([]);
  const [form, setForm] = useState(() => {
    const base = { ...EMPTY_FORM };
    if (user?.employeeId) {
      base.sourcedBy = user.employeeId;
      base.sourcedByName = user.name || '';
    } else if (user?.name) {
      base.sourcedBy = user.name;
      base.sourcedByName = user.name;
    }
    base.connectionId = getUserDefaultConnection(user);
    return base;
  });
  const [editId, setEditId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [pickerMonth, setPickerMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [topicOptions, setTopicOptions] = useState([]);
  const [collegeOptions, setCollegeOptions] = useState([]);
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [trainerOptions, setTrainerOptions] = useState([]);
  const [institutionRows, setInstitutionRows] = useState([]);
  const [clientRows, setClientRows] = useState([]);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [settlementRows, setSettlementRows] = useState([]);
  const [settlementDialog, setSettlementDialog] = useState({
    open: false,
    mode: 'create',
    settlementId: '',
    engagementId: '',
    engagementLabel: '',
    trainerId: '',
    trainerName: '',
    collegeName: '',
    organizationName: '',
    startDate: '',
    endDate: '',
    totalDays: 0,
    perDayPayment: '',
    amount: '',
    maxAllowedAmount: 0,
    netPayableAmount: 0,
    consumedAmount: 0,
    status: 'Paid',
    notes: ''
  });

  const [filterCollege, setFilterCollege] = useState('');
  const [filterOrganization, setFilterOrganization] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [markOrgPaidPressedRowId, setMarkOrgPaidPressedRowId] = useState('');
  const [profitAnimationState, setProfitAnimationState] = useState({
    active: false,
    rowId: '',
    amount: 0,
    pulse: 0
  });
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: '',
    message: '',
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'default'
  });
  const confirmResolverRef = useRef(null);

  // ── Bulk selection state ──
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkSourcedBy, setBulkSourcedBy] = useState('');
  const [bulkSourcedByName, setBulkSourcedByName] = useState('');

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 8;

  useEffect(() => {
    setCurrentPage(0);
  }, [filterCollege, filterOrganization, filterTrainer, filterStatus]);

  const persist = (next) => {
    setEngagements(next);
  };

  const requestConfirmation = ({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' }) => {
    return new Promise((resolve) => {
      if (confirmResolverRef.current) {
        confirmResolverRef.current(false);
      }
      confirmResolverRef.current = resolve;
      setConfirmDialog({
        open: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        tone
      });
    });
  };

  const resolveConfirmation = (accepted) => {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    if (confirmResolverRef.current) {
      confirmResolverRef.current(accepted);
      confirmResolverRef.current = null;
    }
  };

  const loadEngagements = async () => {
    try {
      const res = await trainingEngagementAPI.getAll();
      const rows = Array.isArray(res.data) ? res.data : [];
      const normalized = rows.map(normalizeApiEngagement);
      persist(normalized);
    } catch {
      setEngagements([]);
    }
  };

  const loadSettlements = async () => {
    try {
      const res = await trainerSettlementAPI.getAll();
      const rows = Array.isArray(res.data) ? res.data : [];
      setSettlementRows(rows.map(normalizeSettlementRow));
    } catch {
      setSettlementRows([]);
    }
  };

  const refreshLookups = async () => {
    try {
      const [topicsRes, institutionsRes, clientsRes] = await Promise.all([
        topicAPI.getAll(),
        institutionAPI.getAll(),
        clientAPI.getAll()
      ]);

      const topics = (topicsRes.data || [])
        .filter((item) => item.isActive !== false)
        .map((item) => (item.name || '').trim())
        .filter(Boolean);

      const institutionsData = Array.isArray(institutionsRes.data) ? institutionsRes.data : [];
      const clientsData = Array.isArray(clientsRes.data) ? clientsRes.data : [];

      const institutions = institutionsData.map((item) => (item.name || '').trim()).filter(Boolean);
      const clients = clientsData.map((item) => (item.name || '').trim()).filter(Boolean);

      setInstitutionRows(institutionsData);
      setClientRows(clientsData);

      const savedRows = engagements;
      const savedTopics = savedRows.map((item) => (item.topic || '').trim()).filter(Boolean);
      const savedColleges = savedRows.map((item) => (item.college || '').trim()).filter(Boolean);
      const savedOrganizations = savedRows.map((item) => (item.organization || '').trim()).filter(Boolean);

      setTopicOptions([...new Set([...topics, ...savedTopics])]);
      setCollegeOptions([...new Set([...institutions, ...savedColleges])]);
      setOrganizationOptions([...new Set([...clients, ...savedOrganizations])]);

      // Load employee list for sourcedBy dropdown (superadmin only, fails gracefully for employees)
      try {
        const empRes = await employeeAPI.getAll();
        setEmployeeOptions(empRes.data || []);
      } catch {
        setEmployeeOptions([]);
      }
    } catch {
      const savedRows = engagements;
      setTopicOptions([
        ...new Set(savedRows.map((item) => (item.topic || '').trim()).filter(Boolean))
      ]);
      setCollegeOptions([
        ...new Set(savedRows.map((item) => (item.college || '').trim()).filter(Boolean))
      ]);
      setOrganizationOptions([
        ...new Set(savedRows.map((item) => (item.organization || '').trim()).filter(Boolean))
      ]);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadEngagements();
      await loadSettlements();
      await refreshLookups();
      try {
        const trainersRes = await trainerAPI.getAll();
        const trainerRows = (Array.isArray(trainersRes.data) ? trainersRes.data : []).map((item) => ({
          id: item._id,
          trainerName: item.fullName || item.trainerName || '',
          userProfile: {
            email: item.email || '',
            phone: item.phone || ''
          }
        }));
        setTrainerOptions(trainerRows);
      } catch {
        setTrainerOptions([]);
      }
    };

    init();
  }, []);

  const handleField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'startDate' && next.endDate && value > next.endDate) {
        next.endDate = value;
      }
      return next;
    });
  };

  const handleTrainerSelect = async (trainerId) => {
    const found = trainerOptions.find((item) => item.id === trainerId);
    setForm((prev) => ({
      ...prev,
      trainerId,
      trainerName: found ? found.trainerName : ''
    }));

    if (!trainerId) return;

    try {
      const res = await trainingEngagementAPI.getTrainerDefaults(trainerId);
      const defaults = res?.data?.defaults || {};
      setForm((prev) => ({
        ...prev,
        dailyHours: defaults.dailyHours === null || defaults.dailyHours === undefined ? prev.dailyHours : String(defaults.dailyHours),
        learners: defaults.learners === null || defaults.learners === undefined ? prev.learners : String(defaults.learners),
        ratePerDay: defaults.ratePerDay === null || defaults.ratePerDay === undefined ? prev.ratePerDay : String(defaults.ratePerDay)
      }));
    } catch {
      // Keep entered values if defaults cannot be fetched.
    }
  };

  const handleBulkDateInput = (value) => {
    const selectedDates = parseBulkDates(value);
    const range = getDateRangeFromDates(selectedDates);
    setForm((prev) => ({
      ...prev,
      bulkDateInput: value,
      selectedDates,
      startDate: range.startDate,
      endDate: range.endDate
    }));
  };

  const toggleCalendarDate = (dateKey) => {
    setForm((prev) => {
      const current = new Set(normalizeDateList(prev.selectedDates || []));
      if (current.has(dateKey)) {
        current.delete(dateKey);
      } else {
        current.add(dateKey);
      }
      const selectedDates = normalizeDateList(Array.from(current));
      const range = getDateRangeFromDates(selectedDates);
      return {
        ...prev,
        selectedDates,
        bulkDateInput: selectedDates.join('\n'),
        startDate: range.startDate,
        endDate: range.endDate
      };
    });
  };

  const resolvedTopic = form.topic === 'Other' ? form.customTopic.trim() : form.topic;
  const resolvedCollege = form.college === 'Other College' ? form.customCollege.trim() : form.college;
  const resolvedOrg = form.organization === 'Other / External' ? form.customOrganization.trim() : form.organization;

  const handleSave = async (e) => {
    e.preventDefault();
    if (!resolvedTopic) {
      window.alert('Please select a topic.');
      return;
    }
    if (!resolvedCollege) {
      window.alert('Please select a college/institution.');
      return;
    }
    if (!resolvedOrg) {
      window.alert('Please select an organization.');
      return;
    }
    if (normalizeDateList(form.selectedDates).length === 0) {
      window.alert('Please enter at least one valid engagement date.');
      return;
    }

    if (!form.trainerId) {
      window.alert('Please select a trainer to create the engagement in database.');
      return;
    }

    try {
      const institution = institutionRows.find((x) => (x.name || '').trim().toLowerCase() === resolvedCollege.toLowerCase());
      const client = clientRows.find((x) => (x.name || '').trim().toLowerCase() === resolvedOrg.toLowerCase());

      let institutionId = institution?._id;
      let clientId = client?._id;

      if (!institutionId) {
        const createdInstitution = await institutionAPI.create({ name: resolvedCollege });
        institutionId = createdInstitution?.data?._id;
      }

      if (!clientId) {
        const createdClient = await clientAPI.create({ name: resolvedOrg });
        clientId = createdClient?.data?._id;
      }

      const effectiveDates = getEffectiveDates(form);
      const totalDays = effectiveDates.length;
      const rate = Number(form.ratePerDay || 0);
      const grossAmount = totalDays * rate;
      const tdsApplicable = form.tdsApplicable !== false;
      const tdsAmount = tdsApplicable ? (grossAmount * DEFAULT_TDS_PERCENT) / 100 : 0;
      const netAmount = grossAmount - tdsAmount;
      const effectiveRange = getDateRangeFromDates(effectiveDates);

      const payload = {
        institutionId,
        clientId,
        engagementTitle: form.engagementType,
        startDate: effectiveRange.startDate,
        endDate: effectiveRange.endDate,
        selectedDates: effectiveDates,
        dailyHours: Number(form.dailyHours || 0),
        learners: Number(form.learners || 0),
        trainers: [
          {
            trainerId: form.trainerId,
            trainingTopic: resolvedTopic,
            subjectArea: resolvedTopic,
            dailyRate: rate
          }
        ],
        tdsApplicable,
        tdsPercent: DEFAULT_TDS_PERCENT,
        tdsAmount,
        status: form.paymentStatus,
        notes: form.notes,
        connectionId: form.connectionId || getUserDefaultConnection(user),
        sourcedBy: form.sourcedBy || '',
        sourcedByName: form.sourcedByName || ''
      };

      if (editId) {
        await trainingEngagementAPI.update(editId, payload);
      } else {
        await trainingEngagementAPI.create(payload);
      }

      await loadEngagements();
      await loadSettlements();
      await refreshLookups();
      if (resolvedTopic && !topicOptions.includes(resolvedTopic)) {
        setTopicOptions((prev) => [resolvedTopic, ...prev]);
      }
      if (resolvedCollege && !collegeOptions.includes(resolvedCollege)) {
        setCollegeOptions((prev) => [resolvedCollege, ...prev]);
      }
      if (resolvedOrg && !organizationOptions.includes(resolvedOrg)) {
        setOrganizationOptions((prev) => [resolvedOrg, ...prev]);
      }

      const base = { ...EMPTY_FORM };
      if (user?.employeeId) {
        base.sourcedBy = user.employeeId;
        base.sourcedByName = user.name || '';
      } else if (user?.name) {
        base.sourcedBy = user.name;
        base.sourcedByName = user.name;
      }
      base.connectionId = getUserDefaultConnection(user);
      setForm(base);
      setEditId('');
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to save training engagement.');
    }
  };

  const handleEdit = (row) => {
    const isCustomTopic = !topicOptions.includes(row.topic);
    const isCustomCollege = !collegeOptions.includes(row.college);
    const isCustomOrg = !organizationOptions.includes(row.organization);

    setForm({
      topic: isCustomTopic ? 'Other' : row.topic,
      customTopic: isCustomTopic ? row.topic : '',
      engagementType: row.engagementType || 'Batch Training',
      trainerId: row.trainerId || '',
      trainerName: row.trainerName || '',
      college: isCustomCollege ? 'Other College' : row.college,
      customCollege: isCustomCollege ? row.college : '',
      organization: isCustomOrg ? 'Other / External' : row.organization,
      customOrganization: isCustomOrg ? row.organization : '',
      dateMode: 'selected',
      startDate: row.startDate,
      endDate: row.endDate,
      selectedDates: normalizeDateList(row.selectedDates || getEffectiveDates(row)),
      bulkDateInput: normalizeDateList(row.selectedDates || getEffectiveDates(row)).join('\n'),
      dailyHours: String(row.dailyHours || ''),
      learners: String(row.learners || ''),
      ratePerDay: String(row.ratePerDay || ''),
      notes: row.notes || '',
      tdsApplicable: row.tdsApplicable !== false,
      paymentStatus: row.paymentStatus || 'Invoiced',
      connectionId: row.connectionId || getUserDefaultConnection(user),
      sourcedBy: row.sourcedBy || user?.employeeId || user?.name || '',
      sourcedByName: row.sourcedByName || user?.name || ''
    });

    const pivotDate = row.startDate || row.selectedDates?.[0] || TODAY_KEY;
    const pivot = new Date(pivotDate);
    setPickerMonth(new Date(pivot.getFullYear(), pivot.getMonth(), 1));

    setEditId(row.id);
    setActiveTab('log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const confirmed = await requestConfirmation({
      title: 'Delete Training Engagement',
      message: 'This action will permanently remove this engagement and linked cycle tracking records. Continue?',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      tone: 'danger'
    });
    if (!confirmed) return;

    trainingEngagementAPI.delete(id)
      .then(() => loadEngagements())
      .catch((err) => {
        window.alert(err?.response?.data?.message || 'Unable to delete training engagement');
      });
  };

  const handleMarkOrgPaid = async (row) => {
    setMarkOrgPaidPressedRowId(row.id);
    setTimeout(() => {
      setMarkOrgPaidPressedRowId((prev) => (prev === row.id ? '' : prev));
    }, 170);

    if ((row.paymentStatus || '').toLowerCase() === 'paid') {
      return;
    }
    const confirmed = await requestConfirmation({
      title: 'Confirm Organization Payment',
      message: `Mark this engagement as PAID by organization/payer?\n\n${row.organization} - ${row.college}`,
      confirmLabel: 'Mark Paid',
      cancelLabel: 'Not Now',
      tone: 'success'
    });
    if (!confirmed) return;

    try {
      await trainingEngagementAPI.markOrgPaid(row.id, {
        paymentReceivedAt: new Date().toISOString(),
        note: `Marked as paid from Training Engagements records by ${user?.name || 'user'}`
      });

      setProfitAnimationState({
        active: true,
        rowId: row.id,
        amount: Number(getNetAmount(row) || 0),
        pulse: Date.now()
      });

      await loadEngagements();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to mark payer-side payment as received.');
    }
  };

  const handleProfitAnimationDone = (rowId) => {
    setProfitAnimationState((prev) => {
      if (!prev.active || prev.rowId !== rowId) return prev;
      return {
        ...prev,
        active: false,
        rowId: '',
        amount: 0
      };
    });
  };

  const settlementSummaryMap = useMemo(() => {
    const map = new Map();

    settlementRows.forEach((item) => {
      const key = item.trainingRecordId;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          rows: [],
          totalCount: 0,
          paidCount: 0
        });
      }
      const bucket = map.get(key);
      bucket.rows.push(item);
      bucket.totalCount += 1;
      if (String(item.status || '').toLowerCase() === 'paid') {
        bucket.paidCount += 1;
      }
    });

    return map;
  }, [settlementRows]);

  const getSettlementStatusMeta = (engagementId) => {
    const summary = settlementSummaryMap.get(String(engagementId));
    if (!summary || summary.totalCount === 0) {
      return { label: 'Not Started', className: 'pill-neutral', settled: false };
    }
    if (summary.paidCount === summary.totalCount) {
      return { label: 'Settled', className: 'pill-green', settled: true };
    }
    if (summary.paidCount > 0) {
      return { label: 'Partially Settled', className: 'pill-blue', settled: false };
    }
    return { label: 'Pending', className: 'pill-neutral', settled: false };
  };

  const openSettlementDialog = (row) => {
    const summary = settlementSummaryMap.get(String(row.id));
    const allRows = summary?.rows || [];
    const pendingRow = (summary?.rows || []).find((x) => String(x.status || '').toLowerCase() !== 'paid');
    const perDay = Number(pendingRow?.perDayPayment || row.ratePerDay || 0);
    const totalDays = Number(pendingRow?.totalDays || row.totalDays || 0);
    const netPayableAmount = Number(getNetAmount(row) || 0);
    const consumedAmount = allRows
      .filter((x) => String(x.id) !== String(pendingRow?.id || ''))
      .reduce((sum, x) => sum + Number(x.amount || 0), 0);
    const maxAllowedAmount = Math.max(netPayableAmount - consumedAmount, 0);
    const suggestedAmount = Number(pendingRow?.amount || (perDay * totalDays) || 0);
    const amount = Math.min(maxAllowedAmount, suggestedAmount > 0 ? suggestedAmount : maxAllowedAmount);

    if (maxAllowedAmount <= 0) {
      window.alert('This engagement is already fully allocated against Net Payable. No more trainer settlement can be added.');
      return;
    }

    setSettlementDialog({
      open: true,
      mode: pendingRow ? 'update' : 'create',
      settlementId: pendingRow?.id || '',
      engagementId: row.id,
      engagementLabel: `${row.college || 'Unknown College'} - ${row.topic || 'Training Engagement'}`,
      trainerId: row.trainerId || '',
      trainerName: row.trainerName || '',
      collegeName: row.college || '',
      organizationName: row.organization || '',
      startDate: row.startDate || '',
      endDate: row.endDate || '',
      totalDays,
      perDayPayment: String(perDay),
      amount: String(amount),
      maxAllowedAmount,
      netPayableAmount,
      consumedAmount,
      status: 'Paid',
      notes: pendingRow?.notes || ''
    });
  };

  const closeSettlementDialog = () => {
    setSettlementDialog((prev) => ({ ...prev, open: false }));
  };

  const handleSettlementField = (key, value) => {
    setSettlementDialog((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'perDayPayment' || key === 'totalDays') {
        const computed = Number(next.perDayPayment || 0) * Number(next.totalDays || 0);
        const clamped = Math.min(Number(next.maxAllowedAmount || 0), computed);
        next.amount = String(clamped);
      }
      if (key === 'amount') {
        const numeric = Number(value || 0);
        const clamped = Math.min(Number(prev.maxAllowedAmount || 0), Number.isFinite(numeric) ? numeric : 0);
        next.amount = String(clamped);
      }
      return next;
    });
  };

  const handleSettlementSave = async () => {
    const amount = Number(settlementDialog.amount || 0);
    if (!settlementDialog.engagementId) {
      window.alert('Engagement not selected for settlement.');
      return;
    }
    if (Number.isNaN(amount) || amount <= 0) {
      window.alert('Settlement amount must be greater than 0.');
      return;
    }
    if (amount > Number(settlementDialog.maxAllowedAmount || 0)) {
      window.alert(`Settlement amount cannot exceed ${toInr(settlementDialog.maxAllowedAmount)} for this engagement.`);
      return;
    }

    const payload = {
      trainingEngagementId: settlementDialog.engagementId,
      engagementLabel: settlementDialog.engagementLabel,
      trainerId: settlementDialog.trainerId || null,
      trainerName: settlementDialog.trainerName,
      collegeName: settlementDialog.collegeName,
      organizationName: settlementDialog.organizationName,
      startDate: settlementDialog.startDate || null,
      endDate: settlementDialog.endDate || null,
      totalDays: Number(settlementDialog.totalDays || 0),
      perDayPayment: Number(settlementDialog.perDayPayment || 0),
      amount,
      paidDate: new Date().toISOString(),
      status: settlementDialog.status || 'Paid',
      notes: settlementDialog.notes || '',
      sourcedBy: user?.employeeId || user?.name || '',
      sourcedByName: user?.name || ''
    };

    try {
      if (settlementDialog.mode === 'update' && settlementDialog.settlementId) {
        await trainerSettlementAPI.update(settlementDialog.settlementId, payload);
      } else {
        await trainerSettlementAPI.create(payload);
      }
      await loadSettlements();
      closeSettlementDialog();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to save trainer settlement.');
    }
  };

  const toggleSelectId = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (ids) => {
    setSelectedIds((prev) => {
      if (ids.every((id) => prev.has(id))) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...ids]);
    });
  };

  const handleBulkAssign = () => {
    if (!bulkSourcedBy.trim()) {
      window.alert('Please choose an employee / admin to assign.');
      return;
    }
    if (selectedIds.size === 0) {
      window.alert('Please select at least one record.');
      return;
    }
    const next = engagements.map((x) =>
      selectedIds.has(x.id)
        ? { ...x, sourcedBy: bulkSourcedBy.trim(), sourcedByName: bulkSourcedByName.trim() }
        : x
    );
    persist(next);
    setSelectedIds(new Set());
    setBulkSourcedBy('');
    setBulkSourcedByName('');
  };

  const handleCancel = () => {
    setEditId('');
    const base = { ...EMPTY_FORM };
    if (user?.employeeId) {
      base.sourcedBy = user.employeeId;
      base.sourcedByName = user.name || '';
    } else if (user?.name) {
      base.sourcedBy = user.name;
      base.sourcedByName = user.name;
    }
    base.connectionId = getUserDefaultConnection(user);
    setForm(base);
    const now = new Date();
    setPickerMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // ── Ownership filter: employees only see their own records ──
  const visibleEngagements = useMemo(() => {
    if (user?.role === 'platform_owner') {
      return engagements;
    }

    if (user?.role === 'superadmin') {
      const myEmployeeIds = new Set(
        (employeeOptions || [])
          .filter((x) => x.role === 'employee')
          .map((x) => x.employeeId || x._id)
          .filter(Boolean)
      );

      return engagements.filter((x) => {
        if (x.ownerSuperadminId) {
          return String(x.ownerSuperadminId) === String(user.id);
        }
        // Legacy fallback where ownerSuperadminId does not exist yet.
        return (
          x.sourcedBy === user?.employeeId ||
          x.sourcedByName === user?.name ||
          myEmployeeIds.has(x.sourcedBy)
        );
      });
    }
    // Employee: match by employeeId (preferred) or name
    const myId = user?.employeeId || user?.name || '';
    if (!myId) return [];
    return engagements.filter(
      (x) =>
        x.sourcedByUserId === user?.id ||
        x.sourcedBy === myId ||
        x.sourcedByName === user?.name
    );
  }, [engagements, user, employeeOptions]);

  const stats = useMemo(() => {
    const totalDays = visibleEngagements.reduce((s, x) => s + Number(x.totalDays || 0), 0);
    const totalGross = visibleEngagements.reduce((s, x) => s + getGrossAmount(x), 0);
    const totalTds = visibleEngagements.reduce((s, x) => s + getTdsAmount(x), 0);
    const totalAmount = visibleEngagements.reduce((s, x) => s + getNetAmount(x), 0);
    const paid = visibleEngagements
      .filter((x) => (x.paymentStatus || '').toLowerCase() === 'paid')
      .reduce((s, x) => s + getNetAmount(x), 0);
    return {
      total: visibleEngagements.length,
      totalDays,
      totalGross,
      totalTds,
      totalAmount,
      pending: totalAmount - paid
    };
  }, [visibleEngagements]);

  const filtered = useMemo(() => {
    return visibleEngagements.filter((x) => {
      if (filterCollege && x.college !== filterCollege) return false;
      if (filterOrganization && x.organization !== filterOrganization) return false;
      if (filterTrainer && x.trainerId !== filterTrainer) return false;
      if (filterStatus && x.paymentStatus !== filterStatus) return false;
      return true;
    });
  }, [visibleEngagements, filterCollege, filterOrganization, filterTrainer, filterStatus]);

  const calendarCells = useMemo(() => {
    const start = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), 1);
    const end = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1, 0);
    const leading = start.getDay();
    const selected = new Set(normalizeDateList(form.selectedDates || []));
    const cells = [];

    for (let i = 0; i < leading; i += 1) {
      cells.push({ key: `blank-${i}`, blank: true });
    }

    for (let day = 1; day <= end.getDate(); day += 1) {
      const date = new Date(pickerMonth.getFullYear(), pickerMonth.getMonth(), day);
      const key = toLocalDateKey(date);
      cells.push({
        key,
        blank: false,
        day,
        selected: selected.has(key)
      });
    }

    return cells;
  }, [pickerMonth, form.selectedDates]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Training Engagements</h1>
          <p>Independent module driven by college + organization, with date range, days, and payment status.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`btn ${activeTab === 'log' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => {
            setActiveTab('log');
            setEditId('');
            const base = { ...EMPTY_FORM };
            if (user?.employeeId) {
              base.sourcedBy = user.employeeId;
              base.sourcedByName = user.name || '';
            } else if (user?.name) {
              base.sourcedBy = user.name;
              base.sourcedByName = user.name;
            }
            setForm(base);
            setPickerMonth(new Date());
            refreshLookups();
          }}>{editId ? 'Editing...' : '+ Add Engagement'}</button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="ops-card summary-card teaching-stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Engagements</div></div>
        <div className="ops-card summary-card teaching-stat-card accent-blue"><div className="stat-value">{stats.totalDays}</div><div className="stat-label">Total Days</div></div>
        {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
          <>
            <div className="ops-card summary-card teaching-stat-card accent-green"><div className="stat-value">{toInr(stats.totalGross)}</div><div className="stat-label">Gross Value</div></div>
            <div className="ops-card summary-card teaching-stat-card"><div className="stat-value">{toInr(stats.totalTds)}</div><div className="stat-label">Total TDS</div></div>
            <div className="ops-card summary-card teaching-stat-card accent-purple"><div className="stat-value">{toInr(stats.pending)}</div><div className="stat-label">Pending</div></div>
          </>
        )}
      </div>

      {activeTab === 'log' && (
        <div className="ops-card" style={{ marginTop: '1.5rem', maxWidth: '860px' }}>
          <h3 style={{ marginBottom: '1rem' }}>{editId ? 'Edit Training Engagement' : 'Add Training Engagement'}</h3>
          <form onSubmit={handleSave}>
            <div className="ops-grid-two">
              <div className="form-group">
                <label>Training Topic *</label>
                <select className="form-control" value={form.topic} onChange={(e) => handleField('topic', e.target.value)}>
                  <option value="">-- Select Topic --</option>
                  {topicOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                  <option value="Other">Other / Custom</option>
                </select>
              </div>
              {form.topic === 'Other' && (
                <div className="form-group">
                  <label>Custom Topic *</label>
                  <input className="form-control" value={form.customTopic} onChange={(e) => handleField('customTopic', e.target.value)} />
                </div>
              )}

              <div className="form-group">
                <label>Engagement Type</label>
                <select className="form-control" value={form.engagementType} onChange={(e) => handleField('engagementType', e.target.value)}>
                  {ENGAGEMENT_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>

              <div className="form-group">
                <label>Trainer / Instructor</label>
                <select className="form-control" value={form.trainerId} onChange={(e) => handleTrainerSelect(e.target.value)}>
                  <option value="">-- Select Trainer (optional) --</option>
                  {trainerOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.trainerName} {item.userProfile?.email ? `(${item.userProfile.email})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>College / Institution *</label>
                <select className="form-control" value={form.college} onChange={(e) => handleField('college', e.target.value)}>
                  <option value="">-- Select College --</option>
                  {collegeOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                  <option value="Other College">Other / Custom</option>
                </select>
              </div>
              {form.college === 'Other College' && (
                <div className="form-group">
                  <label>Custom College *</label>
                  <input className="form-control" value={form.customCollege} onChange={(e) => handleField('customCollege', e.target.value)} />
                </div>
              )}

              <div className="form-group">
                <label>Organization (EdTech / Client) *</label>
                <select className="form-control" value={form.organization} onChange={(e) => handleField('organization', e.target.value)}>
                  <option value="">-- Select Organization --</option>
                  {organizationOptions.map((x) => <option key={x} value={x}>{x}</option>)}
                  <option value="Other / External">Other / External</option>
                </select>
              </div>
              {form.organization === 'Other / External' && (
                <div className="form-group">
                  <label>Custom Organization *</label>
                  <input className="form-control" value={form.customOrganization} onChange={(e) => handleField('customOrganization', e.target.value)} />
                </div>
              )}

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Training Dates *</label>
                <div className="ops-card" style={{ padding: '0.9rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" type="button" onClick={() => setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}>Previous</button>
                    <strong>{formatMonthLabel(pickerMonth)}</strong>
                    <button className="btn btn-secondary" type="button" onClick={() => setPickerMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}>Next</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem', marginBottom: '0.35rem' }}>
                    {WEEK_DAYS.map((label) => (
                      <div key={label} style={{ textAlign: 'center', fontSize: '0.74rem', color: 'var(--ops-text-secondary)', fontWeight: 600 }}>
                        {label}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '0.35rem' }}>
                    {calendarCells.map((cell) => (
                      cell.blank ? (
                        <div key={cell.key} style={{ minHeight: '38px' }} />
                      ) : (
                        <button
                          key={cell.key}
                          type="button"
                          className={`btn ${cell.selected ? 'btn-primary' : 'btn-secondary'}`}
                          style={{ minHeight: '38px', padding: '0.35rem', fontSize: '0.82rem' }}
                          onClick={() => toggleCalendarDate(cell.key)}
                        >
                          {cell.day}
                        </button>
                      )
                    ))}
                  </div>
                </div>
                <textarea
                  className="form-control"
                  rows={5}
                  value={form.bulkDateInput}
                  onChange={(e) => handleBulkDateInput(e.target.value)}
                  placeholder={['2026-04-08', '2026-04-10', '2026-04-15'].join('\n')}
                />
                <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                  Enter one date per line or comma separated. Dates can be random/non-contiguous. Total Days: {getTotalDays(form)}
                </span>
                {normalizeDateList(form.selectedDates).length > 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                    Coverage: {formatDate(form.startDate)} {'->'} {formatDate(form.endDate)}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label>Daily Duration (hours)</label>
                <input className="form-control" type="number" min="0" step="0.5" value={form.dailyHours} onChange={(e) => handleField('dailyHours', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Learners</label>
                <input className="form-control" type="number" min="0" value={form.learners} onChange={(e) => handleField('learners', e.target.value)} />
              </div>

              {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
                <div className="form-group">
                  <label>Rate Per Day (INR)</label>
                  <input className="form-control" type="number" min="0" value={form.ratePerDay} onChange={(e) => handleField('ratePerDay', e.target.value)} />
                </div>
              )}
              {(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
                <div className="form-group">
                  <label>TDS Handling</label>
                  <select className="form-control" value={form.tdsApplicable ? 'yes' : 'no'} onChange={(e) => handleField('tdsApplicable', e.target.value === 'yes')}>
                    <option value="yes">Deduct 10% TDS (default)</option>
                    <option value="no">Ignore TDS for this payment</option>
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Payment Status</label>
                <select className="form-control" value={form.paymentStatus} onChange={(e) => handleField('paymentStatus', e.target.value)}>
                  <option value="Planned">Planned</option>
                  <option value="Ongoing">Ongoing</option>
                  <option value="Completed">Completed</option>
                  <option value="Invoiced">Invoiced</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>

              {user?.role === 'employee' && ((user?.connections || []).filter((c) => c.isActive !== false).length > 1) && (
                <div className="form-group">
                  <label>Connection Scope</label>
                  <select
                    className="form-control"
                    value={form.connectionId}
                    onChange={(e) => handleField('connectionId', e.target.value)}
                  >
                    {(user.connections || [])
                      .filter((c) => c.isActive !== false)
                      .map((c) => (
                        <option key={`${c.superadminId}-${c.connectionId}`} value={c.connectionId}>
                          {c.connectionId} - SuperAdmin {String(c.superadminId).slice(-6)}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Sourced By (Employee)</label>
                {employeeOptions.length > 0 ? (
                  <select
                    className="form-control"
                    value={form.sourcedBy}
                    onChange={(e) => {
                      if (e.target.value === '__self') {
                        handleField('sourcedBy', user?.employeeId || user?.name || '');
                        handleField('sourcedByName', user?.name || '');
                      } else {
                        const emp = employeeOptions.find(x => (x.employeeId || x._id) === e.target.value);
                        handleField('sourcedBy', e.target.value);
                        handleField('sourcedByName', emp ? emp.name : '');
                      }
                    }}
                  >
                    <option value="">-- Unassigned --</option>
                    <option value="__self">
                      {user?.employeeId ? `${user.employeeId} — ${user.name} (You)` : `${user?.name || 'Admin'} (You — Admin)`}
                    </option>
                    {employeeOptions.map((emp) => (
                      <option key={emp._id} value={emp.employeeId || emp._id}>
                        {emp.employeeId ? `${emp.employeeId} — ${emp.name}` : emp.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control"
                    placeholder={user?.employeeId ? `${user.employeeId} (you)` : user?.name ? `${user.name} (you)` : 'Employee ID (e.g. VIK001)'}
                    value={form.sourcedBy}
                    onChange={(e) => handleField('sourcedBy', e.target.value)}
                    readOnly={!!(user?.employeeId || user?.name)}
                  />
                )}
                {form.sourcedByName && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                    {form.sourcedByName}
                  </span>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => handleField('notes', e.target.value)} />
            </div>

{(user?.role === 'superadmin' || user?.role === 'platform_owner') && (
            <div style={{ marginBottom: '0.9rem', fontSize: '0.84rem', color: 'var(--ops-text-secondary)' }}>
              {(() => {
                const totalDays = getTotalDays(form);
                const gross = totalDays * Number(form.ratePerDay || 0);
                const tds = form.tdsApplicable ? (gross * DEFAULT_TDS_PERCENT) / 100 : 0;
                const net = gross - tds;
                return `Gross: ${toInr(gross)} | TDS: ${toInr(tds)} | Net Payable: ${toInr(net)}`;
              })()}
            </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" type="submit">{editId ? 'Update Engagement' : 'Save Engagement'}</button>
              {editId && <button className="btn btn-secondary" type="button" onClick={handleCancel}>Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="ops-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Engagement Overview & Records</h3>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)}>
              <option value="">All Colleges</option>
              {[...new Set(visibleEngagements.map((x) => x.college))].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterOrganization} onChange={(e) => setFilterOrganization(e.target.value)}>
              <option value="">All Organizations</option>
              {[...new Set(visibleEngagements.map((x) => x.organization))].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)}>
              <option value="">All Trainers</option>
              {[...new Map(visibleEngagements.filter((x) => x.trainerId).map((x) => [x.trainerId, x.trainerName || x.trainerId])).entries()].map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '160px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span style={{ fontSize: '0.85rem', color: 'var(--ops-text-secondary)' }}>{filtered.length} of {visibleEngagements.length}</span>
          </div>

          {/* ── Bulk action bar ── */}
          {selectedIds.size > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              background: '#ede9fe', border: '1.5px solid #7c3aed', borderRadius: '8px',
              padding: '0.65rem 1rem', marginBottom: '1rem'
            }}>
              <span style={{ fontWeight: 600, color: '#7c3aed', fontSize: '0.88rem' }}>
                {selectedIds.size} record{selectedIds.size > 1 ? 's' : ''} selected
              </span>
              <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>Assign Sourced By:</span>
              {employeeOptions.length > 0 ? (
                <select
                  className="form-control"
                  style={{ width: 'auto', minWidth: '220px' }}
                  value={bulkSourcedBy}
                  onChange={(e) => {
                    if (e.target.value === '__self') {
                      setBulkSourcedBy(user?.employeeId || user?.name || '');
                      setBulkSourcedByName(user?.name || '');
                    } else {
                      const emp = employeeOptions.find((x) => (x.employeeId || x._id) === e.target.value);
                      setBulkSourcedBy(e.target.value);
                      setBulkSourcedByName(emp ? emp.name : '');
                    }
                  }}
                >
                  <option value="">-- Select --</option>
                  <option value="__self">
                    {user?.employeeId ? `${user.employeeId} — ${user.name} (You)` : `${user?.name || 'Admin'} (You)`}
                  </option>
                  {employeeOptions.map((emp) => (
                    <option key={emp._id} value={emp.employeeId || emp._id}>
                      {emp.employeeId ? `${emp.employeeId} — ${emp.name}` : emp.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-control"
                  style={{ width: '180px' }}
                  placeholder="Employee ID or name"
                  value={bulkSourcedBy}
                  onChange={(e) => setBulkSourcedBy(e.target.value)}
                />
              )}
              <button
                className="btn btn-primary"
                style={{ padding: '5px 14px', fontSize: '0.82rem' }}
                onClick={handleBulkAssign}
              >
                Apply to {selectedIds.size} record{selectedIds.size > 1 ? 's' : ''}
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '5px 10px', fontSize: '0.82rem' }}
                onClick={() => { setSelectedIds(new Set()); setBulkSourcedBy(''); setBulkSourcedByName(''); }}
              >
                Clear Selection
              </button>
            </div>
          )}

          {filtered.length === 0 ? (
            <p className="muted">No engagement records found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th style={{ width: '36px', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        title="Select all visible"
                        checked={filtered.length > 0 && filtered.every((x) => selectedIds.has(x.id))}
                        onChange={() => toggleSelectAll(filtered.map((x) => x.id))}
                      />
                    </th>
                    <th className="sno-th">#</th>
                    <th>Topic</th>
                    <th>Trainer</th>
                    <th>College</th>
                    <th>Organization</th>
                    <th>Sourced By</th>
                    <th>Date Range</th>
                    <th>Days</th>
                    <th>Hours/Day</th>
                    {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <th>Rate/Day</th>}
                    {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <th>Gross</th>}
                    {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <th>TDS</th>}
                    {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <th>Net Payable</th>}
                    <th>Status</th>
                    <th>Trainer Settlement</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const paginated = filtered.slice(currentPage * itemsPerPage, (currentPage + 1) * itemsPerPage);
                    return paginated.map((x, i) => (
                    <tr
                      key={x.id}
                      style={selectedIds.has(x.id) ? { background: '#f5f3ff' } : {}}
                    >
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(x.id)}
                          onChange={() => toggleSelectId(x.id)}
                        />
                      </td>
                      <td className="sno-cell">{(currentPage * itemsPerPage) + i + 1}</td>
                      <td><span className="status-pill pill-blue">{x.topic}</span></td>
                      <td>{x.trainerName || '—'}</td>
                      <td><span className="college-cell-badge">{x.college}</span></td>
                      <td>{x.organization}</td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                        {x.sourcedBy ? (
                          <span title={x.sourcedByName || ''} style={{ fontWeight: 600, color: '#7c3aed' }}>{x.sourcedBy}</span>
                        ) : '—'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateSummary(x)}</td>
                      <td>{x.totalDays}</td>
                      <td>{x.dailyHours || '—'}</td>
                      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <td>{toInr(x.ratePerDay)}</td>}
                      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <td>{toInr(getGrossAmount(x))}</td>}
                      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <td>{toInr(getTdsAmount(x))}</td>}
                      {(user?.role === 'superadmin' || user?.role === 'platform_owner') && <td><strong>{toInr(getNetAmount(x))}</strong></td>}
                      <td>
                        <span className="status-pill pill-neutral">{x.paymentStatus || 'Invoiced'}</span>
                        {String(x.paymentStatus || '').toLowerCase() === 'paid' && x.orgPaymentReceivedAt && (
                          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                            Org paid on {formatDate(x.orgPaymentReceivedAt)}
                          </div>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const settlementMeta = getSettlementStatusMeta(x.id);
                          return (
                            <span className={`status-pill ${settlementMeta.className}`}>{settlementMeta.label}</span>
                          );
                        })()}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', position: 'relative', overflow: 'visible' }}>
                        {(() => {
                          const settlementMeta = getSettlementStatusMeta(x.id);
                          const isPaid = String(x.paymentStatus || '').toLowerCase() === 'paid';
                          const canMarkOrgPaid = (user?.role === 'superadmin' || user?.role === 'platform_owner') && !isPaid;
                          const markOrgPaidStyle = settlementMeta.settled
                            ? MARK_ORG_PAID_GOLD_STYLE
                            : MARK_ORG_PAID_LOCKED_STYLE;

                          return (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'nowrap' }}>
                              {/* Settle Trainer – hidden once settled */}
                              {!settlementMeta.settled && (
                                <button
                                  style={{ ...SETTLE_TRAINER_RESPONSIBILITY_STYLE, padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => openSettlementDialog(x)}
                                  title="Settle Trainer"
                                >
                                  {/* handshake / payout icon */}
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M20.5 9.5 12 18l-4-4" /><path d="m3.5 14.5 4 4" /><path d="M9 6.5 14.5 12" /><path d="M3 9c0-1.1.9-2 2-2h1l3.5-3.5a2 2 0 0 1 2.8 0L14 5" /><path d="M21 15c0 1.1-.9 2-2 2h-1l-3.5 3.5a2 2 0 0 1-2.8 0L10 19" />
                                  </svg>
                                </button>
                              )}

                              {/* Mark Org Paid – hidden once paid */}
                              {canMarkOrgPaid && (
                                <button
                                  style={{
                                    ...markOrgPaidStyle,
                                    padding: '5px 7px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    transform: markOrgPaidPressedRowId === x.id ? 'scale(0.92)' : 'scale(1)',
                                    transition: 'transform 180ms cubic-bezier(0.4, 0, 0.2, 1)'
                                  }}
                                  onClick={() => handleMarkOrgPaid(x)}
                                  title={settlementMeta.settled ? 'Mark Org Paid' : 'Trainer not yet settled — mark with caution'}
                                >
                                  {/* coins / org-payment icon */}
                                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1 1 10.34 18" /><path d="M7 6h1v4" /><line x1="16.71" y1="13.88" x2="13.5" y2="17.13" />
                                  </svg>
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                className="btn btn-secondary"
                                style={{ padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleEdit(x)}
                                title="Edit"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                </svg>
                              </button>

                              {/* Delete */}
                              <button
                                className="btn btn-danger"
                                style={{ padding: '5px 7px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleDelete(x.id)}
                                title="Delete"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                </svg>
                              </button>

                              {profitAnimationState.active && profitAnimationState.rowId === x.id && (
                                <ProfitJarAnimation
                                  key={`${profitAnimationState.rowId}-${profitAnimationState.pulse}`}
                                  amount={profitAnimationState.amount}
                                  onDone={() => handleProfitAnimationDone(x.id)}
                                />
                              )}
                            </div>
                          );
                        })()}
                      </td>
                    </tr>
                  ));
                  })()}
                </tbody>
              </table>
              <WheelPagination 
                totalPages={Math.ceil(filtered.length / itemsPerPage)}
                currentPage={currentPage}
                onChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      )}

      {settlementDialog.open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.45)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="ops-card" style={{ width: '100%', maxWidth: '760px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginTop: 0 }}>{settlementDialog.mode === 'update' ? 'Complete Trainer Settlement' : 'Create Trainer Settlement'}</h3>
            <p className="muted" style={{ marginTop: 0 }}>{settlementDialog.engagementLabel}</p>

            <div className="ops-grid-two">
              <div className="form-group">
                <label>Trainer</label>
                <input className="form-control" value={settlementDialog.trainerName} readOnly />
              </div>
              <div className="form-group">
                <label>Organization</label>
                <input className="form-control" value={settlementDialog.organizationName} readOnly />
              </div>
              <div className="form-group">
                <label>Total Days</label>
                <input className="form-control" type="number" value={settlementDialog.totalDays} onChange={(e) => handleSettlementField('totalDays', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Per Day Payment</label>
                <input className="form-control" type="number" min="0" step="0.01" value={settlementDialog.perDayPayment} onChange={(e) => handleSettlementField('perDayPayment', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Total Amount</label>
                <input className="form-control" type="number" min="0" max={settlementDialog.maxAllowedAmount} step="0.01" value={settlementDialog.amount} onChange={(e) => handleSettlementField('amount', e.target.value)} />
                <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                  Max allowed: {toInr(settlementDialog.maxAllowedAmount)} (Net Payable {toInr(settlementDialog.netPayableAmount)} - Already Logged {toInr(settlementDialog.consumedAmount)})
                </span>
              </div>
              <div className="form-group">
                <label>Status</label>
                <select className="form-control" value={settlementDialog.status} onChange={(e) => handleSettlementField('status', e.target.value)}>
                  <option value="Planned">Planned</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Paid">Paid</option>
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label>Notes</label>
                <textarea className="form-control" rows={3} value={settlementDialog.notes} onChange={(e) => handleSettlementField('notes', e.target.value)} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSettlementSave}>Save Settlement</button>
              <button className="btn btn-secondary" onClick={closeSettlementDialog}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {confirmDialog.open && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(2, 6, 23, 0.5)',
          zIndex: 10020,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem'
        }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={confirmDialog.title || 'Confirmation Dialog'}
            style={{
              width: '100%',
              maxWidth: '520px',
              background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)',
              border: '1px solid #dbe3f0',
              borderRadius: '18px',
              boxShadow: '0 22px 50px rgba(15, 23, 42, 0.28)',
              padding: '1.2rem 1.2rem 1rem'
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: '0.55rem', color: '#0f172a' }}>{confirmDialog.title || 'Please confirm'}</h3>
            <div style={{ color: '#334155', fontSize: '0.95rem', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
              {confirmDialog.message}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '1.1rem' }}>
              <button
                className="btn btn-secondary"
                style={{ minWidth: '90px' }}
                onClick={() => resolveConfirmation(false)}
              >
                {confirmDialog.cancelLabel || 'Cancel'}
              </button>
              <button
                className="btn"
                style={{
                  minWidth: '120px',
                  color: confirmDialog.tone === 'success' ? '#3d2c00' : '#ffffff',
                  fontWeight: 700,
                  borderRadius: '10px',
                  boxShadow: '0 4px 12px rgba(15, 23, 42, 0.18)',
                  ...(CONFIRM_TONE_STYLES[confirmDialog.tone] || CONFIRM_TONE_STYLES.default)
                }}
                onClick={() => resolveConfirmation(true)}
              >
                {confirmDialog.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default TrainingEngagementsHub;

