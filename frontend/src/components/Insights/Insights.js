import React, { useMemo } from 'react';

function Insights() {
  const logs = useMemo(() => JSON.parse(localStorage.getItem('daily_logs') || '[]'), []);

  const aggregate = useMemo(() => {
    const base = {
      fullTimeDays: 0,
      hustleDays: 0,
      bothDays: 0,
      pendingAmount: 0,
      receivedAmount: 0,
      topTopic: 'N/A'
    };

    const topicCount = {};

    logs.forEach((log) => {
      if (log.dayType === 'full-time') base.fullTimeDays += 1;
      if (log.dayType === 'hustle') base.hustleDays += 1;
      if (log.dayType === 'both') base.bothDays += 1;

      const amount = Number(log.finance?.amount || 0);
      if (log.finance?.status === 'pending') base.pendingAmount += amount;
      if (log.finance?.status === 'received') base.receivedAmount += amount;

      const topic = (log.teaching?.topic || '').trim();
      if (topic) {
        topicCount[topic] = (topicCount[topic] || 0) + 1;
      }
    });

    let highest = 0;
    Object.entries(topicCount).forEach(([topic, count]) => {
      if (count > highest) {
        highest = count;
        base.topTopic = topic;
      }
    });

    return base;
  }, [logs]);

  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>AI Insights</h1>
        <p>Actionable signals from your logged behavior and earnings.</p>
      </div>

      <div className="insight-stack">
        <article className="ops-card insight-card">
          <h3>Time Allocation</h3>
          <p>
            {aggregate.bothDays > 0
              ? `Mixed-focus days detected ${aggregate.bothDays} time(s). You may be balancing stable work with high-value hustle.`
              : 'No mixed-focus days logged yet. Use daily voice logs to unlock this insight.'}
          </p>
        </article>

        <article className="ops-card insight-card">
          <h3>Income Signal</h3>
          <p>
            Received: ${aggregate.receivedAmount.toFixed(2)} | Pending: ${aggregate.pendingAmount.toFixed(2)}.
            {aggregate.pendingAmount > aggregate.receivedAmount
              ? ' Follow up vendor payouts to reduce cash flow lag.'
              : ' Cash flow currently favors received payments.'}
          </p>
        </article>

        <article className="ops-card insight-card">
          <h3>Teaching Focus</h3>
          <p>Most taught topic: {aggregate.topTopic}. Reuse assets around this topic to increase delivery speed.</p>
        </article>
      </div>
    </section>
  );
}

export default Insights;
