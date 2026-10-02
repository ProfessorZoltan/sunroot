# Commuting, C1: the gate

Commuting (asked for by the playtester; DECISIONS.md, Teaching by layers): workers walk from home
to work, and long walks cost wellbeing. Built in the simulation first, as water was, and off in the
game until it can be seen (C2). This report plays the valley without commuting and with it, on the
same 30 seeds, with the balanced bot seeing only the forecast. "Ignores walks" places things as
before; "minds walks" puts work near homes and homes near work far from any, and builds a cottage
when walks cost wellbeing.

The gate (set for commuting, as EXPANSION.md set one for water): commuting must cost a player who
ignores it something real, minding it must win much of that back (where things go is a decision),
and no more runs may collapse.

## Verdict

| Rules                                  | Ignoring walks costs      | Minding walks wins back  | Collapses  | Gate                        | Source                                        |
| -------------------------------------- | ------------------------- | ------------------------ | ---------- | --------------------------- | --------------------------------------------- |
| 3 tiles free, 1 wellbeing per 4 beyond | 5 points (9 with water)   | −1 points (9 with water) | at most 0% | Fails: too gentle to matter | `scripts/commute.ts 30 balanced free=3 per=4` |
| 3 tiles free, 1 per 3 beyond           | 6 points (7 with water)   | 1 point (6 with water)   | at most 3% | Fails: too gentle to matter | `scripts/commute.ts 30 balanced free=3 per=3` |
| 2 tiles free, 1 per 3 beyond (chosen)  | 20 points (13 with water) | 8 points (12 with water) | at most 0% | Passes                      | `scripts/commute.ts 30`                       |

At 3 tiles free and 1 wellbeing per 4 beyond, walks cost the bots about 5 points whatever they do:
too gentle to be a decision. At 2 free and 1 per 3 beyond, a bot that ignores walks loses 20 points
(13 with water) and one that minds them wins back 8 (12 with water), mostly by building cottages near
far work (16 homes at the end against 13). No run collapses. Willow Reach takes these numbers.

The bots' wellbeing sits at its cap of 100 for most of a run, so what walks cost lands on the early
years, when wellbeing decides whether people arrive. A player whose wellbeing is lower will feel
walks more.

## The runs, at the chosen numbers

Bot: balanced, 30 runs each, forecast sight. Commuting: 2 tiles free, 1 wellbeing per 3 tiles beyond.

| Case                                   | Median score | Heartwood | Collapsed | Wellbeing lost to walks (median, per run) | Tiles beyond free per worker | Homes at the end (median) | Citizens (median) | Wellbeing (median) | Source                          |
| -------------------------------------- | ------------ | --------- | --------- | ----------------------------------------- | ---------------------------- | ------------------------- | ----------------- | ------------------ | ------------------------------- |
| No commuting                           | 394          | 73%       | 0%        | –                                         | –                            | 15                        | 51                | 100                | `npx tsx scripts/commute.ts 30` |
| Commuting, bot ignores walks           | 374          | 27%       | 0%        | 127                                       | 1.05                         | 13                        | 47                | 100                | `npx tsx scripts/commute.ts 30` |
| Commuting, bot minds walks             | 382          | 40%       | 0%        | 11                                        | 0.10                         | 16                        | 50                | 100                | `npx tsx scripts/commute.ts 30` |
| Water, no commuting                    | 381          | 43%       | 0%        | –                                         | –                            | 14                        | 49                | 100                | `npx tsx scripts/commute.ts 30` |
| Water and commuting, bot ignores walks | 368          | 17%       | 0%        | 105                                       | 0.80                         | 13                        | 45                | 100                | `npx tsx scripts/commute.ts 30` |
| Water and commuting, bot minds walks   | 380          | 43%       | 0%        | 21                                        | 0.14                         | 16                        | 50                | 100                | `npx tsx scripts/commute.ts 30` |

## Water's plans with commuting

The E1 report found water a tax rather than a choice: no water plan clearly beat doing little. With
commuting on, the plans still score close together (368 to 377), though digging several short
channels near homes now wins more seeds (37%). Commuting doesn't make water a choice by itself;
E3's cascades remain the hope (DECISIONS.md, Q17).

Bot: balanced, 30 runs each, forecast sight. Water: [12,4,8,6] river flow, channels carry 4, all water through channels.

