import React, { useEffect, useState } from 'react';
import { authAPI } from '../../services/api';

function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await authAPI.getUser();
        setUser(res.data);
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

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Profile</h1>
        <p>User identity, module access, and navigation preferences.</p>
      </div>

      <article className="ops-card">
        <h3>Account</h3>
        <p><strong>Name:</strong> {user?.name || 'Unknown'}</p>
        <p><strong>Email:</strong> {user?.email || 'Unknown'}</p>
      </article>

      <article className="ops-card">
        <h3>Role and Access</h3>
        <p className="muted">Current role: Owner</p>
        <p className="muted">Future-ready for Admin and Trainer role switching.</p>
      </article>
    </section>
  );
}

export default Profile;
