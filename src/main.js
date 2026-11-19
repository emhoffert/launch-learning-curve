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
import {
  CADENCE_DEFAULTS,
  CADENCE_LIMITS,
  CADENCE_PRESETS,
  SCENARIO_LABELS,
  milestoneRows,
  yearTicks,
} from './cadence.js';
import { renderChart } from './chart.js';
import { formatCost, formatCostPerKg, formatPercent, formatProbability } from './format.js';
import {
  cadenceSummary, cardState, milestoneStrip, stripPerKg, sureCard, toggleOpen, whenCard,
} from './cards.js';

const LR_MAX_PERCENT = 50;
const LAUNCHES_MIN = 10;
const LAUNCHES_MAX = 2048;
const SD_MAX_POINTS = 20;
// Calendar dates start on the first time When is turned on (a UI default; the cadence model is unchanged).
const DATES_DEFAULT_ON = true;

const $ = (id) => document.getElementById(id);
const controls = {
  lrRange: $('lr-range'),
  lrNumber: $('lr-number'),
  cost: $('starting-cost'),
  target: $('target-cost'),
  launches: $('max-launches'),
  launchesValue: $('max-launches-value'),
  scaleLinear: $('scale-linear'),
  scaleLog: $('scale-log'),
  showTarget: $('show-target'),
  showMc: $('show-mc'),
  sd: $('lr-sd'),
  sdHint: $('lr-sd-hint'),
  showCalendar: $('show-calendar'),
  calendarField: $('calendar-field'),
  startYear: $('start-year'),
  scenario: $('cadence-scenario'),
  firstYear: $('first-year-launches'),
  growth: $('annual-growth'),
  reset: $('reset'),
  moreInputsToggle: $('more-inputs-toggle'),
  cadenceChange: $('cadence-change'),
};
const cards = {
  when: { card: $('when-card'), editor: $('when-editor'), heading: $('when-heading'), toggle: controls.showTarget },
  sure: { card: $('sure-card'), editor: $('sure-editor'), heading: $('sure-heading'), toggle: controls.showMc },
};
const ui = { open: null };
const core = $('core');
const layout = document.querySelector('main');
const moreInputsSummary = $('more-inputs-summary');
const milestoneStripEl = $('milestone-strip');
const milestoneTable = $('milestone-table');
const targetDateRow = $('target-date-row');
const targetDate = $('target-date');
const cadenceInputs = $('cadence-inputs');
const cadenceSummaryEl = $('cadence-summary');
const shortFirstYear = $('short-first-year');
const cadenceGrowthYearNote = $('cadence-growth-year-note');
const DISCLOSURES = ['about', 'model-details', 'chart-help', 'calendar-details', 'more-analysis', 'mc-details'].map($);
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
const lrLabel = document.querySelector('label[for="lr-range"]');
const LR_LABEL = lrLabel.textContent;
const LR_LABEL_MC = 'Expected learning rate (%)';
const targetNote = $('target-note');
const CHART_LABEL = chart.getAttribute('aria-label');
const calendarRows = $('calendar-rows');
const calendarMcNote = $('calendar-mc-note');
const calendarStartYear = $('calendar-start-year');
const cadenceDelay = $('cadence-delay');
const cadenceDelayYear = $('cadence-delay-year');
const cadenceGrowthYear = $('cadence-growth-year');
const GROWTH_MAX_PERCENT = CADENCE_LIMITS.growthMax * 100;

// Keep the input limits in step with the cadence model.
controls.startYear.min = String(CADENCE_LIMITS.startYearMin);
controls.startYear.max = String(CADENCE_LIMITS.startYearMax);
controls.firstYear.min = String(CADENCE_LIMITS.firstYearMin);
controls.firstYear.max = String(CADENCE_LIMITS.firstYearMax);
controls.growth.max = String(GROWTH_MAX_PERCENT);

