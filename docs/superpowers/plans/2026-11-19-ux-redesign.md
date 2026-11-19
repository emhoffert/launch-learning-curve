# UX Redesign (Add-Card Layout) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the page as the approved add-card layout: a dominant chart, a cost-per-kg headline with a milestone strip, and "When" and "How sure" cards that open one editor at a time. Desktop and mobile get their own layouts. The math is unchanged.

**Architecture:** One DOM serves every size, and CSS grid areas rearrange it at content-derived breakpoints (three columns, then two columns, then mobile). At desktop and intermediate sizes the page is a fixed-height workspace: panels scroll internally and the page does not. The new display logic (card text, the milestone strip, which editor is open) lives in a new pure module, `src/cards.js`, so `node --test` can test it. `src/main.js` keeps its `readInputs` → `update` → `show*` flow. It gains a small `ui.open` state and the card wiring. Every existing analytical function is reused unchanged.

**Tech Stack:** Vanilla ES modules, `node --test`, headless Chrome over CDP for browser checks. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-19-ux-redesign-design.md`

## Global Constraints

- **Analytical modules are frozen.** No changes to `src/model.js`, `src/montecarlo.js`, `src/cadence.js`, `src/scale.js`, `src/chart.js` or `src/format.js`. `git diff --exit-code de5fc9f -- <those files>` must stay empty.
- `npm test` stays green. Today's 88 tests must all still pass, unedited.
- **Section titles:** "How does cost fall?", "When could we reach a cost?", "How sure is this?". **Add-card copy:** "+ When?" with "Pick a target cost and see roughly when it's reached"; "+ How sure?" with "See the chance of hitting it if learning is uncertain".
- **Required visible wording in the When editor:**
  - "Modeled dates, not forecasts."
  - "Anchored to SpaceX's stated targets" for the first year;
  - "Our illustrative growth, uncapped" for the following years.
- **Methodology notes are kept verbatim inside disclosures:** the subsidy note, the Monte Carlo note, the calendar note and the two cadence notes.
- **The headline milestone strip uses `DEFAULTS.targetPerKg` ($100/kg) when When is off, and the current target when When is on.**
- **The subsidy is level 2 only.** It appears in "More analysis" and never on a card, in the headline, or at level 1.
- **At most one editor is open at a time.**
- **Calendar dates are on by default** the first time When is turned on. This is a UI default set in `main.js`; `CADENCE_DEFAULTS` is not edited.
- Dark mode is kept: extend the existing `prefers-color-scheme` block for every new colour.
- **Desktop workspace (no page scroll):** at the three-column and two-column layouts, when the viewport is at least 700 px tall:
  - The page itself does not scroll. The chart, core controls, headline, add cards and the open analysis all fit in the viewport.
  - Overflow scrolls inside a panel: "Go deeper" first, then core inputs.
  - Fit is reached through disclosure and internal scrolling, never by shrinking anything. The floors are: body text ≥ 14 px; inputs and buttons ≥ 36 px tall (≥ 44 px on touch layouts); chart plot ≥ 480 px wide and ≥ 340 px tall.
- **Breakpoints come from content minimums, not a fixed number.**
  - **Three columns** (core 272 px | chart | Go deeper 344 px): only when the chart column can be at least 560 px wide. That is about 272 + 344 + 560 + gaps and padding ≈ 1240 px, set in `rem` (≈ 77.5rem).
  - **Two columns** (an intermediate layout): the chart with its headline on the left, and on the right a 320 px rail holding core inputs above the cards and the open editor. The rail scrolls internally. It applies while the chart can stay at least 480 px wide, down to about 860 px (≈ 53.75rem).
  - **Mobile, single column:** below that. Normal page scroll, touch targets at least 44 px.
  - The builder confirms the values with screenshots at 1440, 1280, 1100, 900 and 820 px wide, may adjust them, and records the final values in a comment in `styles.css`.
- **Accessibility:**
  - Every control is reachable in a logical Tab order, and has an accessible name and a visible `:focus-visible` outline (≥ 2 px, ≥ 3:1 contrast).
  - `aria-expanded` always matches visibility.
  - Activating an **add** card moves focus to its editor's heading (`tabindex="-1"`). Toggling an already-active card leaves focus on the card. When an editor closes because its switch was turned off, focus returns to its card.

## Review Focus

1. **A target at or above the starting cost per kg** (e.g. $2,000/kg, met at launch 1). The card, the headline strip and More analysis should all show launch 1 and today's "Target met at launch 1" status, with no "by launch 0" or a negative subsidy. *Test: Task 2, `whenCard`/`milestoneStrip` launch-1 cases.*
2. **A 0% learning rate.** The card, the strip and the table should all show today's "unreachable / at a 0% learning rate, cost never falls" wording, and nothing should crash. *Test: Task 2 unreachable cases, plus check D4 in Task 6.*
3. **An invalid input inside a closed editor** (e.g. target −5, then close the editor). The card should show "Check input", the status message should stay visible, and the chart should dim as it does today. *Test: Task 2 `cardState`, plus check D5.*
4. **Dates off while the cadence inputs are invalid.** The invalid cadence must not block the page, because it is only validated when When and dates are both on. The date column and the calendar axis should be hidden, and the card's large value becomes "launch N". *Test: check D3.*
5. **Resizing across the breakpoints with an editor open**, and short laptop heights (1366×768). The same editor should stay open and all values should be preserved, and the page should still not scroll at 768 px tall. *Test: checks M4 and D9.*

---

## Reuse of existing analytical functions (no changes to any of them)

| Need | Existing function |
|---|---|
| Curve, final cost, headline $/kg, reduction | `generateCurve`, `costPerKg`, `formatCostPerKg`, `formatPercent` |
| Target launch for the card, strip and table | `targetLaunchCost`, `findTargetLaunch`, `MAX_TARGET_LAUNCH` |
| Subsidy (More analysis) | `learningSubsidy`, `formatCost` (inside today's `showTarget`) |
| Milestone table and the target date | `milestoneRows` (the target row's `.date`) |
| Calendar axis | `yearTicks`, `renderChart({calendar})` |
| Monte Carlo bands and probability | `simulateUncertainty`, `formatProbability` (inside today's `showUncertainty`) |
| Cadence presets and labels | `CADENCE_PRESETS`, `SCENARIO_LABELS`, `CADENCE_LIMITS` |

`showTarget`, `showUncertainty` and `showCalendar` (renamed to `showMilestones`) keep their computations. Only the elements they write into move.

---

### Task 1: Regression guard and baseline capture

**Files:**
- Create: `tests/regression.test.js`
- Create (scratchpad, not committed): `ux-baseline.mjs` and `baseline.json`, based on the existing scratchpad `browser-check.mjs` CDP harness

**Interfaces:** Consumes only the existing exports listed above.

- [ ] **Step 1: Write `tests/regression.test.js`.** It pins today's default outputs; these pass immediately as a guard, not a TDD failure.
```js
test('default headline numbers are unchanged', () => {
  const fin = generateCurve(100, 0.217, 1024).at(-1).cost;
  assert.equal(formatCostPerKg(costPerKg(fin)), '$86.62/kg');
  assert.equal(formatCostPerKg(costPerKg(100)), '$1,000/kg');
  assert.equal(formatPercent(1 - fin / 100), '91.3%');
  assert.equal(formatCost(fin), '$8.66M');
});
test('default target, subsidy and Monte Carlo are unchanged', () => {
  const t = targetLaunchCost(100);
  assert.deepEqual(findTargetLaunch(100, 0.217, t), { status: 'reached', launch: 682 });
  assert.equal(formatCost(learningSubsidy(100, 0.217, t, 682)), '$3,620.75M');
  const mc = simulateUncertainty({ startingCost: 100, mean: 0.217, sd: 0.05, maxLaunches: 1024, targetCost: t });
  assert.equal(mc.probability, 0.5908);
});
test('default milestone rows are unchanged', () => {
  const rows = milestoneRows({ c1: 100, lr: 0.217, cadence: CADENCE_PRESETS.base, startYear: 2027, maxLaunches: 1024, targetPerKg: 100 });
  assert.deepEqual(rows.map((r) => [r.perKg, r.launch, r.date, r.isTarget, r.beyondRange]), [
    [500, 8, 'early 2027', false, false], [200, 96, 'mid 2028', false, false],
    [100, 682, 'late 2032', true, false], [50, 4859, 'mid 2039', false, true]]);
});
```
- [ ] **Step 2:** Run `npm test`. Expected: 91 tests pass.
- [ ] **Step 3: Capture the baseline from the current UI, before any change.** Write `ux-baseline.mjs`, which serves the repo, loads it at 1200×1000, and for each state records the `textContent` of `#per-kg, #final-cost, #reduction, #progress-ratio, #exponent, #target-readout, #target-launch, #target-count, #subsidy, #mc-prob` and every `#calendar-rows tr`. The states:
  - **S1:** defaults with target, Monte Carlo and calendar all on.
  - **S2:** learning rate 30, target 200, 1σ 3, scenario aggressive, all on.
  - **S3:** learning rate 0, target 100, target and calendar on.
  - **S4:** target 2000, target on.
  It also records `document.documentElement.scrollHeight` at 390×844 with all three on, as `mobileHeightAllOn`. Save everything to `baseline.json`.
