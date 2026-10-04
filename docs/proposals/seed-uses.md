# Proposal: more uses for Seeds

Status: **new expeditions built** (in the game, see DECISIONS.md). **Keepsakes proposed**, for
review before they are built: the list, the prices and what unlocks them are the questions at the
end.

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

## Keepsakes (proposed)

Bought in Root City, from a new **Keepsakes** panel, with Seeds. Each is bought once and kept, and
each can be switched off and on again for free. They are the city's, so they show in every run
after they are bought, in every biome where they fit.

### Young ones and rare looks (wildlife variants)

One per animal. Once bought, **one** of that animal's figures on the map wears the variant (the
others stay as they are), wherever and whenever the animal lives. Mostly the young ones, so the
valley looks as if the animals are settling in to stay, and one rare colour.

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

Each costs **10 Seeds** and can be bought once that animal has lived in one of the city's runs:
the Keepsakes panel shows the others as silhouettes, "Not yet seen".

### Ornaments on the settlement

Shown in every run, on whatever stands there. Drawn small, so they never hide what a building is.

| Keepsake          | What it adds                                                                | Price | Source |
| ----------------- | --------------------------------------------------------------------------- | ----- | ------ |
| The city's banner | A banner over the Founders' Camp in the colour of the city's first district | 15    | New    |
| Bunting           | The festival bunting round the camp all year, not only on festival seasons  | 15    | New    |
| Window boxes      | Flowers under the windows of every home, in season                          | 20    | New    |
| Channel lanterns  | Small lanterns along the channels, lit at night                             | 20    | New    |
| Bird boxes        | Bird boxes on the trees next to homes; a few more birds about               | 15    | New    |
| Kites             | Kites over the settlement in windy seasons                                  | 20    | New    |

### Ornaments in Root City

| Keepsake            | What it adds                                            | Price | Unlocks with              | Source |
| ------------------- | ------------------------------------------------------- | ----- | ------------------------- | ------ |
| Lantern paths       | Lanterns along the paths between districts, lit at dusk | 25    | 6 districts               | New    |
| Fireflies           | Fireflies over the city at dusk                         | 20    | Any district at Heartwood | New    |
| The fountain        | A fountain on the green at the Heartwood's foot         | 30    | 12 districts              | New    |
| Kites over the city | Kites in the districts' colours over the city           | 20    | A landmark found          | New    |

### How it works

| Part       | Proposal                                                                                                                                                                                                | Source            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Content    | A `keepsakes` list in `root-city.json`: id, name, kind (`wildlife`, `settlement`, `city`), price, what unlocks it, and the animal a wildlife one dresses.                                               | New               |
| City state | The keepsakes bought, and those switched off. Runs record the animals that lived in them, so the city knows what has been seen.                                                                         | `src/sim/city.ts` |
| Runs       | A run is given the keepsakes on as display options when it sets out, outside the simulation: nothing the season does reads them.                                                                        | New               |
| Before art | Each is drawn in code until its art comes, as every animal and building was: a tinted or smaller figure for the young ones, simple shapes for the ornaments, the existing bunting and lantern art.      | New               |
| Art        | A section in ART-EXPANSION.md and ART-CITY.md: each young one's frames named after its animal's (`deer.white.walk.1.png`, `otter.cub.swim.1.png`…), the ornaments as small props on the wildlife frame. | New               |

### Build plan

| Step | What                                                                                    | Done when                                                       | Source |
| ---- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------ |
| K1   | Keepsakes in content and the city; buying, switching; seen animals recorded; the panel. | Unit tests for each rule; a keepsake bought by mouse in an e2e. | New    |
| K2   | Drawn on the map and in the city, in code; the art guide.                               | Each shows in a screenshot run; the simulation tests unchanged. | New    |
| K3   | The art, when it comes.                                                                 | Imported; the art test covers it.                               | New    |

## Questions for review

1. **The list.** Keep, cut or add: the 16 young ones, the 6 settlement ornaments, the 4 city ones.
2. **The prices.** 10 for an animal, 15 to 20 for a settlement ornament, 20 to 30 in the city:
   about one good run buys two or three.
3. **Unlocks.** Animals once seen; city ornaments with the city's growth; settlement ornaments
   open from the start. Or everything open from the start?
4. **One young one, or more.** One figure of the animal wears the variant, or the variant joins as
   an extra figure (a calf beside the herd, rather than one of the herd)?
