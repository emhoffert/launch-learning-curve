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

## Controls

| Control | Range | Default |
|---|---|---|
| Learning rate | 0–50% | 21.7% |
| Starting launch cost, C₁ | > 0 ($M) | 100 |
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
src/model.js        Wright's Law math and $/kg conversion (pure, no DOM)
src/scale.js        Axis scales and tick helpers (pure, no DOM)
src/format.js       Cost, $/kg and percentage formatting (pure, no DOM)
src/chart.js        Draws the chart as inline SVG
src/main.js         Connects the controls to the model and chart
tests/              Unit tests for model.js, scale.js and format.js
```

There are no runtime dependencies and no build step.
