# Water, E1: the decision gate

EXPANSION.md, Build plan: "the report must show summer water is a real choice. If summer has no
shortfall in most runs, or one channel layout wins almost every time, stop and tune the numbers
before E2." This report plays Willow Reach without water (v1) and with it (v2), on the same 30 seeds,
with bots that see only what a player sees (the forecast). Each v2 row is the same bot with one
water plan:

| Plan    | What the bot does with water                                                               | Source                |
| ------- | ------------------------------------------------------------------------------------------ | --------------------- |
| river   | Digs nothing beyond the camp's channel; builds what needs water where it can draw it.      | `src/balance/bots.ts` |
| short   | Starts new channels from the river, never extends one.                                     | `src/balance/bots.ts` |
| long    | Extends the channels it has, never starts another.                                         | `src/balance/bots.ts` |
| fields  | Lays whichever tile of channel reaches the most dry farmland (the bots' default).          | `src/balance/bots.ts` |
| storage | As fields, and builds a cistern for every 4 buildings that drink in summer, before summer. | `src/balance/bots.ts` |

How to read the columns: "Summers short" counts summers in which at least one building got less
water than it needed; "Runs never short, years 1–3" is the share of runs with no such summer in
their first three years. "Seasons a wheel lost power" counts seasons in which water drawn upstream
cost a river wheel energy. Layouts are counted over the best quarter of all v2 runs.

## Verdict

| Rule set                                                                | Runs short of water in years 1–3 | Commonest layout among the best quarter | Gate                                    | Source                                            |
| ----------------------------------------------------------------------- | -------------------------------- | --------------------------------------- | --------------------------------------- | ------------------------------------------------- |
| Buildings beside the river draw from it (proposed in review)            | 7% to 10%                        | The camp's channel alone, 86%           | Fails both tests                        | `scripts/water.ts 30 balanced beside=on`          |
| Buildings beside the river draw from it, summer flow 3                  | 37% to 63%                       | The camp's channel alone, 81%           | Fails the layout test                   | `scripts/water.ts 30 balanced beside=on summer=3` |
| Every building draws through a channel (EXPANSION.md; Willow Reach now) | 73% to 80%                       | The camp's channel alone, 32%           | Passes both                             | `scripts/water.ts 30`                             |
| Every building through a channel, summer flow 3                         | 73% to 80%                       | The camp's channel alone, 32%           | Passes both                             | `scripts/water.ts 30 balanced summer=3`           |
| Every building through a channel, a dry building keeps a quarter        | 37% to 43%                       | The camp's channel alone, 27% (tied)    | Passes both; 3% to 10% of runs collapse | `scripts/water.ts 30 balanced shortfall=0.25`     |

With buildings beside the river drawing straight from it, the floodplain along the river is enough
farmland for most of a run, so channels hardly matter: the gate fails. Willow Reach therefore plays
EXPANSION.md as written, every building drawing through a channel. Dry summers then come in the
first years and the best runs use many layouts, so both of the gate's tests pass.

But no water plan clearly beats doing little: the river plan, which only keeps the camp's channel,
scores within a few points of the others, and no plan wins more than about a quarter of the seeds.
The bots answer a dry summer by building more farms, which are cheap. Making a dry building keep
only a quarter of its yield makes water costlier (and collapses appear) without separating the
plans. See DECISIONS.md, Q17.

## Willow Reach with water, as it now plays

The balanced bot:

Bot: balanced, 30 runs each, forecast sight. Water: [12,4,8,6] river flow, channels carry 4, all water through channels.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                        |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ----------------------------- |
| v1 (no water) | 389          | 60%       | 0%        | 1.19                    | 49%               | 127     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30` |
| v2 river      | 379          | 33%       | 0%        | 1.09                    | 41%               | 120     | 63%                      | 20%                         | 88%                | 0.0                        | `npx tsx scripts/water.ts 30` |
| v2 short      | 383          | 43%       | 0%        | 1.13                    | 41%               | 124     | 59%                      | 27%                         | 84%                | 7.3                        | `npx tsx scripts/water.ts 30` |
| v2 long       | 375          | 23%       | 0%        | 1.10                    | 44%               | 119     | 63%                      | 20%                         | 89%                | 1.1                        | `npx tsx scripts/water.ts 30` |
| v2 fields     | 378          | 30%       | 0%        | 1.14                    | 41%               | 124     | 61%                      | 23%                         | 85%                | 6.7                        | `npx tsx scripts/water.ts 30` |
| v2 storage    | 377          | 37%       | 0%        | 1.14                    | 37%               | 119     | 59%                      | 27%                         | 72%                | 5.4                        | `npx tsx scripts/water.ts 30` |

| Plan    | Seeds won (ties shared) | Source                        |
| ------- | ----------------------- | ----------------------------- |
| river   | 27%                     | `npx tsx scripts/water.ts 30` |
| short   | 23%                     | `npx tsx scripts/water.ts 30` |
| long    | 10%                     | `npx tsx scripts/water.ts 30` |
| fields  | 17%                     | `npx tsx scripts/water.ts 30` |
| storage | 23%                     | `npx tsx scripts/water.ts 30` |

| Layout among the best quarter of v2 runs | Share | Source                        |
| ---------------------------------------- | ----- | ----------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 32%   | `npx tsx scripts/water.ts 30` |
| 4 channel(s), ≤8 tiles, no cistern       | 16%   | `npx tsx scripts/water.ts 30` |
| 4 channel(s), ≤8 tiles, cisterns         | 11%   | `npx tsx scripts/water.ts 30` |
| 3 channel(s), ≤8 tiles, no cistern       | 11%   | `npx tsx scripts/water.ts 30` |
| 2 channel(s), ≤8 tiles, no cistern       | 8%    | `npx tsx scripts/water.ts 30` |
| 1 channel(s), ≤8 tiles, no cistern       | 8%    | `npx tsx scripts/water.ts 30` |
| 3 channel(s), ≤8 tiles, cisterns         | 5%    | `npx tsx scripts/water.ts 30` |
| 2 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30` |
| 1 channel(s), ≤3 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30` |
| 1 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30` |

The food bot, which turns everything into farms:

Bot: greedyFood, 30 runs each, forecast sight. Water: [12,4,8,6] river flow, channels carry 4, all water through channels.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                   |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ---------------------------------------- |
| v1 (no water) | 341          | 0%        | 0%        | 2.70                    | 48%               | 28      | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 greedyFood` |
| v2 river      | 308          | 0%        | 0%        | 1.69                    | 43%               | 26      | 77%                      | 0%                          | 94%                | 2.6                        | `npx tsx scripts/water.ts 30 greedyFood` |
| v2 short      | 307          | 0%        | 0%        | 1.69                    | 42%               | 25      | 76%                      | 0%                          | 94%                | 5.7                        | `npx tsx scripts/water.ts 30 greedyFood` |
| v2 long       | 310          | 0%        | 0%        | 1.70                    | 43%               | 22      | 77%                      | 0%                          | 94%                | 3.1                        | `npx tsx scripts/water.ts 30 greedyFood` |
| v2 fields     | 309          | 0%        | 0%        | 1.67                    | 42%               | 23      | 77%                      | 0%                          | 94%                | 6.6                        | `npx tsx scripts/water.ts 30 greedyFood` |
| v2 storage    | 301          | 0%        | 0%        | 1.57                    | 35%               | 24      | 73%                      | 0%                          | 93%                | 7.9                        | `npx tsx scripts/water.ts 30 greedyFood` |

| Plan    | Seeds won (ties shared) | Source                                   |
| ------- | ----------------------- | ---------------------------------------- |
| river   | 35%                     | `npx tsx scripts/water.ts 30 greedyFood` |
| short   | 33%                     | `npx tsx scripts/water.ts 30 greedyFood` |
| long    | 15%                     | `npx tsx scripts/water.ts 30 greedyFood` |
| fields  | 10%                     | `npx tsx scripts/water.ts 30 greedyFood` |
| storage | 7%                      | `npx tsx scripts/water.ts 30 greedyFood` |

| Layout among the best quarter of v2 runs | Share | Source                                   |
| ---------------------------------------- | ----- | ---------------------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 54%   | `npx tsx scripts/water.ts 30 greedyFood` |
| 1 channel(s), ≤8 tiles, no cistern       | 27%   | `npx tsx scripts/water.ts 30 greedyFood` |
| 2 channel(s), ≤8 tiles, no cistern       | 11%   | `npx tsx scripts/water.ts 30 greedyFood` |
| 2 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 greedyFood` |
| 3 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 greedyFood` |
| 3 channel(s), ≤8 tiles, no cistern       | 3%    | `npx tsx scripts/water.ts 30 greedyFood` |

## The other rule sets

### Buildings beside the river draw from it

Bot: balanced, 30 runs each, forecast sight. Water: [12,4,8,6] river flow, channels carry 4, buildings beside the river draw from it.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                           |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ------------------------------------------------ |
| v1 (no water) | 389          | 60%       | 0%        | 1.19                    | 49%               | 127     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 balanced beside=on` |
| v2 river      | 379          | 37%       | 0%        | 1.15                    | 35%               | 123     | 4%                       | 93%                         | 49%                | 12.6                       | `npx tsx scripts/water.ts 30 balanced beside=on` |
| v2 short      | 378          | 43%       | 0%        | 1.13                    | 35%               | 123     | 7%                       | 90%                         | 47%                | 13.4                       | `npx tsx scripts/water.ts 30 balanced beside=on` |
| v2 long       | 379          | 27%       | 0%        | 1.14                    | 35%               | 121     | 4%                       | 93%                         | 46%                | 11.0                       | `npx tsx scripts/water.ts 30 balanced beside=on` |
| v2 fields     | 386          | 53%       | 0%        | 1.14                    | 35%               | 125     | 4%                       | 93%                         | 47%                | 11.1                       | `npx tsx scripts/water.ts 30 balanced beside=on` |
| v2 storage    | 374          | 27%       | 0%        | 1.20                    | 31%               | 121     | 0%                       | 100%                        | 2%                 | 13.3                       | `npx tsx scripts/water.ts 30 balanced beside=on` |

| Plan    | Seeds won (ties shared) | Source                                           |
| ------- | ----------------------- | ------------------------------------------------ |
| river   | 20%                     | `npx tsx scripts/water.ts 30 balanced beside=on` |
| short   | 22%                     | `npx tsx scripts/water.ts 30 balanced beside=on` |
| long    | 8%                      | `npx tsx scripts/water.ts 30 balanced beside=on` |
| fields  | 40%                     | `npx tsx scripts/water.ts 30 balanced beside=on` |
| storage | 10%                     | `npx tsx scripts/water.ts 30 balanced beside=on` |

| Layout among the best quarter of v2 runs | Share | Source                                           |
| ---------------------------------------- | ----- | ------------------------------------------------ |
| 1 channel(s), ≤3 tiles, no cistern       | 86%   | `npx tsx scripts/water.ts 30 balanced beside=on` |
| 1 channel(s), ≤3 tiles, cisterns         | 14%   | `npx tsx scripts/water.ts 30 balanced beside=on` |

### Buildings beside the river draw from it, summer flow 3

Bot: balanced, 30 runs each, forecast sight. Water: [12,3,8,6] river flow, channels carry 4, buildings beside the river draw from it.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                                    |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | --------------------------------------------------------- |
| v1 (no water) | 389          | 60%       | 0%        | 1.19                    | 49%               | 127     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| v2 river      | 378          | 37%       | 0%        | 1.14                    | 31%               | 121     | 38%                      | 43%                         | 78%                | 12.1                       | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| v2 short      | 379          | 33%       | 0%        | 1.14                    | 32%               | 122     | 33%                      | 50%                         | 74%                | 12.7                       | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| v2 long       | 380          | 33%       | 0%        | 1.15                    | 32%               | 122     | 42%                      | 37%                         | 78%                | 9.9                        | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| v2 fields     | 385          | 50%       | 0%        | 1.13                    | 32%               | 124     | 38%                      | 43%                         | 76%                | 11.0                       | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| v2 storage    | 377          | 27%       | 0%        | 1.18                    | 29%               | 121     | 17%                      | 63%                         | 9%                 | 12.3                       | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |

| Plan    | Seeds won (ties shared) | Source                                                    |
| ------- | ----------------------- | --------------------------------------------------------- |
| river   | 15%                     | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| short   | 28%                     | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| long    | 15%                     | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| fields  | 22%                     | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| storage | 20%                     | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |

| Layout among the best quarter of v2 runs | Share | Source                                                    |
| ---------------------------------------- | ----- | --------------------------------------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 81%   | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| 1 channel(s), ≤3 tiles, cisterns         | 14%   | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| 2 channel(s), ≤8 tiles, no cistern       | 3%    | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |
| 2 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced beside=on summer=3` |

### Every building through a channel, summer flow 3

Bot: balanced, 30 runs each, forecast sight. Water: [12,3,8,6] river flow, channels carry 4, all water through channels.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                          |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ----------------------------------------------- |
| v1 (no water) | 389          | 60%       | 0%        | 1.19                    | 49%               | 127     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 balanced summer=3` |
| v2 river      | 379          | 37%       | 0%        | 1.09                    | 40%               | 120     | 63%                      | 20%                         | 88%                | 0.0                        | `npx tsx scripts/water.ts 30 balanced summer=3` |
| v2 short      | 382          | 40%       | 0%        | 1.12                    | 39%               | 125     | 61%                      | 23%                         | 87%                | 7.2                        | `npx tsx scripts/water.ts 30 balanced summer=3` |
| v2 long       | 378          | 33%       | 0%        | 1.10                    | 42%               | 120     | 63%                      | 20%                         | 89%                | 1.1                        | `npx tsx scripts/water.ts 30 balanced summer=3` |
| v2 fields     | 378          | 33%       | 0%        | 1.12                    | 40%               | 122     | 61%                      | 23%                         | 87%                | 6.7                        | `npx tsx scripts/water.ts 30 balanced summer=3` |
| v2 storage    | 380          | 37%       | 0%        | 1.14                    | 35%               | 119     | 59%                      | 27%                         | 72%                | 5.9                        | `npx tsx scripts/water.ts 30 balanced summer=3` |

| Plan    | Seeds won (ties shared) | Source                                          |
| ------- | ----------------------- | ----------------------------------------------- |
| river   | 17%                     | `npx tsx scripts/water.ts 30 balanced summer=3` |
| short   | 17%                     | `npx tsx scripts/water.ts 30 balanced summer=3` |
| long    | 15%                     | `npx tsx scripts/water.ts 30 balanced summer=3` |
| fields  | 27%                     | `npx tsx scripts/water.ts 30 balanced summer=3` |
| storage | 25%                     | `npx tsx scripts/water.ts 30 balanced summer=3` |

| Layout among the best quarter of v2 runs | Share | Source                                          |
| ---------------------------------------- | ----- | ----------------------------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 32%   | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 4 channel(s), ≤8 tiles, no cistern       | 16%   | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 1 channel(s), ≤8 tiles, no cistern       | 11%   | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 2 channel(s), ≤8 tiles, no cistern       | 11%   | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 4 channel(s), ≤8 tiles, cisterns         | 8%    | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 3 channel(s), ≤8 tiles, no cistern       | 8%    | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 2 channel(s), ≤8 tiles, cisterns         | 5%    | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 3 channel(s), ≤8 tiles, cisterns         | 5%    | `npx tsx scripts/water.ts 30 balanced summer=3` |
| 1 channel(s), ≤3 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced summer=3` |

### Every building through a channel, a dry building keeps a quarter

Bot: balanced, 30 runs each, forecast sight. Water: [12,4,8,6] river flow, channels carry 4, all water through channels.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                                |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ----------------------------------------------------- |
| v1 (no water) | 389          | 60%       | 0%        | 1.19                    | 49%               | 127     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| v2 river      | 367          | 17%       | 3%        | 1.02                    | 39%               | 115     | 33%                      | 60%                         | 71%                | 0.0                        | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| v2 short      | 373          | 33%       | 7%        | 1.05                    | 35%               | 123     | 31%                      | 63%                         | 65%                | 6.1                        | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| v2 long       | 361          | 3%        | 3%        | 1.00                    | 36%               | 114     | 34%                      | 57%                         | 73%                | 2.7                        | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| v2 fields     | 371          | 30%       | 7%        | 1.06                    | 39%               | 121     | 36%                      | 57%                         | 67%                | 5.5                        | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| v2 storage    | 368          | 17%       | 10%       | 1.08                    | 30%               | 118     | 34%                      | 57%                         | 51%                | 4.9                        | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |

| Plan    | Seeds won (ties shared) | Source                                                |
| ------- | ----------------------- | ----------------------------------------------------- |
| river   | 13%                     | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| short   | 30%                     | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| long    | 10%                     | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| fields  | 27%                     | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| storage | 20%                     | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |

| Layout among the best quarter of v2 runs | Share | Source                                                |
| ---------------------------------------- | ----- | ----------------------------------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 27%   | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 4 channel(s), ≤8 tiles, no cistern       | 27%   | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 3 channel(s), ≤8 tiles, no cistern       | 16%   | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 4 channel(s), ≤8 tiles, cisterns         | 8%    | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 2 channel(s), ≤8 tiles, no cistern       | 8%    | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 3 channel(s), ≤8 tiles, cisterns         | 5%    | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 1 channel(s), ≤8 tiles, no cistern       | 5%    | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |
| 2 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced shortfall=0.25` |

## Regions, twists and Tempest levels with water

The balanced bot (fields plan), 20 runs each, without water and with it. Drought Year with water
dries the river (nothing in summer, 4 in autumn); channels are storm-proof, after Wild Storms
collapsed 20% of runs by breaking them.

| Case                  | Median without water | Median with water | Collapsed without | Collapsed with | Source                                                            |
| --------------------- | -------------------- | ----------------- | ----------------- | -------------- | ----------------------------------------------------------------- |
| baseline              | 393                  | 385               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region theReach       | 393                  | 385               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region oxbowLakes     | 391                  | 377               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region broadWash      | 377                  | 383               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region oldTown        | 371                  | 363               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region highBanks      | 361                  | 345               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region oldGrove       | 397                  | 380               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| region wanderingRiver | 395                  | 385               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist fairWeather     | 393                  | 385               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist droughtYear     | 339                  | 360               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist longWinter      | 350                  | 351               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist wildStorms      | 340                  | 320               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist richSilt        | 390                  | 385               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist steadyWinds     | 386                  | 380               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist clearSkies      | 393                  | 381               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist leanStart       | 310                  | 288               | 5%                | 10%            | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist bigFamilies     | 389                  | 381               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| twist scavengers      | 389                  | 378               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 1             | 387                  | 369               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 2             | 381                  | 373               | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 3             | 381                  | 372               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 4             | 385                  | 373               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 5             | 382                  | 354               | 0%                | 10%            | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 6             | 364                  | 360               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 7             | 364                  | 357               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 8             | 341                  | 347               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 9             | 334                  | 346               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |
| tempest 10            | 326                  | 320               | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on scripts/expeditions.ts 20` |

Water costs most cases 5 to 20 points. It weighs more on Old Grove and Oxbow Lakes (land the bots
won't dig through), Lean Start (fewer materials for channels) and the first Tempest levels, and a
few Tempest runs collapse. These are for tuning once water is on screen.

## What I would change before E2

1. **Keep every building drawing through a channel** (done): it is what makes channels matter.
2. **Give water upside, not just cost.** Water is a tax so far: a dry building makes half, and the
   cure is another cheap farm. EXPANSION.md's cascades (E3) are where water pays back: nutrient-rich
   water, paddies, reed beds, bathhouses, the loops. I'd go ahead with E2 (seeing water is needed
   to play any of it), and run this gate again after E3.
3. **If water must be a choice before E3,** tie it to land rather than yield: a channel tile costs
   a farm site, and the floodplain is short. A narrower floodplain (or Broad Wash's wider one as the
   norm) would make "where does the channel go" matter more than "how many farms".
4. **Recalibrate Root City** once water is on: the food bot loses a third of its food per citizen,
   which moves Orchard Ward's signature, and river wheels drop from 49% to about 40% of energy.
