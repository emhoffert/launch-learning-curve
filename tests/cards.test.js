import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateCurve } from '../src/model.js';
import {
  cadenceSummary, cardState, milestoneStrip, stripPerKg, sureCard, toggleOpen, whenCard,
} from '../src/cards.js';

test('strip uses $100/kg when When is off and the target when on', () => {
  assert.equal(stripPerKg(false, 200), 100);
  assert.equal(stripPerKg(true, 200), 200);
});

test('default strip text', () => {
  const finalCost = generateCurve(100, 0.217, 1024).at(-1).cost;
  assert.equal(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost, perKg: 100 }),
    'From $1,000/kg at launch 1 · $100/kg by launch 682 · 91.3% lower by 1,024');
  assert.match(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost, perKg: 200 }), /\$200\/kg by launch 96/);
});

test('strip at 0% learning rate, at launch 1 and beyond the search limit', () => {
  assert.match(milestoneStrip({ c1: 100, lr: 0, maxLaunches: 1024, finalCost: 100, perKg: 100 }),
    /\$100\/kg never reached at a 0% learning rate/);
  assert.match(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost: 8.66, perKg: 2000 }),
    /\$2,000\/kg by launch 1 /);
  assert.match(milestoneStrip({ c1: 100, lr: 0.01, maxLaunches: 1024, finalCost: 90, perKg: 0.001 }),
    /not reached within 1,000,000 launches/);
});

test('when card with and without dates', () => {
  const result = { status: 'reached', launch: 682 };
  assert.deepEqual(whenCard({ result, perKg: 100, date: 'late 2032', datesOn: true }),
    { label: 'When · $100/kg', value: 'late 2032', sub: 'launch 682' });
  assert.deepEqual(whenCard({ result, perKg: 100, date: null, datesOn: false }),
    { label: 'When · $100/kg', value: 'launch 682', sub: '' });
  assert.equal(whenCard({ result: { status: 'unreachable' }, perKg: 100, datesOn: true }).value, 'Unreachable');
  assert.equal(whenCard({ result: { status: 'beyond-limit' }, perKg: 0.001, datesOn: true }).value, 'Not reached');
  assert.deepEqual(whenCard({ result: { status: 'reached', launch: 1 }, perKg: 2000, date: 'early 2027', datesOn: true }),
    { label: 'When · $2,000/kg', value: 'early 2027', sub: 'launch 1 (met at start)' });
});

test('sure card', () => {
  assert.deepEqual(sureCard({ whenOn: true, probability: 0.5908, targetCost: 10, startingCost: 100, maxLaunches: 1024 }),
    { label: 'How sure', value: '59%', sub: 'chance by launch 1,024' });
  assert.deepEqual(sureCard({ whenOn: false, probability: null, maxLaunches: 1024 }),
    { label: 'How sure', value: 'Bands on chart', sub: 'Add When? for a probability' });
  assert.equal(sureCard({ whenOn: true, probability: 1, targetCost: 200, startingCost: 100, maxLaunches: 1024 }).value, '100%');
});

test('cadence summary, open toggling, card state', () => {
  assert.equal(cadenceSummary('custom', 2029), 'Custom cadence · from 2029');
  assert.equal(cadenceSummary('base', 2027), 'Base cadence · from 2027');
  assert.equal(toggleOpen(null, 'when'), 'when');
  assert.equal(toggleOpen('when', 'when'), null);
  assert.equal(toggleOpen('when', 'sure'), 'sure');
  assert.equal(cardState({ active: false, error: true }), 'add');
  assert.equal(cardState({ active: true, error: false }), 'active');
  assert.equal(cardState({ active: true, error: true }), 'error');
});
