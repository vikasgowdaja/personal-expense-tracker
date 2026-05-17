import React, { useMemo, useState } from 'react';
import { expenseAPI } from '../../services/api';

const QUICK_AMOUNTS = [4000, 3500, 5000];

function parseAmountFromText(text) {
  const normalized = (text || '').toLowerCase().replace(/,/g, '');

  const currencyMatches = [...normalized.matchAll(/(?:rs\.?|inr|₹)\s*(\d+(?:\.\d+)?)\s*(k)?/gi)];
  if (currencyMatches.length > 0) {
    const values = currencyMatches.map((item) => {
      const base = Number(item[1]);
      return item[2] ? base * 1000 : base;
    });
    return Math.max(...values);
  }

  const kMatches = [...normalized.matchAll(/\b(\d+(?:\.\d+)?)\s*k\b/gi)];
  if (kMatches.length > 0) {
    return Math.max(...kMatches.map((item) => Number(item[1]) * 1000));
  }

  return 0;
}

function formatINR(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

function parseVoiceInput(text) {
  const normalized = text.toLowerCase();

  let dayType = 'full-time';
  const hasWork = /(full[- ]?time|office|job|work)/.test(normalized);
  const hasHustle = /(session|class|mentoring|vendor|hustle|side)/.test(normalized);
  if (hasWork && hasHustle) {
    dayType = 'both';
  } else if (hasHustle) {
    dayType = 'hustle';
  }

  const parsedAmount = parseAmountFromText(text);

  const status = /(pending|due|overdue)/.test(normalized) ? 'pending' : 'received';

  const topicMatch = text.match(/(?:react|node(?:\.js)?|javascript|python|mongodb|express)/i);
  const topic = topicMatch ? topicMatch[0] : '';

  const durationMatch = normalized.match(/(\d+)\s*(hour|hr|hrs|hours|minute|min|mins)/);
  let durationMinutes = 0;
  if (durationMatch) {
    const value = Number(durationMatch[1]);
    durationMinutes = /hour|hr/.test(durationMatch[2]) ? value * 60 : value;
  }

  return {
    dayType,
    work: hasWork,
    teaching: {
      topic,
      durationMinutes
    },
    finance: {
      amount: parsedAmount,
      status,
      statement: text
    },
    confidence: text.trim() ? 0.78 : 0
  };
}

function DailyLog() {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [log, setLog] = useState(() => parseVoiceInput(''));
  const [savedAt, setSavedAt] = useState('');
  const [history, setHistory] = useState(() => JSON.parse(localStorage.getItem('daily_logs') || '[]'));
  const [editId, setEditId] = useState('');
  const [saveError, setSaveError] = useState('');

  const statementAmount = useMemo(() => parseAmountFromText(log.finance.statement || transcript), [log.finance.statement, transcript]);
  const hasMismatch = statementAmount > 0 && Number(log.finance.amount || 0) > 0 && statementAmount !== Number(log.finance.amount || 0);

  const browserSupportsSpeech = useMemo(
    () => typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListening(true);
    recognition.start();

    recognition.onresult = (event) => {
      const nextTranscript = event.results?.[0]?.[0]?.transcript || '';
      setTranscript(nextTranscript);
      const parsed = parseVoiceInput(nextTranscript);
      parsed.finance.statement = nextTranscript;
      setLog(parsed);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  };

  const handleTranscriptChange = (value) => {
    setTranscript(value);
    const parsed = parseVoiceInput(value);
    parsed.finance.statement = value;
    setLog(parsed);
  };

  const persistHistory = (nextHistory) => {
    localStorage.setItem('daily_logs', JSON.stringify(nextHistory.slice(0, 60)));
    setHistory(nextHistory.slice(0, 60));
  };

  const resetEditor = () => {
    setEditId('');
    setTranscript('');
    setLog(parseVoiceInput(''));
  };

  const handleSave = async () => {
    const recordId = editId || Date.now();
    const previous = JSON.parse(localStorage.getItem('daily_logs') || '[]');
    const payload = {
      id: recordId,
      createdAt: editId ? previous.find((item) => item.id === editId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      transcript,
      ...log
    };

    const withoutCurrent = previous.filter((item) => item.id !== recordId);
    const nextHistory = [payload, ...withoutCurrent];
    persistHistory(nextHistory);

    if (payload.finance.amount > 0) {
      const linkedDescription = `${payload.transcript || ''} DailyLogId:${payload.id} PaymentStatus:${payload.finance.status}`.trim();
      const financePayload = {
        title: payload.teaching.topic ? `Session: ${payload.teaching.topic}` : 'Daily Log Payment',
        amount: payload.finance.amount,
        category: 'Other',
        date: payload.createdAt,
        description: linkedDescription
      };

      try {
        const existingExpenses = await expenseAPI.getAll();
        const linkedExpense = (existingExpenses.data || []).find((item) =>
          (item.description || '').includes(`DailyLogId:${payload.id}`)
        );

        if (linkedExpense?._id) {
          await expenseAPI.update(linkedExpense._id, financePayload);
        } else {
          await expenseAPI.create(financePayload);
        }
        setSaveError('');
      } catch (error) {
        console.error('Daily log finance sync failed:', error);
        setSaveError('Saved locally but payment sync to Finance failed.');
      }
    }

    setSavedAt(new Date().toLocaleTimeString());
    if (editId) {
      resetEditor();
    }
  };

  const handleEditRecord = (item) => {
    setEditId(item.id);
    setTranscript(item.transcript || '');
    setLog({
      dayType: item.dayType || 'full-time',
      work: Boolean(item.work),
      teaching: {
        topic: item.teaching?.topic || '',
        durationMinutes: Number(item.teaching?.durationMinutes || 0)
      },
      finance: {
        amount: Number(item.finance?.amount || 0),
        status: item.finance?.status || 'received',
        statement: item.finance?.statement || item.transcript || ''
      },
      confidence: Number(item.confidence || 0)
    });
  };

  const handleDeleteRecord = async (item) => {
    if (item.finance?.amount > 0) {
      try {
        const existingExpenses = await expenseAPI.getAll();
        const linkedExpense = (existingExpenses.data || []).find((expense) =>
          (expense.description || '').includes(`DailyLogId:${item.id}`)
        );

        if (linkedExpense?._id) {
          window.alert(
            `Cannot delete this daily record yet because it has linked finance entries. Delete linked payment records in Finance first to keep Calendar/Insights consistent.`
          );
          return;
        }
      } catch (dependencyError) {
        console.error('Dependency check failed:', dependencyError);
        window.alert('Could not verify linked finance records. Try again in a moment.');
        return;
      }
    } else {
      const proceed = window.confirm('Delete this daily log permanently?');
      if (!proceed) {
        return;
      }
    }

    const previous = JSON.parse(localStorage.getItem('daily_logs') || '[]');
    const nextHistory = previous.filter((record) => record.id !== item.id);
    persistHistory(nextHistory);
    if (editId === item.id) {
      resetEditor();
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Daily Log</h1>
        <p>Voice first with full create, retrieve, update, and delete support.</p>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card">
          <h3>Voice Capture</h3>
          <p className="muted">Try: Worked full-time and took React session for 2 hours. Got 5k.</p>
          <div className="voice-controls">
            <button
              className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
              onClick={startListening}
              disabled={!browserSupportsSpeech || isListening}
            >
              {isListening ? 'Listening...' : 'Start Voice Input'}
            </button>
            {!browserSupportsSpeech && <span className="warning">Speech API not supported in this browser.</span>}
          </div>

          <textarea
            className="form-control"
            rows={6}
            value={transcript}
            onChange={(e) => handleTranscriptChange(e.target.value)}
            placeholder="Speak or type your daily update..."
          />
        </article>

        <article className="ops-card">
          <h3>Structured Output (Editable)</h3>
          <div className="structured-grid">
            <label>
              Day Type
              <select
                className="form-control"
                value={log.dayType}
                onChange={(e) => setLog((prev) => ({ ...prev, dayType: e.target.value }))}
              >
                <option value="full-time">Full-time</option>
                <option value="hustle">Hustle</option>
                <option value="both">Both</option>
              </select>
            </label>

            <label>
              Teaching Topic
              <input
                className="form-control"
                value={log.teaching.topic}
                onChange={(e) =>
                  setLog((prev) => ({
                    ...prev,
                    teaching: { ...prev.teaching, topic: e.target.value }
                  }))
                }
              />
            </label>

            <label>
              Teaching Duration (minutes)
              <input
                className="form-control"
                type="number"
                min="0"
                value={log.teaching.durationMinutes}
                onChange={(e) =>
                  setLog((prev) => ({
                    ...prev,
                    teaching: { ...prev.teaching, durationMinutes: Number(e.target.value || 0) }
                  }))
                }
              />
            </label>

            <label>
              Finance Amount
              <input
                className="form-control"
                type="number"
                min="0"
                value={log.finance.amount}
                onChange={(e) =>
                  setLog((prev) => ({
                    ...prev,
                    finance: { ...prev.finance, amount: Number(e.target.value || 0) }
                  }))
                }
              />
            </label>

            <label>
              Quick Amount (INR)
              <select
                className="form-control"
                value={QUICK_AMOUNTS.includes(Number(log.finance.amount || 0)) ? String(Number(log.finance.amount || 0)) : 'custom'}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === 'custom') {
                    return;
                  }
                  setLog((prev) => ({
                    ...prev,
                    finance: { ...prev.finance, amount: Number(value) }
                  }));
                }}
              >
                <option value="custom">Custom Value</option>
                {QUICK_AMOUNTS.map((amount) => (
                  <option key={amount} value={String(amount)}>{formatINR(amount)}</option>
                ))}
              </select>
            </label>

            <label>
              Money Statement
              <input
                className="form-control"
                placeholder="Received ₹5000 from vendor"
                value={log.finance.statement || ''}
                onChange={(e) => {
                  const statement = e.target.value;
                  const parsed = parseAmountFromText(statement);
                  setLog((prev) => ({
                    ...prev,
                    finance: {
                      ...prev.finance,
                      statement,
                      amount: parsed > 0 ? parsed : prev.finance.amount
                    }
                  }));
                }}
              />
            </label>

            <label>
              Finance Status
              <select
                className="form-control"
                value={log.finance.status}
                onChange={(e) =>
                  setLog((prev) => ({
                    ...prev,
                    finance: { ...prev.finance, status: e.target.value }
                  }))
                }
              >
                <option value="received">Received</option>
                <option value="pending">Pending</option>
              </select>
            </label>

            <label>
              Confidence
              <input
                className="form-control"
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={log.confidence}
                onChange={(e) => setLog((prev) => ({ ...prev, confidence: Number(e.target.value || 0) }))}
              />
            </label>
          </div>

          <div className="inline-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              {editId ? 'Update Structured Event' : 'Save Structured Event'}
            </button>
            {editId && (
              <button className="btn btn-secondary" onClick={resetEditor}>Cancel Edit</button>
            )}
            {savedAt && <span className="success">Saved at {savedAt}</span>}
          </div>
          {statementAmount > 0 && (
            <p className={hasMismatch ? 'error' : 'success'}>
              Statement amount: {formatINR(statementAmount)} | Selected amount: {formatINR(log.finance.amount)}
            </p>
          )}
          {saveError && <p className="error">{saveError}</p>}
        </article>
      </div>

      <article className="ops-card">
        <h3>Saved Daily Records</h3>
        <div className="table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Day Type</th>
                <th>Teaching</th>
                <th>Finance</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan="5" className="muted">No daily logs saved yet.</td>
                </tr>
              )}
              {history.map((item) => (
                <tr key={item.id}>
                  <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                  <td>
                    <span className={`status-pill ${item.dayType || 'full-time'}`}>{item.dayType || 'unknown'}</span>
                  </td>
                  <td>{item.teaching?.topic || 'None'} ({Number(item.teaching?.durationMinutes || 0)} min)</td>
                  <td>
                    {formatINR(Number(item.finance?.amount || 0))}
                    <span className={`status-pill ${item.finance?.status || 'received'}`} style={{ marginLeft: '8px' }}>
                      {item.finance?.status || 'received'}
                    </span>
                  </td>
                  <td>
                    <div className="inline-actions">
                      <button className="btn btn-secondary" onClick={() => handleEditRecord(item)}>Edit</button>
                      <button className="btn btn-danger" onClick={() => handleDeleteRecord(item)}>Delete</button>
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

export default DailyLog;
