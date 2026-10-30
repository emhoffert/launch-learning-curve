// Renders a learning curve into an <svg> element as plain SVG markup.

import { linearScale, logScale, niceTicks, logTicks } from './scale.js';
import { formatCost, formatCostPerKg } from './format.js';
import { costPerKg } from './model.js';

// The viewBox matches the rendered width so text stays at its CSS size on any screen.
const MIN_WIDTH = 280;
const NARROW_WIDTH = 520;
const MARGIN = { top: 20, right: 72, bottom: 56, left: 72 };
const SVG_NS = 'http://www.w3.org/2000/svg';

const formatTick = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 }).format;

function el(name, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

function isPowerOfTwo(n) {
  return (n & (n - 1)) === 0;
}

// series: [{ n, cost }, ...] with n running 1..N.
// target (optional): { cost, perKg, launch } where cost is in $M and launch is the first
// launch at or below it, or null when there is none to show (unreachable or past the limit).
export function renderChart(svg, series, { logScale: useLog = false, target = null } = {}) {
  const maxLaunches = series[series.length - 1].n;
  const costs = series.map((p) => p.cost);
  // Stretch the cost axis to include the target so its line is always on the chart.
  // The launch axis keeps the user's selected range.
  if (target) costs.push(target.cost);
  let minCost = Math.min(...costs);
  let maxCost = Math.max(...costs);

  const width = Math.max(MIN_WIDTH, Math.round(svg.clientWidth || 720));
  const height = Math.round(Math.min(Math.max(width * 0.6, 300), 440));
  const narrow = width < NARROW_WIDTH;

  const plotLeft = MARGIN.left;
  const plotRight = width - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;

  // The right axis shows the same costs in $/kg. It is a constant multiple of the left
  // axis, so a scale over the converted domain lines up exactly with the left scale.
  let x, y, yKg, xTicks, yTicks, yKgTicks;
  if (useLog) {
    // A flat curve (learning rate 0) has no vertical extent; pad it so the scale works.
    if (minCost === maxCost) [minCost, maxCost] = [minCost / 2, maxCost * 2];
    x = logScale([1, maxLaunches], [plotLeft, plotRight]);
    y = logScale([minCost, maxCost], [plotBottom, plotTop]);
    // On narrow screens, label only powers of ten so x labels don't collide.
    xTicks = logTicks(1, maxLaunches).filter((t) => !narrow || Number.isInteger(Math.log10(t)));
    yTicks = logTicks(minCost, maxCost);
    yKg = logScale([costPerKg(minCost), costPerKg(maxCost)], [plotBottom, plotTop]);
    yKgTicks = logTicks(costPerKg(minCost), costPerKg(maxCost));
  } else {
    x = linearScale([0, maxLaunches], [plotLeft, plotRight]);
    y = linearScale([0, maxCost], [plotBottom, plotTop]);
    xTicks = niceTicks(0, maxLaunches, narrow ? 4 : 5);
    yTicks = niceTicks(0, maxCost);
    yKg = linearScale([0, costPerKg(maxCost)], [plotBottom, plotTop]);
    yKgTicks = niceTicks(0, costPerKg(maxCost));
  }

  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.replaceChildren();

  const grid = el('g', { class: 'grid' });
  const axes = el('g', { class: 'axis' });

  for (const t of xTicks) {
    const px = x(t);
    grid.append(el('line', { x1: px, x2: px, y1: plotTop, y2: plotBottom }));
    axes.append(
      el('text', { x: px, y: plotBottom + 20, 'text-anchor': 'middle', class: 'tick-label' }, formatTick(t)),
    );
  }
  for (const t of yTicks) {
    const py = y(t);
    grid.append(el('line', { x1: plotLeft, x2: plotRight, y1: py, y2: py }));
    axes.append(
      el('text', { x: plotLeft - 10, y: py + 4, 'text-anchor': 'end', class: 'tick-label' }, formatTick(t)),
    );
  }
  for (const t of yKgTicks) {
    axes.append(
      el('text', { x: plotRight + 10, y: yKg(t) + 4, 'text-anchor': 'start', class: 'tick-label' }, formatTick(t)),
    );
  }

  axes.append(el('line', { x1: plotLeft, x2: plotRight, y1: plotBottom, y2: plotBottom, class: 'axis-line' }));
  axes.append(el('line', { x1: plotLeft, x2: plotLeft, y1: plotTop, y2: plotBottom, class: 'axis-line' }));
  axes.append(el('line', { x1: plotRight, x2: plotRight, y1: plotTop, y2: plotBottom, class: 'axis-line' }));
  axes.append(
    el(
      'text',
      { x: (plotLeft + plotRight) / 2, y: height - 12, 'text-anchor': 'middle', class: 'axis-title' },
      'Cumulative launches',
    ),
  );
  axes.append(
    el(
      'text',
      {
        x: -(plotTop + plotBottom) / 2,
        y: 18,
        transform: 'rotate(-90)',
        'text-anchor': 'middle',
        class: 'axis-title',
      },
      'Cost per launch ($M)',
    ),
  );
  axes.append(
    el(
      'text',
      {
        x: (plotTop + plotBottom) / 2,
        y: -(width - 18),
        transform: 'rotate(90)',
        'text-anchor': 'middle',
        class: 'axis-title',
      },
      'Cost per kg ($/kg, 100 t payload)',
    ),
  );

  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(2)},${y(p.cost).toFixed(2)}`).join('');
  const curve = el('path', { d, class: 'curve' });

  // Mark each doubling (1, 2, 4, 8, ...) so the constant per-doubling drop is visible.
  const doublings = el('g', { class: 'doubling' });
  for (const p of series) {
    if (!isPowerOfTwo(p.n)) continue;
    const dot = el('circle', { cx: x(p.n), cy: y(p.cost), r: 4 });
    dot.append(el('title', {}, `Launch ${p.n.toLocaleString('en-US')}: ${formatCost(p.cost)} · ${formatCostPerKg(costPerKg(p.cost))}`));
    doublings.append(dot);
  }

  svg.append(grid);
  if (target) svg.append(targetShading(series, target, x, y));
  svg.append(axes, curve);
  if (target) svg.append(targetOverlay(target, x, y, { plotLeft, plotRight, plotBottom }, maxLaunches));
  svg.append(doublings);
}

// Shades the gap between the curve and the target line, from launch 1 through the target
// launch (or the right edge when the target launch is past the displayed range).
function targetShading(series, target, x, y) {
  const group = el('g', { class: 'target-gap' });
  if (target.launch === null || target.launch <= 1) return group;
  const last = Math.min(target.launch, series.length);
  const top = series
    .slice(0, last)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(2)},${y(Math.max(p.cost, target.cost)).toFixed(2)}`)
    .join('');
  const ty = y(target.cost).toFixed(2);
  group.append(el('path', { d: `${top}L${x(last).toFixed(2)},${ty}L${x(1).toFixed(2)},${ty}Z` }));
  return group;
}

