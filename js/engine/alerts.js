// ============================================================
// Alert Engine
// Generates structured alerts from sensor readings + forecasts
// ============================================================

import { OEM_LIMITS, getAlertLevel } from '../data/oem-limits.js';
import { TURBINE_FLEET } from '../data/turbines.js';

let alertRegistry = [];
let alertIdCounter = 1;

const ALERT_COLORS = {
  green: '#10b981',
  yellow: '#f59e0b',
  orange: '#f97316',
  red: '#ef4444',
};

const ALERT_LABELS = {
  green: 'Normal',
  yellow: 'Warning',
  orange: 'Alert',
  red: 'Critical',
};

/**
 * Generate alerts by comparing current readings against OEM limits
 * and forecasted values.
 */
export function generateAlerts(turbineId, readings, forecastResults = {}) {
  const turbine = TURBINE_FLEET.find(t => t.id === turbineId);
  if (!turbine) return [];

  const newAlerts = [];
  const now = Date.now();

  Object.entries(readings).forEach(([paramKey, value]) => {
    const limits = OEM_LIMITS[paramKey];
    if (!limits) return;

    const currentLevel = getAlertLevel(paramKey, value);
    if (currentLevel === 'green') {
      // Check if forecast will breach
      const fc = forecastResults[paramKey];
      if (fc) {
        const level30d = fc.alertLevel;
        if (level30d !== 'green') {
          newAlerts.push(createAlert({
            turbineId,
            turbineName: turbine.name,
            paramKey,
            paramLabel: limits.label,
            level: level30d,
            value,
            unit: limits.unit,
            predicted: fc.forecast?.h30d?.forecast?.at(-1),
            oemLimit: limits.critical,
            daysToBreach: fc.daysToBreach,
            type: 'forecast',
            timestamp: now,
            message: buildForecastMessage(turbine.id, limits, value, fc, level30d),
          }));
        }
      }
    } else {
      // Current value already in warning / alert / critical zone
      const fc = forecastResults[paramKey];
      newAlerts.push(createAlert({
        turbineId,
        turbineName: turbine.name,
        paramKey,
        paramLabel: limits.label,
        level: currentLevel,
        value,
        unit: limits.unit,
        predicted: fc?.forecast?.h7d?.forecast?.at(-1),
        oemLimit: limits.critical,
        daysToBreach: fc?.daysToBreach,
        type: 'current',
        timestamp: now,
        message: buildCurrentMessage(turbine.id, limits, value, currentLevel),
      }));
    }
  });

  // Deduplicate — only add if no recent identical alert exists
  newAlerts.forEach(alert => {
    const exists = alertRegistry.find(
      a => a.turbineId === alert.turbineId &&
           a.paramKey === alert.paramKey &&
           a.level === alert.level &&
           !a.acknowledged &&
           (now - a.timestamp) < 3600000 // < 1 hour old
    );
    if (!exists) {
      alertRegistry.push(alert);
    }
  });

  // Keep max 500 alerts
  if (alertRegistry.length > 500) alertRegistry = alertRegistry.slice(-500);

  return alertRegistry;
}

function createAlert(props) {
  return {
    id: `ALT-${String(alertIdCounter++).padStart(5, '0')}`,
    acknowledged: false,
    dismissed: false,
    escalated: false,
    ...props,
  };
}

function buildForecastMessage(turbineId, limits, current, fc, level) {
  const days = fc.daysToBreach;
  const predicted = fc.forecast?.h30d?.forecast?.at(-1);
  return `${turbineId}: ${limits.label} is currently ${current} ${limits.unit} but is predicted to ` +
    `${limits.inverted ? 'drop to' : 'reach'} ${predicted} ${limits.unit} within 30 days` +
    (days ? ` (OEM limit breach in ~${days} days).` : '.');
}

function buildCurrentMessage(turbineId, limits, value, level) {
  const levelLabel = ALERT_LABELS[level];
  return `${turbineId}: ${limits.label} is at ${value} ${limits.unit}, now in ${levelLabel} zone. ` +
    `OEM limit: ${limits.critical} ${limits.unit}.`;
}

export function getAlerts(filters = {}) {
  let alerts = [...alertRegistry];
  if (filters.turbineId) alerts = alerts.filter(a => a.turbineId === filters.turbineId);
  if (filters.level) alerts = alerts.filter(a => a.level === filters.level);
  if (filters.hideAcknowledged) alerts = alerts.filter(a => !a.acknowledged);
  if (filters.hideDismissed) alerts = alerts.filter(a => !a.dismissed);
  return alerts.sort((a, b) => {
    const order = { red: 0, orange: 1, yellow: 2, green: 3 };
    return (order[a.level] - order[b.level]) || (b.timestamp - a.timestamp);
  });
}

export function acknowledgeAlert(id) {
  const alert = alertRegistry.find(a => a.id === id);
  if (alert) alert.acknowledged = true;
}

export function dismissAlert(id) {
  const alert = alertRegistry.find(a => a.id === id);
  if (alert) alert.dismissed = true;
}

export function escalateAlert(id) {
  const alert = alertRegistry.find(a => a.id === id);
  if (alert) alert.escalated = true;
}

export function getAlertCountsByLevel() {
  const active = alertRegistry.filter(a => !a.dismissed);
  return {
    red: active.filter(a => a.level === 'red').length,
    orange: active.filter(a => a.level === 'orange').length,
    yellow: active.filter(a => a.level === 'yellow').length,
    green: active.filter(a => a.level === 'green').length,
    total: active.length,
  };
}

export { ALERT_COLORS, ALERT_LABELS };
