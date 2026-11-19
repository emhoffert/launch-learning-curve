# UX Redesign: Add-Card Layout — Design

Status: approved 2026-11-19 · Branch: `feature/ux-redesign` · Mockups: https://claude.ai/artifact/5M88FqZwZdywWV3QDzj11P (desktop row and the "Mobile C: add cards" row; the When panels there predate the hierarchy change in §4.2)

## 1. Intent

Today every control and readout sits in one long column of checkboxes and panels, so the learning curve competes with target, subsidy, Monte Carlo and calendar detail. The redesign keeps the **learning curve as the primary story** and reveals the deeper analysis progressively, through **add cards** that turn into result cards once they are switched on. Desktop and mobile get their own layouts, not one layout shrunk.

## 2. Goals, non-goals, anti-goals

- **Goals:** a dominant chart; one headline result; deeper analyses that are easy to discover but out of the way; at most one editor open at a time; desktop and mobile layouts designed separately.
- **Non-goals:** new analyses; changes to the model, Monte Carlo, cadence or chart-drawing math; the mobile sticky results bar (deferred to a later slice); onboarding or tour features.
- **Anti-goals (a failure even if it works):**
  - any change to a computed number;
  - the subsidy competing with the timeline at the first level;
  - an analysis that is on but whose state you can't see;
  - losing the required wording: "Modeled dates, not forecasts", the 2027 assumption and 2028+ assumption notes, and the Monte Carlo and subsidy methodology notes.

## 3. Approaches considered

1. **Long scroll with a sticky results bar (mobile).** Simple, but the analyses read as one long form, and their state is hard to see. Rejected.
2. **Segmented control (Curve / When / How sure).** Good for editing, but whether an analysis is on was too subtle. Rejected.
3. **Add cards (chosen), on both desktop and mobile.** An off analysis is a dashed "+ When?" or "+ How sure?" card with a one-line promise. An on analysis is a filled result card showing its key result. Selecting a card opens its editor. Chosen because it shows the on/off state and the result at a glance, and because one model works on both sizes.

## 4. Design

### 4.1 Structure (three questions)

1. **How does cost fall?** The core section: learning rate, starting cost C₁, launches shown, reset. Always visible.
2. **When could we reach a cost?** The "When" card: the target, the milestone ladder, the calendar dates, and the subsidy. This merges today's target and calendar toggles.
3. **How sure is this?** The "How sure" card: Monte Carlo.

Each card has two separate states:
- **Active:** a switch inside its editor, or clicking the dashed add card, which turns the analysis on and opens its editor.
- **Open:** selecting the card. Only one editor is open at a time. Selecting the open card again closes it. Turning an analysis off returns it to its dashed add card and closes its editor.

### 4.2 When card: disclosure hierarchy (confirmed by the user 2026-11-19)

1. **Primary:** the selected target, its launch number, and the modeled date when dates are on.
2. **Primary supporting:** the milestone table, which stays visible because it tells the learning curve's progression story.
3. **Secondary:** the modeled learning subsidy and its methodology, behind "More analysis".

In detail:

