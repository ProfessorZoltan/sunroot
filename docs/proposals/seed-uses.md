# Proposal: more uses for Seeds

Status: **built**: new expeditions and keepsakes are in the game, keepsakes drawn in code until
their art comes (see DECISIONS.md). The review's answers are at the end.

## Problem

Seeds go to two things: planting a run's Graft (35) and raising a district's tier (15, then 30). A
run earns about 10 + score ÷ 15, so 30 to 35 for a good one. Early on that is tight. Later, once
the districts a player wants stand at Heartwood, Seeds pile up with nothing to buy. And a player
who dislikes the three expeditions offered has no way to see others.

## Goal

Two new things to spend on, neither of which makes a run easier:

- **New expeditions**: a fresh set of three to choose from. A choice of valley, not an advantage.
- **Keepsakes**: purely cosmetic additions, bought once and kept: rarer looks for the animals,
  ornaments on every settlement, and ornaments in Root City. They never change the simulation
  (no score, no rule, no Harmony), so balance and golden tests are untouched.

## New expeditions (built)

| Item       | Rule                                                                                                                                                                                           | Source                  |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| Price      | 5 Seeds for the first new set before a run, 10 for the second, 15 for the third, and so on. Back to 5 after the next run.                                                                      | `progression.scoutCost` |
| What comes | Three other expeditions: other valleys (new map seeds), twists, regions and requests, and the biomes turned round, so another biome leads the offer. The same city always draws the same sets. | `src/sim/city.ts`       |
| When       | Between runs, from the second run (when expeditions are first offered), once the Graft is placed. The expedition chosen from the old set is dropped.                                           | `scoutExpeditions`      |

Rising rather than flat, so it is a way out of a bad offer and not a slot machine.

## Keepsakes (built)

Bought in Root City, from a new **Keepsakes** panel, with Seeds. Each is bought once and kept, and
each can be switched off and on again for free. They are the city's, so they show in every run
after they are bought, in every biome where they fit.

### Young ones and rare looks (wildlife variants)

One per animal. Once bought, the young ones join as **extra figures** beside the animal (a calf
beside the herd, not one of the herd), wherever and whenever the animal lives. Mostly the young
ones, so the valley looks as if the animals are settling in to stay, and one rare colour.

| Animal (biome)      | Keepsake          | What it looks like                                                     | Source |
| ------------------- | ----------------- | ---------------------------------------------------------------------- | ------ |
| Wild bees (Reach)   | Bumblebees        | Fat, furry, banded bees, bigger than the wild bees (easier to see too) | New    |
| Otters (Reach)      | Otter cubs        | Two cubs swimming after their mother                                   | New    |
| Beavers (Reach)     | Beaver kit        | A kit paddling beside the beaver                                       | New    |
| Deer (Reach)        | The white hart    | A pale white stag in the herd                                          | New    |
| Terns (coast)       | Tern chicks       | Speckled chicks on the dune                                            | New    |
| Seals (coast)       | Seal pup          | A white-coated pup hauled out by its mother                            | New    |
| Puffins (coast)     | Puffin with fish  | A beak full of silver sand eels                                        | New    |
| Dolphins (coast)    | Dolphin calf      | A calf leaping beside its mother                                       | New    |
| Hares (Highland)    | Leverets          | Two small hares in the grass                                           | New    |
| Dippers (Highland)  | Dipper fledgling  | A grey speckled young dipper on the next stone                         | New    |
| Eagles (Highland)   | Eagle pair        | A second eagle soaring with the first                                  | New    |
| Martens (Highland)  | Marten kits       | Two kits tumbling after their mother                                   | New    |
| Fennecs (desert)    | Fennec cubs       | Big-eared cubs by the den                                              | New    |
| Sandgrouse (desert) | Sandgrouse chicks | Chicks running after the male (who carries water to them)              | New    |
| Falcons (desert)    | Falcon chicks     | Downy chicks on the wind tower's ledge                                 | New    |
| Oryx (desert)       | Oryx calf         | A sandy calf in the herd                                               | New    |

Each costs **20 Seeds**, open from the start.

### Ornaments on the settlement

Shown in every run, on whatever stands there. Drawn small, so they never hide what a building is.

| Keepsake          | What it adds                                                                | Price | Source |
| ----------------- | --------------------------------------------------------------------------- | ----- | ------ |
| The city's banner | A banner over the Founders' Camp in the colour of the city's first district | 30    | New    |
| Bunting           | The festival bunting round the camp all year, not only on festival seasons  | 30    | New    |
| Window boxes      | Flowers under the windows of every home, in season                          | 40    | New    |
| Channel lanterns  | Small lanterns along the channels, lit at night                             | 40    | New    |
| Bird boxes        | Bird boxes on the trees next to homes; a few more birds about               | 30    | New    |
| Kites             | Kites over the settlement in windy seasons                                  | 40    | New    |

### Ornaments in Root City

| Keepsake            | What it adds                                            | Price | Source |
| ------------------- | ------------------------------------------------------- | ----- | ------ |
| Lantern paths       | Lanterns along the paths between districts, lit at dusk | 50    | New    |
| Fireflies           | Fireflies over the city at dusk                         | 40    | New    |
| The fountain        | A fountain on the green at the Heartwood's foot         | 60    | New    |
| Kites over the city | Kites in the districts' colours over the city           | 40    | New    |

### How it works

| Part       | Proposal                                                                                                                                                                                                | Source            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Content    | A `keepsakes` list in `root-city.json`: id, name, kind (`wildlife`, `settlement`, `city`), price, and the animal a young one joins.                                                                     | New               |
| City state | The keepsakes bought, and those switched off.                                                                                                                                                           | `src/sim/city.ts` |
| Runs       | A run is given the keepsakes on as display options when it sets out, outside the simulation: nothing the season does reads them.                                                                        | New               |
| Before art | Each is drawn in code until its art comes, as every animal and building was: a tinted or smaller figure for the young ones, simple shapes for the ornaments, the existing bunting and lantern art.      | New               |
| Art        | A section in ART-EXPANSION.md and ART-CITY.md: each young one's frames named after its animal's (`deer.white.walk.1.png`, `otter.cub.swim.1.png`…), the ornaments as small props on the wildlife frame. | New               |

### Build plan

| Step | What                                                                   | Done when                                                       | Source |
| ---- | ---------------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| K1   | Keepsakes in content and the city; buying, switching; the panel. Done. | Unit tests for each rule; a keepsake bought by mouse in an e2e. | New    |
| K2   | Drawn on the map and in the city, in code; the art guide. Done.        | Each shows in a screenshot run; the simulation tests unchanged. | New    |
| K3   | The art, when it comes.                                                | Imported; the art test covers it.                               | New    |

## Decided in review

| Question   | Decision                                                       | Source     |
| ---------- | -------------------------------------------------------------- | ---------- |
| The list   | All of it: 16 young ones, 6 settlement ornaments, 4 city ones. | Playtester |
| Prices     | Double the proposal's: 20 an animal, 30 to 40, 40 to 60.       | Playtester |
| Unlocks    | Everything open from the start.                                | Playtester |
| Young ones | Extra figures alongside the animal's own.                      | Playtester |
