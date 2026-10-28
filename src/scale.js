// Scale and tick helpers for the chart. Pure functions: no DOM.
//
// A scale maps a data value in [d0, d1] to a pixel position in [r0, r1].

export function linearScale([d0, d1], [r0, r1]) {
  const span = d1 - d0;
  return (v) => (span === 0 ? (r0 + r1) / 2 : r0 + ((v - d0) / span) * (r1 - r0));
}

export function logScale([d0, d1], range) {
  if (!(d0 > 0 && d1 > 0)) {
    throw new RangeError(`Log scale domain must be positive, got [${d0}, ${d1}]`);
  }
  const toPixels = linearScale([Math.log10(d0), Math.log10(d1)], range);
  return (v) => toPixels(Math.log10(v));
}

// Round away floating-point noise such as 0.30000000000000004.
const clean = (v) => parseFloat(v.toPrecision(12));

// Pick the step of 1, 2 or 5 x 10^k closest to giving `count` intervals.
function niceStep(span, count) {
  const raw = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const fraction = raw / magnitude;
  const nice = fraction < 1.5 ? 1 : fraction < 3 ? 2 : fraction < 7 ? 5 : 10;
  return nice * magnitude;
}

// Ascending, evenly spaced "round" tick values inside [min, max].
export function niceTicks(min, max, count = 5) {
  if (!(max > min)) return [min];
  const step = niceStep(max - min, count);
  const ticks = [];
  const first = Math.ceil(min / step - 1e-9);
  const last = Math.floor(max / step + 1e-9);
  for (let i = first; i <= last; i++) {
    ticks.push(clean(i * step));
  }
  return ticks;
}

// Ticks at 1, 2 and 5 x 10^k inside [min, max]. Falls back to linear ticks
// when the domain is too narrow to hold at least two of them.
export function logTicks(min, max) {
  const ticks = [];
  for (let k = Math.floor(Math.log10(min)); k <= Math.ceil(Math.log10(max)); k++) {
    for (const m of [1, 2, 5]) {
      const v = clean(m * 10 ** k);
      if (v >= min && v <= max) ticks.push(v);
    }
  }
  return ticks.length >= 2 ? ticks : niceTicks(min, max);
}
