# Proposal: the Highland (Milestone 12)

The third biome, for review before any code. DESIGN.md names it (it joins "after 4 districts")
and the water expansion reserved its buildings: the **Pump Station** and the **Biochar Kiln**, with
the **Carbon Loop** (coppice → biomass → biochar kiln → energy and biochar → farms) as its combo
(EXPANSION.md). DECISIONS.md (Q18) already settled one thing: in the Highland, heat is the point,
so heat needs a building there, with the grid's heat at 2 energy, as in a Long Winter. Everything
else here is a proposal: the designer's defaults until the bots and playtesting tune them.

It builds on the coast's foundation (biomes, Root City's biome offers, Tempest per biome), and on
what the coast taught: decide what counts as healable land before setting the vision's share;
check the wonder fits on real maps; and give the land a steady source of salvage and materials.

## What makes it different

Willow Reach is flat and wet; the coast is flat and salty. The Highland is **steep and cold**.
Its new rule is **height**: the land rises in steps from the glen floor to the tops, and where a
building stands on that slope decides what it gets.

| Willow Reach                      | Highland                                                                            | Source                      |
| --------------------------------- | ----------------------------------------------------------------------------------- | --------------------------- |
| A wide river, a spring flood      | A fast stream in a glen: strong water power, a snowmelt flood on the glen floor     | DESIGN.md (Highland); new   |
| Water reaches any farm by channel | Water flows only downhill: terraces above the stream need a Pump Station            | EXPANSION.md (Pump Station) |
| Heat is a winter cost             | Heat is the point: every home needs a heat building nearby, the grid's heat costs 2 | DECISIONS.md (Q18)          |
| Solar is the first source         | Snow covers solar on the tops in winter; wind is strong up high                     | DESIGN.md; new              |
| Compost improves land for a while | Biochar improves a farm's tile for good                                             | EXPANSION.md (Biochar Kiln) |

The Highland's signature choice: **live low or farm high**. The glen floor is warm, sheltered and
wet, but the snowmelt floods it; the slopes take terraces once water is pumped up to them; the
tops are windy and cold, with snow on the panels all winter.

## Height

Every land tile has a height from 0 (the glen floor, beside the stream) to 3 (the tops). The map
generator raises the land away from the stream.

