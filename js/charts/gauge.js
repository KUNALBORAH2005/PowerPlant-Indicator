// ============================================================
// SVG Gauge Chart
// ============================================================

/**
 * Render an SVG arc gauge into a container element
 * @param {HTMLElement} container
 * @param {Object} opts
 */
export function renderGauge(container, opts = {}) {
  const {
    value = 0,
    max = 100,
    min = 0,
    label = '',
    unit = '',
    color = '#3b82f6',
    size = 120,
    strokeWidth = 10,
    showValue = true,
    critical = null,
    warning = null,
    inverted = false,
  } = opts;

  const pct = inverted
    ? 1 - Math.min(1, Math.max(0, (value - min) / (max - min)))
    : Math.min(1, Math.max(0, (value - min) / (max - min)));

  const radius = (size - strokeWidth * 2) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240deg
  const currentAngle = startAngle + pct * totalAngle;

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = (angleDeg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  const trackColor = 'rgba(255,255,255,0.06)';
  const trackPath = arcPath(cx, cy, radius, startAngle, endAngle);
  const fillPath = arcPath(cx, cy, radius, startAngle, currentAngle);

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="g-grad-${Math.random().toString(36).slice(2)}" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.7"/>
          <stop offset="100%" stop-color="${color}"/>
        </linearGradient>
      </defs>
      <!-- Track -->
      <path d="${trackPath}" fill="none" stroke="${trackColor}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <!-- Fill -->
      <path d="${fillPath}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round"
        style="filter: drop-shadow(0 0 4px ${color}60)"/>
      <!-- Value text -->
      ${showValue ? `
        <text x="${cx}" y="${cy + 6}" text-anchor="middle" fill="#f1f5f9" 
          font-family="JetBrains Mono, monospace" font-weight="800" font-size="${size * 0.16}">
          ${typeof value === 'number' ? (value > 100 ? value.toFixed(0) : value.toFixed(1)) : value}
        </text>
        <text x="${cx}" y="${cy + 20}" text-anchor="middle" fill="#94a3b8" font-family="Inter, sans-serif" font-weight="600" font-size="${size * 0.09}">
          ${unit}
        </text>
      ` : ''}
      <!-- Percent indicator -->
      <text x="${cx}" y="${cy + size * 0.37}" text-anchor="middle" fill="#475569" font-family="Inter, sans-serif" font-size="${size * 0.08}" font-weight="600">
        ${(pct * 100).toFixed(0)}% of limit
      </text>
    </svg>
    ${label ? `<div style="text-align:center;font-size:11px;font-weight:600;color:#94a3b8;margin-top:4px;text-transform:uppercase;letter-spacing:0.05em">${label}</div>` : ''}
  `;
}

/**
 * Render a mini ring progress indicator
 */
export function renderRing(container, probability, color, size = 80) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (probability / 100) * circ;
  const cx = size / 2, cy = size / 2;

  container.innerHTML = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="8"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="8"
        stroke-dasharray="${filled} ${circ - filled}" stroke-linecap="round"
        style="filter:drop-shadow(0 0 4px ${color}80); transition: stroke-dasharray 1s cubic-bezier(0.4,0,0.2,1)"/>
    </svg>
  `;
}
