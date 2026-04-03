import React, { useMemo, useState } from 'react';

function TrainerManager() {
  const [trainers, setTrainers] = useState(() => JSON.parse(localStorage.getItem('trainer_profiles') || '[]'));
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [profileForm, setProfileForm] = useState({
    trainerName: '',
    userName: '',
    userEmail: '',
    phone: '',
    specialization: '',
    college: ''
  });
  const [attachForm, setAttachForm] = useState({
    type: 'custom',
    referenceId: '',
    notes: '',
    amount: ''
  });

  const dailyLogs = useMemo(() => JSON.parse(localStorage.getItem('daily_logs') || '[]'), []);

  const persist = (next) => {
    localStorage.setItem('trainer_profiles', JSON.stringify(next));
    setTrainers(next);
  };

  const handleCreateProfile = (event) => {
    event.preventDefault();
    if (!profileForm.trainerName || !profileForm.userName || !profileForm.userEmail) {
      window.alert('Trainer name, user name, and user email are required.');
      return;
    }

    const nextTrainer = {
      id: Date.now().toString(),
      trainerName: profileForm.trainerName,
      userProfile: {
        name: profileForm.userName,
        email: profileForm.userEmail,
        phone: profileForm.phone
      },
      specialization: profileForm.specialization,
      college: profileForm.college,
      records: [],
      createdAt: new Date().toISOString()
    };

    const next = [nextTrainer, ...trainers];
    persist(next);
    setSelectedTrainerId(nextTrainer.id);
    setProfileForm({
      trainerName: '',
      userName: '',
      userEmail: '',
      phone: '',
      specialization: '',
      college: ''
    });
  };

  const handleAttachRecord = (event) => {
    event.preventDefault();
    if (!selectedTrainerId) {
      window.alert('Select a trainer profile first.');
      return;
    }

    const attached = {
      id: Date.now().toString(),
      type: attachForm.type,
      referenceId: attachForm.referenceId || 'manual',
      notes: attachForm.notes,
      amount: Number(attachForm.amount || 0),
      date: new Date().toISOString()
    };

    const next = trainers.map((trainer) => {
      if (trainer.id !== selectedTrainerId) {
        return trainer;
      }
      return {
        ...trainer,
        records: [attached, ...(trainer.records || [])]
      };
    });

    persist(next);
    setAttachForm({ type: 'custom', referenceId: '', notes: '', amount: '' });
  };

  const selectedTrainer = trainers.find((item) => item.id === selectedTrainerId);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Trainer Profiles</h1>
        <p>Create trainer-user profiles, attach records, and track all linked activity in one section.</p>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card">
          <h3>Create Trainer + User Profile</h3>
          <form className="structured-grid" onSubmit={handleCreateProfile}>
            <label>
              Trainer Name
              <input
                className="form-control"
                value={profileForm.trainerName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, trainerName: e.target.value }))}
              />
            </label>
            <label>
              User Name
              <input
                className="form-control"
                value={profileForm.userName}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, userName: e.target.value }))}
              />
            </label>
            <label>
              User Email
              <input
                className="form-control"
                type="email"
                value={profileForm.userEmail}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, userEmail: e.target.value }))}
              />
            </label>
            <label>
              Phone
              <input
                className="form-control"
                value={profileForm.phone}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))}
              />
            </label>
            <label>
              Specialization
              <input
                className="form-control"
                value={profileForm.specialization}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, specialization: e.target.value }))}
              />
            </label>
            <label>
              College
              <input
                className="form-control"
                value={profileForm.college}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, college: e.target.value }))}
              />
            </label>
            <div className="inline-actions">
              <button type="submit" className="btn btn-primary">Create Profile</button>
            </div>
          </form>
        </article>

        <article className="ops-card">
          <h3>Attach Records to Trainer</h3>
          <label>
            Select Trainer
            <select
              className="form-control"
              value={selectedTrainerId}
              onChange={(e) => setSelectedTrainerId(e.target.value)}
            >
              <option value="">Select</option>
              {trainers.map((trainer) => (
                <option key={trainer.id} value={trainer.id}>{trainer.trainerName} ({trainer.userProfile.email})</option>
              ))}
            </select>
          </label>

          <form className="structured-grid" onSubmit={handleAttachRecord}>
            <label>
              Record Type
              <select
                className="form-control"
                value={attachForm.type}
                onChange={(e) => setAttachForm((prev) => ({ ...prev, type: e.target.value }))}
              >
                <option value="custom">Custom</option>
                <option value="finance">Finance</option>
                <option value="daily-log">Daily Log</option>
                <option value="teaching">Teaching Session</option>
              </select>
            </label>

            <label>
              Reference ID
              <input
                className="form-control"
                value={attachForm.referenceId}
                onChange={(e) => setAttachForm((prev) => ({ ...prev, referenceId: e.target.value }))}
                placeholder={attachForm.type === 'daily-log' ? `e.g. ${dailyLogs[0]?.id || 'daily-log-id'}` : 'finance-id or custom-id'}
              />
            </label>

            <label>
              Amount (INR)
              <input
                className="form-control"
                type="number"
                min="0"
                value={attachForm.amount}
                onChange={(e) => setAttachForm((prev) => ({ ...prev, amount: e.target.value }))}
              />
            </label>

            <label>
              Notes
              <input
                className="form-control"
                value={attachForm.notes}
                onChange={(e) => setAttachForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </label>

            <div className="inline-actions">
              <button type="submit" className="btn btn-primary">Attach Record</button>
            </div>
          </form>
        </article>
      </div>

      <article className="ops-card">
        <h3>Trainer Record Tracker</h3>
        <div className="table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Trainer</th>
                <th>User Email</th>
                <th>Specialization</th>
                <th>Records</th>
                <th>Total Attached</th>
              </tr>
            </thead>
            <tbody>
              {trainers.length === 0 && (
                <tr>
                  <td colSpan="5" className="muted">No trainer profiles yet.</td>
                </tr>
              )}
              {trainers.map((trainer) => {
                const totalAmount = (trainer.records || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                return (
                  <tr key={trainer.id}>
                    <td>{trainer.trainerName}</td>
                    <td>{trainer.userProfile.email}</td>
                    <td>{trainer.specialization || 'N/A'}</td>
                    <td>{trainer.records?.length || 0}</td>
                    <td>₹{totalAmount.toLocaleString('en-IN')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </article>

      {selectedTrainer && (
        <article className="ops-card">
          <h3>{selectedTrainer.trainerName} - Attached Records</h3>
          {(selectedTrainer.records || []).length === 0 && <p className="muted">No records attached yet.</p>}
          {(selectedTrainer.records || []).map((record) => (
            <div className="daily-feed-item" key={record.id}>
              <span className={`status-pill ${record.type === 'teaching' ? 'pill-blue' : 'received'}`}>{record.type}</span>
              <p>
                Ref: {record.referenceId} | Amount: ₹{Number(record.amount || 0).toLocaleString('en-IN')}
                {record.duration ? ` | ${record.duration}h` : ''}
                {record.notes ? ` | ${record.notes}` : ''}
              </p>
            </div>
          ))}
        </article>
      )}
    </section>
  );
}

export default TrainerManager;
