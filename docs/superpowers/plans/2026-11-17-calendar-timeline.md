# Calendar Timeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional calendar timeline (cadence scenarios, a top calendar-year axis and a milestone-date panel) that turns cumulative launch counts into modeled dates without changing the learning-curve math.

**Architecture:** A new pure module `src/cadence.js` holds all cadence math and milestone logic. `src/chart.js` gains an optional `calendar` option and only draws the ticks it is given. `index.html`, `src/main.js`, `styles.css` and `README.md` wire the controls and panel. The three pieces are built concurrently in separate git worktrees against the interface pinned in **Section 0**.

**Tech Stack:** Vanilla ES modules in the browser, `node --test` + `node:assert/strict`, no dependencies.

**Spec:** `docs/superpowers/specs/2026-11-16-calendar-timeline-design.md` (approved). Every agent reads the spec and this plan.

## Global Constraints

- `src/model.js`, `src/montecarlo.js`, `src/scale.js` and `src/format.js` are **not modified**.
- With the calendar off, the page and chart render exactly as they do today (`MARGIN.top` = 20, same aria-label).
- Presets: Conservative 36 / 15%, **Base 56 / 30% (default)**, Aggressive 78 / 50%. Custom: first-year launches a whole number from 1 to 1,000, growth 0–100% (step 0.1).
- Start year is an integer from 2027 to 2040 (default 2027). Launch 1 = Jan 1 of the start year.
- Never use the words "forecast" or "prediction" for dates, except in "not forecasts". Dates are "modeled dates".
- Date labels: "early / mid / late YYYY" (fraction < 1/3, < 2/3, otherwise), and "after 2100" when the fractional year is ≥ 2101.0.
- Dates use the single (expected) learning rate, even when Monte Carlo is on.
- No new npm dependencies. Tests run with `npm test`.

## Section 0: Pinned interface (all agents code against this)

`src/cadence.js` (owned by Agent A). Agents B and C must not create or edit this file. They import only these names.

```js
// Cadence = { firstYear: number /* R, launches in start year */, growth: number /* g as a fraction, 0.30 = 30% */ }

export const CADENCE_PRESETS;   // frozen: { conservative: {firstYear:36,growth:0.15}, base: {firstYear:56,growth:0.30}, aggressive: {firstYear:78,growth:0.50} }
export const SCENARIO_LABELS;   // frozen: { conservative:'Conservative', base:'Base', aggressive:'Aggressive', custom:'Custom' }
export const CADENCE_DEFAULTS;  // frozen: { enabled:false, startYear:2027, scenario:'base' }
export const CADENCE_LIMITS;    // frozen: { startYearMin:2027, startYearMax:2040, firstYearMin:1, firstYearMax:1000, growthMax:1 }
export const LADDER_PER_KG;     // frozen: [500, 200, 100, 50]
export const DATE_CUTOFF_YEAR;  // 2101: fractional years >= this print "after 2100"

export function launchTime(n, cadence): number          // t(n), years since Jan 1 of start year. RangeError if n < 1 or cadence invalid.
export function launchesByTime(t, cadence): number      // N(t), continuous. RangeError if t < 0 or cadence invalid.
export function yearTicks(maxLaunches, cadence, startYear): Array<{ year: number, launch: number }>
  // One per Jan 1 with launch = N(year - startYear) + 1 <= maxLaunches, ascending, first is { year: startYear, launch: 1 }.
export function modeledDateLabel(fractionalYear): string // "early 2027" | "mid 2028" | "late 2032" | "after 2100"
export function milestoneRows({ c1, lr, cadence, startYear, maxLaunches, targetPerKg /* number | null when target overlay off */ }):
  Array<{ perKg: number, isTarget: boolean, status: 'reached'|'unreachable'|'beyond-limit',
          launch: number|null, date: string|null, beyondRange: boolean }>
  // Sorted by perKg, highest first. A target equal to a ladder value becomes that single row, with isTarget = true.
  // launch comes from findTargetLaunch(c1, lr, targetLaunchCost(perKg)). date = modeledDateLabel(startYear + launchTime(launch)).
  // beyondRange = launch > maxLaunches. For non-reached rows, launch and date are null and beyondRange is false.
```

`src/chart.js` addition (owned by Agent B):

```js
renderChart(svg, series, { logScale, target, bands, calendar = null })
  // calendar: { label: string, ticks: Array<{ year, launch }> } | null. The caller builds the label and ticks.
export function thinYearLabels(ticks /* [{ year, px }] ascending px */, minGapPx): Array<{ year, px, label: string }>
  // label '' = tick mark only. Greedy from the left: keep a label when it is at least minGapPx from the last kept one.
  // The first kept label is the full year ('2027'). Later labels are short ("'28").
```

## File ownership (no file is touched by two agents)

