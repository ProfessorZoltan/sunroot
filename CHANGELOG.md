# Changelog

## Long Winter keeps its heat close

- In a Long Winter, heat is local: heat pumps, heat wells and solar thermal collectors warm only
  buildings within 2 tiles, and heat bought from the grid costs 2 energy each. The twist's card says
  so. It costs about 26 more points than before; the Graft is still lifted a tier.
- Select or hover a building to see orange arcs from each heat source to what it warms. Tooltips
  and the building panel say where a building's heat comes from, and what a source warms; the season
  report has a "Heat kept close" section, and its energy ledger counts the energy lost buying heat
  from the grid.
- `?heat=1` turns local heat on for a seeded run.

## Local heat, in the simulation (H1)

Built in the simulation only, and off in the game: it failed its gate as run 4's layer, so it is on
no rung of the ladder. Nothing changes in play.

- With local heat on, solar thermal collectors, heat pumps and heat wells heat only buildings within
  2 tiles; heat bought from the grid reaches anywhere (optionally at 2 energy per heat). Off, heat is
  shared exactly as before.
- The season report records which source heated which building.
- `scripts/heat.ts` compares it with shared heat; the report is
  [docs/balance/heat-h1.md](docs/balance/heat-h1.md). DECISIONS.md Q18 asks where it should go.

## Walks to work on screen (C2), from run 3; score lines for the layers

- Walks to work join at run 3: workers live in the nearest home with a free bed and walk to work;
  walks of up to 2 tiles are free, longer ones cost wellbeing. The start card explains it.
- Select a building to see its walks drawn on the map, green or brown for short or long. Work whose
  workers walk far has a footprints badge; tooltips and the building panel say who walks from where;
  the left panel has a Walks row; placing work far from any free bed warns first; the season report
  has a "Walks to work" section.
- Score lines for the layers: "water to manage" +12 and "walks to work" +3, so a run with more to
  manage earns the same Graft tier for the same play. `scripts/calibrate-layers.ts` sizes them.
- Root City's "Full valley" brings walks to work too. `?commute=1` turns them on for a seeded run.

## Commuting, in the simulation (C1)

Built in the simulation only, as water was: off in the game until it can be seen (C2), and not on
the teaching ladder yet. Nothing changes in play.

- Workers live near their work: each one takes a bed in the nearest home with room, and walks from
  there. Walks of up to 2 tiles are free; every 3 tiles beyond, summed over everyone, cost 1
  wellbeing that season ("long walks to work").
- The season report records where everyone lives and who walks how far.
- Bots mind walks (work near homes, cottages near far work); `scripts/commute.ts` compares them with
  bots that don't, with and without water. The report is
  [docs/balance/commute-c1.md](docs/balance/commute-c1.md).

## Water on screen (E2), from run 2

- Water joins at run 2, with a guided first year: the expedition goes upriver, where fields need
  irrigation. The start card explains it, and a hint under the new Water row guides the first two
  seasons. Root City's "Full valley" box brings water to the next run whatever its number; Tempest
  levels always have it.
- Channels are dug into the map as ditches, joined to their neighbours and reaching into the river.
  Water flows along them, drawn as wide as what it carries this season and thinning as buildings
  drink; marks drift downstream. The river narrows as water is taken from it.
- Choose Irrigation Channel (I) and click from a channel's end, or beside the river: the tool stays
  in hand, tile after tile. The placement preview shows farms gaining food as water reaches them.
- Hover any tile: a channel tile says what it takes from the river, what is taken there and what
  flows on, by quality; a building what it needs and gets, and from where; the river what flows
  past; a cistern what it holds. Buildings that will be short of water are marked on the map.
- The season report has a Water section: a diagram of where every unit came from and went, each
  channel's season, and who went short. Buildings at the same distance down a channel share water
  by priority, set in the building panel as for blackouts.

## Water, in the simulation (E1)

Water from [docs/EXPANSION.md](docs/EXPANSION.md), built in the simulation only: the game keeps it
off until it can be seen and laid (E2). Nothing changes in play yet.

- The river brings 12, 4, 8 and 6 units of water a season from the top of the map. Irrigation
  Channels (1 material a tile, not on hills) carry up to 4 from the river or a lake to the
  buildings along them, nearest the intake first; summer evaporates 1 for every 4 tiles; what is
  left at a channel's end returns to the river if the end touches it. The camp starts with 3 tiles.
