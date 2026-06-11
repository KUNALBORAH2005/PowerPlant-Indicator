// ============================================================
// Realistic Turbine Sensor Data Simulator
// Generates time-series data with realistic drift, noise, and
// degradation patterns for each turbine and parameter.
// ============================================================

import { TURBINE_FLEET } from './turbines.js';
import { OEM_LIMITS } from './oem-limits.js';

// Seeded pseudo-random number generator for reproducibility
function seededRng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// Normal distribution approximation (Box-Muller)
function gaussianNoise(rng, mean = 0, std = 1) {
  const u1 = rng();
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

// Base current readings per turbine, anchored realistically
const BASE_READINGS = {
  'GT-01': {
    bearingTemperature: 72,
    turbineInletTemp: 1055,
    turbineExhaustTemp: 532,
    lubOilTemperature: 57,
    generatorWindingTemp: 98,
    coolingSystemTemp: 34,
    shaftVibration: 2.1,
    rotorVibration: 1.9,
    axialVibration: 1.2,
    radialVibration: 1.7,
    bearingVibration: 1.5,
    lubOilPressure: 3.4,
    oilFlowRate: 108,
    turbineLoad: 82,
    powerOutput: 81,
    fuelConsumption: 0.72,
    efficiency: 39.5,
    operatingHours: 42800,
  },
  'GT-02': {
    bearingTemperature: 79,
    turbineInletTemp: 1080,
    turbineExhaustTemp: 548,
    lubOilTemperature: 63,
    generatorWindingTemp: 112,
    coolingSystemTemp: 37,
    shaftVibration: 2.9,
    rotorVibration: 2.6,
    axialVibration: 1.8,
    radialVibration: 2.3,
    bearingVibration: 2.2,
    lubOilPressure: 2.8,
    oilFlowRate: 95,
    turbineLoad: 88,
    powerOutput: 87,
    fuelConsumption: 0.80,
    efficiency: 37.8,
    operatingHours: 38400,
  },
  'GT-03': {
    bearingTemperature: 91,
    turbineInletTemp: 1120,
    turbineExhaustTemp: 575,
    lubOilTemperature: 74,
    generatorWindingTemp: 128,
    coolingSystemTemp: 43,
    shaftVibration: 4.1,
    rotorVibration: 3.8,
    axialVibration: 2.9,
    radialVibration: 3.5,
    bearingVibration: 3.7,
    lubOilPressure: 1.9,
    oilFlowRate: 72,
    turbineLoad: 72,
    powerOutput: 70,
    fuelConsumption: 0.88,
    efficiency: 34.2,
    operatingHours: 51200,
  },
  'GT-04': {
    bearingTemperature: 62,
    turbineInletTemp: 980,
    turbineExhaustTemp: 505,
    lubOilTemperature: 51,
    generatorWindingTemp: 88,
    coolingSystemTemp: 31,
    shaftVibration: 1.6,
    rotorVibration: 1.4,
    axialVibration: 0.9,
    radialVibration: 1.3,
    bearingVibration: 1.1,
    lubOilPressure: 3.7,
    oilFlowRate: 115,
    turbineLoad: 128,
    powerOutput: 131,
    fuelConsumption: 0.61,
    efficiency: 41.2,
    operatingHours: 29600,
  },
  'GT-05': {
    bearingTemperature: 68,
    turbineInletTemp: 1010,
    turbineExhaustTemp: 518,
    lubOilTemperature: 59,
    generatorWindingTemp: 104,
    coolingSystemTemp: 35,
    shaftVibration: 2.4,
    rotorVibration: 2.1,
    axialVibration: 1.5,
    radialVibration: 2.0,
    bearingVibration: 1.8,
    lubOilPressure: 3.1,
    oilFlowRate: 102,
    turbineLoad: 0,       // In maintenance
    powerOutput: 0,
    fuelConsumption: 0,
    efficiency: 38.5,
    operatingHours: 22100,
  },
  'GT-06': {
    bearingTemperature: 84,
    turbineInletTemp: 1095,
    turbineExhaustTemp: 562,
    lubOilTemperature: 68,
    generatorWindingTemp: 120,
    coolingSystemTemp: 41,
    shaftVibration: 3.4,
    rotorVibration: 3.1,
    axialVibration: 2.4,
    radialVibration: 2.9,
    bearingVibration: 3.0,
    lubOilPressure: 2.4,
    oilFlowRate: 83,
    turbineLoad: 178,
    powerOutput: 176,
    fuelConsumption: 0.95,
    efficiency: 35.8,
    operatingHours: 18900,
  },
};

// Drift rates per hour (positive = increasing, negative = decreasing)
// Simulates ongoing degradation trends
const DRIFT_RATES = {
  'GT-01': { bearingTemperature: 0.08, shaftVibration: 0.005, lubOilPressure: -0.002, operatingHours: 1 },
  'GT-02': { bearingTemperature: 0.12, shaftVibration: 0.008, lubOilPressure: -0.004, operatingHours: 1 },
  'GT-03': { bearingTemperature: 0.22, shaftVibration: 0.018, lubOilPressure: -0.009, lubOilTemperature: 0.15, operatingHours: 1 },
  'GT-04': { bearingTemperature: 0.04, shaftVibration: 0.003, lubOilPressure: -0.001, operatingHours: 1 },
  'GT-05': { bearingTemperature: 0.06, shaftVibration: 0.006, lubOilPressure: -0.002, operatingHours: 0 },
  'GT-06': { bearingTemperature: 0.16, shaftVibration: 0.012, lubOilPressure: -0.007, lubOilTemperature: 0.10, operatingHours: 1 },
};

// Noise standard deviations per parameter
const NOISE_STD = {
  bearingTemperature: 0.8,
  turbineInletTemp: 4.0,
  turbineExhaustTemp: 3.0,
  lubOilTemperature: 0.6,
  generatorWindingTemp: 1.5,
  coolingSystemTemp: 0.4,
  shaftVibration: 0.05,
  rotorVibration: 0.04,
  axialVibration: 0.03,
  radialVibration: 0.04,
  bearingVibration: 0.04,
  lubOilPressure: 0.03,
  oilFlowRate: 0.8,
  turbineLoad: 1.2,
  powerOutput: 1.0,
  fuelConsumption: 0.005,
  efficiency: 0.2,
  operatingHours: 0,
};

class TurbineSimulator {
  constructor() {
    this.state = {};
    this.history = {};   // last 48 hours of readings
    this.rngs = {};
    this.initTime = Date.now();

    TURBINE_FLEET.forEach(turbine => {
      const rng = seededRng(turbine.id.charCodeAt(0) * 31 + turbine.id.charCodeAt(1));
      this.rngs[turbine.id] = rng;
      this.state[turbine.id] = { ...BASE_READINGS[turbine.id] };
      this.history[turbine.id] = this._generateHistory(turbine.id, 48);
    });
  }

  // Generate historical hourly readings going backwards from now
  _generateHistory(turbineId, hours) {
    const rng = seededRng(turbineId.charCodeAt(0) * 97);
    const hist = [];
    const base = { ...BASE_READINGS[turbineId] };
    const drifts = DRIFT_RATES[turbineId] || {};
    const now = Date.now();

    for (let h = hours; h >= 0; h--) {
      const ts = now - h * 3600 * 1000;
      const reading = { timestamp: ts };
      Object.keys(base).forEach(param => {
        if (param === 'operatingHours') {
          reading[param] = base[param] - h;
          return;
        }
        const drift = (drifts[param] || 0) * (-h); // negative because we go back
        const noise = gaussianNoise(rng, 0, NOISE_STD[param] || 0.1);
        reading[param] = +(base[param] + drift + noise).toFixed(3);
      });
      hist.push(reading);
    }
    return hist;
  }

  // Tick the simulator forward by one second (called on interval)
  tick() {
    const dtHours = 5 / 3600; // Update every 5 seconds, expressed in hours

    TURBINE_FLEET.forEach(turbine => {
      if (turbine.status === 'offline') return;
      const state = this.state[turbine.id];
      const drifts = DRIFT_RATES[turbine.id] || {};
      const rng = this.rngs[turbine.id];

      Object.keys(state).forEach(param => {
        const drift = (drifts[param] || 0) * dtHours;
        const noise = gaussianNoise(rng, 0, (NOISE_STD[param] || 0.1) * 0.2);
        const limits = OEM_LIMITS[param];

        if (param === 'operatingHours') {
          if (turbine.status === 'running') state[param] += dtHours;
          return;
        }

        let newVal = state[param] + drift + noise;

        // Clamp to reasonable physical bounds
        if (limits && !limits.inverted) {
          newVal = Math.max(limits.normal.min * 0.85, Math.min(limits.critical * 1.05, newVal));
        } else if (limits && limits.inverted) {
          newVal = Math.max(limits.critical * 0.8, Math.min(limits.normal.max * 1.1, newVal));
        }

        state[param] = +newVal.toFixed(3);
      });

      // Push to history (throttled to once per minute equivalent)
      const lastHist = this.history[turbine.id].at(-1);
      if (!lastHist || Date.now() - lastHist.timestamp > 60000) {
        this.history[turbine.id].push({ timestamp: Date.now(), ...state });
        if (this.history[turbine.id].length > 720) {
          this.history[turbine.id].shift(); // Keep max 720 entries (30 days hourly)
        }
      }
    });
  }

  getCurrentReadings(turbineId) {
    return this.state[turbineId] ? { ...this.state[turbineId] } : null;
  }

  getHistory(turbineId, hours = 24) {
    const hist = this.history[turbineId] || [];
    const cutoff = Date.now() - hours * 3600 * 1000;
    return hist.filter(r => r.timestamp >= cutoff);
  }

  getAllCurrentReadings() {
    const result = {};
    TURBINE_FLEET.forEach(t => {
      result[t.id] = this.getCurrentReadings(t.id);
    });
    return result;
  }
}

// Singleton export
export const simulator = new TurbineSimulator();
