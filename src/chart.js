// Renders a learning curve into an <svg> element as plain SVG markup.

import { linearScale, logScale, niceTicks, logTicks } from './scale.js';
import { formatCost } from './format.js';

// The viewBox matches the rendered width so text stays at its CSS size on any screen.
const MIN_WIDTH = 280;
const NARROW_WIDTH = 520;
const MARGIN = { top: 20, right: 24, bottom: 56, left: 72 };
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
export function renderChart(svg, series, { logScale: useLog = false } = {}) {
  const maxLaunches = series[series.length - 1].n;
  const costs = series.map((p) => p.cost);
  let minCost = Math.min(...costs);
  let maxCost = Math.max(...costs);

  const width = Math.max(MIN_WIDTH, Math.round(svg.clientWidth || 720));
  const height = Math.round(Math.min(Math.max(width * 0.6, 300), 440));
  const narrow = width < NARROW_WIDTH;

  const plotLeft = MARGIN.left;
  const plotRight = width - MARGIN.right;
  const plotTop = MARGIN.top;
  const plotBottom = height - MARGIN.bottom;

  let x, y, xTicks, yTicks;
  if (useLog) {
    // A flat curve (learning rate 0) has no vertical extent; pad it so the scale works.
    if (minCost === maxCost) [minCost, maxCost] = [minCost / 2, maxCost * 2];
    x = logScale([1, maxLaunches], [plotLeft, plotRight]);
    y = logScale([minCost, maxCost], [plotBottom, plotTop]);
    // On narrow screens, label only powers of ten so x labels don't collide.
    xTicks = logTicks(1, maxLaunches).filter((t) => !narrow || Number.isInteger(Math.log10(t)));
    yTicks = logTicks(minCost, maxCost);
  } else {
    x = linearScale([0, maxLaunches], [plotLeft, plotRight]);
    y = linearScale([0, maxCost], [plotBottom, plotTop]);
    xTicks = niceTicks(0, maxLaunches, narrow ? 4 : 5);
    yTicks = niceTicks(0, maxCost);
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

  axes.append(el('line', { x1: plotLeft, x2: plotRight, y1: plotBottom, y2: plotBottom, class: 'axis-line' }));
  axes.append(el('line', { x1: plotLeft, x2: plotLeft, y1: plotTop, y2: plotBottom, class: 'axis-line' }));
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

  const d = series.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.n).toFixed(2)},${y(p.cost).toFixed(2)}`).join('');
  const curve = el('path', { d, class: 'curve' });

  // Mark each doubling (1, 2, 4, 8, ...) so the constant per-doubling drop is visible.
  const doublings = el('g', { class: 'doubling' });
  for (const p of series) {
    if (!isPowerOfTwo(p.n)) continue;
    const dot = el('circle', { cx: x(p.n), cy: y(p.cost), r: 4 });
    dot.append(el('title', {}, `Launch ${p.n.toLocaleString('en-US')}: ${formatCost(p.cost)}`));
    doublings.append(dot);
  }

  svg.append(grid, axes, curve, doublings);
}