| Case          | Median score | Heartwood | Collapsed | Food per citizen-season | River wheel share | Harmony | Summers short, years 1–3 | Runs never short, years 1–3 | Summers short, all | Seasons a wheel lost power | Source                                            |
| ------------- | ------------ | --------- | --------- | ----------------------- | ----------------- | ------- | ------------------------ | --------------------------- | ------------------ | -------------------------- | ------------------------------------------------- |
| v1 (no water) | 386          | 53%       | 0%        | 1.18                    | 52%               | 128     | –                        | –                           | –                  | –                          | `npx tsx scripts/water.ts 30 balanced commute=on` |
| v2 river      | 374          | 23%       | 0%        | 1.09                    | 44%               | 116     | 63%                      | 20%                         | 89%                | 0.0                        | `npx tsx scripts/water.ts 30 balanced commute=on` |
| v2 short      | 376          | 33%       | 0%        | 1.12                    | 38%               | 118     | 59%                      | 27%                         | 86%                | 6.0                        | `npx tsx scripts/water.ts 30 balanced commute=on` |
| v2 long       | 373          | 13%       | 0%        | 1.09                    | 43%               | 116     | 61%                      | 23%                         | 88%                | 1.1                        | `npx tsx scripts/water.ts 30 balanced commute=on` |
| v2 fields     | 377          | 23%       | 0%        | 1.13                    | 40%               | 118     | 57%                      | 30%                         | 81%                | 6.3                        | `npx tsx scripts/water.ts 30 balanced commute=on` |
| v2 storage    | 368          | 10%       | 0%        | 1.13                    | 36%               | 120     | 59%                      | 27%                         | 78%                | 6.5                        | `npx tsx scripts/water.ts 30 balanced commute=on` |

| Plan    | Seeds won (ties shared) | Source                                            |
| ------- | ----------------------- | ------------------------------------------------- |
| river   | 17%                     | `npx tsx scripts/water.ts 30 balanced commute=on` |
| short   | 37%                     | `npx tsx scripts/water.ts 30 balanced commute=on` |
| long    | 13%                     | `npx tsx scripts/water.ts 30 balanced commute=on` |
| fields  | 20%                     | `npx tsx scripts/water.ts 30 balanced commute=on` |
| storage | 13%                     | `npx tsx scripts/water.ts 30 balanced commute=on` |

| Layout among the best quarter of v2 runs | Share | Source                                            |
| ---------------------------------------- | ----- | ------------------------------------------------- |
| 1 channel(s), ≤3 tiles, no cistern       | 30%   | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 3 channel(s), ≤8 tiles, no cistern       | 27%   | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 4 channel(s), ≤8 tiles, no cistern       | 14%   | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 1 channel(s), ≤8 tiles, no cistern       | 8%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 2 channel(s), ≤8 tiles, no cistern       | 5%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 3 channel(s), ≤8 tiles, cisterns         | 5%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 5 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 4 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 1 channel(s), ≤8 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced commute=on` |
| 1 channel(s), ≤3 tiles, cisterns         | 3%    | `npx tsx scripts/water.ts 30 balanced commute=on` |

## Regions, twists and Tempest levels with water and commuting

The balanced bot (minding walks), 20 runs each.

| Case                  | Median without either | Median with both | Collapsed without | Collapsed with | Source                                                                       |
| --------------------- | --------------------- | ---------------- | ----------------- | -------------- | ---------------------------------------------------------------------------- |
| baseline              | 393                   | 374              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region theReach       | 393                   | 374              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region oxbowLakes     | 391                   | 370              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region broadWash      | 377                   | 373              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region oldTown        | 371                   | 355              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region highBanks      | 361                   | 342              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region oldGrove       | 397                   | 380              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| region wanderingRiver | 395                   | 375              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist fairWeather     | 393                   | 374              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist droughtYear     | 339                   | 351              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist longWinter      | 350                   | 339              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist wildStorms      | 340                   | 331              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist richSilt        | 390                   | 372              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist steadyWinds     | 386                   | 371              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist clearSkies      | 393                   | 372              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist leanStart       | 310                   | 319              | 5%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist bigFamilies     | 389                   | 385              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| twist scavengers      | 389                   | 365              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 1             | 387                   | 360              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 2             | 381                   | 360              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 3             | 381                   | 357              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 4             | 385                   | 358              | 0%                | 0%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 5             | 382                   | 356              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 6             | 364                   | 343              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 7             | 364                   | 337              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 8             | 341                   | 332              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 9             | 334                   | 328              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |
| tempest 10            | 326                   | 316              | 0%                | 5%             | `scripts/expeditions.ts 20`, `WATER=on COMMUTE=on scripts/expeditions.ts 20` |

Water and commuting together cost most cases 10 to 25 points, and the Heartwood share falls from
60% to 30% in the plain valley: the per-layer calibration of the Graft tiers (DECISIONS.md, Teaching
by layers) is due before both layers are in the game.
