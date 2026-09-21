import { useCallback, useEffect, useState } from "react";
import { deleteJob, getJobs } from "./api.js";

const cleanTitle = (title) => (title || "").replace(/\s*[|-]\s*LinkedIn\s*$/i, "");

const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export default function ContactsTab() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");

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
              <button className="ghost danger" onClick={() => remove(job)} aria-label={`Remove ${job.company}`}>
                Remove
              </button>
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
