# Launch Learning Curve Simulator

An interactive, browser-only page that shows how a learning rate drives down launch costs as cumulative launches grow. Change the inputs and the curve redraws right away.

See [`intent.md`](intent.md) for the project goals and scope.

## The model (Wright's Law)

```
b       = log₂(1 − learning rate)
cost(n) = C₁ × nᵇ
```

- `C₁` is the cost of the first launch. `n` is the cumulative launch number.
- Each time `n` doubles, cost is multiplied by the **progress ratio** `1 − learning rate`.
- The default learning rate is **21.7%**: progress ratio 78.3%, `b ≈ −0.3529`.
- The default view shows **1,024 launches**, which is ten doublings from launch 1. At a $100M starting cost, launch 1,024 costs about $8.66M.
- On log–log axes the curve is a straight line with slope `b`.

The $100M default starting cost is an illustrative round number, not real vehicle data.

## Cost per kilogram (100,000 kg payload assumption)

The chart's right axis and the highlighted readout show the same modeled cost as dollars per kilogram, using a fixed, **illustrative Starship payload assumption of 100 metric tonnes (100,000 kg) per launch**. It is not an input and not real vehicle data.

```
cost per kg ($) = launch cost ($M) × 1,000,000 ÷ 100,000 kg
                = launch cost ($M) × 10
```

- A $100M launch is **$1,000/kg**. At the defaults, launch 1,024 is about **$86.62/kg**.
- Because the conversion is a constant multiple, it doesn't change the curve's shape: the right axis lines up exactly with the left axis in both linear and log–log modes, and each doubling still cuts cost per kg by the learning rate.
- Hovering a doubling dot shows both values, e.g. `Launch 4: $61.31M · $613.09/kg`.

## Target cost and modeled learning subsidy

This overlay is optional and off by default, to keep the chart uncluttered. Tick **Show target cost and modeled learning subsidy**, then enter a **target cost in $/kg** (default **$100/kg**). The chart draws it as a dashed horizontal line, using the same fixed 100,000 kg payload assumption:

```
target launch cost ($M) = target $/kg × 100,000 kg ÷ 1,000,000
                        = target $/kg ÷ 10
```

- **Target first achieved:** the first whole-number cumulative launch whose modeled cost is less than or equal to the target launch cost. A marker and a vertical guide show it on the chart. At the defaults ($100/kg = $10M per launch) that is **launch 682**.
- **Launches required from launch 1:** the number of launches from launch 1 through that launch, inclusive.
- **Modeled learning subsidy:** the discrete sum over every launch before the target launch:

  ```
  subsidy ($M) = Σ max(cost(n) − target launch cost, 0)   for n = 1 … target launch − 1
  ```

  At the defaults this is about **$3,620.75M**. It assumes someone funds the difference between the modeled launch cost and the target launch cost for each launch until the target is reached. **It is not an estimate of an economically optimal subsidy.** The shaded area between the curve and the target line shows this gap through the target launch.

The cost axis stretches to keep the target line on the chart, but the launch axis always keeps your selected range. Special cases:

| Situation | Result |
|---|---|
| Target launch is past the displayed range | Still calculated and reported as *Target reached beyond displayed range*; shading runs to the right edge |
| Target at or above the starting cost | Target launch 1, subsidy $0 |
| Learning rate 0% and target below the starting cost | *Unreachable*; no subsidy is reported |
| Target needs more than 1,000,000 launches | *Not reached*; the search and the subsidy sum stop at 1,000,000 launches (small learning rates can need astronomically many launches) |

## Uncertainty (Monte Carlo)

Also optional and off by default. With it off, the page is exactly the deterministic model above. Tick **Show uncertainty (Monte Carlo)** and set the **learning-rate uncertainty in percentage points** (1 standard deviation, default **±5.0**). The learning-rate control becomes the expected learning rate, so at the defaults the approximate 1σ range is **16.7%–26.7%**, not 21.7% ± 5% of 21.7%.

