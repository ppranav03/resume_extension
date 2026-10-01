// Application status: shared by the Applications board and the status badges shown on
// Contacts/Clusters job rows. Each status keeps its own reserved color (never reused for
// a cluster series) and is always paired with its text label, never color alone.
export const STATUSES = [
  { id: "applied", label: "Applied", token: "--status-warning" },
  { id: "interviewing", label: "Interviewing", token: "--status-serious" },
  { id: "offer", label: "Offer", token: "--status-good" },
  { id: "rejected", label: "Rejected", token: "--status-critical" }
];

const BY_ID = Object.fromEntries(STATUSES.map((s) => [s.id, s]));

export default function StatusBadge({ status }) {
  const meta = BY_ID[status];
  if (!meta) return null;
  return (
    <span className="status-badge">
      <span className="swatch" style={{ background: `var(${meta.token})` }} />
      {meta.label}
    </span>
  );
}