- [ ] **Step 4: Commit** `tests/regression.test.js`: "test: pin default analytical outputs before UX redesign".

### Task 2: Pure display helpers (`src/cards.js`)

**Files:** Create `src/cards.js` and `tests/cards.test.js`.

**Interfaces (produced):**
- `stripPerKg(whenOn: boolean, targetPerKg: number) → number`: `whenOn ? targetPerKg : DEFAULTS.targetPerKg`.
- `milestoneStrip({ c1, lr, maxLaunches, finalCost, perKg }) → string`: "From $1,000/kg at launch 1 · $100/kg by launch 682 · 91.3% lower by 1,024". Unreachable gives "$100/kg never reached at a 0% learning rate"; `beyond-limit` gives "$X/kg not reached within 1,000,000 launches".
- `whenCard({ result, perKg, date, datesOn }) → { label, value, sub }`. `result` is a `findTargetLaunch` result.
- `sureCard({ whenOn, probability, targetCost, startingCost, maxLaunches }) → { label, value, sub }`.
- `cadenceSummary(scenario, startYear) → string`, e.g. "Base cadence · from 2027".
- `toggleOpen(current: 'when'|'sure'|null, card: 'when'|'sure') → 'when'|'sure'|null`.
- `cardState({ active: boolean, error: boolean }) → 'add'|'active'|'error'`. `error` wins only while `active`.

