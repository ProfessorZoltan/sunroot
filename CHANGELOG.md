# Changelog

## The season card's spare energy is real

- The season card no longer counts heat that heat wells give out (without grid heat) as energy
  made, and counts as used the energy set aside for the night, so the spare it shows is what
  workshops and kilns can run on.
- Fixed: a slot short of energy could keep buildings on with the heat wells' heat, as if it
  were energy.

## Building needs on the map

- **Show building needs**, a new toggle on the map: over each building that needs anything this
  season, what it gets out of what it needs (X/Y) of water, day energy, night energy, heat and
  cooling; green when met, red when short. Off by default, and remembered between visits.
- With it, what workshops, kilns, silk houses and digesters use of spare energy (`uses 2 day`),
  on a slate-blue label of its own: no "out of", as it isn't a need they can go short of.

## Lake Gardens in hand-made art, and winter coats

- **Lake Gardens is drawn in its own art**: the shallows, deep water and raised beds, the lake's
  reed fringe, streams, willows and drowned town, every lake building and evolution, the
  Floating City at each stage, axolotls, herons, kingfishers and flamingos with their young, the
  festival cards, and the Canal Quarter (its water wheel turning) and Water Market in Root City.
- **Citizens wrap up for winter**: padded, quilted tops and coats, wherever winter brings snow.

## Rainforest Gardens: the Canopy Walk, the forest's animals and festivals

- **The Canopy Walk**, the forest's wonder: a walkway slung through the crowns of six great trees
  over a flower of rainforest, from era 3, once a Midden Loop is closed and 3 forest gardens have
  grown all their storeys. Finished, no field washes in the monsoon and every layer grows a
  season sooner; +60, a tier on the Graft, or the Bloom era's goal.
- **Hummingbirds** (gardens and milpas near their coffee bushes bear more in spring), **fruit
  bats** (canopies near them grow a season sooner), **hornbills** (each autumn, bare ground and
  scrub beside the forest heal a step) and **jaguars** (wellbeing for each range of unbroken
  forest), with their young as keepsakes.
- **Festivals**: the Feast of the First Rains, the Harvest of the Canopy and Odalan, the water
  temple's festival.
- A forest garden costs 5 materials, not 4, to keep the forest level with the other biomes.
- Bots no longer stop building while a wonder waits on its gardens to grow.

## Rainforest Gardens in Root City

- **The forest opens once 10 districts stand** in Root City, and is offered at once; its first
  run is guided.
- **The Canopy Quarter**, a new district earned by layered food (forest gardens and orchard
  gardens): orchards and forest gardens make more food in the colder seasons, and it brings the
  **Forest Garden**, layers and all, to every biome's drafts.
- **The Seed Forest**, a new landmark where the Canopy Quarter meets the Mended Commons:
  woodland is worth 1 more Harmony a tile, in every biome.
- **The forest's regions**: Old Plantation (a restoration run on a worn-out estate), River
  Forest (a floodplain two tiles wide), Volcano Slopes (hills over half the land) and Swidden
  Mosaic (twice the clearings, and dark earth from old gardens).
- **Its own twists**: Long Rains (the monsoon twice a year), El Niño (a dry summer, fire risk in
  summer too and a low river) and Leaf Blight (the bananas bear nothing). Set from the bots' runs,
  River Forest lifts the Graft a tier; the others lift nothing.
- Scavengers' text in the forest gave the Reach's numbers; it now says 42 instead of 30.

## Rainforest Gardens on screen

- **The forest in the interface**: a field's fertility and what the monsoon will do to it, dark
  earth, a garden's layers and a midden's progress in the tooltip and the inspector; a Forest
  row in the left panel; the fields the monsoon will wash and the tiles fire could catch, marked
  on the map and named in the banner; a "The forest" section in the season report.
- **Layers from the inspector**: a forest garden's inspector lists its layers, with a button to
  add each one.
- **The forest on the map**: a garden's layers drawn over it as they grow; in the season's
  playback, rain running off the bare fields, fire taking the forest, dark earth spreading, the
  first rains and the dry season's haze. No snow in the dry season.
- **An art guide for the forest**: its tiles, buildings and layers, and the wonder, animals and
  festivals to come.

## Rainforest Gardens: combos, cards and balance

- **The forest's combos**: the Midden Loop (dark earth twice a year), the Kihamba Loop, the Milpa
  Cycle (an old milpa planted with trees becomes an Orchard Garden, and in time a forest garden in
  three storeys, the land back under forest), Four Storeys, the Subak, the Living Mosaic (enough
  forest and no fire starts), Pepper on the Tree and Cool Shade.
- **Eight forest tunings** and two charters, Forest First and Swidden Rights.
- **Middens are fed first**, before the composters take every scrap.
- **The bots play the forest**: they grow gardens up a layer at a time, make dark earth, fence
  the fire's few edges and feed the poorest fields. Over 40 seeds the forest reaches Heartwood as
  often as the Reach (36%), after forest gardens were cut back.
