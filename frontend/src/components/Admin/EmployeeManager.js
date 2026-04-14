import React, { useEffect, useState } from 'react';
import { employeeAPI } from '../../services/api';

const emptyForm = { name: '', email: '', password: '' };

function RoleBadge({ role }) {
  const isSuperAdmin = role === 'superadmin';
  return (
    <span style={{
      padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
      background: isSuperAdmin ? '#ede9fe' : '#dbeafe',
      color: isSuperAdmin ? '#6d28d9' : '#1d4ed8'
    }}>
      {isSuperAdmin ? 'Super Admin' : 'Employee'}
    </span>
  );
}

function EmployeeManager() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try {
      const res = await employeeAPI.getAll();
      setUsers(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load users');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      if (editId) {
        await employeeAPI.update(editId, { name: form.name });
        setInfo('Account updated.');
      } else {
        await employeeAPI.create(form);
        setInfo('Employee created — they can log in immediately.');
      }
      setForm(emptyForm);
      setEditId(null);
      setShowForm(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote(user) {
    const newRole = user.role === 'superadmin' ? 'employee' : 'superadmin';
    const label = newRole === 'superadmin' ? 'promote to Super Admin' : 'demote to Employee';
    if (!window.confirm(`Are you sure you want to ${label} "${user.name}"?`)) return;
    try {
      await employeeAPI.promoteRole(user._id, newRole);
      setInfo(`${user.name} is now ${newRole === 'superadmin' ? 'a Super Admin' : 'an Employee'}.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Role change failed');
    }
  }

  async function handleDelete(id, name) {
    if (!window.confirm(`Remove account "${name}"?`)) return;
    try {
      await employeeAPI.remove(id);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Delete failed');
    }
  }

  function startEdit(u) {
    setForm({ name: u.name, email: u.email, password: '' });
    setEditId(u._id);
    setShowForm(true);
    setError('');
    setInfo('');
  }

  const superAdmins = users.filter(u => u.role === 'superadmin');
  const employees = users.filter(u => u.role === 'employee');

  return (
    <div style={{ padding: '24px', maxWidth: '960px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ marginBottom: '4px' }}>User Management</h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
            Manage accounts and promote employees to Super Admin directly here.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); setError(''); setInfo(''); }}
        >
          + Add Employee
        </button>
      </div>

      {error && <div className="error" style={{ marginBottom: '12px' }}>{error}</div>}
      {info && <div style={{ marginBottom: '12px', padding: '10px 14px', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px', fontSize: '14px' }}>{info}</div>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: '#f9fafb', border: '1px solid #e5e7eb',
          borderRadius: '10px', padding: '20px', marginBottom: '24px'
        }}>
          <h3 style={{ marginTop: 0 }}>{editId ? 'Edit Account' : 'New Employee Account'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            <div className="form-group">
              <label>Name</label>
              <input
                type="text"
                className="form-control"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            {!editId && (
              <>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    className="form-control"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="form-control"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : editId ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setShowForm(false); setEditId(null); setError(''); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Super Admins */}
      {superAdmins.length > 0 && (
        <section style={{ marginBottom: '32px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#6d28d9', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Super Admins
          </h3>
          <UserTable users={superAdmins} onEdit={startEdit} onPromote={handlePromote} onDelete={handleDelete} />
        </section>
      )}

      {/* Employees */}
      <section>
        <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1d4ed8', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Employees
        </h3>
        <UserTable users={employees} onEdit={startEdit} onPromote={handlePromote} onDelete={handleDelete} />
      </section>
    </div>
  );
}

function UserTable({ users, onEdit, onPromote, onDelete }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
      <thead>
        <tr style={{ background: '#f9fafb' }}>
          {['Name', 'Email', 'Role', 'Verified', 'Created', 'Actions'].map(h => (
            <th key={h} style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e5e7eb', fontWeight: 600 }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {users.map(u => (
          <tr key={u._id} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '10px 12px', fontWeight: 600 }}>{u.name}</td>
            <td style={{ padding: '10px 12px', color: '#6b7280' }}>{u.email}</td>
            <td style={{ padding: '10px 12px' }}><RoleBadge role={u.role} /></td>
            <td style={{ padding: '10px 12px' }}>
              <span style={{
                padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600,
                background: u.isVerified ? '#d1fae5' : '#fee2e2',
                color: u.isVerified ? '#065f46' : '#991b1b'
              }}>{u.isVerified ? 'Yes' : 'No'}</span>
            </td>
            <td style={{ padding: '10px 12px', color: '#6b7280' }}>
              {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
            </td>
            <td style={{ padding: '10px 12px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={() => onEdit(u)}
              >
                Edit
              </button>
              <button
                className="btn btn-secondary"
                style={{
                  fontSize: '12px', padding: '4px 10px',
                  background: u.role === 'superadmin' ? '#fef3c7' : '#ede9fe',
                  color: u.role === 'superadmin' ? '#92400e' : '#6d28d9',
                  border: 'none'
                }}
                onClick={() => onPromote(u)}
              >
                {u.role === 'superadmin' ? 'Demote' : 'Promote'}
              </button>
              <button
                className="btn btn-danger"
                style={{ fontSize: '12px', padding: '4px 10px' }}
                onClick={() => onDelete(u._id, u.name)}
              >
                Remove
              </button>
            </td>
          </tr>
        ))}
        {users.length === 0 && (
          <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#9ca3af' }}>None yet.</td></tr>
        )}
      </tbody>
    </table>
  );
}

export default EmployeeManager;
