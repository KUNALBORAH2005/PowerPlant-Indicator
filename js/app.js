// ============================================================
// APGCL Turbine Health Monitoring System — Main App
// ============================================================

import { simulator } from './data/simulator.js';
import { generateAlerts } from './engine/alerts.js';
import { forecastParameter } from './engine/forecast.js';
import { OEM_LIMITS } from './data/oem-limits.js';
import { TURBINE_FLEET } from './data/turbines.js';

import { initDashboard, destroyDashboard } from './ui/dashboard.js';
import { initForecasting, destroyForecasting } from './ui/forecasting.js';
import { initPrediction, destroyPrediction } from './ui/prediction.js';
import { initCompliance, destroyCompliance } from './ui/compliance.js';
import { initAlertsUI, destroyAlertsUI } from './ui/alerts-ui.js';
import { initHistory, destroyHistory } from './ui/history.js';
import { initNotifications, showNotificationModal, showToast } from './ui/notifications.js';

// ============================================================
// ROUTER
// ============================================================
const PAGES = {
  dashboard: {
    title: 'Turbine Health Dashboard',
    subtitle: 'Live Fleet Status — APGCL',
    init: initDashboard,
    destroy: destroyDashboard,
  },
  forecasting: {
    title: 'Parameter Forecasting',
    subtitle: 'AI Holt-Winters Trend Prediction',
    init: initForecasting,
    destroy: destroyForecasting,
  },
  prediction: {
    title: 'Failure Prediction',
    subtitle: 'AI-Based Failure Probability Analysis',
    init: initPrediction,
    destroy: destroyPrediction,
  },
  compliance: {
    title: 'OEM Compliance',
    subtitle: 'Parameter Limits & Maintenance Schedule',
    init: initCompliance,
    destroy: destroyCompliance,
  },
  alerts: {
    title: 'Alert Management',
    subtitle: 'Active Alerts & Notification System',
    init: initAlertsUI,
    destroy: destroyAlertsUI,
  },
  history: {
    title: 'Historical Analytics',
    subtitle: 'Reliability Trends & Outage History',
    init: initHistory,
    destroy: destroyHistory,
  },
};

let currentPage = null;

function navigate(pageId) {
  if (!PAGES[pageId]) return;
  if (currentPage && PAGES[currentPage]?.destroy) PAGES[currentPage].destroy();

  currentPage = pageId;

  // Update nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === pageId);
  });

  // Update header
  const page = PAGES[pageId];
  document.getElementById('header-title').textContent = page.title;
  document.getElementById('header-subtitle').textContent = page.subtitle;

  // Show correct page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${pageId}`)?.classList.add('active');

  // Init page
  const container = document.getElementById(`page-${pageId}`);
  if (container && page.init) page.init(container);

  // Update URL hash
  window.location.hash = pageId;
}

// ============================================================
// SIMULATOR LOOP
// ============================================================
function startSimulator() {
  setInterval(() => {
    simulator.tick();
  }, 5000);

  // Generate alerts periodically
  setInterval(() => {
    const allReadings = simulator.getAllCurrentReadings();
    TURBINE_FLEET.forEach(turbine => {
      const readings = allReadings[turbine.id];
      if (!readings) return;

      // Generate some forecast results for alert enrichment
      const hist = simulator.getHistory(turbine.id, 24);
      const forecastResults = {};
      ['bearingTemperature', 'shaftVibration', 'lubOilPressure', 'lubOilTemperature'].forEach(param => {
        const vals = hist.map(h => h[param]).filter(v => v !== undefined);
        const fc = forecastParameter(turbine.id, param, vals);
        if (fc) forecastResults[param] = fc;
      });

      generateAlerts(turbine.id, readings, forecastResults);
    });

    updateAlertBadge();
  }, 15000);
}

// ============================================================
// ALERT BADGE UPDATE
// ============================================================
function updateAlertBadge() {
  const { getAlertCountsByLevel } = window.__alertEngine || {};
  if (!getAlertCountsByLevel) return;
  const counts = getAlertCountsByLevel();
  const badge = document.getElementById('alert-nav-badge');
  if (badge) {
    badge.textContent = counts.red + counts.orange;
    badge.style.display = counts.red + counts.orange > 0 ? '' : 'none';
  }
}

// ============================================================
// CLOCK
// ============================================================
function startClock() {
  const el = document.getElementById('header-clock');
  if (!el) return;
  const update = () => {
    el.textContent = new Date().toLocaleString('en-IN', {
      hour12: false,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  update();
  setInterval(update, 1000);
}

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initNotifications();
  startSimulator();
  startClock();

  // Generate initial alerts
  setTimeout(() => {
    const allReadings = simulator.getAllCurrentReadings();
    TURBINE_FLEET.forEach(turbine => {
      const readings = allReadings[turbine.id];
      if (!readings) return;
      const hist = simulator.getHistory(turbine.id, 24);
      const forecastResults = {};
      ['bearingTemperature', 'shaftVibration', 'lubOilPressure'].forEach(param => {
        const vals = hist.map(h => h[param]).filter(v => v !== undefined);
        const fc = forecastParameter(turbine.id, param, vals);
        if (fc) forecastResults[param] = fc;
      });
      generateAlerts(turbine.id, readings, forecastResults);
    });
    updateAlertBadge();

    // Show welcome toast
    showToast('APGCL Monitoring System Online — AI Engine Active', 'green', 4000);
    setTimeout(() => showToast('GT-03: Critical bearing temperature trend detected', 'red', 6000), 2000);
  }, 1000);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => navigate(item.dataset.page));
  });

  // Notification button
  document.getElementById('notif-btn')?.addEventListener('click', () => {
    showNotificationModal(document.body);
  });

  // Route from hash or default
  const hash = window.location.hash.replace('#', '');
  navigate(PAGES[hash] ? hash : 'dashboard');
});
