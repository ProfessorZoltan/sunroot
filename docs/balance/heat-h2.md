# Heat needs a building (H2)

Asked for in playtesting: energy should not turn into heat directly; heat should need a building
(production, collection or storage), which might make local heat matter. With the heat layer on
(run 4 on, and in a Long Winter), heat comes only from solar thermal collectors, heat pumps
(the new Air-source Heat Pump anywhere, 2 heat an energy; the Water-source Heat Pump by the
water, 3 an energy), heat wells and warm neighbours, each reaching 2 tiles. A building no source
heats is cold: shut off, as in a blackout.

`scripts/heat.ts`, the balanced bot, 30 runs each on the same seeds, forecast sight, the layers'
score lines at 0. "Ignores it" places heat sources without minding what they heat and only reacts
to cold in the season it comes; "minds it" puts a pump within reach of every building that needs
heat before the cold comes.

## How much a cold home costs

First tried at an unpowered home's cost (2 wellbeing): ignoring heat cost almost nothing, so
minding it didn't pay. A cold home now costs 1 more for each bed in it (`coldPerBed`).

| Case                       | Cold home costs | Median score | Heartwood | Collapsed | Cold building-seasons (median) | Source            |
| -------------------------- | --------------- | ------------ | --------- | --------- | ------------------------------ | ----------------- |
| Heat shared, from the grid | –               | 392          | 63%       | 0%        | 0                              | `scripts/heat.ts` |
| Heat layer, bot ignores it | 2               | 382          | 40%       | 0%        | 26                             | `scripts/heat.ts` |
| Heat layer, bot minds it   | 2               | 379          | 37%       | 0%        | 3                              | `scripts/heat.ts` |
| Heat layer, bot ignores it | 2 + 1 a bed     | 330          | 0%        | 10%       | 19                             | `scripts/heat.ts` |
| Heat layer, bot minds it   | 2 + 1 a bed     | 378          | 37%       | 0%        | 2                              | `scripts/heat.ts` |

## The gate, at 1 a bed

| Case                                                       | Median score | Heartwood | Collapsed | Cold building-seasons (median) | Heat sources at the end (median) | Source            |
| ---------------------------------------------------------- | ------------ | --------- | --------- | ------------------------------ | -------------------------------- | ----------------- |
| Heat shared, from the grid                                 | 392          | 63%       | 0%        | 0                              | 1                                | `scripts/heat.ts` |
| Heat layer, bot ignores it                                 | 330          | 0%        | 10%       | 19                             | 2                                | `scripts/heat.ts` |
| Heat layer, bot minds it                                   | 378          | 37%       | 0%        | 2                              | 4                                | `scripts/heat.ts` |
| With water and walks, heat shared, from the grid           | 360          | 23%       | 3%        | 0                              | 1                                | `scripts/heat.ts` |
| With water and walks, heat layer, bot ignores it           | 312          | 3%        | 23%       | 24                             | 4                                | `scripts/heat.ts` |
| With water and walks, heat layer, bot minds it             | 348          | 3%        | 0%        | 4                              | 7                                | `scripts/heat.ts` |
| With water and walks, Long Winter, heat shared (as before) | 329          | 97%       | 3%        | 0                              | 2                                | `scripts/heat.ts` |
| With water and walks, Long Winter, heat layer, ignores it  | 48           | 0%        | 100%      | 12                             | 0                                | `scripts/heat.ts` |
| With water and walks, Long Winter, heat layer, minds it    | 306          | 97%       | 3%        | 8                              | 14                               | `scripts/heat.ts` |

It passes, where local heat with grid heat (H1) failed: ignoring heat costs 48 to 62 points and
collapses a tenth to a quarter of runs (every Long Winter); minding it wins most of that back (12
to 14 points under shared heat, 23 in a Long Winter) and collapses no more runs than shared heat.

## The score line

`scripts/calibrate-layers.ts`, the balanced bot, 40 runs, water 12 and walks 3 as set:

| Case                                    | Heat's score line | Median score | Heartwood | Source                        |
| --------------------------------------- | ----------------- | ------------ | --------- | ----------------------------- |
| No layers (run 1)                       | –                 | 393          | 80%       | `scripts/calibrate-layers.ts` |
| Water (run 2)                           | –                 | 398          | 70%       | `scripts/calibrate-layers.ts` |
| Water and walks (run 3)                 | –                 | 395          | 75%       | `scripts/calibrate-layers.ts` |
| Water, walks and the heat layer (run 4) | 0                 | 380          | 40%       | `scripts/calibrate-layers.ts` |
| Water, walks and the heat layer (run 4) | 18                | 398          | 65%       | `scripts/calibrate-layers.ts` |

"Heat kept close" is +18. A Long Winter gets it too (it brings the layer): with water and walks the
balanced bot's Long Winter scores 344, against 354 before local heat and 324 with H1's dear grid
heat (`scripts/expeditions.ts`, 40 runs).
