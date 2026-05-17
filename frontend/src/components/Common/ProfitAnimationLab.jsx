import React, { useState } from 'react';
import ProfitJarAnimation from './ProfitJarAnimation';

function ProfitAnimationLab() {
  const [showAnimation, setShowAnimation] = useState(false);
  const [amount, setAmount] = useState(50000);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <div>
          <h1>Profit Animation Lab</h1>
          <p>Isolated test area for coin-to-jar animation. Validate alignment, timing, and scale before integrating elsewhere.</p>
        </div>
      </div>

      <div className="ops-card" style={{ marginTop: '1rem', maxWidth: '720px' }}>
        <h3 style={{ marginTop: 0 }}>Animation Controls</h3>
        <div className="ops-grid-two">
          <div className="form-group">
            <label>Preview Amount (INR)</label>
            <input
              className="form-control"
              type="number"
              min="0"
              step="100"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value || 0))}
            />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'end' }}>
            <button
              className="btn btn-primary"
              onClick={() => {
                setShowAnimation(false);
                setTimeout(() => setShowAnimation(true), 10);
              }}
            >
              Run Animation
            </button>
          </div>
        </div>

        <p className="muted" style={{ marginBottom: 0 }}>
          Use this route to QA the animation independently: /animation-lab
        </p>
      </div>

      {showAnimation && (
        <ProfitJarAnimation
          amount={amount}
          onDone={() => setShowAnimation(false)}
        />
      )}
    </section>
  );
}

export default ProfitAnimationLab;
