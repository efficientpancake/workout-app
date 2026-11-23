# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

One person: Sarah. She trains on her own (tread, row and floor interval workouts) and is working to lose weight. She uses the app as an iPhone home-screen web app, during workouts and at home while planning and logging food.

## Product Purpose

A personal coach in her pocket: a running clock and spoken interval callouts for solo workouts, and a food side that helps her lose weight by planning the week's meals under a calorie target, logging what she eats, and building the shopping list. Success is that she opens it every day, sticks to a weekly plan, and her logged days land under target.

## Positioning

Built around one person's actual meals, workouts and targets, with no social features, no ads and no paid AI calls.

## Operating Context

- Opens on Today: calories left today, what's planned next, quick add food. Stopwatch and workouts are one tap away.
- Weight-loss meal planning works both ways: the app drafts the week from her saved meals to land under her calorie target, she swaps anything she doesn't want, and the totals update as she goes. The shopping list comes from the plan.
- Workouts run mid-set on a treadmill or rower: big, readable, minimal taps, voice callouts so she rarely looks at the screen.
- Data lives in her Supabase project behind a password plus authenticator code.

## Capabilities and Constraints

- Next.js 15 (App Router, plain JSX), deployed on Vercel from GitHub (efficientpancake/workout-app, public repo).
- Stopwatch (timestamp-based, wake lock), workout runner with spoken callouts (British male voice only) and beeps. iPhone web apps can't vibrate.
- Food: barcode scan, Open Food Facts search, manual entry, favorites, meals built from foods, weekly plan with "Log it", shopping list.
- Targets from her stats (Mifflin-St Jeor, calorie floor, protein 1.6 g/kg, fiber). Free rule-based coach on Today (no AI calls).
- Stage 2, not built: workout calorie burn and manual activity.

## Brand Commitments

- Name: Fifth Gear Fitness; home-screen label "Fifth Gear".
- Never write "Orangetheory" or "OTF" anywhere.
- Copy: plain, short, American spelling, no em dashes.

## Evidence on Hand

None beyond her own use. Don't invent testimonials, stats or results.

## Product Principles

1. Today first: the most useful thing on opening is how much she has left to eat and what's next.
2. The plan does the work: drafting a week that hits the target should take a tap, not an evening.
3. Mid-workout, eyes off the screen: anything used during a set is huge and needs almost no taps.
4. Just for her: no onboarding tours, no accounts UI beyond sign-in, no growth features.

## Accessibility & Inclusion

Dyslexia-accessible is a hard rule: sans-serif type, no italics, no all-caps, no decorative underlines, generous spacing, short lines.
