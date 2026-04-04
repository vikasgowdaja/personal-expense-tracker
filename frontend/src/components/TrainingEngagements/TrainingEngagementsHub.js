import React, { useEffect, useMemo, useState } from 'react';
import { clientAPI, institutionAPI, topicAPI } from '../../services/api';

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
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  dailyHours: '',
  learners: '',
  ratePerDay: '',
  notes: '',
  tdsApplicable: true,
  paymentStatus: 'Invoiced'
};

function spanDays(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

function TrainingEngagementsHub() {
  const [engagements, setEngagements] = useState(() =>
    JSON.parse(localStorage.getItem('training_engagements') || '[]')
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const [topicOptions, setTopicOptions] = useState([]);
  const [collegeOptions, setCollegeOptions] = useState([]);
  const [organizationOptions, setOrganizationOptions] = useState([]);
  const [trainerOptions, setTrainerOptions] = useState([]);

  const [filterCollege, setFilterCollege] = useState('');
  const [filterOrganization, setFilterOrganization] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const persist = (next) => {
    localStorage.setItem('training_engagements', JSON.stringify(next));
    setEngagements(next);
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

      const institutions = (institutionsRes.data || [])
        .map((item) => (item.name || '').trim())
        .filter(Boolean);
      const clients = (clientsRes.data || [])
        .map((item) => (item.name || '').trim())
        .filter(Boolean);

      const savedRows = JSON.parse(localStorage.getItem('training_engagements') || '[]');
      const savedTopics = savedRows.map((item) => (item.topic || '').trim()).filter(Boolean);
      const savedColleges = savedRows.map((item) => (item.college || '').trim()).filter(Boolean);
      const savedOrganizations = savedRows.map((item) => (item.organization || '').trim()).filter(Boolean);

      setTopicOptions([...new Set([...topics, ...savedTopics])]);
      setCollegeOptions([...new Set([...institutions, ...savedColleges])]);
      setOrganizationOptions([...new Set([...clients, ...savedOrganizations])]);
    } catch {
      const savedRows = JSON.parse(localStorage.getItem('training_engagements') || '[]');
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
    refreshLookups();
    const savedTrainerProfiles = JSON.parse(localStorage.getItem('trainer_profiles') || '[]');
    setTrainerOptions(savedTrainerProfiles);
  }, []);

  const handleField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'startDate' && next.endDate && value > next.endDate) {
        next.endDate = value;
      }
      if (key === 'trainerId') {
        const found = trainerOptions.find((item) => item.id === value);
        next.trainerName = found ? found.trainerName : '';
      }
      return next;
    });
  };

  const resolvedTopic = form.topic === 'Other' ? form.customTopic.trim() : form.topic;
  const resolvedCollege = form.college === 'Other College' ? form.customCollege.trim() : form.college;
  const resolvedOrg = form.organization === 'Other / External' ? form.customOrganization.trim() : form.organization;

  const handleSave = (e) => {
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
    if (!form.startDate || !form.endDate) {
      window.alert('Please select start and end dates.');
      return;
    }

    const totalDays = spanDays(form.startDate, form.endDate);
    const rate = Number(form.ratePerDay || 0);
    const grossAmount = totalDays * rate;
    const tdsApplicable = form.tdsApplicable !== false;
    const tdsAmount = tdsApplicable ? (grossAmount * DEFAULT_TDS_PERCENT) / 100 : 0;
    const netAmount = grossAmount - tdsAmount;

    const record = {
      id: editId || Date.now().toString(),
      topic: resolvedTopic,
      engagementType: form.engagementType,
      trainerId: form.trainerId || '',
      trainerName: form.trainerName || '',
      college: resolvedCollege,
      organization: resolvedOrg,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays,
      dailyHours: Number(form.dailyHours || 0),
      learners: Number(form.learners || 0),
      ratePerDay: rate,
      grossAmount,
      tdsApplicable,
      tdsPercent: DEFAULT_TDS_PERCENT,
      tdsAmount,
      totalAmount: netAmount,
      notes: form.notes,
      paymentStatus: form.paymentStatus,
      createdAt: editId
        ? engagements.find((x) => x.id === editId)?.createdAt || new Date().toISOString()
        : new Date().toISOString()
    };

    const next = editId
      ? engagements.map((x) => (x.id === editId ? record : x))
      : [record, ...engagements];

    persist(next);
    if (resolvedTopic && !topicOptions.includes(resolvedTopic)) {
      setTopicOptions((prev) => [resolvedTopic, ...prev]);
    }
    if (resolvedCollege && !collegeOptions.includes(resolvedCollege)) {
      setCollegeOptions((prev) => [resolvedCollege, ...prev]);
    }
    if (resolvedOrg && !organizationOptions.includes(resolvedOrg)) {
      setOrganizationOptions((prev) => [resolvedOrg, ...prev]);
    }

    setForm(EMPTY_FORM);
    setEditId('');
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
      startDate: row.startDate,
      endDate: row.endDate,
      dailyHours: String(row.dailyHours || ''),
      learners: String(row.learners || ''),
      ratePerDay: String(row.ratePerDay || ''),
      notes: row.notes || '',
      tdsApplicable: row.tdsApplicable !== false,
      paymentStatus: row.paymentStatus || 'Invoiced'
    });

    setEditId(row.id);
    setActiveTab('log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this training engagement?')) return;
    persist(engagements.filter((x) => x.id !== id));
  };

  const handleCancel = () => {
    setEditId('');
    setForm(EMPTY_FORM);
  };

  const stats = useMemo(() => {
    const totalDays = engagements.reduce((s, x) => s + Number(x.totalDays || 0), 0);
    const totalGross = engagements.reduce((s, x) => s + getGrossAmount(x), 0);
    const totalTds = engagements.reduce((s, x) => s + getTdsAmount(x), 0);
    const totalAmount = engagements.reduce((s, x) => s + getNetAmount(x), 0);
    const paid = engagements
      .filter((x) => (x.paymentStatus || '').toLowerCase() === 'paid')
      .reduce((s, x) => s + getNetAmount(x), 0);
    return {
      total: engagements.length,
      totalDays,
      totalGross,
      totalTds,
      totalAmount,
      pending: totalAmount - paid
    };
  }, [engagements]);

  const filtered = useMemo(() => {
    return engagements.filter((x) => {
      if (filterCollege && x.college !== filterCollege) return false;
      if (filterOrganization && x.organization !== filterOrganization) return false;
      if (filterTrainer && x.trainerId !== filterTrainer) return false;
      if (filterStatus && x.paymentStatus !== filterStatus) return false;
      return true;
    });
  }, [engagements, filterCollege, filterOrganization, filterTrainer, filterStatus]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Training Engagements</h1>
          <p>Independent module driven by college + organization, with date range, days, and payment status.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('overview')}>Overview</button>
          <button className={`btn ${activeTab === 'log' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => { setActiveTab('log'); setEditId(''); setForm(EMPTY_FORM); refreshLookups(); }}>{editId ? 'Editing...' : '+ Add Engagement'}</button>
          <button className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('records')}>Records</button>
        </div>
      </div>

      <div className="summary-cards">
        <div className="ops-card summary-card teaching-stat-card"><div className="stat-value">{stats.total}</div><div className="stat-label">Total Engagements</div></div>
        <div className="ops-card summary-card teaching-stat-card accent-blue"><div className="stat-value">{stats.totalDays}</div><div className="stat-label">Total Days</div></div>
        <div className="ops-card summary-card teaching-stat-card accent-green"><div className="stat-value">{toInr(stats.totalGross)}</div><div className="stat-label">Gross Value</div></div>
        <div className="ops-card summary-card teaching-stat-card"><div className="stat-value">{toInr(stats.totalTds)}</div><div className="stat-label">Total TDS</div></div>
        <div className="ops-card summary-card teaching-stat-card accent-purple"><div className="stat-value">{toInr(stats.pending)}</div><div className="stat-label">Pending</div></div>
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
                <select className="form-control" value={form.trainerId} onChange={(e) => handleField('trainerId', e.target.value)}>
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

              <div className="form-group">
                <label>Start Date *</label>
                <input className="form-control" type="date" value={form.startDate} onChange={(e) => handleField('startDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label>End Date *</label>
                <input className="form-control" type="date" min={form.startDate} value={form.endDate} onChange={(e) => handleField('endDate', e.target.value)} />
                <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                  Total Days: {spanDays(form.startDate, form.endDate)}
                </span>
              </div>

              <div className="form-group">
                <label>Daily Duration (hours)</label>
                <input className="form-control" type="number" min="0" step="0.5" value={form.dailyHours} onChange={(e) => handleField('dailyHours', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Learners</label>
                <input className="form-control" type="number" min="0" value={form.learners} onChange={(e) => handleField('learners', e.target.value)} />
              </div>

              <div className="form-group">
                <label>Rate Per Day (INR)</label>
                <input className="form-control" type="number" min="0" value={form.ratePerDay} onChange={(e) => handleField('ratePerDay', e.target.value)} />
              </div>
              <div className="form-group">
                <label>TDS Handling</label>
                <select className="form-control" value={form.tdsApplicable ? 'yes' : 'no'} onChange={(e) => handleField('tdsApplicable', e.target.value === 'yes')}>
                  <option value="yes">Deduct 10% TDS (default)</option>
                  <option value="no">Ignore TDS for this payment</option>
                </select>
              </div>
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
            </div>

            <div className="form-group">
              <label>Notes</label>
              <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => handleField('notes', e.target.value)} />
            </div>

            <div style={{ marginBottom: '0.9rem', fontSize: '0.84rem', color: 'var(--ops-text-secondary)' }}>
              {(() => {
                const totalDays = spanDays(form.startDate, form.endDate);
                const gross = totalDays * Number(form.ratePerDay || 0);
                const tds = form.tdsApplicable ? (gross * DEFAULT_TDS_PERCENT) / 100 : 0;
                const net = gross - tds;
                return `Gross: ${toInr(gross)} | TDS: ${toInr(tds)} | Net Payable: ${toInr(net)}`;
              })()}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-primary" type="submit">{editId ? 'Update Engagement' : 'Save Engagement'}</button>
              {editId && <button className="btn btn-secondary" type="button" onClick={handleCancel}>Cancel</button>}
            </div>
          </form>
        </div>
      )}

      {activeTab === 'records' && (
        <div className="ops-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>All Engagement Records</h3>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterCollege} onChange={(e) => setFilterCollege(e.target.value)}>
              <option value="">All Colleges</option>
              {[...new Set(engagements.map((x) => x.college))].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterOrganization} onChange={(e) => setFilterOrganization(e.target.value)}>
              <option value="">All Organizations</option>
              {[...new Set(engagements.map((x) => x.organization))].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '180px' }} value={filterTrainer} onChange={(e) => setFilterTrainer(e.target.value)}>
              <option value="">All Trainers</option>
              {[...new Map(engagements.filter((x) => x.trainerId).map((x) => [x.trainerId, x.trainerName || x.trainerId])).entries()].map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
            <select className="form-control" style={{ width: 'auto', minWidth: '160px' }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="">All Status</option>
              {['Planned', 'Ongoing', 'Completed', 'Invoiced', 'Paid'].map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
            <span style={{ fontSize: '0.85rem', color: 'var(--ops-text-secondary)' }}>{filtered.length} of {engagements.length}</span>
          </div>

          {filtered.length === 0 ? (
            <p className="muted">No engagement records found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Topic</th>
                    <th>Trainer</th>
                    <th>College</th>
                    <th>Organization</th>
                    <th>Date Range</th>
                    <th>Days</th>
                    <th>Hours/Day</th>
                    <th>Rate/Day</th>
                    <th>Gross</th>
                    <th>TDS</th>
                    <th>Net Payable</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((x) => (
                    <tr key={x.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--ops-text-secondary)' }}>{x.id}</td>
                      <td><span className="status-pill pill-blue">{x.topic}</span></td>
                      <td>{x.trainerName || '—'}</td>
                      <td>{x.college}</td>
                      <td>{x.organization}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(x.startDate)} {'->'} {formatDate(x.endDate)}</td>
                      <td>{x.totalDays}</td>
                      <td>{x.dailyHours || '—'}</td>
                      <td>{toInr(x.ratePerDay)}</td>
                      <td>{toInr(getGrossAmount(x))}</td>
                      <td>{toInr(getTdsAmount(x))}</td>
                      <td><strong>{toInr(getNetAmount(x))}</strong></td>
                      <td><span className="status-pill pill-neutral">{x.paymentStatus || 'Invoiced'}</span></td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem', marginRight: '6px' }} onClick={() => handleEdit(x)}>Edit</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: '0.76rem' }} onClick={() => handleDelete(x.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'overview' && (
        <div className="ops-card" style={{ marginTop: '1.5rem' }}>
          <h3>Engagement Overview</h3>
          {engagements.length === 0 ? (
            <p className="muted">No engagements yet. Use + Add Engagement.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Topic</th>
                    <th>Trainer</th>
                    <th>College</th>
                    <th>Organization</th>
                    <th>Date Range</th>
                    <th>Days</th>
                    <th>Gross</th>
                    <th>TDS</th>
                    <th>Net</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {engagements.slice(0, 8).map((x) => (
                    <tr key={x.id}>
                      <td>{x.topic}</td>
                      <td>{x.trainerName || '—'}</td>
                      <td>{x.college}</td>
                      <td>{x.organization}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(x.startDate)} {'->'} {formatDate(x.endDate)}</td>
                      <td>{x.totalDays}</td>
                      <td>{toInr(getGrossAmount(x))}</td>
                      <td>{toInr(getTdsAmount(x))}</td>
                      <td>{toInr(getNetAmount(x))}</td>
                      <td><span className="status-pill pill-neutral">{x.paymentStatus || 'Invoiced'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default TrainingEngagementsHub;
