// Renders a learning curve into an <svg> element as plain SVG markup.

import { linearScale, logScale, niceTicks, logTicks } from './scale.js';
import { formatCost, formatCostPerKg } from './format.js';
import { costPerKg } from './model.js';

// The viewBox matches the rendered width so text stays at its CSS size on any screen.
const MIN_WIDTH = 280;
const NARROW_WIDTH = 520;
const MARGIN = { top: 20, right: 72, bottom: 56, left: 72 };
// Top margin when the calendar-year axis is shown: room for its labels and title.
const CALENDAR_TOP = 52;
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

// The SVG height for a given width. With maxHeight (the room the desktop panel has free),
// the chart fills that room, but is never taller than MAX_ASPECT × its width (so it keeps a
// chart-like shape on very tall windows) and never shorter than the default.
const MAX_ASPECT = 0.75;
export function chartHeight(width, plotTop, maxHeight = null) {
  const base = Math.round(Math.min(Math.max(width * 0.6, 300), 440));
  if (maxHeight === null) return base;
  return Math.max(base, Math.min(Math.floor(maxHeight), Math.round(width * MAX_ASPECT)));
}

// series: [{ n, cost }, ...] with n running 1..N.
// target (optional): { cost, perKg, launch } where cost is in $M and launch is the first
// launch at or below it, or null when there is none to show (unreachable or past the limit).
// bands (optional): Monte Carlo percentile curves { p5, p25, p75, p95 }, each shaped like
// series. When given, series is the median curve and the target gap is not shaded.
// maxHeight (optional): the height available to the SVG; see chartHeight.
// calendar (optional): { label, ticks: [{ year, launch }, ...] } draws a calendar-year axis
// along the top, with each year's tick at its (fractional) launch position. The caller
// builds the label and ticks; the chart only draws them.
export function renderChart(
  svg,
  series,
  { logScale: useLog = false, target = null, bands = null, calendar = null, maxHeight = null } = {},
) {
  const maxLaunches = series[series.length - 1].n;
  const costs = series.map((p) => p.cost);
  // p5 is the low-cost edge; every band starts at C1, so it only extends the axis downward.
  if (bands) costs.push(bands.p5[bands.p5.length - 1].cost);
  // Stretch the cost axis to include the target so its line is always on the chart.
  // The launch axis keeps the user's selected range.
  if (target) costs.push(target.cost);
  let minCost = Math.min(...costs);
  let maxCost = Math.max(...costs);

  const width = Math.max(MIN_WIDTH, Math.round(svg.clientWidth || 720));
  const narrow = width < NARROW_WIDTH;
  const plotTop = calendar ? CALENDAR_TOP : MARGIN.top;
  const height = chartHeight(width, plotTop, maxHeight);

  const plotLeft = MARGIN.left;
  const plotRight = width - MARGIN.right;
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
    dot.append(el('title', {}, `${bands ? 'Median, launch' : 'Launch'} ${p.n.toLocaleString('en-US')}: ${formatCost(p.cost)} · ${formatCostPerKg(costPerKg(p.cost))}`));
    doublings.append(dot);
  }

  svg.append(grid);
  if (bands) svg.append(uncertaintyBands(bands, x, y));
  else if (target) svg.append(targetShading(series, target, x, y));
  svg.append(axes);
  if (calendar) {
    const domainMin = useLog ? 1 : 0;
    const ticks = calendar.ticks.filter((t) => t.launch >= domainMin && t.launch <= maxLaunches);
    svg.append(calendarAxis(calendar.label, ticks, x, { plotLeft, plotRight, plotTop }, narrow ? 30 : 36));
  }
  svg.append(curve);
  if (target) {
    // On narrow linear charts the corner where the curve meets the target line is crowded, so
    // the labels move up into the open space above the curve (or the top band) with leaders.
    const upper = narrow && !useLog ? (bands ? bands.p95 : series) : null;
    svg.append(targetOverlay(target, x, y, { plotLeft, plotRight, plotTop, plotBottom }, maxLaunches, upper));
  }
  svg.append(doublings);
}

