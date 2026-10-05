# Art for Root City

What Root City needs drawn: the Heartwood at its centre and the Sun Tree it grows into, the seven
districts at each of their three tiers, the empty plots, and the five landmarks. Everything
follows the existing art spec ([ART.md](ART.md) and
[`art/incoming/README.md`](../art/incoming/README.md)) unless a section says otherwise: the same
papercraft style, the same light from the upper left, and the same 512 × 640 frame.

**Delivered and in the game:** all 54 files for the first six districts and four landmarks (the
36 asked for, the 14 lit versions and the 4 rotors), delivered as `root-city/` and kept in
`art/incoming/city/`; and the Sun Quarter at its three tiers (with its lit Sapling and
Heartwood) and the Glassworks' three edges, which came with the Sun Desert (SD5), their brief
[below](#the-sun-quarter-and-the-glassworks-sd5). **How it gets in.** The importer takes `art/incoming/city/` (`npx tsx scripts/import-art.ts`,
which refuses a name or a frame size that isn't this guide's), and the city screen draws each
piece it has: the city already stands on the map's hex geometry, so the tiles fit together as on
the map. Anything without art is still drawn in code (`src/ui/City.tsx`): coloured hexes with a
small emblem. The tier dots, the Tempest badge and the selection are drawn over the art either
way, and a landmark's gold clasp gives way to its piece.

## What the city is

| Part                   | What it is                                                                                                                                                       | Source                             |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| The Heartwood          | A great tree on the centre hex. It grows as districts fill the slots around it.                                                                                  | DESIGN.md, Root City (City layout) |
| Slots                  | 18 hexes in two rings around the Heartwood: 6 in the first, 12 in the second. Each is empty or holds one district.                                               | `root-city.json` `progression`     |
| Districts              | 6 kinds, each sent home by a different way of playing a run (a Graft). A full city can replace one; the old one composts into Seeds.                             | `root-city.json` `districts`       |
| Tiers                  | Seedling, Sapling, Heartwood. A Graft arrives at the tier its run's score earned, and Seeds raise it later. **This is the "how built up" ladder the art shows.** | DESIGN.md, Grafts                  |
| Landmarks              | Hidden combos between neighbouring districts, discovered the first time the arrangement stands.                                                                  | `root-city.json` `landmarks`       |
| Tempest marks          | A district grafted at a Tempest level carries a badge with the level.                                                                                            | DECISIONS.md, Root City (Tempest)  |
| The Sun Tree (the end) | When all 18 slots are filled and 6 districts stand at Heartwood, the Heartwood becomes the Sun Tree.                                                             | `sunTreeGrown`                     |

## Style for the city

- **The same world, older and settled.** Root City is the home the expeditions come back to: the
  same cut-paper diorama as the map, but a town rather than a camp. It is solarpunk, not
  industrial. Every district has living things in it: trees, gardens, water, roofs with plants or
  panels on them. Nothing is grey and empty except an empty plot.
- **One season.** The city has no seasons. Paint late summer, the map's neutral season. There are
  no winter files.
- **A district's colour.** Each district has a key colour, which the interface already uses for it.
  Put that colour on the things that make the district recognisable (roofs, awnings, banners,
  boats) at every tier, so a district reads as the same place as it grows. Its tier is never shown
  by colour alone: the game keeps a dot per tier in code, and size and detail carry it in the art.
- **Each tile carries its own ground.** A district paints its whole hex, its ground included, and
  the paper side band, as the Wind Spire and the Croft do on the map. Districts sit side by side
  with the usual paper gap, so let a path or stream meet the hex edge at the middle of a side.
  Then neighbours can line up when they happen to match.
- **Readable small.** The city is seen whole, about 70 px a hex on a laptop, and its icons are 48
  px. Each district needs one landmark shape that reads at that size (a mill wheel, a cider barn,
  a chimney pair, a lighthouse, a hill town, a bandstand, a wind tower). Keep that shape in the same place at
  every tier, growing as the tier rises.

