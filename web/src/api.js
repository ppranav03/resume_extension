const API = "http://127.0.0.1:5000";

async function request(path, options) {
  let response;
  try {
    response = await fetch(API + path, options);
  } catch {
    throw new Error("Can't reach the backend. Is Flask running on port 5000?");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

export const getJobs = () => request("/jobs");

export const deleteJob = (id) => request(`/jobs/${id}`, { method: "DELETE" });

// k = null lets the backend pick the number of clusters.
export const getClusters = (by, k) =>
  request(`/cluster?by=${by}${k ? `&k=${k}` : ""}`);

// Adds a job to the applications tracker. Pass company/role when already known (from a
// job already on the site) so the backend can skip re-extracting them.
export const markApplied = (job) =>
  request("/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: job.url, company: job.company, role: job.role })
  });

// patch is any of {status, notes}. status: null removes the job from the tracker.
export const updateJob = (id, patch) =>
  request(`/jobs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch)
  });
