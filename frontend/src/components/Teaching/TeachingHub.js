import React, { useMemo, useState } from 'react';

const TOPICS = [
  'Core Java',
  'Java FSD',
  'MERN Stack',
  'MEAN Stack',
  'Python',
  'AWS Cloud',
  'Azure Cloud',
  'Database',
  'Frontend Development',
  'Backend Development',
  'Linux & Shell Scripting',
  'DevOps (CI/CD, Docker, Kubernetes)',
  'GenAI & LLM',
  'Telecom (OSS/BSS, 2G-5G)',
  'SDLC & Agile',
  'Data Engineering',
  'React.js',
  'Node.js',
  'Spring Boot',
  'FastAPI',
  'TypeScript',
  'MongoDB',
  'PostgreSQL',
  'Docker & Kubernetes',
  'Jenkins CI/CD',
  'LangChain & RAG',
  'Interview Preparation',
  'Other'
];

const ORGANIZATIONS = [
  'ByteXL',
  'ICT Academy',
  'Bizotic',
  'JV Global',
  'Atom',
  'SeventhSense',
  'Dlithe',
  'LTI Mindtree',
  'Ancile Digital',
  'Infosys (Pre-joining)',
  'TCS (Pre-joining)',
  'Capgemini (Pre-joining)',
  'Wipro (Pre-joining)',
  'Accenture (Pre-joining)',
  'IBM (Pre-joining)',
  'IIT Guwahati',
  'Other / Private'
];

const SESSION_TYPES = [
  'Workshop',
  'Batch Training',
  'One-on-One Mentoring',
  'Live Session',
  'Hands-on Lab',
  'Project Review',
  'Mock Interview',
  'Webinar',
  'Pre-joining Training',
  'Certification Prep'
];

const EMPTY_FORM = {
  topic: '',
  customTopic: '',
  sessionType: 'Batch Training',
  organization: '',
  customOrg: '',
  duration: '',
  learnerCount: '',
  batchName: '',
  notes: '',
  startDate: new Date().toISOString().slice(0, 10),
  endDate: new Date().toISOString().slice(0, 10),
  trainerId: '',
  trainerName: ''
};

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isSameWeek(dateStr) {
  const now = new Date();
  const d = new Date(dateStr);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);
  return d >= startOfWeek && d < endOfWeek;
}

function spanDays(start, end) {
  if (!start || !end) return 0;
  const diff = new Date(end) - new Date(start);
  return Math.max(1, Math.round(diff / 86400000) + 1);
}

function dateRangeLabel(start, end) {
  if (!start) return '—';
  if (!end || start === end) return formatDate(start);
  return `${formatDate(start)} → ${formatDate(end)}`;
}

// Sync a teaching session as a record inside trainer_profiles
function syncTrainerRecord(trainerId, sessionId, topic, org, duration, action) {
  const profiles = JSON.parse(localStorage.getItem('trainer_profiles') || '[]');
  const updated = profiles.map((p) => {
    if (p.id !== trainerId) return p;
    const filtered = (p.records || []).filter((r) => r.referenceId !== `teaching:${sessionId}`);
    if (action === 'delete') return { ...p, records: filtered };
    const newRec = {
      id: `teaching-sync-${sessionId}`,
      type: 'teaching',
      referenceId: `teaching:${sessionId}`,
      notes: `${topic} @ ${org}`,
      amount: 0,
      duration,
      date: new Date().toISOString()
    };
    return { ...p, records: [newRec, ...filtered] };
  });
  localStorage.setItem('trainer_profiles', JSON.stringify(updated));
}

// Remove a teaching session record from ALL trainers (used when trainer changes on edit)
function removeTrainerRecord(sessionId) {
  const profiles = JSON.parse(localStorage.getItem('trainer_profiles') || '[]');
  const updated = profiles.map((p) => ({
    ...p,
    records: (p.records || []).filter((r) => r.referenceId !== `teaching:${sessionId}`)
  }));
  localStorage.setItem('trainer_profiles', JSON.stringify(updated));
}