- [ ] **Step 1: Write the failing tests** in `tests/cards.test.js`:
```js
test('strip uses $100/kg when When is off and the target when on', () => {
  assert.equal(stripPerKg(false, 200), 100);
  assert.equal(stripPerKg(true, 200), 200);
});
test('default strip text', () => {
  const finalCost = generateCurve(100, 0.217, 1024).at(-1).cost;
  assert.equal(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost, perKg: 100 }),
    'From $1,000/kg at launch 1 · $100/kg by launch 682 · 91.3% lower by 1,024');
  assert.match(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost, perKg: 200 }), /\$200\/kg by launch 96/);
});
test('strip at 0% learning rate and at launch 1', () => {
  assert.match(milestoneStrip({ c1: 100, lr: 0, maxLaunches: 1024, finalCost: 100, perKg: 100 }), /never reached at a 0% learning rate/);
  assert.match(milestoneStrip({ c1: 100, lr: 0.217, maxLaunches: 1024, finalCost: 8.66, perKg: 2000 }), /\$2,000\/kg by launch 1 /);
});
test('when card with and without dates', () => {
  const result = { status: 'reached', launch: 682 };
  assert.deepEqual(whenCard({ result, perKg: 100, date: 'late 2032', datesOn: true }),
    { label: 'When · $100/kg', value: 'late 2032', sub: 'launch 682' });
  assert.deepEqual(whenCard({ result, perKg: 100, date: null, datesOn: false }),
    { label: 'When · $100/kg', value: 'launch 682', sub: '' });
  assert.equal(whenCard({ result: { status: 'unreachable' }, perKg: 100, datesOn: true }).value, 'Unreachable');
  assert.equal(whenCard({ result: { status: 'beyond-limit' }, perKg: 0.001, datesOn: true }).value, 'Not reached');
});
test('sure card', () => {
  assert.deepEqual(sureCard({ whenOn: true, probability: 0.5908, targetCost: 10, startingCost: 100, maxLaunches: 1024 }),
    { label: 'How sure', value: '59%', sub: 'chance by launch 1,024' });
  assert.deepEqual(sureCard({ whenOn: false, probability: null, maxLaunches: 1024 }),
    { label: 'How sure', value: 'Bands on chart', sub: 'Add When? for a probability' });
  assert.equal(sureCard({ whenOn: true, probability: 1, targetCost: 200, startingCost: 100, maxLaunches: 1024 }).value, '100%');
});
test('cadence summary, open toggling, card state', () => {
  assert.equal(cadenceSummary('custom', 2029), 'Custom cadence · from 2029');
  assert.equal(toggleOpen(null, 'when'), 'when');
  assert.equal(toggleOpen('when', 'when'), null);
  assert.equal(toggleOpen('when', 'sure'), 'sure');
  assert.equal(cardState({ active: false, error: true }), 'add');
  assert.equal(cardState({ active: true, error: true }), 'error');
});
```
- [ ] **Step 2:** Run `node --test tests/cards.test.js`. Expected: it fails with a module-not-found error.
- [ ] **Step 3: Implement `src/cards.js`.** Import only from `model.js`, `cadence.js` and `format.js`. No DOM.
- [ ] **Step 4:** Run `npm test`. Expected: everything passes.
- [ ] **Step 5: Commit** "feat: add pure card and milestone-strip helpers".

