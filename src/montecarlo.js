// Monte Carlo uncertainty in the learning rate. Pure functions: no DOM, runs in Node and the browser.
//
// Each simulation draws one learning rate from a normal distribution truncated to 0 <= LR < 1
// (draws outside that range are redrawn, never clamped) and uses it for the whole curve.
// Probabilities are conditional on that assumed distribution.

import { exponentFromLearningRate, unitCost } from './model.js';

export const MC_DEFAULTS = Object.freeze({
  sd: 0.05, // 1 standard deviation, as a fraction: 0.05 = 5 percentage points
  count: 10_000,
  seed: 20261103, // fixed so the bands and the probability are reproducible
});

// Small seeded pseudo-random generator returning floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Standard normal draw by the Box–Muller transform. 1 - u keeps the log argument in (0, 1].
function standardNormal(random) {
  return Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
}

// `count` learning rates from normal(mean, sd) truncated to [0, 1), sorted ascending.
// The same seed always gives the same stream, so a change in mean or sd rescales the same
// draws and the bands move smoothly instead of jittering.
export function sampleLearningRates(mean, sd, { count = MC_DEFAULTS.count, seed = MC_DEFAULTS.seed } = {}) {
  exponentFromLearningRate(mean); // validates 0 <= mean < 1
  if (!Number.isFinite(sd) || sd < 0) {
    throw new RangeError(`Learning-rate sd must be >= 0, got ${sd}`);
  }
  const random = mulberry32(seed);
  const rates = new Float64Array(count);
  const maxAttempts = count * 1000;
  let attempts = 0;
  for (let i = 0; i < count; ) {
    if (++attempts > maxAttempts) throw new RangeError('Too few draws fall in 0 <= LR < 1');
    const lr = mean + sd * standardNormal(random);
    if (lr >= 0 && lr < 1) rates[i++] = lr;
  }
  return rates.sort();
}

// Cost falls as the learning rate rises (for every launch after the first), so the p-th
// percentile cost is the cost at the (1 - p) learning-rate rank. Nearest-rank method:
// the k-th smallest cost, k = ceil(p * N), comes from the k-th largest learning rate.
export function costQuantileRate(sortedRates, p) {
  const n = sortedRates.length;
  const k = Math.min(n, Math.max(1, Math.ceil(p * n)));
  return sortedRates[n - k];
}

const BANDS = { p5: 0.05, p25: 0.25, p50: 0.5, p75: 0.75, p95: 0.95 };

// Returns {
//   bands:       { p5, p25, p50, p75, p95 }, each [{ n, cost }, ...] for n = 1..maxLaunches
//                (pointwise cost percentiles; p5 is the low-cost edge)
//   probability: share of simulations with cost(maxLaunches) <= targetCost, or null without a target
// }
export function simulateUncertainty({ startingCost, mean, sd, maxLaunches, targetCost = null, count, seed }) {
  const rates = sampleLearningRates(mean, sd, { count, seed });
  const bands = {};
  for (const [key, p] of Object.entries(BANDS)) {
    const lr = costQuantileRate(rates, p);
    bands[key] = Array.from({ length: maxLaunches }, (_, i) => ({ n: i + 1, cost: unitCost(i + 1, startingCost, lr) }));
  }
  let probability = null;
  if (targetCost !== null) {
    // Cost never rises with n, so reaching the target by launch N means cost(N) <= target.
    let reached = 0;
    for (const lr of rates) if (unitCost(maxLaunches, startingCost, lr) <= targetCost) reached++;
    probability = reached / rates.length;
  }
  return { bands, probability };
}
