// Small text helpers shared by more than one tab.

export const cleanTitle = (title) => (title || "").replace(/\s*[|-]\s*LinkedIn\s*$/i, "");

export const shortDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Describes a `possible_duplicate` the backend found: a job with the same company and
// role but a different URL (e.g. a company's own careers page vs. a LinkedIn listing for
// the same opening). This is a heads-up, not a merge — the new job was saved either way.
export const describeDuplicate = (d) => {
  const seen = [d.scanned && "scanned", d.profiled && "clustered", d.status].filter(Boolean);
  return `You may already have this job — ${d.company} · ${d.role}${seen.length ? ` (${seen.join(", ")})` : ""} — saved from a different link.`;
};
