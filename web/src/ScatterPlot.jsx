import { useState } from "react";

// Cluster ids map to the categorical palette in a fixed order (see styles.css).
export const clusterColor = (id) => `var(--series-${(id % 8) + 1})`;

const SIZES = {
  large: { w: 640, h: 380, pad: 28, r: 6, hit: 16 },
  small: { w: 240, h: 150, pad: 14, r: 4, hit: 9 }
};

function scaler(values, span, pad) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return (v) => pad + ((v - min) / range) * (span - 2 * pad);
}

/**
 * 2-D map of jobs; nearer points are more similar.
 *  - highlight: cluster id to emphasise (everything else is muted), or null
 *  - colorByCluster: color every point by its cluster (only safe for a few clusters)
 */
export default function ScatterPlot({
  points,
  labels,
  highlight = null,
  colorByCluster = false,
  size = "large",
  onSelect
}) {
  const [active, setActive] = useState(null);
  const { w, h, pad, r, hit } = SIZES[size];
  const sx = scaler(points.map((p) => p.x), w, pad);
  // SVG y grows downward, so flip it to keep "up" meaning up.
  const sy = scaler(points.map((p) => -p.y), h, pad);

  const fillFor = (p) => {
    if (highlight !== null) return p.cluster === highlight ? clusterColor(p.cluster) : "var(--mark-muted)";
    return colorByCluster ? clusterColor(p.cluster) : "var(--series-1)";
  };

  // Draw emphasised points last so they sit on top.
  const dimmed = (p) => highlight !== null && p.cluster !== highlight;
  const ordered = [...points].sort((a, b) => dimmed(b) - dimmed(a));
  const activePoint = points.find((p) => p.id === active);

  return (
    <div className={`plot plot-${size}`} style={{ aspectRatio: `${w} / ${h}` }}>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Map of jobs by similarity">
        <rect x="0.5" y="0.5" width={w - 1} height={h - 1} className="plot-frame" />
        {ordered.map((p) => (
          <circle
            key={p.id}
            cx={sx(p.x)}
            cy={sy(-p.y)}
            r={r}
            style={{ fill: fillFor(p), fillOpacity: dimmed(p) ? 0.5 : 1 }}
            className="dot"
          />
        ))}
        {/* Transparent, larger hit targets: the dots alone are too small to aim at. */}
        {ordered.map((p) => (
          <circle
            key={`hit-${p.id}`}
            cx={sx(p.x)}
            cy={sy(-p.y)}
            r={hit}
            className="hit"
            tabIndex={size === "large" ? 0 : -1}
            aria-label={`${p.role}, ${p.company}, ${labels[p.cluster]}`}
            onPointerEnter={() => setActive(p.id)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(p.id)}
            onBlur={() => setActive(null)}
            onClick={() => onSelect?.(p.cluster)}
          />
        ))}
        {activePoint && (
          <circle
            cx={sx(activePoint.x)}
            cy={sy(-activePoint.y)}
            r={r + 3}
            className="dot-focus"
          />
        )}
      </svg>
      {activePoint && (
        <div
          className="tooltip"
          style={{
            left: `${(sx(activePoint.x) / w) * 100}%`,
            top: `${(sy(-activePoint.y) / h) * 100}%`
          }}
        >
          <strong>{activePoint.role}</strong>
          <span>
            {activePoint.company} · {labels[activePoint.cluster]}
          </span>
        </div>
      )}
    </div>
  );
}
