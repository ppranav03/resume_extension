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
