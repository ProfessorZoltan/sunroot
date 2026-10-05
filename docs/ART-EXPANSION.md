# Art for the water expansion

What the water expansion ([EXPANSION.md](EXPANSION.md)) needs drawn, in the order the milestones
need it. Everything follows the existing art spec ([ART.md](ART.md) and
[`art/incoming/README.md`](../art/incoming/README.md)) unless a section says otherwise: the same
papercraft style, light from the upper left, a summer `id.png` and a winter `id.winter.png` for
everything that sits on the map, and files delivered to `art/incoming/` as before.

Anything without art falls back to a procedural drawing, so nothing here blocks the game.

Root City's art (the districts at each tier, the Heartwood and the Sun Tree, the landmarks) has
its own guide: [ART-CITY.md](ART-CITY.md).
The citizens walking between homes and work, and the leaping fish, have theirs:
[ART-PEOPLE.md](ART-PEOPLE.md).

**Delivered (E2 and E3):** every building, evolved form, channel and hedgerow piece and the Sluice
Gate are in `art/incoming/buildings/`, tiles in `art/incoming/tiles/`, and in the game. The Singing
Spire's rotor pivot, (257, 195), is measured by the importer from its hub, as the manifest has none.
The wildlife and festival art is in the game (E4): the importer brings the animals and props at half size into `src/art/wildlife/` and `src/art/festivals/`, and the festival cards as WebP. The game draws animals and props half as big again as tile scale, so they read at the usual zoom. The Great Water Garden's art is in the game too (E5): the importer brings it at half size into `src/art/wonders/`, with an icon from the finished garden; the game draws it in place of its 7 tiles, its centre tile on the tile it is built on.

**Delivered (the coast and the Well):** every coast tile (the sea with 3 summer looks; mudflat,
saltmarsh and dune with one each), the headland (`hill.coast.png`, the coast's own look for its
hills), all 13 coast buildings and 3 evolutions, the Tide Turbine's rotor (its pivot, (256, 366),
measured from its hub), the lighthouse's lantern, the 4 animals in summer and winter, Kite Day's
and the Harvest of the Sea's cards, and the Tidal Lagoon finished, in winter and at its 3 stages;
and the Well with its own icon (`well.icon.png`). All in the game.

**Delivered (the Highland and the Sun Desert):** all of both, in the game (their sections below).

## Order

| Milestone                    | Needs art? | What to draw first                                                                                                                        | Source                                      |
| ---------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| E1. Water in the simulation  | No         | —                                                                                                                                         | EXPANSION.md, Build plan                    |
| E2. Water on screen          | Yes        | Irrigation Channel pieces and the Sluice Gate                                                                                             | EXPANSION.md, Build plan                    |
| E3. Willow Reach v2 content  | Yes        | 6 new buildings and 7 evolutions                                                                                                          | EXPANSION.md, New buildings; New evolutions |
| E4. Wildlife and festivals   | Yes        | 4 animals, 3 festival cards, 2 props                                                                                                      | EXPANSION.md, Bigger systems                |
| E5. Great Water Garden       | Yes        | The 7-hex wonder and its build stages                                                                                                     | EXPANSION.md, Bigger systems                |
| B4. The coast on screen      | Yes        | Its 4 tiles, then the Croft and Tide Turbine                                                                                              | proposals/windswept-coast.md, Build plan    |
| B5. The coast in Root City   | Yes        | The Tide Mill and the Estuary Turbine                                                                                                     | proposals/windswept-coast.md, Build plan    |
| B6. The coast's wonder       | Yes        | The Tidal Lagoon, 4 animals, 2 festival cards                                                                                             | proposals/windswept-coast.md, Build plan    |
| HL4. The Highland on screen  | Yes        | Its 2 tiles, then the Terrace Farm, Glen Farm, Hill Turbine and Bothy                                                                     | proposals/highland.md, Build plan           |
| HL6. The Highland's wonder   | Yes (done) | The Cloud Terraces, 4 animals, 2 festival cards                                                                                           | proposals/highland.md, Build plan           |
| SD4. The desert on screen    | Yes (done) | Its 5 tiles and the wadi bank's and old array's looks, then the Oasis Garden, Mud-brick House, Wind Tower and Solar Canopy's desert dress | proposals/sun-desert.md, Build plan         |
| SD5. The desert in Root City | Yes (done) | The Sun Quarter district and the Glassworks landmark ([ART-CITY.md](ART-CITY.md))                                                         | proposals/sun-desert.md, Build plan         |
| SD6. The desert's wonder     | Yes (done) | The Solar Oasis, 4 animals, 3 festival cards                                                                                              | proposals/sun-desert.md, Build plan         |

## The standard frame (reminder)

| Measure                                  | Value                                                                            | Source                   |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| Frame                                    | 512 × 640 px, transparent, untrimmed                                             | `art/incoming/README.md` |
| Tile width                               | 400 px                                                                           | `art/incoming/README.md` |
| Tile centre (top face)                   | (256, 373.5)                                                                     | `art/incoming/README.md` |
| Top-face corners, clockwise from the top | (256, 168), (456, 283.47), (456, 463.47), (256, 579), (56, 463.47), (56, 283.47) | `art/incoming/README.md` |
| Paper side band                          | 32 px, lowest point y 611                                                        | `art/incoming/README.md` |

## The Well (delivered)

Homes now walk to drinking water (DECISIONS.md, Walks to water), and the **Well** is the cheap way
to bring water to them. Its art and icon are in the game.

| Piece | Files                                       | Notes                                                                                                                                                     | Source       |
| ----- | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Well  | `well.png`, `well.winter.png`, and its icon | On the standard frame, a small stone well with a little gabled roof and a bucket, about a quarter of the tile wide. Winter: snow on the roof and the rim. | DECISIONS.md |

## Hedgerows on edges (delivered)

Hedgerows now run along the **edges between tiles**, not across a tile (DECISIONS.md, Hedgerows on
edges), so the hub-and-arms hedgerow pieces below no longer fit. Each tile draws the hedges on
three of its sides; the tile next door draws the other three. Delivered in
`art/incoming/hedgerows_modified/`, drawn on their own with guides marking each side;
`scripts/fit-hedges.ts` fits them onto the frame below (the hub-and-arms pieces are retired). The
spec:

| Piece                      | Files                                                 | Notes                                                                                                                                                             | Source       |
| -------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Hedge along the east side  | `hedgerow.edge.e.png`, `hedgerow.edge.e.winter.png`   | On the standard frame, centred on the tile's east side, from (456, 283) to (456, 463), as if the tile were there. A hedge about 60 px high, standing on the line. | DECISIONS.md |
| Hedge along the north-east | `hedgerow.edge.ne.png`, `hedgerow.edge.ne.winter.png` | Along the side from (256, 168) to (456, 283).                                                                                                                     | DECISIONS.md |
| Hedge along the north-west | `hedgerow.edge.nw.png`, `hedgerow.edge.nw.winter.png` | Along the side from (56, 283) to (256, 168).                                                                                                                      | DECISIONS.md |

