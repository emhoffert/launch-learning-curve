import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CADENCE_PRESETS,
  SCENARIO_LABELS,
  CADENCE_DEFAULTS,
  CADENCE_LIMITS,
  LADDER_PER_KG,
  DATE_CUTOFF_YEAR,
  launchTime,
  launchesByTime,
  yearTicks,
  modeledDateLabel,
  milestoneRows,
} from '../src/cadence.js';

const { conservative, base, aggressive } = CADENCE_PRESETS;
const SLOW = { firstYear: 1, growth: 0 };

const near = (actual, expected, tol, msg) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${msg ?? ''} expected ${expected}, got ${actual}`);

test('constants match the pinned interface and are frozen', () => {
  assert.deepEqual(CADENCE_PRESETS, {
    conservative: { firstYear: 36, growth: 0.15 },
    base: { firstYear: 56, growth: 0.3 },
    aggressive: { firstYear: 78, growth: 0.5 },
  });
  assert.deepEqual(SCENARIO_LABELS, {
    conservative: 'Conservative',
    base: 'Base',
    aggressive: 'Aggressive',
    custom: 'Custom',
  });
  assert.deepEqual(CADENCE_DEFAULTS, { enabled: false, startYear: 2027, scenario: 'base' });
  assert.deepEqual(CADENCE_LIMITS, {
    startYearMin: 2027,
    startYearMax: 2040,
    firstYearMin: 1,
    firstYearMax: 1000,
    growthMax: 1,
  });
  assert.deepEqual(LADDER_PER_KG, [500, 200, 100, 50]);
  assert.equal(DATE_CUTOFF_YEAR, 2101);
  for (const obj of [CADENCE_PRESETS, base, SCENARIO_LABELS, CADENCE_DEFAULTS, CADENCE_LIMITS, LADDER_PER_KG]) {
    assert.ok(Object.isFrozen(obj));
  }
});

test('launch 1 is at t = 0 for every cadence', () => {
  for (const c of [conservative, base, aggressive, SLOW]) {
    assert.equal(launchTime(1, c), 0);
  }
});

test('g = 0 is a constant rate', () => {
  const flat = { firstYear: 10, growth: 0 };
  assert.equal(launchTime(11, flat), 1);
  assert.equal(launchesByTime(2.5, flat), 25);
});

test('whole-year totals follow R(1+g)^(k-1)', () => {
  for (let k = 1; k <= 5; k++) {
    const yearTotal = launchesByTime(k, base) - launchesByTime(k - 1, base);
    near(yearTotal, 56 * 1.3 ** (k - 1), 1e-9, `year ${k}`);
  }
  near(launchesByTime(2, base), 128.8, 1e-9);
});

test('launchesByTime inverts launchTime: N(t(n)) = n - 1', () => {
  for (const c of [conservative, base, aggressive]) {
    for (const n of [1, 2, 8, 96, 682, 4859, 1_000_000]) {
      const back = launchesByTime(launchTime(n, c), c);
      near(back, n - 1, Math.max(1e-9, 1e-12 * n), `n=${n}`);
    }
  }
});

test('reference dates at launches 682 and 1,024', () => {
  const expected = {
    682: { conservative: 2036.6222, base: 2032.8563, aggressive: 2031.1433 },
    1024: { conservative: 2038.8817, base: 2034.1228, aggressive: 2031.9883 },
  };
  for (const [n, byPreset] of Object.entries(expected)) {
    for (const [name, date] of Object.entries(byPreset)) {
      near(2027 + launchTime(Number(n), CADENCE_PRESETS[name]), date, 1e-4, `${name} n=${n}`);
    }
  }
});

test('yearTicks places Jan 1 of each year inside the launch range', () => {
  const ticks = yearTicks(1024, base, 2027);
  assert.deepEqual(
    ticks.map((t) => t.year),
    [2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034],
  );
  const launches = [1, 57, 129.8, 224.44, 347.472, 507.414, 715.338, 985.639];
  ticks.forEach((t, i) => near(t.launch, launches[i], 1e-3, `year ${t.year}`));

  const agg = yearTicks(1024, aggressive, 2027);
  assert.equal(agg.length, 5);
  assert.equal(agg.at(-1).year, 2031);
  near(agg.at(-1).launch, 634.75, 1e-9);

  assert.deepEqual(yearTicks(1, SLOW, 2030), [{ year: 2030, launch: 1 }]);
  assert.deepEqual(
    yearTicks(10, SLOW, 2030),
    Array.from({ length: 10 }, (_, i) => ({ year: 2030 + i, launch: i + 1 })),
  );
});

test('modeledDateLabel splits the year into thirds and cuts off after 2100', () => {
  assert.equal(modeledDateLabel(2027), 'early 2027');
  assert.equal(modeledDateLabel(2027 + 1 / 3), 'mid 2027');
  assert.equal(modeledDateLabel(2027 + 2 / 3), 'late 2027');
  assert.equal(modeledDateLabel(2032.8563), 'late 2032');
  assert.equal(modeledDateLabel(2100.999), 'late 2100');
  assert.equal(modeledDateLabel(2101), 'after 2100');
});

test('invalid inputs throw RangeError', () => {
  assert.throws(() => launchTime(0, base), RangeError);
  assert.throws(() => launchTime(5, { firstYear: 0, growth: 0.3 }), RangeError);
  assert.throws(() => launchTime(5, { firstYear: 56, growth: -0.1 }), RangeError);
  assert.throws(() => launchesByTime(-1, base), RangeError);
  assert.throws(() => launchesByTime(1, { firstYear: 0, growth: 0.3 }), RangeError);
  assert.throws(() => launchesByTime(1, { firstYear: 56, growth: -0.1 }), RangeError);
});

const DEFAULT_ARGS = { c1: 100, lr: 0.217, cadence: base, startYear: 2027, maxLaunches: 1024, targetPerKg: null };
const rows = (overrides = {}) => milestoneRows({ ...DEFAULT_ARGS, ...overrides });

test('milestone rows at the defaults with Base cadence', () => {
  const reached = (perKg, launch, date, beyondRange = false) => ({
    perKg,
    isTarget: false,
    status: 'reached',
    launch,
    date,
    beyondRange,
  });
  assert.deepEqual(rows(), [
    reached(500, 8, 'early 2027'),
    reached(200, 96, 'mid 2028'),
    reached(100, 682, 'late 2032'),
    reached(50, 4859, 'mid 2039', true),
  ]);
});

test('a target equal to a ladder value becomes that single row', () => {
  const result = rows({ targetPerKg: 100 });
  assert.equal(result.length, 4);
  assert.deepEqual(
    result.map((r) => [r.perKg, r.isTarget]),
    [[500, false], [200, false], [100, true], [50, false]],
  );
});

test('a target between ladder values is inserted in order', () => {
  const result = rows({ targetPerKg: 150 });
  assert.deepEqual(result.map((r) => r.perKg), [500, 200, 150, 100, 50]);
  assert.deepEqual(result.filter((r) => r.isTarget).map((r) => r.perKg), [150]);
});

test('a target at or above the first-launch cost is met at launch 1', () => {
  const target = rows({ targetPerKg: 2000 }).find((r) => r.isTarget);
  assert.equal(target.perKg, 2000);
  assert.equal(target.status, 'reached');
  assert.equal(target.launch, 1);
  assert.equal(target.date, 'early 2027');
  assert.equal(target.beyondRange, false);
});

test('learning rate 0 leaves every row unreachable', () => {
  for (const r of rows({ lr: 0 })) {
    assert.deepEqual(
      { status: r.status, launch: r.launch, date: r.date, beyondRange: r.beyondRange },
      { status: 'unreachable', launch: null, date: null, beyondRange: false },
    );
  }
});

test('a tiny learning rate puts $50/kg beyond the search limit', () => {
  const r50 = rows({ lr: 0.001 }).find((r) => r.perKg === 50);
  assert.equal(r50.status, 'beyond-limit');
  assert.equal(r50.launch, null);
  assert.equal(r50.date, null);
  assert.equal(r50.beyondRange, false);
});

test('a very slow Custom cadence prints "after 2100"', () => {
  const r50 = rows({ cadence: { firstYear: 1, growth: 0 } }).find((r) => r.perKg === 50);
  assert.equal(r50.launch, 4859);
  assert.equal(r50.date, 'after 2100');
});
