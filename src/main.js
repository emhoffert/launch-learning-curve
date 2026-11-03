// Wires the controls to the model and chart. Every input event redraws immediately.

import {
  DEFAULTS,
  MAX_TARGET_LAUNCH,
  costPerKg,
  exponentFromLearningRate,
  findTargetLaunch,
  generateCurve,
  learningSubsidy,
  targetLaunchCost,
} from './model.js';
import { MC_DEFAULTS, simulateUncertainty } from './montecarlo.js';
import { renderChart } from './chart.js';
import { formatCost, formatCostPerKg, formatPercent, formatProbability } from './format.js';

const LR_MAX_PERCENT = 50;
const LAUNCHES_MIN = 10;
const LAUNCHES_MAX = 2048;
const SD_MAX_POINTS = 20;

const $ = (id) => document.getElementById(id);
const controls = {
  lrRange: $('lr-range'),
  lrNumber: $('lr-number'),
  cost: $('starting-cost'),
  target: $('target-cost'),
  launches: $('max-launches'),
  launchesValue: $('max-launches-value'),
  logToggle: $('log-scale'),
  showTarget: $('show-target'),
  targetField: $('target-field'),
  showMc: $('show-mc'),
  mcField: $('mc-field'),
  sd: $('lr-sd'),
  sdHint: $('lr-sd-hint'),
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
  target: $('target-readout'),
  targetLaunch: $('target-launch'),
  targetCount: $('target-count'),
  subsidy: $('subsidy'),
  mcProbLabel: $('mc-prob-label'),
  mcProb: $('mc-prob'),
};
const mcPanel = $('mc-panel');
const lrLabel = document.querySelector('label[for="lr-range"]');
const LR_LABEL = lrLabel.textContent;
const LR_LABEL_MC = 'Expected learning rate (%)';
const targetPanel = $('target-panel');
const targetNote = $('target-note');
const CHART_LABEL = chart.getAttribute('aria-label');

// Returns validated inputs, or { error } describing the first problem found.
function readInputs() {
  const lrPercent = controls.lrNumber.valueAsNumber;
  const startingCost = controls.cost.valueAsNumber;
  const targetPerKg = controls.target.valueAsNumber;
  const maxLaunches = controls.launches.valueAsNumber;
  const sdPoints = controls.sd.valueAsNumber;

  if (!Number.isFinite(lrPercent) || lrPercent < 0 || lrPercent > LR_MAX_PERCENT) {
    return { error: `Learning rate must be between 0% and ${LR_MAX_PERCENT}%.` };
  }
  if (!Number.isFinite(startingCost) || startingCost <= 0) {
    return { error: 'Starting launch cost must be greater than 0.' };
  }
  // The target is optional: only validate it while the overlay is switched on.
  if (controls.showTarget.checked && (!Number.isFinite(targetPerKg) || targetPerKg <= 0)) {
    return { error: 'Target cost must be greater than 0.' };
  }
  if (!Number.isInteger(maxLaunches) || maxLaunches < LAUNCHES_MIN || maxLaunches > LAUNCHES_MAX) {
    return { error: `Cumulative launches must be a whole number from ${LAUNCHES_MIN} to ${LAUNCHES_MAX}.` };
  }
  if (controls.showMc.checked && (!Number.isFinite(sdPoints) || sdPoints < 0 || sdPoints > SD_MAX_POINTS)) {
    return { error: `Learning-rate uncertainty must be between 0 and ${SD_MAX_POINTS} percentage points.` };
  }
  return { learningRate: lrPercent / 100, startingCost, targetPerKg, maxLaunches, sd: sdPoints / 100 };
}

function update() {
  controls.launchesValue.textContent = controls.launches.valueAsNumber.toLocaleString('en-US');
  const targetOn = controls.showTarget.checked;
  controls.targetField.hidden = !targetOn;
  const mcOn = controls.showMc.checked;
  controls.mcField.hidden = !mcOn;
  lrLabel.textContent = mcOn ? LR_LABEL_MC : LR_LABEL;
  controls.lrNumber.setAttribute('aria-label', mcOn ? LR_LABEL_MC : LR_LABEL);

  const inputs = readInputs();
  if (inputs.error) {
    // Keep the last valid chart on screen, dimmed so it reads as out of date.
    message.textContent = inputs.error;
    chartPanel.classList.add('stale');
    return;
  }
  message.textContent = '';
  chartPanel.classList.remove('stale');

  const { learningRate, startingCost, targetPerKg, maxLaunches, sd } = inputs;
  const series = generateCurve(startingCost, learningRate, maxLaunches);
  let target = null;
  let result;
  let targetCost;
  if (targetOn) {
    targetCost = targetLaunchCost(targetPerKg);
    result = findTargetLaunch(startingCost, learningRate, targetCost);
    const launch = result.status === 'reached' ? result.launch : null;
    target = { cost: targetCost, perKg: targetPerKg, launch };
  }
  let mc = null;
  if (mcOn) {
    mc = simulateUncertainty({
      startingCost, mean: learningRate, sd, maxLaunches, targetCost: targetOn ? targetCost : null,
    });
  }
  // In uncertainty mode the median replaces the single-learning-rate curve as the line.
  renderChart(chart, mc ? mc.bands.p50 : series, { logScale: controls.logToggle.checked, target, bands: mc?.bands });

  const finalCost = series[series.length - 1].cost;
  readouts.progressRatio.textContent = formatPercent(1 - learningRate);
  readouts.exponent.textContent = exponentFromLearningRate(learningRate).toFixed(4);
  readouts.finalLabel.textContent = `Cost of launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.finalCost.textContent = formatCost(finalCost);
  readouts.reduction.textContent = formatPercent(1 - finalCost / startingCost);
  readouts.perKgLabel.textContent = `Modeled cost per kg at launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.perKg.textContent = formatCostPerKg(costPerKg(finalCost));
  targetPanel.hidden = !targetOn;
  targetNote.hidden = !targetOn || mcOn;
  mcPanel.hidden = !mcOn;
  if (mcOn) showUncertainty(mc, { learningRate, sd, startingCost, targetCost, maxLaunches, targetOn });
  if (targetOn) {
    showTarget(result, { startingCost, learningRate, targetCost, targetPerKg, maxLaunches });
  } else {
    chart.setAttribute('aria-label', CHART_LABEL);
  }
  if (mcOn) {
    const label = chart.getAttribute('aria-label');
    chart.setAttribute('aria-label', `${label} Monte Carlo median with 25th–75th and 5th–95th percentile bands.`);
  }
}

