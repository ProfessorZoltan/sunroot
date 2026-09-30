# Sunroot: game design and build plan

Sep 30, 2026 · @Eric

## Overview

Sunroot is a solarpunk settlement builder of short, replayable runs: each run heals one damaged region, and what it sends home grows a permanent city. It should be easy to learn, rewarding moment to moment, and deep for players who plan carefully, balance an economy and hunt for combos.

**Design pillars**

- **Readable depth.** Simple rules, small round numbers, every calculation visible on hover. Depth comes from how rules combine, not from how many there are.
- **Discovery is the reward.** Combos are layered from obvious (adjacency) to hidden (formations, landmarks), and every discovery is celebrated and recorded.
- **The world gets better, not just bigger.** Late-game play is about restoration, closed loops and a balanced grid, not sprawl.
- **Short runs, lasting growth.** Runs take 45 to 60 minutes. Every run, even a failed one, adds something permanent.
- **Hope without grimness.** Pressure comes from seasons, balance and planning puzzles, never from combat or punishment.

**Where it fits.** Existing solarpunk games are either cozy sandboxes that run out of goals or harsh survival builders that feel slow. Against the Storm shows a roguelite structure can make city building compulsively replayable. Sunroot combines that structure with a hopeful setting and makes combo discovery the center of the game.

