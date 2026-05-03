import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { expenseAPI } from '../../services/api';
import './Expenses.css';

const DEFAULT_FORM = {
  id: '',
  title: '',
  amount: '',
  category: 'Food',
  date: new Date().toISOString().split('T')[0],
  description: '',
  entryType: 'expense',
  expenseScope: 'general',
  paymentState: 'paid',
  dueDate: '',
  paidDate: '',
  outstandingAmount: '',
  linkedEngagementId: '',
  linkedTrainerName: '',
  paymentMethod: ''
};

function toInr(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function ExpenseList() {
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [paymentStateFilter, setPaymentStateFilter] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(DEFAULT_FORM);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async () => {
    try {
      const res = await expenseAPI.getAll();
      setExpenses(res.data);
      setError('');
      setLoading(false);
    } catch (err) {
      console.error('Error loading expenses:', err);
      setError('Failed to load expenses.');
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData(DEFAULT_FORM);
    setShowForm(false);
  };

  const startCreate = () => {
    setFormData(DEFAULT_FORM);
    setShowForm(true);
  };

  const startEdit = (expense) => {
    setFormData({
      id: expense._id,
      title: expense.title || '',
      amount: expense.amount ?? '',
      category: expense.category || 'Food',
      date: expense.date ? new Date(expense.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: expense.description || '',
      entryType: expense.entryType || 'expense',
      expenseScope: expense.expenseScope || 'general',
      paymentState: expense.paymentState || 'paid',
      dueDate: expense.dueDate ? new Date(expense.dueDate).toISOString().split('T')[0] : '',
      paidDate: expense.paidDate ? new Date(expense.paidDate).toISOString().split('T')[0] : '',
      outstandingAmount: expense.outstandingAmount ?? '',
      linkedEngagementId: expense.linkedEngagementId || '',
      linkedTrainerName: expense.linkedTrainerName || '',
      paymentMethod: expense.paymentMethod || ''
    });
    setShowForm(true);
  };

  const onField = (key, value) => {
    setFormData((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'paymentState' && value === 'paid') {
        next.outstandingAmount = '0';
        if (!next.paidDate) next.paidDate = new Date().toISOString().split('T')[0];
      }
      if (key === 'entryType' && value === 'expense' && next.paymentState === 'pending') {
        next.paymentState = 'paid';
      }
      return next;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      title: formData.title.trim(),
      amount: Number(formData.amount || 0),
      category: formData.category,
      date: formData.date,
      description: formData.description,
      entryType: formData.entryType,
      expenseScope: formData.expenseScope,
      paymentState: formData.paymentState,
      dueDate: formData.dueDate || undefined,
      paidDate: formData.paidDate || undefined,
      outstandingAmount: Number(formData.outstandingAmount || 0),
      linkedEngagementId: formData.linkedEngagementId,
      linkedTrainerName: formData.linkedTrainerName,
      paymentMethod: formData.paymentMethod
    };

    if (!payload.title || payload.amount < 0) {
      setSaving(false);
      setError('Please enter a valid title and amount.');
      return;
    }

    try {
      if (formData.id) {
        await expenseAPI.update(formData.id, payload);
      } else {
        await expenseAPI.create(payload);
      }
      await loadExpenses();
      resetForm();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save expense record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this expense?')) {
      try {
        await expenseAPI.delete(id);
        setExpenses(expenses.filter(expense => expense._id !== id));
      } catch (err) {
        console.error('Error deleting expense:', err);
      }
    }
  };

  const filteredExpenses = expenses.filter((expense) => {
    const categoryOk = filter === 'all' || expense.category === filter;
    const entryType = expense.entryType || 'expense';
    const typeOk = typeFilter === 'all' || entryType === typeFilter;
    const paymentState = expense.paymentState || 'paid';
    const paymentOk = paymentStateFilter === 'all' || paymentState === paymentStateFilter;
    return categoryOk && typeOk && paymentOk;
  });

  const totals = filteredExpenses.reduce((acc, item) => {
    const amount = Number(item.amount || 0);
    const outstanding = Number(item.outstandingAmount || 0);
    acc.total += amount;
    acc.outstanding += outstanding;
    if ((item.entryType || 'expense') === 'credit_card_bill') acc.creditCard += amount;
    if ((item.entryType || 'expense') === 'debt') acc.debt += amount;
    return acc;
  }, { total: 0, outstanding: 0, creditCard: 0, debt: 0 });

  if (loading) {
    return (
      <div className="loading d-flex align-items-center gap-2">
        <FontAwesomeIcon icon="fa-solid fa-spinner" className="fa-spin" />
        Loading expenses...
      </div>
    );
  }

  return (
    <div className="container">
      <div className="expenses-header">
        <h1><FontAwesomeIcon icon="fa-solid fa-receipt" className="me-2" style={{ color: '#423fdb' }} />Expenses</h1>
        <div className="filter-group" style={{ flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={startCreate}>
            <FontAwesomeIcon icon="fa-solid fa-plus" className="me-2" />Add Expense / Debt
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/upload-receipt')}>
            <FontAwesomeIcon icon="fa-solid fa-upload" className="me-2" />Upload Receipts
          </button>
          <span className="d-inline-flex align-items-center gap-1 text-secondary">
            <FontAwesomeIcon icon="fa-solid fa-filter" />
            <label htmlFor="filter" className="mb-0">Category:</label>
          </span>
          <select 
            id="filter"
            className="form-control filter-select" 
            value={filter} 
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Food">Food</option>
            <option value="Transport">Transport</option>
            <option value="Entertainment">Entertainment</option>
            <option value="Shopping">Shopping</option>
            <option value="Bills">Bills</option>
            <option value="Healthcare">Healthcare</option>
            <option value="Other">Other</option>
          </select>
          <label htmlFor="typeFilter" className="mb-0">Type:</label>
          <select
            id="typeFilter"
            className="form-control filter-select"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="expense">Expense</option>
            <option value="debt">Debt</option>
            <option value="credit_card_bill">Credit Card Bill</option>
          </select>
          <label htmlFor="paymentStateFilter" className="mb-0">Payment:</label>
          <select
            id="paymentStateFilter"
            className="form-control filter-select"
            value={paymentStateFilter}
            onChange={(e) => setPaymentStateFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="paid">Paid</option>
          </select>
        </div>
      </div>

      {showForm && (
        <div className="card add-expense-card" style={{ marginBottom: 16 }}>
          <h2 style={{ marginTop: 0 }}>{formData.id ? 'Edit Record' : 'Add Expense / Debt / Credit Card Bill'}</h2>
          <form onSubmit={handleSave}>
            <div className="expense-form-grid">
              <div className="form-group">
                <label htmlFor="title">Title</label>
                <input id="title" className="form-control" value={formData.title} onChange={(e) => onField('title', e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="amount">Amount (₹)</label>
                <input id="amount" type="number" min="0" step="0.01" className="form-control" value={formData.amount} onChange={(e) => onField('amount', e.target.value)} required />
              </div>
              <div className="form-group">
                <label htmlFor="entryType">Record Type</label>
                <select id="entryType" className="form-control" value={formData.entryType} onChange={(e) => onField('entryType', e.target.value)}>
                  <option value="expense">Expense</option>
                  <option value="debt">Debt</option>
                  <option value="credit_card_bill">Credit Card Bill</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="expenseScope">Scope</label>
                <select id="expenseScope" className="form-control" value={formData.expenseScope} onChange={(e) => onField('expenseScope', e.target.value)}>
                  <option value="general">General</option>
                  <option value="trainer_settlement">Trainer Settlement Payout</option>
                  <option value="trainer_hotel">Trainer Hotel</option>
                  <option value="trainer_food">Trainer Food</option>
                  <option value="trainer_travel">Trainer Travel</option>
                  <option value="trainer_other">Trainer Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="category">Category</label>
                <select id="category" className="form-control" value={formData.category} onChange={(e) => onField('category', e.target.value)}>
                  <option value="Food">Food</option>
                  <option value="Transport">Transport</option>
                  <option value="Entertainment">Entertainment</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Bills">Bills</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="date">Booked Date</label>
                <input id="date" type="date" className="form-control" value={formData.date} onChange={(e) => onField('date', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="paymentState">Payment State</label>
                <select id="paymentState" className="form-control" value={formData.paymentState} onChange={(e) => onField('paymentState', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="partially_paid">Partially Paid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="outstandingAmount">Outstanding Amount (₹)</label>
                <input id="outstandingAmount" type="number" min="0" step="0.01" className="form-control" value={formData.outstandingAmount} onChange={(e) => onField('outstandingAmount', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="dueDate">Due Date</label>
                <input id="dueDate" type="date" className="form-control" value={formData.dueDate} onChange={(e) => onField('dueDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="paidDate">Paid Date</label>
                <input id="paidDate" type="date" className="form-control" value={formData.paidDate} onChange={(e) => onField('paidDate', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="linkedTrainerName">Trainer Name (optional)</label>
                <input id="linkedTrainerName" className="form-control" value={formData.linkedTrainerName} onChange={(e) => onField('linkedTrainerName', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="linkedEngagementId">Linked Engagement ID (optional)</label>
                <input id="linkedEngagementId" className="form-control" value={formData.linkedEngagementId} onChange={(e) => onField('linkedEngagementId', e.target.value)} />
              </div>
              <div className="form-group">
                <label htmlFor="paymentMethod">Payment Method</label>
                <input id="paymentMethod" className="form-control" value={formData.paymentMethod} onChange={(e) => onField('paymentMethod', e.target.value)} placeholder="Credit Card, UPI, Cash..." />
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="description">Description</label>
                <textarea id="description" rows="3" className="form-control" value={formData.description} onChange={(e) => onField('description', e.target.value)} />
              </div>
            </div>
            {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving
                  ? <><FontAwesomeIcon icon="fa-solid fa-spinner" className="fa-spin me-2" />Saving...</>
                  : <><FontAwesomeIcon icon="fa-solid fa-check" className="me-2" />{formData.id ? 'Update Record' : 'Create Record'}</>}
              </button>
              <button className="btn btn-secondary" type="button" onClick={resetForm}>
                <FontAwesomeIcon icon="fa-solid fa-xmark" className="me-2" />Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="summary-cards" style={{ marginBottom: 14 }}>
        <div className="ops-card stat-card">
          <h3>{toInr(totals.total)}</h3>
          <p><FontAwesomeIcon icon="fa-solid fa-sack-dollar" className="me-1" />Total Amount</p>
        </div>
        <div className="ops-card stat-card pending">
          <h3>{toInr(totals.outstanding)}</h3>
          <p><FontAwesomeIcon icon="fa-solid fa-triangle-exclamation" className="me-1" />Total Outstanding</p>
        </div>
        <div className="ops-card stat-card">
          <h3>{toInr(totals.creditCard)}</h3>
          <p><FontAwesomeIcon icon="fa-solid fa-credit-card" className="me-1" />Credit Card Bills</p>
        </div>
        <div className="ops-card stat-card">
          <h3>{toInr(totals.debt)}</h3>
          <p><FontAwesomeIcon icon="fa-solid fa-coins" className="me-1" />Debt Records</p>
        </div>
      </div>

      <div className="smt-container">
        {filteredExpenses.length > 0 ? (
          <>
            <div className="smt-header">
              <div>Description</div>
              <div>Category</div>
              <div>Date</div>
              <div>Amount</div>
              <div>Status</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>
            <div>
              {filteredExpenses.map((expense) => {
                const isPaid = expense.paymentState === 'paid';
                const isPending = expense.paymentState === 'pending';
                const statusClass = isPaid ? 'active' : isPending ? 'inactive' : 'paused';
                
                return (
                <div key={expense._id} className="smt-row">
                  <div className={`smt-gradient-overlay smt-gradient-${statusClass}`}></div>
                  
                  <div className="smt-cell smt-title">
                    <div className="smt-icon" style={{ background: expense.entryType === 'debt' ? '#f59e0b' : expense.entryType === 'credit_card_bill' ? '#8b5cf6' : '#3b82f6' }}>
                      <FontAwesomeIcon icon={expense.entryType === 'debt' ? 'fa-solid fa-coins' : expense.entryType === 'credit_card_bill' ? 'fa-solid fa-credit-card' : 'fa-solid fa-receipt'} />
                    </div>
                    <div>
                      {expense.title}
                      {expense.description && <span className="smt-subtitle">{expense.description}</span>}
                    </div>
                  </div>
                  
                  <div className="smt-cell">
                    <span className={`category-badge ${expense.category.toLowerCase()}`}>{expense.category}</span>
                  </div>
                  
                  <div className="smt-cell">
                    <div style={{ color: '#0f172a', fontWeight: 500 }}>{new Date(expense.date).toLocaleDateString()}</div>
                    {expense.dueDate && <div className="smt-subtitle">Due: {new Date(expense.dueDate).toLocaleDateString()}</div>}
                  </div>
                  
                  <div className="smt-cell">
                    <div className="smt-amount">{toInr(expense.amount)}</div>
                    {Number(expense.outstandingAmount || 0) > 0 && (
                      <div className="smt-subtitle" style={{ color: '#dc2626', fontWeight: 600 }}>O/S: {toInr(expense.outstandingAmount)}</div>
                    )}
                  </div>
                  
                  <div className="smt-cell">
                    <span className={`smt-badge smt-badge-${statusClass}`}>
                      {(expense.paymentState || 'paid').replace(/_/g, ' ')}
                    </span>
                  </div>
                  
                  <div className="smt-cell smt-actions" style={{ justifyContent: 'flex-end' }}>
                    <button onClick={() => startEdit(expense)} className="btn btn-secondary btn-sm" style={{ padding: '6px 10px' }} title="Edit">
                      <FontAwesomeIcon icon="fa-solid fa-pencil" />
                    </button>
                    <button onClick={() => handleDelete(expense._id)} className="btn btn-danger btn-sm" style={{ padding: '6px 10px' }} title="Delete">
                      <FontAwesomeIcon icon="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </>
        ) : (
          <p className="no-data">No expenses found</p>
        )}
      </div>
    </div>
  );
}

export default ExpenseList;
