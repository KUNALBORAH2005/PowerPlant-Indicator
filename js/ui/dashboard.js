// ============================================================
// Dashboard UI — Turbine Health Dashboard
// ============================================================

import { TURBINE_FLEET, getHealthColor, getStatusColor, getStatusLabel } from '../data/turbines.js';
import { OEM_LIMITS, getAlertLevel, getLimitPercent } from '../data/oem-limits.js';
import { simulator } from '../data/simulator.js';
import { renderGauge } from '../charts/gauge.js';
import { renderSparkline } from '../charts/sparkline.js';
import { renderHeatmap } from '../charts/heatmap.js';

let selectedTurbineId = 'GT-01';
let dashboardInterval = null;

export function initDashboard(container) {
  container.innerHTML = buildDashboardHTML();
  setupTurbineCardClicks(container);
  updateDashboard(container);
  dashboardInterval = setInterval(() => updateDashboard(container), 5000);
  return () => clearInterval(dashboardInterval);
}

export function destroyDashboard() {
  if (dashboardInterval) clearInterval(dashboardInterval);
}

function buildDashboardHTML() {
  return `
    <!-- Summary Bar -->
    <div class="summary-bar" id="db-summary-bar">
      <div class="summary-bar-item">
        <div class="summary-bar-label">Total Units</div>
        <div class="summary-bar-value" style="color:var(--accent-cyan)">${TURBINE_FLEET.length}</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Running</div>
        <div class="summary-bar-value" style="color:var(--green)" id="db-running-count">—</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Alerts</div>
        <div class="summary-bar-value" style="color:var(--red)" id="db-alert-count">—</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Total Capacity</div>
        <div class="summary-bar-value" style="color:var(--text-primary)">${TURBINE_FLEET.reduce((a,t)=>a+t.ratingMW,0)} <span style="font-size:14px;color:var(--text-secondary)">MW</span></div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Avg Health</div>
        <div class="summary-bar-value" id="db-avg-health" style="color:var(--yellow)">—</div>
      </div>
    </div>

    <!-- Live Ticker -->
    <div class="ticker-wrap">
      <div class="ticker-inner" id="db-ticker"></div>
    </div>

    <!-- Fleet Cards -->
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">⚙️</span> Fleet Overview</div>
        <div class="section-desc">Click a turbine for detailed view</div>
      </div>
    </div>

    <div class="grid grid-3" style="margin-bottom:var(--space-6)" id="db-fleet-cards"></div>

    <!-- Detail Panel for selected turbine -->
    <div id="db-detail-panel">
      <div class="section-header">
        <div>
          <div class="section-title" id="db-detail-title"><span class="icon">📊</span> Turbine Detail</div>
          <div class="section-desc" id="db-detail-subtitle"></div>
        </div>
        <div style="display:flex;gap:var(--space-2)">
          <select class="select-control" id="db-param-category">
            <option value="temperature">Temperature</option>
            <option value="vibration">Vibration</option>
            <option value="lubrication">Lubrication</option>
            <option value="performance">Performance</option>
          </select>
        </div>
      </div>

      <div class="grid grid-2">
        <!-- Parameter gauges + rows -->
        <div class="card" id="db-gauges-card">
          <div class="card-title" style="margin-bottom:var(--space-4)">Parameter Status</div>
          <div id="db-param-list"></div>
        </div>

        <!-- Sparkline trends -->
        <div class="card" id="db-trends-card">
          <div class="card-title" style="margin-bottom:var(--space-4)">24h Trends</div>
          <div id="db-sparklines"></div>
        </div>
      </div>

      <!-- Fleet Heatmap -->
      <div class="card" style="margin-top:var(--space-4)">
        <div class="card-header">
          <div>
            <div class="card-title">Fleet Health Heatmap</div>
            <div class="card-subtitle">Critical parameters across all units</div>
          </div>
          <div style="display:flex;gap:var(--space-2);align-items:center;font-size:11px">
            <span style="color:var(--green)">● Normal</span>
            <span style="color:var(--yellow)">● Warning</span>
            <span style="color:var(--orange)">● Alert</span>
            <span style="color:var(--red)">● Critical</span>
          </div>
        </div>
        <div id="db-heatmap"></div>
      </div>
    </div>
  `;
}