// Returns validated inputs, or { error } describing the first problem found.
function readInputs() {
  const lrPercent = controls.lrNumber.valueAsNumber;
  const startingCost = controls.cost.valueAsNumber;
  const targetPerKg = controls.target.valueAsNumber;
  const maxLaunches = controls.launches.valueAsNumber;
  const sdPoints = controls.sd.valueAsNumber;

  if (!Number.isFinite(lrPercent) || lrPercent < 0 || lrPercent > LR_MAX_PERCENT) {
    return { error: `Learning rate must be between 0% and ${LR_MAX_PERCENT}%.`, field: 'core' };
  }
  if (!Number.isFinite(startingCost) || startingCost <= 0) {
    return { error: 'Starting launch cost must be greater than 0.', field: 'core' };
  }
  // The target is optional: only validate it while the overlay is switched on.
  if (controls.showTarget.checked && (!Number.isFinite(targetPerKg) || targetPerKg <= 0)) {
    return { error: 'Target cost must be greater than 0.', field: 'when' };
  }
  if (!Number.isInteger(maxLaunches) || maxLaunches < LAUNCHES_MIN || maxLaunches > LAUNCHES_MAX) {
    return { error: `Cumulative launches must be a whole number from ${LAUNCHES_MIN} to ${LAUNCHES_MAX}.`, field: 'core' };
  }
  if (controls.showMc.checked && (!Number.isFinite(sdPoints) || sdPoints < 0 || sdPoints > SD_MAX_POINTS)) {
    return { error: `Learning-rate uncertainty must be between 0 and ${SD_MAX_POINTS} percentage points.`, field: 'sure' };
  }
  const inputs = { learningRate: lrPercent / 100, startingCost, targetPerKg, maxLaunches, sd: sdPoints / 100 };
  // The calendar inputs are only validated while the timeline is switched on.
  if (!calendarIsOn()) return inputs;
  const calendar = readCalendarInputs();
  return calendar.error ? { ...calendar, field: 'when' } : { ...inputs, ...calendar };
}

// Calendar dates live inside When: they only apply while When is on.
function calendarIsOn() {
  return controls.showTarget.checked && controls.showCalendar.checked;
}

function readCalendarInputs() {
  const startYear = controls.startYear.valueAsNumber;
  const firstYear = controls.firstYear.valueAsNumber;
  const growthPercent = controls.growth.valueAsNumber;
  const { startYearMin, startYearMax, firstYearMin, firstYearMax } = CADENCE_LIMITS;

  if (!Number.isInteger(startYear) || startYear < startYearMin || startYear > startYearMax) {
    return { error: `Start year must be a whole number from ${startYearMin} to ${startYearMax}.` };
  }
  if (!Number.isInteger(firstYear) || firstYear < firstYearMin || firstYear > firstYearMax) {
    const max = firstYearMax.toLocaleString('en-US');
    return { error: `First-year launches must be a whole number from ${firstYearMin} to ${max}.` };
  }
  if (!Number.isFinite(growthPercent) || growthPercent < 0 || growthPercent > GROWTH_MAX_PERCENT) {
    return { error: `Annual growth must be between 0% and ${GROWTH_MAX_PERCENT}%.` };
  }
  const scenario = controls.scenario.value in SCENARIO_LABELS ? controls.scenario.value : 'custom';
  return { startYear, scenario, cadence: { firstYear, growth: growthPercent / 100 } };
}

