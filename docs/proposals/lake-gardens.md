# Proposal: Lake Gardens

A fifth biome, for the playtester's review. It comes out of the research on regenerative systems
([research/regenerative-systems.md](../research/regenerative-systems.md)): the wet lowlands there
"produced the tightest loops on record, because water carries nutrients from one element to the
next and pond or canal mud can be lifted back onto land". The biome is built from the
chinampas of the Valley of Mexico, the mulberry-dyke ponds of the Pearl River Delta, the
Vietnamese garden-pond-pen (VAC), the sewage-fed fisheries of East Kolkata and rice-duck paddies.
Everything here is a proposal: the designer's defaults until review, the bots and playtesting
tune them.

It builds on what the earlier biomes left: water with its three qualities (clean, grey, nutrient),
lakes, cisterns and channels (E1), grey water's cost to Harmony, the reed bed and oyster reef that
clean it, fish ponds that feed nutrient water into channels, the land-health ladder and compost,
tiles that change under a building (`setsTile`, the coast's plantable dunes), and the lessons of
the other biomes: check the wonder fits real maps, give the land a steady source of materials, and
propose a Year 1 the numbers can pay for.

## What makes it different

| Willow Reach                        | Lake Gardens                                                                                                                              | Source                    |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Land everywhere, a river through it | Water everywhere: a broad shallow lake with islands and a fringe of reeds. Land is scarce, and **you make more of it**.                   | Research: chinampas       |
| Compost comes from scraps           | Compost also comes **out of the water**: mud settles in the shallows, and dredging lifts it back onto the beds.                           | Research: mud lifted back |
| Grey water is a Harmony cost        | Grey water is **feed**: a fishery turns homes' waste water into fish and nutrient water, as East Kolkata's do; too much of it blooms.     | Research: bheris          |
| Channels carry water to farms       | Farms stand beside the water, so water is easy. The puzzle is **quality and space**: what flows into the lake, and how much lake to keep. | New                       |

The signature choice: **land or water**. Every raised bed is more farmland and less lake, and the
lake is where the fish, the mud and the cleaning happen. A settlement that fills its lake with
beds starves its own loops.

## The new rules

Three rules, each contained, each reusing machinery the game already has.

| Rule                      | How it works                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Reuses                                                              | Source                                   |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| **Raised beds**           | A Chinampa is built on a shallows tile next to land or another bed. The tile becomes a **bed**: fertile land at meadow on the soil ladder. A bed with open water on 2 or more sides makes +1 food (the canals water and cool it). Beds can't be built on deep water.                                                                                                                                                                                                             | `setsTile`, as the pollinator meadow; the coast's plantable ground  | Research: chinampas                      |
| **Pond mud**              | Each season, the nutrient and grey water that reaches the lake leaves mud on the shallows next to where it entered: 1 mud for every 2 water, up to 4 a tile, kept on the tile as a ruin keeps its salvage. A **Mud Boat** lifts up to 3 mud a season from the water tiles beside it, as compost (or straight onto a bed beside it, a step up the soil ladder). A shallows tile holding 4 mud **silts up**: it counts as land for nothing and as water for nothing until dredged. | A per-tile counter, as a ruin's salvage; compost; the soil ladder   | Research: chinampas, mulberry dykes, VAC |
| **The lake's grey water** | Grey water that reaches the lake (from stilt houses, bathhouses, a channel's end) is counted for the lake, not the river. A **Wastewater Fishery** on the shallows takes up to 3 grey water a season and makes food and nutrient water from it. What is left costs Harmony, as grey water in the river does; above 4 in summer, the lake **blooms** (see Seasonal events).                                                                                                       | `greyToRiver` and its Harmony cost; the reed bed; feeding a channel | Research: East Kolkata                   |

## Map

