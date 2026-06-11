// ============================================================
// AI Forecasting Engine
// Holt-Winters Double Exponential Smoothing with trend
// ============================================================

import { OEM_LIMITS } from '../data/oem-limits.js';

// Smoothing parameters
const ALPHA = 0.3;  // Level smoothing
const BETA = 0.15;  // Trend smoothing

/**
 * Forecast future values using Holt-Winters double exponential smoothing
 * @param {number[]} series - Historical time series values
 * @param {number} steps - Number of steps to forecast
 * @param {number} noiseStd - Noise standard deviation for confidence bands
 * @returns {{ forecast: number[], upper: number[], lower: number[] }}
 */
export function holtwintersForecast(series, steps, noiseStd = 1.0) {
  if (!series || series.length < 2) {
    const last = series?.[0] ?? 0;
    return {
      forecast: Array(steps).fill(last),
      upper: Array(steps).fill(last + noiseStd * 2),
      lower: Array(steps).fill(last - noiseStd * 2),
    };
  }

  // Initialize level and trend
  let level = series[0];
  let trend = series[1] - series[0];

  for (let i = 1; i < series.length; i++) {
    const prevLevel = level;
    level = ALPHA * series[i] + (1 - ALPHA) * (level + trend);
    trend = BETA * (level - prevLevel) + (1 - BETA) * trend;
  }

  const forecast = [];
  const upper = [];
  const lower = [];

  for (let h = 1; h <= steps; h++) {
    const val = level + h * trend;
    const ci = noiseStd * Math.sqrt(h) * 1.96; // 95% confidence interval
    forecast.push(+val.toFixed(3));
    upper.push(+(val + ci).toFixed(3));
    lower.push(+(val - ci).toFixed(3));
  }

  return { forecast, upper, lower };
}

/**
 * Forecast a specific parameter for a turbine across multiple horizons
 * @param {string} turbineId
 * @param {string} paramKey
 * @param {number[]} historicalValues - Array of historical readings
 * @returns {ForecastResult}
 */
export function forecastParameter(turbineId, paramKey, historicalValues) {
  const limits = OEM_LIMITS[paramKey];
  if (!limits || !historicalValues || historicalValues.length === 0) return null;

  const noiseStd = estimateNoiseStd(historicalValues);

  // Generate forecasts for different horizons (in hours)
  const horizons = {
    h24: 24,
    h7d: 168,
    h30d: 720,
    h90d: 2160,
  };

  const results = {};
  Object.entries(horizons).forEach(([key, steps]) => {
    results[key] = holtwintersForecast(historicalValues, steps, noiseStd);
  });

  const currentValue = historicalValues.at(-1);
  const trend24h = (results.h24.forecast.at(-1) - currentValue);
  const trendDir = trend24h > 0.01 ? 'rising' : trend24h < -0.01 ? 'falling' : 'stable';

  // Find when (if ever) the forecast breaches the OEM critical limit
  const daysToBreach = computeDaysToBreach(results.h90d.forecast, limits, 2160);

  // Alert level based on 30-day forecast
  const val30d = results.h30d.forecast.at(-1);
  const alertLevel = getAlertLevelFromForecast(paramKey, currentValue, val30d, limits);

  return {
    paramKey,
    label: limits.label,
    unit: limits.unit,
    current: currentValue,
    forecast: results,
    trend: trendDir,
    trend24hDelta: +trend24h.toFixed(3),
    daysToBreach,
    alertLevel,
    oemCritical: limits.critical,
    oemWarning: limits.warning,
    oemAlert: limits.alert,
    inverted: limits.inverted,
  };
}

function estimateNoiseStd(series) {
  if (series.length < 2) return 0.5;
  const diffs = series.slice(1).map((v, i) => Math.abs(v - series[i]));
  const mean = diffs.reduce((a, b) => a + b, 0) / diffs.length;
  return Math.max(0.01, mean * 0.7);
}

function computeDaysToBreach(forecastValues, limits, totalStepsHours) {
  const hoursPerStep = totalStepsHours / forecastValues.length;
  for (let i = 0; i < forecastValues.length; i++) {
    const v = forecastValues[i];
    if (limits.inverted) {
      if (v <= limits.critical) return +((i * hoursPerStep) / 24).toFixed(1);
    } else {
      if (v >= limits.critical) return +((i * hoursPerStep) / 24).toFixed(1);
    }
  }
  return null; // No breach predicted in horizon
}

function getAlertLevelFromForecast(paramKey, current, forecast30d, limits) {
  const checkVal = Math.max(current, forecast30d);
  const inverted = limits.inverted;

  if (inverted) {
    const checkMin = Math.min(current, forecast30d);
    if (checkMin <= limits.critical) return 'red';
    if (checkMin <= limits.alert) return 'orange';
    if (checkMin <= limits.warning) return 'yellow';
    return 'green';
  } else {
    if (checkVal >= limits.critical) return 'red';
    if (checkVal >= limits.alert) return 'orange';
    if (checkVal >= limits.warning) return 'yellow';
    return 'green';
  }
}
