import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, exponentFromLearningRate, unitCost, generateCurve } from '../src/model.js';

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} ≈ ${expected}`);

test('defaults match the intent: 21.7% learning rate, 1,024 launches', () => {
  assert.equal(DEFAULTS.learningRate, 0.217);
  assert.equal(DEFAULTS.maxLaunches, 1024);
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
