// Display formatting shared by the chart and the readouts. Pure functions: no DOM.

const twoDecimals = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const threeSignificant = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3 });

// Cost in $M, e.g. 8.6623 -> "$8.66M". Values below $1M keep 3 significant digits
// so tiny modeled costs (e.g. 0.000488) never display as "$0M".
export function formatCost(millions) {
  const formatter = Math.abs(millions) >= 1 ? twoDecimals : threeSignificant;
  return `$${formatter.format(millions)}M`;
}

// Fraction as a percentage with one decimal, e.g. 0.783 -> "78.3%". Adds decimals
// when rounding would show "100.0%" for a value that is not actually 100%.
export function formatPercent(fraction) {
  const percent = fraction * 100;
  let digits = 1;
  while (percent < 100 && Number(percent.toFixed(digits)) >= 100 && digits < 6) {
    digits++;
  }
  return `${percent.toFixed(digits)}%`;
}
