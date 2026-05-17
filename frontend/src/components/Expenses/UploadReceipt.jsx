import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { processedDataAPI } from '../../services/api';
import './UploadReceipt.css';

function UploadReceipt() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [extractedExpenses, setExtractedExpenses] = useState([]);
  const [error, setError] = useState('');
  const [processedHistory, setProcessedHistory] = useState([]);
  const [showCompactView, setShowCompactView] = useState(true);
  const navigate = useNavigate();

  const categories = ['Food', 'Transport', 'Entertainment', 'Shopping', 'Bills', 'Healthcare', 'Other'];

  const fetchProcessedData = async () => {
    try {
      const token = localStorage.getItem('token');
      const resp = await processedDataAPI.getAll();
      setProcessedHistory(resp.data.items || []);
      if ((resp.data.items || []).length === 0) {
        alert('No processed records found');
      }
    } catch (err) {
      console.error('Error fetching processed data', err);
      setError('Failed to load processed data');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError('');
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      setError('Please select at least one image');
      return;
    }

    setUploading(true);
    setError('');

    const formData = new FormData();
    files.forEach(file => {
      formData.append('receipts', file);
    });

    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/ocr/upload', formData, {
        headers: {
          'x-auth-token': token
        }
      });

      // Expand aggregated rawText into separate rows if backend returned a single combined expense
      const expanded = [];
      const amountRegex = /[₹$¥€£]?\s*([0-9][0-9,\.\s]*)/;

      for (const exp of response.data.expenses) {
        // If rawText contains multiple lines and there is only a single expense returned,
        // split by newline and create one entry per line that contains an amount.
        const raw = exp.rawText || '';
        const lines = raw.split('\n').map(l => l.trim()).filter(l => l);

        if (lines.length > 1 && response.data.expenses.length === 1) {
          for (const line of lines) {
            const m = line.match(amountRegex);
            if (m) {
              const amtRaw = m[1].replace(/[,\s]/g, '');
              const amt = Number(amtRaw) || 0;
              const title = line.replace(amountRegex, '').replace(/[:\-#]+$/, '').trim() || exp.title || 'Item';
              expanded.push({
                ...exp,
                title,
                amount: amt,
                date: exp.date || new Date().toISOString().split('T')[0],
                ignore: false,
                saveDuplicate: false,
                rawText: line
              });
            }
          }
        } else {
          expanded.push({
            ...exp,
            date: exp.date ? new Date(exp.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            ignore: false,
            saveDuplicate: false
          });
        }
      }

      setExtractedExpenses(expanded);
      
      if (response.data.errors.length > 0) {
        setError(`Some images failed to process: ${response.data.errors.map(e => e.fileName).join(', ')}`);
      }

      setProcessing(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Error uploading images');
    } finally {
      setUploading(false);
    }
  };

  const handleExpenseChange = (index, field, value) => {
    const updated = [...extractedExpenses];
    updated[index][field] = value;
    setExtractedExpenses(updated);
  };

  const handleToggleIgnore = (index) => {
    const updated = [...extractedExpenses];
    updated[index].ignore = !updated[index].ignore;
    setExtractedExpenses(updated);
  };

  const handleToggleSaveDuplicate = (index) => {
    const updated = [...extractedExpenses];
    updated[index].saveDuplicate = !updated[index].saveDuplicate;
    setExtractedExpenses(updated);
  };

  // Add function to handle quantity updates
  const handleQuantityChange = (index, quantity) => {
    const updated = [...extractedExpenses];
    updated[index].quantity = Math.max(1, quantity);
    // Recalculate total if unit price exists
    if (updated[index].aiInsights?.unitPrice) {
      updated[index].amount = updated[index].quantity * updated[index].aiInsights.unitPrice;
    }
    setExtractedExpenses(updated);
  };

  const handleSaveAll = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post('/api/ocr/save', 
        { expenses: extractedExpenses },
        {
          headers: {
            'x-auth-token': token,
            'Content-Type': 'application/json'
          }
        }
      );

      alert('Expenses saved successfully!');
      navigate('/expenses');
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving expenses');
    }
  };

  const handleCancel = () => {
    setFiles([]);
    setExtractedExpenses([]);
    setProcessing(false);
    setError('');
  };

  return (
    <div className="container">
      <h1>📷 Upload Receipt Images</h1>

      {!processing ? (
        <div className="card upload-section">
          <h3>Select Receipt Images</h3>
          <p className="info-text">
            Upload images of receipts to automatically extract expense data. 
            Supports JPG, PNG, GIF formats. Maximum 10 images at once.
          </p>
          
          <div className="file-input-wrapper">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="file-input"
              id="receipt-upload"
            />
            <label htmlFor="receipt-upload" className="file-input-label">
              {files.length > 0 ? `${files.length} image(s) selected` : 'Choose Images'}
            </label>
          </div>

          {files.length > 0 && (
            <div className="file-list">
              <h4>Selected Files:</h4>
              <ul>
                {files.map((file, index) => (
                  <li key={index}>{file.name} ({(file.size / 1024).toFixed(2)} KB)</li>
                ))}
              </ul>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <button 
            onClick={handleUpload} 
            disabled={uploading || files.length === 0}
            className="btn btn-primary btn-large"
          >
            {uploading ? 'Processing Images...' : 'Upload & Extract Data'}
          </button>
        </div>
      ) : (
        <div className="review-section">
          <div className="review-header">
            <h3>📋 Review Extracted Expenses ({extractedExpenses.filter(e => !e.ignore).length} to save)</h3>
            <div className="review-actions">
              <button onClick={fetchProcessedData} className="btn btn-link">Load Processed History</button>
              <button onClick={() => setShowCompactView(!showCompactView)} className="btn btn-link">{showCompactView ? 'Table View' : 'Compact View'}</button>
            </div>
            <p className="info-text">
              {extractedExpenses.some(e => e.aiInsights?.lineItem) 
                ? '✨ Multi-item extraction enabled - Each line item is a separate expense'
                : 'Review and edit the extracted data before saving.'}
            </p>
            {processedHistory.length > 0 && (
              <p className="info-text">Loaded {processedHistory.length} processed record(s)</p>
            )}
          </div>

          {error && <div className="error">{error}</div>}

          {/* Table view for better multi-item visualization */}
          <div className="expenses-table-container">
            <table className="expenses-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Item / Description</th>
                  <th>Amount</th>
                  <th>Qty</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>File</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody>
                {extractedExpenses.map((expense, index) => (
                  <tr 
                    key={index}
                    className={`expense-row ${expense.ignore ? 'ignored' : ''} ${expense.isDuplicate ? 'duplicate' : ''}`}
                  >
                    <td className="action-cell">
                      <button
                        onClick={() => handleToggleIgnore(index)}
                        className={`btn-toggle-icon ${expense.ignore ? 'include' : 'ignore'}`}
                        title={expense.ignore ? 'Include expense' : 'Ignore expense'}
                      >
                        {expense.ignore ? '✓' : '✗'}
                      </button>
                      {expense.isDuplicate && (
                        <button
                          onClick={() => handleToggleSaveDuplicate(index)}
                          className={`btn-toggle-icon ${expense.saveDuplicate ? 'active' : ''}`}
                          title="Save anyway (duplicate)"
                        >
                          ⚠️
                        </button>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="inline-input"
                        value={expense.title}
                        onChange={(e) => handleExpenseChange(index, 'title', e.target.value)}
                        disabled={expense.ignore}
                        size="20"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        className="inline-input"
                        value={expense.amount}
                        onChange={(e) => handleExpenseChange(index, 'amount', parseFloat(e.target.value))}
                        disabled={expense.ignore}
                        step="0.01"
                        min="0"
                        size="8"
                      />
                    </td>
                    <td>
                      {expense.aiInsights?.lineItem ? (
                        <input
                          type="number"
                          className="inline-input"
                          value={expense.quantity || 1}
                          onChange={(e) => handleQuantityChange(index, parseFloat(e.target.value))}
                          disabled={expense.ignore}
                          min="1"
                          size="4"
                        />
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td>
                      <select
                        className="inline-select"
                        value={expense.category}
                        onChange={(e) => handleExpenseChange(index, 'category', e.target.value)}
                        disabled={expense.ignore}
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="date"
                        className="inline-input"
                        value={expense.date}
                        onChange={(e) => handleExpenseChange(index, 'date', e.target.value)}
                        disabled={expense.ignore}
                        size="12"
                      />
                    </td>
                    <td className="filename-cell">
                      <small>{expense.fileName}</small>
                    </td>
                    <td>
                      {expense.qualityScore !== undefined ? (
                        <span className={`quality-badge ${expense.qualityScore > 0.7 ? 'good' : expense.qualityScore > 0.4 ? 'fair' : 'low'}`}>
                          {(expense.qualityScore * 100).toFixed(0)}%
                        </span>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Compact list view (alternate) */}
          {showCompactView && (
            <div className="compact-list">
              {extractedExpenses.map((expense, index) => (
                <div key={index} className={`compact-item ${expense.ignore ? 'ignored' : ''}`}>
                  <div className="compact-left">
                    <div className="avatar">G</div>
                    <div className="compact-meta">
                      <div className="compact-title">{expense.title}</div>
                      <div className="compact-date">{expense.date}{expense.aiInsights?.notes ? ` · ${expense.aiInsights.notes}` : ''}</div>
                    </div>
                  </div>
                  <div className="compact-right">
                    <div className="compact-amount">{typeof expense.amount === 'number' ? `₹${expense.amount.toLocaleString()}` : expense.amount}</div>
                    {expense.aiInsights?.notes && expense.aiInsights.notes.toLowerCase().includes('autopay') && (
                      <div className="autopay-badge">PAID VIA AUTOPAY</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Detailed card view for editing descriptions and AI insights */}
          {extractedExpenses.some(e => e.description || e.aiInsights) && (
            <div className="expenses-details-container">
              <h4>💡 Item Details & AI Insights</h4>
              <div className="details-grid">
                {extractedExpenses.map((expense, index) => (
                  (expense.description || expense.aiInsights) && (
                    <div 
                      key={index}
                      className={`detail-card ${expense.ignore ? 'ignored' : ''}`}
                    >
                      <div className="detail-header">
                        <span className="detail-title">{expense.title}</span>
                        {expense.aiInsights?.lineItem && <span className="badge-line-item">Line Item</span>}
                        {expense.confidence && <span className="badge-confidence">{(expense.confidence * 100).toFixed(0)}% confidence</span>}
                      </div>
                      
                      {expense.description && (
                        <div className="detail-description">
                          <label>Notes & Details:</label>
                          <textarea
                            className="form-control"
                            value={expense.description}
                            onChange={(e) => handleExpenseChange(index, 'description', e.target.value)}
                            disabled={expense.ignore}
                            rows="2"
                          />
                        </div>
                      )}

                      {expense.aiInsights?.lineItem && (
                        <div className="ai-insights">
                          {expense.aiInsights.unitPrice && (
                            <p>Unit Price: ${expense.aiInsights.unitPrice.toFixed(2)}</p>
                          )}
                          {expense.aiInsights.tax && (
                            <p>Tax: ${expense.aiInsights.tax.toFixed(2)}</p>
                          )}
                          {expense.aiInsights.discount && (
                            <p>Discount: -${expense.aiInsights.discount.toFixed(2)}</p>
                          )}
                          {expense.aiInsights.flags?.length > 0 && (
                            <p className="flags-warning">⚠️ Flags: {expense.aiInsights.flags.join(', ')}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ))}
              </div>
            </div>
          )}

          <div className="action-buttons">
            <button onClick={handleSaveAll} className="btn btn-primary btn-large">
              💾 Save {extractedExpenses.filter(e => !e.ignore && (!e.isDuplicate || e.saveDuplicate)).length} Expense(s)
            </button>
            <button onClick={handleCancel} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadReceipt;
