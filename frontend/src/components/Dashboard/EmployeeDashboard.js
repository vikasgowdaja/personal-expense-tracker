import React, { useMemo, useState } from 'react';

const ANNUAL_TARGET = 500000; // ₹5 lakh default target

function inr(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function toLocalDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const DEFAULT_TDS = 10;

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
    : Number(row.tdsAmount !== undefined ? row.tdsAmount : (gross * DEFAULT_TDS) / 100);
  return Number(row.totalAmount !== undefined ? row.totalAmount : gross - tds);
}

// ── Mini components ──────────────────────────────────────────────────────────

function TargetGauge({ achieved, target }) {
  const pct = Math.min(100, target > 0 ? (achieved / target) * 100 : 0);
  const over = achieved > target;
  const barColor = over ? '#16a34a' : pct >= 75 ? '#2563eb' : pct >= 40 ? '#d97706' : '#dc2626';

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
          <div style={{ fontSize: '28px', fontWeight: 800, color: barColor }}>{pct.toFixed(1)}%</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>of annual target</div>
        </div>
      </div>

      {/* Bar */}
      <div style={{ background: '#f3f4f6', borderRadius: 999, height: 18, overflow: 'hidden', marginBottom: 12 }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}cc, ${barColor})`,
          borderRadius: 999,
          transition: 'width 0.8s ease'
        }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
        <span style={{ color: barColor, fontWeight: 600 }}>
          {over ? '🎉 Target exceeded!' : `${(100 - pct).toFixed(1)}% remaining`}
        </span>
        <span style={{ color: '#6b7280' }}>{pct.toFixed(1)}% complete</span>
      </div>
    </div>
  );
}

function StatTile({ label, value, sub, accent }) {
  const colors = {
    green: { border: '#16a34a', text: '#15803d' },
    blue: { border: '#2563eb', text: '#1d4ed8' },
    orange: { border: '#d97706', text: '#b45309' },
    red: { border: '#dc2626', text: '#b91c1c' },
    purple: { border: '#7c3aed', text: '#6d28d9' },
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
    paid: { bg: '#d1fae5', color: '#065f46' },
    invoiced: { bg: '#fef3c7', color: '#92400e' },
    completed: { bg: '#dbeafe', color: '#1e40af' },
    ongoing: { bg: '#ede9fe', color: '#5b21b6' },
    planned: { bg: '#f3f4f6', color: '#374151' },
  };
  const s = (status || 'planned').toLowerCase();
  const style = map[s] || map.planned;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: '11px', fontWeight: 700,
      background: style.bg, color: style.color
    }}>
      {status || 'Planned'}
    </span>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

function EmployeeDashboard({ user }) {
  const [target] = useState(ANNUAL_TARGET);
  const [activeTab, setActiveTab] = useState('engagements');

  const allEngagements = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('training_engagements') || '[]'); } catch { return []; }
  }, []);

  // Employees see only their own engagements (filtered by employeeId)
  const engagements = useMemo(() => {
    if (user?.employeeId) {
      return allEngagements.filter(e => e.sourcedBy === user.employeeId);
    }
    return allEngagements;
  }, [allEngagements, user]);

  const trainers = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('trainer_profiles') || '[]'); } catch { return []; }
  }, []);

  const currentYear = new Date().getFullYear();

  // Revenue for current year engagements (net billed)
  const yearRevenue = useMemo(() => {
    return engagements
      .filter(e => {
        const d = new Date(e.startDate || e.dates?.[0] || e.createdAt);
        return !isNaN(d) && d.getFullYear() === currentYear;
      })
      .reduce((sum, e) => sum + parseNet(e), 0);
  }, [engagements, currentYear]);

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

      {/* Target gauge */}
      <TargetGauge achieved={yearRevenue} target={target} />

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
