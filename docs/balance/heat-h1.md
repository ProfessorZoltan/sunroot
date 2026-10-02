# Local heat, H1: the gate

Local heat (asked for by the playtester; DECISIONS.md, Teaching by layers) was to be run 4's layer:
heat sources (solar thermal collectors, heat pumps, heat wells) reach only buildings within a few
tiles, while energy from the grid reaches anywhere. Built in the simulation first, as water and
walks to work were, and off in the game. This report plays 30 seeds with heat shared and heat
local, with the balanced bot seeing only the forecast: one that places heat sources where it always
did, and one that keeps them near what they heat (and homes near a source). Alone, with the layers
below it on the ladder (water and walks to work), and in a Long Winter, when homes need far more
heat. The layers' score lines are at 0, so the scores compare play only.

The gate, as for walks to work: local heat must cost a player who ignores it something real,
minding it must win much of that back, and no more runs may collapse.

## Verdict

| Rules                                            | Ignoring it costs (plain valley / with water and walks / Long Winter) | Minding it wins back (same) | Gate                                                 | Source                                |
| ------------------------------------------------ | --------------------------------------------------------------------- | --------------------------- | ---------------------------------------------------- | ------------------------------------- |
| Heat reaches 2 tiles                             | −1 / 4 / −1 points                                                    | −1 / −5 / −8 points         | Fails: it hardly matters                             | `scripts/heat.ts 30`                  |
| Heat reaches 1 tile                              | 0 / 4 / 5 points                                                      | −3 / −5 / −3 points         | Fails                                                | `scripts/heat.ts 30 balanced range=1` |
| 2 tiles, and the grid's heat costs 2 energy each | 6 / 8 / 22 points                                                     | 5 / −14 / 7 points          | Fails in plain winters; passes only in a Long Winter | `scripts/heat.ts 30 balanced cost=2`  |

Why it hardly matters: even with heat shared, the bots buy about two thirds of their heat from the
grid, 1 energy for 1 heat, and build about one heat source a run. Making the few sources local
taxes very little. Making the grid's heat dear (2 energy each, as resistive heaters are) gives
sources their worth: a bot that keeps them close buys only 27 to 31% of its heat from the grid. But
in ordinary winters ignoring it still costs only 6 to 8 points, and keeping heat close pulls homes
away from work and water, so with the other layers on the heat-minding bot does worse than the one
that ignores it. Only in a Long Winter does local heat cost real points and reward minding it.

## The runs

### Heat reaches 2 tiles

Bot: balanced, 30 runs each, forecast sight, layers' score lines at 0. Heat reaches 2 tiles.

| Case                                                          | Median score | Heartwood | Collapsed | Heat paid from the grid | Shortfall over the run (median) | Heat sources at the end (median) | Source               |
| ------------------------------------------------------------- | ------------ | --------- | --------- | ----------------------- | ------------------------------- | -------------------------------- | -------------------- |
| Heat shared                                                   | 391          | 63%       | 0%        | 64%                     | 10                              | 1                                | `scripts/heat.ts 30` |
| Local heat, bot ignores it                                    | 392          | 67%       | 0%        | 79%                     | 12                              | 0                                | `scripts/heat.ts 30` |
| Local heat, bot minds it                                      | 391          | 73%       | 0%        | 73%                     | 11                              | 1                                | `scripts/heat.ts 30` |
| With water and walks, heat shared                             | 380          | 40%       | 0%        | 64%                     | 14                              | 1                                | `scripts/heat.ts 30` |
| With water and walks, local heat, bot ignores it              | 376          | 27%       | 0%        | 77%                     | 18                              | 0                                | `scripts/heat.ts 30` |
| With water and walks, local heat, bot minds it                | 371          | 33%       | 0%        | 66%                     | 14                              | 1                                | `scripts/heat.ts 30` |
| With water and walks, Long Winter, heat shared                | 328          | 100%      | 0%        | 70%                     | 84                              | 2                                | `scripts/heat.ts 30` |
| With water and walks, Long Winter, local heat, bot ignores it | 329          | 100%      | 0%        | 81%                     | 93                              | 2                                | `scripts/heat.ts 30` |
| With water and walks, Long Winter, local heat, bot minds it   | 321          | 97%       | 3%        | 72%                     | 89                              | 2                                | `scripts/heat.ts 30` |

### Heat reaches 1 tile

Bot: balanced, 30 runs each, forecast sight, layers' score lines at 0. Heat reaches 1 tiles.

