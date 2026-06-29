import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { financeAPI } from '../../services/api';
import { useFinanceStore } from './financeStore';
import './FinanceIntelligence.css';

const CATEGORY_COLORS = ['#0b7285', '#2b8a3e', '#e67700', '#c92a2a', '#5f3dc4', '#495057', '#1f7a8c'];

function formatINR(value) {
  return `INR ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function FinanceIntelligence() {
  const {
    transactions,
    summary,
    reviewItems,
    uploading,
    page,
    totalPages,
    setUploading,
    setReviewItems,
    setTransactionsPayload,
    setSummary,
    creditCards,
    setCreditCards
  } = useFinanceStore();

  const [error, setError] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [editingRows, setEditingRows] = useState({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState([{ id: 'date', desc: true }]);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashInput, setCashInput] = useState('0');
  const [cardForm, setCardForm] = useState({ bank: '', last4: '', amountDue: '', statementDate: '' });

  const loadFinanceData = useCallback(async (targetPage = 1) => {
    try {
      const [txRes, summaryRes] = await Promise.all([
        financeAPI.getTransactions({ page: targetPage, limit: 50 }),
        financeAPI.getSummary()
      ]);

      setTransactionsPayload(txRes.data);
      setSummary(summaryRes.data);
      setCreditCards(summaryRes.data.cardDues || []);
      setCashInput(String(summaryRes.data.totalCashGiven || 0));
      setError('');
    } catch (loadError) {
      console.error(loadError);
      setError('Unable to load finance intelligence data.');
    }
  }, [setCashInput, setCreditCards, setSummary, setTransactionsPayload]);

  useEffect(() => {
    loadFinanceData(1);
  }, [loadFinanceData]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    const formData = new FormData();
    acceptedFiles.forEach((file) => formData.append('images', file));

    setUploading(true);
    try {
      const res = await financeAPI.uploadImages(formData, false);
      setReviewItems(res.data.reviewItems || []);
      setError(res.data.errors?.length ? `Some files failed: ${res.data.errors.map((e) => e.fileName).join(', ')}` : '');
    } catch (uploadError) {
      console.error(uploadError);
      setError('Upload failed. Please check AI service availability and try again.');
    } finally {
      setUploading(false);
    }
  }, [setReviewItems, setUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    maxFiles: 20
  });

  const filteredTransactions = useMemo(() => {
    const query = globalFilter.trim().toLowerCase();
    if (!query) return transactions;
    return transactions.filter((txn) => {
      const haystack = `${txn.payee || ''} ${txn.note || ''} ${txn.category || ''} ${txn.paymentMethod || ''}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [transactions, globalFilter]);

  const updateField = useCallback((rowId, field, value) => {
    setEditingRows((prev) => ({
      ...prev,
      [rowId]: {
        ...(prev[rowId] || {}),
        [field]: value
      }
    }));
  }, []);

  const saveRow = useCallback(async (row) => {
    const patch = editingRows[row._id];
    if (!patch) return;
    try {
      await financeAPI.updateTransaction(row._id, patch);
      setEditingRows((prev) => {
        const clone = { ...prev };
        delete clone[row._id];
        return clone;
      });
      await loadFinanceData(page);
    } catch (saveError) {
      console.error(saveError);
      setError('Could not save row changes.');
    }
  }, [editingRows, loadFinanceData, page]);

  const deleteRow = useCallback(async (rowId) => {
    try {
      await financeAPI.deleteTransaction(rowId);
      await loadFinanceData(page);
    } catch (deleteError) {
      console.error(deleteError);
      setError('Could not delete transaction.');
    }
  }, [loadFinanceData, page]);

  const addManualRow = useCallback(async () => {
    try {
      await financeAPI.createTransaction({
        date: new Date().toISOString(),
        payee: 'Manual Entry',
        amount: 0,
        note: '',
        category: 'Uncategorised',
        paymentMethod: 'Other',
        source: 'manual'
      });
      await loadFinanceData(1);
    } catch (addError) {
      console.error(addError);
      setError('Could not add manual row.');
    }
  }, [loadFinanceData]);

  const saveReviewedData = useCallback(async () => {
    const flattened = [];
    const rawImageIds = [];

    reviewItems.forEach((item) => {
      rawImageIds.push(item.rawImageId);
      (item.transactions || []).forEach((txn) => flattened.push(txn));
    });

    if (!flattened.length) {
      setError('No reviewed transactions to save.');
      return;
    }

    setSavingReview(true);
    try {
      await financeAPI.saveReviewedTransactions(flattened, rawImageIds);
      setReviewItems([]);
      await loadFinanceData(1);
      setError('');
    } catch (reviewError) {
      console.error(reviewError);
      setError('Could not save reviewed transactions.');
    } finally {
      setSavingReview(false);
    }
  }, [loadFinanceData, reviewItems, setReviewItems]);

  const updateReviewTxn = useCallback((imageIndex, txnIndex, field, value) => {
    setReviewItems((prev) => prev.map((item, i) => {
      if (i !== imageIndex) return item;
      const txns = (item.transactions || []).map((txn, j) => (
        j === txnIndex ? { ...txn, [field]: value } : txn
      ));
      return { ...item, transactions: txns };
    }));
  }, [setReviewItems]);

  const pieData = useMemo(() => {
    return Object.entries(summary.byCategory || {}).map(([name, value]) => ({ name, value }));
  }, [summary.byCategory]);

  const barData = useMemo(() => {
    return Object.entries(summary.byDate || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, value]) => ({ date, spent: value }));
  }, [summary.byDate]);

  const columnHelper = createColumnHelper();
  const columns = useMemo(() => [
    columnHelper.accessor('date', {
      header: 'Date',
      cell: (info) => {
        const row = info.row.original;
        return (
          <input
            className="fi-input fi-input-small"
            type="date"
            value={new Date((editingRows[row._id]?.date || row.date)).toISOString().slice(0, 10)}
            onChange={(e) => updateField(row._id, 'date', e.target.value)}
          />
        );
      }
    }),
    columnHelper.accessor('payee', {
      header: 'Payee',
      cell: (info) => {
        const row = info.row.original;
        return (
          <input
            className="fi-input"
            value={editingRows[row._id]?.payee ?? row.payee ?? ''}
            onChange={(e) => updateField(row._id, 'payee', e.target.value)}
          />
        );
      }
    }),
    columnHelper.accessor('amount', {
      header: 'Amount',
      cell: (info) => {
        const row = info.row.original;
        return (
          <input
            className="fi-input fi-input-small"
            type="number"
            step="0.01"
            value={editingRows[row._id]?.amount ?? row.amount ?? 0}
            onChange={(e) => updateField(row._id, 'amount', Number(e.target.value || 0))}
          />
        );
      }
    }),
    columnHelper.accessor('category', {
      header: 'Category',
      cell: (info) => {
        const row = info.row.original;
        return (
          <input
            className="fi-input"
            value={editingRows[row._id]?.category ?? row.category ?? 'Uncategorised'}
            onChange={(e) => updateField(row._id, 'category', e.target.value)}
          />
        );
      }
    }),
    columnHelper.accessor('paymentMethod', {
      header: 'Method',
      cell: (info) => {
        const row = info.row.original;
        return (
          <select
            className="fi-input"
            value={editingRows[row._id]?.paymentMethod ?? row.paymentMethod ?? 'Other'}
            onChange={(e) => updateField(row._id, 'paymentMethod', e.target.value)}
          >
            <option>UPI</option>
            <option>Credit Card</option>
            <option>Debit Card</option>
            <option>Cash</option>
            <option>Other</option>
          </select>
        );
      }
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const row = info.row.original;
        return (
          <div className="fi-actions">
            <button className="fi-btn fi-btn-primary" type="button" onClick={() => saveRow(row)}>Save</button>
            <button className="fi-btn fi-btn-danger" type="button" onClick={() => deleteRow(row._id)}>Delete</button>
          </div>
        );
      }
    })
  ], [columnHelper, deleteRow, editingRows, saveRow, updateField]);

  const table = useReactTable({
    data: filteredTransactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const submitCash = async () => {
    try {
      await financeAPI.setCash(Number(cashInput || 0));
      setShowCashModal(false);
      await loadFinanceData(page);
    } catch (cashError) {
      console.error(cashError);
      setError('Could not update cash amount.');
    }
  };

  const addCreditCardDue = async (event) => {
    event.preventDefault();
    try {
      await financeAPI.addCreditCard({
        bank: cardForm.bank,
        last4: cardForm.last4,
        amountDue: Number(cardForm.amountDue || 0),
        statementDate: cardForm.statementDate || new Date().toISOString().slice(0, 10),
        status: 'due'
      });
      setCardForm({ bank: '', last4: '', amountDue: '', statementDate: '' });
      await loadFinanceData(page);
    } catch (cardError) {
      console.error(cardError);
      setError('Could not add credit card due.');
    }
  };

  const markCardPaid = async (card) => {
    try {
      await financeAPI.updateCreditCard(card.id, { ...card, status: 'paid' });
      await loadFinanceData(page);
    } catch (markError) {
      console.error(markError);
      setError('Could not mark card as paid.');
    }
  };

  const handleExportPdf = async () => {
    try {
      const res = await financeAPI.exportPdf();
      downloadBlob(res.data, `finance-ledger-${Date.now()}.pdf`);
    } catch (exportError) {
      console.error(exportError);
      setError('PDF export failed.');
    }
  };

  const handleExportExcel = async () => {
    try {
      const res = await financeAPI.exportExcel();
      downloadBlob(res.data, `finance-ledger-${Date.now()}.xlsx`);
    } catch (exportError) {
      console.error(exportError);
      setError('Excel export failed.');
    }
  };

  return (
    <section className="fi-page">
      <header className="fi-header">
        <div>
          <h1>Finance Image Intelligence</h1>
          <p>Upload payment screenshots, review extracted rows, and maintain a clean ledger.</p>
        </div>
        <div className="fi-actions">
          <button className="fi-btn fi-btn-secondary" type="button" onClick={handleExportPdf}>Download PDF</button>
          <button className="fi-btn fi-btn-secondary" type="button" onClick={handleExportExcel}>Download Excel</button>
        </div>
      </header>

      <div className="fi-metrics">
        <article className="fi-card fi-metric">
          <p>Total Spent</p>
          <h3>{formatINR(summary.totalSpent)}</h3>
        </article>
        <article className="fi-card fi-metric">
          <p>Cash Given</p>
          <h3>{formatINR(summary.totalCashGiven)}</h3>
          <button className="fi-link-btn" type="button" onClick={() => setShowCashModal(true)}>Set Cash</button>
        </article>
        <article className="fi-card fi-metric">
          <p>Balance</p>
          <h3 className={summary.balance < 0 ? 'negative' : ''}>{formatINR(summary.balance)}</h3>
        </article>
        <article className="fi-card fi-metric">
          <p>No. of Transactions</p>
          <h3>{summary.transactionsCount || 0}</h3>
        </article>
      </div>

      <article className="fi-card">
        <h3>Upload Images</h3>
        <div {...getRootProps()} className={`fi-dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <p>{uploading ? 'Uploading and extracting...' : 'Drop up to 20 images or click to browse.'}</p>
        </div>
      </article>

      {reviewItems.length > 0 && (
        <article className="fi-card">
          <h3>Review Extracted Data</h3>
          {reviewItems.map((item, itemIndex) => (
            <div key={item.rawImageId} className="fi-review-block">
              <h4>{item.originalName}</h4>
              <table className="fi-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Payee</th>
                    <th>Amount</th>
                    <th>Category</th>
                    <th>Method</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {(item.transactions || []).map((txn, txnIndex) => (
                    <tr key={`${item.rawImageId}-${txnIndex}`} className={Number(txn.confidence || 0) < 0.75 ? 'fi-low-confidence' : ''}>
                      <td>
                        <input
                          className="fi-input fi-input-small"
                          type="date"
                          value={new Date(txn.date || new Date()).toISOString().slice(0, 10)}
                          onChange={(e) => updateReviewTxn(itemIndex, txnIndex, 'date', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="fi-input"
                          value={txn.payee || ''}
                          onChange={(e) => updateReviewTxn(itemIndex, txnIndex, 'payee', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          className="fi-input fi-input-small"
                          type="number"
                          step="0.01"
                          value={txn.amount || 0}
                          onChange={(e) => updateReviewTxn(itemIndex, txnIndex, 'amount', Number(e.target.value || 0))}
                        />
                      </td>
                      <td>
                        <input
                          className="fi-input"
                          value={txn.category || 'Uncategorised'}
                          onChange={(e) => updateReviewTxn(itemIndex, txnIndex, 'category', e.target.value)}
                        />
                      </td>
                      <td>
                        <select
                          className="fi-input"
                          value={txn.paymentMethod || 'Other'}
                          onChange={(e) => updateReviewTxn(itemIndex, txnIndex, 'paymentMethod', e.target.value)}
                        >
                          <option>UPI</option>
                          <option>Credit Card</option>
                          <option>Debit Card</option>
                          <option>Cash</option>
                          <option>Other</option>
                        </select>
                      </td>
                      <td>{Number(txn.confidence || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <button className="fi-btn fi-btn-primary" disabled={savingReview} type="button" onClick={saveReviewedData}>
            {savingReview ? 'Saving...' : 'Save Reviewed Transactions'}
          </button>
        </article>
      )}

      <div className="fi-grid-2">
        <article className="fi-card chart-card">
          <h3>Category Split</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={90} label>
                {pieData.map((entry, index) => (
                  <Cell key={`${entry.name}-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatINR(value)} />
            </PieChart>
          </ResponsiveContainer>
        </article>

        <article className="fi-card chart-card">
          <h3>Spend Timeline</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatINR(value)} />
              <Bar dataKey="spent" fill="#0b7285" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </article>
      </div>

      <article className="fi-card">
        <div className="fi-table-header">
          <h3>Transactions</h3>
          <div className="fi-actions">
            <input
              className="fi-input"
              placeholder="Filter payee, method, category"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
            />
            <button className="fi-btn fi-btn-primary" type="button" onClick={addManualRow}>Add Row</button>
          </div>
        </div>

        <div className="fi-table-wrap">
          <table className="fi-table">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} onClick={header.column.getToggleSortingHandler()}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const source = row.original.source || 'manual';
                const lowConfidence = Number(row.original.confidence || 1) < 0.75;
                return (
                  <tr key={row.id} className={`fi-row-${source === 'image' ? 'image' : 'manual'} ${lowConfidence ? 'fi-low-confidence' : ''}`}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="fi-pagination">
          <button className="fi-btn fi-btn-secondary" disabled={page <= 1} type="button" onClick={() => loadFinanceData(page - 1)}>Prev</button>
          <span>Page {page} / {totalPages}</span>
          <button className="fi-btn fi-btn-secondary" disabled={page >= totalPages} type="button" onClick={() => loadFinanceData(page + 1)}>Next</button>
        </div>
      </article>

      <article className="fi-card">
        <h3>Credit Card Dues</h3>
        <form className="fi-inline-form" onSubmit={addCreditCardDue}>
          <input className="fi-input" placeholder="Bank" value={cardForm.bank} onChange={(e) => setCardForm((prev) => ({ ...prev, bank: e.target.value }))} required />
          <input className="fi-input" placeholder="Last 4 digits" value={cardForm.last4} onChange={(e) => setCardForm((prev) => ({ ...prev, last4: e.target.value }))} required />
          <input className="fi-input" type="number" step="0.01" placeholder="Amount due" value={cardForm.amountDue} onChange={(e) => setCardForm((prev) => ({ ...prev, amountDue: e.target.value }))} required />
          <input className="fi-input" type="date" value={cardForm.statementDate} onChange={(e) => setCardForm((prev) => ({ ...prev, statementDate: e.target.value }))} />
          <button className="fi-btn fi-btn-primary" type="submit">Add Due</button>
        </form>

        <div className="fi-dues-list">
          {creditCards.length === 0 && <p className="fi-muted">No pending card dues.</p>}
          {creditCards.map((card) => (
            <div className="fi-due-item" key={card.id}>
              <div>
                <strong>{card.bank} •••• {card.last4}</strong>
                <p>{formatINR(card.amountDue)}</p>
              </div>
              <button className="fi-btn fi-btn-secondary" type="button" onClick={() => markCardPaid(card)}>Mark Paid</button>
            </div>
          ))}
        </div>
      </article>

      {error && <p className="fi-error">{error}</p>}

      {showCashModal && (
        <div className="fi-modal-backdrop" onClick={() => setShowCashModal(false)}>
          <div className="fi-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Set Cash Given</h3>
            <input className="fi-input" type="number" step="0.01" value={cashInput} onChange={(e) => setCashInput(e.target.value)} />
            <div className="fi-actions">
              <button className="fi-btn fi-btn-secondary" type="button" onClick={() => setShowCashModal(false)}>Cancel</button>
              <button className="fi-btn fi-btn-primary" type="button" onClick={submitCash}>Save</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