## The tiers: how built up, how complex, how alive

The art's main job is to make the three tiers feel like three ages of the same place. Use the
same ladder for every district:

| Tier      | Built up                                                                                                         | Complexity                                                                                                            | Alive                                                                                                                                                                         | Height (above the top vertex, which has 168 px of headroom) | Source |
| --------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------ |
| Seedling  | About a third of the hex built on. One or two small structures, lots of open ground: staked plots, young plants. | A first version of the district's landmark shape, plain and small. Timber and canvas; scaffolding or string lines.    | Quiet: 1 painted figure at work, one thread of chimney smoke (drawn in code), no lit windows.                                                                                 | Up to 50 px                                                 | New    |
| Sapling   | About two thirds built on. Three to five structures, joined by paths. Gardens planted, a water feature if any.   | The landmark shape in stone or brick, finished. Secondary buildings, fences, carts, crates, small details.            | Busy: 2 or 3 figures, a turning part where the district has one (a wheel, a rotor), some windows lit at dusk.                                                                 | Up to 110 px                                                | New    |
| Heartwood | Nearly all of it, but never crammed: a green court, square or garden stays open in the middle.                   | Layered: buildings behind buildings, roofs at different heights, a tall feature at the back. Bunting, flags, flowers. | Thriving: 5 to 8 figures, every turning part, most windows lit at dusk, birds and petals (drawn in code), mature trees overhanging roofs. It should look like a festival day. | All 168 px                                                  | New    |

Two rules make the ladder read across all six districts:

- **The same place, grown.** A Heartwood district keeps its Seedling's layout: the first hut is
  still there, now the oldest building, and the first sapling is now a big tree. Players should
  be able to see the earlier tier inside the later one.
- **Fullness, not just size.** Each tier adds height, but also adds people and detail and closes
  the gaps. Seedling is quiet and open, Sapling is busy, Heartwood is crowded with life but keeps
  its open centre.

## The districts

Key colours are the interface's (`src/ui/City.tsx`, `LOOK`). Each needs `id.seedling.png`,
`id.sapling.png` and `id.heartwood.png`.

