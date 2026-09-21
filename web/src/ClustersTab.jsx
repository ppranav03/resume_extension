import { useEffect, useState } from "react";
import { deleteJob, getClusters } from "./api.js";
import ScatterPlot, { clusterColor } from "./ScatterPlot.jsx";

const DIMENSIONS = [
  { id: "role", label: "Role", blurb: "job title and function" },
  { id: "duties", label: "Duties", blurb: "day-to-day responsibilities" },
  { id: "skills", label: "Skills", blurb: "required technical skills" }
];

// The palette only keeps this many hues distinguishable in a scatter plot. Beyond it, the
// big map stays one color and a cluster is highlighted on demand.
const MAX_COLORED_CLUSTERS = 3;

export default function ClustersTab() {
  const [by, setBy] = useState("skills");
  const [k, setK] = useState("auto");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    getClusters(by, k === "auto" ? null : k)
      .then((result) => {
        if (stale) return;
        setData(result);
        setSelected(null);
        setError(null);
      })
      .catch((e) => !stale && setError(e.message))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [by, k, reloads]);

  async function remove(point) {
    if (!window.confirm(`Remove ${point.company} · ${point.role} from your jobs?`)) return;
    try {
      await deleteJob(point.id);
      setReloads((n) => n + 1);
    } catch (e) {
      setError(e.message);
    }
  }

  if (error && !data) {
    return (
      <div className="notice" role="alert">
        <p>{error}</p>
        <button className="primary" onClick={() => setReloads((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  }
  if (!data) return <p className="muted">Loading…</p>;

  const dimension = DIMENSIONS.find((d) => d.id === by);
  const tooFew = data.points.length === 0;
  const labels = Object.fromEntries(data.clusters.map((c) => [c.id, c.label]));
  const colorByCluster = data.k <= MAX_COLORED_CLUSTERS;
  const pointsById = Object.fromEntries(data.points.map((p) => [p.id, p]));
  const toggle = (id) => setSelected((current) => (current === id ? null : id));

  return (
    <>
      <div className="filters">
        <div className="segmented" role="group" aria-label="Cluster by">
          {DIMENSIONS.map((d) => (
            <button key={d.id} aria-pressed={by === d.id} onClick={() => setBy(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
        <label className="k-select">
          <span className="muted">Clusters</span>
          <select value={k} onChange={(e) => setK(e.target.value)}>
            <option value="auto">Auto</option>
            {[2, 3, 4, 5, 6, 7, 8].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          {tooFew
            ? `${data.count} job${data.count === 1 ? "" : "s"}`
            : `${data.count} jobs · ${data.k} clusters${data.auto ? " (auto)" : ""}`}
        </span>
      </div>

      {error && (
        <div className="notice" role="alert">
          <p>{error}</p>
        </div>
      )}

      {tooFew ? (
        <div className="notice">
          <p>
            Clustering needs at least {data.min_jobs} jobs. You have {data.count}.
          </p>
          <p className="muted">
            Open several job postings, click the extension, choose the Clusters tab, tick the postings
            and press “Add to clusters”.
          </p>
        </div>
      ) : (
        <div className={loading ? "refetching" : undefined}>
          <section className="card">
            <h2>Job map</h2>
            <p className="muted small">
              Jobs placed by similarity of their {dimension.blurb}: closer means more alike. The axes are
              a flattened view of many dimensions, so only the distances mean anything.
              {!colorByCluster && " Select a cluster to highlight it."}
            </p>
            <div className="map-layout">
              <ScatterPlot
                points={data.points}
                labels={labels}
                highlight={selected}
                colorByCluster={colorByCluster}
                onSelect={toggle}
              />
              <div className="legend" role="group" aria-label="Clusters">
                {data.clusters.map((c) => (
                  <button
                    key={c.id}
                    className="legend-item"
                    aria-pressed={selected === c.id}
                    onClick={() => toggle(c.id)}
                  >
                    <span
                      className="swatch"
                      style={{ background: colorByCluster || selected === c.id ? clusterColor(c.id) : "var(--mark-muted)" }}
                    />
                    {c.label}
                    <span className="muted"> {c.size}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="cluster-grid">
            {data.clusters.map((c) => (
              <section className={`card cluster-card${selected === c.id ? " selected" : ""}`} key={c.id}>
                <button className="card-title" aria-pressed={selected === c.id} onClick={() => toggle(c.id)}>
                  <span className="swatch" style={{ background: clusterColor(c.id) }} />
                  <h2>{c.label}</h2>
                  <span className="muted small">
                    {c.size} job{c.size === 1 ? "" : "s"}
                  </span>
                </button>
                {c.top_terms && (
                  <p className="terms">
                    {c.top_terms.map((term) => (
                      <span className="chip" key={term}>
                        {term}
                      </span>
                    ))}
                  </p>
                )}
                <ScatterPlot points={data.points} labels={labels} highlight={c.id} size="small" />
                <ul className="job-list">
                  {c.job_ids.map((id) => {
                    const p = pointsById[id];
                    return (
                      <li key={id}>
                        <a href={p.url} target="_blank" rel="noreferrer">
                          {p.company} · {p.role}
                        </a>
                        <button className="ghost danger" onClick={() => remove(p)} aria-label={`Remove ${p.company}`}>
                          ×
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