The ends should taper or stop at a small shrub, so pieces meeting at a corner (up to three) look
joined. Winter: bare branches with a few berries, as before.

## Connecting pieces: Irrigation Channel and Hedgerow

Channels and hedgerows run as paths across tiles, so each is delivered as a **hub** and **six
arms**, all in the standard frame. The game draws the hub, then each arm whose neighbour is part of
the same path; an unconnected hub stands alone. Arms run from the tile centre to the middle of an
edge so they line up with the neighbouring tile's arm.

| Arm   | Runs from the centre to the edge midpoint at | Neighbour's tile centre | Source                                |
| ----- | -------------------------------------------- | ----------------------- | ------------------------------------- |
| `.ne` | (356, 225.74)                                | (456, 78.03)            | `src/render/layout.ts` (hex geometry) |
| `.e`  | (456, 373.47)                                | (656, 373.5)            | `src/render/layout.ts`                |
| `.se` | (356, 521.24)                                | (456, 668.97)           | `src/render/layout.ts`                |
| `.sw` | (156, 521.24)                                | (56, 668.97)            | `src/render/layout.ts`                |
| `.w`  | (56, 373.47)                                 | (−144, 373.5)           | `src/render/layout.ts`                |
| `.nw` | (156, 225.74)                                | (56, 78.03)             | `src/render/layout.ts`                |

- Keep each arm's width constant (a channel about 70 px across, a hedge about 80 px) and end it
  square at the edge midpoint, so two arms meet without a seam.
- The hub should cover the joints of any combination of arms (a round basin or a clump of shrubs
  about 110 px across, centred on the tile centre).
- **Channel:** a lined ditch (stone, timber or wattle edging) with a damp bed and a little shallow
  water. The game draws the flowing water on top and thins it as water is used, so don't paint
  strong ripples or a flow direction.
- **Hedgerow:** a mixed hedge of shrubs and small trees with a few flowers, about 60 px high.
- Groundless: the terrain shows around them.

## Buildings

| Name               | Id                  | What it is                                       | Files                                                                                               | Notes                                                                                                                   | Source                      |
| ------------------ | ------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Irrigation Channel | `irrigationChannel` | A lined ditch carrying water from the river      | `irrigationChannel.png` (hub), `irrigationChannel.ne.png` … `.nw.png` (6 arms), each with `.winter` | See Connecting pieces. Winter: a skin of ice along the edges.                                                           | EXPANSION.md, New buildings |
| Sluice Gate        | `sluiceGate`        | The wooden gate where a channel leaves the river | `sluiceGate.png`, `.winter`                                                                         | Small (about 120 px wide), centred on the tile centre; the game moves it to the river edge of the channel's first tile. | EXPANSION.md, Water system  |
| Cistern            | `cistern`           | A stone or timber tank that stores water         | `cistern.png`, `.winter`                                                                            | Reads as a container of water: an open top or a visible water line.                                                     | EXPANSION.md, New buildings |
| Reed Bed           | `reedBed`           | A small wetland of reeds that cleans grey water  | `reedBed.png`, `.winter`                                                                            | Ground cover like the Fish Pond: water and reeds across most of the footprint. Tolerates floods.                        | EXPANSION.md, New buildings |
| Bathhouse          | `bathhouse`         | A warm public bathhouse                          | `bathhouse.png`, `.winter`, `bathhouse.lit.png`                                                     | A plume of steam is drawn by code: show where the vent or chimney is. Lit windows at night.                             | EXPANSION.md, New buildings |
| Rice-fish Paddy    | `riceFishPaddy`     | A flooded field of rice with fish in it          | `riceFishPaddy.png`, `.winter`                                                                      | Carries its own ground, like the Weir: water-filled terraces with low earth bunds. Winter: drained and stubbled.        | EXPANSION.md, New buildings |
| Mushroom Cellar    | `mushroomCellar`    | A cellar dug into an earth mound                 | `mushroomCellar.png`, `.winter`, optional `mushroomCellar.lit.png`                                  | Low and turf-roofed with a door; logs stacked outside.                                                                  | EXPANSION.md, New buildings |
| Hedgerow           | `hedgerow`          | A hedge that shelters buildings from storms      | `hedgerow.png` (hub), `hedgerow.ne.png` … `.nw.png` (6 arms), each with `.winter`                   | See Connecting pieces. Winter: bare branches with a few berries.                                                        | EXPANSION.md, New buildings |

## Evolutions

Each is a building that another one turns into, so it should read as the same place grown up.

| Name              | Id                | Grows from    | What it is                                                  | Files                                                                                    | Notes                                                                                                            | Source                       |
| ----------------- | ----------------- | ------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Food Forest       | `foodForest`      | Orchard       | Layered planting: fruit canopy, shrubs, herbs, ground cover | `foodForest.png`, `.winter`                                                              | Denser and wilder than the Orchard.                                                                              | EXPANSION.md, New evolutions |
| Aquaponics Hall   | `aquaponicsHall`  | Greenhouse    | A glasshouse with fish tanks under the beds                 | `aquaponicsHall.png`, `.winter`, `aquaponicsHall.lit.png`                                | Visible tanks or water. Lit at night.                                                                            | EXPANSION.md, New evolutions |
| Canal-top Solar   | `canalTopSolar`   | Solar Canopy  | Solar panels raised over a channel                          | `canalTopSolar.png`, `.winter`                                                           | Groundless; the channel pieces are drawn under it, so leave the ditch visible between the legs.                  | EXPANSION.md, New evolutions |
| Beaver Dam        | `beaverDam`       | Weir          | The weir rebuilt by beavers in sticks and mud               | `beaverDam.png`, `.winter`                                                               | Carries its own river tile, like the Weir.                                                                       | EXPANSION.md, New evolutions |
| Singing Spire     | `singingSpire`    | Wind Spire    | A wind spire wrapped in flowers, with chimes                | `singingSpire.png`, `.winter`, `singingSpire.rotor.png`, `singingSpire.rotor.winter.png` | Carries its own hill tile, like the Wind Spire. Please give the rotor's pivot in the manifest.                   | EXPANSION.md, New evolutions |
| Old World Archive | `oldWorldArchive` | Salvage Yard  | Ruins turned into a library                                 | `oldWorldArchive.png`, `.winter`, `oldWorldArchive.lit.png`                              | Carries its own ruin tile, like the Salvage Yard. Tall. Lit at night.                                            | EXPANSION.md, New evolutions |
| Coppice Wood      | `coppiceWood`     | Woodland tile | Woodland cut to stools with straight new shoots             | `coppiceWood.png`, `.winter`, optional `coppiceWood.regrowing.png`                       | Carries its own tile. The optional version is half grown back, for the 2 seasons it takes to return to woodland. | EXPANSION.md, New evolutions |

## Wildlife

Small animated sprites that move between their habitat tiles. They are not on the standard frame.

