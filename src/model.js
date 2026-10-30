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
  targetPerKg: 100, // $/kg, illustrative target
});

// Illustrative Starship payload assumption: 100 metric tonnes per launch. Fixed, not an input.
export const PAYLOAD_KG = 100_000;

// Launch cost in $M -> cost per kilogram in dollars, e.g. $100M / 100,000 kg = $1,000/kg.
export function costPerKg(costMillions, payloadKg = PAYLOAD_KG) {
  if (!Number.isFinite(payloadKg) || payloadKg <= 0) {
    throw new RangeError(`Payload must be > 0 kg, got ${payloadKg}`);
  }
  return (costMillions * 1e6) / payloadKg;
}

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

// Target cost in $/kg -> the equivalent launch cost in $M. Inverse of costPerKg,
// e.g. $100/kg x 100,000 kg / 1,000,000 = $10M per launch.
export function targetLaunchCost(targetPerKg, payloadKg = PAYLOAD_KG) {
  if (!Number.isFinite(targetPerKg) || targetPerKg <= 0) {
    throw new RangeError(`Target cost must be > 0 $/kg, got ${targetPerKg}`);
  }
  if (!Number.isFinite(payloadKg) || payloadKg <= 0) {
    throw new RangeError(`Payload must be > 0 kg, got ${payloadKg}`);
  }
  return (targetPerKg * payloadKg) / 1e6;
}

// The search stops here so the subsidy stays a plain discrete sum that is quick to compute.
// Small learning rates can need astronomically many launches (0.1% needs ~10^694 to cut cost 10x).
export const MAX_TARGET_LAUNCH = 1_000_000;

// First whole-number launch n >= 1 whose modeled cost is <= targetCost ($M). Returns
//   { status: 'reached', launch }  target met at that launch
//   { status: 'unreachable' }      learning rate 0 and target below the flat cost
//   { status: 'beyond-limit' }     not met within MAX_TARGET_LAUNCH launches
export function findTargetLaunch(c1, lr, targetCost) {
  if (!Number.isFinite(targetCost) || targetCost <= 0) {
    throw new RangeError(`Target launch cost must be > 0, got ${targetCost}`);
  }
  if (unitCost(1, c1, lr) <= targetCost) return { status: 'reached', launch: 1 };
  if (lr === 0) return { status: 'unreachable' };

  // Solve C1 x n^b = target for n, then nudge to the exact whole-number crossing so the
  // answer agrees with unitCost despite floating-point rounding in the estimate.
  const estimate = (targetCost / c1) ** (1 / exponentFromLearningRate(lr));
  if (!(estimate <= MAX_TARGET_LAUNCH)) return { status: 'beyond-limit' };
  let n = Math.max(2, Math.ceil(estimate));
  while (n > 2 && unitCost(n - 1, c1, lr) <= targetCost) n--;
  while (unitCost(n, c1, lr) > targetCost) n++;
  return n <= MAX_TARGET_LAUNCH ? { status: 'reached', launch: n } : { status: 'beyond-limit' };
}

// Modeled learning subsidy in $M: the sum over launches 1 .. targetLaunch - 1 of
// max(cost(n) - targetCost, 0). It assumes someone pays the gap between modeled cost and
// the target on every launch until the target is reached. Not an optimal-subsidy estimate.
export function learningSubsidy(c1, lr, targetCost, targetLaunch) {
  if (!Number.isInteger(targetLaunch) || targetLaunch < 1) {
    throw new RangeError(`Target launch must be a positive integer, got ${targetLaunch}`);
  }
  let total = 0;
  for (let n = 1; n < targetLaunch; n++) {
    total += Math.max(unitCost(n, c1, lr) - targetCost, 0);
  }
  return total;
}