| Rule     | Effect                                                                                                                        | Source            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Water    | A channel carries water only to tiles at its own height or lower. A Pump Station lifts it one step: 2 spare energy → 2 water. | EXPANSION.md; new |
| Cold     | Homes at height 2 or 3 need 1 more heat on autumn and winter nights.                                                          | New               |
| Wind     | Wind spires at height 2 or 3 make 1 more in each slot (as the coast's headlands).                                             | New               |
| Snow     | In winter, solar canopies at height 2 or 3 make nothing (snow on the panels).                                                 | DESIGN.md         |
| Snowmelt | The spring flood covers the glen floor (height 0) beside the stream; nothing higher.                                          | New               |

## Map

About 120 tiles, from a seed. A stream runs down the glen's length; the floor beside it is
meadow and scrub (height 0); slopes rise on both sides (heights 1 and 2) to the tops (height 3);
2 or 3 old mine workings (ruins) on the slopes; patches of old pine wood; a peat bog or two on the
flat shoulders.

| Tile                             | Like (Willow Reach) | Buildable                     | Notes                                                                                        | Source |
| -------------------------------- | ------------------- | ----------------------------- | -------------------------------------------------------------------------------------------- | ------ |
| Stream                           | River               | As river                      | Flow 10, strong in spring (melt), low in summer.                                             | New    |
| Glen floor                       | Floodplain          | Most land buildings           | Meadow and scrub at height 0, warm and sheltered; the snowmelt reaches it.                   | New    |
| Slope                            | Hill                | Most land buildings, terraces | Heights 1 and 2.                                                                             | New    |
| Crag                             | (none)              | Wind spires, lookouts only    | Bare rock at height 3. Exposed to gales. Not healable.                                       | New    |
| Bog                              | (none)              | Bog buildings only            | Peat at height 1 or 2. Holds water like a cistern (4); rewetted, it gives Harmony.           | New    |
| Ruin (old mine)                  | Ruin                | Salvage yards                 | 3 workings of 30 salvage: the Highland's materials come mostly from its mines and its woods. | New    |
| Pine wood, meadow, scrub, barren | The same            | The same                      | Pine wood shelters from gales as the Reach's woodland does from storms.                      | New    |

Land-health ladder: barren → scrub → meadow → woodland. Crag, bog and the stream aren't on it, so
**Restore the Glen** (the vision) counts only the land that can heal, and its share is set with
the bots once the map exists (the coast's needed lowering to half).

## Seasonal events

| Season | Event     | Effect                                                                                                                                                                   | Source                      |
| ------ | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Spring | Snowmelt  | The stream floods the glen floor beside it: buildings there that aren't flood-tolerant are disabled for the season (repairs as floods); no silt. Cisterns and bogs fill. | New                         |
| Summer | Dry spell | The stream runs low (summer flow 3): hill turbines make less, and channels carry less.                                                                                   | New                         |
| Autumn | Gale      | Wind +1; 2 exposed buildings (on crags, or at height 3) are disabled for the season unless pine wood or a snow fence beside them shelters them.                          | DESIGN.md (storms); new     |
| Winter | Deep snow | Homes need heat; solar canopies at height 2 or 3 make nothing; the stream freezes to a trickle (hill turbines 1).                                                        | DESIGN.md (snow cuts solar) |

## Energy and heat

Heat needs a building in every Highland run (Q18): a home's heat comes from a heat source within 2
tiles (heat pumps, heat wells, solar thermal collectors, bothies' stoves), and energy turned
straight into heat costs 2 for 1.

| Source         | Cost | Placement                    | Day (spring to winter)                                                                       | Night               | Notes                                                                                                             | Source       |
| -------------- | ---- | ---------------------------- | -------------------------------------------------------------------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------ |
| Hill Turbine ★ | 6    | Height 1+, beside the stream | 3 / 1 / 2 / 1                                                                                | 3 / 1 / 2 / 1       | The Highland's starter: a small hydro wheel where the stream drops. Strong in the melt, weak in summer and frost. | New          |
| Biochar Kiln   | 7    | Anywhere                     | Takes 2 biomass a run: 2 energy in the slot that needs it, and charcoal for a farm beside it | —                   | The Carbon Loop's kiln. Each season it runs, one farmland tile beside it is charred for good (+1 food).           | EXPANSION.md |
| Wind Spire     | 8    | As the Reach; best up high   | +1 at height 2 or 3                                                                          | +1 at height 2 or 3 | Shared.                                                                                                           | New          |
| Solar Canopy ★ | 4    | As the Reach                 | Nothing at height 2–3 in winter                                                              | —                   | Shared.                                                                                                           | DESIGN.md    |
| Pump Station   | 6    | Beside a channel             | —                                                                                            | —                   | Spare energy: 2 energy lifts 2 water one height step, into a channel above it.                                    | EXPANSION.md |

Shared from the Reach: Heat Well, Air-source and Water-source Heat Pumps, Cell Bank, Biogas
Digester, Solar Thermal Collector, Pumped Reservoir (on a slope above a tarn).

## Buildings

★ = unlocked at the start of every Highland run.

| Building       | Cost | Workers | Placement                         | Output per season (spring to winter)                                                                | Source       |
| -------------- | ---- | ------- | --------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ |
| Terrace Farm ★ | 3    | 1       | Slope (height 1 or 2)             | Food 1 / 4 / 5 / 0; needs 1 water in spring to autumn. Its tile becomes a terrace (stays farmland). | New          |
| Glen Farm      | 3    | 1       | Glen floor (height 0)             | Food 2 / 4 / 4 / 0; water from the stream; the snowmelt floods it (tolerant, no silt).              | New          |
| Shieling       | 3    | 1       | Meadow at height 2 or 3           | Summer pasture: food 0 / 4 / 2 / 0, no water. Empty in winter.                                      | New          |
| Bothy ★        | 4    | 0       | Anywhere                          | A stone home for 3 with its own stove: heats itself (1 biomass in autumn and winter).               | New          |
| Pump Station   | 6    | 0       | Beside a channel                  | See Energy.                                                                                         | EXPANSION.md |
| Biochar Kiln   | 7    | 1       | Anywhere                          | See Energy.                                                                                         | EXPANSION.md |
| Snow Fence     | 1    | 0       | An edge between tiles, as a hedge | Shelters the tiles on both sides from gales; in winter, the solar beside it keeps 1 by day.         | New          |
| Rewetted Bog   | 2    | 0       | Bog                               | +2 Harmony; holds 4 water for the channel beside it, as a cistern.                                  | New          |
| Lookout        | 6    | 1       | Crag                              | +2 wellbeing; gale-exposed buildings within 2 are warned and sheltered (as the coast's lighthouse). | New          |

Shared, as the Reach: Cottage, Composter ★, Workshop ★, Salvage Yard ★, Kiln, Greenhouse, Apiary,
Commons Plaza, Seedbank Library, Tree Nursery (pines), Pollinator Meadow, Irrigation Channel ★,
Well, Cistern, Reed Bed, Bathhouse, Fish Pond (on the stream), Mushroom Cellar, Hedgerow, and the
Coppice action on pine wood. Not in the Highland: the Floodplain Farm, Orchard, Rice-fish Paddy,
Weir and Levee, and the coast's buildings.

## Combos

| Layer     | Combo          | How                                                                   | Effect                                                            | Source       |
| --------- | -------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------ |
| Chain     | Carbon Loop    | Coppice Wood → biomass → Biochar Kiln → charcoal → Terrace Farm       | +1 on each building in the loop                                   | EXPANSION.md |
| Chain     | Kitchen Loop   | As the Reach, with terrace and glen farms                             | As the Reach                                                      | DESIGN.md    |
| Chain     | Meltwater Loop | Rewetted Bog → water → Pump Station → Terrace Farm                    | The pump lifts 1 more for each energy; +1 Harmony                 | New          |
| Adjacency | Hearth Stones  | A bothy next to a heat well                                           | The bothy needs no biomass                                        | New          |
| Adjacency | High Pasture   | A shieling next to 2 meadow tiles                                     | +1 food in summer                                                 | New          |
| Formation | Water Stair    | A pump station with terrace farms at three heights in a line above it | +1 food each, and no water lost on the way up                     | New          |
| Formation | Snow Line      | 4 snow fences in an unbroken line                                     | Nothing within 2 tiles is gale-exposed                            | New          |
| Formation | Ridge Spires   | 3 wind spires in a row at height 2 or 3                               | +1 energy each, no Harmony penalty                                | New          |
| Evolution | Hanging Garden | A terrace farm next to 2 terraces and a pollinator meadow             | +1 food, +1 Harmony; needs no worker                              | New          |
| Evolution | Cascade        | 2 hill turbines next to each other down the stream                    | Each +1 in spring and autumn                                      | New          |
| Evolution | Bat Roost      | An exhausted salvage yard on an old mine                              | +2 Harmony, and its worker is free (the Highland's Rewilded Ruin) | New          |

About 8 Highland tunings (Deeper Heat Wells, Dry-stone Terraces, Hardy Oats: terrace farms make 1
in winter…) and 2 charters (Mountain Rescue: no gale damage; Hearth Keepers: bothies need no
biomass) join the shared pool.

## Wonder, wildlife and festivals

| System    | Highland                                                                                                                                                                                                                                                                                                                                                | Source                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Wonder    | **The Cloud Terraces**: a 7-tile flower of terraced gardens on a slope, spanning at least 2 heights, from era 3, needing a closed Carbon Loop and 2 pump stations; finished: every home within 3 tiles warm (+2 heat each night), +60 score, the Graft a tier higher, meets the Bloom era goal. Its site is checked against 40 maps before it is fixed. | EXPANSION.md (one wonder per biome); new |
| Wildlife  | Mountain hares (Harmony 20, meadow at height 2+: shielings +1 food in summer); dippers (40, the stream beside a hill turbine: fish ponds within 2 +1 food); golden eagles (50, a crag beside a lookout: +1 wellbeing per lookout); pine martens (70, pine woods of 4+: +1 wellbeing per wood).                                                          | E4's pattern; new                        |
| Festivals | Snowmelt Fair (spring, 5 materials: +3 wellbeing, the melt fills every cistern); Shieling Day (summer, 5 food: +3 wellbeing, shielings +1 food that summer); Lantern Night (winter, as the Reach).                                                                                                                                                      | E4's pattern; new                        |

## Root City, regions and twists

| Item           | Proposal                                                                                                                                                                                                                                                                                                                                          | Source       |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Joins          | Once 4 districts stand in Root City (DESIGN.md), and at once for a city that already has them. Expeditions then take turns between all open biomes.                                                                                                                                                                                               | DESIGN.md    |
| First run      | Guided first year, opening with what is new: height, water uphill, heat.                                                                                                                                                                                                                                                                          | As the coast |
| Ridge Quarter  | A new district, earned by heat-led runs (heat from local sources as a share of all heat). Perk: homes need 1 less heat on winter nights (Seedling), also autumn (Sapling), also spring (Heartwood). Adds the **Bothy** to every biome's drafts.                                                                                                   | New          |
| Charcoal Works | A landmark: the Ridge Quarter next to the Foundry District. Kilns and biochar kilns run once more each season.                                                                                                                                                                                                                                    | New          |
| Regions        | The Glen as it is; Corrie Lochs (2 tarns at height 2: water up high without pumping); High Plateau (mostly heights 2 and 3: cold, windy; the Graft a tier higher); Old Pinewood (6 woods); Old Mines (more workings, more salvage).                                                                                                               | New          |
| Twists         | The shared ones that fit (Lean Start, Big Families, Scavengers, Steady Winds, Wild Storms) and three of its own: Deep Winter (snow from autumn: solar at height 2+ makes nothing in autumn too; the Graft a tier higher), Föhn Wind (winter heat −1, but the snowmelt floods twice as far), Late Thaw (the snowmelt comes in summer, not spring). | New          |
| Tempest        | Per biome, as the coast.                                                                                                                                                                                                                                                                                                                          | DESIGN.md    |
| Score tiers    | Shared; the Highland's bots should reach Heartwood about as often as the Reach's (a Highland score line if not, as the coast's).                                                                                                                                                                                                                  | As the coast |

## Year 1 walkthrough (to become the Highland's golden test)

A proposal to check against the simulation once it exists, reviewed before it becomes the
reference, as the coast's was.

| Season | Build                                                                   | What it teaches                                                                                            | Source |
| ------ | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| Spring | Glen Farm by the stream, Salvage Yard on a mine, Workshop, Hill Turbine | The melt turns the turbine hard; the snowmelt is coming: the glen farm takes it, nothing else on the floor | New    |
| Summer | Terrace Farm on the slope, Pump Station                                 | Water flows down, not up: the pump lifts it to the terrace                                                 | New    |
| Autumn | Bothy, Composter                                                        | Cold comes early up here: the bothy heats itself                                                           | New    |
| Winter | Heat Well beside the camp                                               | Snow on the panels: the turbine and the well carry the night                                               | New    |

## Build plan

Each step ends with tests and a commit; Willow Reach and the coast play exactly as before
throughout (their golden tests unchanged).

| Step | What                                                                                                                                                                                                                    | Done when                                                                                          | Source       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------ |
| HL1  | **Height** (done; the map generator comes with HL2). Tile heights, the map generator, water that flows only downhill, the Pump Station, cold and wind by height, snow on the panels; inert for the Reach and the coast. | Every height rule has a unit test; the other biomes' golden tests are unchanged.                   | EXPANSION.md |
| HL2  | **Highland simulation** (done; Year 1 proposed with changes, see DECISIONS.md). Its tiles, events, buildings, biochar, the bothy's stove, heat always on.                                                               | Every new rule has a unit test; the Year 1 walkthrough is proposed as a golden test for review.    | DESIGN.md    |
| HL3  | **Combos and balance** (done; see DECISIONS.md). Its combos, tunings, charters, the Almanac; bots that play the Highland.                                                                                               | Every combo triggers in a unit test; the bots' Heartwood share is within 10 points of the Reach's. | As the coast |
| HL4  | **On screen** (done; see DECISIONS.md). Raised tiles for heights, terraces, snow, the pump's lift; a hand-art request.                                                                                                  | A Highland run plays to the end with mouse and keyboard.                                           | As the coast |
| HL5  | **In Root City.** Joins after 4 districts; the Ridge Quarter, the Charcoal Works, regions, twists.                                                                                                                      | Runs move between the three biomes with progression kept (an e2e).                                 | DESIGN.md    |
| HL6  | **Wonder, wildlife, festivals.** The Cloud Terraces, the Highland's animals and festivals.                                                                                                                              | As the coast's B6.                                                                                 | EXPANSION.md |

## Decided in review

| Question      | Decision                                                                                                                                    | Source     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| Height        | A real rule: heights 0 to 3; water flows only downhill and a Pump Station lifts it a step; colder and windier up high; snow on high panels. | Playtester |
| Biochar       | A permanent mark the Biochar Kiln leaves on a farm tile beside it: +1 food for good. No new store.                                          | Playtester |
| When it joins | Once 4 districts stand in Root City, as DESIGN.md; at once for a city that already has them.                                                | Playtester |
| Art           | Procedural first, with a hand-art request written alongside HL4.                                                                            | Playtester |
