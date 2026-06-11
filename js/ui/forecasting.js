// ============================================================
// Forecasting Dashboard UI
// ============================================================

import { TURBINE_FLEET } from '../data/turbines.js';
import { OEM_LIMITS } from '../data/oem-limits.js';
import { simulator } from '../data/simulator.js';
import { forecastParameter } from '../engine/forecast.js';
import { TimelineChart } from '../charts/timeline.js';

let fcTurbineId = 'GT-03';
let fcParamKey = 'bearingTemperature';
let fcHorizon = 'h30d';
let fcChart = null;
let fcInterval = null;

const HORIZONS = {
  h24: { label: '24 Hours', hours: 24, steps: 24 },
  h7d: { label: '7 Days', hours: 168, steps: 168 },
  h30d: { label: '30 Days', hours: 720, steps: 720 },
  h90d: { label: '90 Days', hours: 2160, steps: 2160 },
};

export function initForecasting(container) {
  container.innerHTML = buildForecastingHTML();
  setupForecastingControls(container);
  updateForecasting(container);
  fcInterval = setInterval(() => updateForecasting(container), 10000);
  return () => clearInterval(fcInterval);
}

export function destroyForecasting() {
  if (fcInterval) clearInterval(fcInterval);
}

function buildForecastingHTML() {
  const turbineOptions = TURBINE_FLEET.map(t =>
    `<option value="${t.id}" ${t.id === fcTurbineId ? 'selected' : ''}>${t.id} — ${t.name}</option>`
  ).join('');

  const paramOptions = Object.entries(OEM_LIMITS).map(([key, limits]) =>
    `<option value="${key}" ${key === fcParamKey ? 'selected' : ''}>${limits.label} (${limits.unit})</option>`
  ).join('');

  const horizonBtns = Object.entries(HORIZONS).map(([key, h]) =>
    `<button class="tab ${key === fcHorizon ? 'active' : ''}" data-horizon="${key}">${h.label}</button>`
  ).join('');

  return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">📈</span> Parameter Forecasting</div>
        <div class="section-desc">AI-powered Holt-Winters trend forecasting with confidence bands</div>
      </div>
    </div>

    <!-- Controls -->
    <div style="display:flex;gap:var(--space-3);flex-wrap:wrap;margin-bottom:var(--space-4);align-items:center">
      <select class="select-control" id="fc-turbine">${turbineOptions}</select>
      <select class="select-control" id="fc-param" style="flex:1;min-width:200px">${paramOptions}</select>
      <div class="tabs" style="flex:none">${horizonBtns}</div>
    </div>

    <!-- Summary KPIs -->
    <div class="grid grid-4" style="margin-bottom:var(--space-4)" id="fc-kpi-grid">
      <!-- Filled dynamically -->
    </div>

    <!-- Main Chart -->
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header">
        <div>
          <div class="card-title" id="fc-chart-title">Forecast Chart</div>
          <div class="card-subtitle" id="fc-chart-subtitle"></div>
        </div>
        <div style="display:flex;gap:var(--space-3);font-size:11px;align-items:center">
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:24px;height:2px;background:linear-gradient(90deg,var(--accent-cyan),var(--accent-blue))"></span> Historical</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:24px;height:2px;background:var(--accent-blue);border-top:2px dashed var(--accent-blue)"></span> Forecast</span>
          <span style="display:flex;align-items:center;gap:4px"><span style="display:inline-block;width:24px;height:2px;background:var(--red);border-top:2px dashed var(--red)"></span> OEM Limit</span>
        </div>
      </div>
      <div class="chart-container" style="height:280px">
        <canvas id="fc-main-chart" height="280"></canvas>
      </div>
    </div>

    <!-- Multi-parameter summary table -->
    <div class="card">
      <div class="card-header">
        <div class="card-title">All Parameters Forecast Summary</div>
        <div class="card-subtitle" id="fc-table-subtitle"></div>
      </div>
      <div style="overflow-x:auto">
        <table class="data-table" id="fc-summary-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Current</th>
              <th>24h Forecast</th>
              <th>7d Forecast</th>
              <th>30d Forecast</th>
              <th>OEM Limit</th>
              <th>Days to Breach</th>
              <th>Risk Level</th>
              <th>Trend</th>
            </tr>
          </thead>
          <tbody id="fc-table-body"></tbody>
        </table>
      </div>
    </div>
  `;
}

function setupForecastingControls(container) {
  container.addEventListener('change', (e) => {
    if (e.target.id === 'fc-turbine') { fcTurbineId = e.target.value; updateForecasting(container); }
    if (e.target.id === 'fc-param') { fcParamKey = e.target.value; updateForecasting(container); }
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-horizon]');
    if (btn) {
      fcHorizon = btn.dataset.horizon;
      container.querySelectorAll('[data-horizon]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateForecasting(container);
    }
  });
}

function updateForecasting(container) {
  const readings = simulator.getAllCurrentReadings();
  const turbineReadings = readings[fcTurbineId] || {};
  const hist48h = simulator.getHistory(fcTurbineId, 48);
  const limits = OEM_LIMITS[fcParamKey];
  if (!limits) return;

  const histVals = hist48h.map(h => h[fcParamKey]).filter(v => v !== undefined);
  const fc = forecastParameter(fcTurbineId, fcParamKey, histVals);

  // KPI grid
  updateKPIs(container, turbineReadings, fc);

  // Main chart
  updateChart(container, histVals, fc);

  // Summary table
  updateSummaryTable(container, turbineReadings, readings);
}

function updateKPIs(container, readings, fc) {
  const grid = container.querySelector('#fc-kpi-grid');
  if (!grid || !fc) return;

  const limits = OEM_LIMITS[fcParamKey];
  const horizon = HORIZONS[fcHorizon];
  const forecastVal = fc.forecast[fcHorizon]?.forecast?.at(-1);
  const alertLevelColor = {
    green: 'var(--green)', yellow: 'var(--yellow)',
    orange: 'var(--orange)', red: 'var(--red)',
  };

  grid.innerHTML = `
    <div class="kpi-tile">
      <div class="kpi-label">Current Value</div>
      <div class="kpi-value" style="color:${alertLevelColor[fc.alertLevel]}">${fc.current?.toFixed(2)}<span class="kpi-unit">${limits.unit}</span></div>
      <div class="kpi-trend ${fc.trend === 'rising' ? 'up' : fc.trend === 'falling' ? 'down' : 'stable'}">
        ${fc.trend === 'rising' ? '↑ Rising' : fc.trend === 'falling' ? '↓ Falling' : '→ Stable'}
      </div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-label">${horizon.label} Forecast</div>
      <div class="kpi-value" style="color:var(--accent-blue)">${forecastVal?.toFixed(2) ?? '—'}<span class="kpi-unit">${limits.unit}</span></div>
      <div class="kpi-trend ${(forecastVal > fc.current) ? 'up' : 'down'}">
        Δ ${forecastVal !== undefined ? ((forecastVal - fc.current) >= 0 ? '+' : '') + (forecastVal - fc.current).toFixed(2) : '—'} ${limits.unit}
      </div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-label">OEM Hard Limit</div>
      <div class="kpi-value" style="color:var(--red)">${limits.critical}<span class="kpi-unit">${limits.unit}</span></div>
      <div style="font-size:11px;color:var(--text-secondary)">Do not exceed</div>
    </div>
    <div class="kpi-tile">
      <div class="kpi-label">Days to Breach</div>
      <div class="kpi-value" style="color:${fc.daysToBreach !== null ? (fc.daysToBreach <= 30 ? 'var(--red)' : 'var(--yellow)') : 'var(--green)'}">
        ${fc.daysToBreach !== null ? fc.daysToBreach : '90+'}<span class="kpi-unit">${fc.daysToBreach !== null ? 'days' : 'days'}</span>
      </div>
      <div class="status-badge ${fc.alertLevel}" style="font-size:9px;margin-top:4px">${fc.alertLevel.toUpperCase()}</div>
    </div>
  `;
}

function updateChart(container, histVals, fc) {
  const canvas = container.querySelector('#fc-main-chart');
  if (!canvas) return;

  const limits = OEM_LIMITS[fcParamKey];
  const horizonData = fc?.forecast?.[fcHorizon];
  if (!horizonData) return;

  if (!fcChart || fcChart.canvas !== canvas) {
    fcChart = new TimelineChart(canvas);
  }

  const displayHist = histVals.slice(-24); // Last 24 points
  const forecastVals = horizonData.forecast.slice(0, 30); // Show first 30 steps
  const upper = horizonData.upper.slice(0, 30);
  const lower = horizonData.lower.slice(0, 30);

  const turbine = TURBINE_FLEET.find(t => t.id === fcTurbineId);
  const titleEl = container.querySelector('#fc-chart-title');
  const subtitleEl = container.querySelector('#fc-chart-subtitle');
  if (titleEl) titleEl.textContent = `${limits.label} — ${HORIZONS[fcHorizon].label} Forecast`;
  if (subtitleEl) subtitleEl.textContent = `${turbine?.id}: Current ${fc.current?.toFixed(2)} ${limits.unit} | OEM Limit ${limits.critical} ${limits.unit}`;

  fcChart.render(displayHist, forecastVals, upper, lower, limits.critical, {
    unit: limits.unit,
    decimals: limits.unit === 'mm/s' || limits.unit === 'bar' ? 2 : 0,
    xLabels: [
      { index: 0, label: '-24h' },
      { index: Math.floor(displayHist.length / 2), label: '-12h' },
      { index: displayHist.length - 1, label: 'Now' },
      { index: displayHist.length + Math.floor(forecastVals.length / 2), label: '+' + HORIZONS[fcHorizon].label.split(' ')[0] + HORIZONS[fcHorizon].label.split(' ')[1].substring(0,1).toLowerCase() },
    ],
  });
}

function updateSummaryTable(container, turbineReadings, allReadings) {
  const tbody = container.querySelector('#fc-table-body');
  const subtitleEl = container.querySelector('#fc-table-subtitle');
  if (!tbody) return;
  if (subtitleEl) subtitleEl.textContent = `${fcTurbineId} — 30-day outlook for all parameters`;

  const hist = simulator.getHistory(fcTurbineId, 48);
  const trendIcon = (t) => t === 'rising' ? '↑' : t === 'falling' ? '↓' : '→';
  const trendColor = (t) => t === 'rising' ? 'var(--red)' : t === 'falling' ? 'var(--green)' : 'var(--text-secondary)';
  const levelBadge = (l) => `<span class="status-badge ${l}" style="font-size:9px">${l.toUpperCase()}</span>`;

  const rows = Object.entries(OEM_LIMITS).map(([key, limits]) => {
    const value = turbineReadings[key];
    if (value === undefined) return '';
    const histVals = hist.map(h => h[key]).filter(v => v !== undefined);
    const fc = forecastParameter(fcTurbineId, key, histVals);
    if (!fc) return '';

    const f24 = fc.forecast.h24.forecast.at(-1);
    const f7d = fc.forecast.h7d.forecast.at(-1);
    const f30d = fc.forecast.h30d.forecast.at(-1);
    const dp = limits.unit === 'mm/s' || limits.unit === 'bar' ? 2 : 1;

    return `
      <tr>
        <td style="font-weight:600">${limits.icon} ${limits.label}</td>
        <td style="font-family:'JetBrains Mono',monospace">${value.toFixed(dp)} ${limits.unit}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--accent-blue)">${f24.toFixed(dp)}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--accent-blue)">${f7d.toFixed(dp)}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:${fc.alertLevel !== 'green' ? 'var(--orange)' : 'var(--text-primary)'}">${f30d.toFixed(dp)}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--red)">${limits.critical} ${limits.unit}</td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${fc.daysToBreach !== null && fc.daysToBreach <= 30 ? 'var(--red)' : 'var(--text-secondary)'}">
          ${fc.daysToBreach !== null ? fc.daysToBreach + 'd' : '> 90d'}
        </td>
        <td>${levelBadge(fc.alertLevel)}</td>
        <td style="color:${trendColor(fc.trend)};font-weight:700">${trendIcon(fc.trend)} ${fc.trend}</td>
      </tr>
    `;
  }).filter(Boolean);

  tbody.innerHTML = rows.join('');
}
