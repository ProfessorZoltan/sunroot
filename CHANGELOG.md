# Changelog

## Is food too easy?

- Answered: no. The balance report said food was too easy (1.77× made over eaten, 41% rotting),
  but the bots kept a food buffer larger than storage could hold, so they kept building farms
  whose food could only rot. With a buffer they can store, the bots that build food only to need
  make 1.13× what they eat and 8% rots, and food still needs tending every season. No game numbers
  changed (DECISIONS.md Q8).
- The report answers the food question from the bots that build food only to need, and shows
  hunger per bot.
- `scripts/food-analysis.ts` breaks a run's food down by source and year.

## Milestone 6: combos and the Almanac

- All five combo layers from the design, in the content file and checked in step 10 of every
  season:
  - Adjacency: Busy Bees, Quiet Spire, Kiln Warmth, Green Doorstep.
  - Chains: the Kitchen, Gas and River Loops. A loop closes when it runs; from the next season each
    of its buildings makes +1 for as long as it stands.
  - Formations: Village Green (+2 wellbeing), Sun Terrace (+1 each, no shade), Mill Race (the
    workshop runs without energy), Wildway (+10 Harmony).
  - Evolutions: Winter Garden, Agrivoltaic Field (a canopy built over a farm), Rewilded Ruin,
    Treehouse Commons.
- Tunings join the draft: Deep Roots, Mirror Film, Night Shift, Silt Traps and Hive Mind. They are
  data modifiers applied to the run's content.
- Charters at the start of eras 2, 3 and 4: Repair Culture, River Keepers, Night Market, Seed Savers
  and Slow Power.
- A stained-glass card unfolds for each combo new to the Almanac. The Almanac (A) lists every combo
  by layer, with silhouettes and hints (5 knowledge for the hidden layers), and keeps discoveries
  across runs.
- The placement preview names the combos a building would put to work, with vines on the map. Loops
  at work glow during the season's resolution. The left column lists closed loops, charters and
  tunings.
- Every combo, tuning and charter triggers in a unit test (`tests/combos.test.ts`). The Year 1
  golden test is unchanged.
- The balance baseline was refreshed: combos raise every bot's score and cut blackouts and idle
  seasons ([docs/balance/baseline-report.md](docs/balance/baseline-report.md); the previous one is
  in `docs/balance/history/`).
- Four places where the design's combo text and the rules don't fit are raised in DECISIONS.md
  (C8–C11, Q6, Q7).
- Fixed: the end-of-run screen could open without focus on its first button (seen in CI after
  Milestone 5).

## Milestone 5: season resolution and feel

- Each season now plays out on the map in about 5 seconds: the event (the flood spreads, storms
  shake the valley, freeze pales it), the sun crossing from east to west with moving shadows,
  yields popping as the sun reaches each building, energy flowing as light from sources to
  consumers, night with lit windows and dark blackouts, then population and wellbeing changes.
- The year strip fills slot by slot as the season plays out.
- Skip with Space, Esc, E or the Skip button; pause with P. Any action skips the rest.
- Reduced motion (the system setting) shortens it to about a second, without drifting or shaking.
- Seasons repaint the map (blossom, leaves, snow, silt glitter), and wildlife returns with Harmony:
  birds, then deer, then otters.
- Simulation: the season report names what shades each solar building (`report.shaded`).
- Browser tests: a season takes about 5 seconds through all four phases, and can be skipped and
  paused.
- Fixed: Esc pressed straight after ? could miss the key list, because keys read the state of the
  last render.

## Milestone 4: interface

- The mockup's layout: the year strip of 8 energy slots (done, now and forecast, with striped
  shortfalls), Harmony, wellbeing and citizens; stores with this season's change and last
  season's events; stained-glass draft cards with reroll and a 4th card; the building palette with
  icons and letter keys; the forecast, Undo and End season.
- Tooltips with the full math on every number, on hover and keyboard focus, live while open.
- A building inspector: status, this season's math, recipe, digester slot and blackout priority.
- Spread compost from the palette.
- A whole run is playable with the keyboard alone (tested end to end), with a keyboard cursor,
  a sensible-first cycle through legal sites, and a key list on ?.
- An end-of-run screen with the provisional score.
- Simulation: season projections (`projectSeason`), energy per season in the run history, demand
  by building type, why the population did or didn't grow, a Harmony breakdown, and one-line
  event summaries in the data.
