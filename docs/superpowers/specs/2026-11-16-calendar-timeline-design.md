# Calendar Timeline — Design

Date: 2026-11-16 · Branch: `feature/calendar-timeline` · Status: draft for approval

## Intent

The simulator answers "how cheap does launch get after *n* launches?" This feature adds an
optional, approximate answer to "roughly **when**?" It translates cumulative launch counts into
modeled calendar dates using a **separate launch-cadence model**.

- **Cumulative launches drive learning. Cadence only decides when those launches happen.** The
  Wright's Law model (`src/model.js`) stays unchanged.
- Every date is a **modeled date**. It follows from the selected learning-rate assumption *and*
  the selected cadence scenario, and is never presented as a forecast.
- The cadence scenarios are grounded in public information. The 2027 rates are anchored to
  SpaceX's stated 2027 Starship cadence targets from its Q3 2026 earnings call (Oct 20, 2026):
  roughly weekly in H1 2027, two or more a week by late 2027. Growth after the first year is our
  own illustrative modeling assumption, and the UI keeps those two kinds of assumption visibly
  separate.
- This is also a learning project. The work is split so three pieces can be built in parallel
  git worktrees (see *Work breakdown*).

## Goals

1. A **Show calendar timeline** checkbox, off by default. With it off, the page behaves exactly as
   it does today.
2. When it's on: a start year, a cadence scenario (Conservative / Base / Aggressive / Custom), a
   calendar-year axis along the top of the chart, and a table of modeled dates for cost
   milestones.
3. Clear wording that separates SpaceX-grounded 2027 assumptions from modeled growth, and says the
   dates are not forecasts.

## Non-goals (v1)

- Date ranges from Monte Carlo, and any cadence uncertainty. These are a later feature that should
  treat learning-rate and cadence uncertainty together.
