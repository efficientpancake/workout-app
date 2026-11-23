---
version: 1
slug: "app-today-page-jsx"
primary_target: "app/today/page.jsx"
related_targets: ["app/plan/page.jsx","app/food/page.jsx","app/workouts/page.jsx"]
---

## Scope
Whole app shell (Today, Plan, Food, Train, Profile, Login). Mode: Operate. Audience: Sarah alone, iPhone home-screen web app, losing weight, training solo.

## Direction contract
THESIS: Today and the week's plan read like a market stall's boards: one huge number for calories left, each meal labeled like a crate with its calories as a price tag. Refuses the category default of a dark gray card stack with a neon ring.
OWN-WORLD: Deep board green ground (#1f3a2e family), warm off-white sign paper for cards (#f4efe3), ink text. Produce colors only for meaning: beet red = over target, carrot orange = close, leaf green = under/on track. Bold heavy sans numerals with units, aligned. Tags are rectangular with a notched corner. No gradients, no glow.
STORY: She opens the app, sees how much she has left today and what's next, logs food in one tap, drafts the week under target in one tap, swaps meals, gets the shopping list.
FIRST VIEWPORT: Today. Top: date, small. Then "Calories left" with a huge number (around 88px) on the green board, a thin progress bar in produce color under it, eaten/target in small text. Then "Next up" paper card with meal name and price-tag calories plus Log it. Primary action "Add food" full-width paper button, bottom of first viewport above the tab bar. Tab bar: Today, Plan, Food, Train.
FORM: Market Board, position 6 on the grounded list (degraded roll, no challengers). seed:8fef6959a3637893
SIGNATURE: calorie price tags on every meal and day; days in Plan show a tag colored by how the day lands against target.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