| District         | Id                | Key colour | Character (earned by)                                                                       | Seedling                                                                                        | Sapling                                                                                                                      | Heartwood                                                                                                                                                         | Turning parts and lights                                                         | Source                                 |
| ---------------- | ----------------- | ---------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- |
| Millrace Quarter | `millraceQuarter` | `#3A6EA5`  | Water power: a mill race cut across the hex, wheels on it (hydro-heavy runs).               | A freshly dug race lined with planks, one small undershot wheel, a timber shed, a sluice board. | A stone mill house over the race, the wheel bigger, a footbridge, a second wheel downstream, blue doors and shutters.        | A tall mill with a bell or clock tower, three wheels stepping down the race, a millpond with ducks at the back, workshops along the banks, blue awnings.          | The main wheel turns (`.rotor.png`); mill windows lit.                           | DESIGN.md, Root City; `root-city.json` |
| Orchard Ward     | `orchardWard`     | `#E0A33B`  | Food: orchard rows and a cider barn (food-heavy runs). A green district.                    | Whips staked in two rows, a picker's hut, a water butt.                                         | Young trees in blossom and fruit, a timber barn with a gold roof, beehives, ladders.                                         | An old orchard canopy over everything, the cider press house with its gold roof, market stalls of fruit, carts, baskets, a long table under the trees.            | Lit barn windows and lanterns in the trees.                                      | DESIGN.md, Root City; `root-city.json` |
| Mended Commons   | `mendedCommons`   | `#2E8B6A`  | Harmony: wild land brought back, shared by all (Harmony-heavy runs). A green district.      | A fenced patch of fresh seeding, a bench, one planted oak sapling, a sign.                      | A wildflower meadow, a pond with reeds, a small timber pavilion with a green roof, a footpath.                               | A mature grove around a green, a bandstand or amphitheatre, a boardwalk over the pond, a bird hide, hedgerows. Mostly living things, with very few buildings.     | Lanterns on the bandstand. Butterflies and birds are drawn in code.              | DESIGN.md, Root City; `root-city.json` |
| Foundry District | `foundryDistrict` | `#B85C6E`  | Making and mending: workshops, kilns, salvage turned into goods (industry-heavy runs).      | A lean-to workshop, a pile of sorted salvage, a workbench outside.                              | A brick workshop with a kiln chimney, a yard of crates and coils, a hand crane, rose-red doors.                              | A glass-roofed hall with solar panels on the roof, two chimneys letting out clean steam, a gantry, a repair yard full of mended things, rose banners.             | Forge glow in the windows; the crane's wheel may turn.                           | DESIGN.md, Root City; `root-city.json` |
| Tidal Quarter    | `tidalQuarter`    | `#2F5E63`  | The sea: a tidal basin on the hex, its quay and tide mill (coastal runs).                   | A wooden jetty into a little basin, a buoy, a net shed.                                         | A stone quay round the basin, a tide mill house, two small boats, teal-painted shutters.                                     | A harbour basin with a sea gate, a slim lighthouse tower at the back, a tide turbine in the gate, a fish market, boats with teal sails.                           | The tide turbine turns (`.rotor.png`); the lighthouse lamp and quay windows lit. | `root-city.json`; windswept-coast.md   |
| Ridge Quarter    | `ridgeQuarter`    | `#6B5B4E`  | Heat and shelter: stone homes on a rise, each with its own stove (heat-led runs).           | One bothy on a low rise, a woodpile, a heat well's cover.                                       | A short terrace of stone houses stepping up the hex, a heat well, chimneys with cowls, slate roofs edged in umber.           | A hill town climbing to a hearth hall at the top, warm windows everywhere, heat-collector panels on the roofs, a bathhouse with steam, steps and a little square. | Nearly every window lit; chimney smoke is drawn in code.                         | `root-city.json`; highland.md          |
| Sun Quarter      | `sunQuarter`      | `#C8743A`  | The sun: mud-brick courts under mirrors and canopies (sun-led runs; in the game since SD5). | A mud-brick hut with a solar canopy beside it, a wind tower stump, a water jar in the shade.    | A courtyard house round a little pool, a full wind tower, canopies over a lane, a few heliostat mirrors, burnt-orange doors. | A sun town: courts and wind towers, a slim solar tower with its mirror field at the back, a shaded market street of canopies, palms in every court, a glass dome. | The solar tower's receiver and lanterns in the courts lit.                       | proposals/sun-desert.md, Root City     |

## The Sun Quarter and the Glassworks (SD5)

The seventh district and the fifth landmark, in the game since SD5. **Delivered and in the
game:** all 8 files, the two optional lit ones included. Same
frame, style, tier ladder and file rules as everything above: 512 × 640, late summer, each tile
carrying its own ground, no winter files. The importer already knows both names.

### The Sun Quarter

**What it is.** The district a sun-led run sends home: one whose energy came mostly from solar
canopies, Concentrated Solar Plants, agrivoltaic fields and restored arrays. It makes solar
canopies give more in the darker seasons, and it is the quarter that brought the **Fog Net** to
every biome. It is the desert's way of living carried home: thick mud-brick walls, shade, courts
round water, wind towers to pull the cool air down, and the sun put to work overhead.

**Match the desert art.** The Mud-brick House, Wind Tower, Solar Canopy, Concentrated Solar Plant,
Fog Net and Cistern you painted for the map are this district's buildings, grown into a town.
Reuse their shapes, materials and proportions so a player who has been to the desert recognises
them.

**Its ground.** Root City is not a desert. Inside the hex paint packed earth and pale gravel
courts with drought planting (lavender-grey shrubs, agave, a fig), and let the city's grass come
back in a thin band at the rim so the tile sits with its green neighbours. A path meets the middle
of at least two sides. No dunes, no sand drifts.

**Colours.**

