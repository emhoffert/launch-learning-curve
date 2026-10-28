// Wright's Law learning-curve model. Pure functions: no DOM, runs in Node and the browser.
//
//   b       = log2(1 - LR)
//   cost(n) = C1 * n^b
//
// LR is a fraction (0.217 = 21.7%). Each doubling of n multiplies cost by (1 - LR).

export const DEFAULTS = Object.freeze({
  learningRate: 0.217, // fraction
  startingCost: 100, // $M, illustrative round number (not real vehicle data)
  maxLaunches: 1024, // 2^10: ten doublings from launch 1
});

export function exponentFromLearningRate(lr) {
  if (!Number.isFinite(lr) || lr < 0 || lr >= 1) {
    throw new RangeError(`Learning rate must be in [0, 1), got ${lr}`);
  }
  return Math.log2(1 - lr);
}

export function unitCost(n, c1, lr) {
  if (!Number.isFinite(n) || n < 1) {
    throw new RangeError(`Launch number must be >= 1, got ${n}`);
  }
  if (!Number.isFinite(c1) || c1 <= 0) {
    throw new RangeError(`Starting cost must be > 0, got ${c1}`);
  }
  return c1 * n ** exponentFromLearningRate(lr);
}

export function generateCurve(c1, lr, maxLaunches) {
  if (!Number.isInteger(maxLaunches) || maxLaunches < 1) {
    throw new RangeError(`Max launches must be a positive integer, got ${maxLaunches}`);
  }
  const points = [];
  for (let n = 1; n <= maxLaunches; n++) {
    points.push({ n, cost: unitCost(n, c1, lr) });
  }
  return points;
}