| Name      | Id         | Files                                                                                             | Notes                                | Source                 |
| --------- | ---------- | ------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------- |
| Wild bees | `wildBees` | `wildBees.1.png` … `.3.png`                                                                       | A loose swarm; anchor at its centre. | EXPANSION.md, Wildlife |
| Otter     | `otter`    | `otter.swim.1.png`, `otter.swim.2.png`, `otter.rest.png`                                          | Swimming frames show the waterline.  | EXPANSION.md, Wildlife |
| Beaver    | `beaver`   | `beaver.swim.1.png`, `beaver.swim.2.png`, `beaver.carry.png`                                      | Carry: holding a branch.             | EXPANSION.md, Wildlife |
| Deer      | `deer`     | `deer.walk.1.png` … `.4.png`, `deer.graze.1.png`, `deer.graze.2.png`, and the same with `.winter` | A walk cycle of 4 frames.            | EXPANSION.md, Wildlife |

| Measure | Value                                                                                     | Source    |
| ------- | ----------------------------------------------------------------------------------------- | --------- |
| Frame   | 128 × 128 px, transparent                                                                 | This spec |
| Scale   | The same as the tiles (a tile is 400 px across), so a deer is about 90 px long            | This spec |
| Anchor  | Bottom centre (64, 120), where the animal touches the ground or water; bees at the centre | This spec |
| Facing  | Right; the game mirrors them                                                              | This spec |

## Festivals

| Name             | Id                | Files                            | Notes                                                                                                          | Source                  |
| ---------------- | ----------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Flood Fair       | `floodFair`       | `floodFair.card.png`             | Spring: boats, bunting, people on the silt.                                                                    | EXPANSION.md, Festivals |
| Harvest Festival | `harvestFestival` | `harvestFestival.card.png`       | Autumn: long tables, baskets, sheaves.                                                                         | EXPANSION.md, Festivals |
| Lantern Night    | `lanternNight`    | `lanternNight.card.png`          | Winter: paper lanterns, snow, lit windows.                                                                     | EXPANSION.md, Festivals |
| Bunting          | `bunting`         | `bunting.png`                    | A short string of paper flags that the game hangs between buildings during a festival. Anchor at its left end. | EXPANSION.md, Festivals |
| Lantern          | `lantern`         | `lantern.png`, `lantern.lit.png` | One hanging paper lantern. Anchor at the top of its string.                                                    | EXPANSION.md, Festivals |

Card illustrations are 768 × 480 px (landscape), in the same style but as a vignette rather than a
tile. Props are 128 × 128 px at tile scale.

## The Great Water Garden (E5)

A wonder over 7 hexes: one centre tile and its 6 neighbours, in a flower shape. Built over 4
seasons, so it also needs 3 stages of construction.

| Measure              | Value                                                                                           | Source                                                         |
| -------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Frame                | 1536 × 1280 px (three standard frames wide, two tall)                                           | This spec                                                      |
| Centre tile's centre | (768, 669)                                                                                      | `src/render/layout.ts` (rows are 295.47 px apart, columns 400) |
| Neighbours' centres  | E (1168, 669), W (368, 669), NE (968, 373.5), NW (568, 373.5), SE (968, 964.5), SW (568, 964.5) | `src/render/layout.ts`                                         |
| Topmost top vertex   | y 168                                                                                           | `src/render/layout.ts`                                         |
| Lowest side band     | y 1202                                                                                          | `src/render/layout.ts`                                         |

| Name               | Id                 | Files                                                                            | Notes                                                                                                                                                             | Source                     |
| ------------------ | ------------------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Great Water Garden | `greatWaterGarden` | `greatWaterGarden.png`, `.winter`, `greatWaterGarden.stage1.png` … `.stage3.png` | Carries its own ground over all 7 tiles: pools, reed margins, stepping stones, a pavilion at the centre. Stages: dug and staked; pools filling; planted but bare. | EXPANSION.md, Biome wonder |

## The Windswept Coast (B4 to B6)

The second biome ([proposals/windswept-coast.md](proposals/windswept-coast.md)). Everything here is
delivered and in the game. Same frame, light and
seasons as everything else: a summer `id.png` and a winter `id.winter.png`, delivered to the same
folders of `art/incoming/` as the Reach's (`tiles/`, `buildings/`, `wildlife/`, `festivals/`,
`wonders/`); `scripts/import-art.ts` takes every biome's names. A coast winter is grey and wet more
than white: frost on the dunes, ice only in the saltmarsh pools.

All of it is delivered (see the top of this guide). The game draws these in code, so they weren't painted: the tide (the sea rising over the mudflat by
night and falling back by day), the king tide's salt marks, the smoke over a working smokehouse,
lit windows from a `.lit.png` (as before), and a rotor's turn from a `.rotor.png` (as the Wind
Spire's).

### Tiles

| Tile      | Id          | What it is                                       | Notes                                                                                                                                                                                          | Source        |
| --------- | ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| Sea       | `sea`       | Open water off the shore                         | Groundless top face of deep blue-green water with a soft swell; the side band dark water, not paper earth. Up to 3 variants: `sea.png`, `sea-2.png`, `sea-3.png`; one winter `sea.winter.png`. | Proposal, Map |
| Mudflat   | `mudflat`   | Wet sand and mud the tide covers and uncovers    | Glistening grey-brown with ripple marks and a few shells and worm casts. The game floods it with code-drawn water at night.                                                                    | Proposal, Map |
| Saltmarsh | `saltmarsh` | Low marsh of samphire and sea lavender, in pools | Green-grey turf cut by small creeks and pans of standing water; purple flecks of sea lavender in summer.                                                                                       | Proposal, Map |
| Dune      | `dune`      | Sand hills with marram grass                     | Pale sand in two or three soft ridges, sparse marram tufts; the healing ladder's lowest step, below barren.                                                                                    | Proposal, Map |
| Headland  | `hill`      | The coast's hills: rocky headlands over the sea  | Optional: the Reach's hill tile serves until then. Grass over grey rock, short cliffs on the seaward side.                                                                                     | Proposal, Map |

### Buildings

