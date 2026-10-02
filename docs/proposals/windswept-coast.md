# Proposal: the Windswept Coast (Milestone 11)

The second biome, for review before any code. DESIGN.md names it ("tidal power, wind, storms",
run 5 on), its district (the Tidal Quarter) and its landmark (Estuary Works), and leaves its
numbers open. Everything else here is a proposal: the designer's defaults until the bots and
playtesting tune them. Later biomes (Highland, Sun Desert, Volcanic Isle) are sketched at the end
so the foundation work serves them too.

## What makes it different

Willow Reach teaches food, day and night energy, loops and healing land around a river that
floods once a year. The coast keeps every system and changes the pressures:

| Willow Reach                          | Windswept Coast                                                                | Source                        |
| ------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------- |
| A river: steady water, a spring flood | The sea: the tide is steady energy; a king tide brings salt, not silt          | DESIGN.md (tidal power); new  |
| Fresh water is easy                   | Fresh water is scarce: a small stream, wells, and desalination on spare energy | EXPANSION.md (Desalinator)    |
| Storms hit one building on a hill     | Gales hit two, and anything offshore; wind is strong all year                  | DESIGN.md (wind, storms); new |
| Solar is the first source             | Summer sea fog dims solar; the tide gives night energy from the start          | New                           |
| Farms on floodplain                   | Crofts on machair (sandy grassland); food from the sea (kelp, oysters)         | New                           |

The coast's signature choice: **build on the shore and harvest the sea, or keep back from the
water**. The low ground is rich and tidal but salts in the king tide; the headlands are windy and
exposed to gales; the dunes behind the beach are poor until planted.

## Map

About 120 hex tiles, from a seed. The sea fills one side of the map (3 to 4 columns), with a
band of mudflat (tidal) and saltmarsh along the shore; dunes behind the beach; machair and scrub
inland; 2 or 3 headlands (rocky, high, windy) reaching into the sea; a short stream from the
inland edge to the sea, its mouth an estuary of mudflat; 2 to 3 ruins (an old harbour).

