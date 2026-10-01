import { useCallback, useEffect, useState } from "react";
import { getJobs, updateJob } from "./api.js";
import { hostOf, shortDate } from "./format.js";
import { STATUSES } from "./StatusBadge.jsx";

export default function ApplicationsTab() {
  const [jobs, setJobs] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const all = await getJobs();
      setJobs(all.filter((job) => job.status));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Moves a job to a new column right away, then confirms with the backend. status: null
  // takes it off the board entirely (the job, its contacts and its cluster data stay).
  async function move(job, status) {
    const previous = jobs;
    setJobs((current) =>
      current.map((j) => (j.id === job.id ? { ...j, status } : j)).filter((j) => j.status)
    );
    try {
      await updateJob(job.id, { status });
    } catch (e) {
      setJobs(previous);
      setError(e.message);
    }
  }

  async function remove(job) {
    if (!window.confirm(`Remove ${job.company} · ${job.role} from your applications?`)) return;
    await move(job, null);
  }

  // Keeps typed notes in state as you type (so a mid-edit status change never loses
  // them), and only saves to the backend once you leave the field.
  function editNotes(job, notes) {
    setJobs((current) => current.map((j) => (j.id === job.id ? { ...j, notes } : j)));
  }

  async function saveNotes(job) {
    try {
      await updateJob(job.id, { notes: job.notes });
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !jobs) {
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

  if (jobs.length === 0) {
    return (
      <div className="notice">
        <p>No applications tracked yet.</p>
        <p className="muted">
          Mark a job as applied from the extension, or from its card on the Contacts or Clusters tab,
          and it shows up here.
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
        </div>
      )}
      <div className="board">
        {STATUSES.map((col) => {
          const items = jobs
            .filter((job) => job.status === col.id)
            .sort((a, b) => (b.applied_at || "").localeCompare(a.applied_at || ""));
          return (
            <section className="board-column" key={col.id}>
              <h2>
                <span className="swatch" style={{ background: `var(${col.token})` }} />
                {col.label} <span className="muted">{items.length}</span>
              </h2>
              {items.length === 0 && <p className="muted small">No jobs here.</p>}
              {items.map((job) => (
                <article className="app-card" key={job.id}>
                  <a href={job.url} target="_blank" rel="noreferrer" className="app-card-title">
                    {job.company || "Unknown company"} · {job.role || "Unknown role"}
                  </a>
                  <p className="muted small">
                    {hostOf(job.url)} · applied {job.applied_at ? shortDate(job.applied_at) : "—"}
                  </p>
                  <select
                    aria-label={`Status for ${job.company}`}
                    value={job.status}
                    onChange={(e) => move(job, e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    placeholder="Notes…"
                    aria-label={`Notes for ${job.company}`}
                    value={job.notes}
                    onChange={(e) => editNotes(job, e.target.value)}
                    onBlur={() => saveNotes(job)}
                  />
                  <button className="ghost danger" onClick={() => remove(job)}>
                    Remove from tracker
                  </button>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </>
  );
}