- Fixed: after a run ended, the forecast showed the old season's event.
- The README was out of date (several earlier edits had not applied); it now describes the
  project as it stands.

## Milestone 3: map rendering

- A PixiJS map in the mockup's papercraft style: tiles with depth, terrain details, the river's
  flow line, fog around the valley, and a drawing for each of the 26 buildings.
- Pan (drag, arrow keys), zoom (wheel toward the cursor, + / −), fit (0), hover highlight.
- Placement preview: a ghost building with floating +/− numbers on every tile it affects, and a
  panel with its effect on food, Harmony, wellbeing and shortfalls, warnings and its math. Invalid
  sites show a red outline and the reason. Worked out by the simulation (`previewPlacement`).
- Free undo (Ctrl/Cmd+Z), a simple draft, building palette and End season (Milestone 4 replaces
  these panels with the full interface).
- Sandbox mode (`?sandbox`) and a test that every building can be placed on generated maps.
- Map generation: river bluffs are now hills. The Pumped Reservoir could never be built before,
  because it needs a hill beside a reservoir and hills were only at the valley edges.
- Season reports record energy and heat per building; yield math reads more plainly.
- Browser tests with Playwright, in CI.

## Fix the clutter spiral

- Food beyond storage now rots into biomass instead of scraps (DECISIONS.md D1). It is a data
  setting, `rules.rotsInto`, so the original rule is one line away.
- The balance simulator now tracks where scraps come from (people or rot), how much becomes
  clutter, and how much is recycled.
- Rerun of 4,000 runs (`docs/balance/baseline-report.md`; the previous one is in
  `docs/balance/history/`):
  - Clutter collapses in non-random runs: 1,171 of 3,000 → 0. Completion: 7% / 94% / 83% → 100%
    for greedy food, greedy energy and balanced. Median scores: 59 / 153 / 151 → 174 / 164 / 208.
  - Clutter is still a cost: bots build about 4 composters per run (down from 7–8).
  - New concern: nothing now ends a competent run. Blackouts are the only pressure left (9–14
    blackout seasons per run), and idle seasons rose to 13–18 per run.

## Milestone 2: balance simulator

- `npm run balance` plays 1,000 seeds with each of 4 bots (random, greedy food, greedy energy and
  a balanced baseline) on all CPU cores, and writes `balance-out/runs.csv` (one row per run) and
  `balance-out/report.md`.
- The report covers score spread, completion, how runs end, card pick rates and early-pick lift,
  idle seasons by era, blackouts by season, the energy mix, and answers to the design's balance
  questions. The baseline report is kept in `docs/balance/baseline-report.md`.
- Bots play only through player commands. They check fixes by peeking at how the season would end.
- A provisional score (weights in the content file) until Milestone 7 decides the real one.
- Wellbeing lines now have a `kind` (hunger, unpowered, clutter, ...).
- Faster state copies: about twice as fast per run, with identical results.

### What the first 4,000 runs say

- Food is too easy after Year 1: bots make 1.37× what they eat and 25% rots. The rot feeds the
  clutter spiral: 1,171 of 3,000 non-random runs collapse from clutter, none from hunger.
- River Wheels make 61% of built-source energy in the top quarter of runs.
- The draft runs out of blueprints after about 19 of 48 seasons.
- The middle eras are the quietest: 3.6 idle seasons in Mend against 0.9 in Settle.
- Winter blackouts are near-universal (85–99% of non-random runs); summer blackouts hit 67–75%
  of wheel-heavy runs, when low river cuts wheels to 1 / 1.

## Heat routes prototype

- Design proposal in `docs/proposals/heat-routes.md`: several ways to make heat, each with its own
  catch (placement, timing or a competing loop), rather than a ladder of efficiencies.
- Two new draftable buildings in Willow Reach (beyond the design's 23):
  - **Heat Pump** (7 materials): pays heat at 2 per energy, up to 4 heat per slot. Must touch the
    river, a reservoir or a Fish Pond.
  - **Solar Thermal Collector** (4 materials): 2 / 3 / 3 / 2 free heat by day, 1 less in shade.
    The heat pays day heat demand or charges Heat Wells.
- Heat is now settled in order: free heat, heat pumps, then direct energy; stored heat still covers
  what is short. Season reports show the heat math per slot.
- Blackouts recount demand after each shut-off, and a building shut off by day stays off at night.
- The Year 1 golden test is unchanged and passes. Its setup moved to `tests/walkthrough.ts` so heat
  tests can replay the same winter with the new buildings.

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
