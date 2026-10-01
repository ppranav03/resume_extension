// The mark: three nodes in the app's own categorical colors, connected like a tiny
// cluster graph — a direct callback to the job map on the Clusters tab, rather than a
// generic icon. No fixed background needed, so it drops cleanly onto any surface.
export default function Logo({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role="img"
      aria-label="Referral Finder"
      className="logo-mark"
    >
      <line x1="12" y1="28" x2="28" y2="28" className="logo-edge" />
      <line x1="12" y1="28" x2="20" y2="11" className="logo-edge" />
      <line x1="28" y1="28" x2="20" y2="11" className="logo-edge" />
      <circle cx="12" cy="28" r="6" className="logo-dot logo-dot-1" />
      <circle cx="28" cy="28" r="6" className="logo-dot logo-dot-2" />
      <circle cx="20" cy="11" r="6" className="logo-dot logo-dot-3" />
    </svg>
  );
}