- A forest map that found no site for its camp now always finds one.

## Rainforest Gardens: the forest's simulation

- **The forest's map**: rainforest over most of the land, a river with its floodplain, hills on
  one side, a few clearings, and an old plantation's worn-out estate with four ruins. Harmony
  starts at 12, counted from the forest as it stood: clearing it costs, healing gains.
- **Its seasons**: the first rains (a milpa sown with them makes more in summer), the monsoon
  (fertility washes from bare fields; the river floods), the cyclone (it fells a garden's
  canopy) and the dry season, when fire may catch where a field or scrub meets the forest
  unless a living fence runs between.
- **Its buildings**: the milpa, forest garden, raised house, kitchen midden, char hearth, stall
  barn, bee tree, rice terrace, water temple, living fence and micro-hydro, drawn in code. Homes
  need cooling on summer days, which a grown canopy beside them gives; nothing needs heat.
- `?biome=rainforestGardens` opens it; Root City offers it later. A Year 1 walkthrough is
  proposed as its golden test.

## Rainforest Gardens: the forest's rules

- **Rainforest Gardens** is the sixth biome, joining once 10 districts stand in Root City. Its
  rules come first; the biome itself follows.
- **Layers**: a forest garden can take a shrub layer, an understory and a canopy, added one a
  season. Each grows in its own time and makes its own crop; the understory mulches the ground
  and the canopy helps the shrubs.
- **Fertility**: fields hold fertility. A milpa burned out of the rainforest starts with 3 and
  makes 1 more food for each point. The monsoon washes 1 out of every field nothing covers; a
  field with none left makes half and wears down. Compost puts it back.
- **Dark earth**: a kitchen midden, fed scraps with a char hearth's charcoal near, turns a tile
  into dark earth once a year. Dark earth keeps its fertility for good and gives a farm 1 more food.

## Lake Gardens: the Floating City, its animals and festivals

- **The Floating City**, the lake's wonder: raised beds in flower round a willow island, out on
  the water. Finished, the lake silts up and blooms no more and chinampas make 1 more food.
- **The lake's animals**: axolotls in the canals between beds, herons by the fisheries,
  kingfishers along the willow edges and flamingos on a wide clean lake; their young ones are
  keepsakes in Root City.
- **Its festivals**: Flower Boats, the Silk Fair (silk houses run once more) and Lanterns on the
  Water.
- The bots keep the wonder's site out on the deep water, and no longer stop building while they
  wait on a wonder's biomass or food.

## Lake Gardens in Root City

- **The lake opens after 10 runs**, however many districts stand, and is offered at once.
  Its first run is guided.
- **The Canal Quarter**, earned by food from chinampas, fisheries and fish ponds: fish ponds make
  more food in the cold seasons, and the Mud Boat joins every biome's drafts (lifting silt from
  the river or a pond beside it as compost).
- **The Water Market** (the Canal Quarter next to an Orchard Ward): food beyond storage keeps a
  season before it rots, in every biome.
- **The lake's regions** (Open Lake, Delta Mouth, Reed Marsh, Drowned Town, Island Chain),
  **twists** (Dry Season, Bloom Year, Monsoon, and the shared ones that fit) and its own Tempest.
- The Fog Net reaches the lake with the Sun Quarter, as in the other biomes.

## Lake Gardens on screen

- **The lake in the interface**: a Lake row in the left panel (its grey water, and whether it
  will bloom), the mud and silt on each shallows tile in its tooltip, where water comes into the
  lake, a bloom forecast in summer, and a "The lake" section in the season report.
- **The lake on the map**: mud lying on the shallows, silted shallows thick with sedge, the water
  greying as grey water gathers and turning green when it blooms, rings spreading round a new
  raised bed, fish leaping from the open water and mist on it in autumn and winter.
- **A winter of low water, not snow**: the shallows fall back from the shore, and willow leaves
  fall instead of snow.
- **An art guide for the lake**: its tiles, buildings, wonder, animals and festivals, and the
  Canal Quarter and Water Market for Root City.

## The whole cast

- **All 12 citizens now walk the map**, each with their own face, build and skin tone, dressed
  in the 8 colours. One goes about in a wheelchair.

## Lake Gardens: combos, cards and balance

- **The lake's loops**: the Dyke Loop (silk, mulberry, fish and mud), the VAC Loop (pond, house,
  pen and bed) and the Clean Lake Loop (house, wastewater fishery, bed).
- **Its formations and evolutions**: the Floating Garden (4 chinampas round an open pool that
  never silts), the Willow Shore, Duck and Rice, the Rice-Duck Paddy and the Floating Market.
