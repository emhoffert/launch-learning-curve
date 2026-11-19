import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartHeight, thinYearLabels, thinYearTicks } from '../src/chart.js';

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

test('thinYearLabels uses full years when the ticks span 100 years or more', () => {
  const ticks = [2027, 2061, 2094, 2127].map((year, i) => ({ year, px: i * 40 }));
  assert.deepEqual(labels(thinYearLabels(ticks, 36)), ['2027', '2061', '2094', '2127']);
});

test('thinYearLabels keeps short labels when the ticks span under 100 years', () => {
  const ticks = [
    { year: 2027, px: 0 },
    { year: 2126, px: 100 },
  ];
  assert.deepEqual(labels(thinYearLabels(ticks, 36)), ['2027', "'26"]);
});

test('thinYearTicks drops ticks closer than minGapPx to the last kept tick', () => {
  const ticks = [0, 1, 2, 2.5, 4.1, 10].map((px, i) => ({ year: 2027 + i, px }));
  assert.deepEqual(
    thinYearTicks(ticks, 2).map((t) => t.px),
    [0, 2, 4.1, 10],
  );
  assert.deepEqual(thinYearTicks([], 2), []);
});

test('thinYearTicks defaults to a 2px gap and leaves well-spaced ticks unchanged', () => {
  const ticks = [0, 2, 14, 40].map((px, i) => ({ year: 2027 + i, px }));
  assert.deepEqual(thinYearTicks(ticks), ticks);
});

test('a 1 launch/year axis over 2,048 launches thins to spaced ticks and full-year labels', () => {
  // 2,048 yearly ticks across a ~556 px plot, as with Custom 1 / 0% at 2,048 launches.
  const ticks = Array.from({ length: 2048 }, (_, i) => ({ year: 2027 + i, px: 72 + (i * 556) / 2048 }));
  const kept = thinYearTicks(ticks);
  assert.ok(kept.length < 300, `${kept.length} ticks kept`);
  for (let i = 1; i < kept.length; i++) assert.ok(kept[i].px - kept[i - 1].px >= 2);
  const shown = thinYearLabels(kept, 36).filter((t) => t.label);
  assert.ok(shown.every((t) => /^\d{4}$/.test(t.label)), JSON.stringify(shown.map((t) => t.label)));
});

test('chartHeight: default without room, fills the room up to 3:4, never shorter', () => {
  // 726px wide (1440 desktop centre column): default 436.
  assert.equal(chartHeight(726, 20), 436);
  assert.equal(chartHeight(726, 20, 500.7), 500); // fills the room
  assert.equal(chartHeight(726, 20, 2000), 545); // capped at 0.75 × 726
  assert.equal(chartHeight(726, 20, 300), 436); // little room: keep the default, don't shrink
  assert.equal(chartHeight(966, 52, 670), 670); // MacBook Pro 16" window: fills the panel
  assert.equal(chartHeight(358, 52), 300); // mobile: unchanged
});