| Use                                                         | Colour                                | Source                    |
| ----------------------------------------------------------- | ------------------------------------- | ------------------------- |
| Key colour: doors, shutters, awnings, canopy cloth, banners | Burnt orange `#C8743A`                | `src/ui/City.tsx` `LOOK`  |
| Walls                                                       | Mud-brick sand `#E8C98A`, whitewashed | ART-EXPANSION.md, palette |
| Courts and paths                                            | Pale gravel `#D9C3A0`                 | ART-EXPANSION.md, palette |
| Palms, the one dark note                                    | Date-palm green `#2F5D3A`             | ART-EXPANSION.md, palette |
| Water in the court pools                                    | Sky-blue water, as on the map         | ART-EXPANSION.md, palette |
| Panels and mirrors                                          | The map's solar blue and bright glass | The Solar Canopy's art    |

**Its landmark shape: the wind tower.** A square tower with open vents near its top, the shape
that reads at 70 px. Keep it in the same place (the back left of the hex) at every tier, growing:
a stump, then a finished tower, then the tallest of a cluster. The Heartwood tier's solar tower
stands at the back right as its tall feature; it does not replace the wind tower.

| Tier      | Built up                                                                                                                                                                        | Complexity                                                                                                                                                              | Alive                                                                                                                                          | Height       | Source                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| Seedling  | About a third: one mud-brick hut, a solar canopy on poles beside it shading a bench, the wind tower's stump in scaffolding, a fog net on two poles at the rim over a water jar. | Plain and small: raw mud brick, cloth and timber, brick moulds drying in rows, a heap of straw.                                                                         | 1 figure laying bricks. No lit windows.                                                                                                        | Up to 50 px  | This guide; DESIGN.md, Grafts       |
| Sapling   | About two thirds: a courtyard house round a small square pool, the wind tower finished over it, canopies shading the lane, three heliostat mirrors on a low terrace, a cistern. | The landmark finished in whitewashed mud brick, burnt-orange doors and shutters, a palm in the court, a fig tree, the fog net now over the cistern, water jars, a cart. | 2 or 3 figures: one at the pool, one tilting a mirror, one under the canopy. Some windows lit at dusk.                                         | Up to 110 px | This guide; DESIGN.md, Grafts       |
| Heartwood | Nearly all, with the courtyard still open in the middle: courts and roof terraces at several heights, a shaded market street of canopies, a small glass dome over a garden.     | Layered: three wind towers, the first the tallest; at the back right a slim solar tower with a curved field of mirrors turned to it; palms in every court; bunting.     | 5 to 8 figures: market stalls, people on the roof terraces, a child at the pool. Most windows and the court lanterns lit at dusk. A feast day. | All 168 px   | This guide; proposals/sun-desert.md |

The same place, grown: the Seedling's hut is still there at Heartwood as the oldest house, its
canopy now a long shade over the market street, and its fog net still at the rim.