- **8 tunings and 2 charters**: Canal Keepers (the lake never blooms) and Water First (beds take
  at most half the shallows; the fish make more).
- **Stilt houses beside a garden** (a bed, meadow or woodland) are happier, as cottages beside
  meadow are.
- **The chinampa** costs 4 and makes 2 / 3 / 3 / 1 food (+1 with open water on 2 sides); high
  water fills the lake to 1 a tile, so a lake turned all to beds runs dry; the stream always runs
  a few tiles before it reaches the lake.
- The bots now keep the lake clean, dredge it, shelter their beds and make silk, and reach
  Heartwood on the lake about as often as in the Reach. The proposed Year 1 changed to fit.

## The Regenerative Loops Atlas

- The research behind the game's loops, as its own page: 41 farming, housing and rewilding
  systems from around the world, each with its loop drawn as a diagram and its sources. Open it
  from the menu (Regenerative Loops Atlas), or at `/learn/regenerative-loops.html`.

## Lake Gardens, playable (not yet in Root City)

- **The lake's valley**: a broad shallow lake over nearly half the map, deep water in the middle,
  small islands, a stream running in, reed fringe on the shore and the drowned town's ruins at
  the water's edge. Open it with `?biome=lakeGardens`.
- **Its seasons**: high water floods the reed fringe and leaves twice the mud; the summer may
  bring an algae bloom; the autumn wind off the deep water can damage what stands on beds facing
  it, unless a willow edge shelters them; low water in winter makes dredging easy.
- **Its buildings**: the Chinampa, Mud Boat and Stilt House to start, then the Wastewater and
  Lake Fisheries, Mulberry Dyke, Silk House, Pig Pen, Duck House, Willow Edge, Floating Solar and
  Canal Wheel, with the shared buildings that fit.
- A proposed Year 1 for the lake, for review.

## Combos you can see

- **Combo cards show their buildings**: the Almanac, a discovery, an evolution choice, the
  placement preview and the season report draw each combo's buildings and tiles with the map's
  own art, in the order the card reads (next to, then, becomes, in a line, around it).
- **A building's details** list the closed loops it stands in and the combos you have found that
  it takes part in.
- **Highlight a loop**: the map's Highlight picker lists your closed loops; pick one to light up
  its buildings.

## Lake Gardens begins

- **Lake Gardens** will join after 10 runs, whatever the city has built. Its lake's rules are
  in, though no valley uses them yet: shallows that a chinampa turns into a raised bed; mud that
  the water reaching the lake leaves on the shallows, which silts them up unless a mud boat
  lifts it out as compost; and grey water that stays in the lake, costing Harmony, feeding a
  wastewater fishery, and in summer blooming if there is too much of it.

## What would go short

- **Short if it ended now**: a new picker on the map lights up the buildings that would be short
  of power, heat, water or cooling if the season ended now, and lists them with the reason. The
  map marks the blackouts and the cold and hot shut-offs too.

## Ice and frost, from the research on regenerative systems

- **The Sun Desert's Ice House**: in winter it freezes the water it draws (beside the river, the
  oasis, a channel or a qanat), and in summer its ice cools the homes around it before the grid
  has to. A little melts every season.
- **A late frost in the Highland**: it comes with the snowmelt, and farms up the slope make 1
  less food in summer and autumn, unless standing water beside them (a cistern, a fish pond, a
  reed bed, the stream) keeps it off. The map marks the farms it will strike.
- The bots now keep the frost off too: farms up the slope beside standing water, and a cistern
  among the terraces before the snowmelt.
- **Lake Gardens**, a proposed fifth biome of raised beds, dredged mud and clean water
  (docs/proposals/lake-gardens.md), for review.

## Less busywork late in a run

- **Spread compost many times at once**: under Build, choose how many times, and it goes where
  it gives the most Harmony (finishing a Wildway if one is in reach). One undo takes it all back.
- **Hedgerows no longer give Harmony.** They still shelter buildings from storms, and 4 in a row
  still make a windbreak.
- **Prioritize buildings**: tick several (Shift for a run of them) or a whole kind at once and
  move them together, to the top, the bottom, or one place at a time; or sort the whole list
  with a preset: Food, Energy, Water, Homes or Industry first.

## Fixes

- **Building tooltips say everything a building does**: what it uses (energy by day or night),
  what changes its output (shade, fog, snow, height, neighbours), what the smokehouse, cistern,
  fog net, well, pump station and the rest are for, and each land's own words (the king tide,
  salt flat). A well says it serves homes only. Draft cards show the full text on hover.
- A **desalinator** can now start its own irrigation channel: lay one from beside it, and its
  clean water runs down the channel to the crofts and greenhouses along it, wherever they are.
- Demolishing a building on the coast's mudflat, saltmarsh, dune or sea, or on the Highland's crag
  or bog, now leaves that ground as it was, ready for seals, oyster reefs or a wonder, instead of
  turning it to barren land.
