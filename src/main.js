// Wires the controls to the model and chart. Every input event redraws immediately.

import { DEFAULTS, costPerKg, exponentFromLearningRate, generateCurve } from './model.js';
import { renderChart } from './chart.js';
import { formatCost, formatCostPerKg, formatPercent } from './format.js';

const LR_MAX_PERCENT = 50;
const LAUNCHES_MIN = 10;
const LAUNCHES_MAX = 2048;

const $ = (id) => document.getElementById(id);
const controls = {
  lrRange: $('lr-range'),
  lrNumber: $('lr-number'),
  cost: $('starting-cost'),
  launches: $('max-launches'),
  launchesValue: $('max-launches-value'),
  logToggle: $('log-scale'),
  reset: $('reset'),
};
const chart = $('chart');
const chartPanel = chart.closest('.chart-panel');
const message = $('message');
const readouts = {
  progressRatio: $('progress-ratio'),
  exponent: $('exponent'),
  finalLabel: $('final-label'),
  finalCost: $('final-cost'),
  reduction: $('reduction'),
  perKgLabel: $('per-kg-label'),
  perKg: $('per-kg'),
};

// Returns validated inputs, or { error } describing the first problem found.
function readInputs() {
  const lrPercent = controls.lrNumber.valueAsNumber;
  const startingCost = controls.cost.valueAsNumber;
  const maxLaunches = controls.launches.valueAsNumber;

  if (!Number.isFinite(lrPercent) || lrPercent < 0 || lrPercent > LR_MAX_PERCENT) {
    return { error: `Learning rate must be between 0% and ${LR_MAX_PERCENT}%.` };
  }
  if (!Number.isFinite(startingCost) || startingCost <= 0) {
    return { error: 'Starting launch cost must be greater than 0.' };
  }
  if (!Number.isInteger(maxLaunches) || maxLaunches < LAUNCHES_MIN || maxLaunches > LAUNCHES_MAX) {
    return { error: `Cumulative launches must be a whole number from ${LAUNCHES_MIN} to ${LAUNCHES_MAX}.` };
  }
  return { learningRate: lrPercent / 100, startingCost, maxLaunches };
}

function update() {
  controls.launchesValue.textContent = controls.launches.valueAsNumber.toLocaleString('en-US');

  const inputs = readInputs();
  if (inputs.error) {
    // Keep the last valid chart on screen, dimmed so it reads as out of date.
    message.textContent = inputs.error;
    chartPanel.classList.add('stale');
    return;
  }
  message.textContent = '';
  chartPanel.classList.remove('stale');

  const { learningRate, startingCost, maxLaunches } = inputs;
  const series = generateCurve(startingCost, learningRate, maxLaunches);
  renderChart(chart, series, { logScale: controls.logToggle.checked });

  const finalCost = series[series.length - 1].cost;
  readouts.progressRatio.textContent = formatPercent(1 - learningRate);
  readouts.exponent.textContent = exponentFromLearningRate(learningRate).toFixed(4);
  readouts.finalLabel.textContent = `Cost of launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.finalCost.textContent = formatCost(finalCost);
  readouts.reduction.textContent = formatPercent(1 - finalCost / startingCost);
  readouts.perKgLabel.textContent = `Modeled cost per kg at launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.perKg.textContent = formatCostPerKg(costPerKg(finalCost));
}

function setDefaults() {
  const lrPercent = (DEFAULTS.learningRate * 100).toFixed(1);
  controls.lrRange.value = lrPercent;
  controls.lrNumber.value = lrPercent;
  controls.cost.value = String(DEFAULTS.startingCost);
  controls.launches.value = String(DEFAULTS.maxLaunches);
  controls.logToggle.checked = false;
}

// Keep the learning-rate slider and number box in sync.
controls.lrRange.addEventListener('input', () => {
  controls.lrNumber.value = controls.lrRange.value;
  update();
});
controls.lrNumber.addEventListener('input', () => {
  const value = controls.lrNumber.valueAsNumber;
  if (Number.isFinite(value) && value >= 0 && value <= LR_MAX_PERCENT) {
    controls.lrRange.value = String(value);
  }
  update();
});
controls.cost.addEventListener('input', update);
controls.launches.addEventListener('input', update);
controls.logToggle.addEventListener('change', update);
controls.reset.addEventListener('click', () => {
  setDefaults();
  update();
});

// The chart sizes itself to its container, so redraw whenever the container's width
// changes (window resize, scrollbar appearing, layout reflow), at most once per frame.
let lastPanelWidth = 0;
let pendingFrame = 0;
new ResizeObserver(([entry]) => {
  const width = entry.contentRect.width;
  if (width === lastPanelWidth) return;
  lastPanelWidth = width;
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(update);
}).observe(chartPanel);

setDefaults();
update();