- Counting launches flown before the start year (Starship's ~15 test flights).
- Cadence caps, a year-by-year cadence table, or half-year modeling of 2027.
- Milestone markers drawn on the curve (mockup option C). Revisit only if the table proves
  insufficient, and if so, mock it up with the target line and Monte Carlo bands visible.

## Anti-goals

- Anything that changes the learning-curve math or existing readouts.
- Dates that read as predictions: false precision, "forecast" wording, or SpaceX numbers presented
  as if they were our growth assumptions.

## Cadence model

Inputs: **first-year launches** `R` (launches in the start year) and **annual growth** `g` (each
year's total is the previous year's × (1 + g)). The ramp is smooth (continuous exponential),
scaled so that whole-year totals match the year-by-year geometric series exactly.

Time `t` is in years since **January 1 of the start year**.

```
cumulative launches by time t:
  N(t) = R · ((1 + g)^t − 1) / g        for g > 0
  N(t) = R · t                           for g = 0

launch n happens when N(t) = n − 1  (launch 1 is at t = 0, i.e. Jan 1 of the start year):
  t(n) = ln(1 + (n − 1) · g / R) / ln(1 + g)     for g > 0
  t(n) = (n − 1) / R                              for g = 0

modeled date (fractional year) = startYear + t(n)
```

Check: with R = 56, g = 30%, N(1) = 56, N(2) = 128.8 (56 + 72.8).

### Scenarios

| Scenario | First-year launches | Growth from year 2 | Basis |
|---|---|---|---|
| Conservative | 36 | 15% | Well under SpaceX's 2027 targets; modeled growth |
| **Base** (default) | 56 | 30% | Between Conservative and the stated targets; modeled growth |
| Aggressive | 78 | 50% | SpaceX's stated 2027 targets taken at face value (≈26 in H1 at weekly + ≈52 in H2 at twice weekly); modeled growth |
| Custom | user, 1–1,000 | user, 0–100% | User's own assumption |

- Picking a preset fills in both numbers. Editing either number switches the scenario to Custom.
- **Start year:** integer, 2027–2040, default 2027. Changing it shifts the whole program: the
  first-year numbers apply to the chosen year. The note then reads that the first-year rates are
  anchored to SpaceX's 2027 targets, *delayed to {year}*.
- Growth is uncapped. Say so in the note.

Reference values at the defaults (21.7% learning rate, $100M = $1,000/kg first launch):

| Milestone | Launch | Conservative | Base | Aggressive |
|---|---|---|---|---|
| $100/kg (default target) | 682 | ~mid 2036 | late 2032 | early 2031 |
| Launch 1,024 (default chart edge) | 1,024 | ~late 2038 | early 2034 | late 2031 |

(Computed with `t(n)` above. Tests should pin exact values, not these rounded labels.)

## Milestone table ("Calendar timeline" panel)

A new panel styled like the existing Target and Monte Carlo panels, shown only when the calendar
is on.

- **Rows:** a fixed ladder of **$500, $200, $100 and $50/kg**, plus a **Target** row with the
  user's target $/kg whenever the target overlay is on. Rows are sorted by $/kg, highest first.
  If the target equals a ladder value, show one row labeled as the target (*builder's call:
  de-duplicate*).
- **Columns:** $/kg · launch number · modeled date.
- **Launch number:** the first launch at or below that cost, from the existing
  `findTargetLaunch(c1, lr, targetLaunchCost(perKg))`. No new learning math.
- **Modeled date:** "early / mid / late YYYY" (thirds of the year: fraction < 1/3 early,
  < 2/3 mid, otherwise late).
- **Status cases:**
  - Met at launch 1 → "launch 1 · early {start year}" (the date of launch 1).
  - Launch beyond the displayed launch range → the date still shows, marked *beyond displayed
    range* (as the existing target readout does).
  - `unreachable` or `beyond-limit` → "not reached", matching existing wording.
  - Modeled date after 2100 → shown as "after 2100". *(Builder's call: only very slow Custom
    cadences get here; it avoids printing years like 1,002,027.)*
- Dates use the **single (expected) learning rate** and the deterministic cadence, even when Monte
  Carlo is on.

At the defaults with Base cadence, the table reads roughly:

```
$/kg   Launch   Modeled date
$500        8   early 2027
$200       96   mid 2028
$100      682   late 2032
 $50    4,859   mid 2039   (beyond displayed range)
```

### Notes shown in the panel (wording is the builder's, intent is fixed)

1. The dates are **modeled dates** that result from the selected learning rate and the cadence
   scenario. They are not forecasts.
2. **2027 assumption:** the first-year rates are anchored to SpaceX's stated 2027 Starship cadence
   targets (weekly in H1, two or more a week by late 2027; Oct 2026). Those are targets, not
   commitments. "Delayed to {year}" is added when the start year isn't 2027.
3. **2028 onward:** the growth rates are our illustrative modeling assumptions and are uncapped.
4. Launch 1 is assumed to happen at the start of {start year}. Test flights before then aren't
   counted.
5. When Monte Carlo is on: the dates use the expected learning rate, and the uncertainty bands are
   not reflected in them.

Notes 2 and 3 must be visually distinct, for example as two labeled lines next to the scenario
picker or in the panel.

## Chart: calendar axis (mockup option B)

- When the calendar is on, draw a **separate axis along the top** of the plot, labeled
  "Modeled calendar year ({scenario})". The bottom launch axis, the left cost axis and the right
  $/kg axis are unchanged.
- **Ticks:** one per January 1 that falls inside the displayed launch range. Year `Y` sits at
  launch position `n = N(Y − startYear) + 1` (continuous, not rounded). Include the start year's
  tick at launch 1.
- **Crowding:** ticks bunch up toward the right because cadence ramps (or toward one side in
  log–log mode). Thin the labels so none overlap. Short labels ('28) are allowed once a full year
  is shown. Keep the tick marks.
- Works in both linear and log–log modes, using the chart's existing x scale.
- `MARGIN.top` (currently 20) must grow when the axis is shown. When the calendar is off, the
  chart renders exactly as today.
- Update the SVG `aria-label` when the axis is shown.

## Controls

Added below the Monte Carlo controls, following the existing reveal pattern (`hidden` +
`aria-controls`):

- Checkbox: **Show calendar timeline** (off).
- Start year: number, 2027–2040, step 1.
- Cadence scenario: select (Conservative / Base / Aggressive / Custom), default Base.
- First-year launches: number, 1–1,000. Annual growth (%): number, 0–100. Both are always visible
  while the calendar is on, and filled in from the preset.

Invalid input follows the existing pattern: a message, with the last valid chart kept on screen
and dimmed. **Reset to defaults** also resets the calendar (off, 2027, Base).

## Approaches considered

1. **New pure `src/cadence.js` module + an optional chart axis + UI wiring — chosen.** It keeps
   `model.js` untouched, mirrors how `montecarlo.js` was added, is testable in Node, and splits
   into three parallel pieces.
2. Cadence math inside `model.js`: rejected. It mixes cadence into the learning model the user
   wants unchanged, and parallel branches would collide in one file.
3. Simulating a year-by-year launch table and looking dates up in it: rejected. It's less exact
   than the closed form, and slow-growth Custom settings near the 1,000,000-launch limit need huge
   tables.

## Work breakdown and interfaces (for parallel worktrees)

Pin these signatures first. The three pieces then build against them independently. *(Exact names
are the builder's call. The shapes are what matter.)*

**Piece 1 — `src/cadence.js` + `tests/cadence.test.js`** (pure, no DOM)

```js
export const CADENCE_PRESETS;   // { conservative: { firstYear: 36, growth: 0.15 }, base: {56, 0.30}, aggressive: {78, 0.50} }
export const CADENCE_DEFAULTS;  // { enabled: false, startYear: 2027, scenario: 'base' }
export const LADDER_PER_KG;     // [500, 200, 100, 50]
export function launchTime(n, { firstYear, growth });          // years since start, t(n)
export function launchesByTime(t, { firstYear, growth });      // N(t)
export function yearTicks(maxLaunches, cadence, startYear);    // [{ year, launch }] within 1..maxLaunches
export function modeledDateLabel(fractionalYear);              // "early 2027" | "after 2100"
export function milestoneRows({ c1, lr, cadence, startYear, maxLaunches, targetPerKg });
  // [{ perKg, isTarget, status, launch, date, beyondRange }]
```

Tests: g = 0 and g > 0 formulas; `launchTime(1) = 0`; that `launchTime` and `launchesByTime` are
inverses; whole-year totals equal R(1+g)^k; tick positions; the third boundaries for the
early/mid/late labels; after-2100; every row status; the reference values above.

**Piece 2 — `src/chart.js`**: a new optional `renderChart` option
`calendar: { label, ticks: [{ year, launch }] } | null`. The chart only draws ticks it is given;
it does no cadence math.

**Piece 3 — `index.html`, `src/main.js`, `styles.css`**: the controls, the preset ↔ Custom
behavior, validation, reset, the milestone panel and notes. It calls Piece 1 and passes `calendar`
to Piece 2.

**Last:** a README section ("Calendar timeline"), plus the Controls table rows.

## Calls made during the design review (not discussed with the user — check these)

- First-year launches must be a **whole number** (1–1,000). Growth may use decimals (step 0.1).
- Switching to **Custom** keeps the numbers that are currently shown (whichever preset was last
  selected) as the starting point.
- The "after 2100" cutoff applies when the modeled fractional year is **≥ 2101.0**, so anything
  during 2100 still prints as a normal label.
- The **Calendar timeline panel** sits after the Target panel in the chart section.
- The calendar inputs are validated **only while the checkbox is on**, as the target and Monte
  Carlo inputs already are.
- The UI notes and the README repeat the cadence attribution as written here and add no other
  claims. The README links the sources below.

## Sources

- SpaceX Q3 2026 earnings call cadence targets (Oct 20, 2026), as reported by
  [NewSpace Economy](https://newspaceeconomy.ca/2026/10/21/spacex-targets-weekly-starship-launches-in-2027-and-early-orbital-refueling-tests/)
  and [TokenPost](https://www.tokenpost.com/news/technology/36657).
- Flight 15 (Nov 13–14, 2026): ship caught from orbit, booster catch aborted.
  [Space.com](https://www.space.com/space-exploration/launches-spacecraft/spacex-says-starship-flight-15-booster-aborted-chopsticks-landing-catch-after-launch-due-to-guidance-issue-video),
  [The Next Web](https://thenextweb.com/news/spacex-starship-catch-upper-stage-flight-15).
  This is context for the Conservative and Base scenarios. It is not shown in the UI.

## Left to the builder

The exact signature names, how ticks are thinned, the wording of the notes, the panel's layout and
styling (consistent with the existing panels), and how the target row is de-duplicated.
