import React from 'react';
import { Link } from 'react-router-dom';

const TONE_STYLE = {
  blue: { borderLeftColor: '#2563eb', color: '#2563eb' },
  green: { borderLeftColor: '#16a34a', color: '#16a34a' },
  red: { borderLeftColor: '#dc2626', color: '#dc2626' },
  amber: { borderLeftColor: '#d97706', color: '#d97706' }
};

function renderCell(column, row) {
  if (typeof column.render === 'function') {
    return column.render(row[column.key], row);
  }
  return row[column.key] ?? '—';
}

function SummaryCards({ items }) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div className="summary-cards dashboard-summary-grid" style={{ marginTop: 16 }}>
      {items.map((item) => {
        const toneStyle = TONE_STYLE[item.tone] || {};
        return (
          <div key={`${item.label}-${item.value}`} className="ops-card summary-card teaching-stat-card" style={{ borderLeftColor: toneStyle.borderLeftColor }}>
            <div className="stat-value" style={{ color: toneStyle.color }}>{item.value}</div>
            <div className="stat-label">{item.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function DetailTable({ table }) {
  if (!table) return null;

  return table.rows?.length ? (
    <div style={{ overflowX: 'auto' }}>
      <table className="ops-table">
        <thead>
          <tr>
            {table.columns.map((column) => (
              <th key={column.label} style={column.align ? { textAlign: column.align } : undefined}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, index) => (
            <tr key={row.id || `${index}-${table.columns[0]?.key || 'row'}`}>
              {table.columns.map((column) => (
                <td key={column.label} style={column.align ? { textAlign: column.align } : undefined}>
                  {renderCell(column, row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="muted" style={{ margin: 0 }}>{table.emptyMessage || 'No rows found.'}</p>
  );
}

export default function InsightDetailPage({ title, description, summaryCards = [], actions = [], sections = [] }) {
  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <Link className="btn btn-secondary" to="/insights">Back to Insights</Link>
      </div>

      <SummaryCards items={summaryCards} />

      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 16 }}>
          {actions.map((action) => (
            <Link key={`${action.label}-${action.to}`} className="btn btn-secondary" to={action.to}>{action.label}</Link>
          ))}
        </div>
      )}

      {sections.map((section) => (
        <div key={section.title} className="ops-card" style={{ marginTop: 16 }}>
          <h3 style={{ margin: '0 0 8px', fontSize: '0.95rem' }}>{section.title}</h3>
          {section.description ? <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: '#6b7280' }}>{section.description}</p> : null}
          <SummaryCards items={section.summaryCards} />
          <DetailTable table={section.table} />
        </div>
      ))}
    </section>
  );
}