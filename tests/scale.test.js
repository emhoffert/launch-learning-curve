import { test } from 'node:test';
import assert from 'node:assert/strict';
import { linearScale, logScale, niceTicks, logTicks } from '../src/scale.js';

test('linearScale maps domain endpoints to range endpoints', () => {
  const s = linearScale([0, 1024], [72, 696]);
  assert.equal(s(0), 72);
  assert.equal(s(1024), 696);
  assert.equal(s(512), 384);
});

test('linearScale supports an inverted range (SVG y grows downward)', () => {
  const s = linearScale([0, 100], [364, 20]);
  assert.equal(s(0), 364);
  assert.equal(s(100), 20);
});

test('linearScale with an empty domain returns the range midpoint', () => {
  assert.equal(linearScale([5, 5], [0, 100])(5), 50);
});

test('logScale maps endpoints and puts equal ratios at equal distances', () => {
  const s = logScale([1, 1024], [0, 1000]);
  assert.equal(s(1), 0);
  assert.ok(Math.abs(s(1024) - 1000) < 1e-9);
  // 1→2 and 512→1024 are both one doubling, so they span the same width.
  assert.ok(Math.abs(s(2) - s(1) - (s(1024) - s(512))) < 1e-9);
});

test('logScale rejects non-positive domains', () => {
  assert.throws(() => logScale([0, 10], [0, 1]), RangeError);
});

test('niceTicks returns ascending round values inside the domain', () => {
  assert.deepEqual(niceTicks(0, 100), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(niceTicks(0, 1024), [0, 200, 400, 600, 800, 1000]);
  const ticks = niceTicks(0.3, 1.7);
  assert.deepEqual(ticks, [0.4, 0.6, 0.8, 1, 1.2, 1.4, 1.6]);
});

test('niceTicks handles a degenerate domain', () => {
  assert.deepEqual(niceTicks(5, 5), [5]);
});

test('logTicks falls on 1, 2 and 5 x 10^k', () => {
  assert.deepEqual(logTicks(1, 1024), [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000]);
  assert.deepEqual(logTicks(8.6, 100), [10, 20, 50, 100]);
});

test('logTicks falls back to linear ticks for narrow domains', () => {
  const ticks = logTicks(96, 100);
  assert.ok(ticks.length >= 2);
  assert.ok(ticks.every((t) => t >= 96 && t <= 100));
});
