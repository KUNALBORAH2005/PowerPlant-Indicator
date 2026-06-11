// OEM Compliance Dashboard
import { TURBINE_FLEET } from '../data/turbines.js';
import { OEM_LIMITS, getAlertLevel, getLimitPercent } from '../data/oem-limits.js';
import { simulator } from '../data/simulator.js';

let compInterval = null;

export function initCompliance(container) {
  container.innerHTML = buildComplianceHTML();
  updateCompliance(container);
  compInterval = setInterval(() => updateCompliance(container), 10000);
  return () => clearInterval(compInterval);
}

export function destroyCompliance() {
  if (compInterval) clearInterval(compInterval);
}

function buildComplianceHTML() {
  return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">📋</span> OEM Compliance Dashboard</div>
        <div class="section-desc">Parameter-by-parameter compliance status across all APGCL turbine units</div>
      </div>
    </div>

    <!-- Compliance summary -->
    <div class="summary-bar" style="margin-bottom:var(--space-4)">
      <div class="summary-bar-item">
        <div class="summary-bar-label">Compliant Params</div>
        <div class="summary-bar-value" id="comp-ok" style="color:var(--green)">—</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Warning Zone</div>
        <div class="summary-bar-value" id="comp-warn" style="color:var(--yellow)">—</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Alert Zone</div>
        <div class="summary-bar-value" id="comp-alert" style="color:var(--orange)">—</div>
      </div>
      <div class="summary-bar-item">
        <div class="summary-bar-label">Critical Zone</div>
        <div class="summary-bar-value" id="comp-crit" style="color:var(--red)">—</div>
      </div>
    </div>

    <!-- Compliance table -->
    <div class="card">
      <div class="card-title" style="margin-bottom:var(--space-4)">Parameter Compliance Matrix</div>
      <div style="overflow-x:auto">
        <table class="data-table" id="comp-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Category</th>
              <th>OEM Warning</th>
              <th>OEM Alert</th>
              <th>OEM Critical</th>
              ${TURBINE_FLEET.map(t => `<th style="text-align:center">${t.id}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="comp-tbody"></tbody>
        </table>
      </div>
    </div>

    <!-- Operating Hours Compliance -->
    <div class="card" style="margin-top:var(--space-4)">
      <div class="card-title" style="margin-bottom:var(--space-4)">Operating Hours vs OEM Lifecycle Limits</div>
      <div id="comp-hours-grid" class="grid grid-3"></div>
    </div>

    <!-- Maintenance Schedule Adherence -->
    <div class="card" style="margin-top:var(--space-4)">
      <div class="card-title" style="margin-bottom:var(--space-4)">Maintenance Schedule Adherence</div>
      <div id="comp-maint-grid" class="grid grid-2"></div>
    </div>
  `;
}

function updateCompliance(container) {
  const allReadings = simulator.getAllCurrentReadings();

  let ok=0, warn=0, alert=0, crit=0;

  // Count compliance across all turbines and parameters
  TURBINE_FLEET.forEach(t => {
    const r = allReadings[t.id] || {};
    Object.entries(OEM_LIMITS).forEach(([key, limits]) => {
      const v = r[key];
      if (v === undefined) return;
      const level = getAlertLevel(key, v);
      if (level === 'green') ok++;
      else if (level === 'yellow') warn++;
      else if (level === 'orange') alert++;
      else crit++;
    });
  });

  const setEl = (id, val) => { const el = container.querySelector('#' + id); if (el) el.textContent = val; };
  setEl('comp-ok', ok);
  setEl('comp-warn', warn);
  setEl('comp-alert', alert);
  setEl('comp-crit', crit);

  renderCompTable(container, allReadings);
  renderHoursGrid(container, allReadings);
  renderMaintGrid(container);
}

function renderCompTable(container, allReadings) {
  const tbody = container.querySelector('#comp-tbody');
  if (!tbody) return;

  const levelColor = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };
  const catColors = { temperature: '#f97316', vibration: '#f59e0b', lubrication: '#06b6d4', performance: '#3b82f6', oem: '#94a3b8' };

  const rows = Object.entries(OEM_LIMITS).map(([key, limits]) => {
    const turbineCells = TURBINE_FLEET.map(t => {
      const r = allReadings[t.id] || {};
      const v = r[key];
      if (v === undefined) return `<td style="text-align:center;color:var(--text-muted)">—</td>`;
      const level = getAlertLevel(key, v);
      const color = levelColor[level];
      const pct = getLimitPercent(key, v);
      return `<td style="text-align:center">
        <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${color};font-size:12px">${v.toFixed(1)}</div>
        <div style="font-size:9px;color:${color};font-weight:600">${pct.toFixed(0)}%</div>
      </td>`;
    }).join('');

    return `
      <tr>
        <td style="font-weight:600">${limits.icon} ${limits.label}</td>
        <td><span style="font-size:11px;font-weight:600;color:${catColors[limits.category] || '#94a3b8'}">${limits.category}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--yellow)">${limits.warning} ${limits.unit}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--orange)">${limits.alert} ${limits.unit}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--red)">${limits.critical} ${limits.unit}</td>
        ${turbineCells}
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

function renderHoursGrid(container, allReadings) {
  const grid = container.querySelector('#comp-hours-grid');
  if (!grid) return;

  const hoursLimit = OEM_LIMITS.operatingHours;

  grid.innerHTML = TURBINE_FLEET.map(t => {
    const hours = allReadings[t.id]?.operatingHours || t.totalOperatingHours;
    const pct = Math.min(100, (hours / hoursLimit.critical) * 100);
    const color = pct >= 90 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : pct >= 70 ? 'var(--yellow)' : 'var(--green)';

    return `
      <div class="card" style="background:var(--bg-card-elevated)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:var(--space-3)">
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text-accent);font-family:'JetBrains Mono',monospace">${t.id}</div>
            <div style="font-size:11px;color:var(--text-secondary)">${t.type}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color}">${hours.toFixed(0).toLocaleString()}</div>
            <div style="font-size:10px;color:var(--text-muted)">/ ${hoursLimit.critical.toLocaleString()} hrs OEM limit</div>
          </div>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${pct}%;--fill-start:${color};--fill-end:${color}"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--text-muted)">
          <span>0 hrs</span>
          <span style="color:${color};font-weight:700">${pct.toFixed(1)}% used</span>
          <span>${hoursLimit.critical.toLocaleString()} hrs</span>
        </div>
        ${pct >= 80 ? `<div style="margin-top:var(--space-2);font-size:11px;color:${color};font-weight:600">⚠ ${(hoursLimit.critical - hours).toFixed(0)} hours remaining</div>` : ''}
      </div>
    `;
  }).join('');
}

function renderMaintGrid(container) {
  const grid = container.querySelector('#comp-maint-grid');
  if (!grid) return;

  const now = new Date();
  grid.innerHTML = TURBINE_FLEET.map(t => {
    const nextDate = new Date(t.nextScheduledMaint);
    const daysUntil = Math.round((nextDate - now) / (1000 * 3600 * 24));
    const isOverdue = daysUntil < 0;
    const isDue = daysUntil >= 0 && daysUntil <= 30;
    const color = isOverdue ? 'var(--red)' : isDue ? 'var(--orange)' : 'var(--green)';

    return `
      <div class="card" style="background:var(--bg-card-elevated)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start">
          <div>
            <div style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--text-accent);font-size:13px">${t.id}</div>
            <div style="font-size:12px;color:var(--text-primary);font-weight:600;margin-top:2px">${t.name}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px">Last: ${t.lastMaintenance}</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--text-muted)">Next Scheduled</div>
            <div style="font-size:14px;font-weight:700;color:${color};font-family:'JetBrains Mono',monospace">${t.nextScheduledMaint}</div>
            <div style="font-size:20px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color};margin-top:4px">
              ${isOverdue ? `${Math.abs(daysUntil)}d OVERDUE` : `${daysUntil}d`}
            </div>
          </div>
        </div>
        ${isOverdue ? `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:100%;--fill-start:var(--red);--fill-end:var(--red)"></div></div>` : `
          <div class="progress-bar-wrap" style="margin-top:var(--space-3)">
            <div class="progress-bar-fill" style="width:${Math.max(0, 100 - (daysUntil / 180 * 100))}%;--fill-start:${color};--fill-end:${color}"></div>
          </div>
        `}
      </div>
    `;
  }).join('');
}