### Task 3: Structural HTML (`index.html`)

**Files:** Modify `index.html`.

**Interfaces:** Every existing ID that `main.js` reads is kept, so the page still runs after this task. The exceptions are `log-scale`, `target-panel`, `mc-panel` and `calendar-panel`, which Task 5 replaces; leave those as hidden stubs until then. New IDs that Task 5 relies on:
- **Header:** `<details id="about">` (summary "About the model (Wright's Law)") wraps today's `.lede` verbatim.
- **`<section class="chart-panel">`** comes first in the DOM, for mobile order and reading order:
  - a header row with the title and a scale group: `#scale-linear` and `#scale-log` buttons with `aria-pressed`;
  - `svg#chart` and today's chart note, verbatim;
  - `.headline`, containing `#per-kg-label`, `#per-kg` and the new `#milestone-strip`;
  - `#message` (role=status), moved here so errors stay visible.
- **`<section class="core" id="core" data-collapsed="true" aria-label="How does cost fall?">`:**
  - the learning-rate field;
  - `#more-inputs-toggle` (aria-expanded, aria-controls=`more-inputs`), with the text "Starting cost, launches shown, reset" and a `#more-inputs-summary` span;
  - `#more-inputs` containing `#starting-cost`, `#max-launches`, `<details id="model-details">` (summary "Model details") with today's progress-ratio, exponent, final-cost and reduction `dl`, and `#reset`.