| Name                 | Id                 | What it is                                        | Files                                                          | Notes                                                                                                                   | Source              |
| -------------------- | ------------------ | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Croft                | `croft`            | A small field strip with a stone dyke             | `croft.png`, `.winter`                                         | Carries its own ground, like the Floodplain Farm: lazy-beds of potatoes and oats, a drystone wall. Winter: bare ridges. | Proposal, Buildings |
| Tide Turbine         | `tideTurbine`      | An underwater turbine moored in the tidal race    | `tideTurbine.png`, `.winter`, optional `tideTurbine.rotor.png` | On the sea tile: a float or tower above the water, the blades just under it. Give the rotor's pivot if it has one.      | Proposal, Buildings |
| Wave Buoy            | `waveBuoy`         | A bobbing wave-energy float                       | `waveBuoy.png`, `.winter`                                      | Small, bright, on open sea.                                                                                             | Proposal, Buildings |
| Kelp Farm            | `kelpFarm`         | Kelp grown on long lines from floats              | `kelpFarm.png`, `.winter`                                      | On the sea tile: rows of floats with brown fronds under the surface, a small boat.                                      | Proposal, Buildings |
| Oyster Reef          | `oysterReef`       | Oysters on stakes and racks on the mudflat        | `oysterReef.png`, `.winter`                                    | Low trestles and shell heaps; reads under a shallow film of water too.                                                  | Proposal, Buildings |
| Beachcombing Yard    | `beachcombingYard` | Sorted driftwood, rope and wreckage on the dune   | `beachcombingYard.png`, `.winter`                              | A lean-to, a cart, piles of timber and floats, nets drying.                                                             | Proposal, Buildings |
| Dune Grass           | `duneGrass`        | Planted marram grass that holds the sand          | `duneGrass.png`, `.winter`                                     | Groundless: dense marram in rows with fencing; the dune tile shows around it.                                           | Proposal, Buildings |
| Sea Wall             | `seaWall`          | A stone and timber sea wall                       | `seaWall.png`, `.winter`                                       | Faces the sea along the tile's seaward half; low enough to see the tile behind. Three in a row make a Breakwater.       | Proposal, Buildings |
| Lighthouse           | `lighthouse`       | A white lighthouse on a headland                  | `lighthouse.png`, `.winter`, `lighthouse.lit.png`              | Carries its own hill tile, like the Wind Spire. Tall. The lit file lights the lantern room.                             | Proposal, Buildings |
| Smokehouse           | `smokehouse`       | A tarred hut for smoking fish                     | `smokehouse.png`, `.winter`                                    | Racks of fish inside, a vent at the ridge: smoke is drawn by code, so show where it rises.                              | Proposal, Buildings |
| Desalinator          | `desalinator`      | A small plant that makes fresh water from the sea | `desalinator.png`, `.winter`                                   | Tanks and a pipe running seaward; solar-era, clean lines, not industrial.                                               | Proposal, Buildings |
| Tide Mill (B5)       | `tideMill`         | A mill on the mudflat that fills with the tide    | `tideMill.png`, `.winter`                                      | A small mill house with its pond walled off from the sea and an undershot wheel. The Tidal Quarter's card.              | Proposal, Energy    |
| Estuary Turbine (B5) | `estuaryTurbine`   | Turbines in a low barrage at the stream's mouth   | `estuaryTurbine.png`, `.winter`                                | Carries its own river tile, like the Weir: a low barrage with a walkway and a small tower. The Estuary Works' gift.     | Proposal, Energy    |

### Evolutions

| Name          | Id             | Grows from   | What it is                                      | Files                         | Notes                                                | Source           |
| ------------- | -------------- | ------------ | ----------------------------------------------- | ----------------------------- | ---------------------------------------------------- | ---------------- |
| Machair Croft | `machairCroft` | Croft        | The croft on flower-rich machair grassland      | `machairCroft.png`, `.winter` | As the Croft, with wildflowers through the strips.   | Proposal, Combos |
| Kelp Forest   | `kelpForest`   | Kelp Farm    | The kelp grown wild among the reefs             | `kelpForest.png`, `.winter`   | Fronds reaching the surface, a seal's head.          | Proposal, Combos |
| Rock Pool     | `rockPool`     | Salvage Yard | An old harbour ruin the sea has moved back into | `rockPool.png`, `.winter`     | Carries its own ruin tile: broken quay, pools, weed. | Proposal, Combos |

### The coast's wonder, animals and festivals (B6)

Delivered and in the game, like the rest of the coast.

| Name               | Id                | Files                                                                  | Notes                                                                                                                                                                                                                       | Source              |
| ------------------ | ----------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Tidal Lagoon       | `tidalLagoon`     | `tidalLagoon.png`, `.winter`, `tidalLagoon.stage1.png` … `.stage3.png` | On the Great Water Garden's frame (1536 × 1280): a ring of sea wall around a lagoon over mudflat and the sea's edge, a turbine house at the centre. Stages: staked out; the wall rising; the wall closed, the lagoon empty. | Proposal, Wonder    |
| Terns              | `terns`           | `tern.fly.1.png`, `tern.fly.2.png`, `tern.rest.png`                    | White with a black cap; over the dunes.                                                                                                                                                                                     | Proposal, Wildlife  |
| Seals              | `seals`           | `seal.swim.1.png`, `seal.swim.2.png`, `seal.rest.png`                  | Grey, hauled out on the mudflat at rest.                                                                                                                                                                                    | Proposal, Wildlife  |
| Puffins            | `puffins`         | `puffin.1.png`, `puffin.2.png`                                         | Small, upright, on the headland by the lighthouse.                                                                                                                                                                          | Proposal, Wildlife  |
| Dolphins           | `dolphins`        | `dolphin.1.png` … `.3.png`                                             | A back and fin rising from the sea, a leap at the top.                                                                                                                                                                      | Proposal, Wildlife  |
| Kite Day           | `kiteDay`         | `kiteDay.card.png`                                                     | Spring: kites over a headland, people on the dunes.                                                                                                                                                                         | Proposal, Festivals |
| Harvest of the Sea | `harvestOfTheSea` | `harvestOfTheSea.card.png`                                             | Autumn: long tables on the shore, baskets of fish, kelp and oysters.                                                                                                                                                        | Proposal, Festivals |

Animals follow the wildlife frame above (128 × 128, bottom-centre anchor, facing right), and an
optional `.winter` of any frame. The game shows these frames: terns fly between frames 1 and 2 and
rest on `tern.rest`; seals swim on frames 1 and 2 and rest hauled out; puffins alternate their 2;
dolphins rise and leap through 1 to 3 and show 1 when still. The Tidal Lagoon gives its icon from
the finished frame, as the Garden does. The coast's Lantern Night uses the Reach's card, and its
festivals the Reach's bunting and lanterns.

## The Highland (HL4 and HL6)

The third biome ([proposals/highland.md](proposals/highland.md)): a glen with a stream falling
down it, slopes climbing to crags, bogs and old mines on the shoulders. Everything here is drawn
in code until hand-made art comes, so any piece can arrive on its own. **Delivered and imported
(all of it, HL6 included);** the guide stays as the reference for changes. Same frame, light and
seasons as everything else: a summer `id.png` and a winter `id.winter.png`, delivered to the
usual folders of `art/incoming/` (`tiles/`, `buildings/`, `wildlife/`, `festivals/`,
`wonders/`). A Highland winter is white: snow lies on everything at height 2 and above, and the
stream runs thin between icy edges.

**Height.** Tiles stand at heights 0 to 3, and the game raises each tile 7 px a step at map
scale (56 px on the 512 × 640 frame) and draws the cliff beneath it, banded a step at a time. So
draw every tile and building as on level ground, on the standard frame: **don't paint height,
cliffs or a deeper side band.** Tiles shared with the Reach (barren, scrub, meadow, woodland,
ruin) use the Reach's art unless you give the glen its own look (below).