| File | Agent A (cadence) | Agent B (axis) | Agent C (UI + docs) |
|---|---|---|---|
| `src/cadence.js`, `tests/cadence.test.js` | **create** | — | import only |
| `src/chart.js`, `tests/chart.test.js` | — | **modify / create** | call only |
| `index.html`, `src/main.js`, `styles.css`, `README.md` | — | — | **modify** |

Overlaps found and removed:
- **Chart aria-label** is set in `main.js` today, so Agent C owns the calendar wording, not the chart.
- **Axis CSS:** Agent B gives the new group `class="axis calendar-axis"` and relies on the existing `.axis` styles. Any extra styling for `.calendar-axis` is Agent C's job in `styles.css`.
- **Input limits** live in `CADENCE_LIMITS` (Agent A), so `main.js` and `index.html` (Agent C) can't drift from the model.
- **Axis label text** ("Modeled calendar year (Base)") is built by Agent C, so the chart does no scenario logic.

## Review Focus

1. **Default target equals a ladder value ($100/kg).** With the target overlay on at the defaults, the table must show one $100 row marked as the target, not two. *(Agent A, Task A2 test.)*
2. **Very slow Custom cadence (1 launch/year, 0% growth).** $50/kg falls at launch 4,859, about year 6,885, and must print "after 2100". The tick list holds only the start year, and nothing throws. *(Agent A, Task A2; Agent B, Task B1.)*
3. **Third boundaries under floating point.** `2027 + 1/3` must read "mid 2027", and `2100.999` must read "late 2100". *(Agent A, Task A1.)*
4. **Invalid Custom input while the calendar is on** (blank, 0, 1.5 launches, 101%). The page shows a message and keeps the dimmed chart, with no exception in the console. With the calendar off, the same bad values are ignored. *(Agent C, Task C1 checklist.)*
5. **Crowded ticks** at narrow width (< 520 px) in log–log mode with Aggressive cadence. No two labels overlap, and every year keeps its tick mark. *(Agent B, Task B1 test.)*

---

## Agent A: Cadence model + tests (worktree `calendar-cadence`)

### Task A1: Cadence math and date labels

**Files:** Create `src/cadence.js` and `tests/cadence.test.js`.

**Interfaces:** Produces every Section 0 constant, plus `launchTime`, `launchesByTime`, `yearTicks` and `modeledDateLabel`.

- [ ] **Step 1: Write the failing tests** in `tests/cadence.test.js` (same style as `tests/montecarlo.test.js`):
  - `launchTime(1, any) === 0` for all three presets and for `{firstYear:1, growth:0}`.
  - g = 0: `launchTime(11, {firstYear:10, growth:0}) === 1`, and `launchesByTime(2.5, {firstYear:10, growth:0}) === 25`.
  - Whole-year totals: for Base, `launchesByTime(k) - launchesByTime(k-1)` ≈ `56 * 1.3 ** (k-1)` for k = 1..5 (tolerance 1e-9). Also `launchesByTime(2, base) ≈ 128.8`.
  - Inverse: `launchesByTime(launchTime(n, c), c) ≈ n - 1` for n in [1, 2, 8, 96, 682, 4859, 1_000_000] and each preset.
  - Reference dates (`2027 + launchTime(n, preset)`, to 1e-4):

    | n | conservative | base | aggressive |
    |---|---|---|---|
    | 682 | 2036.6222 | 2032.8563 | 2031.1433 |
    | 1024 | 2038.8817 | 2034.1228 | 2031.9883 |

  - `yearTicks(1024, base, 2027)` returns years 2027–2034 with launches `[1, 57, 129.8, 224.44, 347.472, 507.414, 715.338, 985.639]` (to 1e-3). `yearTicks(1024, aggressive, 2027)` returns 5 ticks, the last being `{year: 2031, launch: 634.75}`. `yearTicks(10, {firstYear:1, growth:0}, 2030)` returns `[{year: 2030, launch: 1}]`.
  - Labels: `modeledDateLabel(2027)` is `'early 2027'`, `(2027 + 1/3)` is `'mid 2027'`, `(2027 + 2/3)` is `'late 2027'`, `(2032.8563)` is `'late 2032'`, `(2100.999)` is `'late 2100'`, and `(2101)` is `'after 2100'`.
  - RangeError for `launchTime(0, base)`, for `firstYear: 0`, and for `growth: -0.1`.
- [ ] **Step 2:** Run `node --test tests/cadence.test.js`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement the Section 0 constants and the four functions in `src/cadence.js` using the spec's closed forms, with `Math.log1p` / `Math.expm1` for accuracy at small g. `yearTicks` steps k = 0, 1, 2, … until `launchesByTime(k) + 1 > maxLaunches`. For third boundaries, compute `frac = y - Math.floor(y)` and add a 1e-9 epsilon before comparing to 1/3 and 2/3, so `2027 + 1/3` lands in "mid".
- [ ] **Step 4:** Run `npm test`. Expected: all tests pass, old and new.
- [ ] **Step 5:** Commit with `git add src/cadence.js tests/cadence.test.js && git commit -m "Add cadence model"`.