| Game | What it does well | Where it falls short | Source |
| --- | --- | --- | --- |
| Solarpunk (Cyberwave, 2026) | Replaces combat with logistics: scarcity, weather, energy | Plateaus once you have an efficient setup; thin late game; aimless after the tutorial | [GameBrief](https://www.gamebrief.net/blog/solarpunk-review-2026), [Checkpoint](https://checkpointgaming.net/reviews/2026/06/solarpunk-review-what-about-this-overcrowded-land/) |
| Synergy (Leikir, 2025) | Distinctive look and biome synergy mechanics | Very slow pace; slow early game; exploration feels unrewarding | [3rd-strike](https://3rd-strike.com/synergy-review/), [Indie-Games.eu](https://www.indie-games.eu/synergy-gorgeous-city-builder-review/) |
| Terra Nil | Discovery and experimentation on a first playthrough | Each level has a solution you then repeat; low replayability | [Destructoid](https://www.destructoid.com/reviews/review-terra-nil-free-lives-devolver-pc/), [Gamepressure](https://www.gamepressure.com/editorials/reviews/terra-nil-review-reclaim-the-wasteland-at-your-own-pace/z0619) |
| Solaria (TeaHands, upcoming) | Minimalist, relaxing solarpunk hex builder | No wrong answers by design, so little depth | [Steam](https://store.steampowered.com/app/2744300/Solaria/) |
| Against the Storm | Random blueprint choices and short runs make it compulsively replayable | Tense and demanding, not cozy | [Frostilyte](https://frostilyte.ca/2024/01/24/against-the-storm-is-cool/), [The Back Blog](https://thebackblog.substack.com/p/games-about-making-things-and-the) |

**Name.** Sunward was rejected because several games already use it, including a colony builder released on Steam in July 2026 ([Steam](https://store.steampowered.com/app/4880930)). Sunroot came back clear in a search of Steam and itch.io; a trademark search is still needed.

## Game structure

The game alternates between a permanent home, **Root City**, and short runs called **Sprouts**. Each Sprout founds a settlement in a new region and ends by sending a **Graft**, a new district, back to Root City.

- **Root City:** the permanent hub. Districts planted there grant small perks and add new cards to future drafts.
- **Sprout (a run):** 12 in-game years of 4 seasons each, so 48 turns, about 45 to 60 minutes. Split into 4 eras of 3 years: Settle, Mend, Flourish, Bloom.
- **Graft:** the district a run sends home. Its type reflects how you played; its tier reflects your score.
- **World map:** a map of the whole region that visibly heals as runs are completed.

**Turns are seasons.** Play is turn-based: the player builds during a season, then ends it and watches it resolve. This is easier to learn than real time, rewards planning, and keeps the simulation deterministic and testable.

**Order of each season:**

1. Draft: pick 1 of 3 cards (a blueprint or a tuning).
2. Build: place buildings. Undo is free until the season ends.
3. The season's event happens (announced one season ahead).
4. Production: generators and producers yield.
5. Flexible consumers use spare energy in each slot.
6. Storage charges from what is still spare.
7. Demand is paid; storage discharges into shortfalls; blackouts shut buildings off by priority.
8. Food is eaten, population grows or shrinks, wellbeing updates.
9. Scraps and clutter update, then Harmony.
10. Combo discovery check: new chains, formations and evolutions are revealed and recorded.

**Ending a run.** A run ends after 48 seasons, or early if wellbeing reaches 0. The score sets the Graft tier, and every run earns Seeds.

## Economy and core rules

The economy runs on a small set of resources with round numbers, so players can do the math in their heads. All values below are first-pass and live in one tunable data file.

| Type | Resources |
| --- | --- |
| Energy | Tracked per slot: day and night in each season (8 slots a year) |
| Basics | Food, Biomass, Salvage |
| Made goods | Compost, Materials (the building currency), Knowledge |
| Settlement stats | Wellbeing (grows population), Harmony (multiplies yields) |
| Byproducts | Scraps, Heat, Clutter |

**Deliberate simplifications**

- **Water is not a tracked resource.** Proximity to water matters instead: farms more than 2 tiles from the river or a pond lose half their summer yield during the low-river event.
- **Scraps come from people.** Every 3 citizens make 1 scrap per season. Unprocessed scraps become clutter.
- **Workers:** each production building needs 1 worker. Energy, storage, water and nature buildings need none. Each citizen is one worker.

**Rules**

- **Food:** each citizen eats 1 per season. The Founders' Camp stores 40 and each cottage adds 5. Food beyond storage rots into scraps.
- **Harmony** = meadow tiles + 2 × woodland tiles + pollinator meadows − clutter. Yield multiplier: ×1.0 below 20, ×1.1 from 20 to 39, ×1.2 from 40 to 69, ×1.3 at 70 or above.
- **Land health:** tiles improve from barren to scrub to meadow to woodland through nurseries, orchards, pollinator meadows or spread compost (2 compost improves a tile one step).
- **Wellbeing** runs 0 to 100 and starts at 60. Per season: +1 if every need was met; −3 per unfed citizen; −2 per unpowered home; −1 per 5 clutter; +1 per cottage next to meadow or woodland; +3 per powered Commons Plaza.
- **Population:** at wellbeing 60 or above, with free housing and at least 2 spare food that season, +1 citizen (+2 at 80 or above). Below 20, one citizen leaves each season. At 0 the run ends.
- **Clutter** can be recycled: a workshop run turns 2 energy and 2 clutter into 1 material.
- **Blackouts:** a short slot shuts buildings off in a player-set priority order; homes shut off last by default.
- **Knowledge:** 2 rerolls the draft, 3 adds a 4th card, 5 reveals a hint for an undiscovered formation.
- **Rounding:** multipliers apply per building and round down.

**Starting state:** 20 materials, 12 food, 6 citizens housed in the Founders' Camp. The Camp produces 2 day and 2 night energy every season, forages 2 materials per season, and needs 2 heat at night in winter. Willow Reach starts at Harmony 18.

## Energy system

Each year has 8 energy slots, day and night in each of 4 seasons, and supply must meet demand in every slot. No single source can carry a settlement: each has its own timing, placement rule and side effect, and storage moves energy between slots.

**Supply** (day / night output per season)

| Source | Cost (materials) | Spring | Summer | Autumn | Winter | Per year | Rule or twist |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Founders' Camp | — | 2 / 2 | 2 / 2 | 2 / 2 | 2 / 2 | 16 | Present at start |
| Solar Canopy | 4 | 3 / 0 | 4 / 0 | 2 / 0 | 1 / 0 | 10 | −1 per slot when a tall neighbor shades it |
| River Wheel | 6 | 3 / 3 | 1 / 1 | 2 / 2 | 2 / 2 | 16 | River-adjacent; +1 per slot next to a weir |
| Wind Spire | 8 | 2 / 3 | 1 / 1 | 3 / 4 | 3 / 4 | 21 | Hills only; −1 per slot per other spire within 2 tiles; lowers nearby Harmony |
| Biogas Digester | 8 | player-assigned slot |  |  |  | up to 6 per season | Each run: 2 biomass or scraps → 3 energy + 1 compost; up to 2 runs per season |

Solar, wheel and wind each return about 2.5 energy per material per year. The choice is about timing and placement, never raw efficiency.

**Storage**

| Storage | Cost | Behavior |
| --- | --- | --- |
| Cell Bank | 5 | Stores up to 4 spare day energy; releases 3 that night |
| Heat Well | 6 | Stores up to 6 heat (1 energy → 1 heat); loses 1 per season; pays winter heat demand; a neighboring kiln charges it for free |
| Pumped Reservoir | 18 | From era 3; needs a hill next to the weir's reservoir; stores 12 across seasons; returns 3 of every 4 stored |

**Demand**

| Building | Needs |
| --- | --- |
| Founders' Camp | 2 heat at night in winter |
| Cottage | 1 energy at night every season; +1 heat in winter |
| Greenhouse | 2 energy by day; +1 heat in winter |
| Seedbank Library | 1 energy by day |
| Commons Plaza | 1 energy at night |
| Workshop, Kiln | Spare energy only: 2 per production run, up to 2 runs per season |

**Flexible consumers** ("sponges") only run on spare energy, and spare energy nothing uses is lost. **Mixed Grid bonus:** when 3 or more source types each supply at least 15% of a year's energy, storm and freeze events do no damage.

## First biome: Willow Reach

Willow Reach is a damaged river valley and the vertical slice: it teaches food, day/night energy, composting loops and land restoration. Its signature twist is the spring flood.

**Map.** About 120 hex tiles, generated from a seed. A river runs through the valley with floodplain on both banks and hills at the edges. Tile types: river, floodplain, hill, ruin (24 salvage each), barren, scrub, meadow, woodland. Tiles outside the playable area are drawn as fog.

**Seasonal events** (always announced one season ahead)

| Season | Event | Effect and tradeoff |
| --- | --- | --- |
| Spring | Flood | Floodplain farms gain +50% food in summer and autumn from silt. Buildings that aren't flood-tolerant are disabled for the season and cost 2 materials to repair. Levees block both the damage and the silt; a weir halves the flooded area. |
| Summer | Low river | River wheel output drops (see energy table); farms more than 2 tiles from water lose half their summer yield. |
| Autumn | Storms | Wind output rises; one exposed building on a hill is disabled for the season unless next to woodland (a windbreak). |
| Winter | Freeze | Solar is weak, homes need heat, wind is strong. |

Flood-tolerant buildings: farms, fish ponds, weirs, levees, pollinator meadows.

**Buildings** (energy and storage buildings are in the energy section; ★ = unlocked at the start of every run)

| Building | Cost | Workers | Placement | Output per season |
| --- | --- | --- | --- | --- |
| Floodplain Farm ★ | 3 | 1 | Floodplain, or meadow at −1 food | Food 2 / 4 / 5 / 0 (spring to winter); 1 biomass except winter |
| Orchard | 4 | 1 | Any land except floodplain | After 2 seasons: food 1 / 2 / 4 / 0, 1 biomass in autumn; turns its tile to meadow |
| Apiary | 3 | 1 | Anywhere | +1 food to each neighboring farm or orchard (max 3), spring to autumn; disabled next to a wind spire |
| Fish Pond | 4 | 1 | River-adjacent | Food 2 / 1 / 2 / 1 |
| Greenhouse | 7 | 1 | Anywhere | 3 food every season when powered |
| Composter ★ | 3 | 1 | Anywhere | Up to 3 scraps or biomass → 2 compost; neighboring food buildings +1 food while compost lasts |
| Salvage Yard ★ | 2 | 1 | Ruin | 3 salvage per season until the ruin is empty |
| Workshop ★ | 5 | 1 | Anywhere | Per run: 2 energy + 2 salvage → 3 materials, or 2 energy + 2 clutter → 1 material; max 2 runs |
| Kiln | 6 | 1 | River or floodplain adjacent | Per run: 2 energy → 2 materials + 1 heat to a neighboring heat well; max 2 runs |
| Cottage ★ | 4 | 0 | Anywhere | Houses 3; +5 food storage |
| Commons Plaza | 8 | 1 | Anywhere | +3 wellbeing when powered |
| Seedbank Library | 6 | 1 | Anywhere | 1 knowledge |
| Tree Nursery | 4 | 1 | Anywhere | Improves one neighboring tile one step |
| Pollinator Meadow | 1 | 0 | Anywhere | Tile becomes meadow; +1 Harmony; cancels neighboring wind spires' Harmony penalty |
| Weir | 10 | 0 | River | Halves flood area; 3 upstream tiles become reservoir; downstream fish ponds −1 food |
| Levee | 3 | 0 | River bank | Protects floodplain within 2 tiles from flood damage and from silt |

The five ★ buildings plus the Solar Canopy are unlocked at start; the other 17 of the biome's 23 buildings come through the draft.

**Year 1 walkthrough** (becomes a golden test in the build plan)

| Season | Build | Materials at end | Food at end | Citizens at end | What it teaches |
| --- | --- | --- | --- | --- | --- |
| Spring | Farm, Salvage Yard, Workshop, Solar Canopy | 11 | 8 | 6 | Solar powers the first workshop run; the flood leaves silt on the new farm |
| Summer | 2nd farm, Cottage | 12 | 12 | 7 | The silt-boosted farm makes 6 food; 2 clutter appears from scraps |
| Autumn | Composter, Orchard | 10 | 19 | 8 | The kitchen loop closes: +2 food, clutter stops growing |
| Winter | River Wheel | 12 | 11 | 8 | Heating creates a 2-energy night shortfall; the wheel fixes it and leaves spare day energy for 2 workshop runs |

The winter choice is real: a Cell Bank also covers the shortfall for 5 materials but uses the workshop's spare day energy, ending the year at 7 materials instead of 12.

## Choices and combos

Every season offers one small choice, and combos are layered from obvious to hidden so discovery keeps paying off for the whole run.

**Choices**

- **Draft:** each season, pick 1 of 3 cards drawn from the blueprint pool and the tuning pool. Blueprints unlock a building type; tunings are small upgrades that last the rest of the run. Some blueprints are gated by era (the Pumped Reservoir appears from era 3).
- **Tunings** (examples): *Deep Roots* (orchards produce after 1 season), *Mirror Film* (solar canopies +1 in winter), *Night Shift* (workshops get a 3rd run on night energy only), *Silt Traps* (levees let half the silt boost through), *Hive Mind* (apiaries reach 2 tiles).
- **Charters:** pick 1 of 3 at the start of eras 2, 3 and 4. Examples: *Repair Culture* (salvage ×2, workshops make no clutter), *River Keepers* (no flood damage, fish +1), *Night Market* (+2 wellbeing when every night slot is powered), *Seed Savers* (4 draft cards instead of 3), *Slow Power* (flexible consumers +50%).
- **Visions:** pick 1 of 2 run goals at the start. Examples: *Restore the Reach* (60% of land is meadow or woodland), *Lantern of the Valley* (no shortfall in any slot for a full year), *Thriving Commons* (40 citizens at wellbeing 70 or more).

**The five combo layers**

1. **Adjacency** — shown in the placement preview before you build. Apiary next to farms (+1 food each); pollinator meadow next to a wind spire (cancels its Harmony penalty); kiln next to a heat well (free charging); cottage next to green land (+1 wellbeing).
2. **Chains** — closing a full loop earns a lasting bonus (+1 on each building in the loop). *Kitchen Loop:* farm → scraps → composter → compost → farm. *Gas Loop:* farm biomass → digester → night power, digestate back to farms. *River Loop:* fish pond → nutrient water → greenhouse → biomass → digester.
3. **Formations** — hidden shapes, revealed on discovery and recorded in the Almanac. *Village Green:* a Commons Plaza ringed by 6 buildings of at least 3 types (wellbeing aura). *Sun Terrace:* 3 solar canopies in a row on a hillside (no self-shading, +1 each). *Mill Race:* weir, river wheel and workshop in a row along the river (the workshop needs no power). *Wildway:* an unbroken strip of meadow and woodland from the river to the map edge (Harmony surge; animals return).
4. **Evolutions** — a building transforms because of its neighbors. Greenhouse next to a heat well → *Winter Garden* (full winter food). Solar canopy on a farm → *Agrivoltaic Field* (−1 food, +3 day energy in summer, ignores low river). Exhausted salvage yard → *Rewilded Ruin* (+2 Harmony). Cottage next to 2 woodland tiles → *Treehouse Commons* (+2 wellbeing).
5. **Charters and tunings** — rule changes that make some combos stronger, so each run favors a different build.

**The Almanac** lists every combo per biome. Undiscovered entries show as silhouettes; Knowledge buys hints. Discoveries persist across runs.

## Root City and progression

Progress between runs mostly adds variety, not power, so runs stay a test of skill. The ending comes after roughly 20 to 25 runs, and Tempest levels keep going after that.

**Between runs** (1 to 2 minutes)

1. **Place the Graft** in Root City.
2. **Spend Seeds** to raise a district's tier.
3. **Choose the next expedition** from 3 options, each showing a region, a twist (for example *Drought Year*: harsher summers, Graft one tier higher) and an optional city request (for example "close 3 loops") worth bonus Seeds.

**City layout.** The Heartwood sits at the center, ringed by hex district slots: 6 in the first ring, 12 in the second. Filling both rings and growing the Heartwood into the **Sun Tree** is the ending.

**Grafts.** At the end of a run the game reads the run's signature (energy mix, food sources, Harmony, industry), offers 2 matching districts and the player picks one. The score sets the tier: Seedling, Sapling or Heartwood.

| District | Earned by | Perk (Seedling → Sapling → Heartwood) | Adds to future drafts |
| --- | --- | --- | --- |
| Millrace Quarter | Hydro-heavy runs | River wheels cost 5 → 4 → 3 | *Spillway* tuning (weirs don't hurt fish) |
| Orchard Ward | Food-heavy runs | Start with +6 → +10 → +15 food | *Cider Press* blueprint (orchard surplus → wellbeing) |
| Mended Commons | Harmony-heavy runs | Start with +4 → +8 → +12 Harmony | *Rewilders* charter |
| Tidal Quarter | Coastal runs | 4 draft cards in the first season of each era | *Tide Mill* blueprint |
| Foundry District | Industry-heavy runs | Workshops get 1 extra run in year 1 | *Kiln Loop* tuning |

**Landmarks** are hidden combos between neighboring districts. *Cider Mill* (Millrace Quarter + Orchard Ward): orchards produce one season sooner. *Heartwood Grove* (Mended Commons + 3 green districts): the Wildway formation needs one fewer tile. *Estuary Works* (Tidal Quarter + Millrace Quarter): unlocks a hybrid tide-and-river generator.

**Teaching across runs**

| Run | New system |
| --- | --- |
| 1 | Blueprints only, with the guided first year |
| 2 | Tunings join the draft |
| 3 | Charters at each new era |
| 4 | Vision choice at the start |
| 5+ | Windswept Coast biome (tidal, wind, storms) |

Later biomes: Highland after 4 districts, Sun Desert after 8, Volcanic Isle after the first Landmark.

**Tempest levels 1 to 10** unlock per biome after a Heartwood-tier Graft there. Each level adds one lasting hardship (longer winters, 2 draft cards, faster clutter) and raises Graft quality.

**Guardrails:** every run earns something; perks are capped at about 15% of a run's power; the next unlock is always visible; unlocks come from playing differently, not from repetition alone.

## Look, feel and sound

The world is sunlit papercraft; special moments (draft cards, charters, discoveries, the Almanac) are Art Nouveau stained glass. See the [Willow Reach screen mockup](https://claude.ai/artifact/V1NTok1xFJnWguCpCEgcpK) for layout and palette.

**Why papercraft.** Everything is flat layered shapes with offset shadows, so it can be drawn entirely in code from day one. The mockup's map was generated this way. Hand-made art can replace it later without changing the game.

**Palette and type**

| Role | Values |
| --- | --- |
| Paper ground and panels | #F4EBD6, #FBF5E6; ink #2F3B2E, quiet text #5E6B58 |
| Land | barren #DCCBA6, scrub #CDD196, meadow #B3CD8F, woodland #94B780, floodplain #C9DA8C, hill #C8BF96, river #8FC3D1 |
| Accents | sun gold #F2C14E, leading gold #D9A441, terracotta #D98C5F, solar teal #2F5E63 |
| Stained glass | ground #1E4744, jewel tones #2E8B6A, #3A6EA5, #E0A33B, #B85C6E, text #F6EEDB |
| Type | Fraunces for display, Nunito for UI text |

**Signature visuals**

- **The sun moves and shadows are real.** During each season's resolution the sun crosses the map and casts the shadows the shade rule uses.
- **The land heals visibly.** Barren tiles start faded; restored tiles gain color and layered detail.
- **Wildlife returns** as Harmony tiers rise: birds first, then deer and otters.
- **Seasons repaint the map:** the spring flood spreads across the floodplain and leaves glittering silt; winter brings snow and lit windows.

**Feedback that makes it rewarding**

- **Placement preview:** a ghost building with floating +/− numbers; vines grow between tiles that would form a combo.
- **Season resolution (about 5 seconds):** the sun sweeps from dawn to night, energy flows as light into buildings, the year strip fills slot by slot, completed loops glow.
- **Discovery:** a stained-glass card unfolds with a chime and files itself into the Almanac.

**Screen layout:** year strip of 8 energy slots across the top (sun and moon icons, patterns for shortfalls); stores, loops and charter on the left; map in the center; draft cards on the right; forecast, undo, Almanac and End season along the bottom.

**Sound:** each building type plays a note when placed and combos play chords. The soundtrack adds an instrument layer at each Harmony tier, so a thriving valley sounds fuller.

**Accessibility:** colorblind-safe palette with icons and patterns (never color alone), reduced motion, text scaling, remappable keys, and a Calm mode with no failure.

## Technical architecture

Build Sunroot as a TypeScript web game around a pure simulation core, so the same rules drive the game, the tests and the balance simulator. The web stack suits iterative work with Claude Code and can be packaged for Steam later.

&#91;embedded content: Sunroot architecture · one simulation core, three consumers\]

The game client never changes state directly: it sends commands (place, pick a card, end season) and draws whatever state comes back.

| Layer | Choice | Why |
| --- | --- | --- |
| Language and build | TypeScript, Vite | Fast iteration; one language for game, tests and tools |
| Simulation | Plain TypeScript module, seeded random generator | Deterministic, testable, runs headless in Node |
| Content | JSON or TS data files validated with Zod | Balance changes without code changes |
| Map rendering | PixiJS (2D WebGL) | Handles hundreds of layered shapes and animation smoothly |
| Interface | Preact with CSS | Light, familiar component model for the HUD and menus |
| Audio | Web Audio (via Howler.js) | Layered music and per-building notes |
| Saves | IndexedDB with versioned save files | Survives reloads; saves are serialized simulation state |
| Tests | Vitest | Unit tests plus the Year 1 golden test |
| Desktop release | Tauri, later | Wraps the web build for Steam without a rewrite |

Alternative: Godot also fits a 2D builder, but a headless simulator and fast test loops are simpler in TypeScript.

## Build plan for Claude Code

Build the simulation first and headless, prove it with tests and a balance simulator, then add rendering, feel and the meta layer. Milestones 0 to 7 make a complete playable Willow Reach run: the vertical slice to playtest before anything else.

**Milestones**

0. **Project setup.** Repo, TypeScript, Vite, Vitest, linting, CI. *Done when:* tests run in CI and a blank page renders.
1. **Simulation core (headless).** Hex grid, seeded map generation, tiles, buildings as data, the 10-step season order, energy slots, food, population, wellbeing, Harmony, clutter, flood and other events, the draft. *Done when:* a golden test reproduces the Year 1 walkthrough table exactly, including the Cell Bank alternative, and the same seed always gives the same run.
2. **Balance simulator.** A command-line tool that plays thousands of runs with simple bot strategies (greedy food, greedy energy, random) and reports score spread, most-picked cards, idle seasons and blackouts. *Done when:* one command writes a CSV and a short report, and the build plan's balance questions can be answered from it.
3. **Map rendering.** Procedural papercraft tiles and buildings, pan and zoom, hover, placement preview with ghost and +/− numbers, free undo. *Done when:* the map matches the mockup's look and every building is placeable with correct rules.
4. **Interface.** Year strip, stores, loops, draft cards, tooltips that show the full math, forecast, End season. *Done when:* a full run can be played to the end with mouse and keyboard.
5. **Season resolution and feel.** Sun sweep and real shadows, energy flow, number pops, loop glow. *Done when:* each season resolves in about 5 seconds and can be skipped.
6. **Combos and the Almanac.** Adjacency, chains, formations, evolutions, tunings, charters; the Almanac screen with silhouettes and hints. *Done when:* every combo in this doc triggers in a unit test and reveals with its stained-glass card.
7. **Run structure.** Eras, visions, scoring, the end-of-run screen, Graft offer. *Done when:* the vertical slice is complete and saved runs can be resumed.
8. **Root City.** City screen, district placement, landmarks, Seeds, expedition choice, teaching across runs, save and load. *Done when:* 5 runs in a row play through with progression kept.
9. **Audio.** Building notes, combo chords, Harmony layers.
10. **Accessibility and settings.** Colorblind palette, reduced motion, text size, key remapping, Calm mode.
11. **Second biome.** Windswept Coast with tidal power, storms and its own Grafts, reusing the same systems.

**Working rules for Claude Code**

- The simulation is a pure, deterministic module: no rendering, no clock, one seeded random generator. The renderer only reads state and sends player commands.
- All content (buildings, events, cards, combos, numbers) lives in data files validated at load. Balance changes never touch code.
- Every rule change comes with a test; the Year 1 golden test must always pass.
- Art is procedural. No hand-drawn assets until the slice is fun.
- Commit at each milestone. Keep a DECISIONS.md for any rule this doc leaves open, and a CHANGELOG.
- When this doc and the code disagree, raise it rather than guess.

**Kickoff prompt** (paste into Claude Code with this doc exported as Markdown to `docs/DESIGN.md`)

```text
Read docs/DESIGN.md. It is the design for Sunroot, a solarpunk settlement builder.
Build it milestone by milestone, starting with Milestone 0 and 1 only.
Follow the Technical architecture and Working rules sections exactly.
In Milestone 1, write the Year 1 walkthrough as a golden test first, then build the
simulation until it passes. Record any rule the doc leaves open in docs/DECISIONS.md
with the choice you made. Stop after Milestone 1 and summarize what you built,
what you decided, and what you would change in the design.
```

## Open questions and risks

The biggest risk is balance: the numbers are hand-set, so the balance simulator in Milestone 2 has to prove the economy works before content is added.

**Open questions**

- [ ] Scoring formula at the end of a run, and the score bands for Seedling, Sapling and Heartwood.
- [ ] Exact Seed rewards per run and district upgrade costs.
- [ ] Is food too easy after Year 1? The simulator should check whether farms outpace population.
- [ ] Does any single energy source dominate once tunings stack?
- [ ] Numbers for the Windswept Coast and later biomes.
- [ ] Platform and price: web and Steam desktop first; mobile later or never.
- [ ] Trademark search on the name Sunroot.
- [ ] When to commission hand-made art, if at all.

**Risks and mitigations**

| Risk | Mitigation |
| --- | --- |
| One dominant strategy makes runs samey | Simulator reports most-picked cards and winning builds; tune data files |
| Too many systems for new players | Teaching across runs; tooltips that show the math; Calm mode |
| Runs feel long in the middle | Keep era goals and charter picks every 3 years; watch idle seasons in the simulator |
| Meta perks trivialize runs | Cap perks at about 15% of a run's power; variety over power |
| Procedural art looks plain | Invest in lighting, shadows and seasonal repainting before any hand-made art |