function BarChart({ data, maxVal, colorClass }) {
  return (
    <div className="teaching-bar-chart">
      {data.map((item) => (
        <div key={item.label} className="teaching-bar-row">
          <span className="teaching-bar-label" title={item.label}>{item.label.length > 22 ? item.label.slice(0, 20) + '…' : item.label}</span>
          <div className="teaching-bar-track">
            <div
              className={`teaching-bar-fill ${colorClass || ''}`}
              style={{ width: maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%' }}
            />
          </div>
          <span className="teaching-bar-count">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

function TeachingHub() {
  const [sessions, setSessions] = useState(() =>
    JSON.parse(localStorage.getItem('teaching_sessions') || '[]')
  );
  const [trainers, setTrainers] = useState(() =>
    JSON.parse(localStorage.getItem('trainer_profiles') || '[]')
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [filterTopic, setFilterTopic] = useState('');
  const [filterOrg, setFilterOrg] = useState('');
  const [filterTrainer, setFilterTrainer] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Refresh trainer list when switching to log tab so dropdown is always current
  const refreshTrainers = () => {
    setTrainers(JSON.parse(localStorage.getItem('trainer_profiles') || '[]'));
  };

  const persist = (next) => {
    localStorage.setItem('teaching_sessions', JSON.stringify(next));
    setSessions(next);
  };

  const handleField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Auto-sync end date must not be before start date
      if (key === 'startDate' && next.endDate && value > next.endDate) {
        next.endDate = value;
      }
      // Auto-fill trainerName when trainerId changes
      if (key === 'trainerId') {
        const found = trainers.find((t) => t.id === value);
        next.trainerName = found ? found.trainerName : '';
      }
      return next;
    });
  };

  const resolvedTopic = form.topic === 'Other' ? form.customTopic : form.topic;
  const resolvedOrg = form.organization === 'Other / Private' ? form.customOrg : form.organization;

  const handleSave = (e) => {
    e.preventDefault();
    if (!resolvedTopic) {
      window.alert('Please select or enter a topic.');
      return;
    }
    if (!resolvedOrg) {
      window.alert('Please select or enter an organization/college.');
      return;
    }
    if (!form.duration || isNaN(Number(form.duration)) || Number(form.duration) <= 0) {
      window.alert('Enter a valid duration in hours.');
      return;
    }
    if (!form.startDate) {
      window.alert('Please select a start date.');
      return;
    }

    const sessionId = editId || Date.now().toString();
    const prevSession = editId ? sessions.find((s) => s.id === editId) : null;

    const record = {
      id: sessionId,
      topic: resolvedTopic,
      sessionType: form.sessionType,
      organization: resolvedOrg,
      duration: Number(form.duration),
      learnerCount: Number(form.learnerCount || 0),
      batchName: form.batchName,
      notes: form.notes,
      startDate: form.startDate,
      endDate: form.endDate || form.startDate,
      trainerId: form.trainerId || '',
      trainerName: form.trainerName || '',
      createdAt: editId
        ? (prevSession?.createdAt || new Date().toISOString())
        : new Date().toISOString()
    };

    // Bidirectional trainer sync
    if (editId && prevSession?.trainerId && prevSession.trainerId !== form.trainerId) {
      // Trainer changed: remove old link
      removeTrainerRecord(sessionId);
    }
    if (form.trainerId) {
      syncTrainerRecord(form.trainerId, sessionId, resolvedTopic, resolvedOrg, Number(form.duration), 'upsert');
    }

    if (editId) {
      persist(sessions.map((s) => (s.id === editId ? record : s)));
    } else {
      persist([record, ...sessions]);
    }

    setForm(EMPTY_FORM);
    setEditId(null);
  };

  const handleEdit = (session) => {
    refreshTrainers();
    const isCustomTopic = !TOPICS.includes(session.topic);
    const isCustomOrg = !ORGANIZATIONS.includes(session.organization);
    setForm({
      topic: isCustomTopic ? 'Other' : session.topic,
      customTopic: isCustomTopic ? session.topic : '',
      sessionType: session.sessionType || 'Batch Training',
      organization: isCustomOrg ? 'Other / Private' : session.organization,
      customOrg: isCustomOrg ? session.organization : '',
      duration: String(session.duration),
      learnerCount: String(session.learnerCount || ''),
      batchName: session.batchName || '',
      notes: session.notes || '',
      startDate: session.startDate || session.date || new Date().toISOString().slice(0, 10),
      endDate: session.endDate || session.date || new Date().toISOString().slice(0, 10),
      trainerId: session.trainerId || '',
      trainerName: session.trainerName || ''
    });
    setEditId(session.id);
    setActiveTab('log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this teaching session record?')) return;
    // Remove linked trainer record
    removeTrainerRecord(id);
    persist(sessions.filter((s) => s.id !== id));
  };

  const handleCancel = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
  };

  // ── Analytics ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const thisWeek = sessions.filter((s) => isSameWeek(s.startDate || s.date));
    const totalLearners = sessions.reduce((sum, s) => sum + (s.learnerCount || 0), 0);
    const totalHours = sessions.reduce((sum, s) => sum + (s.duration || 0), 0);

    const topicCount = {};
    sessions.forEach((s) => {
      topicCount[s.topic] = (topicCount[s.topic] || 0) + 1;
    });

    const orgCount = {};
    sessions.forEach((s) => {
      orgCount[s.organization] = (orgCount[s.organization] || 0) + 1;
    });

    const sessionTypeCount = {};
    sessions.forEach((s) => {
      sessionTypeCount[s.sessionType] = (sessionTypeCount[s.sessionType] || 0) + 1;
    });

    const topTopics = Object.entries(topicCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([label, value]) => ({ label, value }));

    const topOrgs = Object.entries(orgCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));

    const topSessionTypes = Object.entries(sessionTypeCount)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));

    const topTopic = topTopics[0]?.label || '—';
    const topOrg = topOrgs[0]?.label || '—';

    return {
      thisWeekCount: thisWeek.length,
      thisWeekHours: thisWeek.reduce((sum, s) => sum + (s.duration || 0), 0),
      totalSessions: sessions.length,
      totalLearners,
      totalHours,
      topTopic,
      topOrg,
      topTopics,
      topOrgs,
      topSessionTypes,
      maxTopicCount: topTopics[0]?.value || 0,
      maxOrgCount: topOrgs[0]?.value || 0,
      maxTypeCount: topSessionTypes[0]?.value || 0
    };
  }, [sessions]);

  // ── Filtered table ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filterTopic && s.topic !== filterTopic) return false;
      if (filterOrg && s.organization !== filterOrg) return false;
      if (filterTrainer && s.trainerId !== filterTrainer) return false;
      return true;
    });
  }, [sessions, filterTopic, filterOrg, filterTrainer]);

  const allTopicsInData = useMemo(() => {
    const set = new Set(sessions.map((s) => s.topic));
    return [...set].sort();
  }, [sessions]);

  const allOrgsInData = useMemo(() => {
    const set = new Set(sessions.map((s) => s.organization));
    return [...set].sort();
  }, [sessions]);

  const allTrainersInData = useMemo(() => {
    const map = {};
    sessions.forEach((s) => { if (s.trainerId) map[s.trainerId] = s.trainerName || s.trainerId; });
    return Object.entries(map).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Teaching Hub</h1>
          <p>Log training sessions, track topics, learners, and organizations — all in one place.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`btn ${activeTab === 'log' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { refreshTrainers(); setActiveTab('log'); setEditId(null); setForm(EMPTY_FORM); }}
          >
            {editId ? 'Editing…' : '+ Log Session'}
          </button>
          <button
            className={`btn ${activeTab === 'records' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab('records')}
          >
            Records
          </button>
        </div>
      </div>

      {/* ── SUMMARY CARDS ── */}
      <div className="summary-cards">
        <div className="ops-card summary-card teaching-stat-card">
          <div className="stat-value">{stats.totalSessions}</div>
          <div className="stat-label">Total Sessions</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-green">
          <div className="stat-value">{stats.totalLearners}</div>
          <div className="stat-label">Learners Trained</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-blue">
          <div className="stat-value">{stats.totalHours}h</div>
          <div className="stat-label">Total Hours Delivered</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-purple">
          <div className="stat-value">{stats.thisWeekCount}</div>
          <div className="stat-label">Sessions This Week ({stats.thisWeekHours}h)</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card">
          <div className="stat-value" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.topTopic}</div>
          <div className="stat-label">Top Topic</div>
        </div>
        <div className="ops-card summary-card teaching-stat-card accent-green">
          <div className="stat-value" style={{ fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{stats.topOrg}</div>
          <div className="stat-label">Top Organization</div>
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === 'overview' && (
        <div className="ops-grid-two" style={{ marginTop: '1.5rem' }}>
          <div className="ops-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--ops-text-secondary)' }}>Topic Frequency</h3>
            {stats.topTopics.length === 0 ? (
              <p style={{ color: 'var(--ops-text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>No sessions logged yet.</p>
            ) : (
              <BarChart data={stats.topTopics} maxVal={stats.maxTopicCount} colorClass="bar-blue" />
            )}
          </div>
          <div className="ops-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--ops-text-secondary)' }}>Organization / College Distribution</h3>
            {stats.topOrgs.length === 0 ? (
              <p style={{ color: 'var(--ops-text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>No sessions logged yet.</p>
            ) : (
              <BarChart data={stats.topOrgs} maxVal={stats.maxOrgCount} colorClass="bar-green" />
            )}
          </div>
          <div className="ops-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--ops-text-secondary)' }}>Session Type Breakdown</h3>
            {stats.topSessionTypes.length === 0 ? (
              <p style={{ color: 'var(--ops-text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>No sessions logged yet.</p>
            ) : (
              <BarChart data={stats.topSessionTypes} maxVal={stats.maxTypeCount} colorClass="bar-purple" />
            )}
          </div>
          <div className="ops-card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--ops-text-secondary)' }}>Recent Sessions</h3>
            {sessions.length === 0 ? (
              <p style={{ color: 'var(--ops-text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>No sessions logged yet. Use "+ Log Session" to get started.</p>
            ) : (
              <table className="ops-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr><th>Session ID</th><th>Date Range</th><th>Topic</th><th>Org</th><th>Trainer</th><th>Duration</th><th>Learners</th></tr>
                </thead>
                <tbody>
                  {sessions.slice(0, 6).map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--ops-text-secondary)' }}>{s.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{dateRangeLabel(s.startDate || s.date, s.endDate)}</td>
                      <td><span className="status-pill pill-blue">{s.topic}</span></td>
                      <td>{s.organization}</td>
                      <td>{s.trainerName || <span style={{ color: 'var(--ops-text-secondary)' }}>—</span>}</td>
                      <td>{s.duration}h</td>
                      <td>{s.learnerCount || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── LOG SESSION TAB ── */}
      {activeTab === 'log' && (
        <div className="ops-card" style={{ marginTop: '1.5rem', maxWidth: '700px' }}>
          <h3 style={{ marginBottom: '1.25rem' }}>{editId ? 'Edit Session' : 'Log a Teaching Session'}</h3>
          <form onSubmit={handleSave}>
            <div className="ops-grid-two">
              {/* Topic */}
              <div className="form-group">
                <label>Topic / Subject *</label>
                <select className="form-control" value={form.topic} onChange={(e) => handleField('topic', e.target.value)}>
                  <option value="">— Select Topic —</option>
                  {TOPICS.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>
              {form.topic === 'Other' && (
                <div className="form-group">
                  <label>Custom Topic *</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="Enter topic name"
                    value={form.customTopic}
                    onChange={(e) => handleField('customTopic', e.target.value)}
                  />
                </div>
              )}

              {/* Session Type */}
              <div className="form-group">
                <label>Session Type</label>
                <select className="form-control" value={form.sessionType} onChange={(e) => handleField('sessionType', e.target.value)}>
                  {SESSION_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
                </select>
              </div>

              {/* Organization */}
              <div className="form-group">
                <label>Organization / College *</label>
                <select className="form-control" value={form.organization} onChange={(e) => handleField('organization', e.target.value)}>
                  <option value="">— Select Organization —</option>
                  {ORGANIZATIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
                </select>
              </div>
              {form.organization === 'Other / Private' && (
                <div className="form-group">
                  <label>Custom Organization *</label>
                  <input
                    className="form-control"
                    type="text"
                    placeholder="e.g. College name or client"
                    value={form.customOrg}
                    onChange={(e) => handleField('customOrg', e.target.value)}
                  />
                </div>
              )}

              {/* Duration */}
              <div className="form-group">
                <label>Duration (hours) *</label>
                <input
                  className="form-control"
                  type="number"
                  min="0.5"
                  step="0.5"
                  placeholder="e.g. 2"
                  value={form.duration}
                  onChange={(e) => handleField('duration', e.target.value)}
                />
              </div>

              {/* Learner Count */}
              <div className="form-group">
                <label>Learner Count</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  placeholder="How many learners?"
                  value={form.learnerCount}
                  onChange={(e) => handleField('learnerCount', e.target.value)}
                />
              </div>

              {/* Batch Name */}
              <div className="form-group">
                <label>Batch / Session Name</label>
                <input
                  className="form-control"
                  type="text"
                  placeholder="e.g. Batch-15, MERN Jan 2026"
                  value={form.batchName}
                  onChange={(e) => handleField('batchName', e.target.value)}
                />
              </div>

              {/* Start Date */}
              <div className="form-group">
                <label>Start Date *</label>
                <input
                  className="form-control"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => handleField('startDate', e.target.value)}
                />
              </div>

              {/* End Date */}
              <div className="form-group">
                <label>End Date</label>
                <input
                  className="form-control"
                  type="date"
                  min={form.startDate}
                  value={form.endDate}
                  onChange={(e) => handleField('endDate', e.target.value)}
                />
                {form.startDate && form.endDate && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', marginTop: '4px', display: 'block' }}>
                    Span: {spanDays(form.startDate, form.endDate)} day{spanDays(form.startDate, form.endDate) !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Linked Trainer */}
              <div className="form-group">
                <label>Linked Trainer</label>
                <select
                  className="form-control"
                  value={form.trainerId}
                  onChange={(e) => handleField('trainerId', e.target.value)}
                >
                  <option value="">— No trainer linked —</option>
                  {trainers.map((t) => (
                    <option key={t.id} value={t.id}>{t.trainerName} ({t.userProfile?.email || t.id})</option>
                  ))}
                </select>
                {trainers.length === 0 && (
                  <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', display: 'block', marginTop: '4px' }}>
                    No trainer profiles yet — create one in the Vendor section.
                  </span>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label>Notes / Topics Covered</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="e.g. Covered React hooks, useState, useEffect, Context API. Lab: Todo app."
                value={form.notes}
                onChange={(e) => handleField('notes', e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button className="btn btn-primary" type="submit">{editId ? 'Update Session' : 'Save Session'}</button>
              {editId && (
                <button className="btn btn-secondary" type="button" onClick={handleCancel}>Cancel</button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* ── RECORDS TAB ── */}
      {activeTab === 'records' && (
        <div className="ops-card" style={{ marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>All Sessions</h3>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '180px' }}
              value={filterTopic}
              onChange={(e) => setFilterTopic(e.target.value)}
            >
              <option value="">All Topics</option>
              {allTopicsInData.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '180px' }}
              value={filterOrg}
              onChange={(e) => setFilterOrg(e.target.value)}
            >
              <option value="">All Organizations</option>
              {allOrgsInData.map((o) => (<option key={o} value={o}>{o}</option>))}
            </select>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '160px' }}
              value={filterTrainer}
              onChange={(e) => setFilterTrainer(e.target.value)}
            >
              <option value="">All Trainers</option>
              {allTrainersInData.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
            </select>
            <span style={{ fontSize: '0.85rem', color: 'var(--ops-text-secondary)' }}>
              {filtered.length} of {sessions.length} records
            </span>
          </div>

          {filtered.length === 0 ? (
            <p style={{ color: 'var(--ops-text-secondary)', fontStyle: 'italic' }}>
              {sessions.length === 0
                ? 'No sessions logged yet. Use "+ Log Session" to begin.'
                : 'No sessions match the current filter.'}
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="ops-table">
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Span</th>
                    <th>Topic</th>
                    <th>Session Type</th>
                    <th>Organization</th>
                    <th>Batch</th>
                    <th>Trainer</th>
                    <th>Duration</th>
                    <th>Learners</th>
                    <th>Notes</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: 'var(--ops-text-secondary)', whiteSpace: 'nowrap' }}>{s.id}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.startDate || s.date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDate(s.endDate || s.startDate || s.date)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{spanDays(s.startDate || s.date, s.endDate || s.startDate || s.date)}d</td>
                      <td><span className="status-pill pill-blue">{s.topic}</span></td>
                      <td><span className="status-pill pill-neutral">{s.sessionType}</span></td>
                      <td>{s.organization}</td>
                      <td>{s.batchName || '—'}</td>
                      <td>{s.trainerName ? <span className="status-pill pill-neutral">{s.trainerName}</span> : '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{s.duration}h</td>
                      <td>{s.learnerCount || '—'}</td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.notes}>{s.notes || '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 10px', fontSize: '0.78rem', marginRight: '4px' }}
                          onClick={() => handleEdit(s)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                          onClick={() => handleDelete(s.id)}
                        >
                          Delete
                        </button>
                      </td>
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

export default TeachingHub;
