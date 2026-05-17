import React from 'react';

function PlaceholderModule({ title, description }) {
  return (
    <section className="ops-page">
      <div className="ops-page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <article className="ops-card">
        <p className="muted">
          This module is scaffolded for expansion. You can now wire APIs, role-based workflows, and automation flows
          without redesigning navigation.
        </p>
      </article>
    </section>
  );
}

export default PlaceholderModule;
