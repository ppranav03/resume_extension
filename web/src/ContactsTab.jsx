import { useCallback, useEffect, useState } from "react";
import { deleteJob, getJobs, markApplied } from "./api.js";
import { cleanTitle, describeDuplicate, hostOf, shortDate } from "./format.js";
import StatusBadge from "./StatusBadge.jsx";

export default function ContactsTab() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [duplicate, setDuplicate] = useState(null);

  const load = useCallback(async () => {
    try {
      const all = await getJobs();
      setJobs(all.filter((job) => job.scanned_at));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(job) {
    if (!window.confirm(`Remove ${job.company} · ${job.role} and its contacts?`)) return;
    try {
      await deleteJob(job.id);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  async function apply(job) {
    try {
      const result = await markApplied(job);
      setDuplicate(result.possible_duplicate || null);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (error) {
    return (
      <div className="notice" role="alert">
        <p>{error}</p>
        <button className="primary" onClick={load}>
          Try again
        </button>
      </div>
    );
  }
  if (!jobs) return <p className="muted">Loading…</p>;

  const needle = query.trim().toLowerCase();
  const shown = needle
    ? jobs.filter((job) =>
        [job.company, job.role, ...job.contacts.map((c) => c.title)]
          .join(" ")
          .toLowerCase()
          .includes(needle)
      )
    : jobs;

  return (
    <>
      <div className="filters">
        <input
          type="search"
          placeholder="Search jobs or contacts"
          aria-label="Search jobs or contacts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted">
          {shown.length} job{shown.length === 1 ? "" : "s"}
        </span>
        <button className="ghost" onClick={load}>
          Refresh
        </button>
      </div>

      {duplicate && (
        <div className="notice notice-inline">
          <p>
            {describeDuplicate(duplicate)}{" "}
            <a href={duplicate.url} target="_blank" rel="noreferrer">
              View the original
            </a>
          </p>
          <button className="ghost" onClick={() => setDuplicate(null)} aria-label="Dismiss">
            ×
          </button>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="notice">
          <p>No referral searches yet.</p>
          <p className="muted">
            Open a job posting, click the extension, enter your university and press Scan. The job and
            its contacts are saved here.
          </p>
        </div>
      ) : (
        shown.map((job) => (
          <section className="card" key={job.id}>
            <div className="card-head">
              <div>
                <h2>
                  {job.company || "Unknown company"} <span className="muted">·</span>{" "}
                  {job.role || "Unknown role"}
                </h2>
                <p className="muted small">
                  <a href={job.url} target="_blank" rel="noreferrer">
                    {hostOf(job.url)}
                  </a>
                  {" · "}scanned {shortDate(job.scanned_at)}
                  {" · "}
                  {job.contacts.length} contact{job.contacts.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="card-actions">
                {job.status ? (
                  <StatusBadge status={job.status} />
                ) : (
                  <button className="ghost" onClick={() => apply(job)}>
                    Mark applied
                  </button>
                )}
                <button className="ghost danger" onClick={() => remove(job)} aria-label={`Remove ${job.company}`}>
                  Remove
                </button>
              </div>
            </div>
            {job.contacts.length === 0 ? (
              <p className="muted small">No contacts were found for this posting.</p>
            ) : (
              <ul className="contacts">
                {job.contacts.map((contact) => (
                  <li key={contact.link}>
                    <a href={contact.link} target="_blank" rel="noreferrer">
                      {cleanTitle(contact.title) || contact.link}
                    </a>
                    {contact.university && <span className="chip">{contact.university}</span>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))
      )}
      {jobs.length > 0 && shown.length === 0 && <p className="muted">Nothing matches “{query}”.</p>}
    </>
  );
}
