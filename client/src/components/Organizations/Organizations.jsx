import React, { useEffect, useState } from 'react';
import { clientAPI, trainingEngagementAPI } from '../../services/api';

const EMPTY_FORM = {
  name: '',
  contactPerson: '',
  email: '',
  phone: '',
  billingAddress: ''
};

function Organizations() {
  const [organizations, setOrganizations] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [engagements, setEngagements] = useState([]);

  const loadOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const [orgRes, engagementsRes] = await Promise.all([
        clientAPI.getAll(),
        trainingEngagementAPI.getAll()
      ]);
      setOrganizations(orgRes.data || []);
      setEngagements(Array.isArray(engagementsRes.data) ? engagementsRes.data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganizations();
  }, []);

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditId('');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Organization name is required.');
      return;
    }

    try {
      setError('');
      if (editId) {
        await clientAPI.update(editId, form);
      } else {
        await clientAPI.create(form);
      }
      await loadOrganizations();
      resetForm();
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to save organization');
    }
  };

  const handleEdit = (item) => {
    setForm({
      name: item.name || '',
      contactPerson: item.contactPerson || '',
      email: item.email || '',
      phone: item.phone || '',
      billingAddress: item.billingAddress || ''
    });
    setEditId(item._id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this organization?');
    if (!ok) return;

    try {
      setError('');
      await clientAPI.delete(id);
      await loadOrganizations();
      if (editId === id) {
        resetForm();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete organization');
    }
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Organizations</h1>
        <p>Manage EdTech companies and client organizations separately from colleges.</p>
      </div>

      <article className="ops-card">
        <h3>{editId ? 'Edit Organization' : 'Add Organization'}</h3>
        <form className="structured-grid" onSubmit={handleSave}>
          <label>
            Organization Name *
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. ByteXL"
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
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            />
          </label>

          <label>
            Contact Phone
            <input
              className="form-control"
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            />
          </label>

          <label>
            Billing Address
            <input
              className="form-control"
              value={form.billingAddress}
              onChange={(e) => setForm((prev) => ({ ...prev, billingAddress: e.target.value }))}
            />
          </label>

          <div className="inline-actions">
            <button type="submit" className="btn btn-primary">{editId ? 'Update Organization' : 'Create Organization'}</button>
            {editId && (
              <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel</button>
            )}
          </div>
        </form>
        {error && <p className="warning" style={{ marginTop: '0.75rem' }}>{error}</p>}
      </article>

      <article className="ops-card">
        <h3>Organization Registry</h3>
        {loading ? (
          <p className="muted">Loading organizations...</p>
        ) : (
          <div className="table-wrap">
            <table className="ops-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Contact Person</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Billing Address</th>
                  <th>Engagement Records</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.length === 0 && (
                  <tr>
                    <td colSpan="7" className="muted">No organizations yet.</td>
                  </tr>
                )}
                {organizations.map((item) => (
                  <tr key={item._id}>
                    <td>{item.name}</td>
                    <td>{item.contactPerson || 'N/A'}</td>
                    <td>{item.email || 'N/A'}</td>
                    <td>{item.phone || 'N/A'}</td>
                    <td>{item.billingAddress || 'N/A'}</td>
                    <td>
                      {
                        engagements.filter(
                          (session) => (session.organization || '').trim().toLowerCase() === (item.name || '').trim().toLowerCase()
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

export default Organizations;