- **`<aside class="deeper" aria-label="Go deeper">`:**
  - `.cards` holding `#when-card` and `#sure-card`. These are `<button>`s with `aria-expanded`, `aria-controls`, `data-state="add"` and child spans `.card-k`, `.card-v`, `.card-sub`. The add-state copy comes from Global Constraints.
  - **`<section id="when-editor" hidden>`:**
    - an h2 and the `#show-target` switch labelled "On";
    - `#target-field` (always shown inside the editor);
    - a `dl` with `#target-readout`, `#target-launch` and a new `#target-date`;
    - `<table id="milestone-table">` holding `#calendar-rows`;
    - the `#show-calendar` switch labelled "Calendar dates";
    - `#calendar-field`, which holds: a `#cadence-summary` span plus a `#cadence-change` button (aria-controls=`cadence-inputs`); `#cadence-inputs` (hidden), holding today's four cadence fields; a short `dl` with `#short-first-year` (text "2027") / "Anchored to SpaceX's stated targets" and `#cadence-growth-year` / "Our illustrative growth, uncapped"; "Modeled dates, not forecasts."; and `<details id="calendar-details">` (summary "Details"), holding today's two cadence notes and the calendar note verbatim, including `#cadence-delay*`, `#calendar-start-year` and `#calendar-mc-note`. In that note, rename today's `#cadence-growth-year` span to `#cadence-growth-year-note`.
    - `<details id="more-analysis">` (summary "More analysis"), holding the `dl` with `#target-count` and `#subsidy`, plus today's subsidy note verbatim.
  - **`<section id="sure-editor" hidden>`:**
    - an h2 and the `#show-mc` switch labelled "On";
    - `#mc-field` (the 1σ input and hint);
    - the legend;
    - the `#mc-prob` `dl`;
    - a one-line caption: "Bands show 10,000 simulated learning rates. Dates use the expected rate.";
    - `<details id="mc-details">` (summary "Details"), holding today's Monte Carlo note verbatim.

- [ ] **Step 1:** Restructure `index.html` as above.
- [ ] **Step 2:** Run `npm test` (expect it to pass). Load the page in headless Chrome. Expected: no console errors.
- [ ] **Step 3: Commit** "feat: restructure page into chart, core inputs and add-card panels".

### Task 4: Responsive layout (`styles.css`)

**Files:** Modify `styles.css`.

- [ ] **Step 1: Three columns (≥ ≈77.5rem).**
  - `body > main` becomes a grid with areas `"header header header" "core chart deeper"`, columns `272px minmax(560px,1fr) 344px`, and `height: 100dvh`.
  - Each column has `min-height: 0`. Core and deeper get `overflow: auto` and scroll internally. The chart panel is a flex column: the SVG flexes and the headline sits under it.
  - `#more-inputs-toggle` is hidden and `#more-inputs` is always shown, whatever `data-collapsed` says.
  - The two cards sit side by side above the open editor, and the editor scrolls inside the deeper panel.
- [ ] **Step 2: Two columns (≈53.75rem to ≈77.5rem).**
  - Areas `"header header" "chart rail"`, columns `minmax(480px,1fr) 320px`, and `100dvh`.
  - The rail stacks core then deeper and scrolls internally.
  - `#more-inputs` is collapsible here, as on mobile, to save rail height.
- [ ] **Step 2b: The fixed-height workspace needs height.** Wrap the two desktop layouts in `@media (min-height: 700px)`. Below 700 px tall, the same columns apply but the page scrolls normally.
- [ ] **Step 2c: Mobile (< ≈53.75rem).**
  - One column in the order header, chart, core, deeper.
  - `.core[data-collapsed="true"] #more-inputs { display: none }`.
  - Cards sit two-up; inputs are at least 44 px tall.
  - Retire the old `@media (max-width: 800px)` rules this replaces.
- [ ] **Step 2d: Focus styles.** Add a global `:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px }`, with a dark-mode token. Don't remove outlines anywhere.
- [ ] **Step 3: Card styles**, keyed on `data-state`:
  - `add`: dashed blue;
  - `active`: teal for When and blue for How sure;
  - `error`: red outline;
  - `[aria-expanded="true"]`: a 2 px outline and shadow.
  - Add `table.no-dates` rules that hide the third column, and dark-mode tokens for every new colour.
- [ ] **Step 4:** Take screenshots at 1440×900, 1280×800, 1100×800, 900×800 and 390×844. Expected: they match the canvas layouts, the page doesn't scroll at the desktop sizes, and the chart meets the floors. Adjust the breakpoints and record them in a comment. Then **commit** "feat: desktop three-column and mobile single-column layouts".

### Task 5: JavaScript state and interaction (`src/main.js`)

**Files:** Modify `src/main.js`.

**Interfaces:** Consumes everything from Task 2's `cards.js`.

