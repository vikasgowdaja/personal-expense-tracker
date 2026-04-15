import React, { useEffect, useMemo, useState } from 'react';
import { trainerAPI } from '../../services/api';

const EMPTY_FORM = {
  trainerName: '',
  email: '',
  phone: '',
  yearsOfExperience: '',
  specialization: '',
  institution: ''
};

function isEngagementVisibleForUser(row, user) {
  if (!user) return true;

  if ((user.role === 'superadmin' || user.role === 'platform_owner')) {
    if (row.ownerSuperadminId) {
      return String(row.ownerSuperadminId) === String(user.id);
    }
    return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
  }

  if (row.sourcedByUserId) {
    return String(row.sourcedByUserId) === String(user.id);
  }
  return row.sourcedBy === user.employeeId || row.sourcedByName === user.name;
}

function isTrainerVisibleForUser(trainer, user, scopedEngagements) {
  if (!user) return true;

  // API results are already server-scoped by auth and role.
  if (trainer.user) return true;

  if ((user.role === 'superadmin' || user.role === 'platform_owner')) {
    if (trainer.ownerSuperadminId) {
      return String(trainer.ownerSuperadminId) === String(user.id);
    }
    if (trainer.sourcedByUserId) {
      return false;
    }
  } else {
    if (trainer.sourcedByUserId) {
      return String(trainer.sourcedByUserId) === String(user.id);
    }
    if (trainer.sourcedBy || trainer.sourcedByName) {
      return trainer.sourcedBy === user.employeeId || trainer.sourcedByName === user.name;
    }
  }

  const trainerId = String(trainer.id || trainer._id || '');
  const trainerName = String(trainer.trainerName || '').trim().toLowerCase();
  return scopedEngagements.some((row) => {
    if (trainerId && row.trainerId && String(row.trainerId) === trainerId) {
      return true;
    }
    return trainerName && String(row.trainerName || '').trim().toLowerCase() === trainerName;
  });
}

function getOwnershipDefaults(user) {
  if (!user) {
    return {
      ownerSuperadminId: '',
      connectionId: '',
      sourcedByUserId: '',
      sourcedBy: '',
      sourcedByName: ''
    };
  }

  return {
    ownerSuperadminId: (user.role === 'superadmin' || user.role === 'platform_owner') ? user.id : '',
    connectionId: (user.role === 'superadmin' || user.role === 'platform_owner') ? (user.defaultConnectionId || '') : '',
    sourcedByUserId: user.id || '',
    sourcedBy: user.employeeId || '',
    sourcedByName: user.name || ''
  };
}

