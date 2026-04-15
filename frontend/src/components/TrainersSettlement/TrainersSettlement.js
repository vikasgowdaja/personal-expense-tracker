import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { trainerSettlementAPI, trainingEngagementAPI } from '../../services/api';

const SETTLEMENT_STATUS = ['Planned', 'Partially Paid', 'Paid'];
const PLACEHOLDER_TRAINER_PATTERN = /independent engagement/i;
const DEFAULT_TDS_PERCENT = 10;

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

function normalizeApiEngagement(row) {
  const firstTrainer = Array.isArray(row.trainers) && row.trainers.length > 0 ? row.trainers[0] : null;
  const trainerDoc = firstTrainer?.trainerId;

  return {
    id: row._id,
    trainerId: trainerDoc?._id || firstTrainer?.trainerId || '',
    trainerName: trainerDoc?.fullName || 'Independent Engagement',
    college: row.institutionId?.name || 'Unknown College',
    organization: row.clientId?.name || 'Unknown Organization',
    startDate: row.startDate || '',
    endDate: row.endDate || '',
    totalDays: Number(row.totalDays || calcDaySpan(row.startDate, row.endDate) || 0),
    paymentStatus: row.status || 'Invoiced',
    topic: firstTrainer?.trainingTopic || row.engagementTitle || row.notes || 'Training Engagement',
    notes: row.notes || '',
    ratePerDay: Number(firstTrainer?.dailyRate || 0),
    grossAmount: Number(row.grossAmount !== undefined ? row.grossAmount : row.totalAmount || 0),
    tdsApplicable: row.tdsApplicable !== false,
    tdsAmount: Number(row.tdsAmount || 0),
    totalAmount: Number(row.totalAmount || 0)
  };
}

function normalizeSettlementRow(row) {
  const trainingId = typeof row.trainingEngagementId === 'object'
    ? row.trainingEngagementId?._id
    : row.trainingEngagementId;

  return {
    id: row._id,
    trainingRecordId: trainingId ? String(trainingId) : '',
    engagementLabel: row.engagementLabel || '',
    trainerId: row.trainerId ? String(row.trainerId) : '',
    trainerName: row.trainerName || '',
    collegeName: row.collegeName || '',
    organizationName: row.organizationName || '',
    startDate: row.startDate ? new Date(row.startDate).toISOString().slice(0, 10) : '',
    endDate: row.endDate ? new Date(row.endDate).toISOString().slice(0, 10) : '',
    totalDays: Number(row.totalDays || 0),
    perDayPayment: Number(row.perDayPayment || 0),
    amount: Number(row.amount || 0),
    paidDate: row.paidDate ? new Date(row.paidDate).toISOString().slice(0, 10) : '',
    status: row.status || 'Planned',
    notes: row.notes || ''
  };
}

function parseNet(row) {
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

  return Number(row.totalAmount !== undefined ? row.totalAmount : gross - tds);
}

