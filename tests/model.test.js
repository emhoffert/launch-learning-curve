import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULTS,
  PAYLOAD_KG,
  costPerKg,
  exponentFromLearningRate,
  unitCost,
  generateCurve,
  targetLaunchCost,
  MAX_TARGET_LAUNCH,
  findTargetLaunch,
  learningSubsidy,
} from '../src/model.js';

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);

test('defaults match the intent: 21.7% learning rate, 1,024 launches', () => {
  assert.equal(DEFAULTS.learningRate, 0.217);
  assert.equal(DEFAULTS.maxLaunches, 1024);
  assert.equal(DEFAULTS.targetPerKg, 100);
});

test('exponent at 21.7% is about -0.3529', () => {
  close(exponentFromLearningRate(0.217), -0.3529, 1e-4);
});

test('exponent at 0% is 0', () => {
  assert.equal(exponentFromLearningRate(0), 0);
});

test('exponent rejects learning rates outside [0, 1)', () => {
  for (const lr of [-0.1, 1, 1.5, NaN]) {
    assert.throws(() => exponentFromLearningRate(lr), RangeError);
  }
});

test('first launch costs exactly C1', () => {
  for (const [c1, lr] of [[100, 0.217], [62.5, 0.1], [1, 0.4], [250, 0]]) {
    assert.equal(unitCost(1, c1, lr), c1);
  }
});

test('each doubling keeps 78.3% of the previous cost at the default rate', () => {
  for (const n of [1, 5, 50, 500]) {
    close(unitCost(2 * n, 100, 0.217) / unitCost(n, 100, 0.217), 0.783);
  }
});

test('cost after k doublings is C1 x 0.783^k', () => {
  for (let k = 0; k <= 10; k++) {
    close(unitCost(2 ** k, 100, 0.217), 100 * 0.783 ** k);
  }
});

test('learning rate 0 gives a flat curve', () => {
  for (const { cost } of generateCurve(100, 0, 64)) {
    assert.equal(cost, 100);
  }
});

test('costs never increase with cumulative launches', () => {
  const curve = generateCurve(100, 0.217, 1024);
  for (let i = 1; i < curve.length; i++) {
    assert.ok(curve[i].cost <= curve[i - 1].cost);
  }
});

test('generateCurve returns N points numbered 1..N', () => {
  const curve = generateCurve(100, 0.217, 1024);
  assert.equal(curve.length, 1024);
  curve.forEach((p, i) => assert.equal(p.n, i + 1));
});

test('unitCost and generateCurve reject invalid inputs', () => {
  assert.throws(() => unitCost(0, 100, 0.217), RangeError);
  assert.throws(() => unitCost(1, 0, 0.217), RangeError);
  assert.throws(() => unitCost(1, -5, 0.217), RangeError);
  assert.throws(() => generateCurve(100, 0.217, 0), RangeError);
  assert.throws(() => generateCurve(100, 0.217, 10.5), RangeError);
});

test('payload assumption is 100 t = 100,000 kg', () => {
  assert.equal(PAYLOAD_KG, 100_000);
});

test('costPerKg divides launch cost in $M by 100,000 kg', () => {
  assert.equal(costPerKg(100), 1000); // $100M -> $1,000/kg
  assert.equal(costPerKg(1), 10);
  assert.equal(costPerKg(0.1), 1);
  close(costPerKg(unitCost(1024, 100, 0.217)), 1000 * 0.783 ** 10);
});

test('costPerKg is proportional, so ratios between launches are unchanged', () => {
  for (const n of [1, 5, 50, 500]) {
    close(costPerKg(unitCost(2 * n, 100, 0.217)) / costPerKg(unitCost(n, 100, 0.217)), 0.783);
  }
});

test('costPerKg accepts another payload and rejects non-positive ones', () => {
  assert.equal(costPerKg(100, 50_000), 2000);
  for (const kg of [0, -1, NaN]) {
    assert.throws(() => costPerKg(100, kg), RangeError);
  }
});

test('targetLaunchCost converts $/kg to $M per launch at 100,000 kg', () => {
  assert.equal(targetLaunchCost(100), 10); // $100/kg x 100,000 kg / 1,000,000
  assert.equal(targetLaunchCost(1000), 100);
  assert.equal(targetLaunchCost(100, 50_000), 5);
  close(costPerKg(targetLaunchCost(86.62)), 86.62);
});