// Calendar-year axis along the top of the plot: an axis line, a tick mark for every year,
// thinned year labels and a centered title. Ticks closer than 2 px are dropped first.
function calendarAxis(label, ticks, x, { plotLeft, plotRight, plotTop }, minGapPx) {
  const group = el('g', { class: 'axis calendar-axis' });
  group.append(el('line', { x1: plotLeft, x2: plotRight, y1: plotTop, y2: plotTop, class: 'axis-line' }));
  const placed = thinYearLabels(
    thinYearTicks(ticks.map((t) => ({ year: t.year, px: x(t.launch) }))),
    minGapPx,
  );
  for (const t of placed) {
    group.append(el('line', { x1: t.px, x2: t.px, y1: plotTop - 6, y2: plotTop, class: 'axis-line' }));
    if (t.label) {
      group.append(el('text', { x: t.px, y: plotTop - 10, 'text-anchor': 'middle', class: 'tick-label' }, t.label));
    }
  }
  group.append(
    el('text', { x: (plotLeft + plotRight) / 2, y: plotTop - 32, 'text-anchor': 'middle', class: 'axis-title' }, label),
  );
  return group;
}

// Drops year ticks that would sit closer than minGapPx to the last tick kept, so a very slow
// cadence (one tick per launch or less) doesn't merge into a solid bar. ticks: [{ year, px }]
// in ascending px. The first tick is always kept; well-spaced ticks pass through unchanged.
export function thinYearTicks(ticks, minGapPx = 2) {
  let lastPx = null;
  return ticks.filter(({ px }) => {
    if (lastPx !== null && px - lastPx < minGapPx) return false;
    lastPx = px;
    return true;
  });
}

// Thins year labels so none collide. ticks: [{ year, px }] in ascending px. Returns every tick
// with a label: the full year for the first one shown, a short "'28" form after that, or ''
// (tick mark only) when it would sit closer than minGapPx to the last label kept.
// When the ticks span 100 years or more, every label is a full year, because a short "'26"
// could then be read as a year in the wrong century.
export function thinYearLabels(ticks, minGapPx) {
  const fullYears = ticks.length > 1 && ticks[ticks.length - 1].year - ticks[0].year >= 100;
  let lastPx = null;
  return ticks.map(({ year, px }) => {
    if (lastPx !== null && px - lastPx < minGapPx) return { year, px, label: '' };
    const label = lastPx === null || fullYears ? String(year) : `'${String(year).slice(-2)}`;
    lastPx = px;
    return { year, px, label };
  });
}

