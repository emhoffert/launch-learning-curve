import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thinYearLabels } from '../src/chart.js';

const labels = (out) => out.map((t) => t.label);

test('thinYearLabels labels every tick when they are far enough apart', () => {
  const out = thinYearLabels(
    [
      { year: 2027, px: 0 },
      { year: 2028, px: 100 },
      { year: 2029, px: 200 },
    ],
    40,
  );
  assert.deepEqual(labels(out), ['2027', "'28", "'29"]);
  assert.deepEqual(
    out.map((t) => [t.year, t.px]),
    [
      [2027, 0],
      [2028, 100],
      [2029, 200],
    ],
  );
});

test('thinYearLabels blanks crowded labels but keeps every tick', () => {
  const out = thinYearLabels(
    [
      { year: 2027, px: 0 },
      { year: 2028, px: 20 },
      { year: 2029, px: 45 },
      { year: 2030, px: 60 },
    ],
    40,
  );
  assert.equal(out.length, 4);
  assert.deepEqual(labels(out), ['2027', '', "'29", '']);
  assert.deepEqual(
    out.map((t) => t.year),
    [2027, 2028, 2029, 2030],
  );
});

test('thinYearLabels handles a single tick and no ticks', () => {
  assert.deepEqual(labels(thinYearLabels([{ year: 2027, px: 72 }], 36)), ['2027']);
  assert.deepEqual(thinYearLabels([], 36), []);
});

test('thinYearLabels keeps visible labels at least minGapPx apart on dense input', () => {
  const ticks = [0, 10, 25, 33, 70, 80, 105, 140].map((px, i) => ({ year: 2027 + i, px }));
  const minGapPx = 30;
  const out = thinYearLabels(ticks, minGapPx);
  assert.equal(out.length, ticks.length);
  const shown = out.filter((t) => t.label !== '');
  assert.ok(shown.length >= 2);
  assert.equal(shown[0].label, '2027');
  for (let i = 1; i < shown.length; i++) {
    assert.ok(shown[i].px - shown[i - 1].px >= minGapPx, `labels at ${shown[i - 1].px} and ${shown[i].px}`);
    assert.match(shown[i].label, /^'\d\d$/);
  }
});

test('thinYearLabels starts with a full year even when the first tick is not the start year', () => {
  assert.deepEqual(
    labels(
      thinYearLabels(
        [
          { year: 2031, px: 0 },
          { year: 2032, px: 50 },
        ],
        36,
      ),
    ),
    ['2031', "'32"],
  );
});