About 120 tiles, from a seed. A broad lake covering about half the map: **shallows** around its
rim and between the islands, **deep water** in the middle. Two or three streams run in from the
edges (the lake's fresh water; channels start beside them as from a river). A ring of reed fringe,
small islands of scrub and meadow, higher ground with woodland (the ahuejote willows) along one
edge, and a drowned town: ruins half in the water, salvaged by boat.

| Tile                          | Like (elsewhere)       | Buildable                                                     | Notes                                                                                                                         | Source              |
| ----------------------------- | ---------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Shallows                      | (none)                 | Chinampas, fisheries, mud boats, stilt houses, floating solar | Knee-deep water: where beds are made and mud settles. Counts as a lake for water (still water off the stream). New tile type. | Research: chinampas |
| Deep water                    | The coast's sea        | Fisheries and floating solar only                             | Never built on with land; the lake's fish live here. New tile type (not salt).                                                | New                 |
| Reed fringe                   | The Reach's floodplain | Reed beds, mud boats, most land buildings                     | The wet edge between land and water: high water covers it each spring. The `floodplain` type with a lake look.                | DESIGN.md (floods)  |
| Bed                           | Meadow                 | Farms, gardens, mulberry, homes                               | A raised bed made by a chinampa. New tile type, on the soil ladder at meadow (woodland above it, as everywhere).              | Research: chinampas |
| Stream                        | The Reach's river      | As river                                                      | Small streams feeding the lake: channel intakes, a little energy for a canal wheel.                                           | DESIGN.md           |
| Drowned town                  | Ruin                   | Salvage yards (by boat)                                       | 3 or 4 ruins at the lake's edge, 30 salvage each, the lake's steady source of materials.                                      | Highland lesson     |
| Scrub, meadow, woodland, hill | The same               | The same                                                      | Islands and the higher shore; woodland is willow.                                                                             | DESIGN.md           |

## Seasonal events

| Season | Event       | Effect                                                                                                                                                                                                           | Source                                  |
| ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Spring | High water  | The lake rises a ring: the reed fringe floods (buildings there that aren't flood-tolerant are disabled; farms there get silt, as the Reach's flood). Beds stand above it. Mud settles twice as fast this season. | DESIGN.md (floods); research: chinampas |
| Summer | Algae bloom | If the lake holds more than 4 grey water, it blooms: lake fisheries make 1 less food, and the Harmony cost of its grey water doubles. A lake kept clean doesn't bloom at all.                                    | Research: East Kolkata                  |
| Autumn | Lake wind   | Wind across open water: 2 exposed buildings on bed edges facing deep water may be damaged, unless a Willow Edge runs along that edge.                                                                            | DESIGN.md (storms)                      |
| Winter | Low water   | The shallows drain to mud: mud boats lift twice as much, and fish crowd into deep water (lake fisheries +1, shallows fisheries −1).                                                                              | Research: VAC; new                      |

## Energy and heat

| Source                 | Cost | Placement              | Day (spring to winter) | Night         | Notes                                                                                                              | Source                   |
| ---------------------- | ---- | ---------------------- | ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------ |
| Floating Solar         | 5    | Shallows or deep water | 3 / 5 / 3 / 1          | —             | Cooled by the water: 1 more than a canopy in summer. Shades the water under it: a fishery next to it makes 1 less. | New                      |
| Canal Wheel            | 5    | Beside a stream        | 2 / 1 / 2 / 2          | 2 / 1 / 2 / 2 | The Reach's river wheel, smaller: the streams are small.                                                           | DESIGN.md                |
| Water-source Heat Pump | 6    | Beside any lake tile   | —                      | —             | Shared: the lake is the best heat source in any biome; it can stand almost anywhere here.                          | proposals/heat-routes.md |
| Biogas Digester        | 6    | Anywhere               | —                      | —             | Shared, and well fed here: the pig pen's manure is its input (see the VAC Loop).                                   | EXPANSION.md             |

Shared as the Reach: Solar Canopy ★, Cell Bank, Heat Well, Solar Thermal Collector, Wind Spire.
The lake keeps winters mild: homes need 1 heat on winter nights, as the Reach's.

## Buildings

| Building                    | Cost | Workers | Placement                                    | Output per season (spring to winter)                                                                                                                                                       | Source                         |
| --------------------------- | ---- | ------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| Chinampa ★                  | 3    | 1       | Shallows next to land or a bed               | Makes its tile a bed. Food 2 / 4 / 4 / 2 (several harvests a year); +1 with open water on 2 or more sides; +1 with nutrient water. Draws water from the lake beside it, no channel needed. | Research: chinampas            |
| Mud Boat ★                  | 2    | 1       | Reed fringe, a bed or land beside shallows   | Lifts up to 3 mud a season from the water tiles beside it: compost, or a step up the soil ladder for a bed beside it. Twice as much in winter.                                             | Research: chinampas, VAC       |
| Stilt House ★               | 3    | 0       | Shallows or reed fringe                      | Houses 3; stores 5 food. Its washing water (1 grey a season) goes into the lake.                                                                                                           | Research: VAC; new             |
| Wastewater Fishery          | 4    | 1       | Shallows                                     | Takes up to 3 grey water a season from the lake: food 1 for each, and 1 nutrient water into a channel or a chinampa beside it. Cleans what it takes.                                       | Research: East Kolkata         |
| Lake Fishery                | 4    | 1       | Deep water next to shallows                  | Food 2 / 2 / 2 / 3; less in a bloom. Counts as a pond.                                                                                                                                     | New                            |
| Mulberry Dyke               | 3    | 1       | A bed or land next to a fish pond or fishery | Biomass 1 / 2 / 2 / 0 (leaves); its silkworms' droppings feed the fish: +1 food to one fish pond or fishery beside it.                                                                     | Research: mulberry dykes       |
| Silk House                  | 5    | 1       | Next to a mulberry dyke                      | Run: 2 biomass (leaves) → 3 materials (silk). Up to 2 runs a season. The lake's second source of materials.                                                                                | Research: mulberry dykes       |
| Pig Pen                     | 3    | 1       | Land or a bed                                | Eats up to 3 scraps or biomass a season → 2 compost, and 1 biomass to a digester beside it.                                                                                                | Research: VAC                  |
| Duck House                  | 3    | 0       | Next to a rice paddy or chinampa             | Ducks keep the weeds and snails down: the paddies and chinampas beside it need no compost bonus to reach their best (+1 food each, up to 2). Not in winter.                                | Research: rice-duck            |
| Willow Edge                 | 1    | 0       | An edge between a bed and water, as a hedge  | Anchors the bed: the lake wind can't damage what stands on it. No Harmony, as hedgerows (DECISIONS.md).                                                                                    | Research: chinampas (ahuejote) |
| Floating Solar, Canal Wheel |      |         |                                              | See Energy and heat.                                                                                                                                                                       |                                |

Shared, as the Reach: Composter ★, Workshop ★, Salvage Yard ★, Fish Pond, Rice-fish Paddy (on
beds), Reed Bed, Bathhouse, Cistern, Greenhouse, Apiary, Commons Plaza, Seedbank Library, Tree
Nursery, Pollinator Meadow, Mushroom Cellar. Not here: the Floodplain Farm (the chinampa takes its
place), Orchard, Weir, Levee, and the coast's, Highland's and desert's own buildings.

## Combos

| Layer     | Combo                   | How                                                                                                                   | Effect                                                           | Source                                        |
| --------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Chain     | Dyke Loop               | Mulberry Dyke → leaves → Silk House; Mulberry Dyke → droppings → Fish Pond → mud → Mud Boat → compost → Mulberry Dyke | +1 on each building in the loop; the mud boat lifts 1 more       | Research: mulberry dykes (the archetype loop) |
| Chain     | VAC Loop                | Stilt House → scraps → Pig Pen → manure → Chinampa → biomass → Pig Pen, with a fish pond beside the house             | +1 food on the chinampa and the pond; the pen's compost +1       | Research: VAC                                 |
| Chain     | Clean Lake Loop         | Stilt House → grey water → Wastewater Fishery → nutrient water → Chinampa                                             | +1 on each; the fishery takes 1 more grey                        | Research: East Kolkata                        |
| Chain     | Kitchen Loop, Bath Loop | As the Reach                                                                                                          | As the Reach                                                     | DESIGN.md                                     |
| Formation | Floating Garden         | 4 chinampas in a ring around one shallows tile left open                                                              | The open tile never silts; each chinampa +1 food in summer       | Research: chinampas                           |
| Formation | Willow Shore            | 4 willow edges joined end to end                                                                                      | Nothing within 2 is exposed to the lake wind; herons come sooner | Research: chinampas                           |
| Adjacency | Duck and Rice           | A duck house next to a rice-fish paddy                                                                                | The paddy needs 1 less water                                     | Research: rice-duck                           |
| Evolution | Rice-Duck Paddy         | A rice-fish paddy beside a duck house for 4 seasons                                                                   | +1 food, and it returns 1 more nutrient water                    | Research: rice-duck                           |
| Evolution | Floating Market         | A commons plaza next to 2 stilt houses and the water                                                                  | +2 wellbeing; homes within 2 walk half as far to work            | Research: VAC; new                            |

About 8 lake tunings (Deeper Dredging, Silk Trade, Clean Canals, Many Harvests, Fish Ladders,
Willow Planting, Reed Thatch, Night Fishing) and 2 charters join the shared pool: **Canal Keepers**
(the lake never blooms, but every bed costs 1 more) and **Water First** (chinampas can't be built
past half the shallows, but fisheries make 1 more).

## Wonder, wildlife and festivals

| System    | Lake Gardens                                                                                                                                                                                                                                                                                                                                                                               | Source                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------- |
| Wonder    | **The Floating City**: a 7-tile flower of raised beds and canals around a willow island, built on shallows. From era 3, needing a closed Dyke Loop and 3 chinampas; 60 materials and 30 biomass. Finished: the lake never silts or blooms, chinampas +1 food, +60 to the score, the Graft a tier higher, and the Bloom era's goal. Its site is checked against 40 maps before it is fixed. | EXPANSION.md (one wonder per biome) |
| Wildlife  | **Axolotls** (Harmony 20, clean canals between chinampas: chinampas within 2 +1 food in summer, as they eat the pests); **herons** (40, the reed fringe beside a fishery: fisheries within 2 +1 food); **kingfishers** (50, willow edges beside open water: +1 wellbeing a pair); **flamingos** (70, a clean lake of 12 shallows or more: +1 wellbeing a flock).                           | E4's pattern; research: chinampas   |
| Festivals | **Flower Boats** (spring, 5 food: +3 wellbeing, and high water leaves twice the silt); **Silk Fair** (summer, 5 materials: +3 wellbeing, and silk houses run once more that summer); **Lanterns on the Water** (autumn, 5 materials, every night slot powered: +3 wellbeing; wildlife on screen).                                                                                          | E4's pattern; new                   |

## Root City, regions and twists

| Item          | Proposal                                                                                                                                                                                                                                                                                                                        | Source        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Joins         | After the Sun Desert, at a mark to decide in review (see Open questions). DESIGN.md names the Volcanic Isle "after the first Landmark"; Lake Gardens could come before it or after.                                                                                                                                             | DESIGN.md     |
| First run     | Guided first year, opening with what is new: making land, the mud, grey water as feed.                                                                                                                                                                                                                                          | As the desert |
| Canal Quarter | A new district, earned by water-led food (food from chinampas, fisheries and fish ponds as a share of all food; full at half). Perk: fish ponds +1 food in winter (Seedling), also autumn (Sapling), also spring (Heartwood). Adds the **Mud Boat** to every biome's drafts (dredging reservoirs, lakes and ponds for compost). | New           |
| Water Market  | A landmark: the Canal Quarter next to the Orchard Ward. Food beyond storage keeps one season longer before it rots, in every biome.                                                                                                                                                                                             | New           |
| Regions       | Open Lake as it is; Delta Mouth (a river runs through, with a flood); Reed Marsh (fringe over a third of the map, little deep water); Drowned Town (7 ruins, 36 salvage each); Island Chain (many small islands, few shallows).                                                                                                 | New           |
| Twists        | The shared ones that fit (Drought Year, Lean Start, Big Families, Scavengers, Fair Weather), and three of its own: Dry Season (the lake shrinks a ring in summer), Bloom Year (it blooms above 2, not 4), Monsoon (high water in autumn too; chinampas +1).                                                                     | New           |
| Tempest       | Per biome, as the others.                                                                                                                                                                                                                                                                                                       | DESIGN.md     |

## Year 1 walkthrough (to become the lake's golden test)

A proposal to check against the simulation once it exists, before it is proposed as a golden
test, as the desert's was.

| Season | Build                                                                                     | What it teaches                                                                     | Source |
| ------ | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Spring | Two chinampas on the shallows by the camp, a salvage yard on the drowned town, a workshop | Land is made, not found; high water floods the fringe but not the beds              | New    |
| Summer | A stilt house, a wastewater fishery beside it                                             | Grey water is feed when something eats it; a lake left dirty blooms                 | New    |
| Autumn | A mud boat between the chinampas and the fishery, a willow edge on the windward bed       | The mud the fishery leaves is the beds' compost; the lake wind finds open edges     | New    |
| Winter | A mulberry dyke by the camp's fish pond                                                   | Low water: dredging is easiest; the dyke starts the loop that becomes the Dyke Loop | New    |

## Build plan

Each step ends with tests and a commit; the other four biomes play exactly as before throughout
(their golden tests unchanged).

| Step | What                                                                                                                                                             | Done when                                                                                                 | Source        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------- |
| LG1  | **Lake rules**: raised beds (shallows to bed), pond mud (a per-tile counter, settling, dredging, silting), the lake's grey water and its bloom. Inert elsewhere. | Every new rule has a unit test; the other biomes' golden tests are unchanged.                             | New           |
| LG2  | **Lake simulation**: map generator, tiles, events, buildings, fisheries.                                                                                         | Every new rule has a unit test; the Year 1 walkthrough fits the numbers and is proposed as a golden test. | As the desert |
| LG3  | **Combos and balance**: combos, tunings, charters, the Almanac; bots that make land, dredge and keep the lake clean.                                             | Every combo triggers in a unit test; the bots' Heartwood share is within 10 points of the Reach's.        | As the desert |
| LG4  | **On screen**: water that rises and falls, mud on the shallows, beds appearing, the bloom's green; an art guide.                                                 | A lake run plays to the end with mouse and keyboard.                                                      | As the desert |
| LG5  | **In Root City**: the Canal Quarter, the Water Market, regions, twists, the guided first run.                                                                    | Runs move between the five biomes with progression kept (an e2e).                                         | DESIGN.md     |
| LG6  | **Wonder, wildlife, festivals**: the Floating City, the lake's animals and festivals.                                                                            | As the desert's SD6.                                                                                      | EXPANSION.md  |

## Open questions

| Question                          | Options                                                                                                                                                                            | Source                    |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| The name                          | Lake Gardens; the Floating Gardens; Chinampa Lakes; the Delta.                                                                                                                     | New                       |
| When it joins                     | After 10 districts; after the second landmark; or before the Volcanic Isle, after the first landmark (DESIGN.md gives that mark to the Isle).                                      | DESIGN.md                 |
| Mud: per tile or a store?         | Per tile (proposed): visible on the map, a reason to place boats; or one lake-wide store, simpler to read.                                                                         | New                       |
| Silting                           | Should a silted tile become reed fringe (land) for good if left, as real lakes fill in? Proposed: no, it stays silted shallows until dredged.                                      | Research: chinampas       |
| Land creation and the soil ladder | Beds start at meadow (proposed), or at scrub so that mud is needed to make them fertile.                                                                                           | New                       |
| A new resource for silk           | Proposed: no, silk is materials (one fewer thing to track).                                                                                                                        | DESIGN.md (few resources) |
| The labour pattern                | The research's failure mode for these systems is labour: mud moved by hand. Here that cost is workers on mud boats and pens, which keeps it honest; is that enough of a trade-off? | Research: patterns        |