- Compost, tree nurseries and Green Terraces leave the coast's dunes alone now, like its mudflats,
  instead of turning them into barren land. Dune grass and pollinator meadows still grow on them.
  So **Restore the Shore** counts the land from barren to woodland, as in the Reach, and asks for
  60% of it, as the Reach's vision does.

## New art

- The **Sun Quarter** and the **Glassworks** in Root City are hand-painted now.
- Every keepsake's art: the animals' young ones, the city's banner, window boxes and bird boxes.
- The leaping fish of each land, and the first of the citizens walking between home and work.

## Ready for the citizens' and fishes' art

- The game now draws the walking citizens and the leaping fish from hand-made art as soon as it
  comes (docs/ART-PEOPLE.md): a cast of twelve in many clothing colours, resting at home and at
  work between walks, and a fish for each land. Until then they stay drawn as before.

## New expeditions and keepsakes for Seeds

- Don't like the three expeditions on offer? In Root City, **New expeditions** shows three other
  valleys for 5 Seeds, then 10, then 15 before the same run.
- **Keepsakes**, things to spend Seeds on just to look at, in a new panel in Root City: the
  animals' young ones (otter cubs, a seal pup, fennec cubs, the white hart and a dozen more), and
  ornaments for every settlement (the city's banner, bunting all year, window boxes, channel
  lanterns, bird boxes, kites) and for Root City (lantern paths, fireflies, a fountain, kites).

## The Solar Oasis

- The desert's wonder, the **Solar Oasis**: a flower of mirrors round a solar tower by the water,
  from the third era, once a **Grey Water Loop** runs and two Concentrated Solar Plants stand.
  Finished, it gives energy day and night, clean water into the channel beside it, +60 and a
  higher Graft.
- The desert's animals: **fennec foxes** in the scrub help the oasis gardens in summer,
  **sandgrouse** at the oasis carry water to the cisterns, **lanner falcons** nest on wind
  towers by the rocks, and **oryx** herds roam the open gravel.
- Its festivals: the **Rain Feast** fills every cistern, the **Night Market** spares the homes
  some cooling, and on **Star Night** the lights go out and homes use less energy.
- The Sun Desert's **hand-made art** is in: every tile, building, animal and festival card, and
  the Solar Oasis as it is built. Qanats show as lines of shaft mounds.
- A wonder's details now say the energy and water it will give.

## The Sun Desert in Root City

- Once **8 districts** stand, Root City sends expeditions to the **Sun Desert** too; the
  first one is guided.
- The **Sun Quarter**, earned by sun-led runs: solar canopies make more in the darker seasons,
  and it brings the **Fog Net** to every biome. With the Foundry District beside it, the
  **Glassworks** makes greenhouses and canopies cheaper everywhere.
- Five desert regions (the Oasis, Wadi Country, the Erg, Salt Pan, Old Array) and its own
  twists: **Haboob Year**, **Rainy Year** and **Scorching Year**.

## The Sun Desert on screen

- **Cooling** in the tooltips, the inspector and the season report: which wind tower or chiller
  cools which home, and what the grid pays for the rest.
- The river **runs dry** in summer; the **heatwave** shimmers and dries it as it plays out, and
  the **dust storm** blows sand across and dims the panels.
- Heat shimmer over the sand, **glints on mirrors and panels**, and a green winter: no snow in
  the desert.

## The Sun Desert's combos

- Ten desert combos: the **Courtyard** (a mud-brick house by a wind tower and a cistern needs no
  cooling), **Date Shade**, the **Grey Water Loop** (homes' washing water, cleaned by reeds,
  waters a garden), the **Heliostat Line**, the **Green Wall**, the **Long Qanat**, and three
  evolutions: the **Three-Layer Garden**, the **Fog Fence** and the **Restored Array**.
- Eight desert tunings and two charters, **Water Keepers** and **Siesta**.
- The Cell Bank is unlocked from the start of a desert run.

## The Sun Desert takes shape

- The fourth biome's land and rules, not yet reached from Root City: a thin river that floods
  its wadi banks in the spring **flash flood** and runs dry in the summer **heatwave**, an oasis
  whose spring refills it every season, gravel plain, dunes, rock, a salt flat and the ruins of
  an old solar array.
- On hot days homes need **cooling**: wind towers and shade give it free, **absorption
  chillers** make it from spare heat, and the grid pays 2 energy for each. Mud-brick walls need
  none but in a heatwave, and no heat on cold nights.
- **Dust storms** dim the panels and mirrors and bury what they reach, unless a **palm
  windbreak** shelters it. **Fog nets** catch water with no river; **qanats** carry it
  underground, losing none to the sun; the **Concentrated Solar Plant** keeps some of the day
  for the night; the **sand battery** stores spare day energy as heat for cold nights.