function update() {
  controls.launchesValue.textContent = controls.launches.valueAsNumber.toLocaleString('en-US');
  const targetOn = controls.showTarget.checked;
  const mcOn = controls.showMc.checked;
  const calendarOn = calendarIsOn();
  controls.calendarField.hidden = !calendarOn;
  controls.showCalendar.setAttribute('aria-expanded', String(calendarOn));
  lrLabel.textContent = mcOn ? LR_LABEL_MC : LR_LABEL;
  controls.lrNumber.setAttribute('aria-label', mcOn ? LR_LABEL_MC : LR_LABEL);

  const inputs = readInputs();
  if (inputs.error) {
    // Keep the last valid chart on screen, dimmed so it reads as out of date.
    message.textContent = inputs.error;
    chartPanel.classList.add('stale');
    layout.classList.add('stale');
    setCardStates(inputs.field);
    return;
  }
  layout.classList.remove('stale');
  setCardStates(null);
  message.textContent = '';
  chartPanel.classList.remove('stale');

  const { learningRate, startingCost, targetPerKg, maxLaunches, sd, startYear, scenario, cadence } = inputs;
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
  let calendar = null;
  if (calendarOn) {
    calendar = {
      label: `Modeled calendar year (${SCENARIO_LABELS[scenario]})`,
      ticks: yearTicks(maxLaunches, cadence, startYear),
    };
  }
  // In uncertainty mode the median replaces the single-learning-rate curve as the line.
  renderChart(chart, mc ? mc.bands.p50 : series, {
    logScale: controls.scaleLog.getAttribute('aria-pressed') === 'true', target, bands: mc?.bands, calendar,
    maxHeight: chartRoom(),
  });

  const finalCost = series[series.length - 1].cost;
  readouts.progressRatio.textContent = formatPercent(1 - learningRate);
  readouts.exponent.textContent = exponentFromLearningRate(learningRate).toFixed(4);
  readouts.finalLabel.textContent = `Cost of launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.finalCost.textContent = formatCost(finalCost);
  readouts.reduction.textContent = formatPercent(1 - finalCost / startingCost);
  readouts.perKgLabel.textContent = `Modeled cost per kg at launch ${maxLaunches.toLocaleString('en-US')}`;
  readouts.perKg.textContent = formatCostPerKg(costPerKg(finalCost));
  targetNote.hidden = !targetOn || mcOn;
  moreInputsSummary.textContent = `${formatCost(startingCost)} · ${maxLaunches.toLocaleString('en-US')}`;
  milestoneStripEl.textContent = milestoneStrip({
    c1: startingCost, lr: learningRate, maxLaunches, finalCost, perKg: stripPerKg(targetOn, targetPerKg),
  });
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
  let targetRow = null;
  if (targetOn) {
    // The milestone table always shows while When is on; dates need the calendar. With dates off,
    // the table is filled with the default cadence and its date column is hidden.
    const rows = showMilestones({
      startingCost, learningRate, maxLaunches, targetPerKg,
      cadence: calendarOn ? cadence : CADENCE_PRESETS[CADENCE_DEFAULTS.scenario],
      startYear: calendarOn ? startYear : CADENCE_DEFAULTS.startYear,
    });
    targetRow = rows.find((row) => row.isTarget) ?? null;
    milestoneTable.classList.toggle('no-dates', !calendarOn);
    targetDateRow.hidden = !calendarOn;
    targetDate.textContent = calendarOn && targetRow?.date ? targetRow.date : '—';
    fillCard(cards.when.card, whenCard({ result, perKg: targetPerKg, date: targetRow?.date, datesOn: calendarOn }));
  }
  if (mcOn) {
    fillCard(cards.sure.card, sureCard({
      whenOn: targetOn, probability: mc.probability, targetCost, startingCost, maxLaunches,
    }));
  }
  if (calendarOn) {
    cadenceSummaryEl.textContent = cadenceSummary(scenario, startYear);
    calendarMcNote.hidden = !mcOn;
    const label = chart.getAttribute('aria-label');
    const sep = label.endsWith('.') ? ' ' : '. ';
    const scenarioLabel = SCENARIO_LABELS[scenario];
    chart.setAttribute('aria-label', `${label}${sep}Calendar-year axis along the top (${scenarioLabel}, from ${startYear}).`);
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

// Fills the milestone table and the start-year wording in the cadence notes. Returns the rows.
function showMilestones({ startingCost, learningRate, cadence, startYear, maxLaunches, targetPerKg }) {
  calendarStartYear.textContent = String(startYear);
  cadenceDelay.hidden = startYear === CADENCE_DEFAULTS.startYear;
  cadenceDelayYear.textContent = String(startYear);
  cadenceGrowthYear.textContent = String(startYear + 1);
  cadenceGrowthYearNote.textContent = String(startYear + 1);
  shortFirstYear.textContent = String(startYear);

  const rows = milestoneRows({ c1: startingCost, lr: learningRate, cadence, startYear, maxLaunches, targetPerKg });
  calendarRows.replaceChildren(...rows.map((row) => {
    const tr = document.createElement('tr');
    if (row.isTarget) tr.className = 'calendar-target';
    const perKg = document.createElement('th');
    perKg.scope = 'row';
    perKg.textContent = row.isTarget ? `Target (${formatCostPerKg(row.perKg)})` : formatCostPerKg(row.perKg);
    const launch = document.createElement('td');
    const date = document.createElement('td');
    if (row.status === 'reached') {
      launch.textContent = row.launch.toLocaleString('en-US');
      setReadout(date, row.date, row.beyondRange ? 'beyond displayed range' : '');
    } else {
      launch.textContent = '—';
      const limit = MAX_TARGET_LAUNCH.toLocaleString('en-US');
      const why = row.status === 'unreachable' ? 'At a 0% learning rate, cost never falls' : `Not within ${limit} launches`;
      setReadout(date, 'not reached', why);
    }
    tr.append(perKg, launch, date);
    return tr;
  }));
  return rows;
}

// Writes a card's result text: label, large value, and a muted line.
function fillCard(card, { label, value, sub }) {
  card.querySelector('.card-k').textContent = label;
  card.querySelector('.card-v').textContent = value;
  card.querySelector('.card-sub').textContent = sub;
}

// Each card is "add" while its analysis is off, "active" when on, and "error" when on with an invalid input.
function setCardStates(errorField) {
  for (const [name, { card, toggle }] of Object.entries(cards)) {
    card.dataset.state = cardState({ active: toggle.checked, error: errorField === name });
    // A card turned on while another input is invalid has no result yet: show a placeholder.
    if (errorField && toggle.checked && !card.querySelector('.card-v').textContent) {
      fillCard(card, { label: name === 'when' ? 'When' : 'How sure', value: '—', sub: 'waiting for valid inputs' });
    }
  }
}

// Shows one editor (or none) and keeps each card's aria-expanded in step.
function setOpen(name) {
  ui.open = name;
  for (const [key, { card, editor }] of Object.entries(cards)) {
    editor.hidden = key !== name;
    card.setAttribute('aria-expanded', String(key === name));
  }
}

function setScale(log) {
  controls.scaleLinear.setAttribute('aria-pressed', String(!log));
  controls.scaleLog.setAttribute('aria-pressed', String(log));
}

function setCoreCollapsed(collapsed) {
  core.dataset.collapsed = String(collapsed);
  controls.moreInputsToggle.setAttribute('aria-expanded', String(!collapsed));
}

function setCadenceInputsOpen(open) {
  cadenceInputs.hidden = !open;
  controls.cadenceChange.setAttribute('aria-expanded', String(open));
}

// Fills both cadence numbers from a preset.
function applyPreset(name) {
  const preset = CADENCE_PRESETS[name];
  if (!preset) return;
  controls.firstYear.value = String(preset.firstYear);
  controls.growth.value = String(Math.round(preset.growth * 1000) / 10);
}

function setDefaults() {
  const lrPercent = (DEFAULTS.learningRate * 100).toFixed(1);
  controls.lrRange.value = lrPercent;
  controls.lrNumber.value = lrPercent;
  controls.cost.value = String(DEFAULTS.startingCost);
  controls.target.value = String(DEFAULTS.targetPerKg);
  controls.launches.value = String(DEFAULTS.maxLaunches);
  setScale(false);
  controls.showTarget.checked = false;
  controls.sd.value = (MC_DEFAULTS.sd * 100).toFixed(1);
  controls.showMc.checked = false;
  controls.showCalendar.checked = DATES_DEFAULT_ON;
  controls.startYear.value = String(CADENCE_DEFAULTS.startYear);
  controls.scenario.value = CADENCE_DEFAULTS.scenario;
  applyPreset(CADENCE_DEFAULTS.scenario);
  setOpen(null);
  setCoreCollapsed(true);
  setCadenceInputsOpen(false);
  for (const details of DISCLOSURES) details.open = false;
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
controls.scaleLinear.addEventListener('click', () => { setScale(false); update(); });
controls.scaleLog.addEventListener('click', () => { setScale(true); update(); });
controls.moreInputsToggle.addEventListener('click', () => setCoreCollapsed(core.dataset.collapsed !== 'true'));
controls.cadenceChange.addEventListener('click', () => setCadenceInputsOpen(cadenceInputs.hidden));
// Mobile "Go deeper" row: scroll to the cards and put focus there, without turning anything on.
document.getElementById('go-deeper-link').addEventListener('click', (event) => {
  event.preventDefault();
  const heading = document.getElementById('deeper-heading');
  const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  heading.closest('.deeper').scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
  heading.focus({ preventScroll: true });
});
for (const [name, { card, heading, toggle }] of Object.entries(cards)) {
  card.addEventListener('click', () => {
    if (!toggle.checked) {
      // An add card turns its analysis on, opens its editor, and moves focus there.
      toggle.checked = true;
      setOpen(name);
      update();
      heading.focus();
      return;
    }
    setOpen(toggleOpen(ui.open, name));
  });
  toggle.addEventListener('change', () => {
    if (!toggle.checked && ui.open === name) {
      setOpen(null);
      card.focus();
    }
    update();
  });
}
controls.sd.addEventListener('input', update);
controls.showCalendar.addEventListener('change', update);
controls.startYear.addEventListener('input', update);
controls.scenario.addEventListener('change', () => {
  applyPreset(controls.scenario.value);
  update();
});
// Editing either cadence number makes it a Custom scenario, starting from the values shown.
for (const input of [controls.firstYear, controls.growth]) {
  input.addEventListener('input', () => {
    controls.scenario.value = 'custom';
    update();
  });
}
controls.reset.addEventListener('click', () => {
  setDefaults();
  update();
  // Reset collapses the inputs that hold this button on narrow layouts; keep focus on a visible control.
  if (controls.moreInputsToggle.checkVisibility()) controls.moreInputsToggle.focus();
});

// On the fixed-height desktop workspace the chart may grow into the centre panel's unused
// height: the room is the chart's current height plus whatever the panel has left over.
// Elsewhere (mobile, short windows) the page scrolls and the chart keeps its default height.
const desktopWorkspace = window.matchMedia('(min-width: 61rem) and (min-height: 700px)');
function chartRoom() {
  if (!desktopWorkspace.matches) return null;
  const style = getComputedStyle(chartPanel);
  const inner = chartPanel.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  const kids = [...chartPanel.children].filter((child) => child.checkVisibility());
  const used = kids.at(-1).getBoundingClientRect().bottom - kids[0].getBoundingClientRect().top;
  return chart.getBoundingClientRect().height + inner - used - 2;
}

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
// The room above depends on the window height and on whether the chart help is open.
const scheduleUpdate = () => { cancelAnimationFrame(pendingFrame); pendingFrame = requestAnimationFrame(update); };
window.addEventListener('resize', scheduleUpdate);
$('chart-help').addEventListener('toggle', scheduleUpdate);

setDefaults();
update();