function Trainers({ user }) {
  const [allTrainers, setAllTrainers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  const mapTrainerForUi = (row) => ({
    id: row.id || row._id,
    trainerName: row.trainerName || row.fullName || '',
    userProfile: {
      name: row.userProfile?.name || row.fullName || row.trainerName || '',
      email: row.userProfile?.email || row.email || '',
      phone: row.userProfile?.phone || row.phone || ''
    },
    yearsOfExperience: Number(row.yearsOfExperience || 0),
    specialization: row.specialization || '',
    institution: row.institution || row.college || '',
    records: row.records || [],
    createdAt: row.createdAt,
    ownerSuperadminId: row.ownerSuperadminId || '',
    connectionId: row.connectionId || '',
    sourcedByUserId: row.sourcedByUserId || '',
    sourcedBy: row.sourcedBy || '',
    sourcedByName: row.sourcedByName || '',
    user: row.user
  });

  const loadTrainers = async () => {
    try {
      const res = await trainerAPI.getAll();
      const rows = Array.isArray(res.data) ? res.data : [];
      const normalized = rows.map(mapTrainerForUi);
      setAllTrainers(normalized);
      localStorage.setItem('trainer_profiles', JSON.stringify(normalized));
    } catch {
      const cached = JSON.parse(localStorage.getItem('trainer_profiles') || '[]');
      setAllTrainers(cached);
    }
  };

  useEffect(() => {
    loadTrainers();
  }, []);

  const scopedEngagements = useMemo(() => {
    const rows = JSON.parse(localStorage.getItem('training_engagements') || '[]');
    return rows.filter((row) => isEngagementVisibleForUser(row, user));
  }, [user]);

  const trainers = useMemo(
    () => allTrainers.filter((trainer) => isTrainerVisibleForUser(trainer, user, scopedEngagements)),
    [allTrainers, user, scopedEngagements]
  );

  const selectedTrainer = trainers.find((t) => t.id === selectedId);

  const handleSelect = (id) => {
    setSelectedId(id);
    if (showForm && !editId) {
      setShowForm(false);
    }
  };

  const handleOpenCreate = () => {
    setEditId('');
    setForm(EMPTY_FORM);
    setShowForm(true);
    setSelectedId('');
  };

  const handleOpenEdit = (trainer) => {
    setEditId(trainer.id);
    setForm({
      trainerName: trainer.trainerName || '',
      email: trainer.userProfile?.email || '',
      phone: trainer.userProfile?.phone || '',
      yearsOfExperience: String(trainer.yearsOfExperience || ''),
      specialization: trainer.specialization || '',
      institution: trainer.institution || trainer.college || ''
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditId('');
    setForm(EMPTY_FORM);
  };

  const handleDelete = (id) => {
    if (!window.confirm('Delete this trainer profile? This cannot be undone.')) return;
    trainerAPI.delete(id)
      .then(() => loadTrainers())
      .then(() => {
        if (selectedId === id) setSelectedId('');
        if (editId === id) handleCancelForm();
      })
      .catch((err) => {
        window.alert(err?.response?.data?.message || 'Unable to delete trainer');
      });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.trainerName.trim() || !form.email.trim()) {
      window.alert('Trainer name and email are required.');
      return;
    }

    const payload = {
      fullName: form.trainerName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      yearsOfExperience: Number(form.yearsOfExperience || 0),
      specialization: form.specialization.trim()
    };

    try {
      let saved;
      if (editId) {
        const res = await trainerAPI.update(editId, payload);
        saved = mapTrainerForUi(res.data || {});
      } else {
        const res = await trainerAPI.create(payload);
        saved = mapTrainerForUi(res.data || {});
      }

      await loadTrainers();
      setSelectedId(saved.id || '');
      handleCancelForm();
    } catch (err) {
      window.alert(err?.response?.data?.message || 'Unable to save trainer');
    }
  };

  const handlePdfUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('resume', file);

    try {
      setUploadingPdf(true);
      setPdfError('');
      const res = await trainerAPI.importFromPdf(formData);
      const extracted = res.data.extracted || {};
      const savedTrainer = res.data.trainer || {};

      const mapped = mapTrainerForUi({
        ...savedTrainer,
        fullName: savedTrainer.fullName || extracted.fullName || 'Imported Trainer'
      });

      await loadTrainers();
      setSelectedId(mapped.id);
    } catch (err) {
      setPdfError(err?.response?.data?.message || 'Could not extract trainer info from the PDF.');
    } finally {
      setUploadingPdf(false);
      e.target.value = '';
    }
  };

  return (
    <section className="ops-page">
      {/* ── Page Header ── */}
      <div className="ops-page-header">
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}
        >
          <div>
            <h1>Trainer Registry</h1>
            <p>
              Add and manage trainer profiles. Select a trainer from the dropdown to view contact
              details and experience.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="file"
              accept=".pdf,application/pdf"
              id="trainers-pdf-import"
              style={{ display: 'none' }}
              onChange={handlePdfUpload}
              disabled={uploadingPdf}
            />
            <label
              htmlFor="trainers-pdf-import"
              className="btn btn-secondary"
              style={{ cursor: uploadingPdf ? 'not-allowed' : 'pointer' }}
            >
              {uploadingPdf ? 'Importing…' : 'Import from PDF'}
            </label>
            <button className="btn btn-primary" onClick={handleOpenCreate}>
              + Add Trainer
            </button>
          </div>
        </div>
        {pdfError && (
          <p className="warning" style={{ marginTop: '0.5rem' }}>
            {pdfError}
          </p>
        )}
      </div>

      {/* ── Create / Edit Form ── */}
      {showForm && (
        <article className="ops-card">
          <h3>{editId ? 'Edit Trainer Profile' : 'Add New Trainer'}</h3>
          <form className="structured-grid" onSubmit={handleSave}>
            <label>
              Trainer Name *
              <input
                className="form-control"
                placeholder="Full name"
                value={form.trainerName}
                onChange={(e) => setForm((p) => ({ ...p, trainerName: e.target.value }))}
              />
            </label>
            <label>
              Email *
              <input
                className="form-control"
                type="email"
                placeholder="trainer@email.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                className="form-control"
                placeholder="Mobile number"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />
            </label>
            <label>
              Years of Experience
              <input
                className="form-control"
                type="number"
                min="0"
                placeholder="0"
                value={form.yearsOfExperience}
                onChange={(e) => setForm((p) => ({ ...p, yearsOfExperience: e.target.value }))}
              />
            </label>
            <label>
              Specialization
              <input
                className="form-control"
                placeholder="e.g. Java, Data Science, Finance"
                value={form.specialization}
                onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))}
              />
            </label>
            <label>
              Institution
              <input
                className="form-control"
                placeholder="Primary institution / college"
                value={form.institution}
                onChange={(e) => setForm((p) => ({ ...p, institution: e.target.value }))}
              />
            </label>
            <div className="inline-actions">
              <button type="submit" className="btn btn-primary">
                {editId ? 'Update Trainer' : 'Save Trainer'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleCancelForm}>
                Cancel
              </button>
            </div>
          </form>
        </article>
      )}

      {/* ── Selector + Detail Panel ── */}
      <div className="ops-grid-two">
        {/* Left: Dropdown selector + populated detail card */}
        <article className="ops-card">
          <h3>Select Trainer</h3>
          <label>
            Trainer
            <select
              className="form-control"
              value={selectedId}
              onChange={(e) => handleSelect(e.target.value)}
            >
              <option value="">-- Choose a trainer --</option>
              {trainers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trainerName}
                  {t.specialization ? ` — ${t.specialization}` : ''}
                </option>
              ))}
            </select>
          </label>

          {selectedTrainer ? (
            <div
              className="daily-feed-item"
              style={{ marginTop: '1rem', borderRadius: '10px', padding: '1rem' }}
            >
              {/* Name + actions row */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem'
                }}
              >
                <div>
                  <strong style={{ fontSize: '1.05rem' }}>{selectedTrainer.trainerName}</strong>
                  {selectedTrainer.specialization && (
                    <span
                      className="status-pill pill-blue"
                      style={{ marginLeft: '0.5rem', verticalAlign: 'middle' }}
                    >
                      {selectedTrainer.specialization}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    onClick={() => handleOpenEdit(selectedTrainer)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ padding: '4px 12px', fontSize: '0.78rem' }}
                    onClick={() => handleDelete(selectedTrainer.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Detail grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '0.75rem'
                }}
              >
                <div>
                  <span
                    className="muted"
                    style={{ fontSize: '0.73rem', display: 'block', marginBottom: '2px' }}
                  >
                    Contact Email
                  </span>
                  <strong style={{ wordBreak: 'break-all' }}>
                    {selectedTrainer.userProfile?.email || <em className="muted">Not set</em>}
                  </strong>
                </div>
                <div>
                  <span
                    className="muted"
                    style={{ fontSize: '0.73rem', display: 'block', marginBottom: '2px' }}
                  >
                    Phone
                  </span>
                  <strong>
                    {selectedTrainer.userProfile?.phone || <em className="muted">Not set</em>}
                  </strong>
                </div>
                <div>
                  <span
                    className="muted"
                    style={{ fontSize: '0.73rem', display: 'block', marginBottom: '2px' }}
                  >
                    Years of Experience
                  </span>
                  <strong>
                    {selectedTrainer.yearsOfExperience
                      ? `${selectedTrainer.yearsOfExperience} years`
                      : <em className="muted">N/A</em>}
                  </strong>
                </div>
                <div>
                  <span
                    className="muted"
                    style={{ fontSize: '0.73rem', display: 'block', marginBottom: '2px' }}
                  >
                    Institution
                  </span>
                  <strong>
                    {selectedTrainer.institution || selectedTrainer.college || (
                      <em className="muted">Not set</em>
                    )}
                  </strong>
                </div>
              </div>

              {/* Records summary */}
              {(selectedTrainer.records?.length || 0) > 0 && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--ops-border)'
                  }}
                >
                  <span className="muted" style={{ fontSize: '0.78rem' }}>
                    {selectedTrainer.records.length} engagement record
                    {selectedTrainer.records.length !== 1 ? 's' : ''} attached &nbsp;·&nbsp;
                    ₹
                    {selectedTrainer.records
                      .reduce((s, r) => s + Number(r.amount || 0), 0)
                      .toLocaleString('en-IN')}{' '}
                    total
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="muted" style={{ marginTop: '1rem' }}>
              Select a trainer above to view their contact details and experience.
            </p>
          )}
        </article>

        {/* Right: All trainers list */}
        <article className="ops-card">
          <h3>All Trainers ({trainers.length})</h3>
          {trainers.length === 0 ? (
            <p className="muted">
              No trainers added yet. Click <strong>+ Add Trainer</strong> or{' '}
              <strong>Import from PDF</strong> to get started.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {trainers.map((t) => (
                <div
                  key={t.id}
                  className="daily-feed-item"
                  style={{
                    cursor: 'pointer',
                    border:
                      selectedId === t.id
                        ? '1.5px solid var(--ops-accent)'
                        : '1px solid transparent',
                    borderRadius: '8px',
                    transition: 'border-color 0.15s'
                  }}
                  onClick={() => handleSelect(t.id)}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ display: 'block' }}>{t.trainerName}</strong>
                      <span className="muted" style={{ fontSize: '0.76rem' }}>
                        {t.userProfile?.email || '—'}
                        {t.userProfile?.phone ? ` · ${t.userProfile.phone}` : ''}
                        {t.yearsOfExperience ? ` · ${t.yearsOfExperience} yrs` : ''}
                        {t.specialization ? ` · ${t.specialization}` : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.3rem', flexShrink: 0 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(t);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(t.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

export default Trainers;

