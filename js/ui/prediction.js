// ============================================================
// Failure Prediction Dashboard UI
// ============================================================

import { TURBINE_FLEET } from '../data/turbines.js';
import { simulator } from '../data/simulator.js';
import { computeFailureProbabilities, FAILURE_MODES, getRiskLevel } from '../engine/failure.js';
import { renderRing } from '../charts/gauge.js';

let predTurbineId = 'GT-03';
let predInterval = null;

export function initPrediction(container) {
  container.innerHTML = buildPredictionHTML();
  setupPredictionControls(container);
  updatePrediction(container);
  predInterval = setInterval(() => updatePrediction(container), 8000);
  return () => clearInterval(predInterval);
}

export function destroyPrediction() {
  if (predInterval) clearInterval(predInterval);
}

function buildPredictionHTML() {
  const turbineOptions = TURBINE_FLEET.map(t =>
    `<option value="${t.id}" ${t.id === predTurbineId ? 'selected' : ''}>${t.id} — ${t.name}</option>`
  ).join('');

  return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">🔬</span> Failure Prediction Analysis</div>
        <div class="section-desc">AI-based failure probability with explainable contributing factors</div>
      </div>
      <select class="select-control" id="pred-turbine">${turbineOptions}</select>
    </div>

    <!-- Overall risk summary -->
    <div class="card" id="pred-summary-card" style="margin-bottom:var(--space-4);background:var(--bg-card-elevated)">
      <div id="pred-summary"></div>
    </div>

    <!-- Failure mode cards -->
    <div class="section-header">
      <div class="section-title">Failure Mode Probabilities</div>
    </div>
    <div class="grid grid-3" id="pred-failure-grid" style="margin-bottom:var(--space-6)"></div>

    <!-- XAI Detail -->
    <div class="section-header">
      <div class="section-title"><span class="icon">🧠</span> Explainable AI — Contributing Factors</div>
    </div>
    <div class="grid grid-2" id="pred-xai-grid"></div>

    <!-- RUL Table -->
    <div class="card" style="margin-top:var(--space-4)">
      <div class="card-header">
        <div class="card-title">Remaining Useful Life (RUL) by Failure Mode</div>
        <div class="card-subtitle">Estimated hours until failure threshold is reached</div>
      </div>
      <table class="data-table" id="pred-rul-table">
        <thead>
          <tr>
            <th>Failure Mode</th>
            <th>Probability</th>
            <th>Risk Level</th>
            <th>Predicted Time to Failure</th>
            <th>Remaining Useful Life (hrs)</th>
            <th>Remaining Useful Life (days)</th>
          </tr>
        </thead>
        <tbody id="pred-rul-body"></tbody>
      </table>
    </div>
  `;
}

function setupPredictionControls(container) {
  container.addEventListener('change', (e) => {
    if (e.target.id === 'pred-turbine') {
      predTurbineId = e.target.value;
      updatePrediction(container);
    }
  });
}

function updatePrediction(container) {
  const readings = simulator.getCurrentReadings(predTurbineId);
  const turbine = TURBINE_FLEET.find(t => t.id === predTurbineId);
  if (!readings || !turbine) return;

  // Compute maintenance overdue
  const lastMaint = new Date(turbine.lastMaintenance);
  const nextMaint = new Date(turbine.nextScheduledMaint);
  const now = new Date();
  const overdueHours = now > nextMaint ? (now - nextMaint) / 3600000 : 0;

  const analysis = computeFailureProbabilities(predTurbineId, readings, overdueHours);
  if (!analysis) return;

  renderSummary(container, turbine, analysis, overdueHours);
  renderFailureCards(container, analysis);
  renderXAIGrid(container, analysis);
  renderRULTable(container, analysis);
}

function renderSummary(container, turbine, analysis, overdueHours) {
  const overall = analysis.failures.overallTurbine;
  if (!overall) return;
  const summaryEl = container.querySelector('#pred-summary');
  if (!summaryEl) return;

  const levelColor = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };
  const color = levelColor[overall.riskLevel];

  summaryEl.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-6);flex-wrap:wrap">
      <div>
        <div id="pred-ring-container"></div>
      </div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px">
          ${turbine.id} — Overall Failure Probability
        </div>
        <div style="font-size:44px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color};line-height:1">
          ${overall.probability}%
        </div>
        <div style="margin-top:var(--space-2)">
          <span class="status-badge ${overall.riskLevel}" style="font-size:12px">
            ${overall.riskLevel === 'red' ? '⚠️ CRITICAL RISK' : overall.riskLevel === 'orange' ? '⚠️ HIGH RISK' : overall.riskLevel === 'yellow' ? '⚠ ELEVATED RISK' : '✓ LOW RISK'}
          </span>
        </div>
        ${overall.timeToFailureDays ? `
          <div style="margin-top:var(--space-3);font-size:13px;color:var(--text-secondary)">
            ⏱ Predicted time to failure:
            <span style="color:${color};font-weight:700;font-family:'JetBrains Mono',monospace"> ${overall.timeToFailureDays} days</span>
          </div>
        ` : `<div style="margin-top:var(--space-3);font-size:13px;color:var(--green)">✓ No imminent failure predicted</div>`}
        ${overdueHours > 0 ? `<div style="margin-top:4px;font-size:12px;color:var(--orange)">⚠ Maintenance overdue by ${overdueHours.toFixed(0)} hours</div>` : ''}
      </div>
      <div style="flex:1;min-width:220px">
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:var(--space-3)">Primary Risk Factors</div>
        ${(overall.contributions || []).slice(0, 4).map(c => `
          <div class="xai-bar">
            <div class="xai-bar-header">
              <span class="xai-bar-label">${c.label}</span>
              <span class="xai-bar-pct">${c.contributionPct}%</span>
            </div>
            <div class="xai-bar-track">
              <div class="xai-bar-fill" style="width:${c.contributionPct}%;background:${color}"></div>
            </div>
          </div>
        `).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);min-width:200px">
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">RUL</div>
          <div style="font-size:22px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color}">${overall.rulHours}</div>
          <div style="font-size:10px;color:var(--text-secondary)">hours</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">RUL</div>
          <div style="font-size:22px;font-weight:900;font-family:'JetBrains Mono',monospace;color:${color}">${Math.round(overall.rulHours / 24)}</div>
          <div style="font-size:10px;color:var(--text-secondary)">days</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Op. Hours</div>
          <div style="font-size:22px;font-weight:900;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">${turbine.totalOperatingHours.toLocaleString()}</div>
          <div style="font-size:10px;color:var(--text-secondary)">hours</div>
        </div>
        <div style="text-align:center">
          <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;margin-bottom:4px">Cycles</div>
          <div style="font-size:22px;font-weight:900;font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">${turbine.startStopCycles}</div>
          <div style="font-size:10px;color:var(--text-secondary)">start-stops</div>
        </div>
      </div>
    </div>
  `;

  // Render ring
  const ringContainer = container.querySelector('#pred-ring-container');
  if (ringContainer) {
    renderRing(ringContainer, overall.probability, color, 100);
    ringContainer.style.position = 'relative';
    ringContainer.innerHTML += `
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">
        <div style="font-family:'JetBrains Mono',monospace;font-weight:900;font-size:18px;color:${color};line-height:1">${overall.probability}%</div>
        <div style="font-size:9px;color:var(--text-muted);font-weight:600">RISK</div>
      </div>
    `;
  }
}

