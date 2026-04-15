import React, { useMemo, useState } from 'react';

const DEFAULT_TDS_PERCENT = 10;

function fmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
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
    : Number(row.tdsAmount !== undefined ? row.tdsAmount : (gross * DEFAULT_TDS_PERCENT) / 100);
  return Number(row.totalAmount !== undefined ? row.totalAmount : gross - tds);
}

function StatCard({ label, value, color, sub }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '10px',
      padding: '20px 24px',
      minWidth: '180px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)'
    }}>
      <div style={{ fontSize: '13px', color: '#6b7280', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 700, color: color || '#111827' }}>{value}</div>
      {sub && <div style={{ fontSize: '12px', color: '#9ca3af', marginTop: '4px' }}>{sub}</div>}
    </div>
  );
}

function FinancialDashboard() {
  const [activeTab, setActiveTab] = useState('summary');

  const engagements = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('training_engagements') || '[]'); } catch { return []; }
  }, []);

  const settlements = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('trainer_settlements') || '[]'); } catch { return []; }
  }, []);

  // ── Core metrics ─────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalBilled = engagements.reduce((sum, e) => sum + parseEngagementNet(e), 0);

    const paidSettlements = settlements.filter(s => (s.status || '').toLowerCase() === 'paid');
    const trainersPaid = paidSettlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);

    const pendingSettlements = settlements.filter(s => (s.status || '').toLowerCase() !== 'paid');
    const pendingAmount = pendingSettlements.reduce((sum, s) => sum + Number(s.amount || 0), 0);

    const grossMargin = totalBilled - trainersPaid;
    const marginPercent = totalBilled > 0 ? ((grossMargin / totalBilled) * 100).toFixed(1) : '0.0';

    const unpaidEngagements = engagements.filter(e => (e.paymentStatus || 'Invoiced').toLowerCase() !== 'paid');
    const pendingFromOrgs = unpaidEngagements.reduce((sum, e) => sum + parseEngagementNet(e), 0);

    return { totalBilled, trainersPaid, pendingAmount, grossMargin, marginPercent, pendingFromOrgs };
  }, [engagements, settlements]);

  // ── Payouts tab: per-engagement breakdown ─────────────────────────────────
  const payoutRows = useMemo(() => {
    return engagements.map(e => {
      const net = parseEngagementNet(e);
      // Sum settlements linked to this engagement
      const trainerCost = settlements
        .filter(s => s.trainingRecordId === e.id || s.engagementId === e.id)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      return {
        id: e.id,
        college: e.college || e.institution || '—',
        organization: e.organization || '—',
        topic: e.topic || '—',
        startDate: e.startDate || e.dates?.[0] || null,
        net,
        trainerCost,
        margin: net - trainerCost,
        paymentStatus: e.paymentStatus || 'Invoiced'
      };
    });
  }, [engagements, settlements]);

  // ── Margins tab: per-month breakdown ─────────────────────────────────────
  const monthlyMargins = useMemo(() => {
    const byMonth = {};
    engagements.forEach(e => {
      const date = e.startDate || e.dates?.[0];
      if (!date) return;
      const d = new Date(date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      if (!byMonth[key]) byMonth[key] = { key, label, revenue: 0, payout: 0 };
      byMonth[key].revenue += parseEngagementNet(e);
    });
    settlements.filter(s => (s.status || '').toLowerCase() === 'paid').forEach(s => {
      const date = s.paidDate || s.date || s.createdAt;
      if (!date) return;
      const d = new Date(date);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (byMonth[key]) byMonth[key].payout += Number(s.amount || 0);
    });
    return Object.values(byMonth).sort((a, b) => a.key.localeCompare(b.key)).map(m => ({
      ...m,
      margin: m.revenue - m.payout,
      marginPercent: m.revenue > 0 ? ((m.revenue - m.payout) / m.revenue * 100).toFixed(1) : '0.0'
    }));
  }, [engagements, settlements]);

  const { totalBilled, trainersPaid, pendingAmount, grossMargin, marginPercent, pendingFromOrgs } = metrics;

  // ── Per-employee breakdown ────────────────────────────────────────────────
  const employeeRows = useMemo(() => {
    const map = {};
    engagements.forEach(e => {
      const key = e.sourcedBy || '__unassigned__';
      const name = e.sourcedByName || (e.sourcedBy ? e.sourcedBy : 'Unassigned');
      if (!map[key]) map[key] = { employeeId: e.sourcedBy || '', name, count: 0, revenue: 0, trainerCost: 0, paid: 0, pending: 0 };
      const net = parseEngagementNet(e);
      const trainerCost = settlements
        .filter(s => s.trainingRecordId === e.id || s.engagementId === e.id)
        .reduce((sum, s) => sum + Number(s.amount || 0), 0);
      map[key].count += 1;
      map[key].revenue += net;
      map[key].trainerCost += trainerCost;
      if ((e.paymentStatus || '').toLowerCase() === 'paid') map[key].paid += net;
      else map[key].pending += net;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).map(r => ({
      ...r,
      margin: r.revenue - r.trainerCost,
      marginPct: r.revenue > 0 ? ((r.revenue - r.trainerCost) / r.revenue * 100).toFixed(1) : '0.0'
    }));
  }, [engagements, settlements]);

  return (
    <div style={{ padding: '24px', maxWidth: '1100px' }}>
      <h2 style={{ marginBottom: '4px' }}>Financial Reports</h2>
      <p style={{ color: '#6b7280', marginBottom: '24px', fontSize: '14px' }}>
        Restricted to SuperAdmin — margins, payouts, and revenue analytics.
      </p>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <StatCard label="Total Billed to Orgs" value={fmt(totalBilled)} color="#0ea5e9" />
        <StatCard label="Trainer Payouts (Paid)" value={fmt(trainersPaid)} color="#f59e0b" />
        <StatCard label="Pending Settlements" value={fmt(pendingAmount)} color="#ef4444" sub={`${settlements.filter(s => (s.status||'').toLowerCase() !== 'paid').length} settlement(s)`} />
        <StatCard label="Gross Margin" value={fmt(grossMargin)} color={grossMargin >= 0 ? '#10b981' : '#ef4444'} />
        <StatCard label="Margin %" value={`${marginPercent}%`} color="#7c3aed" />
        <StatCard label="Pending from Orgs" value={fmt(pendingFromOrgs)} color="#ef4444" sub={`${engagements.filter(e => (e.paymentStatus||'Invoiced').toLowerCase() !== 'paid').length} engagement(s) unpaid`} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {['summary', 'payouts', 'margins', 'employees'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: '1px solid #d1d5db',
              background: activeTab === tab ? '#7c3aed' : '#fff',
              color: activeTab === tab ? '#fff' : '#374151',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400,
              textTransform: 'capitalize'
            }}
          >
            {tab === 'employees' ? 'By Employee' : tab}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div style={{ background: '#f9fafb', borderRadius: '10px', padding: '20px', fontSize: '14px', color: '#374151', lineHeight: 1.8 }}>
          <p><strong>Engagements:</strong> {engagements.length} total, {engagements.filter(e => (e.paymentStatus||'').toLowerCase() === 'paid').length} paid by org</p>
          <p><strong>Settlements:</strong> {settlements.length} total, {settlements.filter(s => (s.status||'').toLowerCase() === 'paid').length} paid to trainers</p>
          <p><strong>Recovery rate:</strong> {totalBilled > 0 ? ((engagements.filter(e => (e.paymentStatus||'').toLowerCase() === 'paid').reduce((s,e) => s + parseEngagementNet(e), 0) / totalBilled * 100).toFixed(1)) : '0'}% of billed amount received from organizations</p>
        </div>
      )}

      {/* Payouts tab */}
      {activeTab === 'payouts' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['College / Org', 'Topic', 'Date', 'Billed (Net)', 'Trainer Cost', 'Margin', 'Org Payment'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payoutRows.map((p, i) => (
                <tr key={p.id || i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px' }}>{p.college}</td>
                  <td style={{ padding: '10px 12px' }}>{p.topic}</td>
                  <td style={{ padding: '10px 12px', color: '#6b7280' }}>{p.startDate ? new Date(p.startDate).toLocaleDateString('en-IN') : '—'}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea5e9', fontWeight: 600 }}>{fmt(p.net)}</td>
                  <td style={{ padding: '10px 12px', color: '#f59e0b', fontWeight: 600 }}>{fmt(p.trainerCost)}</td>
                  <td style={{ padding: '10px 12px', color: p.margin >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(p.margin)}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                      background: p.paymentStatus.toLowerCase() === 'paid' ? '#d1fae5' : '#fef3c7',
                      color: p.paymentStatus.toLowerCase() === 'paid' ? '#065f46' : '#92400e'
                    }}>{p.paymentStatus}</span>
                  </td>
                </tr>
              ))}
              {payoutRows.length === 0 && (
                <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No engagement data found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Monthly margins tab */}
      {activeTab === 'margins' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Month', 'Revenue Billed', 'Trainer Payout', 'Gross Margin', 'Margin %'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthlyMargins.map(m => (
                <tr key={m.key} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{m.label}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea5e9' }}>{fmt(m.revenue)}</td>
                  <td style={{ padding: '10px 12px', color: '#f59e0b' }}>{fmt(m.payout)}</td>
                  <td style={{ padding: '10px 12px', color: m.margin >= 0 ? '#10b981' : '#ef4444', fontWeight: 600 }}>{fmt(m.margin)}</td>
                  <td style={{ padding: '10px 12px', color: '#7c3aed', fontWeight: 600 }}>{m.marginPercent}%</td>
                </tr>
              ))}
              {monthlyMargins.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No margin data available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Per-employee breakdown tab */}
      {activeTab === 'employees' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['Employee ID', 'Name', 'Engagements', 'Total Billed', 'Trainer Cost', 'Gross Margin', 'Margin %', 'Paid by Org', 'Pending'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {employeeRows.map((r, i) => (
                <tr key={r.employeeId || i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={{ padding: '10px 12px' }}>
                    {r.employeeId
                      ? <span style={{ fontWeight: 700, color: '#7c3aed', background: '#ede9fe', borderRadius: 4, padding: '2px 8px' }}>{r.employeeId}</span>
                      : <span style={{ color: '#9ca3af', fontStyle: 'italic' }}>Unassigned</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.count}</td>
                  <td style={{ padding: '10px 12px', color: '#0ea5e9', fontWeight: 600 }}>{fmt(r.revenue)}</td>
                  <td style={{ padding: '10px 12px', color: '#f59e0b' }}>{fmt(r.trainerCost)}</td>
                  <td style={{ padding: '10px 12px', color: r.margin >= 0 ? '#10b981' : '#ef4444', fontWeight: 700 }}>{fmt(r.margin)}</td>
                  <td style={{ padding: '10px 12px', color: '#7c3aed', fontWeight: 600 }}>{r.marginPct}%</td>
                  <td style={{ padding: '10px 12px', color: '#16a34a' }}>{fmt(r.paid)}</td>
                  <td style={{ padding: '10px 12px', color: '#dc2626' }}>{fmt(r.pending)}</td>
                </tr>
              ))}
              {employeeRows.length === 0 && (
                <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>No engagements with employee assignment found.</td></tr>
              )}
            </tbody>
          </table>
          {employeeRows.length > 0 && (
            <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: 12 }}>
              Engagements without a "Sourced By" employee are grouped under Unassigned.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default FinancialDashboard;