| Tile                                           | Like (Willow Reach) | Buildable                     | Notes                                                                            | Source |
| ---------------------------------------------- | ------------------- | ----------------------------- | -------------------------------------------------------------------------------- | ------ |
| Sea                                            | River               | Sea buildings only            | Water, not drinkable. Deep sea (away from land) for wave buoys.                  | New    |
| Mudflat                                        | Floodplain          | Tidal buildings, crofts at −1 | Covered at high tide; the king tide salts what stands on it.                     | New    |
| Saltmarsh                                      | Floodplain          | Most land buildings           | Rich, low; reached by the king tide beyond the mudflat.                          | New    |
| Dune                                           | Barren              | Most land buildings           | Poor sand; dune grass turns it to scrub. On the land-health ladder below barren. | New    |
| Headland                                       | Hill                | As hills                      | Windy; exposed to gales (as hills to storms).                                    | New    |
| Stream                                         | River               | As river                      | Flow 6 (the Reach's river is 12); the only fresh surface water.                  | New    |
| Ruin, scrub, meadow (machair), woodland (pine) | The same            | The same                      | Machair is the coast's meadow, shown with its own name.                          | New    |

Land-health ladder on the coast: dune → barren → scrub → meadow → woodland.

## Seasonal events

| Season | Event     | Effect                                                                                                                                                                                                                                                                        | Source                  |
| ------ | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Spring | King tide | Mudflat and the lowest saltmarsh flood with salt water: buildings there that aren't salt-tolerant are disabled for the season (repairs as floods); crofts there are **salted**: half food for 2 seasons, instead of the Reach's silt bonus. Sea walls stop it within 2 tiles. | New                     |
| Summer | Sea fog   | Solar −1 per canopy in both slots; cisterns and fog nets catch 1 water each.                                                                                                                                                                                                  | New                     |
| Autumn | Gale      | Wind +1; **2** exposed buildings (headland or offshore) are disabled for the season unless sheltered (pine woodland or a dune line beside them); the strandline brings 3 salvage to each beachcombing yard.                                                                   | DESIGN.md (storms); new |
| Winter | Freeze    | As the Reach, a little milder: homes need 1 heat less at night.                                                                                                                                                                                                               | New                     |

## Energy

Tides run on the moon, not the sun: the tide gives the same in the day and the night slot, more
at the spring and autumn spring tides, less at summer and winter neaps.

| Source          | Cost | Placement                         | Day (spring to winter)   | Night                  | Notes                                                                                               | Source                         |
| --------------- | ---- | --------------------------------- | ------------------------ | ---------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------ |
| Tide Turbine ★  | 6    | Sea next to mudflat or a headland | 2 / 1 / 2 / 1            | 2 / 1 / 2 / 1          | The coast's starter: night energy from the first season.                                            | DESIGN.md (tidal power); new   |
| Wave Buoy       | 7    | Deep sea                          | 1 / 1 / 2 / 2            | 1 / 1 / 2 / 3          | Strong in autumn and winter; gale-exposed.                                                          | New                            |
| Solar Canopy ★  | 4    | As the Reach                      | Reach −1 in summer (fog) | —                      | Shared.                                                                                             | DESIGN.md                      |
| Wind Spire      | 8    | As the Reach; best on headlands   | Reach +1 on a headland   | Reach +1 on a headland | Shared; headland bonus.                                                                             | New                            |
| Tide Mill       | 8    | Mudflat next to sea               | —                        | —                      | Fills at high tide: stores 3 energy a season and gives it in either slot. The Tidal Quarter's card. | DESIGN.md (Tidal Quarter); new |
| Estuary Turbine | 9    | The stream's mouth                | Tide + stream            | Tide + stream          | The Estuary Works landmark's hybrid tide-and-river generator.                                       | DESIGN.md (Estuary Works)      |

Shared from the Reach: Cell Bank, Heat Pump (it draws from the sea), Air-source Heat Pump, Biogas
Digester, Heat Well, Solar Thermal Collector.

## Buildings

★ = unlocked at the start of every coast run. Shared buildings keep the Reach's numbers unless
noted.

| Building            | Cost | Workers | Placement                           | Output per season (spring to winter)                                              | Source       |
| ------------------- | ---- | ------- | ----------------------------------- | --------------------------------------------------------------------------------- | ------------ |
| Croft ★             | 3    | 1       | Machair or saltmarsh; mudflat at −1 | Food 2 / 3 / 4 / 0; 1 biomass except winter                                       | New          |
| Kelp Farm           | 4    | 1       | Sea next to land                    | Food 1 / 2 / 2 / 1; biomass 1 / 2 / 2 / 0; gale-exposed                           | New          |
| Oyster Reef         | 4    | 0       | Mudflat                             | Food 1 / 1 / 2 / 1; cleans 2 grey water; salt-tolerant                            | New          |
| Beachcombing Yard ★ | 2    | 1       | Beach (dune next to sea) or ruin    | 2 salvage; +3 after a gale                                                        | New          |
| Dune Grass          | 1    | 0       | Dune                                | Turns its tile to scrub after 2 seasons; +1 Harmony                               | New          |
| Sea Wall            | 4    | 0       | Saltmarsh or mudflat next to sea    | Keeps the king tide (damage and salt) off tiles within 2                          | New          |
| Desalinator         | 7    | 1       | Next to sea                         | Spare energy: 2 energy → 2 clean water into its channel                           | EXPANSION.md |
| Lighthouse          | 9    | 1       | Headland                            | +3 wellbeing when powered at night; gale-exposed buildings within 2 are sheltered | New          |
| Smokehouse          | 6    | 1       | Anywhere                            | Takes 1 heat a season: +10 food storage, and food doesn't rot                     | New          |

Shared, as the Reach: Cottage ★, Composter ★, Workshop ★, Salvage Yard, Kiln, Greenhouse, Apiary,
Commons Plaza, Seedbank Library, Tree Nursery (pines), Pollinator Meadow, Irrigation Channel ★,
Well ★, Cistern, Reed Bed, Bathhouse, Fish Pond (by the stream), River Wheel (on the stream, at
half its Reach output), Cider Press. Not on the coast: Weir, Levee, Rice-fish Paddy, Orchard (salt
wind), and their evolutions.

That is about 28 placeable buildings, as the Reach after v2.

## Combos

| Layer     | Combo            | How                                                                    | Effect                                                       | Source                          |
| --------- | ---------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------- |
| Adjacency | Shellfish beds   | Oyster reef next to a kelp farm                                        | +1 food each                                                 | New                             |
| Adjacency | Lee of the dunes | A building next to dune grass                                          | Not gale-exposed                                             | New                             |
| Chain     | Kelp Loop        | Kelp farm → biomass → composter → compost → croft                      | +1 on each building in the loop                              | New                             |
| Chain     | Sweetwater Loop  | Tide turbine → spare night energy → desalinator → water → greenhouse   | +1 food on the greenhouse, +1 water                          | EXPANSION.md (Desalinator); new |
| Chain     | Shore Loop       | Bathhouse → grey water → oyster reef → nutrient-rich water → kelp farm | +1 food on the kelp farm, +1 Harmony                         | New                             |
| Formation | Breakwater       | 3 sea walls in an unbroken line                                        | The king tide doesn't reach anything behind them; +1 Harmony | New                             |
| Formation | Dune Line        | 4 dune grass in an unbroken line                                       | Nothing within 2 tiles inland is gale-exposed                | New                             |
| Formation | Wind Ridge       | 3 wind spires in a row on headlands                                    | +1 energy each, no Harmony penalty                           | New                             |
| Evolution | Machair Croft    | Croft next to 2 dune grass                                             | +1 food; not salted by the king tide                         | New                             |
| Evolution | Kelp Forest      | Kelp farm next to 2 oyster reefs                                       | +1 food, +1 Harmony; gale-proof                              | New                             |
| Evolution | Rock Pool        | Exhausted salvage yard next to the sea                                 | +2 Harmony, +1 food                                          | New                             |

Tunings and charters: about 8 coast tunings (Deeper Fins: tide turbines +1 in summer; Salt Cure:
salted crofts lose a third, not half; Storm Lashing: wave buoys gale-proof…) and 2 coast charters
(Shore Keepers: no king-tide damage, oysters +1; Sea Lanes: 4 draft cards in era 1) join the shared
pool. Refinements as the Reach's, for the coast's buildings.

## Wonder, wildlife and festivals

| System    | Coast                                                                                                                                                                                                                                                      | Source                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Wonder    | **The Tidal Lagoon**: a 7-hex flower on mudflat and the sea's edge, 4 seasons, needs a closed Kelp Loop and 3 oyster reefs; finished: +2 energy in each slot, +60 score, the Graft a tier higher, meets the Bloom era goal.                                | EXPANSION.md (one wonder per biome); new |
| Wildlife  | Terns (Harmony 20, dunes: crofts next to 2 dune tiles +1 food in summer); seals (40, mudflat next to an oyster reef: kelp farms within 2 +1 food); puffins (50, headlands: lighthouse +1 wellbeing); dolphins (70, sea groups of 6: +1 wellbeing per pod). | E4's pattern; new                        |
| Festivals | Kite Day (spring, 5 materials: +3 wellbeing, wind +1 that season); Harvest of the Sea (autumn, 10 food: +5 wellbeing and a free reroll); Lantern Night (winter, as the Reach).                                                                             | E4's pattern; new                        |

## Root City, regions and twists

| Item            | Proposal                                                                                                                                                                                                                                                            | Source                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Joins           | From run 5 (as DESIGN.md's table): expeditions then offer either biome. A city already past run 5 gets the coast at once.                                                                                                                                           | DESIGN.md, Teaching across runs |
| First coast run | A guided first season: the tide, the king tide's salt, fresh water.                                                                                                                                                                                                 | New                             |
| Tidal Quarter   | Earned by coastal runs (its signature: tidal and wave share of energy). Perk 4 draft cards in the first season of each era, at every tier. Adds the **Tide Mill** blueprint to future coast drafts.                                                                 | DESIGN.md, Grafts               |
| Estuary Works   | Tidal Quarter next to the Millrace Quarter: the **Estuary Turbine** in coast runs.                                                                                                                                                                                  | DESIGN.md, Landmarks            |
| Other districts | Work on the coast as in the Reach where they can (Orchard Ward's food, Mended Commons' Harmony, the Foundry's workshop run, the Millrace Quarter's cheaper wheels on the stream); a card a biome can't use (the Spillway, for weirs) isn't offered there.           | New                             |
| Regions         | The Coast as it is; Shingle Spit (narrow land, more sea); Saltmarsh Estuary (a wide stream mouth, more mudflat); Sea Cliffs (more headland, a high Graft); Drowned Harbour (more ruins, more salvage).                                                              | New                             |
| Twists          | The shared ones that make sense (Lean Start, Big Families, Scavengers, Steady Winds, Long Winter…) and three of its own: Big Tides (the king tide reaches a ring further; tide +1), Becalmed (wind −1 all year; Graft a tier higher), Fogbound (solar −1 all year). | New                             |
| Tempest         | Per biome, as DESIGN.md: the coast's levels unlock after a Heartwood Graft there; the same 10 hardships.                                                                                                                                                            | DESIGN.md                       |
| Score tiers     | Shared with the Reach; the coast's bots should reach Heartwood about as often as the Reach's (a coast score line if not, as with the layers).                                                                                                                       | New                             |

## Year 1 walkthrough (to become the coast's golden test)

A proposal to check against the simulation once it exists; the build plan reviews it before it
becomes the reference, as the Reach's v2 walkthrough was.

| Season | Build                                                       | What it teaches                                                                                                 | Source |
| ------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------ |
| Spring | Croft on machair, Beachcombing Yard, Workshop, Tide Turbine | The tide powers the workshop by day and the camp by night; the king tide is coming: crofts kept off the mudflat | New    |
| Summer | 2nd croft, Cottage, Well                                    | Fog dims solar, so the tide carries the day; fresh water is a walk away                                         | New    |
| Autumn | Composter, Dune Grass                                       | The gale hits two exposed buildings; dune grass starts the lee                                                  | New    |
| Winter | Kelp Farm                                                   | Food from the sea all winter, when crofts rest                                                                  | New    |

## Build plan

Each step ends with tests and a commit; the Reach plays exactly as before throughout (its golden
tests unchanged).

| Step | What                                                                                                                                                                                                                                    | Done when                                                                                             | Source                  |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------- |
| B1   | **Biomes foundation.** Split the content: Root City, progression and shared cards in one file, each biome in its own. Tile types and events become per-biome data; a run names its biome; saves, the Almanac and Tempest are per biome. | Willow Reach plays and saves exactly as before; a second, empty test biome loads beside it.           | New                     |
| B2   | **Coast simulation.** Its map generator, tiles, tide, king tide and salt, fog, gale, its buildings, the stream.                                                                                                                         | Every new rule has a unit test; the Year 1 walkthrough above is proposed as a golden test for review. | DESIGN.md, Milestone 11 |
| B3   | **Coast combos and balance.** Its combos, tunings, charters, the Almanac; bots that play the coast.                                                                                                                                     | Every combo triggers in a unit test; the bots' Heartwood share is within 10 points of the Reach's.    | New                     |
| B4   | **Coast on screen.** Procedural tiles and buildings; the tide rising and falling with day and night; salt marks; a hand-art request in ART-EXPANSION.md's style.                                                                        | A coast run plays to the end with mouse and keyboard.                                                 | New                     |
| B5   | **Coast in Root City.** Unlocks at run 5; expeditions offer a biome; the Tidal Quarter, Estuary Works, regions, twists, Tempest.                                                                                                        | Runs alternate biomes with progression kept (an e2e of runs 5 and 6).                                 | DESIGN.md, Milestone 8  |
| B6   | **Wonder, wildlife, festivals.** The Tidal Lagoon, the coast's animals and festivals.                                                                                                                                                   | As E4 and E5.                                                                                         | EXPANSION.md            |

## Later biomes (sketch)

The foundation (B1) should make these content plus a map generator each, with few new rules.

| Biome         | Unlocks                  | Signature                                                                       | Reserved buildings                           | Source                                |
| ------------- | ------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------- |
| Highland      | After 4 districts        | Cold and steep: heat is the point; snow cuts solar; water must be pumped uphill | Pump Station, Biochar Kiln (the Carbon Loop) | DESIGN.md; EXPANSION.md               |
| Sun Desert    | After 8 districts        | Too much sun, too little water: fog nets and oases; cooling, not heating        | Concentrated Solar Plant, Fog Net            | DESIGN.md; EXPANSION.md; DECISIONS.md |
| Volcanic Isle | After the first landmark | Geothermal heat and power, fertile ash, an eruption that resets part of the map | (to design)                                  | DESIGN.md                             |

## Questions for review

1. **The coast's hazard.** The king tide salts crofts (half food for 2 seasons) where the Reach's
   flood enriches them. Is a penalty-only spring event the right feel, or should salt marsh gain
   something too (for example, saltmarsh crofts +1 food after the salt clears)?
2. **The Tide Mill.** DESIGN.md makes it the Tidal Quarter's card, so it can't be the coast's main
   tidal source (the first coast run has no Tidal Quarter). This proposal adds a Tide Turbine as the
   starter and makes the Tide Mill a tide-filled store. Agreed?
3. **When it joins.** Run 5, as DESIGN.md says, or after the first Heartwood Graft (so a player
   who is still learning the Reach isn't moved on)?
4. **Art.** Procedural first (as the Reach began), with a hand-art request written alongside B4?