The game also draws these in code, so don't paint them: the cliffs, the snowmelt's flood on the
glen floor, the pump's lift (a blue chevron and drops at a pump station that lifted water), snow
lying on a building that is snowed under (a solar canopy high up in winter), lit windows from a
`.lit.png` (as before), and a rotor's turn from a `.rotor.png` (as the Wind Spire's).

### Tiles

| Tile             | Id                                  | What it is                                    | Notes                                                                                                                                          | Source                        |
| ---------------- | ----------------------------------- | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| Crag             | `crag`                              | Bare rock on the tops (height 3)              | Grey rock in broken slabs, lichen, a few tufts in the cracks. Two summer looks, `crag.png` and `crag-2.png`; winter: snow in every hollow.     | proposals/highland.md         |
| Bog              | `bog`                               | Blanket bog on the shoulders (heights 1 to 2) | Olive-brown peat with dark pools, white cotton grass and red sphagnum. Two summer looks; winter: the pools frozen, the cotton grass gone.      | proposals/highland.md         |
| The glen's looks | `meadow.glen.png`, `scrub.glen.png` | Optional: the glen's own look for these types | As the coast's headlands (`hill.coast.png`): the game uses them in the Highland in place of the Reach's. Hill pasture, heather, bracken, rock. | DECISIONS.md, The coast's art |

### Buildings

| Name         | Id            | What it is                                      | Files                                                                      | Notes                                                                                                                                                                       | Source                           |
| ------------ | ------------- | ----------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Terrace Farm | `terraceFarm` | Stepped fields held up the slope by stone walls | `terraceFarm.png`, `.winter`                                               | Carries its own ground, as the Croft: 3 narrow strips of oats and potatoes, each held by a drystone wall, stepping across the tile. Winter: bare strips, snow on the walls. | proposals/highland.md, Buildings |
| Glen Farm    | `glenFarm`    | A field on the flat floor by the stream         | `glenFarm.png`, `.winter`                                                  | Carries its own ground: a broad field of barley in rows, a fence. The snowmelt floods it each spring; it takes no harm.                                                     | proposals/highland.md, Buildings |
| Shieling     | `shieling`    | A summer hut on the high pasture                | `shieling.png`, `.winter`                                                  | Groundless: a low stone hut with a turf roof, a pen, 2 or 3 sheep. Winter: empty, the door shut, snow on the turf.                                                          | proposals/highland.md, Buildings |
| Hill Turbine | `hillTurbine` | A small hydro wheel where the stream drops      | `hillTurbine.png`, `.winter`, `hillTurbine.rotor.png`                      | Beside the stream: a stone wheel-house, a wooden wheel or a little turbine on its side. The rotor turns slowly; give it an orange hub (the importer finds its pivot there). | proposals/highland.md, Energy    |
| Bothy        | `bothy`       | A stone home with its own stove                 | `bothy.png`, `.winter`, `bothy.lit.png`                                    | Groundless: thick stone walls, a slate roof, a chimney with a cowl, a log pile. The lit file lights its 2 small windows.                                                    | proposals/highland.md, Buildings |
| Pump Station | `pumpStation` | A pump that lifts water up a step               | `pumpStation.png`, `.winter`                                               | A small pump house beside a channel, a pipe climbing out of it. The game draws the lift.                                                                                    | EXPANSION.md, Pump Station       |
| Biochar Kiln | `biocharKiln` | A kiln that chars wood for the fields           | `biocharKiln.png`, `.winter`                                               | A domed earth-and-iron kiln, a stack of cut wood, a sack of black char. No smoke: just the vent.                                                                            | EXPANSION.md, Biochar Kiln       |
| Snow Fence   | `snowFence`   | A slatted fence along an edge, against drifts   | `snowFence.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`, and each `.winter` | Along tile edges, exactly as the Hedgerow's pieces (above): wooden slats on posts, about 50 px high. Winter: a drift piled against one side.                                | proposals/highland.md, Buildings |
| Rewetted Bog | `rewettedBog` | A bog with its drains blocked, wet again        | `rewettedBog.png`, `.winter`                                               | Carries its own bog tile: bright pools behind small peat dams, sphagnum, a dragonfly.                                                                                       | proposals/highland.md, Buildings |
| Lookout      | `lookout`     | A stone tower on a crag, watching the weather   | `lookout.png`, `.winter`, `lookout.lit.png`                                | Carries its own crag tile. A short round tower with a flag and a horn; the lit file lights its top window.                                                                  | proposals/highland.md, Buildings |

### Evolutions

| Name           | Id              | Grows from   | What it is                                            | Files                                         | Notes                                                                                   | Source                        |
| -------------- | --------------- | ------------ | ----------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------- |
| Hanging Garden | `hangingGarden` | Terrace Farm | The terraces in flower among other terraces           | `hangingGarden.png`, `.winter`                | As the Terrace Farm, with flowers along the walls and a hive.                           | proposals/highland.md, Combos |
| Cascade        | `cascade`       | Hill Turbine | Two wheels where the water falls from one to the next | `cascade.png`, `.winter`, `cascade.rotor.png` | As the Hill Turbine, with white water spilling down past it.                            | proposals/highland.md, Combos |
| Bat Roost      | `batRoost`      | Salvage Yard | An old mine left to the bats                          | `batRoost.png`, `.winter`                     | Carries its own ruin tile: a timbered mine mouth grown over with heather, bats at dusk. | proposals/highland.md, Combos |

### With HL6: the wonder, animals and festivals

In the game since HL6, with their art. The
Cloud Terraces climb the slope (their tiles stand at 2 heights or more), so paint them as on
level ground, as the other Highland art: the game raises each tile.

| Name           | Id              | Files                                                                      | Notes                                                                                                                                                                                           | Source                           |
| -------------- | --------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Cloud Terraces | `cloudTerraces` | `cloudTerraces.png`, `.winter`, `cloudTerraces.stage1.png` … `.stage3.png` | On the Great Water Garden's frame (1536 × 1280): terraced gardens over 7 tiles on a slope, mist below, a glasshouse at the centre. Stages: walls staked out; walls built; the terraces planted. | proposals/highland.md, Wonder    |
| Mountain hares | `hares`         | `hare.run.1.png`, `hare.run.2.png`, `hare.sit.png`, and each `.winter`     | Brown in summer, white in winter. On open meadow high up.                                                                                                                                       | proposals/highland.md, Wildlife  |
| Dippers        | `dippers`       | `dipper.1.png`, `dipper.2.png`                                             | A small dark bird with a white bib, bobbing on a stone in the stream.                                                                                                                           | proposals/highland.md, Wildlife  |
| Golden eagles  | `eagles`        | `eagle.soar.1.png`, `eagle.soar.2.png`, `eagle.perch.png`                  | Soaring over the crags; perched on a lookout.                                                                                                                                                   | proposals/highland.md, Wildlife  |
| Pine martens   | `martens`       | `marten.1.png`, `marten.2.png`                                             | Among the pines.                                                                                                                                                                                | proposals/highland.md, Wildlife  |
| Snowmelt Fair  | `snowmeltFair`  | `snowmeltFair.card.png`                                                    | Spring: stalls on the glen floor, the stream running high.                                                                                                                                      | proposals/highland.md, Festivals |
| Shieling Day   | `shielingDay`   | `shielingDay.card.png`                                                     | Summer: people walking the flocks up to the high pasture.                                                                                                                                       | proposals/highland.md, Festivals |

