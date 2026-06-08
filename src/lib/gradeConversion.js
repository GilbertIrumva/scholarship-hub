/**
 * gradeConversion.js
 *
 * Pure (no React, no DOM, no network) grade-conversion engine.
 *
 * Strategy:
 *   1. Every input grade is first converted to a canonical PERCENTAGE (0-100).
 *      Each system supplies its own `toPercentage(input)` function.
 *   2. From the percentage, we derive every downstream metric (GPA 4.0,
 *      UK degree class, ECTS letter, plain-English interpretation, tier).
 *      One source of truth = no drift between metrics.
 *
 * Phase 1 ships these systems (8). Phase 3 will extend the SYSTEMS table
 * with more African + international certificates — no engine changes needed.
 *
 *   - WAEC      West African Senior School Certificate (NG/GH/SL/LR/GM)
 *   - KCSE      Kenya Certificate of Secondary Education
 *   - NSC       South African National Senior Certificate (Level 1-7)
 *   - A_LEVEL   GCE A-Level (UK + Commonwealth)
 *   - IB        International Baccalaureate Diploma (out of 45)
 *   - US_GPA    US 4.0-scale GPA
 *   - BAC_20    Francophone Baccalauréat (out of 20)
 *   - PERCENT   Generic percentage 0-100
 *
 * @typedef {Object} ConversionResult
 * @property {string}  system          Human-readable system name
 * @property {string}  systemId        Stable id ('WAEC', 'KCSE', ...)
 * @property {string}  input           Original input echoed back
 * @property {number}  percentage      Canonical 0-100 percentage (rounded to 1dp)
 * @property {number}  gpa4            US 4.0-scale GPA (rounded to 2dp)
 * @property {string}  ukClass         'First' | '2:1' | '2:2' | 'Third' | 'Pass' | 'Fail'
 * @property {string}  ects            'A' | 'B' | 'C' | 'D' | 'E' | 'F'
 * @property {string}  interpretation  'Excellent' | 'Very Good' | 'Good' | 'Satisfactory' | 'Pass' | 'Fail'
 * @property {string}  tier            'top-tier' | 'competitive' | 'standard' | 'developing' | 'below-threshold'
 * @property {string}  confidence      'high' | 'medium' | 'low' — how reliable the per-system mapping is
 * @property {string[]} notes          Caveats specific to this system
 */

// ---------------------------------------------------------------------------
// 1. Percentage → derived metrics (single source of truth)
// ---------------------------------------------------------------------------

const round = (n, dp = 1) => {
  const factor = 10 ** dp;
  return Math.round(n * factor) / factor;
};

const clampPct = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/**
 * Percentage → GPA on the US 4.0 scale.
 * Linear within bands; values cross-checked against WES and common
 * university admissions conversion charts.
 */
const percentageToGpa4 = (pct) => {
  const p = clampPct(pct);
  if (p >= 93) return 4.0;
  if (p >= 90) return 3.7;
  if (p >= 87) return 3.3;
  if (p >= 83) return 3.0;
  if (p >= 80) return 2.7;
  if (p >= 77) return 2.3;
  if (p >= 73) return 2.0;
  if (p >= 70) return 1.7;
  if (p >= 67) return 1.3;
  if (p >= 65) return 1.0;
  if (p >= 50) return 0.7;
  return 0.0;
};

/**
 * Percentage → UK undergraduate degree classification labels.
 * Boundaries are the conventional UK academic boundaries, applied here
 * as a guide for how secondary marks would *map onto* a uni grading
 * mindset — useful for scholarship applications that ask "expected class".
 */
const percentageToUkClass = (pct) => {
  const p = clampPct(pct);
  if (p >= 70) return 'First';
  if (p >= 60) return '2:1';
  if (p >= 50) return '2:2';
  if (p >= 40) return 'Third';
  if (p >= 35) return 'Pass';
  return 'Fail';
};

/** Percentage → ECTS letter (European Credit Transfer System). */
const percentageToEcts = (pct) => {
  const p = clampPct(pct);
  if (p >= 85) return 'A';
  if (p >= 75) return 'B';
  if (p >= 65) return 'C';
  if (p >= 55) return 'D';
  if (p >= 45) return 'E';
  return 'F';
};

/** Percentage → plain-English interpretation. */
const percentageToInterpretation = (pct) => {
  const p = clampPct(pct);
  if (p >= 85) return 'Excellent';
  if (p >= 75) return 'Very Good';
  if (p >= 65) return 'Good';
  if (p >= 55) return 'Satisfactory';
  if (p >= 45) return 'Pass';
  return 'Fail';
};