// Dashed target line with its label, plus a marker and vertical guide at the target launch
// when it falls inside the displayed range.
function targetOverlay(target, x, y, { plotLeft, plotRight, plotBottom }, maxLaunches) {
  const group = el('g', { class: 'target' });
  const ty = y(target.cost);
  group.append(el('line', { x1: plotLeft, x2: plotRight, y1: ty, y2: ty, class: 'target-line' }));

  // Label below the left end of the line, clear of the curve, which starts above the target.
  // If the target is met at launch 1 the whole curve is below it, so label above the right end.
  const metAtStart = target.launch === 1;
  const room = plotBottom - ty;
  const above = metAtStart || room < 18;
  const targetText = `Target ${formatCostPerKg(target.perKg)}`;
  group.append(
    el(
      'text',
      {
        x: metAtStart ? plotRight - 6 : plotLeft + 6,
        y: above ? ty - 6 : ty + 15,
        'text-anchor': metAtStart ? 'end' : 'start',
        class: 'target-label',
      },
      targetText,
    ),
  );

  if (target.launch !== null && target.launch <= maxLaunches) {
    const mx = x(target.launch);
    group.append(el('line', { x1: mx, x2: mx, y1: ty, y2: plotBottom, class: 'target-guide' }));
    const marker = el('circle', { cx: mx, cy: ty, r: 5.5, class: 'target-marker' });
    marker.append(el('title', {}, `Target first met at launch ${target.launch.toLocaleString('en-US')}`));
    group.append(marker);
    const text = `Launch ${target.launch.toLocaleString('en-US')}`;
    const spot = launchLabelPosition(text, targetText, mx, ty, above, plotLeft, plotRight, plotBottom);
    if (spot) group.append(el('text', { ...spot, class: 'target-label' }, text));
  }
  return group;
}

// Picks a spot for the "Launch N" label that avoids the target label, the line and the curve,
// or returns null when there is none (narrow charts); the readouts still give the launch. Widths are estimated from character count (12px bold text is about 7px per character).
function launchLabelPosition(text, targetText, mx, ty, targetAbove, plotLeft, plotRight, plotBottom) {
  const w = text.length * 7;
  const targetRight = plotLeft + 6 + targetText.length * 7 + 8;
  const room = plotBottom - ty;
  const fitsLeft = (y) => mx - 6 - w >= (targetAbove || Math.abs(y - (ty + 15)) >= 14 ? plotLeft + 4 : targetRight);

  // Below the line, left of the guide: the curve is above the line there.
  if (room >= 18) {
    const y = room >= 30 ? plotBottom - 8 : ty + 15;
    if (fitsLeft(y)) return { x: mx - 6, y, 'text-anchor': 'end' };
    // Right of the guide only on the bottom row, well below where the curve runs.
    if (room >= 30 && mx + 6 + w <= plotRight - 4) return { x: mx + 6, y, 'text-anchor': 'start' };
  }
  // Above the line, right of the marker: the curve is below the line there.
  if (mx + 8 + w <= plotRight - 4 && (!targetAbove || mx + 8 >= targetRight)) {
    return { x: mx + 8, y: ty - 8, 'text-anchor': 'start' };
  }
  return null;
}
