// Historical Reliability Analytics UI
import { TURBINE_FLEET } from '../data/turbines.js';
import { simulator } from '../data/simulator.js';
import { TimelineChart } from '../charts/timeline.js';

let histChart = null;
let histInterval = null;

export function initHistory(container) {
  container.innerHTML = buildHistoryHTML();
  updateHistory(container);
  histInterval = setInterval(() => updateHistory(container), 15000);
  return () => clearInterval(histInterval);
}

export function destroyHistory() {
  if (histInterval) clearInterval(histInterval);
}

function buildHistoryHTML() {
  return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">📚</span> Historical Reliability Analytics</div>
        <div class="section-desc">Fleet-wide reliability metrics, availability trends, and failure history</div>
      </div>
    </div>

    <!-- Reliability KPIs -->
    <div class="grid grid-4" style="margin-bottom:var(--space-4)">
      <div class="kpi-tile">
        <div class="kpi-label">Fleet Availability</div>
        <div class="kpi-value" style="color:var(--green)">87.4<span class="kpi-unit">%</span></div>
        <div class="kpi-trend down">↑ +1.2% vs last month</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">MTBF (Mean Time Between Failures)</div>
        <div class="kpi-value" style="color:var(--accent-cyan)">2,840<span class="kpi-unit">hrs</span></div>
        <div class="kpi-trend down">↑ Improving</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Forced Outages (YTD)</div>
        <div class="kpi-value" style="color:var(--orange)">7<span class="kpi-unit"> events</span></div>
        <div class="kpi-trend up">↓ -2 vs last year</div>
      </div>
      <div class="kpi-tile">
        <div class="kpi-label">Avg Thermal Efficiency</div>
        <div class="kpi-value" style="color:var(--accent-blue)">37.8<span class="kpi-unit">%</span></div>
        <div class="kpi-trend up">↓ -0.4% degradation</div>
      </div>
    </div>

    <!-- 24h trend chart -->
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-header">
        <div class="card-title">Bearing Temperature Trend — Last 48 Hours (Fleet Avg)</div>
        <div class="card-subtitle">Historical trend with simulated data</div>
      </div>
      <div class="chart-container" style="height:220px">
        <canvas id="hist-chart" height="220"></canvas>
      </div>
    </div>

    <!-- Fleet reliability table -->
    <div class="card" style="margin-bottom:var(--space-4)">
      <div class="card-title" style="margin-bottom:var(--space-4)">Unit Reliability Summary</div>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Station</th>
              <th>Type</th>
              <th>Total Op. Hours</th>
              <th>Start-Stop Cycles</th>
              <th>Install Year</th>
              <th>Health Score</th>
              <th>Last Maintenance</th>
              <th>Forced Outages (Est.)</th>
            </tr>
          </thead>
          <tbody>
            ${TURBINE_FLEET.map(t => {
              const forcedOutages = Math.max(0, Math.round((100 - t.healthScore) / 8));
              const healthColor = t.healthScore >= 85 ? 'var(--green)' : t.healthScore >= 70 ? 'var(--yellow)' : 'var(--orange)';
              return `
                <tr>
                  <td style="font-family:'JetBrains Mono',monospace;font-weight:700;color:var(--text-accent)">${t.id}</td>
                  <td style="font-size:12px">${t.station}</td>
                  <td style="font-size:12px;color:var(--text-secondary)">${t.type}</td>
                  <td style="font-family:'JetBrains Mono',monospace">${t.totalOperatingHours.toLocaleString()} hrs</td>
                  <td style="font-family:'JetBrains Mono',monospace">${t.startStopCycles}</td>
                  <td style="font-family:'JetBrains Mono',monospace">${t.installYear}</td>
                  <td>
                    <span style="color:${healthColor};font-weight:700;font-family:'JetBrains Mono',monospace">${t.healthScore}%</span>
                    <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${t.healthScore}%;--fill-start:${healthColor};--fill-end:${healthColor}"></div></div>
                  </td>
                  <td style="font-size:12px">${t.lastMaintenance}</td>
                  <td style="font-family:'JetBrains Mono',monospace;color:${forcedOutages > 3 ? 'var(--red)' : forcedOutages > 1 ? 'var(--orange)' : 'var(--green)'}">${forcedOutages}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Efficiency Degradation -->
    <div class="card">
      <div class="card-title" style="margin-bottom:var(--space-4)">Efficiency Degradation by Unit</div>
      <div class="grid grid-3" id="hist-efficiency-grid"></div>
    </div>
  `;
}

function updateHistory(container) {
  renderHistChart(container);
  renderEfficiencyGrid(container);
}

function renderHistChart(container) {
  const canvas = container.querySelector('#hist-chart');
  if (!canvas) return;

  if (!histChart || histChart.canvas !== canvas) {
    histChart = new TimelineChart(canvas);
  }

  // Aggregate bearing temperature history across all running turbines
  const allHist = TURBINE_FLEET
    .filter(t => t.status !== 'offline')
    .map(t => simulator.getHistory(t.id, 48))
    .filter(h => h.length > 0);

  if (allHist.length === 0) return;

  const maxLen = Math.max(...allHist.map(h => h.length));
  const avgHist = Array.from({ length: maxLen }, (_, i) => {
    const vals = allHist.map(h => h[i]?.bearingTemperature).filter(v => v !== undefined);
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }).filter(v => v !== null);

  histChart.render(avgHist, [], [], [], 105, {
    unit: '°C',
    decimals: 1,
    xLabels: [
      { index: 0, label: '-48h' },
      { index: Math.floor(avgHist.length / 4), label: '-36h' },
      { index: Math.floor(avgHist.length / 2), label: '-24h' },
      { index: Math.floor(avgHist.length * 3 / 4), label: '-12h' },
      { index: avgHist.length - 1, label: 'Now' },
    ],
  });
}

function renderEfficiencyGrid(container) {
  const grid = container.querySelector('#hist-efficiency-grid');
  if (!grid) return;

  grid.innerHTML = TURBINE_FLEET.map(t => {
    const readings = simulator.getCurrentReadings(t.id);
    const eff = readings?.efficiency || 0;
    const designEff = 41.0;
    const degradation = ((designEff - eff) / designEff * 100).toFixed(1);
    const color = eff >= 39 ? 'var(--green)' : eff >= 36 ? 'var(--yellow)' : 'var(--orange)';

    return `
      <div class="kpi-tile">
        <div class="kpi-label">${t.id} — Thermal Efficiency</div>
        <div class="kpi-value" style="color:${color}">${eff.toFixed(1)}<span class="kpi-unit">%</span></div>
        <div style="font-size:11px;color:var(--text-secondary)">Design: ${designEff}% | Degradation: <span style="color:var(--orange)">${degradation}%</span></div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" style="width:${(eff/designEff*100).toFixed(0)}%;--fill-start:${color};--fill-end:${color}"></div>
        </div>
      </div>
    `;
  }).join('');
}
