import React, { useEffect, useState } from 'react';
import { authAPI } from '../../services/api';

function Profile() {
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    mobile: '',
    profilePhoto: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [shareInfo, setShareInfo] = useState('');
  const [loading, setLoading] = useState(true);
  const [shareFields, setShareFields] = useState({
    name: true,
    role: true,
    adminCode: true,
    email: false,
    mobile: false,
    employeeId: false,
    connectionId: false
  });

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authAPI.getUser();
        setUser(res.data);
        setForm({
          name: res.data?.name || '',
          email: res.data?.email || '',
          mobile: res.data?.mobile || '',
          profilePhoto: res.data?.profilePhoto || ''
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 1.2 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg('Please choose an image under 1.2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      handleChange('profilePhoto', String(reader.result || ''));
      setErrorMsg('');
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    setErrorMsg('');
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        mobile: form.mobile.trim(),
        profilePhoto: form.profilePhoto.trim()
      };
      const res = await authAPI.updateUser(payload);
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify({
        id: res.data._id,
        name: res.data.name,
        email: res.data.email,
        role: res.data.role,
        adminCode: res.data.adminCode || '',
        employeeId: res.data.employeeId,
        defaultConnectionId: res.data.defaultConnectionId || '',
        connections: res.data.connections || [],
        mobile: res.data.mobile,
        profilePhoto: res.data.profilePhoto
      }));
      setMessage('Profile updated successfully.');
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const toggleShareField = (key) => {
    setShareFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const buildShareText = () => {
    if (!user) return '';

    const lines = ['Personal Ops Access Details'];

    if (shareFields.name && user.name) lines.push(`Name: ${user.name}`);
    if (shareFields.role && user.role) lines.push(`Role: ${user.role}`);
    if (shareFields.adminCode && user.role === 'superadmin' && user.adminCode) {
      lines.push(`Admin Code: ${user.adminCode}`);
      lines.push('Use this Admin Code while employee registration.');
    }
    if (shareFields.email && user.email) lines.push(`Email: ${user.email}`);
    if (shareFields.mobile && user.mobile) lines.push(`Mobile: ${user.mobile}`);
    if (shareFields.employeeId && user.employeeId) lines.push(`Employee ID: ${user.employeeId}`);
    if (shareFields.connectionId && user.defaultConnectionId) {
      lines.push(`Connection ID: ${user.defaultConnectionId}`);
    }

    if (lines.length === 1) {
      return 'No fields selected for sharing.';
    }

    return lines.join('\n');
  };

  const handleCopyShareText = async () => {
    const text = buildShareText();
    if (!text || text === 'No fields selected for sharing.') {
      setShareInfo('Select at least one field to share.');
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const temp = document.createElement('textarea');
        temp.value = text;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setShareInfo('Selected data copied. You can paste it anywhere.');
    } catch {
      setShareInfo('Could not copy automatically. Please copy from preview text.');
    }
  };

  const handleWhatsAppShare = () => {
    const text = buildShareText();
    if (!text || text === 'No fields selected for sharing.') {
      setShareInfo('Select at least one field to share.');
      return;
    }

    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setShareInfo('WhatsApp share opened with selected data.');
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Profile</h1>
        <p>Update your contact details and profile photo.</p>
      </div>

      <article className="ops-card profile-card">
        <div className="profile-photo-wrap">
          {form.profilePhoto ? (
            <img src={form.profilePhoto} alt="Profile" className="profile-photo" />
          ) : (
            <div className="profile-photo profile-photo-placeholder">
              {form.name?.trim()?.charAt(0)?.toUpperCase() || 'U'}
            </div>
          )}
          <label className="btn btn-secondary profile-upload-btn">
            Upload Photo
            <input type="file" accept="image/*" onChange={handlePhotoUpload} hidden />
          </label>
        </div>

        <form onSubmit={handleSave} className="profile-form">
          <div className="ops-grid-two">
            <div className="form-group">
              <label>Name</label>
              <input
                className="form-control"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="form-control"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Mobile</label>
              <input
                className="form-control"
                placeholder="e.g. +91 9876543210"
                value={form.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Role</label>
              <input className="form-control" value={user?.role || ''} readOnly />
            </div>
            {user?.role === 'superadmin' && (
              <div className="form-group">
                <label>Admin Code (share with employees)</label>
                <input className="form-control" value={user?.adminCode || ''} readOnly />
              </div>
            )}
          </div>

          {message && <p className="success">{message}</p>}
          {errorMsg && <p className="error">{errorMsg}</p>}

          <div style={{ marginTop: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>

        <div className="profile-share-box">
          <h3>Share Selected Data</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            Choose what to share and send quickly to WhatsApp or copy text.
          </p>

          <div className="profile-share-grid">
            <label><input type="checkbox" checked={shareFields.name} onChange={() => toggleShareField('name')} /> Name</label>
            <label><input type="checkbox" checked={shareFields.role} onChange={() => toggleShareField('role')} /> Role</label>
            {user?.role === 'superadmin' && (
              <label><input type="checkbox" checked={shareFields.adminCode} onChange={() => toggleShareField('adminCode')} /> Admin Code</label>
            )}
            <label><input type="checkbox" checked={shareFields.email} onChange={() => toggleShareField('email')} /> Email</label>
            <label><input type="checkbox" checked={shareFields.mobile} onChange={() => toggleShareField('mobile')} /> Mobile</label>
            <label><input type="checkbox" checked={shareFields.employeeId} onChange={() => toggleShareField('employeeId')} /> Employee ID</label>
            <label><input type="checkbox" checked={shareFields.connectionId} onChange={() => toggleShareField('connectionId')} /> Connection ID</label>
          </div>

          <textarea
            className="form-control"
            rows={8}
            readOnly
            value={buildShareText()}
            style={{ marginTop: '10px', whiteSpace: 'pre-wrap' }}
          />

          <div className="profile-share-actions">
            <button type="button" className="btn btn-secondary" onClick={handleCopyShareText}>
              Copy Selected Data
            </button>
            <button type="button" className="btn btn-primary" onClick={handleWhatsAppShare}>
              Share to WhatsApp
            </button>
          </div>

          {shareInfo && <p className="success" style={{ marginTop: '8px' }}>{shareInfo}</p>}
        </div>
      </article>
    </section>
  );
}

export default Profile;

