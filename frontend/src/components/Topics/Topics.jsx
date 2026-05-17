import React, { useEffect, useState } from 'react';
import { topicAPI } from '../../services/api';

const EMPTY_FORM = {
  name: '',
  description: '',
  isActive: true
};

function Topics() {
  const [topics, setTopics] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTopics = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await topicAPI.getAll();
      setTopics(res.data || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTopics();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Topic name is required.');
      return;
    }

    try {
      setError('');
      if (editId) {
        await topicAPI.update(editId, form);
      } else {
        await topicAPI.create(form);
      }
      await loadTopics();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save topic');
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '',
      description: item.description || '',
      isActive: item.isActive !== false
    });
    setEditId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this topic?')) return;

    try {
      setError('');
      await topicAPI.delete(id);
      await loadTopics();
      if (editId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete topic');
    }
  };

  const handleSeedDefaults = async () => {
    try {
      setError('');
      await topicAPI.seedDefaults();
      await loadTopics();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to seed default topics');
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Topics</h1>
        <p>Create and manage training topics for dropdowns across TEMS modules.</p>
      </div>

      <article className="ops-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0 }}>{editId ? 'Edit Topic' : 'Add Topic'}</h3>
          <button className="btn btn-secondary" onClick={handleSeedDefaults}>Seed Default Topics</button>
        </div>

        <form className="structured-grid" onSubmit={handleSave} style={{ marginTop: '0.75rem' }}>
          <label>
            Topic Name *
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. MERN Stack"
            />
          </label>

          <label>
            Description
            <input
              className="form-control"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Optional"
            />
          </label>

          <label>
            Active
            <select
              className="form-control"
              value={form.isActive ? 'true' : 'false'}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.value === 'true' }))}
            >
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>

          <div className="inline-actions">
            <button type="submit" className="btn btn-primary">{editId ? 'Update Topic' : 'Create Topic'}</button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
        {error && <p className="warning" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </article>

      <article className="ops-card">
        <h3>Topic Registry</h3>
        {loading ? (
          <p className="muted">Loading topics...</p>
        ) : (
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {topics.length === 0 && (
                  <tr>
                    <td colSpan="4" className="muted">No topics yet.</td>
                  </tr>
                )}
                {topics.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.description || 'N/A'}</td>
                    <td>
                      <span className={`status-pill ${item.isActive ? 'received' : 'pill-neutral'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
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

export default Topics;
