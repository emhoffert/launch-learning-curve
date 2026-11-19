// Pins the default analytical outputs so the UX redesign can prove the math is unchanged.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { costPerKg, findTargetLaunch, generateCurve, learningSubsidy, targetLaunchCost } from '../src/model.js';
import { simulateUncertainty } from '../src/montecarlo.js';
import { CADENCE_PRESETS, milestoneRows } from '../src/cadence.js';
import { formatCost, formatCostPerKg, formatPercent } from '../src/format.js';

test('default headline numbers are unchanged', () => {
  const fin = generateCurve(100, 0.217, 1024).at(-1).cost;
  assert.equal(formatCostPerKg(costPerKg(fin)), '$86.62/kg');
  assert.equal(formatCostPerKg(costPerKg(100)), '$1,000/kg');
  assert.equal(formatPercent(1 - fin / 100), '91.3%');
  assert.equal(formatCost(fin), '$8.66M');
});

test('default target, subsidy and Monte Carlo are unchanged', () => {
  const t = targetLaunchCost(100);
  assert.deepEqual(findTargetLaunch(100, 0.217, t), { status: 'reached', launch: 682 });
  assert.equal(formatCost(learningSubsidy(100, 0.217, t, 682)), '$3,620.75M');
  const mc = simulateUncertainty({ startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 1024, targetCost: t });
  assert.equal(mc.probability, 0.5908);
});

test('default milestone rows are unchanged', () => {
  const rows = milestoneRows({
    c1: 100, lr: 0.217, cadence: CADENCE_PRESETS.base, startYear: 2027, maxLaunches: 1024, targetPerKg: 100,
  });
  assert.deepEqual(rows.map((r) => [r.perKg, r.launch, r.date, r.isTarget, r.beyondRange]), [
    [500, 8, 'early 2027', false, false],
    [200, 96, 'mid 2028', false, false],
    [100, 682, 'late 2032', true, false],
    [50, 4859, 'mid 2039', false, true],
  ]);
});