function renderFailureCards(container, analysis) {
  const grid = container.querySelector('#pred-failure-grid');
  if (!grid) return;
  const levelColor = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };

  const modes = Object.entries(analysis.failures).filter(([k]) => k !== 'overallTurbine');

  grid.innerHTML = modes.map(([key, failure]) => {
    const color = levelColor[failure.riskLevel];
    return `
      <div class="failure-card ${failure.riskLevel}" id="fcard-${key}">
        <span class="failure-mode-icon">${failure.icon}</span>
        <div class="failure-probability" style="color:${color}">${failure.probability}%</div>
        <div class="failure-label">${failure.label}</div>
        <div class="failure-ttf" style="margin-top:4px">
          ${failure.timeToFailureDays
            ? `⏱ Predicted: <strong style="color:${color}">${failure.timeToFailureDays} days</strong>`
            : '<span style="color:var(--green)">✓ No imminent risk</span>'}
        </div>
        <div class="failure-rul" style="margin-top:4px">
          🔋 RUL: <strong style="color:var(--text-primary)">${failure.rulHours} hrs</strong> (${Math.round(failure.rulHours/24)} days)
        </div>
        <div style="margin-top:var(--space-3)" id="ring-${key}"></div>
        <!-- Mini progress bar -->
        <div class="progress-bar-wrap" style="margin-top:var(--space-3)">
          <div class="progress-bar-fill" style="width:${failure.probability}%;--fill-start:${color};--fill-end:${color}"></div>
        </div>
      </div>
    `;
  }).join('');

  // Render mini rings
  setTimeout(() => {
    modes.forEach(([key, failure]) => {
      const el = container.querySelector(`#ring-${key}`);
      if (el) {
        renderRing(el, failure.probability, levelColor[failure.riskLevel], 60);
      }
    });
  }, 50);
}