/**
 * Percentage → "what tier of scholarship is realistic" guidance.
 * Coarse on purpose. The accompanying disclaimer must make clear
 * that universities make the final call.
 */
const percentageToTier = (pct) => {
  const p = clampPct(pct);
  if (p >= 85) return 'top-tier';
  if (p >= 70) return 'competitive';
  if (p >= 55) return 'standard';
  if (p >= 40) return 'developing';
  return 'below-threshold';
};

const deriveFromPercentage = (pct) => {
  const p = clampPct(pct);
  return {
    percentage: round(p, 1),
    gpa4: round(percentageToGpa4(p), 2),
    ukClass: percentageToUkClass(p),
    ects: percentageToEcts(p),
    interpretation: percentageToInterpretation(p),
    tier: percentageToTier(p),
  };
};

// ---------------------------------------------------------------------------
// 2. Helpers shared by system converters
// ---------------------------------------------------------------------------

/** Look up an entry in a discrete grade table; case-insensitive. */
const lookupDiscrete = (table, raw) => {
  if (raw == null) return null;
  const key = String(raw).trim().toUpperCase();
  return table.find((row) => row.code.toUpperCase() === key) || null;
};

/**
 * Linearly map a numeric input on [minIn, maxIn] to [minPct, maxPct].
 * The input is clamped before mapping so out-of-range values still produce
 * a sensible (clamped) percentage rather than NaN.
 */
const linearScale = (value, minIn, maxIn, minPct, maxPct) => {
  const v = Math.max(minIn, Math.min(maxIn, Number(value)));
  if (maxIn === minIn) return minPct;
  const t = (v - minIn) / (maxIn - minIn);
  return minPct + t * (maxPct - minPct);
};