## Root City at dusk

- Coming home from a run, **Root City settles into dusk**, its windows lit, before day returns;
  the Sun Tree's growing brings a dusk too (not with reduced motion).
- Root City is **hand-painted**: every district at each tier, from a first hut to a thriving
  quarter, the Heartwood growing through four stages into the golden Sun Tree, staked-out empty
  plots, and the landmarks between districts. Its mill wheels and tide turbine turn.

## The Highland's art

- The Highland is **hand-painted** now: its crags and bogs, the glen's own meadow and scrub,
  every Highland building in summer and winter (turning wheels, lit bothy windows), the Cloud
  Terraces as they are built, the hares, dippers, eagles and martens, and the festival cards.

## The Highland's wonder, animals and festivals

- **The Cloud Terraces**, the Highland's wonder: terraced gardens over 7 tiles climbing the
  slope, from era 3, once a Carbon Loop is closed and 2 pump stations stand. Finished, homes
  within 3 tiles need 2 less heat each night, +60 to the score, the Graft a tier higher, and
  the Bloom era's goal (the Highland now has one).
- **Mountain hares**, **dippers**, **golden eagles** and **pine martens** come to the glen.
- The **Snowmelt Fair** fills every cistern and bog; **Shieling Day** brings the shielings
  more food; **Lantern Night** as in the Reach.

## The energy mix

- A **Mix** button at the end of the year strip opens a chart of the year's energy, by day and
  by night through the four seasons, stacked by kind of source (the camp, water, tide, sun,
  storage, biogas, wind), with a line for what the settlement needs. Hover a slot for its
  numbers, or show them as a table.

## The Highland in Root City

- Once **4 districts** stand in Root City, expeditions go to the **Highland** too, taking turns
  with the Reach and the coast. The first run there is guided.
- A new district, the **Ridge Quarter**, from heat-led runs (heat from stoves, collectors and
  warm neighbours): homes need less heat at night, and the **Bothy** joins every biome's
  drafts. Next to the Foundry District it makes the **Charcoal Works**: kilns and biochar kilns
  run once more each season.
- The Highland's **regions**: the Glen, Corrie Lochs (mountain tarns), High Plateau, Old
  Pinewood and Old Mines; its own **twists**: Deep Winter, Föhn Wind and Late Thaw.

## The Highland on screen

- A Highland run can be played with **`?biome=highland`**, a visit like the coast's was, until
  Root City sends expeditions there.
- **The land has height**: tiles stand higher a step at a time, on cliffs, and the pointer
  finds the raised tile it is over. Hovering a tile names its height.
- A pump station shows the water it lifted up its step; panels snowed under up high wear snow.
- An art guide for the Highland: its tiles, buildings and evolutions, with its wonder, animals
  and festivals to come.

## The Highland: combos, cards and balance

- The Highland's own **combos**: the Carbon Loop (coppice, biochar kiln, farm), the Meltwater
  Loop (a bog, a pump and a terrace: the pump lifts more), Hearth Stones (a bothy by a heat well
  burns no biomass), High Pasture, the Water Stair, the Snow Line, Ridge Spires (no Harmony
  cost), and three evolutions: the **Hanging Garden**, the **Cascade** and the **Bat Roost**.
  The Reach's farm loops work with terrace and glen farms.
- **8 Highland tunings** and **2 charters** (Mountain Rescue, Hearth Keepers).
- Bothies burn 1 biomass in autumn and winter for their heat, and house 3. A snow fence keeps a
  high solar canopy making a little in winter.
- Balance: glen and terrace farms make more, and glen farms drink straight from the stream; the
  glen has a fourth old mine; Lantern Night comes to the Highland; and a Highland run scores +35
  for wintering in it.

## The coast's art, and the Well's

- The Windswept Coast is **hand-drawn**: the sea, mudflat, saltmarsh, dunes and rocky headlands;
  every coast building, from crofts and tide turbines to the lighthouse, whose lantern lights at
  night, and the tide turbine's turning blades; terns, seals, puffins and dolphins, summer and
  winter; Kite Day's and the Harvest of the Sea's cards; and the Tidal Lagoon, as it is built
  and finished.
- The **Well** has its own art and icon.

## The Highland: its glen and its rules

- The third biome's land: a stream falling down a glen, slopes rising to crags, bogs and old
  mines on the shoulders. Not yet reachable from Root City (HL5).
- **Height** is a rule: water runs only downhill, and a **Pump Station** lifts it a step;
  homes high up need more heat, wind spires high up make more, and panels high up are snowed
  under in winter.
- Its buildings: **terrace farms** on the slopes, **glen farms** on the floor, **shielings** up
  high, **hill turbines** where the stream drops, **bothies** with their own stove, the
  **Biochar Kiln** (+1 food for good on the farm it chars), snow fences, rewetted bogs and
  lookouts.
