// Alert Management UI
import { getAlerts, acknowledgeAlert, dismissAlert, escalateAlert, getAlertCountsByLevel, ALERT_COLORS, ALERT_LABELS } from '../engine/alerts.js';

let alertFilter = 'all';
let alertInterval = null;

export function initAlertsUI(container) {
  container.innerHTML = buildAlertsHTML();
  setupAlertControls(container);
  updateAlertsUI(container);
  alertInterval = setInterval(() => updateAlertsUI(container), 5000);
  return () => clearInterval(alertInterval);
}

export function destroyAlertsUI() {
  if (alertInterval) clearInterval(alertInterval);
}

function buildAlertsHTML() {
  return `
    <div class="section-header">
      <div>
        <div class="section-title"><span class="icon">🔔</span> Alert Management</div>
        <div class="section-desc">Active alerts sorted by severity across all turbine units</div>
      </div>
      <button class="btn btn-outline" id="clear-dismissed-btn">Clear Dismissed</button>
    </div>

    <!-- Summary counts -->
    <div class="grid grid-4" id="alert-counts" style="margin-bottom:var(--space-4)"></div>

    <!-- Filter tabs -->
    <div style="display:flex;gap:var(--space-2);margin-bottom:var(--space-4);flex-wrap:wrap;align-items:center">
      <span style="font-size:12px;color:var(--text-muted);font-weight:600">Filter:</span>
      <div class="tabs" style="flex:none">
        <button class="tab active" data-alert-filter="all">All</button>
        <button class="tab" data-alert-filter="red" style="color:var(--red)">🔴 Critical</button>
        <button class="tab" data-alert-filter="orange" style="color:var(--orange)">🟠 Alert</button>
        <button class="tab" data-alert-filter="yellow" style="color:var(--yellow)">🟡 Warning</button>
      </div>
      <label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);cursor:pointer;margin-left:auto">
        <input type="checkbox" id="hide-ack" style="accent-color:var(--accent-blue)"> Hide Acknowledged
      </label>
    </div>

    <!-- Alert list -->
    <div id="alert-list"></div>
  `;
}

function setupAlertControls(container) {
  container.addEventListener('click', (e) => {
    const filterBtn = e.target.closest('[data-alert-filter]');
    if (filterBtn) {
      alertFilter = filterBtn.dataset.alertFilter;
      container.querySelectorAll('[data-alert-filter]').forEach(b => b.classList.remove('active'));
      filterBtn.classList.add('active');
      updateAlertsUI(container);
    }

    const ackBtn = e.target.closest('[data-ack]');
    if (ackBtn) { acknowledgeAlert(ackBtn.dataset.ack); updateAlertsUI(container); }

    const dismissBtn = e.target.closest('[data-dismiss]');
    if (dismissBtn) { dismissAlert(dismissBtn.dataset.dismiss); updateAlertsUI(container); }

    const escalateBtn = e.target.closest('[data-escalate]');
    if (escalateBtn) { escalateAlert(escalateBtn.dataset.escalate); updateAlertsUI(container); }
  });

  container.addEventListener('change', (e) => {
    if (e.target.id === 'hide-ack') updateAlertsUI(container);
  });
}

function updateAlertsUI(container) {
  const counts = getAlertCountsByLevel();
  renderAlertCounts(container, counts);

  const hideAck = container.querySelector('#hide-ack')?.checked;
  const filters = {
    hideDismissed: true,
    hideAcknowledged: hideAck,
  };
  if (alertFilter !== 'all') filters.level = alertFilter;

  const alerts = getAlerts(filters);
  renderAlertList(container, alerts);
}