- **10,000 simulations**, with a fixed random seed so the results are reproducible.
- Each simulation draws **one learning rate** and uses it for the whole curve.
- The learning rate is **normally distributed** around the mean, **truncated to 0% ≤ LR < 100%**: out-of-range draws are redrawn, never clamped. **This version excludes negative learning rates** (costs rising with experience). Near 0% the truncation pulls the effective mean slightly upward.
- The chart shows the **median** curve, a **25th–75th percentile** band and a **5th–95th percentile** band. The target gap shading is hidden in this mode to keep the bands readable.
- With the target overlay on, the panel shows the **probability of reaching the target within the displayed cumulative launches**: the share of simulations whose cost at the last displayed launch is at or below the target. It is shown to the nearest whole percent, and as "<1%" or ">99%" at the extremes (10,000 runs carry up to about ±0.5 points of sampling error).

**Probabilities are conditional on the assumed probability model.** They describe what follows from the assumed distribution, not a forecast of real launch costs. All other readouts (cost of the last launch, target launch, subsidy) still use the single learning rate.

How it is computed: cost falls as the learning rate rises at every launch, so the p-th percentile cost at every launch is the cost at the (1 − p) learning-rate rank. The page sorts the 10,000 draws once and draws each band from one learning rate (nearest-rank percentiles). A unit test checks that this matches a brute-force per-launch percentile over every simulation. Because the distribution is symmetric, the median curve closely tracks the single-learning-rate curve.

## Calendar timeline

Also optional and off by default. With it off, the page is exactly as described above. Tick **Show calendar timeline** to turn cumulative launch counts into **modeled dates**, using a separate launch-cadence model. Cumulative launches still drive the learning curve; cadence only decides when those launches happen, so the cost math and every other readout are unchanged.

**These are modeled dates, not forecasts.** Each date follows from the selected learning rate *and* the selected cadence scenario.

### Cadence model

The inputs are **first-year launches** `R` (launches in the start year) and **annual growth** `g` (each year's total is the previous year's × (1 + g)). The ramp is a smooth exponential, scaled so whole-year totals match the year-by-year series exactly. Time `t` is in years since **January 1 of the start year**.

```
cumulative launches by time t:
  N(t) = R × ((1 + g)ᵗ − 1) ÷ g          for g > 0
  N(t) = R × t                           for g = 0

launch n happens when N(t) = n − 1:
  t(n) = ln(1 + (n − 1) × g ÷ R) ÷ ln(1 + g)     for g > 0
  t(n) = (n − 1) ÷ R                              for g = 0

modeled date (fractional year) = start year + t(n)
```

For example, with R = 56 and g = 30%, 56 launches happen in the first year and 128.8 by the end of the second.

### Scenarios

| Scenario | First-year launches | Growth from year 2 | Basis |
|---|---|---|---|
| Conservative | 36 | 15% | Well under SpaceX's 2027 targets; modeled growth |
| **Base** (default) | 56 | 30% | Between Conservative and the stated targets; modeled growth |
| Aggressive | 78 | 50% | SpaceX's stated 2027 targets taken at face value (≈26 in H1 at weekly + ≈52 in H2 at twice weekly); modeled growth |
| Custom | 1–1,000 (whole number) | 0–100% | Your own assumption |

Picking a preset fills in both numbers. Editing either number switches the scenario to Custom, starting from the numbers shown.

- **2027 assumption:** the first-year rates are anchored to SpaceX's stated 2027 Starship cadence targets from its Q3 2026 earnings call (Oct 20, 2026): roughly weekly in H1 2027, two or more a week by late 2027. Those are targets, not commitments. Sources: [NewSpace Economy](https://newspaceeconomy.ca/2026/10/21/spacex-targets-weekly-starship-launches-in-2027-and-early-orbital-refueling-tests/), [TokenPost](https://www.tokenpost.com/news/technology/36657).
- **After the first year:** the growth rates are our own illustrative modeling assumptions, and growth is **uncapped**.
- **Start year** (2027–2040) shifts the whole program: the first-year numbers apply to the chosen year, and the note says the rates are anchored to the 2027 targets, *delayed to* that year.
- **Launch 1** is assumed to happen on January 1 of the start year. Test flights before then aren't counted.