Animals follow the wildlife frame above (128 × 128, bottom-centre anchor, facing right). The
Highland's Lantern Night uses the Reach's card, and its festivals the Reach's bunting and lanterns.

## The Sun Desert (SD4 to SD6)

The fourth biome ([proposals/sun-desert.md](proposals/sun-desert.md)): a thin river that floods
its wadi banks in spring and runs dry in summer, an oasis near the middle, flat gravel plain
(reg), dunes (erg) along one side, rock at the edges, a salt flat, and the ruins of an old solar
array. Everything here is drawn in code until its art comes, so any piece can arrive on its own.
**Delivered and imported (all of it, SD6 included):** the desert's tiles with their second
looks, its own look for the shared floodplain, meadow, scrub, woodland, ruin and river (and the
dry riverbed), every desert building, evolution and edge piece, the qanat's hub and arms, the
sandy solar canopy, the Solar Oasis at its 3 stages, the four animals and the three festival
cards; the guide stays as the reference for changes. Same frame, light and file names as
everything else: a summer `id.png` and a winter `id.winter.png`, delivered to the usual folders
of `art/incoming/`.

**The palette.** Bright and dry: warm sand (`#E8C98A`), pale gravel (`#D9C3A0`), rust rock
(`#A8603F`), salt white, sky-blue water, and the deep green of date palms (`#2F5D3A`) as the one
dark note. The light is high and hard, so shadows are short and crisp, and colours a little
bleached, never grey. Keep the papercraft style: the same cut-paper edges, the same light from
the upper left.

**Winter is the green season, not a white one.** (In the game since SD4: in the desert, the
shared art's snowy winter is never shown; a shared tile or building keeps its summer look unless
it has a desert look.) Desert winters are mild by day and cold by
night, with what little rain falls. So a desert `.winter.png` keeps the sand and the palms and
adds a faint green sheen on the scrub and the gravel, the oasis brimming, a few flowers on the
meadow, and pale frost only in the shade (the north-west side of things). No snow anywhere.

The game draws these in code, so don't paint them: heat shimmer over the reg in summer, dust
blowing across in a dust storm, the flash flood over the wadi banks, the river drying (from the
dry look below), a glint running across mirrors and panels, the fog net's drops, cooling marks
over homes, lit windows from a `.lit.png`, and a rotor's turn from a `.rotor.png`.

### Tiles

Each new type needs two summer looks and a winter one (`id.png`, `id-2.png`, `id.winter.png`).
The shared types get the desert's own look as `id.desert.png` and `id.desert.winter.png`, as the
coast's headlands and the glen's meadow; the game uses them in the desert in place of the
Reach's.

| Tile       | Id                                         | What it is                            | Notes                                                                                                                                                                                                           | Source                  |
| ---------- | ------------------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Oasis      | `oasis`                                    | A spring-fed pool, the desert's water | Clear blue-green water filling most of the top face, a pale sand rim, reeds and a few papyrus heads at the edge. Winter: the water higher on the rim.                                                           | proposals/sun-desert.md |
| Reg        | `reg`                                      | Flat gravel plain, the commonest land | Pale gravel packed flat with scattered darker pebbles and a single dry tuft. The ground mirrors stand on, so keep it plain. Winter: a faint green haze between the stones.                                      | proposals/sun-desert.md |
| Erg        | `erg`                                      | Dunes: drifting sand                  | Warm sand in two or three crescent ridges, sharp crests with the lee side shaded, wind ripples. Nothing growing. Winter: the same, the shadows a touch longer.                                                  | proposals/sun-desert.md |
| Rock       | `rock`                                     | Outcrops at the map's edge            | Rust-red rock in rounded, layered slabs (wind-worn, not the Highland's broken grey crag), a dark crack or two, one thorny shrub. Winter: a little green in the cracks.                                          | proposals/sun-desert.md |
| Salt flat  | `saltFlat`                                 | A dry lakebed crusted white           | White salt crust in polygon plates, the cracks between them faintly pink-grey, flat as a table. Winter: a thin skin of water shining on part of it.                                                             | proposals/sun-desert.md |
| Wadi bank  | `floodplain.desert.png`                    | The low ground the flash flood covers | Fine grey-brown silt, cracked into curling plates, sedge and a few green shoots where the water was. Winter: greener shoots.                                                                                    | proposals/sun-desert.md |
| River      | `river.desert.png`, `river.desert.dry.png` | The thin river, wet and dry           | A narrow stream in a wide pale sandy bed with rounded stones. The dry look (shown while the river runs at 0) is the same bed with no water: stones, ripple marks in the sand, a damp dark line down the middle. | proposals/sun-desert.md |
| Old array  | `ruin.desert.png`                          | The ruins of an old solar farm        | Two or three broken solar panels on bent frames, tilted and half buried in sand, a toppled cable spool. Salvage, not menace.                                                                                    | proposals/sun-desert.md |
| Scrub      | `scrub.desert.png`                         | Low desert scrub                      | Sand with saltbush and small grey-green shrubs in clumps.                                                                                                                                                       | proposals/sun-desert.md |
| Meadow     | `meadow.desert.png`                        | Desert grassland, after healing       | Tufted golden grass and low wildflowers (yellow and violet) over sand.                                                                                                                                          | proposals/sun-desert.md |
| Palm grove | `woodland.desert.png`                      | The desert's woodland                 | Three or four date palms of different heights with clusters of orange dates, their shadows pooled beneath, grass between.                                                                                       | proposals/sun-desert.md |

### Buildings