// Sets a readout to a value with an optional muted status line under it.
function setReadout(dd, value, status = '') {
  dd.replaceChildren(value);
  if (status) {
    const span = document.createElement('span');
    span.className = 'status';
    span.textContent = status;
    dd.append(span);
  }
}

function showTarget(result, { startingCost, learningRate, targetCost, targetPerKg, maxLaunches }) {
  const perKg = formatCostPerKg(targetPerKg);
  setReadout(readouts.target, perKg, `${formatCost(targetCost)} per launch`);

  let summary;
  if (result.status === 'reached') {
    const launch = result.launch.toLocaleString('en-US');
    const subsidy = learningSubsidy(startingCost, learningRate, targetCost, result.launch);
    const beyond = result.launch > maxLaunches;
    setReadout(readouts.targetLaunch, `Launch ${launch}`, beyond ? 'Target reached beyond displayed range' : '');
    setReadout(readouts.targetCount, `${launch} ${result.launch === 1 ? 'launch' : 'launches'}`);
    setReadout(readouts.subsidy, formatCost(subsidy), result.launch === 1 ? 'Target met at launch 1' : '');
    summary = `Target ${perKg} first met at launch ${launch}${beyond ? ', beyond the displayed range' : ''}.`;
  } else if (result.status === 'unreachable') {
    setReadout(readouts.targetLaunch, 'Unreachable', 'At a 0% learning rate, cost never falls');
    setReadout(readouts.targetCount, '—');
    setReadout(readouts.subsidy, '—', 'Not defined: target never reached');
    summary = `Target ${perKg} is unreachable at a 0% learning rate.`;
  } else {
    const limit = MAX_TARGET_LAUNCH.toLocaleString('en-US');
    setReadout(readouts.targetLaunch, 'Not reached', `Not within ${limit} launches`);
    setReadout(readouts.targetCount, `> ${limit}`);
    setReadout(readouts.subsidy, '—', `Not calculated past ${limit} launches`);
    summary = `Target ${perKg} is not reached within ${limit} launches.`;
  }
  chart.setAttribute('aria-label', `${CHART_LABEL}, with a dashed target cost line. ${summary}`);
}

function showUncertainty(mc, { learningRate, sd, startingCost, targetCost, maxLaunches, targetOn }) {
  const points = (sd * 100).toFixed(1);
  const low = learningRate - sd;
  const high = learningRate + sd;
  let hint = `Expected learning rate ${formatPercent(learningRate)}. Approximate 1σ range: `;
  hint += `${formatPercent(Math.max(low, 0))}–${formatPercent(high)} (±${points} percentage points).`;
  if (low < 0) hint += ' Draws below 0% are redrawn.';
  controls.sdHint.textContent = hint;

  const launch = maxLaunches.toLocaleString('en-US');
  readouts.mcProbLabel.textContent = `Probability of reaching the target by launch ${launch}`;
  if (!targetOn) {
    setReadout(readouts.mcProb, '—', 'Turn on the target cost to see this');
  } else if (targetCost >= startingCost) {
    setReadout(readouts.mcProb, '100%', 'Target met at launch 1');
  } else {
    setReadout(readouts.mcProb, formatProbability(mc.probability), `Within the displayed ${launch} launches, under the assumed model`);
  }
}

function setDefaults() {
  const lrPercent = (DEFAULTS.learningRate * 100).toFixed(1);
  controls.lrRange.value = lrPercent;
  controls.lrNumber.value = lrPercent;
  controls.cost.value = String(DEFAULTS.startingCost);
  controls.target.value = String(DEFAULTS.targetPerKg);
  controls.launches.value = String(DEFAULTS.maxLaunches);
  controls.logToggle.checked = false;
  controls.showTarget.checked = false;
  controls.sd.value = (MC_DEFAULTS.sd * 100).toFixed(1);
  controls.showMc.checked = false;
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
controls.target.addEventListener('input', update);
controls.launches.addEventListener('input', update);
controls.logToggle.addEventListener('change', update);
controls.showTarget.addEventListener('change', update);
controls.showMc.addEventListener('change', update);
controls.sd.addEventListener('input', update);
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
