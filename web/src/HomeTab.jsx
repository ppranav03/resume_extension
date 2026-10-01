import { useEffect, useState } from "react";
import { getJobs } from "./api.js";
import Logo from "./Logo.jsx";

const FEATURES = [
  {
    tab: "contacts",
    title: "Referrals",
    navLabel: "Contacts", // matches the actual tab label, so the button's destination is unambiguous
    body: "Open a job posting, enter your university, and find people at that company who went there too."
  },
  {
    tab: "clusters",
    title: "Clusters",
    navLabel: "Clusters",
    body: "Add several postings at once and see them grouped by role, duties, or skills, on a map of how they relate."
  },
  {
    tab: "applications",
    title: "Applications",
    navLabel: "Applications",
    body: "Track every job you've applied to through Interviewing, Offer, or Rejected, with notes along the way."
  }
];

// Reuses App's existing hashchange listener rather than needing a callback passed down.
const goTo = (tab) => {
  window.location.hash = tab;
};

export default function HomeTab() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getJobs().then(setJobs).catch((e) => setError(e.message));
  }, []);

  const stats = jobs && [
    { label: "Jobs tracked", value: jobs.length },
    { label: "Contacts found", value: jobs.reduce((sum, j) => sum + j.contacts.length, 0) },
    { label: "Clustered", value: jobs.filter((j) => j.profiled).length },
    { label: "Applications in progress", value: jobs.filter((j) => j.status).length }
  ];

  return (
    <>
      <section className="hero">
        <Logo size={56} />
        <h1>Referral Finder</h1>
        <p className="hero-tagline">
          Scan job postings for warm contacts, cluster what you're applying to, and keep track of
          where every application stands.
        </p>
      </section>

      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
        </div>
      )}

      {!jobs && !error && <p className="muted" style={{ textAlign: "center" }}>Loading…</p>}

      {jobs && jobs.length === 0 ? (
        <div className="notice">
          <p>Nothing tracked yet.</p>
          <p className="muted">
            Open the Referral Finder extension on a job posting, enter your university, and click
            Scan to get started.
          </p>
        </div>
      ) : (
        stats && (
          <div className="stats-row">
            {stats.map((s) => (
              <div className="stat-tile" key={s.label}>
                <span className="stat-value">{s.value.toLocaleString()}</span>
                <span className="stat-label">{s.label}</span>
              </div>
            ))}
          </div>
        )
      )}

      <div className="feature-grid">
        {FEATURES.map((f) => (
          <section className="card feature-card" key={f.tab}>
            <h2>{f.title}</h2>
            <p className="muted small">{f.body}</p>
            <button className="ghost" onClick={() => goTo(f.tab)}>
              Go to {f.navLabel}
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