- Farms, orchards and greenhouses need water; short of it they make half. Fish ponds feed
  nutrient-rich water into a channel beside them (+1 food on a farm). Grey water that reaches the
  river costs Harmony.
- Cisterns store 6 (beside a channel, the river or a lake), fill outside summer and in the flood,
  and cover what runs short below them. A weir holds back 4 of spring's water for summer. River
  wheels turn with the water passing them, so water drawn upstream costs power.
- `scripts/water.ts` compares the valley with and without water for the E1 decision gate; the
  report is [docs/balance/water-e1.md](docs/balance/water-e1.md). A proposed Year 1 walkthrough
  with water waits for review.
- Art for the expansion is listed in [docs/ART-EXPANSION.md](docs/ART-EXPANSION.md).

## Tempest

- Tempest levels 1 to 10: a Heartwood Graft at your highest level opens the next. Each level adds
  a lasting hardship to those below it (Bitter Nights, Thin Drafts, Quick Clutter, Slow Healing,
  Restless People, Cold Autumns, Rough Seasons, Weary People, High Hopes, Cramped Homes). Choose the level
  in Root City with the expedition.
- Rewards: 2 more Seeds per level, and the Tempest mark: the Graft's district shows the level it
  was earned at.
- Seasons play out more slowly (about 7.5 seconds), and each number stays up longer.

## Repairs

- A building's panel can turn off "Repair automatically when damaged": it then stays damaged until
  you choose "Repair now". Repairs stay automatic by default.
- The panel and the map tooltip give a damaged building's real repair cost, whether you have the
  materials, or that its repairs are on hold.
- A damaged home shows as "damaged home" in wellbeing, not as an unpowered one; under Wild Storms
  the Mixed Grid no longer claims to stop storm damage.

## Hand-made art

- The map is drawn with hand-made storybook papercraft: every tile type (two summer looks and
  winter) and every building (summer and winter), lit windows at night, turning wind spire blades
  and river wheels. The interface's building icons come from it too.
- The hexes are a little flatter to match the art.
- `scripts/import-art.ts` brings art from `art/incoming/` into the game; `docs/ART.md` describes it.
- The procedural art export (`scripts/export-art.ts`, `docs/art/`) is gone: the hand-made art
  replaces it.

## Harder hard twists

- Drought Year: in summer every farm keeps only a quarter of its food, however near the water.
- Long Winter: homes need 4 more heat on winter nights, 3 more in autumn and 2 more in spring;
  solar canopies make 1 less by day in autumn and winter.
- Wild Storms: storms can damage 3 buildings anywhere on open land, the Mixed Grid can't stop them,
  and storm damage lasts until repaired for 3 materials.
- Lean Start: 5 materials, 4 food and 4 citizens.
- Fixed: the year strip's forecasts applied the run's twist, Root City's perks, tunings and
  charters twice (Mirror Film's +1 winter solar counted as +2, for example); with Long Winter it
  could stop a run from starting. Applying them twice is now an error.
- Storms gain three settings, as data: which tiles are exposed, whether the Mixed Grid shelters,
  and a repair cost (hills, yes and none, as before, without the twist).

## More varied expeditions

- Each expedition now sets out to a **region**, a variation of Willow Reach's valley, shown on its
  card: The Reach (as it was), Oxbow Lakes (still lakes ringed with floodplain), The Broad Wash
  (floodplain two tiles deep), Old Town (nine ruins of salvage), High Banks (steep banks and hills;
  the Graft a tier higher), Old Grove (six groves, Harmony 24) and Wandering River.
- Six new twists, five of them trade-offs rather than hardships: Rich Silt, Steady Winds, Clear
  Skies, Big Families, Scavengers' Valley, and Lean Start (half the starting stores; the Graft a
  tier higher).
- `scripts/expeditions.ts` plays bot runs for each region and twist.

## Art guide

- `docs/ART.md`: how to make hand-made art for every tile and building (style, frame, names,
  optional layers), with the current art beside each. `npx tsx scripts/export-art.ts` exports the
  current art, a contact sheet and the frame template to `docs/art/`.

## Events on the map

- Choosing a building highlights every tile it can go on; floodplain where the flood would damage
  it is tinted blue.
