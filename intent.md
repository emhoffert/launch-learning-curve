# Launch Learning Curve Simulator

## Purpose

- Build an interactive web application that makes the effect of learning rates on launch costs easy to understand visually.
- Let users change the model's inputs and see the resulting learning curve right away.

## Core Concept

- **Learning rate:** the percentage by which modeled unit cost falls each time cumulative launches double.
- **Default learning rate:** 21.7%
  - Modeled cost per launch falls 21.7% with each doubling of cumulative launches.
  - This equals a **78.3% progress ratio** (each doubling keeps 78.3% of the previous cost).
- **Model (Wright's Law):**
  - `cost(n) = C₁ × n^b`
  - `C₁` = starting launch cost (cost of the first launch)
  - `n` = cumulative launches
  - `b = log₂(1 − learning rate)` (about −0.353 at the 21.7% default)

## Version 1 Features

- **Adjustable inputs**
  - Learning rate
  - Starting launch cost
- **Immediate feedback**
  - The curve redraws as soon as an input changes, with no "submit" step.
- **Visualization**
  - X axis: cumulative launches
  - Y axis: modeled cost per launch

## Technical Constraints

- Runs entirely in the browser.
- No backend server.
- No database.
- Uses plain HTML, CSS, and JavaScript, and adds a library only when it clearly earns its place.
- Will eventually be hosted publicly on GitHub Pages.

## Out of Scope

- Proprietary SpaceX cost data
- User accounts or authentication
- Databases or server-side storage
- Unnecessary frameworks

## Learning Goals

This project is also a hands-on way to learn:

- JavaScript
- Interactive data visualization
- Git branches
- Pull requests
- Code review
- GitHub Pages deployment
- Working effectively with Claude Code
