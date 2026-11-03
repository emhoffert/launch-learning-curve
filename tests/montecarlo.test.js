import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MC_DEFAULTS,
  mulberry32,
  sampleLearningRates,
  costQuantileRate,
  simulateUncertainty,
} from '../src/montecarlo.js';
import { generateCurve, unitCost } from '../src/model.js';

// Standard normal CDF via Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7), for checking only.
function normalCdf(z) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// P(LR >= x) for a normal(mean, sd) truncated to [0, 1).
function truncatedTail(x, mean, sd) {
  const lo = normalCdf((0 - mean) / sd);
  const hi = normalCdf((1 - mean) / sd);
  return (hi - normalCdf((Math.max(x, 0) - mean) / sd)) / (hi - lo);
}

// The learning rate at which cost(N) exactly equals the target: c1 * N^log2(1 - LR) = target.
const breakEvenRate = (c1, target, n) => 1 - 2 ** (Math.log(target / c1) / Math.log(n));

test('defaults: 21.7% mean, 5 percentage points sd, 10,000 runs, fixed seed', () => {
  assert.equal(MC_DEFAULTS.sd, 0.05);
  assert.equal(MC_DEFAULTS.count, 10_000);
  assert.ok(Number.isInteger(MC_DEFAULTS.seed));
});

test('mulberry32 is reproducible and stays in [0, 1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const u = a();
    assert.equal(u, b());
    assert.ok(u >= 0 && u < 1);
  }
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('sampleLearningRates is reproducible for the same seed', () => {
  assert.deepEqual(sampleLearningRates(0.217, 0.05), sampleLearningRates(0.217, 0.05));
  assert.notDeepEqual(sampleLearningRates(0.217, 0.05, { seed: 1 }), sampleLearningRates(0.217, 0.05, { seed: 2 }));
});

test('sampleLearningRates returns count sorted draws with roughly the right mean and sd', () => {
  const rates = sampleLearningRates(0.217, 0.05);
  assert.equal(rates.length, 10_000);
  for (let i = 1; i < rates.length; i++) assert.ok(rates[i] >= rates[i - 1]);
  const mean = rates.reduce((s, r) => s + r, 0) / rates.length;
  const sd = Math.sqrt(rates.reduce((s, r) => s + (r - mean) ** 2, 0) / (rates.length - 1));
  assert.ok(Math.abs(mean - 0.217) < 0.002, `mean ${mean}`);
  assert.ok(Math.abs(sd - 0.05) < 0.002, `sd ${sd}`);
});

test('draws outside 0% <= LR < 100% are redrawn, not clamped (truncated normal)', () => {
  const rates = sampleLearningRates(0.02, 0.05);
  assert.ok(rates.every((r) => r >= 0 && r < 1));
  // Clamping would pile ~34% of draws exactly on 0; redrawing leaves almost none there.
  assert.ok(rates.filter((r) => r === 0).length <= 1);
  // Share below 2% should match the truncated normal: (Φ(0) − Φ(−0.4)) / (1 − Φ(−0.4)) ≈ 0.237.
  const expected = 1 - truncatedTail(0.02, 0.02, 0.05);
  const actual = rates.filter((r) => r < 0.02).length / rates.length;
  assert.ok(Math.abs(actual - expected) < 0.015, `${actual} vs ${expected}`);
});

test('zero sd gives every draw the mean', () => {
  assert.ok(sampleLearningRates(0.3, 0).every((r) => r === 0.3));
});

test('sampleLearningRates rejects invalid inputs', () => {
  for (const [mean, sd] of [[-0.1, 0.05], [1, 0.05], [0.2, -0.01], [NaN, 0.05], [0.2, NaN]]) {
    assert.throws(() => sampleLearningRates(mean, sd), RangeError);
  }
});

test('percentile curves match a brute-force per-launch percentile over every simulation', () => {
  const c1 = 100;
  const maxLaunches = 64;
  const rates = sampleLearningRates(0.217, 0.05, { count: 2001 });
  const result = simulateUncertainty({ startingCost: c1, mean: 0.217, sd: 0.05, maxLaunches, count: 2001 });
  for (const [key, p] of [['p5', 0.05], ['p25', 0.25], ['p50', 0.5], ['p75', 0.75], ['p95', 0.95]]) {
    for (let n = 1; n <= maxLaunches; n++) {
      const costs = rates.map((lr) => unitCost(n, c1, lr)).sort((a, b) => a - b);
      const nearestRank = costs[Math.ceil(p * costs.length) - 1];
      assert.equal(result.bands[key][n - 1].cost, nearestRank, `${key} at launch ${n}`);
    }
  }
});

test('bands are ordered p5 <= p25 <= p50 <= p75 <= p95 at every launch', () => {
  const { bands } = simulateUncertainty({ startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 1024 });
  for (let i = 0; i < 1024; i++) {
    const c = ['p5', 'p25', 'p50', 'p75', 'p95'].map((k) => bands[k][i].cost);
    for (let j = 1; j < c.length; j++) assert.ok(c[j] >= c[j - 1]);
  }
});

test('median curve sits on the deterministic curve at the mean learning rate', () => {
  const { bands } = simulateUncertainty({ startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 1024 });
  const deterministic = generateCurve(100, 0.217, 1024);
  const last = bands.p50[1023].cost / deterministic[1023].cost;
  assert.ok(Math.abs(last - 1) < 0.01, `median/deterministic at launch 1,024 = ${last}`);
});

test('costQuantileRate picks the high learning rate for the low cost percentile', () => {
  const sorted = [0.1, 0.2, 0.3, 0.4];
  assert.equal(costQuantileRate(sorted, 0.25), 0.4);
  assert.equal(costQuantileRate(sorted, 0.5), 0.3);
  assert.equal(costQuantileRate(sorted, 1), 0.1);
});

test('probability of reaching the target matches the exact normal answer at the defaults', () => {
  // $100/kg = $10M; break-even LR at launch 1,024 is ~20.57%, so P ≈ 1 − Φ(−0.226) ≈ 0.589.
  const { probability } = simulateUncertainty({
    startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 1024, targetCost: 10,
  });
  const exact = truncatedTail(breakEvenRate(100, 10, 1024), 0.217, 0.05);
  assert.ok(Math.abs(probability - exact) < 0.015, `${probability} vs ${exact}`);
});

test('probability matches the truncated normal near the 0% boundary', () => {
  const { probability } = simulateUncertainty({
    startingCost: 100, mean: 0.05, sd: 0.05, maxLaunches: 2048, targetCost: 70,
  });
  const exact = truncatedTail(breakEvenRate(100, 70, 2048), 0.05, 0.05);
  assert.ok(Math.abs(probability - exact) < 0.015, `${probability} vs ${exact}`);
});

test('probability counts a draw as reaching the target exactly when cost(N) <= target', () => {
  const opts = { startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 500, targetCost: 12 };
  const rates = sampleLearningRates(opts.mean, opts.sd);
  const count = rates.filter((lr) => unitCost(opts.maxLaunches, 100, lr) <= 12).length;
  assert.equal(simulateUncertainty(opts).probability, count / rates.length);
});

test('target at or above the starting cost is reached with certainty', () => {
  const { probability } = simulateUncertainty({
    startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 10, targetCost: 100,
  });
  assert.equal(probability, 1);
});

test('probability is null when no target is given', () => {
  const { probability } = simulateUncertainty({ startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 10 });
  assert.equal(probability, null);
});