- The map marks what lasts for the season (silt on flood-fed farms, damage, no worker, shade) and,
  dashed, how far the coming event reaches: tiles a flood will cover, buildings it will damage,
  tiles levees keep dry, farms a low river will dry, buildings exposed to storms, homes the freeze
  makes cold. The forecast pill sums it up; the map tooltip explains each mark.
- Each event plays out on the tiles it touches: levee shields, flood damage and silt; sandbars,
  cracked fields and slowed wheels; rain, wind and lightning; ice, frost and snow.
- More life about the valley: butterflies, bees, chimney smoke, leaping fish, citizens walking to
  work, petals, seeds, leaves or snow on the wind, and cloud shadows.

## A fuller end to a run

- Refinements: once the blueprints and tunings run out, the draft deals refinements, cards that
  improve a building you have (farms +1 food in summer and autumn, lean workshops, loft rooms...),
  some takeable twice. Every season keeps a choice.
- Projects from era 3: big works paid from your stores (Green Terraces, Biochar Beds, Seed Vault,
  Festival Grounds, The Long Bridge, Sky Garden, Gift to Root City), finished after a few seasons
  for score, Harmony, wellbeing, healed land or Seeds.
- Rising expectations from era 3: citizens beyond what civic life serves (Commons Plaza, library,
  cider press) cost wellbeing. Seasons grow harsher: dearer flood repairs and wilder storms in era
  3, colder winter nights in era 4. The left panel and the era cards explain each.
- Graft tiers recalibrated for the higher scores (Sapling from 245, Heartwood from 385), and Seeds
  are now 1 per 15 points, so about 30% of runs still pay for a Graft alone.
- `scripts/late-game.ts` reports how the end of a run plays out for the bots.

## Fast-forward

- **Fast-forward** (Shift+E) ends seasons up to next spring without playback, waiting for each
  card, charter or vision and carrying on once chosen; it stops before a season would end short of
  energy or with citizens hungry. Esc stops it.

## Season report Sankeys

- A second Sankey shows energy and heat: what supplied the day and the night (generators, free
  heat, heat pumps, storage, and any shortfall in red) and what used them.
- The season report opens with a Sankey diagram of the season's resources: what made each one, the
  resources, and what used them, with stock drawn from or kept in the stores. Hover or focus a band
  or node for its numbers.

## Playtest requests

- Season report: **Report** in the footer, or "report" on a season in the year strip, shows the last
  spring, summer, autumn and winter: every resource made and used and by what (bonuses apart), the
  energy by source and use, combos and bonuses at work, workshop runs and wellbeing. The simulation
  keeps a ledger of every resource that balances exactly, season by season.
- Demolish a building from the inspector (or Delete): 2 day energy this season, rubble of half its
  cost as clutter (salvage while a Salvage Yard stands); flat land turns barren, hills, floodplain,
  river and ruins stay. Undo is free until the season ends.
- Workshops now default to Auto: salvage first, then clutter once there are 5 or more. Before, a
  workshop only recycled clutter if switched to it in the inspector, so clutter piled up unnoticed.
- The footer's buttons are shorter, so the forecast keeps its room.

## Milestone 9: audio

- Sound, all synthesized in code: each building plays a note when placed (a marimba for food, a
  bell for energy, a flute for homes...), all in D major so play sounds like a tune.
- Combos play chords: a placement that puts a combo to work, a loop closing, a building evolving.
  Discovery cards unfold with a chime. A run ends with a cadence; Root City has its own notes, a
  landmark chord and the Sun Tree's fanfare.
- A soundtrack that gains an instrument at each Harmony tier: a pad, then a plucked arpeggio, a bell
  melody and a high flute, so a thriving valley sounds fuller.
- Sound on/off in the footer and the city; music and effects volumes in the keys panel.

## Milestone 8: Root City

- Root City between runs: the Heartwood ringed by 18 district slots. Place the Graft a run planted,
  spend Seeds to raise districts to Sapling and Heartwood, and choose the next expedition. A full
  city lets a new Graft replace a district, which composts into half the Seeds spent raising it.
  Fill every slot with 6 districts at Heartwood to grow the Sun Tree.
- District perks in every run (the best of each kind counts): cheaper river wheels, starting food,
  Harmony, an extra workshop run in year 1. Each district also adds a card to future drafts: the
  Cider Press blueprint, the Spillway and Kiln Loop tunings and the Rewilders charter.
