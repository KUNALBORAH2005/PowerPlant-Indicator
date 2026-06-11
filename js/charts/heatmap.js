// ============================================================
// Fleet Health Heatmap
// ============================================================

export function renderHeatmap(container, turbines, readings, oemLimits, getAlertLevel) {
  const params = [
    'bearingTemperature',
    'shaftVibration',
    'lubOilPressure',
    'turbineInletTemp',
    'generatorWindingTemp',
    'rotorVibration',
  ];

  const paramLabels = {
    bearingTemperature: 'Bearing Temp',
    shaftVibration: 'Shaft Vib.',
    lubOilPressure: 'Lube Oil P.',
    turbineInletTemp: 'Inlet Temp',
    generatorWindingTemp: 'Gen. Winding',
    rotorVibration: 'Rotor Vib.',
  };

  const levelColors = {
    green: '#10b981',
    yellow: '#f59e0b',
    orange: '#f97316',
    red: '#ef4444',
  };

  const levelBg = {
    green: 'rgba(16,185,129,0.15)',
    yellow: 'rgba(245,158,11,0.15)',
    orange: 'rgba(249,115,22,0.15)',
    red: 'rgba(239,68,68,0.18)',
  };

  let html = `
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:separate;border-spacing:3px;font-size:12px">
      <thead>
        <tr>
          <th style="color:#475569;font-size:10px;font-weight:600;text-align:left;padding:4px 8px;text-transform:uppercase;letter-spacing:0.06em">Parameter</th>
          ${turbines.map(t => `<th style="color:#94a3b8;font-size:11px;font-weight:700;text-align:center;padding:4px 6px;font-family:'JetBrains Mono',monospace">${t.id}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
  `;

  params.forEach(param => {
    html += `<tr>`;
    html += `<td style="color:#94a3b8;font-weight:600;padding:4px 8px;white-space:nowrap">${paramLabels[param]}</td>`;
    turbines.forEach(t => {
      const reading = readings[t.id];
      const value = reading?.[param];
      if (value === undefined || value === null) {
        html += `<td style="background:rgba(255,255,255,0.03);border-radius:4px;text-align:center;padding:6px"><span style="color:#475569">—</span></td>`;
        return;
      }
      const level = getAlertLevel(param, value);
      const color = levelColors[level];
      const bg = levelBg[level];
      const limits = oemLimits[param];
      const unit = limits?.unit || '';
      html += `
        <td style="background:${bg};border-radius:4px;text-align:center;padding:6px;cursor:pointer;border:1px solid ${color}30"
          title="${t.id} • ${paramLabels[param]}: ${value} ${unit}">
          <span style="color:${color};font-family:'JetBrains Mono',monospace;font-weight:700;font-size:11px">${value.toFixed(1)}</span>
        </td>
      `;
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}