### Task A2: Milestone rows

**Files:** Modify `src/cadence.js` and `tests/cadence.test.js`.

**Interfaces:** Consumes `findTargetLaunch` and `targetLaunchCost` from `src/model.js` (unchanged). Produces `milestoneRows`.

- [ ] **Step 1: Write the failing tests** (defaults: `c1 = 100`, `lr = 0.217`, `startYear = 2027`, `maxLaunches = 1024`):
  - Base, `targetPerKg: null` gives rows `[{500, launch 8, 'early 2027'}, {200, 96, 'mid 2028'}, {100, 682, 'late 2032'}, {50, 4859, 'mid 2039', beyondRange: true}]`, all with `isTarget: false` and `status: 'reached'`.
  - `targetPerKg: 100` gives 4 rows, and the $100 row has `isTarget: true`.
  - `targetPerKg: 150` gives 5 rows, ordered `[500, 200, 150, 100, 50]`, with `isTarget` only on 150.
  - `targetPerKg: 2000` (at or above the $1,000/kg first-launch cost) gives the target row `{launch: 1, date: 'early 2027'}`.
  - `lr: 0` gives every row `{status: 'unreachable', launch: null, date: null, beyondRange: false}`.
  - `lr: 0.001` gives `status: 'beyond-limit'` for the $50 row.
  - Custom `{firstYear: 1, growth: 0}` gives the $50 row `date: 'after 2100'`.
- [ ] **Step 2:** Run `node --test tests/cadence.test.js`. Expected: FAIL (`milestoneRows` is not a function).
- [ ] **Step 3:** Implement `milestoneRows` following the Section 0 contract.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit with `git commit -am "Add calendar milestone rows"`.

---

## Agent B: Calendar chart axis (worktree `calendar-axis`)

### Task B1: Optional top calendar axis

**Files:** Modify `src/chart.js`. Create `tests/chart.test.js`. (`chart.js` only touches `document` inside functions, so importing it in Node is safe.)

**Interfaces:** Consumes the tick shape `{ year, launch }` from Section 0. Agent B does not import `cadence.js`; use literal tick arrays in tests. Produces the `calendar` option and `thinYearLabels`.

- [ ] **Step 1: Write the failing tests** for `thinYearLabels` in `tests/chart.test.js`:
  - `[{2027, px: 0}, {2028, px: 100}, {2029, px: 200}]` with gap 40 gives labels `['2027', "'28", "'29"]`.
  - `[{2027, 0}, {2028, 20}, {2029, 45}, {2030, 60}]` with gap 40 gives `['2027', '', "'29", '']`, and all 4 entries are returned.
  - A single tick gives `['2027']`. An empty input gives `[]`.
  - Every pair of non-empty labels in the output is at least `minGapPx` apart (checked on a dense 8-tick input).
- [ ] **Step 2:** Run `node --test tests/chart.test.js`. Expected: FAIL (not exported).
- [ ] **Step 3:** Implement `thinYearLabels`, then extend `renderChart`:
  - Add the `calendar = null` option.
  - Use `const top = calendar ? 52 : MARGIN.top` for `plotTop`, and leave `MARGIN` itself unchanged.
  - When `calendar` is set, append `<g class="axis calendar-axis">` containing an axis line at `plotTop`, a 6 px tick mark per tick at `x(launch)`, labels from `thinYearLabels` (`minGapPx` 36, or 30 when `narrow`), and the centered title `calendar.label` above the labels.
  - Use the existing `x` scale for both linear and log modes.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5: Manual check.** In `src/main.js`, temporarily pass `calendar: { label: 'Modeled calendar year (Base)', ticks: [{year:2027,launch:1},{year:2028,launch:57},{year:2029,launch:129.8},{year:2030,launch:224.44},{year:2031,launch:347.472},{year:2032,launch:507.414},{year:2033,launch:715.338},{year:2034,launch:985.639}] }`. Run `npx serve .` and check linear mode, log mode, and width < 520 px. **Revert the `main.js` change before committing.** `git diff src/main.js` must be empty.
- [ ] **Step 6:** Commit with `git add src/chart.js tests/chart.test.js && git commit -m "Add optional calendar axis to chart"`.

---

## Agent C: Controls, milestone panel, README (worktree `calendar-ui`)

`src/cadence.js` doesn't exist in this worktree, so code against Section 0 and don't create a stub. Browser verification happens at integration (Task I1). Before committing, check syntax with `node --check src/main.js`.