| Name                     | Id                       | What it is                                        | Files                                                                          | Notes                                                                                                                                                                                                                              | Source                             |
| ------------------------ | ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Oasis Garden             | `oasisGarden`            | A garden in three layers under date palms         | `oasisGarden.png`, `.winter`                                                   | Carries its own ground: a low mud wall, two date palms over fig and pomegranate trees, vegetables in small square beds between little water runnels. Its palms are the shade it gives the home beside it.                          | proposals/sun-desert.md, Buildings |
| Wadi Farm                | `wadiFarm`               | A field on the wadi bank, fed by the flood        | `wadiFarm.png`, `.winter`                                                      | Carries its own ground: sorghum or barley in rows on grey silt, a low earth bank (bund) round it to hold the flood. Winter: young green shoots.                                                                                    | proposals/sun-desert.md, Buildings |
| Mud-brick House          | `mudBrickHouse`          | A thick-walled home that keeps cool and warm      | `mudBrickHouse.png`, `.winter`, `mudBrickHouse.lit.png`                        | Groundless: a cube of rounded, hand-smoothed mud brick, a flat roof with a low parapet, small deep-set windows, a blue door, a rug airing on the roof. The lit file lights its windows.                                            | proposals/sun-desert.md, Buildings |
| Wind Tower               | `windTower`              | A tower that catches the wind and cools the house | `windTower.png`, `.winter`                                                     | Groundless, tall: a slim square mud-brick tower (a badgir) about twice a house's height, with slatted openings near the top on all four sides. Plain and handsome; it never moves.                                                 | proposals/sun-desert.md, Energy    |
| Absorption Chiller       | `absorptionChiller`      | A machine that makes cooling from heat            | `absorptionChiller.png`, `.winter`                                             | Groundless: a squat pale-metal unit like a tank on its side, one hot pipe (copper red) in and one cold pipe (blue, beaded with condensation) out, a small vent on top.                                                             | proposals/sun-desert.md, Energy    |
| Fog Net                  | `fogNet`                 | A mesh that combs water out of the fog            | `fogNet.png`, `.winter`                                                        | Groundless: a wide rectangle of fine mesh strung between two tall poles with guy ropes, a gutter under it running into a small jar. Semi-transparent mesh. The game draws the drops.                                               | EXPANSION.md, Fog Net              |
| Qanat                    | `qanat`                  | A channel underground                             | `qanat.png` (the hub) and `qanat.e.png` … `.se.png`, each with `.winter`       | Laid tile by tile, exactly as the Irrigation Channel's hub and 6 arms (above): no open water, just a line of round shaft mounds (a ring of spoil with a dark hole) along the arm, one at the hub.                                  | proposals/sun-desert.md, Buildings |
| Concentrated Solar Plant | `concentratedSolarPlant` | Mirrors focusing the sun on a tower, a salt tank  | `concentratedSolarPlant.png`, `.winter`, `concentratedSolarPlant.lit.png`      | Carries its own reg ground: rows of small flat mirrors (heliostats) on stands around a slim tower with a bright receiver at the top, a round insulated salt tank beside it. The lit file lights the receiver and the tank's hatch. | DECISIONS.md (playtester)          |
| Sand Battery             | `sandBattery`            | A silo of sand that stores heat                   | `sandBattery.png`, `.winter`                                                   | Groundless: a short, fat insulated silo in white with a band of terracotta, a pipe to the ground, a small sign with a heat gauge. Winter: a wisp of warmth is drawn in code, so leave it out.                                      | proposals/sun-desert.md, Energy    |
| Palm Windbreak           | `palmWindbreak`          | A line of palms along an edge, against the dust   | `palmWindbreak.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`, and each `.winter` | Along tile edges, exactly as the Hedgerow's pieces (above): three young date palms in a row with a low brushwood fence at their feet, about 90 px high (taller than a hedge).                                                      | proposals/sun-desert.md, Buildings |
| Salt Works               | `saltWorks`              | Pans where brine dries into salt                  | `saltWorks.png`, `.winter`                                                     | Carries its own salt flat: shallow square pans in a grid, some pink with brine, some white, a heap of salt with a wooden rake, a small shed.                                                                                       | proposals/sun-desert.md, Buildings |
| Solar Canopy (desert)    | `solarCanopy.desert.png` | Optional: the canopy in the desert's dress        | `solarCanopy.desert.png`, `.desert.winter.png`                                 | As the Reach's canopy, with a light dusting of sand on the frame and a cloth shade hung beneath it. The game uses it in the desert, as it does the tiles' desert looks.                                                            | proposals/sun-desert.md            |

The shared buildings (workshop, salvage yard, composter, cistern, well, greenhouse, bathhouse and
the rest) keep the Reach's art.

### Evolutions (SD3)

| Name               | Id                 | Grows from   | What it is                                   | Files                             | Notes                                                                                                                                  | Source                          |
| ------------------ | ------------------ | ------------ | -------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Three-Layer Garden | `threeLayerGarden` | Oasis Garden | The garden grown into a forest garden        | `threeLayerGarden.png`, `.winter` | As the Oasis Garden, fuller: tall palms, a full middle layer of fruit trees, ground crops in deep shade, a bench.                      | proposals/sun-desert.md, Combos |
| Fog Fence          | `fogFence`         | Fog Net      | Three fog nets joined into one long fence    | `fogFence.png`, `.winter`         | As the Fog Net, wider: mesh panels across most of the tile on four poles, a longer gutter into a covered tank.                         | proposals/sun-desert.md, Combos |
| Restored Array     | `restoredArray`    | Salvage Yard | The old array's panels mended, working again | `restoredArray.png`, `.winter`    | Carries its own ruin ground: the old frames straightened, three clean panels on them, sand swept back, a little shrine of spare parts. | proposals/sun-desert.md, Combos |

### With SD6: the wonder, animals and festivals

| Name           | Id            | Files                                                                                             | Notes                                                                                                                                                                                                                                                                                                                                    | Source                             |
| -------------- | ------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Solar Oasis    | `solarOasis`  | `solarOasis.png`, `.winter`, `solarOasis.stage1.png` … `.stage3.png`                              | On the Great Water Garden's frame (1536 × 1280): a flower of mirrors over 7 tiles of reg, curved rows on the 6 outer tiles all turned to a tall tower at the centre, a cooling pool at its foot watering a ring of garden. Stages: footings and the tower's base; the tower and half the mirrors; all the mirrors, the pool still empty. | proposals/sun-desert.md, Wonder    |
| Fennec foxes   | `fennecs`     | `fennec.run.1.png`, `fennec.run.2.png`, `fennec.sit.png`, and each `.winter`                      | Small sand-coloured foxes with huge ears, on open scrub and dunes. Winter: a touch thicker coat.                                                                                                                                                                                                                                         | proposals/sun-desert.md, Wildlife  |
| Sandgrouse     | `sandgrouse`  | `sandgrouse.1.png`, `sandgrouse.2.png`                                                            | Plump speckled birds, a pair drinking at the oasis's edge.                                                                                                                                                                                                                                                                               | proposals/sun-desert.md, Wildlife  |
| Lanner falcons | `falcons`     | `falcon.fly.1.png`, `falcon.fly.2.png`, `falcon.perch.png`                                        | A slim grey-brown falcon in flight; perched on a wind tower's top.                                                                                                                                                                                                                                                                       | proposals/sun-desert.md, Wildlife  |
| Oryx           | `oryx`        | `oryx.walk.1.png` … `oryx.walk.4.png`, `oryx.graze.1.png`, `oryx.graze.2.png`, and each `.winter` | White antelope with long straight horns and a dark face mask, walking the open reg in a small herd, as the Reach's deer.                                                                                                                                                                                                                 | proposals/sun-desert.md, Wildlife  |
| Rain Feast     | `rainFeast`   | `rainFeast.card.png`                                                                              | Spring: people dancing in the first rain, the wadi running, umbrellas and bare feet.                                                                                                                                                                                                                                                     | proposals/sun-desert.md, Festivals |
| Night Market   | `nightMarket` | `nightMarket.card.png`                                                                            | Summer: stalls by lantern light after the heat of the day, spices and fruit, people out late.                                                                                                                                                                                                                                            | proposals/sun-desert.md, Festivals |
| Star Night     | `starNight`   | `starNight.card.png`                                                                              | Winter: the lights out, everyone on the roofs under a sky thick with stars and the Milky Way.                                                                                                                                                                                                                                            | proposals/sun-desert.md, Festivals |

