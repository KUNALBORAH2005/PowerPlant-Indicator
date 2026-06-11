// ============================================================
// Failure Probability Calculator
// Weighted sigmoid model combining multiple risk factors
// ============================================================

import { OEM_LIMITS, getLimitPercent } from '../data/oem-limits.js';
import { TURBINE_FLEET } from '../data/turbines.js';

// Failure mode definitions with parameter weights
const FAILURE_MODES = {
  bearingFailure: {
    label: 'Bearing Failure',
    icon: '🔩',
    weights: {
      bearingTemperature: 0.30,
      bearingVibration: 0.25,
      lubOilPressure: 0.20,
      lubOilTemperature: 0.15,
      operatingHours: 0.10,
    },
    baseThreshold: 0.35,
  },
  lubricationFailure: {
    label: 'Lubrication Failure',
    icon: '🛢️',
    weights: {
      lubOilPressure: 0.35,
      oilFlowRate: 0.30,
      lubOilTemperature: 0.25,
      bearingTemperature: 0.10,
    },
    baseThreshold: 0.40,
  },
  rotorImbalance: {
    label: 'Rotor Imbalance',
    icon: '🔄',
    weights: {
      rotorVibration: 0.35,
      shaftVibration: 0.30,
      axialVibration: 0.20,
      radialVibration: 0.15,
    },
    baseThreshold: 0.30,
  },
  vibrationFailure: {
    label: 'Excessive Vibration',
    icon: '〰️',
    weights: {
      shaftVibration: 0.30,
      bearingVibration: 0.25,
      radialVibration: 0.20,
      rotorVibration: 0.25,
    },
    baseThreshold: 0.35,
  },
  thermalStress: {
    label: 'Thermal Stress Failure',
    icon: '🌡️',
    weights: {
      bearingTemperature: 0.25,
      turbineInletTemp: 0.30,
      turbineExhaustTemp: 0.25,
      generatorWindingTemp: 0.20,
    },
    baseThreshold: 0.40,
  },
  generatorFault: {
    label: 'Generator Fault',
    icon: '⚡',
    weights: {
      generatorWindingTemp: 0.40,
      coolingSystemTemp: 0.25,
      shaftVibration: 0.20,
      lubOilPressure: 0.15,
    },
    baseThreshold: 0.38,
  },
  overallTurbine: {
    label: 'Overall Turbine Failure',
    icon: '⚙️',
    weights: {
      bearingTemperature: 0.15,
      shaftVibration: 0.15,
      lubOilPressure: 0.15,
      turbineInletTemp: 0.10,
      turbineExhaustTemp: 0.10,
      rotorVibration: 0.10,
      generatorWindingTemp: 0.10,
      lubOilTemperature: 0.10,
      operatingHours: 0.05,
    },
    baseThreshold: 0.30,
  },
};

// Sigmoid activation function
function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

// Compute risk score for a single parameter
function paramRiskScore(paramKey, value) {
  const limits = OEM_LIMITS[paramKey];
  if (!limits) return 0;
  const pct = getLimitPercent(paramKey, value); // 0-100%
  // Map 0-100% to sigmoid input [-3, +3]
  const x = (pct / 100) * 6 - 3;
  return sigmoid(x);
}

/**
 * Compute failure probabilities for a turbine
 * @param {string} turbineId
 * @param {Object} readings - Current sensor readings
 * @param {number} maintenanceOverdueHours - Hours past scheduled maintenance
 * @returns {FailureAnalysis}
 */
export function computeFailureProbabilities(turbineId, readings, maintenanceOverdueHours = 0) {
  const turbine = TURBINE_FLEET.find(t => t.id === turbineId);
  if (!turbine || !readings) return null;

  const overdueBonus = Math.min(0.15, maintenanceOverdueHours / 5000 * 0.15);
  const results = {};

  Object.entries(FAILURE_MODES).forEach(([modeKey, mode]) => {
    let weightedScore = 0;
    let totalWeight = 0;
    const contributions = {};

    Object.entries(mode.weights).forEach(([paramKey, weight]) => {
      const value = readings[paramKey];
      if (value === undefined || value === null) return;
      const score = paramRiskScore(paramKey, value);
      weightedScore += score * weight;
      totalWeight += weight;
      contributions[paramKey] = {
        label: OEM_LIMITS[paramKey]?.label || paramKey,
        score: +score.toFixed(3),
        weight,
        value,
        contribution: +(score * weight).toFixed(3),
      };
    });

    const rawScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const adjustedScore = Math.min(1, rawScore + overdueBonus);
    const probability = +(adjustedScore * 100).toFixed(1);

    // Estimate time to failure (rough heuristic)
    const timeToFailureDays = estimateTimeToFailure(probability, mode.baseThreshold * 100);

    // RUL estimation
    const rulHours = estimateRUL(readings, mode.weights);

    results[modeKey] = {
      label: mode.label,
      icon: mode.icon,
      probability,
      riskLevel: getRiskLevel(probability),
      timeToFailureDays,
      rulHours,
      contributions: sortContributions(contributions),
    };
  });

  return {
    turbineId,
    timestamp: Date.now(),
    failures: results,
    overallRisk: getRiskLevel(results.overallTurbine?.probability ?? 0),
    maintenanceOverdueHours,
  };
}

function estimateTimeToFailure(probability, baseThresholdPct) {
  if (probability < baseThresholdPct) return null; // Not yet at risk
  // Higher probability = sooner failure
  const daysMax = 90;
  const factor = 1 - (probability - baseThresholdPct) / (100 - baseThresholdPct);
  const days = Math.max(1, Math.round(daysMax * factor * factor));
  return days;
}

function estimateRUL(readings, weights) {
  let totalRulContrib = 0;
  let totalWeight = 0;

  Object.entries(weights).forEach(([paramKey, weight]) => {
    const value = readings[paramKey];
    if (value === undefined) return;
    const limits = OEM_LIMITS[paramKey];
    if (!limits) return;

    let pct;
    if (limits.inverted) {
      const range = limits.normal.min - limits.critical;
      pct = Math.max(0, Math.min(1, (limits.normal.min - value) / range));
    } else {
      const range = limits.critical - limits.normal.max;
      pct = Math.max(0, Math.min(1, (value - limits.normal.max) / range));
    }

    const remainingPct = 1 - pct;
    // Convert remaining margin to hours (very rough: full margin = 5000 hours)
    totalRulContrib += remainingPct * 5000 * weight;
    totalWeight += weight;
  });

  const rul = totalWeight > 0 ? totalRulContrib / totalWeight : 5000;
  return Math.round(Math.max(50, rul));
}

function getRiskLevel(probability) {
  if (probability >= 75) return 'red';
  if (probability >= 50) return 'orange';
  if (probability >= 25) return 'yellow';
  return 'green';
}

function sortContributions(contributions) {
  return Object.entries(contributions)
    .sort((a, b) => b[1].contribution - a[1].contribution)
    .map(([key, val]) => ({
      paramKey: key,
      ...val,
      contributionPct: +(val.contribution / Object.values(contributions).reduce((s, c) => s + c.contribution, 0) * 100).toFixed(1),
    }));
}

export { FAILURE_MODES, getRiskLevel };
