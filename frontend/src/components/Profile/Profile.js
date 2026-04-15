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
  const [loading, setLoading] = useState(true);

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
        employeeId: res.data.employeeId,
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
          </div>

          {message && <p className="success">{message}</p>}
          {errorMsg && <p className="error">{errorMsg}</p>}

          <div style={{ marginTop: '10px' }}>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </article>
    </section>
  );
}

export default Profile;