- **Level 1, the result card:** the target $/kg, its launch number, and the modeled date when calendar dates are on. Example: "When · $100/kg / late 2032 / launch 682". With dates off, the launch number becomes the large value ("launch 682").
- **Level 1, inside the editor (always visible when open):**
  - the target input;
  - the result line: target, launch, date;
  - **the milestone progression table**: $500 / $200 / $100 / $50 plus the target row, highlighted. It shows a date column only when calendar dates are on;
  - the calendar controls: a "Calendar dates" switch; "Base cadence · from 2027 · Change", where Change reveals start year, scenario, first-year launches and growth; the two assumption lines (2027: anchored to SpaceX's stated targets; 2028+: our illustrative growth, uncapped); and "Modeled dates, not forecasts."
- **Level 2, "More analysis" (collapsed by default):** a disclosure inside the When editor that reveals the modeled learning subsidy (value and status), launches required from launch 1, and the existing subsidy methodology note, verbatim. The subsidy does not appear on the card, in the headline, or at level 1.

Unreachable or not-reached targets reuse today's wording ("Unreachable", "Not reached", and their status lines) on the card and in the table.

### 4.3 How sure card

- **Card:** the probability of reaching the target by the last launch shown, e.g. "59% / chance by launch 1,024", when When is on.
- **When is off:** the card reads "Bands on chart", with "Add When? for a probability".
- **Editor:** the on switch, the 1σ input with its existing range hint, a one-line caption, and a "Details" disclosure holding the existing Monte Carlo methodology note verbatim. The calendar Monte Carlo note ("dates use the expected rate…") shows in the When editor when both are on, as today.

### 4.4 Desktop (≥ 1024 px)

- **Header:** the title, and an "About the model (Wright's Law)" link that reveals the existing lede and formula.
- **Three columns:**
  - **Core inputs (~272 px):** learning rate slider plus number, C₁, launches shown, a "Model details" disclosure (progress ratio, exponent, cost of the final launch, reduction), and reset.
  - **Chart (flexible, dominant):** the chart with a Linear / Log–log segmented control in its header, the chart note, and the headline card below it. The headline card shows cost per kg at the last launch shown, plus the milestone line: "From $1,000/kg at launch 1 · $100/kg by launch 682 · 91.3% lower by 1,024". The middle milestone follows the When target (see §6, call 6).
  - **Go deeper (~344 px):** the two cards side by side, with the open editor below them.

### 4.5 Mobile (< 1024 px)

- **Single column:** header; chart (with Linear / Log); headline; a learning-rate card (slider plus number, and a link "Starting cost, launches shown, reset" with a summary "$100M · 1,024" that reveals those inputs); "Go deeper" with the two cards side by side; the open editor below them.
- "Model details" sits inside that inputs reveal, and "About" stays in the header, so every readout is reachable on mobile too.
- Touch targets are at least 44 px.
- One DOM serves both sizes; CSS rearranges it at 1024 px. Nodes are not moved or duplicated per breakpoint.

## 5. Constraints

- **Unchanged behaviour:** `src/model.js`, `src/montecarlo.js`, `src/cadence.js` and `src/scale.js` keep their math and APIs. `renderChart` keeps its options contract. Every number the page shows today must still be computed the same way, and every one stays reachable somewhere in the UI.
- **Stack:** vanilla ES modules, no new dependencies, `npm test` stays green (88 tests).
- **Accessibility:** keep the existing `hidden` + `aria-controls` pattern; cards are `<button>`s with `aria-expanded`; switches are labelled checkboxes; keep the status/live region for input errors, and the chart `aria-label` composition.
- Dark mode (the existing `prefers-color-scheme` block) keeps working.

## 6. Calls I made (please check)

1. **Calendar dates default on when When is first turned on** (the mockups assume it). Today `CADENCE_DEFAULTS.enabled` is `false`, and calendar is a separate top-level toggle. In the redesign, calendar lives only inside When, so turning When off also removes the calendar axis.
2. **Breakpoint at 1024 px**, with no separate tablet layout.
3. **Mobile sticky results bar deferred** to a later slice.
4. **"More analysis" is the level-2 label**, collapsed by default, and it resets to collapsed on reset.
5. **The "Details" disclosures** keep the methodology notes word for word; only their placement changes.
6. **The headline milestone follows the When target (decided by the user, 2026-11-19).**
   - **When is off:** the milestone uses the illustrative default of $100/kg (`DEFAULTS.targetPerKg`).
   - **When is on:** it uses the current target from the When editor. An unchanged target is still $100/kg, so the headline doesn't change.
   - **Changing the target** (for example to $200/kg) changes the headline to "$200/kg by launch N".
   - **Reset** restores the target to $100/kg, and with it the default headline.
   - **Why:** the headline never shows a target that competes with the user's own.
   - **How it's computed:** with the existing `findTargetLaunch`. When the milestone isn't reached, it reuses today's wording ("never falls at a 0% learning rate", "not within N launches").
7. **An invalid input inside a closed editor.** Its card shows a "Check input" state, and selecting the card reopens the editor. The existing status message and the dimmed chart behave as they do today.
8. **The calendar switch keeps the user's choice for the session.** Turning When off and on again does not reset it. Reset restores all defaults: both analyses off, every editor and disclosure closed, and dates on for the next time When is turned on.
9. **The cadence summary is live text** built from the scenario and start year, e.g. "Custom cadence · from 2029 · Change". The Change reveal opens only when the user selects it.

## 7. Left to the builder

The DOM restructuring of `index.html`, `src/main.js` and `styles.css`; extracting pure, testable helpers for the card text (e.g. `src/cards.js`); and the exact spacing and colours, following the mockups.