- [ ] **Step 1: Add state and wiring.**
  - Add `const ui = { open: null }` and `setOpen(card)`. It sets `ui.open`, each editor's `hidden`, and each card's `aria-expanded`.
  - **Card click:** if the analysis's switch is off, check it, call `setOpen(card)` and then `update()`. Otherwise call `setOpen(toggleOpen(ui.open, card))`.
  - **Switch unchecked:** if `ui.open === card`, call `setOpen(null)`. Then `update()`.
- [ ] **Step 2: Gate the calendar on When.** Use `calendarOn = showTarget.checked && showCalendar.checked` everywhere `calendarOn` is used today, including `readInputs`, so calendar validation only runs when the calendar is on.
  - Always call `showMilestones` while When is on. When dates are off, pass `CADENCE_PRESETS.base` and `CADENCE_DEFAULTS.startYear` as the cadence and start year, and toggle `table.no-dates`.
  - Fill `#target-date` from the target row's `date` when `calendarOn`.
- [ ] **Step 3: Tag errors by field.** `readInputs` returns `{ error, field }`, where `field` is `'core' | 'when' | 'sure'`. The message strings don't change.
  - Before the early return, set each card's `data-state` with `cardState`.
  - On success, fill each card's spans from `whenCard` and `sureCard`.
- [ ] **Step 4: Fill the remaining text.**
  - **Headline strip:** `#milestone-strip` is set from `milestoneStrip({ ..., perKg: stripPerKg(whenOn, targetPerKg) })`. Read the target only when When is on; otherwise use the default.
  - **`#cadence-summary`:** set from `cadenceSummary`.
  - **`#more-inputs-summary`:** e.g. "$100M · 1,024".
  - **`#short-first-year`:** set to `startYear`.
- [ ] **Step 5: Replace the log-scale checkbox** with `#scale-linear` and `#scale-log`. A `logScale` boolean is read from `aria-pressed` and passed to `renderChart`.
  - Wire the `#cadence-change` and `#more-inputs-toggle` buttons: each flips `aria-expanded` and its target's `hidden` or `data-collapsed`.
  - Remove the stubs and references for `target-panel`, `mc-panel`, `calendar-panel`, `target-note` and `log-scale`.
- [ ] **Step 5b: Focus management.**
  - The editor `h2`s get `tabindex="-1"`.
  - When a card click turns an analysis on, call `setOpen(card)` and then focus that editor's heading.
  - Toggling an already-active card keeps focus on it.
  - When a switch turned off closes the open editor, focus returns to the card.
- [ ] **Step 6: `setDefaults`, run on load and on reset.**
  - When off, How sure off, dates on (`DATES_DEFAULT_ON = true` in `main.js`), scale linear.
  - `setOpen(null)`; close `#about`, `#model-details`, `#calendar-details`, `#more-analysis` and `#mc-details`.
  - Hide `#cadence-inputs` and set `#core` to `data-collapsed="true"`.
  - The existing value defaults stay as they are.
- [ ] **Step 7:** Run `npm test`. Expected: everything passes.
- [ ] **Step 8: Commit** "feat: add-card state, single open editor, target-driven milestone strip".

### Task 6: Desktop acceptance checks (1440×900, headless Chrome)

**Files:** Scratchpad script `ux-accept.mjs`, which reuses the CDP harness. Not committed.

- [ ] **D1 Default:**
  - The chart SVG is the largest element on screen.
  - `#per-kg` is "$86.62/kg" and the strip is the exact default string.
  - Both cards are in the add state; no editor is visible; nothing scrolls vertically at 900 px.
- [ ] **D2 When:**
  - Clicking the When card shows the card "late 2032 / launch 682" and the When editor.
  - The milestone table shows 4 rows, with the target row highlighted.
  - `#subsidy` isn't visible until "More analysis" is opened; then it reads "$3,620.75M".
  - Target 200 changes the strip to "$200/kg by launch 96" and the card to "mid 2028". Reset restores the default strip.
- [ ] **D3 Dates off:**
  - The date column and the calendar axis are hidden, and the card value is "launch 682".
  - Setting start year 1999 shows no error while dates are off.