function updateDashboard(container) {
  const allReadings = simulator.getAllCurrentReadings();

  // Summary bar
  const running = TURBINE_FLEET.filter(t => t.status === 'running').length;
  const alerts = TURBINE_FLEET.filter(t => t.status === 'alert').length;
  const avgHealth = Math.round(TURBINE_FLEET.reduce((a, t) => a + t.healthScore, 0) / TURBINE_FLEET.length);

  const rcount = container.querySelector('#db-running-count');
  const acount = container.querySelector('#db-alert-count');
  const avgH = container.querySelector('#db-avg-health');
  if (rcount) rcount.textContent = running;
  if (acount) acount.textContent = alerts;
  if (avgH) { avgH.textContent = avgHealth + '%'; avgH.style.color = getHealthColor(avgHealth); }

  // Fleet cards
  renderFleetCards(container, allReadings);

  // Ticker
  renderTicker(container, allReadings);

  // Detail panel
  renderDetailPanel(container, allReadings);

  // Heatmap
  const heatmapEl = container.querySelector('#db-heatmap');
  if (heatmapEl) {
    renderHeatmap(heatmapEl, TURBINE_FLEET, allReadings, OEM_LIMITS, getAlertLevel);
  }
}

function renderFleetCards(container, allReadings) {
  const cards = container.querySelector('#db-fleet-cards');
  if (!cards) return;

  cards.innerHTML = TURBINE_FLEET.map(turbine => {
    const readings = allReadings[turbine.id] || {};
    const statusColor = getStatusColor(turbine.status);
    const healthColor = getHealthColor(turbine.healthScore);
    const criticalParams = getCriticalParams(turbine.id, readings);

    return `
      <div class="turbine-card ${selectedTurbineId === turbine.id ? 'active-card' : ''}"
           data-turbine="${turbine.id}"
           style="--status-color: ${statusColor}; cursor:pointer">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div class="card-id">${turbine.id}</div>
            <div class="card-name">${turbine.name}</div>
            <div class="card-station">📍 ${turbine.station}</div>
          </div>
          <div class="status-badge ${turbine.status === 'running' ? 'green' : turbine.status === 'alert' ? 'red' : turbine.status === 'maintenance' ? 'orange' : 'yellow'}">
            ${turbine.status === 'alert' ? '⚠️ ' : ''}${getStatusLabel(turbine.status)}
          </div>
        </div>

        <div style="display:flex;align-items:baseline;gap:4px;margin:var(--space-4) 0 0">
          <div class="card-health-score" style="color:${healthColor}">${turbine.healthScore}%</div>
          <div class="health-label">Health Score</div>
        </div>

        <div class="progress-bar-wrap" style="margin-bottom:var(--space-4)">
          <div class="progress-bar-fill" style="width:${turbine.healthScore}%;${turbine.healthScore >= 85 ? '--fill-start:#10b981;--fill-end:#34d399' : turbine.healthScore >= 70 ? '--fill-start:#f59e0b;--fill-end:#fbbf24' : '--fill-start:#ef4444;--fill-end:#f97316'}"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2);font-size:11px">
          <div style="color:var(--text-muted)">Load</div>
          <div style="text-align:right;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--text-primary)">
            ${readings.turbineLoad ? readings.turbineLoad.toFixed(0) : '—'} MW
          </div>
          <div style="color:var(--text-muted)">Brg Temp</div>
          <div style="text-align:right;font-weight:700;font-family:'JetBrains Mono',monospace;color:${getAlertLevelColor(getAlertLevel('bearingTemperature', readings.bearingTemperature))}">
            ${readings.bearingTemperature ? readings.bearingTemperature.toFixed(1) : '—'} °C
          </div>
          <div style="color:var(--text-muted)">Shaft Vib.</div>
          <div style="text-align:right;font-weight:700;font-family:'JetBrains Mono',monospace;color:${getAlertLevelColor(getAlertLevel('shaftVibration', readings.shaftVibration))}">
            ${readings.shaftVibration ? readings.shaftVibration.toFixed(2) : '—'} mm/s
          </div>
          <div style="color:var(--text-muted)">Op. Hours</div>
          <div style="text-align:right;font-weight:700;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">
            ${readings.operatingHours ? readings.operatingHours.toFixed(0) : '—'} h
          </div>
        </div>

        ${criticalParams.length > 0 ? `
          <div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid rgba(255,255,255,0.06)">
            <div style="font-size:10px;color:var(--red);font-weight:700;margin-bottom:4px">⚠ Active Alerts</div>
            ${criticalParams.slice(0,2).map(p => `
              <div style="font-size:11px;color:var(--text-secondary);display:flex;justify-content:space-between">
                <span>${p.label}</span>
                <span style="color:${getAlertLevelColor(p.level)};font-family:'JetBrains Mono',monospace;font-weight:700">${p.value}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid rgba(255,255,255,0.06)">
          <div style="font-size:10px;color:var(--text-muted)">
            ${turbine.ratingMW} MW • ${turbine.type} • ${turbine.manufacturer}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderTicker(container, allReadings) {
  const ticker = container.querySelector('#db-ticker');
  if (!ticker) return;

  const items = TURBINE_FLEET.flatMap(t => {
    const r = allReadings[t.id] || {};
    return [
      { label: `${t.id} Load`, value: `${r.turbineLoad?.toFixed(0)||'—'} MW`, level: 'green' },
      { label: `${t.id} Brg Temp`, value: `${r.bearingTemperature?.toFixed(1)||'—'} °C`, level: getAlertLevel('bearingTemperature', r.bearingTemperature) },
      { label: `${t.id} Vib.`, value: `${r.shaftVibration?.toFixed(2)||'—'} mm/s`, level: getAlertLevel('shaftVibration', r.shaftVibration) },
      { label: `${t.id} Lube P.`, value: `${r.lubOilPressure?.toFixed(2)||'—'} bar`, level: getAlertLevel('lubOilPressure', r.lubOilPressure) },
    ];
  });

  const html = [...items, ...items].map(item => `
    <span class="ticker-item">
      <span style="color:var(--text-muted)">${item.label}:</span>
      <span style="color:${getAlertLevelColor(item.level)};font-family:'JetBrains Mono',monospace;font-weight:700">${item.value}</span>
    </span>
  `).join('');

  ticker.innerHTML = html;
}

function renderDetailPanel(container, allReadings) {
  const readings = allReadings[selectedTurbineId] || {};
  const turbine = TURBINE_FLEET.find(t => t.id === selectedTurbineId);
  if (!turbine) return;

  const titleEl = container.querySelector('#db-detail-title');
  const subtitleEl = container.querySelector('#db-detail-subtitle');
  if (titleEl) titleEl.innerHTML = `<span class="icon">📊</span> ${turbine.name} — Live Parameters`;
  if (subtitleEl) subtitleEl.textContent = `${turbine.station} | ${turbine.manufacturer} ${turbine.model}`;

  const cat = container.querySelector('#db-param-category')?.value || 'temperature';
  renderParamList(container, readings, cat);
  renderSparklines(container, readings);
}

function renderParamList(container, readings, category) {
  const list = container.querySelector('#db-param-list');
  if (!list) return;

  const categoryParams = Object.entries(OEM_LIMITS).filter(([, l]) => l.category === category);

  list.innerHTML = categoryParams.map(([key, limits]) => {
    const value = readings[key];
    if (value === undefined) return '';
    const level = getAlertLevel(key, value);
    const pct = getLimitPercent(key, value);
    const color = getAlertLevelColor(level);

    return `
      <div class="param-row">
        <span class="param-icon">${limits.icon}</span>
        <div class="param-info">
          <div class="param-name">${limits.label}</div>
          <div style="display:flex;align-items:center;gap:var(--space-2);margin-top:4px">
            <div class="progress-bar-wrap" style="flex:1;margin-top:0">
              <div class="progress-bar-fill" style="width:${pct}%;--fill-start:${color};--fill-end:${color}"></div>
            </div>
            <span style="font-size:10px;color:var(--text-muted);white-space:nowrap">${pct.toFixed(0)}%</span>
          </div>
          <div class="param-meta">OEM Limit: ${limits.critical} ${limits.unit}</div>
        </div>
        <div>
          <div class="param-value" style="color:${color}">${value.toFixed(limits.unit === 'mm/s' ? 2 : limits.unit === 'bar' ? 2 : 1)} ${limits.unit}</div>
          <div class="param-limit">
            <span class="status-badge ${level}" style="font-size:9px;padding:1px 6px">${level.toUpperCase()}</span>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function renderSparklines(container, readings) {
  const sparks = container.querySelector('#db-sparklines');
  if (!sparks) return;

  const hist = simulator.getHistory(selectedTurbineId, 24);
  const keyParams = ['bearingTemperature', 'shaftVibration', 'lubOilPressure', 'turbineInletTemp', 'generatorWindingTemp', 'turbineExhaustTemp'];

  sparks.innerHTML = keyParams.map(key => {
    const limits = OEM_LIMITS[key];
    if (!limits) return '';
    const vals = hist.map(h => h[key]).filter(v => v !== undefined);
    const level = getAlertLevel(key, readings[key]);
    const color = getAlertLevelColor(level);

    return `
      <div style="display:flex;align-items:center;gap:var(--space-3);padding:var(--space-2) 0;border-bottom:1px solid rgba(255,255,255,0.04)">
        <span style="font-size:14px;width:20px">${limits.icon}</span>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${limits.label}</div>
          <div class="sparkline-container" id="spark-${key}"></div>
        </div>
        <div style="text-align:right">
          <div style="font-family:'JetBrains Mono',monospace;font-size:14px;font-weight:700;color:${color}">
            ${(readings[key] || 0).toFixed(1)}
          </div>
          <div style="font-size:10px;color:var(--text-muted)">${limits.unit}</div>
        </div>
      </div>
    `;
  }).join('');

  // Render sparklines after inserting DOM
  setTimeout(() => {
    keyParams.forEach(key => {
      const el = container.querySelector(`#spark-${key}`);
      if (!el) return;
      const vals = hist.map(h => h[key]).filter(v => v !== undefined);
      const level = getAlertLevel(key, readings[key]);
      renderSparkline(el, vals, { width: 100, height: 28, color: getAlertLevelColor(level) });
    });
  }, 50);
}

function setupTurbineCardClicks(container) {
  container.addEventListener('click', (e) => {
    const card = e.target.closest('[data-turbine]');
    if (!card) return;
    const id = card.dataset.turbine;
    selectedTurbineId = id;

    // Update param category change listener
    const catSel = container.querySelector('#db-param-category');
    if (catSel) {
      catSel.onchange = () => updateDashboard(container);
    }

    updateDashboard(container);
  });

  // Param category change
  container.addEventListener('change', (e) => {
    if (e.target.id === 'db-param-category') {
      updateDashboard(container);
    }
  });
}

function getCriticalParams(turbineId, readings) {
  const critical = [];
  Object.entries(readings).forEach(([key, value]) => {
    const limits = OEM_LIMITS[key];
    if (!limits || value === undefined) return;
    const level = getAlertLevel(key, value);
    if (level === 'red' || level === 'orange') {
      critical.push({ key, label: limits.label, value: `${value.toFixed(1)} ${limits.unit}`, level });
    }
  });
  return critical;
}

function getAlertLevelColor(level) {
  return { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' }[level] || 'var(--text-secondary)';
}
