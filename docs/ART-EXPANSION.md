# Art for the water expansion

What the water expansion ([EXPANSION.md](EXPANSION.md)) needs drawn, in the order the milestones
need it. Everything follows the existing art spec ([ART.md](ART.md) and
[`art/incoming/README.md`](../art/incoming/README.md)) unless a section says otherwise: the same
papercraft style, light from the upper left, a summer `id.png` and a winter `id.winter.png` for
everything that sits on the map, and files delivered to `art/incoming/` as before.

Anything without art falls back to a procedural drawing, so nothing here blocks the game.

**Delivered (E2 and E3):** every building, evolved form, channel and hedgerow piece and the Sluice
Gate are in `art/incoming/buildings/`, tiles in `art/incoming/tiles/`, and in the game. The Singing
Spire's rotor pivot, (257, 195), is measured by the importer from its hub, as the manifest has none.
The wildlife, festival and wonder art waits in its own folders for E4 and E5.

## Order

| Milestone                   | Needs art? | What to draw first                            | Source                                      |
| --------------------------- | ---------- | --------------------------------------------- | ------------------------------------------- |
| E1. Water in the simulation | No         | —                                             | EXPANSION.md, Build plan                    |
| E2. Water on screen         | Yes        | Irrigation Channel pieces and the Sluice Gate | EXPANSION.md, Build plan                    |
| E3. Willow Reach v2 content | Yes        | 6 new buildings and 7 evolutions              | EXPANSION.md, New buildings; New evolutions |
| E4. Wildlife and festivals  | Yes        | 4 animals, 3 festival cards, 2 props          | EXPANSION.md, Bigger systems                |
| E5. Great Water Garden      | Yes        | The 7-hex wonder and its build stages         | EXPANSION.md, Bigger systems                |

## The standard frame (reminder)

| Measure                                  | Value                                                                            | Source                   |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------ |
| Frame                                    | 512 × 640 px, transparent, untrimmed                                             | `art/incoming/README.md` |
| Tile width                               | 400 px                                                                           | `art/incoming/README.md` |
| Tile centre (top face)                   | (256, 373.5)                                                                     | `art/incoming/README.md` |
| Top-face corners, clockwise from the top | (256, 168), (456, 283.47), (456, 463.47), (256, 579), (56, 463.47), (56, 283.47) | `art/incoming/README.md` |
| Paper side band                          | 32 px, lowest point y 611                                                        | `art/incoming/README.md` |

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

| Name                     | Id                  | For                                                             | Source                                  |
| ------------------------ | ------------------- | --------------------------------------------------------------- | --------------------------------------- |
| Repair Café              | `repairCafe`        | Foundry District unlock                                         | EXPANSION.md, Reserved for Root City    |
| Preserve House           | `preserveHouse`     | Orchard Ward unlock                                             | EXPANSION.md, Reserved for Root City    |
| Pump Station             | `pumpStation`       | Highland                                                        | EXPANSION.md, Reserved for later biomes |
| Biochar Kiln             | `biocharKiln`       | Highland                                                        | EXPANSION.md, Reserved for later biomes |
| Concentrated Solar Plant | `concentratedSolar` | Sun Desert: mirrors focus the sun for both electricity and heat | DECISIONS.md, Water expansion           |
| Fog Net                  | `fogNet`            | Sun Desert                                                      | EXPANSION.md, Reserved for later biomes |
| Desalinator              | `desalinator`       | Windswept Coast                                                 | EXPANSION.md, Reserved for later biomes |