test('targetLaunchCost rejects zero, negative and non-finite targets', () => {
  for (const target of [0, -100, NaN, Infinity]) {
    assert.throws(() => targetLaunchCost(target), RangeError);
  }
});

test('findTargetLaunch returns the first launch at or below the target', () => {
  // Defaults: $100/kg = $10M per launch.
  const { status, launch } = findTargetLaunch(100, 0.217, 10);
  assert.equal(status, 'reached');
  assert.equal(launch, 682);
  assert.ok(unitCost(launch, 100, 0.217) <= 10);
  assert.ok(unitCost(launch - 1, 100, 0.217) > 10);
});

test('findTargetLaunch counts a cost exactly equal to the target as achieved', () => {
  // 50% learning rate: launch 2 costs exactly $50M and launch 4 exactly $25M.
  assert.deepEqual(findTargetLaunch(100, 0.5, 50), { status: 'reached', launch: 2 });
  assert.deepEqual(findTargetLaunch(100, 0.5, 25), { status: 'reached', launch: 4 });
});

test('findTargetLaunch agrees with a brute-force scan', () => {
  for (const [c1, lr, target] of [[100, 0.217, 10], [100, 0.1, 30], [250, 0.35, 1], [7, 0.05, 6.5], [100, 0.5, 0.01]]) {
    let expected = 1;
    while (unitCost(expected, c1, lr) > target) expected++;
    assert.deepEqual(findTargetLaunch(c1, lr, target), { status: 'reached', launch: expected });
  }
});

test('target already met at launch 1 gives launch 1 and zero subsidy', () => {
  for (const [c1, lr, target] of [[100, 0.217, 100], [100, 0.217, 500], [100, 0, 100]]) {
    assert.deepEqual(findTargetLaunch(c1, lr, target), { status: 'reached', launch: 1 });
    assert.equal(learningSubsidy(c1, lr, target, 1), 0);
  }
});

test('learning rate 0 with a target below the starting cost is unreachable', () => {
  assert.deepEqual(findTargetLaunch(100, 0, 10), { status: 'unreachable' });
  assert.deepEqual(findTargetLaunch(100, 0, 99.999), { status: 'unreachable' });
});

test('targets needing more than MAX_TARGET_LAUNCH launches report beyond-limit', () => {
  assert.equal(MAX_TARGET_LAUNCH, 1_000_000);
  // 0.1% learning rate would need ~10^694 launches to reach a tenth of C1.
  assert.deepEqual(findTargetLaunch(100, 0.001, 10), { status: 'beyond-limit' });
  assert.deepEqual(findTargetLaunch(100, 0.05, 10), { status: 'beyond-limit' });
});

test('findTargetLaunch rejects zero, negative and non-finite target costs', () => {
  for (const target of [0, -1, NaN, Infinity]) {
    assert.throws(() => findTargetLaunch(100, 0.217, target), RangeError);
  }
});

test('learningSubsidy sums the gap above target over launches before the target launch', () => {
  // 50% learning rate, $25M target: launches 1-3 cost 100, 50, 33.33; launch 4 costs 25.
  close(learningSubsidy(100, 0.5, 25, 4), 75 + 25 + (100 / 3 - 25));
  // Target launch 2: only launch 1 is subsidized.
  assert.equal(learningSubsidy(100, 0.5, 50, 2), 50);
});

test('learningSubsidy at the defaults matches a direct sum', () => {
  let expected = 0;
  for (let n = 1; n < 682; n++) expected += unitCost(n, 100, 0.217) - 10;
  close(learningSubsidy(100, 0.217, 10, 682), expected, 1e-6);
  close(learningSubsidy(100, 0.217, 10, 682), 3620.75, 0.01);
});

test('learningSubsidy never counts launches already below the target', () => {
  // Summing past the target launch adds nothing, because max(cost - target, 0) is 0 there.
  assert.equal(learningSubsidy(100, 0.5, 25, 10), learningSubsidy(100, 0.5, 25, 4));
});

test('learningSubsidy rejects a non-integer or non-positive target launch', () => {
  for (const launch of [0, -1, 2.5, NaN]) {
    assert.throws(() => learningSubsidy(100, 0.217, 10, launch), RangeError);
  }
});