### Chart axis and milestone table

When the timeline is on, a **Modeled calendar year** axis runs along the top of the chart, with a tick at each January 1 inside the displayed launch range. Labels are thinned where ticks crowd together, and later years are shortened ('28). The bottom, left and right axes are unchanged.

The **Calendar timeline** panel lists modeled dates for **$500, $200, $100 and $50/kg**, plus your target when the target overlay is on (a target equal to one of those values is shown as one Target row). The launch is the target launch described above, and the date reads **early / mid / late YYYY** (thirds of the year). At the defaults with Base cadence:

| $/kg | Launch | Modeled date |
|---|---|---|
| $500 | 8 | early 2027 |
| $200 | 96 | mid 2028 |
| $100 | 682 | late 2032 |
| $50 | 4,859 | mid 2039 (beyond displayed range) |

Dates use the **single (expected) learning rate** and the deterministic cadence, even when Monte Carlo is on; the uncertainty bands are not reflected in them. Special cases:

| Situation | Result |
|---|---|
| Milestone met at launch 1 | Launch 1, early {start year} |
| Milestone launch is past the displayed range | Date still shown, marked *beyond displayed range* |
| Learning rate 0%, or the milestone needs more than 1,000,000 launches | *not reached* |
| Modeled date in 2101 or later | *after 2100* (only very slow Custom cadences get here) |

## Controls

| Control | Range | Default |
|---|---|---|
| Learning rate | 0–50% | 21.7% |
| Starting launch cost, C₁ | > 0 ($M) | 100 |
| Show target cost and modeled learning subsidy | on / off | off |
| Target cost (shown when the overlay is on) | > 0 ($/kg) | 100 |
| Show uncertainty (Monte Carlo) | on / off | off |
| Learning-rate uncertainty, 1σ (shown when uncertainty is on) | 0–20 percentage points | 5.0 |
| Show calendar timeline | on / off | off |
| Start year (shown when the timeline is on) | 2027–2040 | 2027 |
| Cadence scenario (shown when the timeline is on) | Conservative / Base / Aggressive / Custom | Base |
| First-year launches (shown when the timeline is on) | 1–1,000 (whole number) | 56 |
| Annual growth (shown when the timeline is on) | 0–100% | 30% |
| Cumulative launches shown | 10–2,048 | 1,024 |
| Log–log axes | on / off | off |

Dots on the curve mark each doubling (1, 2, 4, 8, …). Invalid input shows a message and leaves the last valid chart in place, dimmed until the input is fixed.

## Run locally

ES modules don't load from `file://` URLs, so serve the folder:

```sh
python3 -m http.server
```

Then open <http://localhost:8000>.

## Tests

Unit tests use Node's built-in test runner (Node 18+). There is nothing to install.

```sh
npm test
```

## Project layout

```
index.html          Page markup
styles.css          Layout and light/dark theme
src/model.js        Wright's Law math, $/kg conversion, target launch and subsidy (pure, no DOM)
src/scale.js        Axis scales and tick helpers (pure, no DOM)
src/montecarlo.js   Seeded learning-rate draws, percentile curves and target probability (pure, no DOM)
src/cadence.js      Launch cadence, calendar-year ticks and milestone dates (pure, no DOM)
src/format.js       Cost, $/kg, percentage and probability formatting (pure, no DOM)
src/chart.js        Draws the chart as inline SVG
src/main.js         Connects the controls to the model and chart
tests/              Unit tests for model.js, montecarlo.js, cadence.js, scale.js, format.js and chart.js
```

There are no runtime dependencies and no build step.
