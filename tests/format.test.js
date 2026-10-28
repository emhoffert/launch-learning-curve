import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCost, formatPercent } from '../src/format.js';
import { unitCost } from '../src/model.js';

test('formatCost shows up to two decimals for costs of $1M or more', () => {
  assert.equal(formatCost(100), '$100M');
  assert.equal(formatCost(78.3), '$78.3M');
  assert.equal(formatCost(61.3089), '$61.31M');
  assert.equal(formatCost(8.6623), '$8.66M');
  assert.equal(formatCost(1), '$1M');
  assert.equal(formatCost(12345.678), '$12,345.68M');
});

test('formatCost keeps three significant digits below $1M', () => {
  assert.equal(formatCost(0.5), '$0.5M');
  assert.equal(formatCost(0.12345), '$0.123M');
  assert.equal(formatCost(0.000488281), '$0.000488M');
});

test('formatCost never shows $0M for a positive modeled cost', () => {
  // $1M start, 50% learning rate, launch 2,048: the review's failure case.
  const tiny = unitCost(2048, 1, 0.5);
  assert.notEqual(formatCost(tiny), '$0M');
  assert.equal(formatCost(tiny), '$0.000488M');
});

test('formatPercent shows one decimal in the normal range', () => {
  assert.equal(formatPercent(0.783), '78.3%');
  assert.equal(formatPercent(0.9134), '91.3%');
  assert.equal(formatPercent(0), '0.0%');
  assert.equal(formatPercent(1), '100.0%');
});

test('formatPercent adds decimals instead of rounding up to 100.0%', () => {
  assert.equal(formatPercent(0.9995117), '99.95%');
  assert.equal(formatPercent(0.99996), '99.996%');
  assert.equal(formatPercent(0.9994), '99.9%');
});