- Its year: the **Snowmelt** floods the glen floor (no silt), the **Dry spell**, **Gales** on
  the tops and **Deep snow**. Heat always needs a building.
- Fixed: a bothy next to another home kept its own stove's heat (it used to give it away).

## The coast's Year 1 approved

- The Windswept Coast's Year 1 walkthrough is now its **golden test**: 9 materials, 8 food and
  8 citizens at the end of the first winter, as reviewed.

## The Windswept Coast: its wonder, animals and festivals

- The coast's wonder, the **Tidal Lagoon**: from era 3, a flower of 7 tiles over the shore and
  the sea, needing a closed Kelp Loop and 2 oyster reefs. Finished, it makes 2 energy by day and
  by night, adds 60 to the score, raises the Graft a tier and meets the Bloom era's goal.
- **Terns** (crofts by the dunes +1 food in summer), **seals** (kelp farms near them +1 food),
  **puffins** (+1 wellbeing at a lighthouse) and **dolphins** (+1 wellbeing per pod) come to
  the coast as Harmony rises.
- Festivals: **Kite Day** (wind spires +1 that spring), the **Harvest of the Sea** and Lantern
  Night.
- Fixed: wonders now appear on the Build palette from their era, so the Great Water Garden can
  be started from it.

## The Windswept Coast in Root City

- From run 5, Root City's expeditions go to **either biome**, taking turns, each with its own
  twists and regions. The first coast run has a guided first year and opens with what is new
  there.
- The coast's **regions**: Shingle Spit, Saltmarsh Estuary, Sea Cliffs (the Graft a tier higher)
  and Drowned Harbour; its own **twists**: Big Tides, Becalmed (the Graft a tier higher) and
  Fogbound.
- A new district, the **Tidal Quarter**, from tide-powered runs: 4 draft cards in the first
  season of each era, and the **Tide Mill** (a store the tide fills each season) in coast drafts.
  Next to the Millrace Quarter it makes the **Estuary Works**: coast runs start with the
  **Estuary Turbine** at the stream's mouth.
- **Tempest levels unlock per biome**, where the Heartwood Graft was earned.

## The Windswept Coast on screen

- A coast run can be played with **`?biome=windsweptCoast`**, until Root City sends expeditions
  there. It is a visit: never saved, and your run and city are kept as they were.
- The coast is **drawn in code** until its hand-made art comes: the sea, mudflat, saltmarsh and
  dunes, and its crofts, tide turbines, wave buoys, kelp farms, oyster reefs, beachcombing yards,
  dune grass, sea walls, lighthouses, smokehouses and desalinators.
- **The tide** comes in over the mudflat by night and goes out by day as each season plays out.
- **Salted crofts are marked** on the map, and the forecast says which ones the king tide will
  salt; risky tiles, wording and the night's captions name the coast's own things.

## The Windswept Coast: combos and balance

- The coast's **food**: crofts make 2 / 5 / 5 / 0, the founders' camp gathers 1 food a season on
  the shore, and kelp farms make 2 in winter, so a first year on the coast grows as one in the
  Reach does.
- Its **combos**: Shellfish Beds, Lee of the Dunes, the Kelp, Sweetwater and Shore Loops,
  Breakwater, Dune Line, Wind Ridge, the Machair Croft, Kelp Forest and Rock Pool, with the
  Kitchen and Gas Loops built with crofts. An emptied salvage yard inland becomes a Rewilded Ruin;
  by the shore, you choose it or a Rock Pool. All are in the coast's Almanac.
- **8 coast tunings and 2 charters** (Shore Keepers, Storm Wardens). **Restore the Shore** asks
  for half the coast's healable land.
- Every coast run scores **+25 for a wild coast to weather**, so its runs reach the Graft tiers
  about as often as the Reach's.

## The Great Water Garden

- From era 3 of a run with water, the valley's wonder can be built: the **Great Water Garden**, a
  flower of 7 tiles of pools, reeds and stepping stones around a pavilion. It needs a closed Bath
  Loop and 3 reed beds, costs 60 materials and 30 biomass, and takes 4 seasons to build, a stage
  at a time on the map.
- Finished, it adds **60 to the score** and raises the **Graft a tier**, and it meets the Bloom
  era's goal.

## Wildlife and festivals

- From run 2 (with water), **animals come to the valley** as Harmony rises, if their habitat is
  there, and leave if either goes: **wild bees** at Harmony 20 (summer farms next to 2 meadows +1
  food), **otters** at 40 by a reed bed on the river (fish ponds and paddies nearby +1 food),
  **beavers** at 50 at a weir by woodland (they make the Beaver Dam) and **deer** at 70 in woods of
  4 or more tiles (+1 wellbeing a season per herd). They move about their habitat on the map, and
  the run overview says who is here and what would bring the rest.
