import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { expenseAPI } from '../../services/api';

const CATEGORIES = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Other'];
const QUICK_AMOUNTS = [4000, 3500, 5000];

function parseDailyLogLink(description) {
  const match = (description || '').match(/DailyLogId:(\d+)/i);
  return match ? match[1] : null;
}

function parsePaymentStatus(description) {
  const tagged = (description || '').match(/PaymentStatus:(pending|received)/i);
  if (tagged) {
    return tagged[1].toLowerCase();
  }
  return (description || '').toLowerCase().includes('pending') ? 'pending' : 'received';
}

function parseAmountFromText(text) {
  const normalized = (text || '').toLowerCase().replace(/,/g, '');
  const match = normalized.match(/(?:rs\.?|inr|₹)?\s*(\d+(?:\.\d+)?)\s*(k)?/i);
  if (!match) {
    return null;
  }
  const base = Number(match[1]);
  if (Number.isNaN(base)) {
    return null;
  }
  return match[2] ? base * 1000 : base;
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function Finance() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [form, setForm] = useState({
    title: '',
    amount: '',
    quickAmount: 'custom',
    statement: '',
    category: 'Other',
    dueDate: new Date().toISOString().slice(0, 10),
    status: 'received',
    description: ''
  });

  const mapExpenseToFinance = (item, index) => ({
    id: item._id || index,
    title: item.title || 'Untitled',
    source: item.category || 'other',
    amount: Number(item.amount || 0),
    status: parsePaymentStatus(item.description),
    dueDate: item.date,
    description: item.description || '',
    linkedDailyLogId: parseDailyLogLink(item.description)
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await expenseAPI.getAll();
      const normalized = res.data.map(mapExpenseToFinance);
      setRecords(normalized);
      setError('');
    } catch (loadError) {
      console.error('Error loading finance records:', loadError);
      setError('Unable to load finance records right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const statementAmount = useMemo(() => parseAmountFromText(form.statement), [form.statement]);
  const numericAmount = Number(form.amount || 0);
  const hasMismatch = statementAmount !== null && numericAmount > 0 && statementAmount !== numericAmount;

  const summary = useMemo(() => {
    const total = records.reduce((sum, item) => sum + item.amount, 0);
    const pending = records.filter((item) => item.status === 'pending').reduce((sum, item) => sum + item.amount, 0);
    const received = records.filter((item) => item.status === 'received').reduce((sum, item) => sum + item.amount, 0);
    return { total, pending, received };
  }, [records]);

  if (loading) {
    return <div className="loading">Loading finance dashboard...</div>;
  }

  const resetForm = () => {
    setEditingId('');
    setForm({
      title: '',
      amount: '',
      quickAmount: 'custom',
      statement: '',
      category: 'Other',
      dueDate: new Date().toISOString().slice(0, 10),
      status: 'received',
      description: ''
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.title || !form.amount || Number(form.amount) < 0) {
      setError('Title and non-negative amount are required.');
      return;
    }

    const statementTag = form.statement ? ` Statement:${form.statement}` : '';
    const descriptionWithStatus = `${form.description || ''}${statementTag} PaymentStatus:${form.status}`.trim();
    const payload = {
      title: form.title,
      amount: Number(form.amount),
      category: form.category,
      date: form.dueDate,
      description: descriptionWithStatus
    };

    try {
      if (editingId) {
        await expenseAPI.update(editingId, payload);
      } else {
        await expenseAPI.create(payload);
      }
      await loadRecords();
      resetForm();
      setError('');
    } catch (submitError) {
      console.error('Finance save failed:', submitError);
      setError('Could not save record. Check all required fields and try again.');
    }
  };

  const handleEdit = (record) => {
    const extractedStatement = ((record.description || '').match(/Statement:(.*?)\s+PaymentStatus:/i)?.[1] || '').trim();
    const cleanedDescription = (record.description || '')
      .replace(/\s*Statement:.*?\s+PaymentStatus:/i, ' ')
      .replace(/\s*PaymentStatus:(pending|received)/i, '')
      .trim();

    setEditingId(record.id);
    setForm({
      title: record.title,
      amount: String(record.amount),
      quickAmount: QUICK_AMOUNTS.includes(record.amount) ? String(record.amount) : 'custom',
      statement: extractedStatement,
      category: CATEGORIES.includes(record.source) ? record.source : 'Other',
      dueDate: new Date(record.dueDate).toISOString().slice(0, 10),
      status: record.status,
      description: cleanedDescription
    });
  };

  const handleDelete = async (record) => {
    if (record.linkedDailyLogId) {
      const proceed = window.confirm(
        `This finance record is linked to Daily Log ${record.linkedDailyLogId}. Deleting it can break day-level history in Calendar and Insights. Delete anyway?`
      );
      if (!proceed) {
        return;
      }
    } else {
      const proceed = window.confirm('Delete this finance record permanently?');
      if (!proceed) {
        return;
      }
    }

    try {
      await expenseAPI.delete(record.id);
      await loadRecords();
    } catch (deleteError) {
      console.error('Finance delete failed:', deleteError);
      setError('Unable to delete this record right now.');
    }
  };

  const handleMarkAllPendingReceived = async () => {
    const pendingRecords = records.filter((item) => item.status === 'pending');
    if (pendingRecords.length === 0) {
      setError('No pending records to update.');
      return;
    }

    const proceed = window.confirm(`Update ${pendingRecords.length} pending records to received?`);
    if (!proceed) {
      return;
    }

    try {
      await Promise.all(
        pendingRecords.map((record) => {
          const cleanedDescription = (record.description || '').replace(/\s*PaymentStatus:(pending|received)/i, '').trim();
          return expenseAPI.update(record.id, {
            title: record.title,
            amount: record.amount,
            category: CATEGORIES.includes(record.source) ? record.source : 'Other',
            date: new Date(record.dueDate).toISOString(),
            description: `${cleanedDescription} PaymentStatus:received`.trim()
          });
        })
      );
      await loadRecords();
      setError('');
    } catch (bulkError) {
      console.error('Bulk pending update failed:', bulkError);
      setError('Bulk status update failed.');
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Finance</h1>
        <p>Track and manage cash movement with full create, retrieve, update, and delete controls.</p>
      </div>

      <article className="ops-card">
        <h3>{editingId ? 'Update Finance Record' : 'Create Finance Record'}</h3>
        <div className="inline-actions finance-ops-actions">
          <button className="btn btn-secondary" type="button" onClick={loadRecords}>Refresh Records</button>
          <button className="btn btn-primary" type="button" onClick={handleMarkAllPendingReceived}>
            Mark All Pending as Received
          </button>
        </div>
        <form onSubmit={handleSubmit} className="structured-grid">
          <label>
            Title
            <input
              className="form-control"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              required
            />
          </label>

          <label>
            Amount
            <input
              className="form-control"
              type="number"
              min="0"
              value={form.amount}
              onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
              required
            />
          </label>

          <label>
            Quick Amount (INR)
            <select
              className="form-control"
              value={form.quickAmount}
              onChange={(e) => {
                const nextQuick = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  quickAmount: nextQuick,
                  amount: nextQuick === 'custom' ? prev.amount : String(Number(nextQuick))
                }));
              }}
            >
              <option value="custom">Custom Value</option>
              {QUICK_AMOUNTS.map((item) => (
                <option key={item} value={String(item)}>{formatINR(item)}</option>
              ))}
            </select>
          </label>

          <label>
            Money Statement
            <input
              className="form-control"
              placeholder="Received ₹5000 from vendor"
              value={form.statement}
              onChange={(e) => {
                const nextStatement = e.target.value;
                const parsed = parseAmountFromText(nextStatement);
                setForm((prev) => ({
                  ...prev,
                  statement: nextStatement,
                  amount: parsed !== null ? String(parsed) : prev.amount,
                  quickAmount: QUICK_AMOUNTS.includes(parsed || -1) ? String(parsed) : 'custom'
                }));
              }}
            />
          </label>

          <label>
            Category
            <select
              className="form-control"
              value={form.category}
              onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>

          <label>
            Date
            <input
              className="form-control"
              type="date"
              value={form.dueDate}
              onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              required
            />
          </label>

          <label>
            Status
            <select
              className="form-control"
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            >
              <option value="received">Received</option>
              <option value="pending">Pending</option>
            </select>
          </label>

          <label>
            Notes
            <input
              className="form-control"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </label>

          <div className="inline-actions">
            <button className="btn btn-primary" type="submit">{editingId ? 'Update' : 'Create'}</button>
            {editingId && (
              <button className="btn btn-secondary" type="button" onClick={resetForm}>Cancel Edit</button>
            )}
          </div>
        </form>
        {statementAmount !== null && (
          <p className={hasMismatch ? 'error' : 'success'}>
            Statement amount: {formatINR(statementAmount)} | Selected amount: {formatINR(numericAmount)}
          </p>
        )}
        {error && <p className="error">{error}</p>}
      </article>

      <div className="summary-cards">
        <article className="ops-card stat-card">
          <p>Total Earnings</p>
          <h3>{formatINR(summary.total)}</h3>
        </article>
        <article className="ops-card stat-card pending">
          <p>Pending</p>
          <h3>{formatINR(summary.pending)}</h3>
        </article>
        <article className="ops-card stat-card received">
          <p>Received</p>
          <h3>{formatINR(summary.received)}</h3>
        </article>
      </div>

      <article className="ops-card">
        <h3>Payment Timeline</h3>
        <div className="table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Source</th>
                <th>Title</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Due Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 && (
                <tr>
                  <td colSpan="6" className="muted">No finance records yet.</td>
                </tr>
              )}
              {records.map((record) => (
                <tr key={record.id}>
                  <td>{record.source}</td>
                  <td>
                    {record.title}
                    {record.linkedDailyLogId && (
                      <div className="muted">Linked to Daily Log {record.linkedDailyLogId}</div>
                    )}
                  </td>
                  <td>{formatINR(record.amount)}</td>
                  <td>
                    <span className={`status-pill ${record.status}`}>{record.status}</span>
                  </td>
                  <td>{new Date(record.dueDate).toLocaleDateString()}</td>
                  <td>
                    <div className="inline-actions">
                      <button className="btn btn-secondary" type="button" onClick={() => handleEdit(record)}>
                        Edit
                      </button>
                      <button className="btn btn-danger" type="button" onClick={() => handleDelete(record)}>
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
    </section>
  );
}

export default Finance;