### Task C1: Controls, state, validation and panel

**Files:** Modify `index.html`, `src/main.js` and `styles.css`.

**Interfaces:** Consumes all Section 0 names from `./cadence.js`, plus `renderChart(..., { calendar })`.

- [ ] **Step 1: `index.html`.** Below the Monte Carlo field, add:
  - A `show-calendar` checkbox with `aria-controls="calendar-field calendar-panel"`.
  - A hidden `calendar-field` containing `start-year` (number, 2027–2040, step 1), `cadence-scenario` (select: conservative / base / aggressive / custom), `first-year-launches` (number, 1–1000, step 1) and `annual-growth` (number, 0–100, step 0.1).
  - Two separately labeled notes: `cadence-note-2027` ("2027 assumption: …", with a `<span id="cadence-delay">` for "delayed to {year}") and `cadence-note-growth` ("2028 onward: illustrative, uncapped").
  - After `target-panel`, add `<section class="target-panel" id="calendar-panel" aria-labelledby="calendar-heading" hidden>` with a table (`$/kg`, `Launch`, `Modeled date`, `tbody id="calendar-rows"`) and notes 1, 4 and 5 from the spec. Note 5 is `id="calendar-mc-note"` and is shown only when Monte Carlo is on.
- [ ] **Step 2: `src/main.js`.**
  - Selecting a preset fills both numbers from `CADENCE_PRESETS`.
  - Any `input` on the two numbers sets the select to `custom`, keeping the shown values.
  - `readInputs` validates the calendar fields only while `show-calendar` is checked, using `CADENCE_LIMITS`. First-year launches must be `Number.isInteger`. Growth % is divided by 100.
  - In `update()`, when the calendar is on, pass `calendar: { label: \`Modeled calendar year (${SCENARIO_LABELS[scenario]})\`, ticks: yearTicks(maxLaunches, cadence, startYear) }` and render `milestoneRows({ c1: startingCost, lr: learningRate, cadence, startYear, maxLaunches, targetPerKg: targetOn ? targetPerKg : null })` into `calendar-rows`:
    - `isTarget` rows read "Target ($X/kg)".
    - `beyondRange` rows add the status "beyond displayed range".
    - Non-reached rows read "not reached".
    - Append " Calendar-year axis along the top ({scenario}, from {startYear})." to the chart aria-label.
  - `setDefaults()` resets the checkbox to off, the start year to 2027 and the scenario to Base, and fills the numbers from the Base preset.
- [ ] **Step 3: `styles.css`.** Style the table and notes like the existing target panel, and make the two cadence notes visually distinct (for example a bold lead label on each). Optionally add a `.calendar-axis` rule.
- [ ] **Step 4:** Run `node --check src/main.js && npm test`. Expected: no syntax error, and existing tests pass.
- [ ] **Step 5:** Commit with `git commit -am "Add calendar timeline controls and milestone panel"`.

### Task C2: README

**Files:** Modify `README.md`.

- [ ] **Step 1:** Add a "Calendar timeline" section after "Uncertainty (Monte Carlo)":
  - The cadence formula.
  - The scenario table.
  - The base-case milestone table from the spec.
  - The modeled-not-forecast wording, the 2027 attribution worded as in the spec with the two source links, the uncapped growth, and the launch-1 assumption.
  - A status-case table in the style of the target section.
- [ ] **Step 2:** Add Controls table rows: Show calendar timeline (on/off, off), Start year (2027–2040, 2027), Cadence scenario (Base), First-year launches (1–1,000, 56), Annual growth (0–100%, 30%). Add `src/cadence.js` to the Project layout.
- [ ] **Step 3:** Commit with `git commit -am "Document calendar timeline"`.

---

## Integration (coordinator, after A, B and C finish)

### Task I1: Merge and verify in the browser

- [ ] **Step 1:** On `feature/calendar-timeline`, merge `calendar-cadence`, then `calendar-axis`, then `calendar-ui`. Expect no conflicts, because the file sets don't intersect.
- [ ] **Step 2:** Run `npm test`. Expected: all pass.
- [ ] **Step 3:** Run `npx serve .` and check:
  - Calendar off: the page is identical to `main`.
  - Calendar on, Base, target on: one $100 Target row, and the table matches the spec's 8 / 96 / 682 / 4,859 rows.
  - Editing a number switches the scenario to Custom.
  - Start year 2030 shows "delayed to 2030".
  - Custom 1 / 0% shows "after 2100".
  - Invalid inputs dim the chart and show a message.
  - Reset restores everything.
  - The axis works in log mode and at narrow width.
  - Monte Carlo on shows note 5.
- [ ] **Step 4:** Use superpowers:requesting-code-review on the whole branch, then superpowers:finishing-a-development-branch.