| Case                                                          | Median score | Heartwood | Collapsed | Heat paid from the grid | Shortfall over the run (median) | Heat sources at the end (median) | Source                                |
| ------------------------------------------------------------- | ------------ | --------- | --------- | ----------------------- | ------------------------------- | -------------------------------- | ------------------------------------- |
| Heat shared                                                   | 391          | 63%       | 0%        | 64%                     | 10                              | 1                                | `scripts/heat.ts 30 balanced range=1` |
| Local heat, bot ignores it                                    | 391          | 67%       | 0%        | 85%                     | 11                              | 0                                | `scripts/heat.ts 30 balanced range=1` |
| Local heat, bot minds it                                      | 388          | 63%       | 0%        | 73%                     | 10                              | 1                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, heat shared                             | 380          | 40%       | 0%        | 64%                     | 14                              | 1                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, local heat, bot ignores it              | 376          | 27%       | 0%        | 79%                     | 18                              | 0                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, local heat, bot minds it                | 371          | 40%       | 0%        | 70%                     | 13                              | 1                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, Long Winter, heat shared                | 328          | 100%      | 0%        | 70%                     | 84                              | 2                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, Long Winter, local heat, bot ignores it | 323          | 100%      | 0%        | 87%                     | 115                             | 0                                | `scripts/heat.ts 30 balanced range=1` |
| With water and walks, Long Winter, local heat, bot minds it   | 320          | 97%       | 3%        | 75%                     | 87                              | 2                                | `scripts/heat.ts 30 balanced range=1` |

### Heat reaches 2 tiles, and the grid's heat costs 2 energy each

Bot: balanced, 30 runs each, forecast sight, layers' score lines at 0. Heat reaches 2 tiles; the grid's heat costs 2 energy each.

| Case                                                          | Median score | Heartwood | Collapsed | Heat paid from the grid | Shortfall over the run (median) | Heat sources at the end (median) | Source                               |
| ------------------------------------------------------------- | ------------ | --------- | --------- | ----------------------- | ------------------------------- | -------------------------------- | ------------------------------------ |
| Heat shared                                                   | 391          | 63%       | 0%        | 64%                     | 10                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| Local heat, bot ignores it                                    | 385          | 50%       | 0%        | 59%                     | 18                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| Local heat, bot minds it                                      | 390          | 67%       | 0%        | 27%                     | 16                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, heat shared                             | 380          | 40%       | 0%        | 64%                     | 14                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, local heat, bot ignores it              | 372          | 27%       | 0%        | 65%                     | 24                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, local heat, bot minds it                | 358          | 13%       | 0%        | 30%                     | 26                              | 1                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, Long Winter, heat shared                | 328          | 100%      | 0%        | 70%                     | 84                              | 2                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, Long Winter, local heat, bot ignores it | 306          | 97%       | 0%        | 58%                     | 200                             | 2                                | `scripts/heat.ts 30 balanced cost=2` |
| With water and walks, Long Winter, local heat, bot minds it   | 313          | 97%       | 3%        | 31%                     | 163                             | 2                                | `scripts/heat.ts 30 balanced cost=2` |

## What I would do

1. **Leave run 4 without a new layer.** Local heat stays in the simulation, off and on no rung of
   the ladder (`progression.teaching.localHeat` unset), so nothing changes in play.
2. **Use it where heat is the point.** A cold expedition (Long Winter) or the Highland biome could
   switch it on with the grid's heat at 2 energy, through the same data modifiers twists use: there
   it costs real points and rewards keeping homes, wells and pumps together.
3. **Or fold it into E3's heat cascade** (kiln to bathhouse to greenhouse), where heat moving between
   neighbours is a combo to find rather than a tax to avoid.

If local heat is adopted with the grid's heat at 2, the season report's energy ledger needs a line
for the heating losses before it goes on screen (it balances only at 1 energy per heat today).

## What was done (Q18: (a) and (b))

- **Long Winter** switches local heat on, with the grid's heat at 2 energy, through its modifiers.
  The balanced bot, 40 runs, `scripts/expeditions.ts`:

| Long Winter                                | Median score | Heartwood | Collapsed | Source                   |
| ------------------------------------------ | ------------ | --------- | --------- | ------------------------ |
| Heat shared (before)                       | 351          | 100%      | 0%        | `scripts/expeditions.ts` |
| Local heat, grid heat at 2                 | 325          | 100%      | 0%        | `scripts/expeditions.ts` |
| With water and walks, heat shared (before) | 354          | 95%       | 5%        | `scripts/expeditions.ts` |
| With water and walks, local heat           | 324          | 98%       | 3%        | `scripts/expeditions.ts` |

The energy ledger gained the line "Heat bought from the grid: losses", and the game shows heat
arcs, tooltip and panel lines and a season report section while it is on.

- **E3's heat cascade** (kiln to bathhouse to greenhouse) takes up the idea as combos.