Animals follow the wildlife frame above (128 × 128, bottom-centre anchor, facing right). The
desert's festivals use the Reach's bunting and lanterns.

## Keepsakes (Seeds)

Keepsakes are bought in Root City with Seeds ([proposals/seed-uses.md](proposals/seed-uses.md))
and are only to look at. **Delivered and in the game:** every young one's frames (the eagle pair
needs none) and the banner, window box and bird box. The bunting and lanterns use the festivals'
art and the kites stay drawn in code. Same light and style as the rest.

### The young ones

Each is an extra figure beside its animal: one or two young ones walking a step behind a parent,
or keeping still near it. Their frames are the parent's names with the young one's name after
the animal's (`deer.walk.1.png` becomes `deer.white.walk.1.png`), on the same 128 × 128 frame,
anchored bottom centre and facing right. **Paint them at their own size** on that frame: the game
draws a young one's own art as it is, without scaling it. Where the parent has winter frames, give
the young one winter frames too. Deliver them to `art/incoming/wildlife/` with the animals.

| Keepsake          | Files                                                                                  | Notes                                                                       | Source                 |
| ----------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------- |
| Bumblebees        | `wildBees.bumble.1.png` … `.3.png`                                                     | Fat, furry, banded bees, a few, bigger than the wild bees and easy to spot. | proposals/seed-uses.md |
| Otter cubs        | `otter.cub.swim.1.png`, `.swim.2.png`, `otter.cub.rest.png`                            | About half the otter's size.                                                | proposals/seed-uses.md |
| Beaver kit        | `beaver.kit.swim.1.png`, `.swim.2.png`, `beaver.kit.carry.png`                         | About half the beaver's size; "carry" is the kit sitting by the water.      | proposals/seed-uses.md |
| The white hart    | `deer.white.walk.1.png` … `.4.png`, `deer.white.graze.1.png`, `.2.png`, each `.winter` | A full-grown pale white stag with antlers, a touch larger than the deer.    | proposals/seed-uses.md |
| Tern chicks       | `tern.chick.rest.png`, `.winter`                                                       | Speckled chicks in a scrape on the dune; they keep still.                   | proposals/seed-uses.md |
| Seal pup          | `seal.pup.rest.png`, `.winter`                                                         | A white-coated pup hauled out; it keeps still.                              | proposals/seed-uses.md |
| Puffin with fish  | `puffin.fish.1.png`, `.2.png`, each `.winter`                                          | A puffin like the others, its beak full of silver sand eels.                | proposals/seed-uses.md |
| Dolphin calf      | `dolphin.calf.1.png` … `.3.png`, each `.winter`                                        | About half the dolphin's size.                                              | proposals/seed-uses.md |
| Leverets          | `hare.young.run.1.png`, `.run.2.png`, `hare.young.sit.png`, each `.winter`             | Small hares, brown in summer, white in winter like the adults.              | proposals/seed-uses.md |
| Dipper fledgling  | `dipper.young.1.png`, `.2.png`, each `.winter`                                         | Grey and speckled, without the white bib yet.                               | proposals/seed-uses.md |
| Eagle pair        | None                                                                                   | The second eagle uses the eagle's own frames.                               | proposals/seed-uses.md |
| Marten kits       | `marten.kit.1.png`, `.2.png`, each `.winter`                                           | About half the marten's size.                                               | proposals/seed-uses.md |
| Fennec cubs       | `fennec.cub.run.1.png`, `.run.2.png`, `fennec.cub.sit.png`, each `.winter`             | Big-eared cubs, about half the fox's size.                                  | proposals/seed-uses.md |
| Sandgrouse chicks | `sandgrouse.chick.1.png`, `.2.png`                                                     | Small, mottled chicks running.                                              | proposals/seed-uses.md |
| Falcon chicks     | `falcon.chick.perch.png`                                                               | White, downy chicks on a ledge; they keep still.                            | proposals/seed-uses.md |
| Oryx calf         | `oryx.calf.walk.1.png` … `.4.png`, `oryx.calf.graze.1.png`, `.2.png`, each `.winter`   | Sandy, without the long horns yet.                                          | proposals/seed-uses.md |

### Ornaments on the settlement

Props on the 128 × 128 frame, at tile scale, delivered to `art/incoming/keepsakes/`. The bunting
and the channel lanterns use the festivals' bunting and lantern art, and the kites stay drawn in
code, so only three pieces are asked for.

| Keepsake          | File            | Notes                                                                                                                                                                           | Source                 |
| ----------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| The city's banner | `banner.png`    | A pole with a swallow-tailed flag, standing on the ground (bottom centre at (64, 120)). Paint the flag **white**: the game tints it to the colour of the city's first district. | proposals/seed-uses.md |
| Window boxes      | `windowBox.png` | A small wooden box of mixed flowers, hung from its top centre (64, 8) like the lantern; small, to sit under a window.                                                           | proposals/seed-uses.md |
| Bird boxes        | `birdBox.png`   | A bird box with a round hole and a pitched roof, hung from its top centre (64, 8), as if nailed high on a trunk.                                                                | proposals/seed-uses.md |

## Optional: interface marks

The game draws these in code. Paint them only if you want them in the art style; 128 × 128 px,
anchored at the centre.

| Name                | Id              | What it shows                                      | Source                        |
| ------------------- | --------------- | -------------------------------------------------- | ----------------------------- |
| Water               | `water`         | The water resource: a droplet                      | EXPANSION.md, Water system    |
| Clean water         | `waterClean`    | Clear blue droplet                                 | EXPANSION.md, Water qualities |
| Nutrient-rich water | `waterNutrient` | Green droplet with a leaf                          | EXPANSION.md, Water qualities |
| Grey water          | `waterGrey`     | Grey droplet with soap bubbles                     | EXPANSION.md, Water qualities |
| Short of water      | `waterShort`    | A cracked or empty droplet over a thirsty building | EXPANSION.md, Water system    |

## Later, not needed yet

Reserved for Root City districts and later biomes. Numbers and art notes come when each is designed.

| Name           | Id              | For                     | Source                               |
| -------------- | --------------- | ----------------------- | ------------------------------------ |
| Repair Café    | `repairCafe`    | Foundry District unlock | EXPANSION.md, Reserved for Root City |
| Preserve House | `preserveHouse` | Orchard Ward unlock     | EXPANSION.md, Reserved for Root City |
