# Proposal: the Sun Desert (Milestone 13)

The fourth biome, reviewed by the playtester (see Decided in review). DESIGN.md names it ("Sun Desert after 8
districts") and gives its signature in the coast's sketch of later biomes: too much sun, too
little water, fog nets and oases, cooling rather than heating. The water expansion reserved two
of its buildings: the **Fog Net** (clean water with no river) and a solar heat building, which the
playtester made the **Concentrated Solar Plant**: mirrors focusing the sun for both electricity
and heat (DECISIONS.md, Water expansion). Everything else here is a
proposal: the designer's defaults until the bots and playtesting tune them.

It builds on what the earlier biomes left: biome content and map generators (B1), Root City's
biome offers and Tempest per biome (B5), local heat (H1, H2), water with cisterns, wells and walks (E1, W1), and the
Highland's lessons: Check the wonder fits on real maps, give
the land a steady source of materials, and propose a Year 1 the numbers can pay for.

## What makes it different

Willow Reach is wet, the coast salty, the Highland steep and cold. The Sun Desert is **bright and
dry**. Its new rule is **cooling**: on hot days homes need cooling, as on cold nights they need
heat, and the cheapest cooling is built in (thick walls, wind towers, shade), not bought with
energy.

| Willow Reach                   | Sun Desert                                                                                                        | Source                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| A river all year               | A thin river that runs high in the spring flash flood and dries up in summer; an oasis spring, wells and fog nets | Playtester; DESIGN.md; EXPANSION.md |
| Water reaches farms by channel | Channels lose water to the sun in every season but winter; a qanat (an underground channel) loses none            | EXPANSION.md (water); new           |
| Heat is a winter cost          | Cooling is a summer cost: homes need cooling on hot days, and heat only on winter nights (cold desert nights)     | DESIGN.md; new                      |
| Solar is the first source      | Solar is strong and plentiful, but night energy is scarce: no river wheel, little biomass                         | DESIGN.md                           |
| Storms damage buildings        | Dust storms dim the panels and mirrors and bury what they reach, unless a palm windbreak shelters it              | DESIGN.md (storms); new             |

The desert's signature choice: **sun by day, nothing by night**. Energy is easy at noon and
scarce after dark, water is scarce always, so the run is about storing the day for the night
(the Concentrated Solar Plant's salt tank, cell banks, the sand battery) and spending water
where it goes furthest.

## Cooling

A mirror of heat (H1, H2), so it reuses that machinery: a need on homes in the day slots, met by
cooling sources within 2 tiles, or by grid energy at 2 for 1 (an air conditioner).

| Rule              | Effect                                                                                                                                                                                                                                                                                                                      | Source             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ |
| The need          | Each home needs 1 cooling on summer days, 2 in a heatwave. Spring and autumn days need none (a Scorching Year twist adds them).                                                                                                                                                                                             | New                |
| Passive cooling   | A Wind Tower cools homes within 2 (2 cooling a day slot, 3 beside a cistern or pool). Shade beside a home (a palm windbreak along its edge, an oasis garden next to it) takes 1 off.                                                                                                                                        | New                |
| Cooling from heat | An Absorption Chiller turns heat into cooling, 1 heat for 1 cooling, up to 2 a slot, for homes within 2. Its heat comes from heat sources within 2 (solar thermal collectors, the Concentrated Solar Plant's mirrors), and only heat no building needs for warmth that slot. It pays after wind towers and before the grid. | Playtester         |
| Thick walls       | The Mud-brick House needs no cooling except in a heatwave, and no heat on winter nights (its walls keep the day's warmth).                                                                                                                                                                                                  | New                |
| Grid cooling      | Spare day energy cools a home at 2 energy for 1 cooling, as the grid's heat in the Highland.                                                                                                                                                                                                                                | DECISIONS.md (Q18) |
| A hot home        | A home whose cooling isn't met counts as a cold home does (the same wellbeing line), so the existing interface and bots carry over.                                                                                                                                                                                         | DECISIONS.md (H2)  |
| Cold nights       | Winter nights: homes need 1 heat, as the Reach's cottages; heat sources work as everywhere.                                                                                                                                                                                                                                 | DESIGN.md          |
| Other biomes      | Inert: no building elsewhere has a cooling need, so the other biomes play exactly as before.                                                                                                                                                                                                                                | New                |

## Map

About 120 tiles, from a seed. An oasis of 3 or 4 pool tiles near the middle, ringed with scrub;
a thin river crossing the map, its banks (wadi banks) flooded each spring; flat gravel plain (reg) around; dunes
(erg) along one side; rock outcrops at the edges; a salt flat; and the ruins of an old solar
array, the desert's mines.

| Tile                      | Like (elsewhere)        | Buildable                       | Notes                                                                                                                             | Source                |
| ------------------------- | ----------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Oasis                     | (none)                  | Water buildings only            | A spring-fed pool: refills 2 a season per tile, never floods. New tile type.                                                      | Playtester            |
| River                     | The Reach's river       | As river                        | Thin and seasonal: flow 6 / 0 / 2 / 3, high in the flash flood, dry all summer. The `river` type: the same rules, a smaller flow. | Playtester            |
| Wadi banks                | The Reach's floodplain  | Most land buildings; wadi farms | The low ground beside the river that the flash flood covers, leaving silt. The `floodplain` type with a desert look.              | Playtester            |
| Reg (gravel)              | (none)                  | Most land buildings             | Flat gravel plain, the mirrors' ground; heals to scrub. New tile type.                                                            | Playtester            |
| Erg (dunes)               | (none)                  | Fog nets and windbreaks only    | Drifting sand, not healable. New tile type (the coast's dunes take dune grass and stand still).                                   | Playtester            |
| Rock                      | (none)                  | Fog nets, wind towers, lookouts | Outcrops at the edges; the fog's best catch. New tile type (the Highland's crag is the tops, exposed to gales).                   | Playtester            |
| Salt flat                 | (none)                  | Salt works only                 | A dry lakebed crusted white. New tile type. Not healable.                                                                         | New                   |
| Old array                 | Ruin                    | Salvage yards                   | 3 to 4 ruins of an old solar farm, 30 salvage each: the `ruin` type (the same rules) with a desert look.                          | Playtester            |
| Scrub, meadow, palm grove | Scrub, meadow, woodland | The same                        | The land-health ladder, with desert looks; woodland is a palm grove. Meadow is rare until gardens mature.                         | Playtester; DESIGN.md |

Land-health ladder: reg → scrub → meadow → woodland (palm grove). Erg, rock, salt flat, the
river and the oasis aren't on it, so **Green the Desert** (the vision) counts only the land
that can heal; its share is set with the bots once the map exists, as the coast's and the
Highland's were.

## Seasonal events

| Season | Event       | Effect                                                                                                                                                                                                        | Source                         |
| ------ | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| Spring | Flash flood | The river runs high and floods the wadi banks beside it: silt for farms there (as the Reach's spring flood), cisterns there fill, and buildings there that aren't flood-tolerant are disabled for the season. | DESIGN.md (floods); playtester |
| Summer | Heatwave    | The river runs dry (flow 0). Homes need 2 cooling by day; solar canopies make 1 less by day (too hot to work well); channels lose twice as much to the sun.                                                   | Playtester; new                |
| Autumn | Dust storm  | Solar canopies and mirrors make 1 less in each slot (as the coast's sea fog); 2 exposed buildings (on the reg or erg, not sheltered by a palm windbreak) are disabled for the season.                         | DESIGN.md (storms); B2 (fog)   |
| Winter | Cold nights | Mild days, cold nights: homes need 1 heat at night; fog nets catch 2 a night instead of 1.                                                                                                                    | DESIGN.md                      |

## Energy, cooling and heat

| Source                       | Cost | Placement                 | Day (spring to winter)                    | Night         | Notes                                                                                                                                                                                                 | Source                    |
| ---------------------------- | ---- | ------------------------- | ----------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Solar Canopy ★               | 4    | As the Reach              | 4 / 5 / 4 / 3                             | —             | The Reach's 3 / 4 / 2 / 1 with the desert sun: +1, +1, +2, +2.                                                                                                                                        | DESIGN.md                 |
| Concentrated Solar Plant     | 12   | Reg (flat gravel)         | 3 / 4 / 3 / 2                             | 2 / 2 / 2 / 2 | Mirrors and a salt tank: what it makes by day it partly keeps for the night. Its mirrors' spare heat by day (2) can drive absorption chillers; in winter its tank also heats homes within 2 (2 heat). | DECISIONS.md (playtester) |
| Wind Spire                   | 8    | As the Reach              | 2 / 2 / 3 / 2                             | 3 / 2 / 3 / 3 | Shared; desert winds are steady, never strong.                                                                                                                                                        | DESIGN.md                 |
| Cell Bank                    | 5    | Anywhere                  | —                                         | —             | Shared: stores day energy for the night.                                                                                                                                                              | DESIGN.md                 |
| Sand Battery                 | 5    | Anywhere                  | —                                         | —             | Stores up to 4 spare day energy as heat in sand; gives it as heat to homes within 2 on winter nights.                                                                                                 | New                       |
| Wind Tower (cooling)         | 5    | Anywhere; best on rock    | 2 cooling a day slot                      | —             | Passive cooling, no energy: catches the wind and sends it down through the house. 3 beside a cistern or pool.                                                                                         | New                       |
| Absorption Chiller (cooling) | 6    | Within 2 of a heat source | Up to 2 cooling a slot, from as much heat | —             | Turns spare heat into cooling, 1 for 1: the sun's heat cools the town.                                                                                                                                | Playtester                |

Shared from the Reach: Solar Thermal Collector (the chillers' heat by day), Air-source Heat Pump (here it cools by day as well: 1 energy for 2
cooling), Biogas Digester (little biomass to feed it), Heat Well, Agrivoltaic Field (its panels
shade its crops: it needs 1 less water).

## Buildings

★ = unlocked at the start of every desert run.

| Building                 | Cost | Workers | Placement                              | Output per season (spring to winter)                                                                                                                        | Source       |
| ------------------------ | ---- | ------- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Oasis Garden ★           | 3    | 1       | Beside the oasis, a channel or a qanat | Food 3 / 4 / 4 / 2 under date palms (2 / 3 / 4 / 1 until SD2's Year 1 check); water 1 spring to autumn. Shades a home beside it (1 less cooling).           | New          |
| Wadi Farm                | 3    | 1       | Wadi banks                             | Food 3 / 2 / 3 / 0; draws from the river beside it (as the Highland's glen farm), so it goes dry in summer without a cistern or qanat; silt from the flood. | New          |
| Mud-brick House ★        | 3    | 0       | Anywhere                               | Houses 3; thick walls (see Cooling).                                                                                                                        | New          |
| Wind Tower               | 5    | 0       | Anywhere; rock or beside water best    | See Energy, cooling and heat.                                                                                                                               | New          |
| Absorption Chiller       | 6    | 0       | Anywhere; within 2 of a heat source    | See Energy, cooling and heat.                                                                                                                               | Playtester   |
| Fog Net                  | 2    | 0       | Rock, erg or reg at the map's edge     | 1 clean water each night (2 in winter), into the channel or cistern beside it, else held (up to 2).                                                         | EXPANSION.md |
| Qanat                    | 2    | 0       | From the oasis or a well, tile by tile | A channel underground: carries water as the irrigation channel does, but loses none to the sun.                                                             | New          |
| Concentrated Solar Plant | 12   | 1       | Reg                                    | See Energy, cooling and heat.                                                                                                                               | DECISIONS.md |
| Sand Battery             | 5    | 0       | Anywhere                               | See Energy, cooling and heat.                                                                                                                               | New          |
| Palm Windbreak           | 1    | 0       | An edge between tiles, as a hedge      | Shelters the tiles on both sides from dust storms; shades a home beside it (1 less cooling).                                                                | New          |
| Salt Works               | 4    | 1       | Salt flat                              | 1 materials a season, and food doesn't spoil over winter for 5 food (salted stores).                                                                        | New          |

Shared, as the Reach: Composter ★, Workshop ★, Salvage Yard ★, Cistern ★, Well, Irrigation
Channel, Greenhouse, Apiary, Commons Plaza, Seedbank Library, Tree Nursery (palms), Pollinator
Meadow, Reed Bed (grey water reused matters most here), Bathhouse (the hammam), and Mushroom Cellar (cool underground). Not in the desert: the Floodplain
Farm, Orchard, Rice-fish Paddy, Fish Pond, Weir, Levee, River Wheel, and the coast's and
Highland's buildings.

## Combos

| Layer     | Combo              | How                                                                  | Effect                                                                                      | Source                         |
| --------- | ------------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------ |
| Chain     | Grey Water Loop    | Mud-brick House → grey water → Reed Bed → clean water → Oasis Garden | +1 on each building in the loop; the garden needs no other water                            | EXPANSION.md (grey water); new |
| Chain     | Kitchen Loop       | As the Reach, with oasis gardens and wadi farms                      | As the Reach                                                                                | DESIGN.md                      |
| Adjacency | Courtyard          | A mud-brick house next to a wind tower and a cistern                 | The house needs no cooling, even in a heatwave                                              | New                            |
| Adjacency | Date Shade         | An oasis garden next to 2 palm groves (woodland)                     | +1 food in summer and autumn                                                                | New                            |
| Formation | Heliostat Line     | 3 Concentrated Solar Plants in a row                                 | +1 by night each (one tower, one tank)                                                      | New                            |
| Formation | Green Wall         | 4 palm windbreaks in an unbroken line                                | Nothing within 2 is dust-exposed; +1 Harmony                                                | New                            |
| Formation | Long Qanat         | A qanat of 4 tiles or more                                           | The gardens it waters make +1 food (cool water)                                             | New                            |
| Evolution | Three-Layer Garden | An oasis garden next to 2 oasis gardens and a tree nursery           | +1 food, 1 less water; shades homes within 1                                                | New                            |
| Evolution | Fog Fence          | A fog net next to 2 fog nets                                         | 2 water a night (3 in winter)                                                               | New                            |
| Evolution | Restored Array     | An exhausted salvage yard on the old array                           | Its old panels mended: 2 energy by day, and its worker is free (the desert's Rewilded Ruin) | New                            |

About 8 desert tunings (Deeper Wells, Whitewashed Walls, Clean Mirrors, Date Harvest, Night
Watch, Salt Trade, Wider Towers, Fog Weavers) and 2 charters (Water Keepers: channels lose
nothing to the sun; Siesta: homes need no cooling, but workshops and salvage yards rest by day in
summer) join the shared pool.

## Wonder, wildlife and festivals

| System    | Sun Desert                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Source                                   |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Wonder    | **The Solar Oasis**: a 7-tile flower of mirrors on the reg around a tower whose salt tank never empties, its cooling pool watering a garden. From era 3, needing a closed Grey Water Loop and 2 Concentrated Solar Plants; 60 materials and 20 food (biomass is scarce here). Finished: 2 energy in each slot, 2 clean water a season into the channel beside it, +60 to the score, the Graft a tier higher, and the Bloom era's goal. Its site is checked against 40 maps before it is fixed. | EXPANSION.md (one wonder per biome); new |
| Wildlife  | Fennec foxes (Harmony 20, open scrub and erg: oasis gardens within 2 +1 food in summer, the foxes eat the pests); sandgrouse (40, the oasis beside a fog net: cisterns within 2 gain 1 water a season, carried in their breast feathers); lanner falcons (50, rock beside a wind tower: +1 wellbeing a pair); oryx (70, open reg of 6 tiles or more: +1 wellbeing a herd).                                                                                                                     | E4's pattern; new                        |
| Festivals | Rain Feast (spring, 5 food: +3 wellbeing, and the flash flood fills every cistern, as the Highland's Snowmelt Fair); Night Market (summer, 5 materials: +3 wellbeing, and homes need 1 less cooling that summer, the town living by night); Star Night (winter, 5 materials: +3 wellbeing, and homes use 1 less energy at night that winter, the lights out to see the stars).                                                                                                                 | E4's pattern; HL6; new                   |

## Root City, regions and twists

| Item        | Proposal                                                                                                                                                                                                                                                                                                                                                                                 | Source          |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| Joins       | Once 8 districts stand in Root City (DESIGN.md), and at once for a city that already has them. Expeditions then take turns between all open biomes.                                                                                                                                                                                                                                      | DESIGN.md       |
| First run   | Guided first year, opening with what is new: cooling, water without a river, the night's energy.                                                                                                                                                                                                                                                                                         | As the Highland |
| Sun Quarter | A new district, earned by sun-led runs (energy from solar canopies, the Concentrated Solar Plant, agrivoltaic fields and restored arrays as a share of all energy; full at half). Perk: solar canopies make 1 more in winter (Seedling), also autumn (Sapling), also spring (Heartwood). Adds the **Fog Net** to every biome's drafts (water without a river, useful in any dry summer). | New             |
| Glassworks  | A landmark: the Sun Quarter next to the Foundry District. Greenhouses and solar canopies cost 1 less in every biome.                                                                                                                                                                                                                                                                     | New             |
| Regions     | The Oasis as it is; Wadi Country (a second river, wider banks, a bigger flash flood); The Erg (dunes over a third of the map, the sun stronger by 1; the Graft a tier higher); Salt Pan (a wide salt flat, salt works sites, little scrub); Old Array (7 ruins of the old solar farm, 36 salvage each).                                                                                  | New             |
| Twists      | The shared ones that fit (Drought Year, Clear Skies, Lean Start, Big Families, Scavengers, Steady Winds), not Long Winter or Wild Storms; and three of its own: Haboob Year (dust storms in summer too), Rainy Year (a second flash flood in autumn; wadi farms +1), Scorching Year (homes need cooling on spring and autumn days too; the Graft a tier higher).                         | New             |
| Tempest     | Per biome, as the coast and the Highland.                                                                                                                                                                                                                                                                                                                                                | DESIGN.md       |
| Score tiers | Shared; the desert's bots should reach Heartwood about as often as the Reach's (a desert score line if not, as the coast's and the Highland's).                                                                                                                                                                                                                                          | As the Highland |

## Year 1 walkthrough (to become the desert's golden test)

A proposal to check against the simulation once it exists, reviewed before it becomes the
reference, as the coast's and the Highland's were. The Highland's first proposal didn't fit the
numbers; this one is checked in SD2 before it is proposed as a golden test.

| Season | Build                                                                                        | What it teaches                                                                                      | Source |
| ------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| Spring | Oasis Garden by the oasis, Salvage Yard on the old array, Workshop, Cistern on the wadi bank | The oasis is the water; the flash flood fills the cistern, and the river dries in summer, so keep it | New    |
| Summer | Mud-brick House, Wind Tower beside it                                                        | The heatwave: homes need cooling, and the cheapest cooling uses no energy                            | New    |
| Autumn | Fog Net, Palm Windbreak by the solar canopy                                                  | The dust storm dims the panels and buries what it reaches; the fog brings water without a river      | New    |
| Winter | Cell Bank                                                                                    | Bright days, cold nights: store the day for the night; the mud-brick walls keep the houses warm      | New    |

Checked in SD2: as written it didn't fit the numbers (summer couldn't be paid for, and one garden
couldn't feed the year). With the camp's panels at 4 by day and 1 by night, the oasis garden at
3 / 4 / 4 / 2, and the autumn's canopy built beside the workshop with the windbreak between them,
it plays as above: `tests/golden-desert-year1.test.ts`, proposed as the desert's golden test
(DECISIONS.md, The Sun Desert).

## Build plan

Each step ends with tests and a commit; Willow Reach, the coast and the Highland play exactly as
before throughout (their golden tests unchanged).

| Step | What                                                                                                                                                                                                                                                                                   | Done when                                                                                                 | Source          |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------- |
| SD1  | **Cooling and dry water** (done; see DECISIONS.md). The cooling need, cooling sources and grid cooling (heat's machinery, in day slots); dry water: a thin river that dries in summer, an oasis spring, evaporation in every season but winter, the qanat. Inert for the other biomes. | Every new rule has a unit test; the other biomes' golden tests are unchanged.                             | DESIGN.md       |
| SD2  | **Desert simulation** (done; see DECISIONS.md). Its map generator, tiles, events, buildings, the Concentrated Solar Plant's tank, the sand battery, fog nets.                                                                                                                          | Every new rule has a unit test; the Year 1 walkthrough fits the numbers and is proposed as a golden test. | As the Highland |
| SD3  | **Combos and balance.** Its combos, tunings, charters, the Almanac; bots that cool, store and save water.                                                                                                                                                                              | Every combo triggers in a unit test; the bots' Heartwood share is within 10 points of the Reach's.        | As the Highland |
| SD4  | **On screen.** Heat shimmer, dust, the river running high and drying, the oasis, mirrors catching the light; cooling in tooltips and the season report; an art guide.                                                                                                                  | A desert run plays to the end with mouse and keyboard.                                                    | As the Highland |
| SD5  | **In Root City.** Joins after 8 districts; the Sun Quarter, the Glassworks, regions, twists, the guided first run.                                                                                                                                                                     | Runs move between the four biomes with progression kept (an e2e).                                         | DESIGN.md       |
| SD6  | **Wonder, wildlife, festivals.** The Solar Oasis, the desert's animals and festivals.                                                                                                                                                                                                  | As the Highland's HL6.                                                                                    | EXPANSION.md    |

## Decided in review

| Question          | Decision                                                                                                                                                                                                              | Source      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| Cooling           | A full rule, mostly mirroring heat: a need on homes by day, cooling sources within 2 tiles, grid cooling at 2 for 1, a hot home counted as a cold one.                                                                | Playtester  |
| Water             | A thin river that dries up in summer (flow 6 / 0 / 2 / 3), its banks flooded each spring; with the oasis spring, wells and fog nets.                                                                                  | Playtester  |
| When it joins     | After 8 districts, as DESIGN.md says. (The Volcanic Isle's "after the first landmark" is for its own review.)                                                                                                         | Playtester  |
| The wonder's cost | 60 materials and 20 food, as proposed.                                                                                                                                                                                | Playtester  |
| Tiles             | Reuse a tile type only where it is a perfect fit: the river, the floodplain (wadi banks), the ruin (old array), scrub, meadow and woodland, with desert looks. New types for the oasis, reg, erg, rock and salt flat. | Playtester  |
| Art               | Procedural first, with a hand-art request written alongside SD4, as the Highland.                                                                                                                                     | highland.md |
