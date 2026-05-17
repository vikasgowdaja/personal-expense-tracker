import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Trainers from '../Trainers/Trainers';
import Topics from '../Topics/Topics';
import Colleges from '../Colleges/Colleges';
import Organizations from '../Organizations/Organizations';

const TABS = [
  { id: 'trainers', label: 'Trainers' },
  { id: 'topics', label: 'Topics' },
  { id: 'colleges', label: 'Colleges' },
  { id: 'organizations', label: 'Organizations' }
];

function MasterDataHub({ user }) {
  const location = useLocation();
  const navigate = useNavigate();

  const activeTab = useMemo(() => {
    const search = new URLSearchParams(location.search);
    const tab = search.get('tab');
    return TABS.some((item) => item.id === tab) ? tab : 'trainers';
  }, [location.search]);

  const setTab = (tabId) => {
    navigate(`/master-data?tab=${tabId}`);
  };

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Master Data</h1>
          <p>Manage Trainers, Topics, Colleges, and Organizations in one place.</p>
        </div>
      </div>

      <div className="ops-card" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'btn btn-primary' : 'btn btn-secondary'}
              onClick={() => setTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'trainers' && <Trainers user={user} />}
      {activeTab === 'topics' && <Topics />}
      {activeTab === 'colleges' && <Colleges />}
      {activeTab === 'organizations' && <Organizations />}
    </section>
  );
}

export default MasterDataHub;
