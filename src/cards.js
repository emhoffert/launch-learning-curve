// Display text for the headline milestone strip and the "Go deeper" cards. Pure functions:
// no DOM, and every number comes from the existing model and format helpers.

import { DEFAULTS, MAX_TARGET_LAUNCH, costPerKg, findTargetLaunch, targetLaunchCost } from './model.js';
import { SCENARIO_LABELS } from './cadence.js';
import { formatCostPerKg, formatPercent, formatProbability } from './format.js';

const count = (n) => n.toLocaleString('en-US');

// The strip shows the illustrative default target while When is off, and the user's target once it is on.
export function stripPerKg(whenOn, targetPerKg) {
  return whenOn ? targetPerKg : DEFAULTS.targetPerKg;
}

// e.g. "From $1,000/kg at launch 1 · $100/kg by launch 682 · 91.3% lower by 1,024".
export function milestoneStrip({ c1, lr, maxLaunches, finalCost, perKg }) {
  const target = formatCostPerKg(perKg);
  const result = findTargetLaunch(c1, lr, targetLaunchCost(perKg));
  let middle;
  if (result.status === 'reached') middle = `${target} by launch ${count(result.launch)}`;
  else if (result.status === 'unreachable') middle = `${target} never reached at a 0% learning rate`;
  else middle = `${target} not reached within ${count(MAX_TARGET_LAUNCH)} launches`;
  const start = formatCostPerKg(costPerKg(c1));
  const lower = formatPercent(1 - finalCost / c1);
  return `From ${start} at launch 1 · ${middle} · ${lower} lower by ${count(maxLaunches)}`;
}

// The When result card. `result` is a findTargetLaunch result; `date` is the target row's modeled date.
export function whenCard({ result, perKg, date = null, datesOn }) {
  const label = `When · ${formatCostPerKg(perKg)}`;
  if (result.status === 'unreachable') return { label, value: 'Unreachable', sub: 'cost never falls at 0%' };
  if (result.status !== 'reached') return { label, value: 'Not reached', sub: `within ${count(MAX_TARGET_LAUNCH)} launches` };
  const launch = `launch ${count(result.launch)}${result.launch === 1 ? ' (met at start)' : ''}`;
  return datesOn && date ? { label, value: date, sub: launch } : { label, value: launch, sub: '' };
}

// The How sure result card. The probability needs a target, which comes from When.
export function sureCard({ whenOn, probability, targetCost, startingCost, maxLaunches }) {
  const label = 'How sure';
  if (!whenOn) return { label, value: 'Bands on chart', sub: 'Add When? for a probability' };
  const value = targetCost >= startingCost ? '100%' : formatProbability(probability);
  return { label, value, sub: `chance by launch ${count(maxLaunches)}` };
}

export function cadenceSummary(scenario, startYear) {
  return `${SCENARIO_LABELS[scenario] ?? 'Custom'} cadence · from ${startYear}`;
}

// Only one editor is open at a time; selecting the open card closes it.
export function toggleOpen(current, card) {
  return current === card ? null : card;
}

export function cardState({ active, error }) {
  if (!active) return 'add';
  return error ? 'error' : 'active';
}