- [ ] **D4 Learning rate 0:** the When card shows "Unreachable", the strip has the 0% wording, and there are no console errors.
- [ ] **D5 Error in a closed editor:** target −5, then close the editor. The When card is in the error state, `#message` is visible, and the chart is dimmed.
- [ ] **D6 Both active:**
  - The How sure card shows "59% / chance by launch 1,024".
  - Opening How sure closes When, so only one editor is visible.
  - Unchecking How sure returns its add card and closes its editor.
- [ ] **D7 Regression:** for states S1–S4, every baseline field from Task 1 matches `baseline.json` exactly. Open the disclosures before reading the hidden fields. Calendar rows are compared as text.
- [ ] **D9 No page scroll:** at 1440×900, 1366×768, 1280×800 and 1100×800, in states D1, D2 (with More analysis open), D6 and S1, `document.documentElement.scrollHeight <= innerHeight`.
  - When content overflows, a panel scrolls internally instead: check `scrollHeight > clientHeight` on the panel.
  - The floors hold: the chart SVG is ≥ 480×340, the computed `font-size` of body text is ≥ 14 px, and every input or button is ≥ 36 px tall.
- [ ] **D8:** No console errors across D1–D7 and D9, and `git diff --exit-code de5fc9f -- src/model.js src/montecarlo.js src/cadence.js src/scale.js src/chart.js src/format.js` is empty.

### Task 7: Mobile acceptance checks (390×844)

- [ ] **M1 Default:** the chart top and `#per-kg` are inside the first 844 px; there is no horizontal scroll; the cards and inputs are at least 44 px tall.
- [ ] **M2 When open:** the When card plus the visible editor make the only open editor. `#more-inputs` is hidden until its toggle is pressed.
- [ ] **M3 Length:** with all analyses on and the When editor open, `scrollHeight` is less than `baseline.mobileHeightAllOn`. Report both numbers.
- [ ] **M4 Resize:** open When at 390 px, resize to 900 px, then 1440 px, then back. The same editor stays open and the values are unchanged.
- [ ] **M5:** No console errors. Take screenshots of M1 and M2 for your review.
### Task 8: Accessibility acceptance checks (headless Chrome, at 1440×900 and 390×844)

- [ ] **A1 Keyboard:** pressing Tab from the top reaches every control in visual and reading order: header, chart scale, core inputs, cards, then the open editor's controls. There are no traps, and nothing hidden is focusable.
- [ ] **A2 Visible focus:** for each Tab stop, the computed `outline-style` isn't `none` and `outline-width` is ≥ 2 px under keyboard focus.
- [ ] **A3 Labels:** the CDP `Accessibility.getFullAXTree` shows no button, checkbox, textbox, spinbutton, slider or combobox with an empty name. The cards' names include their result text, e.g. "When · $100/kg late 2032 launch 682".
- [ ] **A4 Expanded states:** for the cards, `#more-inputs-toggle` and `#cadence-change`, `aria-expanded` equals the visibility of the controlled element after each toggle. `<details>` elements report open or closed correctly.
- [ ] **A5 Focus on open:**
  - Pressing Enter on the "+ When?" add card turns When on, shows its editor, and puts `document.activeElement` on the When editor `h2`.
  - Pressing Enter on the active When card closes the editor, and focus stays on the card.
  - Unchecking the How sure switch inside its open editor returns focus to `#sure-card`.
- [ ] **A6:** Space toggles every switch, and Enter and Space activate every card and disclosure.

- [ ] **Final:** run `npm test`, then a whole-branch review with `/code-review`. Stop for your review. No push or PR.

---

## Parallel subagents: recommendation

**Don't parallelize.** Tasks 3–5 share one set of IDs and states across `index.html`, `styles.css` and `main.js`. Every task depends on the previous one's names, so separate worktrees would just move that coupling into a risky merge. The only independent piece is Task 2, a module of about 60 lines, which would save maybe ten minutes. **Recommended: Native execution.** I implement Tasks 1–8 in order in this session, on `feature/ux-redesign` with no worktree, committing after each task. One fresh reviewer then checks the whole branch at the end.