**Lit at dusk** (optional, as the others): `sunQuarter.sapling.lit.png` (windows round the court)
and `sunQuarter.heartwood.lit.png` (windows, the court lanterns, the market's lamps, and the solar
tower's receiver glowing white-gold). **No rotors:** wind towers don't turn, and the mirrors are
painted still; one of them may catch the light as a painted highlight.

### The Glassworks

**What it is.** The landmark where the Sun Quarter stands next to the Foundry District: sand and
heat make solar glass, so greenhouses and solar canopies cost less in every biome. Its hint is
"Where the sun meets the furnace."

**What it shows.** Along the shared edge: a small domed glass furnace of rose-red brick (the
Foundry's `#B85C6E`), its door glowing orange; racks of solar glass panes leaning beside it, their
edges catching the light; a curved mirror on a stand; a burnt-orange awning (the Sun Quarter's
`#C8743A`) over a glassblower's bench. Each piece is the whole landmark laid along that edge, the
furnace at the edge's middle.

**How it sits.** As the other landmarks: three pieces, one for the tile's east, north-east and
north-west edge, on the standard frame, sitting across the paper gap and kept within about 60 px of
the edge so neither district's landmark shape is covered. Either district may own the edge, so the
piece must read from both sides. The furnace's glow is painted (no lit file); smoke is drawn in
code.

### Files

| File                                                                            | Needed?  | Count | Source       |
| ------------------------------------------------------------------------------- | -------- | ----- | ------------ |
| `sunQuarter.seedling.png`, `sunQuarter.sapling.png`, `sunQuarter.heartwood.png` | Yes      | 3     | This guide   |
| `glassworks.edge.e.png`, `glassworks.edge.ne.png`, `glassworks.edge.nw.png`     | Yes      | 3     | This guide   |
| `sunQuarter.sapling.lit.png`, `sunQuarter.heartwood.lit.png`                    | Optional | 2     | Dusk (below) |

6 images are needed and 2 more are optional, delivered to `art/incoming/city/` with the rest.
Paint the Sapling first to settle the look, then the Seedling and the Heartwood from it, then the
Glassworks.

## Keepsakes in the city

Root City's keepsakes ([proposals/seed-uses.md](proposals/seed-uses.md)): lanterns on the paths
between neighbouring districts (lit at dusk), fireflies at dusk, a fountain at the Heartwood's
foot, and kites in the districts' colours. They are small and drawn in code over the city, so no
art is asked for them.

## The Heartwood and the Sun Tree

The centre hex grows through four stages as the slots fill, then becomes the Sun Tree. It is the
city's tallest thing, so it has a **tall frame: 512 × 1024 px**, with its hex in the bottom 640
px. The top vertex is at (256, 552) and the tile centre at (256, 757.5): the standard frame's
points moved down 384 px. Its ground is a round green with a low stone kerb and a path from each
side of the hex.

| File                                     | When                                | What it shows                                                                                                                              | Source                                 |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `heartwood.1.png`                        | 0 to 4 districts                    | A young tree, taller than a person, staked and ringed with a woven fence. A few seedlings in pots round it.                                | DESIGN.md, City layout                 |
| `heartwood.2.png`                        | 5 to 9 districts                    | A sturdy young tree as tall as a house, the fence gone, a bench round the trunk, ribbons tied to low branches.                             | DESIGN.md, City layout                 |
| `heartwood.3.png`                        | 10 to 14 districts                  | A broad tree, its crown filling the hex, roots lifting the kerb, lanterns hung in it, people gathered underneath.                          | DESIGN.md, City layout                 |
| `heartwood.4.png`                        | 15 to 18 districts, not yet the end | A great old tree reaching the top of the tall frame, a stair winding up into a platform in its crown, flowers climbing the trunk.          | DESIGN.md, City layout                 |
| `sunTree.png`                            | The ending                          | The same tree in gold: leaves of sun gold (`#F2C14E`), light pooling under it, seed pods glowing, a crowd and bunting. The game adds rays. | DESIGN.md, City layout; `sunTreeGrown` |
| `heartwood.4.lit.png`, `sunTree.lit.png` | Optional                            | Their lanterns and glowing pods lit, for the dusk look (below).                                                                            | New                                    |

## Empty plots and landmarks

| Piece           | Id / files                                                  | What it shows                                                                                                                                                                                                                       | Source                             |
| --------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Empty plot      | `slot.png`                                                  | A cleared hex of pale earth and grass, marked out with stakes and string, a small stone at its centre where a Graft will be planted. Quiet and inviting, not ruined. The game draws its highlight when a Graft can be placed there. | `src/ui/City.tsx`                  |
| Cider Mill      | `ciderMill.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`      | Millrace Quarter next to Orchard Ward: the mill race runs through the shared edge into a cider press with apple carts.                                                                                                              | `root-city.json` `landmarks`       |
| Heartwood Grove | `heartwoodGrove.edge.e.png`, `.edge.ne.png`, `.edge.nw.png` | Mended Commons with 3 green districts beside it: an arch of old branches grown over each of its edges with a green neighbour.                                                                                                       | `root-city.json` `landmarks`       |
| Estuary Works   | `estuaryWorks.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`   | Tidal Quarter next to Millrace Quarter: a sluice and turbine house where the mill race meets the tide.                                                                                                                              | `root-city.json` `landmarks`       |
| Charcoal Works  | `charcoalWorks.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`  | Ridge Quarter next to Foundry District: charcoal clamps and a shared forge, smoke drawn in code.                                                                                                                                    | `root-city.json` `landmarks`       |
| Glassworks      | `glassworks.edge.e.png`, `.edge.ne.png`, `.edge.nw.png`     | Sun Quarter next to Foundry District: a glass furnace glowing through its door, panes of solar glass stacked in racks, a mirror catching the light.                                                                                 | proposals/sun-desert.md, Root City |

Landmarks are drawn along the edge two districts share, exactly as the Hedgerow's and Snow Fence's
pieces are on the map ([ART-EXPANSION.md](ART-EXPANSION.md), Hedgerows on edges): the piece
for the tile's east, north-east or north-west edge, on the standard frame, sitting across the
paper gap. Keep each piece within about 60 px of its edge so it never covers a district's
landmark shape. With art, a landmark replaces today's gold clasp.

## Dusk

Coming home from a run, the city settles into dusk: after a moment the light dims and cools over
2.5 seconds, the windows and lanterns glow, and after 7 seconds day returns. The Sun Tree's growing
brings a dusk too. With reduced motion there is none. The code-drawn city dims as well, so the
look works before the art arrives. For the glow, give `id.tier.lit.png` (the same frame,
windows and lanterns lit, a full image as the map's `.lit.png` files are) for each Sapling and
Heartwood district, and for the last Heartwood stage and the Sun Tree. Seedlings stay dark.

## Turning parts

As on the map: `id.tier.rotor.png`, the part alone on the same frame, with an orange hub so the
importer finds its pivot. One rotor per image: the Millrace Quarter's main wheel (all tiers) and
the Tidal Quarter's tide turbine (Heartwood). Other wheels are painted still.

## What the game draws in code (don't paint)

- The tier dots under each district, the Tempest badge and its level, and the selection and
  placement highlights.
- Smoke and steam, birds, butterflies, falling petals, and people walking between districts. Paint
  your figures standing still at work.
- The Sun Tree's rays, the dimming for dusk, and the glow over lit windows.
- The composting of a replaced district (it sinks into its plot), and the planting of a new one.

## Files

| Kind                    | Files                                                                                                   | Count | Source |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Districts               | `id.seedling.png`, `id.sapling.png`, `id.heartwood.png` for the 7 districts                             | 21    | New    |
| Heartwood and Sun Tree  | `heartwood.1.png` … `heartwood.4.png`, `sunTree.png` (tall frame)                                       | 5     | New    |
| Empty plot              | `slot.png`                                                                                              | 1     | New    |
| Landmarks               | `id.edge.e.png`, `.edge.ne.png`, `.edge.nw.png` for the 5 landmarks                                     | 15    | New    |
| Optional: dusk          | `id.sapling.lit.png`, `id.heartwood.lit.png`; `heartwood.4.lit.png`, `sunTree.lit.png`                  | 16    | New    |
| Optional: turning parts | `millraceQuarter.seedling.rotor.png` (and `.sapling`, `.heartwood`), `tidalQuarter.heartwood.rotor.png` | 4     | New    |

42 images are needed, and up to 20 more are optional (all delivered but the Sun Quarter's and the
Glassworks', above). Deliver them to `art/incoming/city/`.
Icons for the interface are cropped from the Heartwood tier, so no icon files are needed.
District cards and expedition art are not part of this request.

Paint in this order:

1. One district at all three tiers, the Millrace Quarter, to settle the ladder.
2. The other five districts.
3. The Heartwood stages and the Sun Tree.
4. The empty plot and the landmarks.
5. The optional dusk and rotor files.