const parseNumeric = (raw) => {
  if (raw == null || raw === '') return NaN;
  const n = Number(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
};

// ---------------------------------------------------------------------------
// 3. SYSTEMS table — extend here in Phase 3
// ---------------------------------------------------------------------------

/* ---- WAEC / WASSCE (West Africa) -------------------------------------- */
const WAEC_GRADES = [
  { code: 'A1', label: 'Excellent',  percent: 87.5 },
  { code: 'B2', label: 'Very Good',  percent: 77.5 },
  { code: 'B3', label: 'Good',       percent: 72.5 },
  { code: 'C4', label: 'Credit',     percent: 67.5 },
  { code: 'C5', label: 'Credit',     percent: 62.5 },
  { code: 'C6', label: 'Credit',     percent: 57.5 },
  { code: 'D7', label: 'Pass',       percent: 52.5 },
  { code: 'E8', label: 'Pass',       percent: 45.0 },
  { code: 'F9', label: 'Fail',       percent: 30.0 },
];

/* ---- KCSE (Kenya) ------------------------------------------------------ */
const KCSE_GRADES = [
  { code: 'A',  label: 'A',  percent: 87.5 },
  { code: 'A-', label: 'A-', percent: 82.5 },
  { code: 'B+', label: 'B+', percent: 77.5 },
  { code: 'B',  label: 'B',  percent: 72.5 },
  { code: 'B-', label: 'B-', percent: 67.5 },
  { code: 'C+', label: 'C+', percent: 62.5 },
  { code: 'C',  label: 'C',  percent: 57.5 },
  { code: 'C-', label: 'C-', percent: 52.5 },
  { code: 'D+', label: 'D+', percent: 47.5 },
  { code: 'D',  label: 'D',  percent: 42.5 },
  { code: 'D-', label: 'D-', percent: 37.5 },
  { code: 'E',  label: 'E',  percent: 25.0 },
];

/* ---- NSC (South Africa, Levels 1-7) ----------------------------------- */
const NSC_GRADES = [
  { code: '7', label: 'Outstanding',    percent: 90 },
  { code: '6', label: 'Meritorious',    percent: 75 },
  { code: '5', label: 'Substantial',    percent: 65 },
  { code: '4', label: 'Adequate',       percent: 55 },
  { code: '3', label: 'Moderate',       percent: 45 },
  { code: '2', label: 'Elementary',     percent: 35 },
  { code: '1', label: 'Not Achieved',   percent: 20 },
];

/* ---- GCE A-Level (UK + Commonwealth) ---------------------------------- */
const A_LEVEL_GRADES = [
  { code: 'A*', label: 'A*', percent: 92 },
  { code: 'A',  label: 'A',  percent: 85 },
  { code: 'B',  label: 'B',  percent: 75 },
  { code: 'C',  label: 'C',  percent: 65 },
  { code: 'D',  label: 'D',  percent: 55 },
  { code: 'E',  label: 'E',  percent: 45 },
  { code: 'U',  label: 'U (Ungraded)', percent: 25 },
];

// ---------------------------------------------------------------------------

export const SYSTEMS = {
  WAEC: {
    id: 'WAEC',
    name: 'WAEC / WASSCE',
    description: 'West African Senior School Certificate Examination',
    countries: ['NG', 'GH', 'SL', 'LR', 'GM'],
    type: 'discrete',
    grades: WAEC_GRADES,
    confidence: 'high',
    notes: [
      'Mapping based on official WAEC grading boundaries.',
      'A1–C6 generally accepted as a "credit" pass for university entry.',
    ],
    toPercentage(input) {
      const row = lookupDiscrete(WAEC_GRADES, input);
      if (!row) throw new Error(`Invalid WAEC grade "${input}". Use A1, B2 ... F9.`);
      return row.percent;
    },
  },

  KCSE: {
    id: 'KCSE',
    name: 'KCSE',
    description: 'Kenya Certificate of Secondary Education',
    countries: ['KE'],
    type: 'discrete',
    grades: KCSE_GRADES,
    confidence: 'high',
    notes: [
      'Mean grade of C+ (plain "C plus") is the typical university minimum.',
    ],
    toPercentage(input) {
      const row = lookupDiscrete(KCSE_GRADES, input);
      if (!row) throw new Error(`Invalid KCSE grade "${input}". Use A, A-, B+, ... E.`);
      return row.percent;
    },
  },

  NSC: {
    id: 'NSC',
    name: 'NSC (South Africa)',
    description: 'National Senior Certificate — achievement level 1–7',
    countries: ['ZA'],
    type: 'discrete',
    grades: NSC_GRADES,
    confidence: 'high',
    notes: [
      'Level 4 ("Adequate", 50–59%) is the minimum bachelor pass.',
    ],
    toPercentage(input) {
      const row = lookupDiscrete(NSC_GRADES, input);
      if (!row) throw new Error(`Invalid NSC level "${input}". Use 1–7.`);
      return row.percent;
    },
  },

  A_LEVEL: {
    id: 'A_LEVEL',
    name: 'GCE A-Level',
    description: 'UK General Certificate of Education, Advanced Level',
    countries: ['GB', 'GH', 'SG', 'MY', 'ZW', 'KE', 'BW', 'TZ'],
    type: 'discrete',
    grades: A_LEVEL_GRADES,
    confidence: 'medium',
    notes: [
      'For a single subject grade. For an overall A-Level result, average the per-subject conversions.',
    ],
    toPercentage(input) {
      const row = lookupDiscrete(A_LEVEL_GRADES, input);
      if (!row) throw new Error(`Invalid A-Level grade "${input}". Use A*, A, B, C, D, E, U.`);
      return row.percent;
    },
  },

  IB: {
    id: 'IB',
    name: 'IB Diploma',
    description: 'International Baccalaureate total score (out of 45)',
    countries: ['INT'],
    type: 'numeric',
    range: { min: 0, max: 45 },
    confidence: 'high',
    notes: [
      'IB total = sum of six subject grades (1-7) + up to 3 bonus points.',
      'Diploma is awarded from 24 points; competitive universities expect 38+.',
    ],
    toPercentage(input) {
      const v = parseNumeric(input);
      if (!Number.isFinite(v) || v < 0 || v > 45) {
        throw new Error(`Invalid IB total "${input}". Enter a number from 0 to 45.`);
      }
      // Piecewise: matches commonly cited IB-to-% conversion tables.
      // 24 (diploma pass) ≈ 50%, 30 ≈ 65%, 36 ≈ 80%, 40 ≈ 90%, 45 = 100%.
      if (v >= 40) return linearScale(v, 40, 45, 90, 100);
      if (v >= 36) return linearScale(v, 36, 40, 80, 90);
      if (v >= 30) return linearScale(v, 30, 36, 65, 80);
      if (v >= 24) return linearScale(v, 24, 30, 50, 65);
      return linearScale(v, 0, 24, 0, 50);
    },
  },

  US_GPA: {
    id: 'US_GPA',
    name: 'US GPA (4.0)',
    description: 'United States high-school GPA on the 4.0 scale',
    countries: ['US'],
    type: 'numeric',
    range: { min: 0, max: 4.0 },
    confidence: 'high',
    notes: [
      'Standard unweighted 4.0 scale. Weighted (5.0) GPAs not yet supported.',
    ],
    toPercentage(input) {
      const v = parseNumeric(input);
      if (!Number.isFinite(v) || v < 0 || v > 4.0) {
        throw new Error(`Invalid GPA "${input}". Enter a number from 0.0 to 4.0.`);
      }
      // Inverse of percentageToGpa4 piecewise — picks the midpoint of each band.
      if (v >= 4.0) return 95;
      if (v >= 3.7) return 91.5;
      if (v >= 3.3) return 88.5;
      if (v >= 3.0) return 85;
      if (v >= 2.7) return 81.5;
      if (v >= 2.3) return 78.5;
      if (v >= 2.0) return 75;
      if (v >= 1.7) return 71.5;
      if (v >= 1.3) return 68;
      if (v >= 1.0) return 66;
      if (v >= 0.7) return 57.5;
      return 30;
    },
  },

  BAC_20: {
    id: 'BAC_20',
    name: 'Baccalauréat (/20)',
    description: 'French / Francophone African Baccalauréat — 0 to 20',
    countries: ['FR', 'SN', 'ML', 'CI', 'BF', 'CD', 'CM', 'BJ', 'TG', 'NE', 'MA', 'DZ', 'TN'],
    type: 'numeric',
    range: { min: 0, max: 20 },
    confidence: 'high',
    notes: [
      'Mention boundaries: 10 = Passable, 12 = Assez Bien, 14 = Bien, 16 = Très Bien.',
      'A 16/20 in French Bac roughly equals an "A" / first-class result.',
    ],
    toPercentage(input) {
      const v = parseNumeric(input);
      if (!Number.isFinite(v) || v < 0 || v > 20) {
        throw new Error(`Invalid Bac score "${input}". Enter a number from 0 to 20.`);
      }
      // Bac to % is non-linear (very few students score above 16).
      // Piecewise aligned with WES Bac-to-US tables.
      if (v >= 16) return linearScale(v, 16, 20, 90, 100);
      if (v >= 14) return linearScale(v, 14, 16, 80, 90);
      if (v >= 12) return linearScale(v, 12, 14, 70, 80);
      if (v >= 10) return linearScale(v, 10, 12, 55, 70);
      return linearScale(v, 0, 10, 0, 55);
    },
  },

  PERCENT: {
    id: 'PERCENT',
    name: 'Percentage (0–100)',
    description: 'Generic percentage — use when your certificate reports a percentage directly',
    countries: ['INT'],
    type: 'numeric',
    range: { min: 0, max: 100 },
    confidence: 'high',
    notes: [
      'Use this fallback when your transcript already reports an overall percentage.',
    ],
    toPercentage(input) {
      const v = parseNumeric(input);
      if (!Number.isFinite(v) || v < 0 || v > 100) {
        throw new Error(`Invalid percentage "${input}". Enter a number from 0 to 100.`);
      }
      return v;
    },
  },
};

// ---------------------------------------------------------------------------
// 4. Public API
// ---------------------------------------------------------------------------

/**
 * Convert a grade to canonical metrics.
 *
 * @param {Object} opts
 * @param {string} opts.system  System id, e.g. 'WAEC' (see SYSTEMS keys)
 * @param {string|number} opts.input  Raw grade — string for discrete, number for numeric
 * @returns {ConversionResult}
 * @throws {Error} on unknown system or invalid input
 */
export const convertGrade = ({ system, input } = {}) => {
  if (!system) throw new Error('A grading system id is required.');
  const sys = SYSTEMS[system];
  if (!sys) throw new Error(`Unknown grading system: "${system}".`);
  const pct = sys.toPercentage(input);
  return {
    system: sys.name,
    systemId: sys.id,
    input: String(input),
    ...deriveFromPercentage(pct),
    confidence: sys.confidence || 'medium',
    notes: sys.notes || [],
  };
};

/** List all systems for UI pickers. Returns a stable array sorted by name. */
export const listSystems = () =>
  Object.values(SYSTEMS)
    .map(({ id, name, description, countries, type, range, grades, confidence }) => ({
      id,
      name,
      description,
      countries,
      type,
      range,
      grades,
      confidence,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

/** Convenience: look up a system by id. Returns null if not found. */
export const getSystem = (id) => SYSTEMS[id] || null;

export const __test_only__ = {
  percentageToGpa4,
  percentageToUkClass,
  percentageToEcts,
  percentageToInterpretation,
  percentageToTier,
};

export default {
  SYSTEMS,
  convertGrade,
  listSystems,
  getSystem,
};
