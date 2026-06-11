// ============================================================
// OEM Limit Definitions
// ============================================================

export const OEM_LIMITS = {
  // ----- TEMPERATURE -----
  bearingTemperature: {
    label: 'Bearing Temperature',
    unit: '°C',
    normal: { min: 40, max: 75 },
    warning: 85,       // 80% of OEM limit
    alert: 95,         // 90% of OEM limit
    critical: 105,     // OEM hard limit
    category: 'temperature',
    icon: '🌡️',
  },
  turbineInletTemp: {
    label: 'Turbine Inlet Temperature',
    unit: '°C',
    normal: { min: 900, max: 1100 },
    warning: 1200,
    alert: 1280,
    critical: 1350,
    category: 'temperature',
    icon: '🔥',
  },
  turbineExhaustTemp: {
    label: 'Turbine Exhaust Temperature',
    unit: '°C',
    normal: { min: 480, max: 560 },
    warning: 580,
    alert: 595,
    critical: 620,
    category: 'temperature',
    icon: '💨',
  },
  lubOilTemperature: {
    label: 'Lube Oil Temperature',
    unit: '°C',
    normal: { min: 45, max: 65 },
    warning: 72,
    alert: 80,
    critical: 90,
    category: 'temperature',
    icon: '🛢️',
  },
  generatorWindingTemp: {
    label: 'Generator Winding Temperature',
    unit: '°C',
    normal: { min: 60, max: 110 },
    warning: 135,
    alert: 150,
    critical: 165,
    category: 'temperature',
    icon: '⚡',
  },
  coolingSystemTemp: {
    label: 'Cooling System Temperature',
    unit: '°C',
    normal: { min: 25, max: 40 },
    warning: 45,
    alert: 50,
    critical: 55,
    category: 'temperature',
    icon: '❄️',
  },

  // ----- VIBRATION -----
  shaftVibration: {
    label: 'Shaft Vibration',
    unit: 'mm/s',
    normal: { min: 0, max: 2.8 },
    warning: 4.5,
    alert: 5.6,
    critical: 7.1,
    category: 'vibration',
    icon: '〰️',
  },
  rotorVibration: {
    label: 'Rotor Vibration',
    unit: 'mm/s',
    normal: { min: 0, max: 2.5 },
    warning: 4.0,
    alert: 5.0,
    critical: 6.3,
    category: 'vibration',
    icon: '🔄',
  },
  axialVibration: {
    label: 'Axial Vibration',
    unit: 'mm/s',
    normal: { min: 0, max: 1.8 },
    warning: 3.0,
    alert: 3.8,
    critical: 4.5,
    category: 'vibration',
    icon: '↔️',
  },
  radialVibration: {
    label: 'Radial Vibration',
    unit: 'mm/s',
    normal: { min: 0, max: 2.2 },
    warning: 3.5,
    alert: 4.5,
    critical: 5.5,
    category: 'vibration',
    icon: '⭕',
  },
  bearingVibration: {
    label: 'Bearing Vibration',
    unit: 'mm/s',
    normal: { min: 0, max: 2.0 },
    warning: 3.2,
    alert: 4.2,
    critical: 5.2,
    category: 'vibration',
    icon: '🔩',
  },

  // ----- LUBRICATION -----
  lubOilPressure: {
    label: 'Lube Oil Pressure',
    unit: 'bar',
    normal: { min: 2.5, max: 4.0 },
    warning: 2.0,      // Pressure drop is the concern — lower is worse
    alert: 1.5,
    critical: 1.0,
    inverted: true,    // Lower is worse
    category: 'lubrication',
    icon: '💧',
  },
  oilFlowRate: {
    label: 'Oil Flow Rate',
    unit: 'L/min',
    normal: { min: 80, max: 120 },
    warning: 65,
    alert: 55,
    critical: 45,
    inverted: true,
    category: 'lubrication',
    icon: '🌊',
  },

  // ----- PERFORMANCE -----
  turbineLoad: {
    label: 'Turbine Load',
    unit: 'MW',
    normal: { min: 60, max: 100 },
    warning: 95,
    alert: 98,
    critical: 102,
    category: 'performance',
    icon: '⚙️',
  },
  powerOutput: {
    label: 'Power Output',
    unit: 'MW',
    normal: { min: 60, max: 100 },
    warning: 95,
    alert: 100,
    critical: 105,
    category: 'performance',
    icon: '🔋',
  },
  fuelConsumption: {
    label: 'Fuel Consumption',
    unit: 'MMSCMD',
    normal: { min: 0.5, max: 0.9 },
    warning: 1.0,
    alert: 1.05,
    critical: 1.1,
    category: 'performance',
    icon: '⛽',
  },
  efficiency: {
    label: 'Thermal Efficiency',
    unit: '%',
    normal: { min: 36, max: 42 },
    warning: 34,
    alert: 32,
    critical: 30,
    inverted: true,
    category: 'performance',
    icon: '📊',
  },

  // ----- OPERATING HOURS -----
  operatingHours: {
    label: 'Operating Hours',
    unit: 'hrs',
    normal: { min: 0, max: 40000 },
    warning: 40000,
    alert: 45000,
    critical: 48000,
    category: 'oem',
    icon: '⏱️',
  },
};

export const PARAMETER_CATEGORIES = {
  temperature: { label: 'Temperature', color: 'var(--orange)' },
  vibration: { label: 'Vibration', color: 'var(--yellow)' },
  lubrication: { label: 'Lubrication', color: 'var(--accent-cyan)' },
  performance: { label: 'Performance', color: 'var(--accent-blue)' },
  oem: { label: 'OEM Lifecycle', color: 'var(--text-secondary)' },
};

export const getAlertLevel = (paramKey, value) => {
  const limits = OEM_LIMITS[paramKey];
  if (!limits) return 'green';
  const inverted = limits.inverted;

  if (inverted) {
    if (value <= limits.critical) return 'red';
    if (value <= limits.alert) return 'orange';
    if (value <= limits.warning) return 'yellow';
    return 'green';
  } else {
    if (value >= limits.critical) return 'red';
    if (value >= limits.alert) return 'orange';
    if (value >= limits.warning) return 'yellow';
    return 'green';
  }
};

export const getLimitPercent = (paramKey, value) => {
  const limits = OEM_LIMITS[paramKey];
  if (!limits) return 0;
  const inverted = limits.inverted;
  if (inverted) {
    // Closer to critical = higher percent
    const range = limits.normal.min - limits.critical;
    const deviation = limits.normal.min - value;
    return Math.min(100, Math.max(0, (deviation / range) * 100));
  } else {
    const range = limits.critical - limits.normal.min;
    const deviation = value - limits.normal.min;
    return Math.min(100, Math.max(0, (deviation / range) * 100));
  }
};
