import React, { useEffect, useMemo, useState } from 'react';
import { institutionAPI, trainerAPI } from '../../services/api';

const CUSTOM_INSTITUTION = 'Other / Custom';

const EMPTY_PROFILE_FORM = {
  trainerName: '',
  userName: '',
  userEmail: '',
  phone: '',
  yearsOfExperience: '',
  specialization: '',
  institution: '',
  customInstitution: ''
};

function TrainerManager() {
  const [trainers, setTrainers] = useState(() => JSON.parse(localStorage.getItem('trainer_profiles') || '[]'));
  const [selectedTrainerId, setSelectedTrainerId] = useState('');
  const [editTrainerId, setEditTrainerId] = useState('');
  const [profileForm, setProfileForm] = useState(EMPTY_PROFILE_FORM);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [lastImportedProfile, setLastImportedProfile] = useState(null);
  const [institutionOptions, setInstitutionOptions] = useState([]);
  const [attachForm, setAttachForm] = useState({
    type: 'custom',
    referenceId: '',
    notes: '',
    amount: '',
    paymentStatus: 'Invoiced'
  });
  const [editRecordId, setEditRecordId] = useState('');

  const dailyLogs = useMemo(() => JSON.parse(localStorage.getItem('daily_logs') || '[]'), []);

  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        const res = await institutionAPI.getAll();
        const apiNames = (res.data || [])
          .map((item) => (item.name || '').trim())
          .filter(Boolean);
        const existingTrainerInstitutions = JSON.parse(localStorage.getItem('trainer_profiles') || '[]')
          .map((item) => (item.institution || item.college || '').trim())
          .filter(Boolean);
        setInstitutionOptions([...new Set([...apiNames, ...existingTrainerInstitutions])]);
      } catch {
        const existingTrainerInstitutions = JSON.parse(localStorage.getItem('trainer_profiles') || '[]')
          .map((item) => (item.institution || item.college || '').trim())
          .filter(Boolean);
        setInstitutionOptions([...new Set(existingTrainerInstitutions)]);
      }
    };

    loadInstitutions();
  }, []);

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

    const resolvedInstitution = profileForm.institution === CUSTOM_INSTITUTION
      ? profileForm.customInstitution.trim()
      : profileForm.institution;

    const nextTrainer = {
      id: editTrainerId || Date.now().toString(),
      trainerName: profileForm.trainerName,
      userProfile: {
        name: profileForm.userName,
        email: profileForm.userEmail,
        phone: profileForm.phone
      },
      yearsOfExperience: Number(profileForm.yearsOfExperience || 0),
      specialization: profileForm.specialization,
      institution: resolvedInstitution,
      records: trainers.find((item) => item.id === editTrainerId)?.records || [],
      createdAt: trainers.find((item) => item.id === editTrainerId)?.createdAt || new Date().toISOString()
    };

    const next = editTrainerId
      ? trainers.map((item) => (item.id === editTrainerId ? nextTrainer : item))
      : [nextTrainer, ...trainers];
    persist(next);
    setSelectedTrainerId(nextTrainer.id);
    setEditTrainerId('');
    if (resolvedInstitution && !institutionOptions.includes(resolvedInstitution)) {
      setInstitutionOptions((prev) => [resolvedInstitution, ...prev]);
    }
    setProfileForm(EMPTY_PROFILE_FORM);
  };

  const handleEditTrainer = (trainer) => {
    const trainerInstitution = trainer.institution || trainer.college || '';
    const useCustomInstitution = trainerInstitution && !institutionOptions.includes(trainerInstitution);
    setEditTrainerId(trainer.id);
    setProfileForm({
      trainerName: trainer.trainerName || '',
      userName: trainer.userProfile?.name || '',
      userEmail: trainer.userProfile?.email || '',
      phone: trainer.userProfile?.phone || '',
      yearsOfExperience: String(trainer.yearsOfExperience || ''),
      specialization: trainer.specialization || '',
      institution: useCustomInstitution ? CUSTOM_INSTITUTION : trainerInstitution,
      customInstitution: useCustomInstitution ? trainerInstitution : ''
    });
    setSelectedTrainerId(trainer.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTrainer = (trainerId) => {
    if (!window.confirm('Delete this trainer profile and all attached records?')) {
      return;
    }

    const next = trainers.filter((item) => item.id !== trainerId);
    persist(next);
    if (selectedTrainerId === trainerId) {
      setSelectedTrainerId('');
    }
    if (editTrainerId === trainerId) {
      setEditTrainerId('');
      setProfileForm(EMPTY_PROFILE_FORM);
    }
  };

  const handleCancelTrainerEdit = () => {
    setEditTrainerId('');
    setProfileForm(EMPTY_PROFILE_FORM);
  };

  const handleResumeUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append('resume', file);

    try {
      setUploadingResume(true);
      setUploadError('');
      const response = await trainerAPI.importFromPdf(formData);
      const extracted = response.data.extracted || {};
      const savedTrainer = response.data.trainer || {};

      const mappedTrainer = {
        id: savedTrainer._id || Date.now().toString(),
        trainerName: savedTrainer.fullName || extracted.fullName || 'Trainer',
        userProfile: {
          name: savedTrainer.fullName || extracted.fullName || 'Trainer',
          email: savedTrainer.email || extracted.email || '',
          phone: savedTrainer.phone || extracted.phone || ''
        },
        yearsOfExperience: savedTrainer.yearsOfExperience || extracted.yearsOfExperience || 0,
        specialization: savedTrainer.specialization || extracted.specialization || '',
        institution: '',
        records: trainers.find((item) => item.id === (savedTrainer._id || ''))?.records || [],
        createdAt: savedTrainer.createdAt || new Date().toISOString()
      };

      const next = (() => {
        const existingIndex = trainers.findIndex((item) => item.userProfile?.email && mappedTrainer.userProfile.email && item.userProfile.email.toLowerCase() === mappedTrainer.userProfile.email.toLowerCase());
        if (existingIndex === -1) {
          return [mappedTrainer, ...trainers];
        }
        return trainers.map((item, index) => (index === existingIndex ? { ...item, ...mappedTrainer, records: item.records || [] } : item));
      })();

      persist(next);
      setSelectedTrainerId(mappedTrainer.id);
      setLastImportedProfile(extracted);
      setProfileForm((prev) => ({
        ...prev,
        trainerName: mappedTrainer.trainerName,
        userName: mappedTrainer.trainerName,
        userEmail: mappedTrainer.userProfile.email,
        phone: mappedTrainer.userProfile.phone,
        yearsOfExperience: String(mappedTrainer.yearsOfExperience || ''),
        specialization: mappedTrainer.specialization,
        institution: '',
        customInstitution: ''
      }));
    } catch (err) {
      setUploadError(err?.response?.data?.message || 'Unable to extract trainer profile from PDF');
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
  };

  const handleAttachRecord = (event) => {
    event.preventDefault();
    if (!selectedTrainerId) {
      window.alert('Select a trainer profile first.');
      return;
    }

    const attached = {
      id: editRecordId || Date.now().toString(),
      type: attachForm.type,
      referenceId: attachForm.referenceId || 'manual',
      notes: attachForm.notes,
      amount: Number(attachForm.amount || 0),
      paymentStatus: attachForm.paymentStatus || 'Invoiced',
      date: trainers
        .find((trainer) => trainer.id === selectedTrainerId)
        ?.records?.find((record) => record.id === editRecordId)?.date || new Date().toISOString()
    };

    const next = trainers.map((trainer) => {
      if (trainer.id !== selectedTrainerId) {
        return trainer;
      }
      return {
        ...trainer,
        records: editRecordId
          ? (trainer.records || []).map((record) => (record.id === editRecordId ? attached : record))
          : [attached, ...(trainer.records || [])]
      };
    });

    persist(next);
    setEditRecordId('');
    setAttachForm({ type: 'custom', referenceId: '', notes: '', amount: '', paymentStatus: 'Invoiced' });
  };

  const handleEditRecord = (record) => {
    setEditRecordId(record.id);
    setAttachForm({
      type: record.type || 'custom',
      referenceId: record.referenceId || '',
      notes: record.notes || '',
      amount: String(record.amount || ''),
      paymentStatus: record.paymentStatus || 'Invoiced'
    });
  };

  const handleDeleteRecord = (recordId) => {
    if (!selectedTrainerId || !window.confirm('Delete this attached record?')) {
      return;
    }

    const next = trainers.map((trainer) => {
      if (trainer.id !== selectedTrainerId) {
        return trainer;
      }
      return {
        ...trainer,
        records: (trainer.records || []).filter((record) => record.id !== recordId)
      };
    });

    persist(next);
    if (editRecordId === recordId) {
      setEditRecordId('');
      setAttachForm({ type: 'custom', referenceId: '', notes: '', amount: '', paymentStatus: 'Invoiced' });
    }
  };

  const handleCancelRecordEdit = () => {
    setEditRecordId('');
    setAttachForm({ type: 'custom', referenceId: '', notes: '', amount: '', paymentStatus: 'Invoiced' });
  };

  const selectedTrainer = trainers.find((item) => item.id === selectedTrainerId);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>Trainer / Instructor Profiles</h1>
        <p>Create trainer-user profiles, map institutions and clients, and track linked activity.</p>
      </div>

      <div className="ops-grid-two">
        <article className="ops-card">
          <h3>{editTrainerId ? 'Edit Trainer + User Profile' : 'Create Trainer + User Profile'}</h3>
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label>Upload Trainer PDF Resume</label>
            <input
              className="form-control"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleResumeUpload}
              disabled={uploadingResume}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', display: 'block', marginTop: '4px' }}>
              Upload a trainer resume PDF to auto-extract name, email, phone, expertise topics, and years of experience.
            </span>
            {uploadingResume && <span style={{ fontSize: '0.78rem', color: 'var(--ops-text-secondary)', display: 'block', marginTop: '4px' }}>Extracting trainer details...</span>}
            {uploadError && <span className="warning" style={{ display: 'block', marginTop: '4px' }}>{uploadError}</span>}
            {lastImportedProfile && (
              <div className="daily-feed-item" style={{ marginTop: '0.75rem' }}>
                <strong>Extracted Profile</strong>
                <p>
                  {lastImportedProfile.fullName || 'N/A'}
                  {lastImportedProfile.email ? ` | ${lastImportedProfile.email}` : ''}
                  {lastImportedProfile.phone ? ` | ${lastImportedProfile.phone}` : ''}
                  {lastImportedProfile.yearsOfExperience ? ` | ${lastImportedProfile.yearsOfExperience} yrs` : ''}
                </p>
                {lastImportedProfile.topics?.length > 0 && <p>Topics: {lastImportedProfile.topics.join(', ')}</p>}
              </div>
            )}
          </div>
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
              Years of Experience
              <input
                className="form-control"
                type="number"
                min="0"
                value={profileForm.yearsOfExperience}
                onChange={(e) => setProfileForm((prev) => ({ ...prev, yearsOfExperience: e.target.value }))}
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
              Institution
              <select
                className="form-control"
                value={profileForm.institution}
                onChange={(e) => setProfileForm((prev) => ({
                  ...prev,
                  institution: e.target.value,
                  customInstitution: e.target.value === CUSTOM_INSTITUTION ? prev.customInstitution : ''
                }))}
              >
                <option value="">-- Select Institution --</option>
                {institutionOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
                <option value={CUSTOM_INSTITUTION}>{CUSTOM_INSTITUTION}</option>
              </select>
            </label>
            {profileForm.institution === CUSTOM_INSTITUTION && (
              <label>
                Custom Institution
                <input
                  className="form-control"
                  value={profileForm.customInstitution}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, customInstitution: e.target.value }))}
                />
              </label>
            )}
            <div className="inline-actions">
              <button type="submit" className="btn btn-primary">{editTrainerId ? 'Update Profile' : 'Create Profile'}</button>
              {editTrainerId && (
                <button type="button" className="btn btn-secondary" onClick={handleCancelTrainerEdit}>Cancel</button>
              )}
            </div>
          </form>
        </article>

        <article className="ops-card">
          <h3>{editRecordId ? 'Edit Engagement / Finance Record' : 'Attach Engagement / Finance Records'}</h3>
          <label>
            Select Trainer / Instructor
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
                placeholder={attachForm.type === 'daily-log' ? `e.g. ${dailyLogs[0]?.id || 'daily-log-id'}` : 'invoice-id, finance-id or custom-id'}
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

            <label>
              Payment Status
              <select
                className="form-control"
                value={attachForm.paymentStatus}
                onChange={(e) => setAttachForm((prev) => ({ ...prev, paymentStatus: e.target.value }))}
              >
                <option value="Planned">Planned</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Completed">Completed</option>
                <option value="Invoiced">Invoiced</option>
                <option value="Paid">Paid</option>
              </select>
            </label>

            <div className="inline-actions">
              <button type="submit" className="btn btn-primary">{editRecordId ? 'Update Record' : 'Attach Record'}</button>
              {editRecordId && (
                <button type="button" className="btn btn-secondary" onClick={handleCancelRecordEdit}>Cancel</button>
              )}
            </div>
          </form>
        </article>
      </div>

      <article className="ops-card">
        <h3>Trainer Engagement Tracker</h3>
        <div className="table-wrap">
          <table className="ops-table">
            <thead>
              <tr>
                <th>Trainer / Instructor</th>
                <th>User Email</th>
                <th>Experience</th>
                <th>Specialization</th>
                <th>Institution</th>
                <th>Records</th>
                <th>Total Attached</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trainers.length === 0 && (
                <tr>
                  <td colSpan="8" className="muted">No trainer profiles yet.</td>
                </tr>
              )}
              {trainers.map((trainer) => {
                const totalAmount = (trainer.records || []).reduce((sum, item) => sum + Number(item.amount || 0), 0);
                return (
                  <tr key={trainer.id}>
                    <td>{trainer.trainerName}</td>
                    <td>{trainer.userProfile.email}</td>
                    <td>{trainer.yearsOfExperience ? `${trainer.yearsOfExperience} yrs` : 'N/A'}</td>
                    <td>{trainer.specialization || 'N/A'}</td>
                    <td>{trainer.institution || trainer.college || 'N/A'}</td>
                    <td>{trainer.records?.length || 0}</td>
                    <td>₹{totalAmount.toLocaleString('en-IN')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '0.78rem', marginRight: '6px' }}
                        onClick={() => handleEditTrainer(trainer)}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                        onClick={() => handleDeleteTrainer(trainer.id)}
                      >
                        Delete
                      </button>
                    </td>
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
                {record.paymentStatus ? ` | Status: ${record.paymentStatus}` : ''}
              </p>
              <div className="inline-actions" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => handleEditRecord(record)}
                >
                  Edit Record
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => handleDeleteRecord(record.id)}
                >
                  Delete Record
                </button>
              </div>
            </div>
          ))}
        </article>
      )}
    </section>
  );
}

export default TrainerManager;