- **Festivals**, once a year each, from a card in the right column in their season: the **Flood
  Fair** (spring, 5 materials: +3 wellbeing, silt one tile beyond the flood), the **Harvest
  Festival** (autumn, 10 food: +5 wellbeing and a free reroll) and **Lantern Night** (winter, 5
  materials: +3 wellbeing if no night runs short, lanterns at the homes, and the animals come out).
  Bunting goes up while one is held; calling it off gives the cost back.

## Heat kept close, earned

- From run 4 (and in a Long Winter) the heat layer's score line is earned instead of flat: 1 point
  for each citizen living in a home that was never cold all run, about as much as the old +14 and
  the day-energy change took away together.

## Day energy for industry; energy and heat apart; storage gauges

- **Salvage Yards, Workshops and Kilns need 1 day energy** to work, and workshop and kiln runs use
  spare day energy only. The Year 1 walkthrough's winter now ends at 9 materials, and a Cell Bank
  no longer covers that winter night (for review).
- Graft tiers follow the lower scores: Sapling from 215, Heartwood from 345.
- **Energy and heat are shown apart**: season cards, their tooltips and the season report list
  energy use and heat needs separately, with energy turned into heat as its own line (and ⚡ on
  the card).
- **Storage gauges**: hover or open a cell bank, reservoir or heat well to see how full it is now,
  where it will stand when the season ends, and what it charges and gives.

## Type

- Numbers are set in Atkinson Hyperlegible Next, easier to read at a glance; titles stay in
  Fraunces and text in Nunito. All three fonts now come with the game, so nothing changes font
  after the page loads.

## More room for the map

- The footer is gone. **End season**, **Undo** and **Fast-forward** sit at the foot of the map;
  everything else is in the **Menu**, now with **Fullscreen** and **Prioritize buildings**.
- The forecast is a banner along the top of the map.
- Season cards name what their numbers are: energy made / used and heat met / needed, by day and
  by night.
- **Stores** fold to Materials, Food, Jobs, Water and Walks; **Build** folds away. Vision, era
  goal, expedition, last season, loops and tunings are in the **Run overview**.
- Building details open over the map.
- **Prioritize buildings**: drag buildings into the order they are staffed, shut off in a blackout
  and watered; a building clicked on the map or in the list is highlighted in both.
- **Highlight** a terrain on the map: the other tiles dim.
- The window can be much narrower; long names wrap, and dialogs keep their buttons in view.
- Fixed: water in channels drifted towards the river instead of away from it.
- The Harmony 40 bell melody is softer and lower.

## Walks to water

- From run 3 (with walks to work and water), each home walks to its nearest drinking water: the
  river, a lake, a channel, a cistern or the new **Well** (3 materials). More than 2 tiles costs
  wellbeing, like long walks to work.
- Home tooltips, map marks, the placement preview, the Walks row and the season report show it.

## Playtesting the new cards

- The playtest log records the layers each run plays with, the combos discovered each season and
  evolutions chosen, and hedges and coppices among what was placed.
- [docs/playtest/willow-reach-v2-cards.md](docs/playtest/willow-reach-v2-cards.md): how to reach
  the five new cards quickly, and what to look for when playing them.

## Fewer tunings

- A run takes at most 12 tunings and refinements, down from about 28. Past that, drafts offer
  blueprints only, and once every blueprint is drafted there is no draft. Tuning cards and the
  Loops panel show how many you've taken.
- Graft tiers follow the lower scores: Sapling from 240 (was 245), Heartwood from 375 (was 385).
- The layers' score lines are re-sized so each run of the ladder reaches Heartwood as often:
  walks to work +5 (was +3), heat kept close +14 (was +18); water stays +12.

## Start over

- **Start over** in Root City forgets the city and any run in progress and begins again at run 1,
  as a new player would. It asks first; tick its box to forget the Almanac's discoveries too.

## The E3 gate, restated and passed

- Willow Reach v2's balance gate now asks whether the bots need any one new card to win: leaving
  each out of the draft in turn, the bots' Heartwood share never drops by more than the noise.
  It passes. The first wording (no card in more than 40% of winning runs) counted the bots' habits.
- `scripts/e3-gate.ts` prints the verdict. The new cards are tuned by playtesting next.

## Hedgerows on edges, on screen

- The Hedgerow is back in the draft. Pick its card and point at the side of a tile: the side lights
  up gold where a hedge can go, red where it can't. Click to plant (2 materials), click again to
  clear. `[` and `]` turn the side from the keyboard.
- Hedges have hand-made art along every side, summer and winter, and the tooltip says how many
  sides of a tile are hedged.

## Hedgerows on edges, in the simulation

Built in the simulation only: the map can't show them yet, so the Hedgerow is out of the draft
until it can. Nothing changes in play.