export default function TrainersSettlement({ user }) {
  const [loading, setLoading] = useState(true);
  const [trainingRows, setTrainingRows] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [agingTrainerFilter, setAgingTrainerFilter] = useState('');
  const [agingCollegeFilter, setAgingCollegeFilter] = useState('');
  const [agingOrganizationFilter, setAgingOrganizationFilter] = useState('');
  const [agingOrgStatusFilter, setAgingOrgStatusFilter] = useState('');
  const [agingTrainerStatusFilter, setAgingTrainerStatusFilter] = useState('');
  const [agingFromDate, setAgingFromDate] = useState('');
  const [agingToDate, setAgingToDate] = useState('');
  const [agingSortBy, setAgingSortBy] = useState('age');
  const [agingSortDir, setAgingSortDir] = useState('desc');
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
    amount: '',
    paidDate: new Date().toISOString().slice(0, 10),
    status: 'Planned',
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [engagementsRes, settlementsRes] = await Promise.all([
        trainingEngagementAPI.getAll(),
        trainerSettlementAPI.getAll()
      ]);

      const engagementRows = Array.isArray(engagementsRes.data) ? engagementsRes.data : [];
      const settlementRows = Array.isArray(settlementsRes.data) ? settlementsRes.data : [];

      setTrainingRows(engagementRows.map(normalizeApiEngagement));
      setSettlements(settlementRows.map(normalizeSettlementRow));
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Failed to load settlement data from database.');
      setTrainingRows([]);
      setSettlements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const trainerNames = useMemo(() => {
    const byName = new Map();

    trainingRows.forEach((row) => {
      const name = (row.trainerName || '').trim();
      if (!name || PLACEHOLDER_TRAINER_PATTERN.test(name)) return;
      if (!byName.has(name.toLowerCase())) {
        byName.set(name.toLowerCase(), { id: row.trainerId || row.id, name });
      }
    });

    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [trainingRows]);

  const engagementOptions = useMemo(() => {
    return trainingRows.map((row) => {
      const netAmount = parseNet(row);
      const existingSettlements = settlements.filter((item) => item.trainingRecordId === row.id);
      const settlementCount = existingSettlements.length;
      const totalSettlementLogged = existingSettlements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const paidSettlement = settlements
        .filter((item) => item.trainingRecordId === row.id && item.status === 'Paid')
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);

      return {
        id: row.id,
        trainerId: row.trainerId || '',
        trainerName: row.trainerName || '',
        college: row.college || 'Unknown College',
        organization: row.organization || '—',
        startDate: row.startDate || '',
        endDate: row.endDate || '',
        totalDays: Number(row.totalDays || calcDaySpan(row.startDate, row.endDate) || 0),
        paymentStatus: row.paymentStatus || 'Invoiced',
        topic: row.topic || row.notes || 'Training Engagement',
        label: `${row.college || 'Unknown College'} - ${row.topic || 'Training Engagement'}`,
        netAmount,
        settlementCount,
        totalSettlementLogged,
        paidSettlement,
        hasSettlement: settlementCount > 0,
        isDone: settlementCount > 0
      };
    });
  }, [trainingRows, settlements]);

  const filteredOptions = useMemo(() => {
    const selectedName = (settlementForm.trainerName || '').trim().toLowerCase();
    return engagementOptions.filter((item) => {
      if (!settlementForm.trainerId && !selectedName) return true;
      if (settlementForm.trainerId && item.trainerId && item.trainerId === settlementForm.trainerId) return true;
      if (selectedName && item.trainerName && item.trainerName.trim().toLowerCase() === selectedName) return true;
      return false;
    });
  }, [engagementOptions, settlementForm.trainerId, settlementForm.trainerName]);

  const openOptions = filteredOptions.filter((item) => !item.hasSettlement);
  const doneOptions = filteredOptions.filter((item) => item.hasSettlement);

  const handleTrainerChange = (trainerId) => {
    const selected = trainerNames.find((item) => item.id === trainerId);
    setSettlementForm((prev) => ({
      ...prev,
      trainerId,
      trainerName: selected?.name || '',
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

  const handleEngagementChange = (trainingRecordId) => {
    const selected = engagementOptions.find((item) => item.id === trainingRecordId);
    if (!selected || selected.hasSettlement) {
      window.alert('A settlement already exists for this engagement. Delete the old settlement record first if you want a fresh settlement.');
      return;
    }

    setSettlementForm((prev) => ({
      ...prev,
      trainingRecordId,
      engagementLabel: selected.label,
      trainerId: selected.trainerId || prev.trainerId,
      trainerName: selected.trainerName || prev.trainerName,
      collegeName: selected.college,
      organizationName: selected.organization,
      startDate: selected.startDate,
      endDate: selected.endDate,
      totalDays: selected.totalDays,
      perDayPayment: '',
      amount: ''
    }));
  };

  const handlePerDayChange = (value) => {
    const perDay = Number(value || 0);
    setSettlementForm((prev) => {
      const total = perDay > 0 ? perDay * Number(prev.totalDays || 0) : 0;
      return { ...prev, perDayPayment: value, amount: total > 0 ? total.toFixed(2) : '' };
    });
  };

  const handleSave = async () => {
    const amount = Number(settlementForm.amount || 0);
    if (!settlementForm.trainingRecordId) return window.alert('Select engagement.');
    if (!settlementForm.trainerId) return window.alert('Select trainer.');
    if (Number.isNaN(amount) || amount <= 0) return window.alert('Enter valid per day payment.');

    const selected = engagementOptions.find((item) => item.id === settlementForm.trainingRecordId);
    if (selected?.hasSettlement) {
      return window.alert('A settlement already exists for this engagement. Delete the old settlement record first if you want a fresh settlement.');
    }

    const payload = {
      trainingEngagementId: settlementForm.trainingRecordId,
      engagementLabel: settlementForm.engagementLabel,
      trainerId: settlementForm.trainerId,
      trainerName: settlementForm.trainerName,
      collegeName: settlementForm.collegeName,
      organizationName: settlementForm.organizationName,
      startDate: settlementForm.startDate,
      endDate: settlementForm.endDate,
      totalDays: Number(settlementForm.totalDays || 0),
      perDayPayment: Number(settlementForm.perDayPayment || 0),
      amount,
      paidDate: settlementForm.paidDate,
      status: settlementForm.status,
      notes: settlementForm.notes,
      sourcedBy: user?.employeeId || '',
      sourcedByName: user?.name || ''
    };

    try {
      await trainerSettlementAPI.create(payload);
      await loadData();
    } catch (err) {
      return window.alert(err?.response?.data?.message || 'Unable to save settlement to database.');
    }

    setSettlementForm({
      id: '', trainingRecordId: '', engagementLabel: '', trainerId: '', trainerName: '',
      collegeName: '', organizationName: '', startDate: '', endDate: '', totalDays: 0,
      perDayPayment: '', amount: '', paidDate: new Date().toISOString().slice(0, 10), status: 'Planned', notes: ''
    });
  };

  const handleMarkPaid = async (id) => {
    try {
      await trainerSettlementAPI.update(id, {
        status: 'Paid',
        paidDate: new Date().toISOString().slice(0, 10)
      });
      await loadData();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to mark settlement as paid.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this settlement?')) return;
    try {
      await trainerSettlementAPI.delete(id);
      await loadData();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to delete settlement.');
    }
  };

  const statusSummary = useMemo(() => {
    const cleared = settlements.filter((item) => item.status === 'Paid');
    const pending = settlements.filter((item) => item.status !== 'Paid');
    return {
      clearedCount: cleared.length,
      pendingCount: pending.length,
      clearedAmount: cleared.reduce((s, i) => s + Number(i.amount || 0), 0),
      pendingAmount: pending.reduce((s, i) => s + Number(i.amount || 0), 0)
    };
  }, [settlements]);

  const selectedMetrics = useMemo(() => {
    if (!settlementForm.trainingRecordId) return null;
    const engagement = engagementOptions.find((item) => item.id === settlementForm.trainingRecordId);
    if (!engagement) return null;

    const totalPaid = settlements
      .filter((item) => item.trainingRecordId === settlementForm.trainingRecordId && item.status === 'Paid')
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const totalLogged = settlements
      .filter((item) => item.trainingRecordId === settlementForm.trainingRecordId)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const currentEntry = Number(settlementForm.amount || 0);

    return {
      netAmount: engagement.netAmount,
      totalPaid,
      totalLogged,
      marginLeft: engagement.netAmount - (totalLogged + currentEntry)
    };
  }, [settlementForm.trainingRecordId, settlementForm.amount, settlements, engagementOptions]);

  const agingRows = useMemo(() => {
    const orgStatusOrder = { Paid: 1, 'Not Matured': 2, 'Recovery Due': 3, 'Recovery Overdue': 4 };
    const trainerStatusOrder = { Paid: 1, 'Partially Paid': 2, Pending: 3, 'Not Started': 4 };

    return engagementOptions
      .map((eng) => {
        const refDate = eng.endDate || eng.startDate || '';
        const ageDays = daysSince(refDate);
        const engagementSettlements = settlements.filter((item) => item.trainingRecordId === eng.id);
        const totalPaid = engagementSettlements
          .filter((item) => item.status === 'Paid')
          .reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const totalLogged = engagementSettlements.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const hasSettlementRecord = engagementSettlements.length > 0;
        const hasPendingSettlement = engagementSettlements.some((item) => item.status !== 'Paid');

        const companyReceived = String(eng.paymentStatus || '').toLowerCase() === 'paid';
        const companyPocketPaid = companyReceived ? 0 : totalPaid;
        const yetToRecover = companyReceived ? 0 : -(eng.netAmount - totalLogged);

        let orgPaymentStatus = 'Paid';
        if (!companyReceived && ageDays >= 45) orgPaymentStatus = 'Recovery Overdue';
        else if (!companyReceived && ageDays >= 30) orgPaymentStatus = 'Recovery Due';
        else if (!companyReceived) orgPaymentStatus = 'Not Matured';

        let trainerSettlementStatus = 'Paid';
        if (!hasSettlementRecord) trainerSettlementStatus = 'Not Started';
        else if (hasPendingSettlement && totalPaid > 0) trainerSettlementStatus = 'Partially Paid';
        else if (hasPendingSettlement) trainerSettlementStatus = 'Pending';

        return {
          ...eng,
          refDate,
          ageDays,
          totalPaid,
          totalLogged,
          companyPocketPaid,
          yetToRecover,
          marginLeft: eng.netAmount - totalLogged,
          indicator: ageDays >= 45 ? 'Crossed 45 days' : ageDays >= 30 ? 'Crossed 30 days' : 'Within 30 days',
          orgPaymentStatus,
          trainerSettlementStatus,
          pending: orgPaymentStatus !== 'Paid' || trainerSettlementStatus !== 'Paid'
        };
      })
      .filter((row) => {
        if (agingTrainerFilter) {
          const byId = row.trainerId === agingTrainerFilter;
          const selectedName = trainerNames.find((t) => t.id === agingTrainerFilter)?.name;
          const byName = selectedName && row.trainerName === selectedName;
          if (!byId && !byName) return false;
        }
        if (agingCollegeFilter && row.college !== agingCollegeFilter) return false;
        if (agingOrganizationFilter && row.organization !== agingOrganizationFilter) return false;
        if (agingOrgStatusFilter && row.orgPaymentStatus !== agingOrgStatusFilter) return false;
        if (agingTrainerStatusFilter && row.trainerSettlementStatus !== agingTrainerStatusFilter) return false;
        if (agingFromDate && (!row.refDate || new Date(row.refDate) < new Date(agingFromDate))) return false;
        if (agingToDate && (!row.refDate || new Date(row.refDate) > new Date(agingToDate))) return false;
        return true;
      })
      .sort((a, b) => {
        let comp = 0;
        if (agingSortBy === 'college') comp = (a.college || '').localeCompare(b.college || '');
        else if (agingSortBy === 'end_date') comp = new Date(a.refDate || 0) - new Date(b.refDate || 0);
        else if (agingSortBy === 'age') comp = Number(a.ageDays || 0) - Number(b.ageDays || 0);
        else if (agingSortBy === 'org_status') comp = (orgStatusOrder[a.orgPaymentStatus] || 99) - (orgStatusOrder[b.orgPaymentStatus] || 99);
        else if (agingSortBy === 'trainer_status') comp = (trainerStatusOrder[a.trainerSettlementStatus] || 99) - (trainerStatusOrder[b.trainerSettlementStatus] || 99);
        else comp = Number(a.ageDays || 0) - Number(b.ageDays || 0);

        return agingSortDir === 'asc' ? comp : -comp;
      });
  }, [engagementOptions, settlements, agingTrainerFilter, agingCollegeFilter, agingOrganizationFilter, agingOrgStatusFilter, agingTrainerStatusFilter, agingFromDate, agingToDate, agingSortBy, agingSortDir, trainerNames]);

  const agingCollegeOptions = useMemo(
    () => [...new Set(engagementOptions.map((row) => row.college || 'Unknown College'))].sort((a, b) => a.localeCompare(b)),
    [engagementOptions]
  );

  const agingOrganizationOptions = useMemo(
    () => [...new Set(engagementOptions.map((row) => row.organization || '—'))].sort((a, b) => a.localeCompare(b)),
    [engagementOptions]
  );

  const agingOrgStatusOptions = ['Paid', 'Not Matured', 'Recovery Due', 'Recovery Overdue'];
  const agingTrainerStatusOptions = ['Paid', 'Not Started', 'Partially Paid', 'Pending'];

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Trainer Settlement</h1>
        <p>Track cleared and pending settlements with reasons, payment dependency, and 30/45 day cycle indicators.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
        <div className="ops-card" style={{ padding: '1rem' }}><p className="muted">Cleared Settlements</p><strong>{statusSummary.clearedCount}</strong><div>{fmt(statusSummary.clearedAmount)}</div></div>
        <div className="ops-card" style={{ padding: '1rem' }}><p className="muted">Pending Settlements</p><strong>{statusSummary.pendingCount}</strong><div>{fmt(statusSummary.pendingAmount)}</div></div>
      </div>

      <article className="ops-card" style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ marginTop: 0 }}>Add Settlement</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginBottom: '0.8rem' }}>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Trainer</span>
            <select className="form-control" value={settlementForm.trainerId} onChange={(e) => handleTrainerChange(e.target.value)}>
              <option value="">Select Trainer</option>
              {trainerNames.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.74rem' }}>Training Engagement</span>
            <select className="form-control" value={settlementForm.trainingRecordId} disabled={!settlementForm.trainerId} onChange={(e) => handleEngagementChange(e.target.value)}>
              <option value="">Select Engagement</option>
              {openOptions.length > 0 && (
                <optgroup label="Open Engagements">
                  {openOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </optgroup>
              )}
              {doneOptions.length > 0 && (
                <optgroup label="Settlement Already Exists (Read Only)">
                  {doneOptions.map((item) => (
                    <option key={item.id} value={item.id} disabled>
                      {item.label} ({item.settlementCount} settlement record{item.settlementCount !== 1 ? 's' : ''})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>College</span><input className="form-control" value={settlementForm.collegeName} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Organization</span><input className="form-control" value={settlementForm.organizationName} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Start Date</span><input className="form-control" type="date" value={settlementForm.startDate} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>End Date</span><input className="form-control" type="date" value={settlementForm.endDate} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>No. of Days</span><input className="form-control" type="number" value={settlementForm.totalDays} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Per Day Payment</span><input className="form-control" type="number" min="0" step="0.01" value={settlementForm.perDayPayment} onChange={(e) => handlePerDayChange(e.target.value)} /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Total Settlement</span><input className="form-control" type="number" value={settlementForm.amount} readOnly /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Settlement Date</span><input className="form-control" type="date" value={settlementForm.paidDate} onChange={(e) => setSettlementForm((p) => ({ ...p, paidDate: e.target.value }))} /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Status</span><select className="form-control" value={settlementForm.status} onChange={(e) => setSettlementForm((p) => ({ ...p, status: e.target.value }))}>{SETTLEMENT_STATUS.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label style={{ gridColumn: '1 / -1' }}><span className="muted" style={{ fontSize: '0.74rem' }}>Notes</span><input className="form-control" value={settlementForm.notes} onChange={(e) => setSettlementForm((p) => ({ ...p, notes: e.target.value }))} /></label>
        </div>
        {selectedMetrics && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
            <div className="ops-card" style={{ padding: '0.7rem' }}><p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Project Net</p><strong>{fmt(selectedMetrics.netAmount)}</strong></div>
            <div className="ops-card" style={{ padding: '0.7rem' }}><p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Total Paid</p><strong>{fmt(selectedMetrics.totalPaid)}</strong></div>
            <div className="ops-card" style={{ padding: '0.7rem' }}><p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Total Logged</p><strong>{fmt(selectedMetrics.totalLogged)}</strong></div>
            <div className="ops-card" style={{ padding: '0.7rem' }}><p className="muted" style={{ margin: 0, fontSize: '0.72rem' }}>Margin Left</p><strong style={{ color: selectedMetrics.marginLeft >= 0 ? '#22c55e' : '#ef4444' }}>{fmt(selectedMetrics.marginLeft)}</strong></div>
          </div>
        )}
        <button className="btn btn-primary" onClick={handleSave}>Save Settlement</button>
      </article>

      <article className="ops-card" style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ marginTop: 0 }}>Pending vs Cleared with Reasons</h3>
        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th className="sno-th">#</th><th>Trainer</th><th>College</th><th>Engagement</th><th>Status</th><th>Amount</th><th>Reason</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {settlements.length === 0 && <tr><td colSpan="8" className="muted" style={{ textAlign: 'center' }}>No settlements yet.</td></tr>}
              {settlements.map((item, i) => {
                const eng = engagementOptions.find((e) => e.id === item.trainingRecordId);
                const companyReceived = String(eng?.paymentStatus || '').toLowerCase() === 'paid';
                const reason = item.status === 'Paid'
                  ? 'Cleared'
                  : companyReceived
                    ? 'Company paid, trainer settlement pending'
                    : 'Pending because company payment is pending';
                return (
                  <tr key={item.id}>
                    <td className="sno-cell">{i + 1}</td>
                    <td>{item.trainerName}</td>
                    <td><span className="college-cell-badge">{item.collegeName || eng?.college || '—'}</span></td>
                    <td>{item.engagementLabel}</td>
                    <td>{item.status}</td>
                    <td>{fmt(item.amount)}</td>
                    <td>{reason}</td>
                    <td>
                      {item.status !== 'Paid' && <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.72rem', marginRight: '6px' }} onClick={() => handleMarkPaid(item.id)}>Mark Paid</button>}
                      <button className="btn btn-danger" style={{ padding: '4px 8px', fontSize: '0.72rem' }} onClick={() => handleDelete(item.id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      <article className="ops-card">
        <h3 style={{ marginTop: 0 }}>30 / 45 Day Cycle Tracking</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.65rem', marginBottom: '0.8rem' }}>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Trainer</span><select className="form-control" value={agingTrainerFilter} onChange={(e) => setAgingTrainerFilter(e.target.value)}><option value="">All Trainers</option>{trainerNames.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>College</span><select className="form-control" value={agingCollegeFilter} onChange={(e) => setAgingCollegeFilter(e.target.value)}><option value="">All Colleges</option>{agingCollegeOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Organization (Edtect)</span><select className="form-control" value={agingOrganizationFilter} onChange={(e) => setAgingOrganizationFilter(e.target.value)}><option value="">All Organizations</option>{agingOrganizationOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Org Payment Status</span><select className="form-control" value={agingOrgStatusFilter} onChange={(e) => setAgingOrgStatusFilter(e.target.value)}><option value="">All Org Status</option>{agingOrgStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Trainer Settlement Status</span><select className="form-control" value={agingTrainerStatusFilter} onChange={(e) => setAgingTrainerStatusFilter(e.target.value)}><option value="">All Trainer Status</option>{agingTrainerStatusOptions.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>From Date</span><input className="form-control" type="date" value={agingFromDate} onChange={(e) => setAgingFromDate(e.target.value)} /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>To Date</span><input className="form-control" type="date" value={agingToDate} onChange={(e) => setAgingToDate(e.target.value)} /></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Sort By</span><select className="form-control" value={agingSortBy} onChange={(e) => setAgingSortBy(e.target.value)}><option value="age">Days Crossed</option><option value="college">College</option><option value="end_date">End Date</option><option value="org_status">Org Payment Status</option><option value="trainer_status">Trainer Settlement Status</option></select></label>
          <label><span className="muted" style={{ fontSize: '0.74rem' }}>Sort Direction</span><select className="form-control" value={agingSortDir} onChange={(e) => setAgingSortDir(e.target.value)}><option value="asc">Ascending</option><option value="desc">Descending</option></select></label>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="ops-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th className="sno-th">#</th><th>Trainer</th><th>College</th><th>Engagement</th><th>End Date</th><th>Age (Days)</th><th>Indicator</th><th>Org Payment Status</th><th>Trainer Settlement Status</th><th>Paid from Company Pocket</th><th>Yet to Recover</th><th>Margin Left</th>
              </tr>
            </thead>
            <tbody>
              {agingRows.length === 0 && <tr><td colSpan="12" className="muted" style={{ textAlign: 'center' }}>No engagements match filters.</td></tr>}
              {agingRows.map((row, i) => (
                <tr key={`aging-${row.id}`}>
                  <td className="sno-cell">{i + 1}</td>
                  <td>{row.trainerName || '—'}</td>
                  <td><span className="college-cell-badge">{row.college || '—'}</span></td>
                  <td>{row.label}</td>
                  <td>{fmtDate(row.endDate || row.startDate)}</td>
                  <td>{row.ageDays}</td>
                  <td>{row.indicator}</td>
                  <td>
                    <span className={`status-pill ${row.orgPaymentStatus === 'Paid' ? 'received' : 'pending'}`}>
                      {row.orgPaymentStatus}
                    </span>
                  </td>
                  <td>
                    <span className={`status-pill ${row.trainerSettlementStatus === 'Paid' ? 'received' : 'pending'}`}>
                      {row.trainerSettlementStatus}
                    </span>
                  </td>
                  <td style={{ color: row.companyPocketPaid > 0 ? '#dc2626' : '#6b7280', fontWeight: row.companyPocketPaid > 0 ? 700 : 400 }}>
                    {row.companyPocketPaid > 0 ? `- ${fmt(row.companyPocketPaid)}` : '—'}
                  </td>
                  <td style={{ color: row.yetToRecover < 0 ? '#dc2626' : '#16a34a', fontWeight: row.yetToRecover !== 0 ? 700 : 400 }}>
                    {row.yetToRecover !== 0 ? fmt(row.yetToRecover) : '—'}
                  </td>
                  <td style={{ color: row.marginLeft >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>{fmt(row.marginLeft)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

