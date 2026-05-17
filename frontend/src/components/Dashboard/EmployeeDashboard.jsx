import React, { useEffect, useMemo, useState } from 'react';
import { trainingEngagementAPI, authAPI } from '../../services/api';

function toLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

// Smooth red → orange → green gradient based on 0-100 percentage.
// Interpolates #dc2626 (0%) → #f59e0b (50%) → #16a34a (100%).
function gradientColor(pct, over = false) {
  if (over) return '#16a34a';
  const t = Math.max(0, Math.min(100, pct)) / 100;
  if (t <= 0.5) {
    // red → amber: #dc2626 -> #f59e0b
    const u = t / 0.5;
    const r = Math.round(0xdc + (0xf5 - 0xdc) * u);
    const g = Math.round(0x26 + (0x9e - 0x26) * u);
    const b = Math.round(0x26 + (0x0b - 0x26) * u);
    return `rgb(${r},${g},${b})`;
  } else {
    // amber → green: #f59e0b -> #16a34a
    const u = (t - 0.5) / 0.5;
    const r = Math.round(0xf5 + (0x16 - 0xf5) * u);
    const g = Math.round(0x9e + (0xa3 - 0x9e) * u);
    const b = Math.round(0x0b + (0x4a - 0x0b) * u);
    return `rgb(${r},${g},${b})`;
  }
}

// Full gradient bar: always renders from red start to the current pct color.
function gradientBarBackground(pct, over = false) {
  if (over) return 'linear-gradient(90deg, #f59e0b, #16a34a)';
  if (pct <= 0) return '#dc2626';
  const stopColor = gradientColor(pct, false);
  if (pct <= 50) return `linear-gradient(90deg, #dc2626, ${stopColor})`;
  return `linear-gradient(90deg, #dc2626, #f59e0b, ${stopColor})`;
}

// ── Mini components ──────────────────────────────────────────────────────────

function TargetGauge({
  achieved, target,
  editingTarget, targetInput, targetSaving,
  onEditStart, onTargetInputChange, onSaveTarget, onCancelEdit
}) {
  const pct = Math.min(100, target > 0 ? (achieved / target) * 100 : 0);
  const over = achieved >= target;
  const textColor = gradientColor(pct, over);
  const barBg = gradientBarBackground(pct, over);

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '24px 28px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Annual Progress</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Your engagement progress towards the yearly goal</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: textColor }}>{pct.toFixed(1)}%</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>of annual target</div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ background: '#f3f4f6', borderRadius: 999, height: 18, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: barBg,
          borderRadius: 999,
          transition: 'width 0.8s ease'
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: '13px' }}>
        <span style={{ color: textColor, fontWeight: 600 }}>
          {over ? '🎉 Target met!' : `${(100 - pct).toFixed(1)}% remaining`}
        </span>
        <span style={{ color: '#6b7280' }}>
          {achieved} of {target} engagements &nbsp;·&nbsp; {pct.toFixed(1)}% complete
        </span>
      </div>

      {/* Goal editor — engagement count target (employee can self-set) */}
      <div style={{ marginTop: 14, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
        {editingTarget ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>Annual engagement target:</label>
            <input
              type="number"
              min="1"
              value={targetInput}
              onChange={(e) => onTargetInputChange(e.target.value)}
              style={{
                width: 80, padding: '4px 8px', border: '1px solid #d1d5db',
                borderRadius: 6, fontSize: '13px', outline: 'none'
              }}
              autoFocus
            />
            <button
              onClick={onSaveTarget}
              disabled={targetSaving}
              style={{
                padding: '4px 14px', background: '#2563eb', color: '#fff',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '12px', fontWeight: 600
              }}
            >
              {targetSaving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={onCancelEdit}
              style={{
                padding: '4px 12px', background: '#f3f4f6', color: '#374151',
                border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: '12px'
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={onEditStart}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: '12px', color: '#6b7280', padding: '2px 0',
              display: 'flex', alignItems: 'center', gap: 5
            }}
          >
            ✏️ Set yearly goal <span style={{ color: '#9ca3af' }}>(currently {target} engagements)</span>
          </button>
        )}
      </div>
    </div>
  );
}