function renderAlertCounts(container, counts) {
  const grid = container.querySelector('#alert-counts');
  if (!grid) return;

  const items = [
    { label: 'Critical', count: counts.red, color: 'var(--red)', bg: 'var(--red-bg)', icon: '🔴' },
    { label: 'Alert', count: counts.orange, color: 'var(--orange)', bg: 'var(--orange-bg)', icon: '🟠' },
    { label: 'Warning', count: counts.yellow, color: 'var(--yellow)', bg: 'var(--yellow-bg)', icon: '🟡' },
    { label: 'Total Active', count: counts.total, color: 'var(--text-primary)', bg: 'var(--bg-card-elevated)', icon: '🔔' },
  ];

  grid.innerHTML = items.map(item => `
    <div class="kpi-tile" style="background:${item.bg};border-color:${item.color}30">
      <div class="kpi-label">${item.icon} ${item.label}</div>
      <div class="kpi-value" style="color:${item.color}">${item.count}</div>
    </div>
  `).join('');
}

function renderAlertList(container, alerts) {
  const list = container.querySelector('#alert-list');
  if (!list) return;

  if (alerts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-title">No Active Alerts</div>
        <div class="empty-state-desc">All parameters are within normal operating ranges</div>
      </div>
    `;
    return;
  }

  list.innerHTML = alerts.map(alert => {
    const timeStr = new Date(alert.timestamp).toLocaleString('en-IN', { hour12: false });
    return `
      <div class="alert-card ${alert.level}" id="alert-${alert.id}" style="margin-bottom:var(--space-3)">
        <div class="alert-header">
          <div>
            <div class="alert-title">
              ${alert.level === 'red' ? '🔴' : alert.level === 'orange' ? '🟠' : '🟡'}
              ${alert.turbineId} — ${alert.paramLabel}
              ${alert.escalated ? '<span style="color:var(--red);font-size:11px;margin-left:6px">⬆ ESCALATED</span>' : ''}
              ${alert.acknowledged ? '<span style="color:var(--text-muted);font-size:11px;margin-left:6px">✓ Acknowledged</span>' : ''}
            </div>
            <div class="alert-meta">
              <span>${alert.type === 'forecast' ? '📈 Forecast Alert' : '⚡ Active Alert'}</span>
              <span>•</span>
              <span>${timeStr}</span>
              <span>•</span>
              <span>${alert.id}</span>
            </div>
          </div>
          <span class="status-badge ${alert.level}">${ALERT_LABELS[alert.level]?.toUpperCase()}</span>
        </div>
        <div class="alert-body">${alert.message}</div>
        <div class="alert-stats">
          <div class="alert-stat">
            <div class="alert-stat-label">Current</div>
            <div class="alert-stat-value" style="color:${ALERT_COLORS[alert.level]}">${alert.value?.toFixed?.(2) ?? alert.value} ${''}</div>
          </div>
          ${alert.predicted !== undefined ? `
            <div class="alert-stat">
              <div class="alert-stat-label">Predicted</div>
              <div class="alert-stat-value" style="color:var(--orange)">${alert.predicted?.toFixed?.(2) ?? alert.predicted}</div>
            </div>
          ` : ''}
          <div class="alert-stat">
            <div class="alert-stat-label">OEM Limit</div>
            <div class="alert-stat-value" style="color:var(--red)">${alert.oemLimit}</div>
          </div>
          ${alert.daysToBreach !== null && alert.daysToBreach !== undefined ? `
            <div class="alert-stat">
              <div class="alert-stat-label">Days to Breach</div>
              <div class="alert-stat-value" style="color:var(--red)">${alert.daysToBreach}d</div>
            </div>
          ` : ''}
        </div>
        <div class="alert-actions">
          ${!alert.acknowledged ? `<button class="btn btn-sm btn-success" data-ack="${alert.id}">✓ Acknowledge</button>` : ''}
          ${!alert.escalated ? `<button class="btn btn-sm btn-outline" data-escalate="${alert.id}">⬆ Escalate</button>` : ''}
          <button class="btn btn-sm btn-outline" data-dismiss="${alert.id}">✕ Dismiss</button>
        </div>
      </div>
    `;
  }).join('');
}