function renderXAIGrid(container, analysis) {
  const grid = container.querySelector('#pred-xai-grid');
  if (!grid) return;
  const levelColor = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };

  const topModes = Object.entries(analysis.failures)
    .filter(([k]) => k !== 'overallTurbine')
    .sort((a, b) => b[1].probability - a[1].probability)
    .slice(0, 4);

  grid.innerHTML = topModes.map(([key, failure]) => {
    const color = levelColor[failure.riskLevel];
    const total = (failure.contributions || []).reduce((s, c) => s + c.contribution, 0) || 1;

    return `
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${failure.icon} ${failure.label}</div>
            <div class="card-subtitle">Probability: <span style="color:${color};font-weight:700">${failure.probability}%</span></div>
          </div>
          <span class="status-badge ${failure.riskLevel}">${failure.riskLevel.toUpperCase()}</span>
        </div>
        <div style="font-size:12px;color:var(--text-muted);font-weight:600;margin-bottom:var(--space-3)">Contributing Factors:</div>
        ${(failure.contributions || []).map((c, i) => {
          const xaiColors = ['#3b82f6','#06b6d4','#8b5cf6','#f59e0b','#f97316','#ef4444'];
          const barColor = xaiColors[i % xaiColors.length];
          return `
            <div class="xai-bar">
              <div class="xai-bar-header">
                <span class="xai-bar-label">${c.label}</span>
                <div style="display:flex;gap:var(--space-2);align-items:center">
                  <span style="font-size:10px;color:var(--text-muted);font-family:'JetBrains Mono',monospace">${c.value?.toFixed?.(2)} ${''}</span>
                  <span class="xai-bar-pct" style="color:${barColor}">${c.contributionPct}%</span>
                </div>
              </div>
              <div class="xai-bar-track">
                <div class="xai-bar-fill" style="width:${c.contributionPct}%;background:${barColor}"></div>
              </div>
            </div>
          `;
        }).join('')}
        <div style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid rgba(255,255,255,0.05);font-size:12px;color:var(--text-secondary)">
          💡 <strong>Recommended Action:</strong>
          ${getRecommendation(key)}
        </div>
      </div>
    `;
  }).join('');
}

function renderRULTable(container, analysis) {
  const tbody = container.querySelector('#pred-rul-body');
  if (!tbody) return;
  const levelColor = { green: 'var(--green)', yellow: 'var(--yellow)', orange: 'var(--orange)', red: 'var(--red)' };

  const rows = Object.entries(analysis.failures).map(([key, failure]) => {
    const color = levelColor[failure.riskLevel];
    return `
      <tr>
        <td style="font-weight:600">${failure.icon} ${failure.label}</td>
        <td style="font-family:'JetBrains Mono',monospace;color:${color};font-weight:700">${failure.probability}%</td>
        <td><span class="status-badge ${failure.riskLevel}" style="font-size:9px">${failure.riskLevel.toUpperCase()}</span></td>
        <td style="font-family:'JetBrains Mono',monospace;color:${failure.timeToFailureDays ? color : 'var(--green)'}">
          ${failure.timeToFailureDays ? failure.timeToFailureDays + ' days' : '> 90 days'}
        </td>
        <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:${color}">${failure.rulHours.toLocaleString()} hrs</td>
        <td style="font-family:'JetBrains Mono',monospace;color:var(--text-secondary)">${Math.round(failure.rulHours/24)} days</td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');
}

function getRecommendation(key) {
  const recs = {
    bearingFailure: 'Inspect bearing assembly, check lubrication flow, schedule vibration analysis.',
    lubricationFailure: 'Check oil pressure, inspect oil filter, verify pump operation, consider oil flush.',
    rotorImbalance: 'Schedule rotor balancing, inspect blade integrity, review alignment.',
    vibrationFailure: 'Perform vibration analysis, check foundation bolts, inspect coupling.',
    thermalStress: 'Review load profile, inspect cooling system, check thermal expansion allowances.',
    generatorFault: 'Inspect winding insulation, verify cooling flow, check electrical connections.',
    overallTurbine: 'Comprehensive inspection recommended. Review all subsystem parameters.',
  };
  return recs[key] || 'Perform detailed inspection per OEM guidelines.';
}
