import React, { useEffect, useState } from 'react';
import { institutionAPI } from '../../services/api';

const EMPTY_FORM = {
  name: '',
  location: '',
  contactPerson: '',
  contactEmail: '',
  contactPhone: ''
};

function Colleges() {
  const [colleges, setColleges] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [engagements, setEngagements] = useState(() =>
    JSON.parse(localStorage.getItem('training_engagements') || '[]')
  );

  const loadColleges = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await institutionAPI.getAll();
      setColleges(res.data || []);
      setEngagements(JSON.parse(localStorage.getItem('training_engagements') || '[]'));
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load colleges');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadColleges();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('College name is required.');
      return;
    }

    try {
      setError('');
      if (editId) {
        await institutionAPI.update(editId, form);
      } else {
        await institutionAPI.create(form);
      }
      await loadColleges();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save college');
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '',
      location: item.location || '',
      contactPerson: item.contactPerson || '',
      contactEmail: item.contactEmail || '',
      contactPhone: item.contactPhone || ''
    });
    setEditId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this college?')) return;

    try {
      setError('');
      await institutionAPI.delete(id);
      await loadColleges();
      if (editId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete college');
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Colleges</h1>
        <p>Manage colleges and institutions separately from EdTech organizations.</p>
      </div>

      <article className="ops-card">
        <h3>{editId ? 'Edit College' : 'Add College'}</h3>
        <form className="structured-grid" onSubmit={handleSave}>
          <label>
            College Name *
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. NMIT"
            />
          </label>

          <label>
            Location
            <input
              className="form-control"
              value={form.location}
              onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
              placeholder="e.g. Bengaluru"
            />
          </label>

          <label>
            Contact Person
            <input
              className="form-control"
              value={form.contactPerson}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPerson: e.target.value }))}
            />
          </label>

          <label>
            Contact Email
            <input
              className="form-control"
              type="email"
              value={form.contactEmail}
              onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))}
            />
          </label>

          <label>
            Contact Phone
            <input
              className="form-control"
              value={form.contactPhone}
              onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
            />
          </label>

          <div className="inline-actions">
            <button type="submit" className="btn btn-primary">{editId ? 'Update College' : 'Create College'}</button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
        {error && <p className="warning" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </article>

      <article className="ops-card">
        <h3>College Registry</h3>
        {loading ? (
          <p className="muted">Loading colleges...</p>
        ) : (
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Location</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Engagement Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {colleges.length === 0 && (
                  <tr>
                    <td colSpan="7" className="muted">No colleges yet.</td>
                  </tr>
                )}
                {colleges.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.location || 'N/A'}</td>
                    <td>{item.contactPerson || 'N/A'}</td>
                    <td>{item.contactEmail || 'N/A'}</td>
                    <td>{item.contactPhone || 'N/A'}</td>
                    <td>
                      {
                        engagements.filter(
                          (row) => (row.college || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase()
                        ).length
                      }
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', marginRight: '6px' }}
                        onClick={() => handleEdit(item)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => handleDelete(item._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

export default Colleges;