// Shades the 5th–95th and 25th–75th percentile bands, outer band first so the inner one sits on top.
function uncertaintyBands(bands, x, y) {
  const group = el('g', { class: 'mc-bands' });
  for (const [low, high, cls] of [['p5', 'p95', 'band-outer'], ['p25', 'p75', 'band-inner']]) {
    const top = bands[high].map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(2)},${y(p.cost).toFixed(2)}`);
    const bottom = bands[low].slice().reverse().map((p) => `L${x(p.n).toFixed(2)},${y(p.cost).toFixed(2)}`);
    group.append(el('path', { d: `${top.join('')}${bottom.join('')}Z`, class: cls }));
  }
  return group;
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
function targetOverlay(target, x, y, { plotLeft, plotRight, plotTop, plotBottom }, maxLaunches, upper) {
  const group = el('g', { class: 'target' });
  const ty = y(target.cost);
  group.append(el('line', { x1: plotLeft, x2: plotRight, y1: ty, y2: ty, class: 'target-line' }));

  const inRange = target.launch !== null && target.launch > 1 && target.launch <= maxLaunches;
  const lifted = upper && inRange && liftedLabels(target, upper, x, y, ty, { plotLeft, plotRight, plotTop });

  // Label below the left end of the line, clear of the curve, which starts above the target.
  // If the target is met at launch 1 the whole curve is below it, so label above the right end.
  const metAtStart = target.launch === 1;
  const room = plotBottom - ty;
  const above = metAtStart || room < 18;
  const targetText = `Target ${formatCostPerKg(target.perKg)}`;
  if (!lifted) group.append(
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
    if (lifted) {
      drawLifted(group, lifted, mx, ty);
      group.append(marker);
      return group;
    }
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

// Narrow linear charts: places "Launch N" just above the curve (or top band) at the target
// launch and "Target $X/kg" in the open space above it, each with a dotted leader back to the
// marker or the target line. Returns null when they don't fit, and the caller falls back.
const LABEL_ASCENT = 11; // 12px bold text: baseline to top
const LABEL_DESCENT = 3;
function liftedLabels(target, upper, x, y, ty, { plotLeft, plotRight, plotTop }) {
  const mx = x(target.launch);
  const minTop = plotTop + 4;
  // Highest drawn point (smallest y) of the upper curve over [a, b], with room for the doubling
  // dots. Includes the last point left of a, since the segment from it runs into the span.
  const ceiling = (a, b) => {
    let top = Infinity;
    let before = null;
    for (const p of upper) {
      const px = x(p.n);
      if (px < a - 6) before = p;
      else if (px <= b + 6) top = Math.min(top, y(p.cost));
    }
    if (before) top = Math.min(top, y(before.cost));
    return top - 5;
  };

  const launchText = `Launch ${target.launch.toLocaleString('en-US')}`;
  const lw = launchText.length * 7;
  // Centred over the marker when it fits, else beside the leader on whichever side has room.
  const candidates = [
    { anchor: 'middle', l: mx - lw / 2, r: mx + lw / 2 },
    { anchor: 'start', l: mx + 6, r: mx + 6 + lw },
    { anchor: 'end', l: mx - 6 - lw, r: mx - 6 },
  ].filter((c) => c.l >= plotLeft + 4 && c.r <= plotRight - 4);
  let launch = null;
  for (const c of candidates) {
    const baseline = ceiling(c.l, c.r) - 6 - LABEL_DESCENT;
    if (baseline - LABEL_ASCENT >= minTop && baseline < ty - 12) {
      launch = { ...c, baseline, x: c.anchor === 'middle' ? mx : c.anchor === 'start' ? c.l : c.r };
      break;
    }
  }
  if (!launch) return null;

  const targetText = `Target ${formatCostPerKg(target.perKg)}`;
  const tw = targetText.length * 7;
  const tr = plotRight - 6;
  const tl = tr - tw;
  if (tl < plotLeft + 4) return null;
  // Above the launch label (and its leader) if the two share any columns, else above the curve.
  const shares = tl - 6 < Math.max(launch.r, mx) && tr + 6 > Math.min(launch.l, mx);
  const launchTop = launch.baseline - LABEL_ASCENT;
  const baseline = Math.min(ceiling(tl, tr) - 6 - LABEL_DESCENT, shares ? launchTop - 6 - LABEL_DESCENT : Infinity);
  if (baseline - LABEL_ASCENT < minTop) return null;
  // The target leader drops to the line from one end of the label, clear of the launch label
  // and its leader.
  const clear = (lx) => Math.abs(lx - mx) >= 10 && (lx < launch.l - 6 || lx > launch.r + 6);
  const leaderX = [tr - 4, tl + 4].find(clear);
  if (leaderX === undefined) return null;
  return { launch: { ...launch, text: launchText }, target: { x: tr, baseline, text: targetText, leaderX } };
}

function drawLifted(group, { launch, target: t }, mx, ty) {
  group.append(el('line', { x1: t.leaderX, x2: t.leaderX, y1: t.baseline + LABEL_DESCENT + 2, y2: ty, class: 'target-guide target-leader' }));
  group.append(el('text', { x: t.x, y: t.baseline, 'text-anchor': 'end', class: 'target-label' }, t.text));
  // The launch leader continues the guide up from the marker to the launch label.
  const leaderTop = launch.anchor === 'middle' ? launch.baseline + LABEL_DESCENT + 2 : launch.baseline - 4;
  group.append(el('line', { x1: mx, x2: mx, y1: leaderTop, y2: ty, class: 'target-guide target-leader' }));
  group.append(el('text', { x: launch.x, y: launch.baseline, 'text-anchor': launch.anchor, class: 'target-label' }, launch.text));
}
