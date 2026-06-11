// ============================================================
// Inline Sparkline Chart (SVG)
// ============================================================

export function renderSparkline(container, data, opts = {}) {
  const {
    width = 120,
    height = 32,
    color = '#3b82f6',
    fillOpacity = 0.15,
    strokeWidth = 1.5,
    showDot = true,
  } = opts;

  if (!data || data.length === 0) {
    container.innerHTML = '';
    return;
  }

  const vals = data.map(Number).filter(isFinite);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const toX = (i) => (i / (vals.length - 1)) * width;
  const toY = (v) => height - ((v - minV) / range) * (height - 4) - 2;

  const points = vals.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const polyline = `M ${points.split(' ').join(' L ')}`;
  const fillPath = `${polyline} L ${width},${height} L 0,${height} Z`;

  const lastX = toX(vals.length - 1);
  const lastY = toY(vals.at(-1));

  container.innerHTML = `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible">
      <defs>
        <linearGradient id="spark-grad-${Math.random().toString(36).slice(2,7)}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="${fillOpacity * 2}"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${fillPath}" fill="url(#spark-grad-${Math.random().toString(36).slice(2,7)})" />
      <path d="${polyline}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>
      ${showDot ? `<circle cx="${lastX}" cy="${lastY}" r="3" fill="${color}" style="filter:drop-shadow(0 0 3px ${color})"/>` : ''}
    </svg>
  `;
}