- A hedge runs along the edge between two tiles (2 materials a segment) and takes no tile.
- It shelters the buildings on both its sides from storms; every 2 segments give 1 Harmony.
- The Windbreak is now 4 hedges joined end to end; it shelters everything within 2 tiles.
- Bots plant hedges beside the buildings storms could damage.

## Hand-made art for the expansion

- Every Willow Reach v2 building and evolution, the Irrigation Channel and Hedgerow (which now join
  up with their neighbours), the Sluice Gate where a channel leaves the river, and the Cistern now
  have hand-made art, summer and winter.
- The Water-source Heat Pump has its own art; the Air-source Heat Pump takes the first Heat Pump's.
- The Bathhouse, Aquaponics Hall, Mushroom Cellar and Old World Archive light their windows at
  night; the Singing Spire's blades turn.

## Heat needs a building (run 4)

- From run 4, and in a Long Winter, energy can no longer heat anything directly. Homes,
  greenhouses and bathhouses need a heat source within 2 tiles: an **Air-source Heat Pump**
  (new: anywhere, 2 heat for 1 energy, unlocked from the start with the layer), a
  **Water-source Heat Pump** (the old Heat Pump, now 3 heat for 1 energy, by the water), solar
  thermal collectors by day, heat wells, or a warm neighbour.
- A building no source heats goes cold and is shut off for the season; a cold home costs
  wellbeing for each bed in it. Tooltips, the building panel, the season report and the placement
  preview say so.
- Heat wells fill only from collectors or a nearby pump's spare capacity, never straight from
  energy.
- Runs 1 to 3 are unchanged, except that the Water-source Heat Pump pays 3 heat per energy.
- Root City's "Full valley" brings the heat layer too. `?heat=1` turns it on for a seeded run.

## Willow Reach v2: bots, the gate and the Almanac (E3, part 4)

- The bots draft and build the new cards (paddies, mushroom cellars, hedgerows, a bathhouse with
  its reed bed) when the run has water.
- `scripts/e3-gate.ts` checks EXPANSION.md's gate; the report is
  [docs/balance/e3-gate.md](docs/balance/e3-gate.md). As written it fails for the Bathhouse and
  Reed Bed because of one bot's habit; leaving any card out never lowers the bots' wins
  (DECISIONS.md Q19).
- The Almanac shows Willow Reach v2's combos once the run has water, or once found before.

## Willow Reach v2: loops and formations (E3, part 3)

With water:

- **Bath Loop** (kiln or heat well → bathhouse → reed bed), **Rice-Fish Loop** (paddy → composter →
  farm), **Mushroom Loop** (farm → mushroom cellar).
- **Heat Cascade:** a bathhouse warmed by a kiln or heat well passes 1 heat on to a greenhouse next
  to it, so the greenhouse needs no grid heat in winter; kiln → bathhouse → greenhouse is a loop.
- **Keyhole Garden** (a composter among 3 farms: double compost), **Water Ladder** (3 paddies in a
  row: +1 food each), **Windbreak** (4 hedgerows in a line shelter everything within 2 tiles from
  storms), **Hearth Square** (bathhouse, plaza and cottage together: +5 wellbeing in winter).

## Willow Reach v2: seven evolutions (E3, part 2)

With water, from run 2:

- **Food Forest** (orchard + apiary + 2 meadows), **Aquaponics Hall** (greenhouse + fish pond),
  **Canal-top Solar** (a solar canopy built on a channel), **Beaver Dam** (weir + woodland at
  Harmony 50), **Singing Spire** (wind spire + 2 pollinator meadows), **Old World Archive** (an empty
  salvage yard + a library).
- **Branching:** a building that meets two evolutions at once asks what it becomes (Winter Garden or
  Aquaponics Hall; Rewilded Ruin or Old World Archive), and the season waits for the answer.
- **Coppicing:** a new tool turns woodland next to a workshop into a Coppice Wood (2 materials a
  season); stop coppicing and it grows back in 2 seasons.

## Willow Reach v2: five new buildings (E3, part 1)

They join the draft with water, from run 2.

- **Reed Bed:** next to a channel or the river; cleans up to 3 grey water, 1 biomass, +1 Harmony.
- **Bathhouse:** 1 clean water and 1 heat each night → +3 wellbeing; returns 1 grey water. A
  staffed kiln next to it warms it for free, or a heat well next to it pays from its store.
- **Rice-fish Paddy:** floodplain next to a channel; 2 water, food 2 / 4 / 4 / 0, and 1
  nutrient-rich water back into the channel for the farms below.
- **Mushroom Cellar:** 2 biomass → 2 food + 1 compost every season, no energy; +1 food next to
  woodland or a kiln.
- **Hedgerow:** on scrub or meadow; counts as meadow for Harmony and shelters the buildings next to
  it from storms.
- Building tooltips now explain water use, grey water and heat from neighbours.

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