- Landmarks: the Cider Mill (orchards produce a season sooner) and Heartwood Grove (the Wildway may
  cross one other tile), found by placing the right districts side by side.
- Expeditions from run 2: 3 to choose from, each a Willow Reach map with a twist (Drought Year, Long
  Winter, Wild Storms lift the Graft a tier; Fair Weather doesn't) and a city request worth 5 Seeds.
  The run shows its expedition on the left, and a card when the request is met.
- Teaching across runs: run 1 is guided with blueprints only; tunings join in run 2, charters in
  run 3 and visions in run 4, each announced on a card when the run starts.
- Root City is saved in the browser and survives reloads; the Grafts kept by earlier builds move in
  as Grafts waiting to be placed. A Root City button looks at the city during a run.
- Browser tests play 5 runs in a row through the city, and a test plays 5 bot runs through the store
  with the city saved and reloaded between them.

## Seeds by score

- A run earns 10 Seeds plus 1 for every 14 points of its score. Planting its Graft in Root City
  costs 35, so only about the best quarter of runs pays for one alone; otherwise the end screen
  banks the Seeds for the next run, and a player can bank them instead of planting. Upgrades now
  cost 15 and 30. The ending moves from run 18 to about 19 for a skilled player, 21 for a learner
  and 34 for a steady energy-first player (DECISIONS.md Q12).

## Designer's answers, and playtest tools

- Combos and charters as the designer intended: the Sun Terrace is +1 day energy every season;
  Repair Culture doubles salvage from the same ruin and makes clutter recycling 2 materials; the
  Winter Garden needs no winter heat and makes 4 food in winter; the Agrivoltaic Field keeps the
  canopy's energy, the farm's food minus 1 (silt after) and drought immunity.
- The Mixed Grid counts built sources only and now adds +1 energy in every slot as well as stopping
  storm damage.
- Era goals (defaults until playtesting): house 10 citizens, close 2 loops, reach Harmony 40, a full
  year with no shortfall; each gives 3 knowledge, shown on the left with a card when met.
- Forecasts: previews no longer reveal which building a storm will hit; they warn about the risk.
  Bots see only the forecast too (`--sight outcome` for the old behaviour).
- Seeds: the end screen shows the Seeds a run earns, kept with the Graft for Root City. The
  progression check (`scripts/progression.ts`) finds the ending comes at run 18 with these numbers
  (DECISIONS.md Q12).
- Graft tiers recalibrated: Sapling from 235, Heartwood from 360 (`scripts/calibrate-tiers.ts`).
- Playtest log: time, undos, cards and notes per season, with a Note button and a CSV download.
- DESIGN.md's season order is rewritten to match the simulation.
- Fixed: autosave waited until changes settled, so leaving the page just after an action could
  lose it. It now saves at once (then at most every 300 ms) and again when the page is hidden.

## Milestone 7: run structure

- Visions: a run starts with a choice of 2 of 3 goals (Restore the Reach, Lantern of the Valley,
  Thriving Commons), followed on the left as it progresses, with a card when achieved. Lantern now
  needs 30 citizens and Thriving Commons 50, because the design's numbers were met without trying
  (DECISIONS.md D2, D3).
- Eras: a stained-glass card announces each new era and what it brings; the top bar shows the era.
- The score replaces the provisional one: people, Harmony, wellbeing, loops, discoveries, the vision
  and finishing. It sets the Graft tier: Seedling, Sapling or Heartwood, with bands calibrated on
  the balance simulator.
- The end-of-run screen shows the score line by line and the tier, then offers the 2 districts that
  match how the run was played; the chosen Graft is kept for Root City.
- Saves: the run is saved as you play and resumed when you come back. Saves are versioned and
  checked before use. **New run** starts another.
- Simulation: the run's ledger (energy by source, food, people, industry), visions (`pickVision`),
  `scoreRun`, `graftOffer`, `makeSave` and `readSave`.
- The balance report has a run-end section: tiers, visions met, and the Graft offered.
- Faster map: the ground and the buildings are each drawn once into a texture and redrawn only
  when they change or the zoom settles. Frames under software rendering went from about 100 ms to
  17 ms.
- Fixed: a slow frame could jump over the night of a season's resolution, so the year strip never
  filled its night slot. Every phase passed is now announced, in order.

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
