# Changelog

## Milestone 1: simulation core (headless)

- A pure, deterministic simulation in `src/sim`: commands in, new state out, no clock, one seeded
  random generator (sfc32) whose state is saved with the run.
- Hex grid (axial coordinates) and seeded Willow Reach map generation: a 120-tile valley with a
  river, floodplain, dry bluffs, hills, ruins and exactly 18 starting Harmony.
- All 23 Willow Reach buildings and the Founders' Camp as data in `src/content/willow-reach.json`,
  validated with Zod at load (unknown fields and bad references are rejected).
- The full season order: event, staffing and production, flexible consumers, storage, demand and
  blackouts, food, population, wellbeing, scraps, clutter and Harmony.
- Energy per slot (day and night), heat, Cell Banks, Heat Wells, the Pumped Reservoir, blackout
  priorities, shading, wind spacing, weirs, the Mixed Grid bonus.
- Flood (silt, damage, repairs, levees, weirs), low river, storms and freeze.
- The draft, with the guided first year, knowledge rerolls and a fourth card; era gating.
- Commands: pick, reroll, extra card, place, spread compost, set recipe, set digester slot, set
  priority, undo (free until the season ends) and end season. Every season writes a report with
  the math behind each yield, for tooltips.
- The Year 1 walkthrough is a golden test, including the Cell Bank alternative, plus about 200 rule,
  map, content and determinism tests.
- `docs/DECISIONS.md` records every rule the design left open, and 7 places where the design and
  the walkthrough disagreed.

### Found while testing

Scripted whole runs all collapse between years 4 and 8. The settlement is never hungry: surplus
food fills storage, rots into scraps, the scraps become clutter, and clutter (70 to 130 by the end)
drives wellbeing and Harmony to 0. See DECISIONS.md, Q1.

## Milestone 0: project setup

- TypeScript, Vite, Vitest, ESLint (flat config) and Prettier.
- ESLint guards the simulation's purity: no `Math.random`, clock or browser globals in `src/sim`.
- GitHub Actions CI runs typecheck, lint, format check, tests and a production build.
- A blank page renders with the paper palette.