// Revenue gauge — monetary target set by platform_owner/superadmin, read-only for employee
function RevenueGauge({ achieved, target }) {
  const hasTarget = target > 0;
  const pct = hasTarget ? Math.min(100, (achieved / target) * 100) : 0;
  const over = achieved >= target && hasTarget;
  const textColor = hasTarget ? gradientColor(pct, over) : '#9ca3af';
  const barBg = hasTarget ? gradientBarBackground(pct, over) : '#e5e7eb';

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '14px',
      padding: '24px 28px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      marginBottom: '24px'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Revenue Contribution</h3>
          <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6b7280' }}>Total business revenue from your sourced engagements this year</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '26px', fontWeight: 800, color: textColor }}>{inr(achieved)}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {hasTarget ? `of ${inr(target)} target` : 'No target set by admin yet'}
          </div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ background: '#f3f4f6', borderRadius: 999, height: 18, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%',
          width: `${hasTarget ? pct : 100}%`,
          background: barBg,
          borderRadius: 999,
          transition: 'width 0.8s ease'
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
        <span style={{ color: textColor, fontWeight: 600 }}>
          {!hasTarget ? '⏳ Awaiting admin to set revenue goal'
            : over ? '🎉 Revenue target met!'
            : `${(100 - pct).toFixed(1)}% remaining`}
        </span>
        {hasTarget && (
          <span style={{ color: '#6b7280' }}>{pct.toFixed(1)}% complete</span>
        )}
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  const colors = {
    green:   { border: '#16a34a', text: '#15803d' },
    blue:    { border: '#2563eb', text: '#1d4ed8' },
    orange:  { border: '#f59e0b', text: '#b45309' },
    red:     { border: '#dc2626', text: '#b91c1c' },
    purple:  { border: '#7c3aed', text: '#6d28d9' },
    default: { border: '#d1d5db', text: '#111827' }
  };
  const c = colors[accent] || colors.default;
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderLeft: `4px solid ${c.border}`,
      borderRadius: '10px',
      padding: '16px 20px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: c.text }}>{value}</div>
      <div style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600, marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionHeader({ title, count }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 28 }}>
      <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#111827' }}>{title}</h3>
      {count !== undefined && (
        <span style={{ background: '#e0e7ff', color: '#3730a3', borderRadius: 999, padding: '1px 9px', fontSize: '12px', fontWeight: 700 }}>{count}</span>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const map = {
    paid:      { bg: '#d1fae5', color: '#065f46', dot: '#16a34a' },
    invoiced:  { bg: '#fef9c3', color: '#854d0e', dot: '#ca8a04' },
    completed: { bg: '#dbeafe', color: '#1e40af', dot: '#2563eb' },
    ongoing:   { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' },
    planned:   { bg: '#fee2e2', color: '#991b1b', dot: '#dc2626' },
  };
  const s = (status || 'planned').toLowerCase();
  const style = map[s] || map.planned;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 4, fontSize: '11px', fontWeight: 700,
      background: style.bg, color: style.color
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: style.dot, display: 'inline-block', flexShrink: 0 }} />
      {status || 'Planned'}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function EmployeeDashboard({ user }) {
  const [target, setTarget] = useState(20);
  const [revenueTarget, setRevenueTarget] = useState(0);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState('');
  const [targetSaving, setTargetSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('engagements');
  const [engagements, setEngagements] = useState([]);

  useEffect(() => {
    let isMounted = true;

    const loadEngagements = async () => {
      try {
        const res = await trainingEngagementAPI.getAll();
        if (!isMounted) return;
        const rows = Array.isArray(res.data) ? res.data : [];
        setEngagements(rows.map((item) => ({
          id: item._id || item.id,
          topic: item.trainers?.[0]?.trainingTopic || item.trainers?.[0]?.subjectArea || item.topic || '',
          trainerId: item.trainers?.[0]?.trainerId?._id || item.trainers?.[0]?.trainerId || item.trainerId || '',
          trainerName: item.trainers?.[0]?.trainerId?.fullName || item.trainers?.[0]?.trainerName || item.trainerName || '',
          college: item.institutionId?.name || item.college || '',
          organization: item.clientId?.name || item.organization || '',
          startDate: item.startDate,
          endDate: item.endDate,
          totalDays: item.totalDays,
          // contributionAmount = grossAmount exposed by backend to employees (what this engagement is worth)
          contributionAmount: Number(item.contributionAmount || 0),
          paymentStatus: item.status || item.paymentStatus || 'Planned'
        })));
      } catch {
        if (isMounted) {
          setEngagements([]);
        }
      }
    };

    loadEngagements();

    // Fetch server-stored annual targets (JWT-authenticated)
    authAPI.getUser().then((res) => {
      const t = res?.data?.annualEngagementTarget;
      if (t && t >= 1) setTarget(t);
      const r = res?.data?.annualRevenueTarget;
      if (r !== undefined && r >= 0) setRevenueTarget(r);
    }).catch(() => {});

    const onFinancialSync = () => {
      loadEngagements();
    };

    window.addEventListener('ops-financial-sync', onFinancialSync);
    return () => {
      isMounted = false;
      window.removeEventListener('ops-financial-sync', onFinancialSync);
    };
  }, []);

  const trainers = useMemo(() => {
    const trainerMap = new Map();
    engagements.forEach((item) => {
      const key = item.trainerId || item.trainerName;
      if (!key || trainerMap.has(key)) return;
      trainerMap.set(key, {
        id: item.trainerId || key,
        name: item.trainerName || '—',
        specialization: item.topic || ''
      });
    });
    return [...trainerMap.values()];
  }, [engagements]);

  const currentYear = new Date().getFullYear();

  // Count of engagements in the current year (engagement progress)
  const yearEngagementsCount = useMemo(() => {
    return engagements.filter(e => {
      const d = new Date(e.startDate || e.createdAt);
      return !isNaN(d) && d.getFullYear() === currentYear;
    }).length;
  }, [engagements, currentYear]);

  // Revenue contribution for current year (gross value of sourced engagements)
  const yearRevenue = useMemo(() => {
    return engagements
      .filter(e => {
        const d = new Date(e.startDate || e.createdAt);
        return !isNaN(d) && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + Number(e.contributionAmount || 0), 0);
  }, [engagements, currentYear]);

  const handleSaveTarget = async () => {
    const n = parseInt(targetInput, 10);
    if (isNaN(n) || n < 1) return;
    setTargetSaving(true);
    try {
      await authAPI.updateUser({ annualEngagementTarget: n });
      setTarget(n);
      setEditingTarget(false);
    } catch {
      // fail silently — target not saved, but no crash
    } finally {
      setTargetSaving(false);
    }
  };

  // Unique locations (colleges)
  const uniqueColleges = useMemo(() => {
    const set = new Set(engagements.map(e => (e.college || '').trim()).filter(Boolean));
    return [...set].sort();
  }, [engagements]);

  // Unique organizations / vendors / edtech
  const uniqueOrgs = useMemo(() => {
    const set = new Set(engagements.map(e => (e.organization || '').trim()).filter(Boolean));
    return [...set].sort();
  }, [engagements]);

  // Unique topics
  const uniqueTopics = useMemo(() => {
    const map = {};
    engagements.forEach(e => {
      const t = (e.topic || '').trim();
      if (t) map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [engagements]);

  // Pending (org hasn't paid)
  const pendingEngagements = useMemo(() =>
    engagements.filter(e => (e.paymentStatus || 'Invoiced').toLowerCase() !== 'paid'),
    [engagements]
  );

  const paidEngagements = useMemo(() =>
    engagements.filter(e => (e.paymentStatus || '').toLowerCase() === 'paid'),
    [engagements]
  );

  const TABS = [
    { id: 'engagements', label: 'Engagements' },
    { id: 'colleges', label: 'Colleges' },
    { id: 'trainers', label: 'Trainers' },
    { id: 'topics', label: 'Topics' },
    { id: 'vendors', label: 'Vendors / EdTech' },
  ];

  return (
    <section style={{ padding: '24px', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>
          Welcome, {user?.name?.split(' ')[0] || 'there'} 👋
        </h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
          Your operations overview for {currentYear}
        </p>
      </div>

      {/* Target gauge — progress driven by engagement count, target stored server-side per user */}
      <TargetGauge
        achieved={yearEngagementsCount}
        target={target}
        editingTarget={editingTarget}
        targetInput={targetInput}
        targetSaving={targetSaving}
        onEditStart={() => { setTargetInput(String(target)); setEditingTarget(true); }}
        onTargetInputChange={setTargetInput}
        onSaveTarget={handleSaveTarget}
        onCancelEdit={() => setEditingTarget(false)}
      />

      {/* Revenue gauge — monetary contribution vs admin-set revenue target */}
      <RevenueGauge achieved={yearRevenue} target={revenueTarget} />

      {/* Quick stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 14, marginBottom: 32 }}>
        <StatTile label="Total Engagements" value={engagements.length} accent="blue" />
        <StatTile label="Paid by Orgs" value={paidEngagements.length} accent="green" />
        <StatTile label="Awaiting Payment" value={pendingEngagements.length} accent="orange" />
        <StatTile label="Colleges" value={uniqueColleges.length} accent="purple" />
        <StatTile label="Trainers" value={trainers.length} accent="blue" />
        <StatTile label="Topics" value={uniqueTopics.length} accent="green" />
        <StatTile label="Vendors / EdTech" value={uniqueOrgs.length} accent="orange" />
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: activeTab === tab.id ? 700 : 500,
              color: activeTab === tab.id ? '#2563eb' : '#6b7280',
              borderBottom: activeTab === tab.id ? '2px solid #2563eb' : '2px solid transparent',
              marginBottom: -1
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Engagements Tab ── */}
      {activeTab === 'engagements' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['#', 'College', 'Organization', 'Topic', 'Trainer', 'Dates', 'Org Payment'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {engagements.map((e, i) => (
                <tr key={e.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{i + 1}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    <span style={{ background: '#eff6ff', color: '#1d4ed8', borderRadius: 4, padding: '2px 7px', fontSize: '12px' }}>{e.college || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{e.organization || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#374151' }}>{e.topic || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{e.trainerName || '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {e.startDate ? new Date(e.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                    {e.endDate && e.endDate !== e.startDate ? ` – ${new Date(e.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}` : (e.startDate ? ` ${new Date(e.startDate).getFullYear()}` : '')}
                  </td>
                  <td style={{ padding: '10px 12px' }}><StatusBadge status={e.paymentStatus || 'Invoiced'} /></td>
                </tr>
              ))}
              {engagements.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No engagements yet. Add one from Training Engagements.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Colleges Tab ── */}
      {activeTab === 'colleges' && (
        <div>
          <SectionHeader title="Colleges & Institutions" count={uniqueColleges.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {uniqueColleges.map(college => {
              const count = engagements.filter(e => e.college === college).length;
              return (
                <div key={college} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1d4ed8', marginBottom: 6 }}>{college}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{count} engagement{count !== 1 ? 's' : ''}</div>
                </div>
              );
            })}
            {uniqueColleges.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No college data yet.</p>}
          </div>
        </div>
      )}

      {/* ── Trainers Tab ── */}
      {activeTab === 'trainers' && (
        <div>
          <SectionHeader title="Trainer Pool" count={trainers.length} />
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['#', 'Name', 'Specialization', 'Engagements'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trainers.map((t, i) => {
                  const tEngagements = engagements.filter(e => e.trainerId === t.id || e.trainerName === t.name).length;
                  return (
                    <tr key={t.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px 12px', color: '#9ca3af' }}>{i + 1}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{t.name || '—'}</td>
                      <td style={{ padding: '10px 12px', color: '#6b7280' }}>{t.specialization || t.expertise || t.skills || '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 4, padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>{tEngagements}</span>
                      </td>
                    </tr>
                  );
                })}
                {trainers.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: '#9ca3af' }}>No trainers added yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Topics Tab ── */}
      {activeTab === 'topics' && (
        <div>
          <SectionHeader title="Topics Delivered" count={uniqueTopics.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {uniqueTopics.map(([topic, count]) => (
              <div key={topic} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#111827' }}>{topic}</div>
                <span style={{ background: '#d1fae5', color: '#065f46', borderRadius: 999, padding: '2px 10px', fontSize: '12px', fontWeight: 700 }}>{count}×</span>
              </div>
            ))}
            {uniqueTopics.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No topics recorded yet.</p>}
          </div>
        </div>
      )}

      {/* ── Vendors / EdTech Tab ── */}
      {activeTab === 'vendors' && (
        <div>
          <SectionHeader title="Vendor / EdTech Organizations" count={uniqueOrgs.length} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {uniqueOrgs.map(org => {
              const count = engagements.filter(e => e.organization === org).length;
              return (
                <div key={org} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#92400e', marginBottom: 6 }}>{org}</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>{count} engagement{count !== 1 ? 's' : ''}</div>
                </div>
              );
            })}
            {uniqueOrgs.length === 0 && <p style={{ color: '#9ca3af', fontSize: '14px' }}>No vendor / EdTech organizations found.</p>}
          </div>
        </div>
      )}
    </section>
  );
}

export default EmployeeDashboard;
