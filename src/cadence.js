// Launch-cadence model: turns cumulative launch counts into modeled calendar dates.
// Pure functions: no DOM, runs in Node and the browser. The learning curve (model.js) is
// untouched; cadence only decides *when* each launch happens.
//
// A cadence is { firstYear: R, growth: g }: R launches in the start year, and each year's
// total is the previous year's x (1 + g). The ramp is a continuous exponential scaled so
// whole-year totals match that geometric series exactly. t is in years since Jan 1 of the
// start year.
//
//   N(t) = R * ((1 + g)^t - 1) / g          g > 0       cumulative launches by time t
//   N(t) = R * t                            g = 0
//   t(n) = ln(1 + (n - 1) g / R) / ln(1 + g)   g > 0    launch n happens when N(t) = n - 1
//   t(n) = (n - 1) / R                         g = 0
//
// Dates are modeled dates, not forecasts.

export const CADENCE_PRESETS = Object.freeze({
  conservative: Object.freeze({ firstYear: 36, growth: 0.15 }),
  base: Object.freeze({ firstYear: 56, growth: 0.3 }),
  aggressive: Object.freeze({ firstYear: 78, growth: 0.5 }),
});

export const SCENARIO_LABELS = Object.freeze({
  conservative: 'Conservative',
  base: 'Base',
  aggressive: 'Aggressive',
  custom: 'Custom',
});

export const CADENCE_DEFAULTS = Object.freeze({ enabled: false, startYear: 2027, scenario: 'base' });

// Input limits for the UI. growthMax is a fraction (1 = 100%).
export const CADENCE_LIMITS = Object.freeze({
  startYearMin: 2027,
  startYearMax: 2040,
  firstYearMin: 1,
  firstYearMax: 1000,
  growthMax: 1,
});

// Fixed $/kg milestones for the calendar panel, highest first.
export const LADDER_PER_KG = Object.freeze([500, 200, 100, 50]);

// Fractional years at or past this print "after 2100".
export const DATE_CUTOFF_YEAR = 2101;

function checkCadence(cadence) {
  const { firstYear, growth } = cadence ?? {};
  if (!Number.isFinite(firstYear) || firstYear <= 0) {
    throw new RangeError(`First-year launches must be > 0, got ${firstYear}`);
  }
  if (!Number.isFinite(growth) || growth < 0) {
    throw new RangeError(`Annual growth must be >= 0, got ${growth}`);
  }
  return { firstYear, growth };
}

// t(n): years since Jan 1 of the start year at which launch n happens.
export function launchTime(n, cadence) {
  if (!Number.isFinite(n) || n < 1) {
    throw new RangeError(`Launch number must be >= 1, got ${n}`);
  }
  const { firstYear: r, growth: g } = checkCadence(cadence);
  if (g === 0) return (n - 1) / r;
  return Math.log1p(((n - 1) * g) / r) / Math.log1p(g);
}

// N(t): cumulative launches (continuous) by t years after Jan 1 of the start year.
export function launchesByTime(t, cadence) {
  if (!Number.isFinite(t) || t < 0) {
    throw new RangeError(`Time must be >= 0 years, got ${t}`);
  }
  const { firstYear: r, growth: g } = checkCadence(cadence);
  if (g === 0) return r * t;
  return (r * Math.expm1(t * Math.log1p(g))) / g;
}

// One tick per Jan 1 whose launch position N(year - startYear) + 1 is within 1..maxLaunches.
export function yearTicks(maxLaunches, cadence, startYear) {
  if (!Number.isFinite(maxLaunches) || maxLaunches < 1) {
    throw new RangeError(`Max launches must be >= 1, got ${maxLaunches}`);
  }
  if (!Number.isInteger(startYear)) {
    throw new RangeError(`Start year must be an integer, got ${startYear}`);
  }
  checkCadence(cadence);
  const ticks = [];
  for (let k = 0; ; k++) {
    const launch = launchesByTime(k, cadence) + 1;
    if (launch > maxLaunches) break;
    ticks.push({ year: startYear + k, launch });
  }
  return ticks;
}

// Small nudge so values like 2027 + 1/3, which land a hair under the boundary in floating
// point, fall in the later third.
const THIRD_EPSILON = 1e-9;

// "early / mid / late YYYY" by thirds of the year, or "after 2100".
export function modeledDateLabel(fractionalYear) {
  if (Number.isNaN(fractionalYear)) {
    throw new RangeError(`Fractional year must be a number, got ${fractionalYear}`);
  }
  if (fractionalYear >= DATE_CUTOFF_YEAR) return `after ${DATE_CUTOFF_YEAR - 1}`;
  const year = Math.floor(fractionalYear);
  const frac = fractionalYear - year + THIRD_EPSILON;
  const part = frac < 1 / 3 ? 'early' : frac < 2 / 3 ? 'mid' : 'late';
  return `${part} ${year}`;
}
