# Sunroot balance report

4000 runs of willowReach: 1000 seeds for each of 4 bots. Every bot plays the same seeds. Scores use the formula and Graft tiers in the content file (`rules.score`). Bots see what a player sees: the forecast, not where the storm will strike.

Reproduce with `npm run balance -- --runs 1000 --bots random,greedyFood,greedyEnergy,balanced --seed balance --sight forecast`. Every run is also a row in `runs.csv`.

## Bots

| Bot          | Strategy                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------- |
| random       | Picks random cards and builds random affordable buildings at random legal sites.                          |
| greedyFood   | Covers its needs, drafts food blueprints, then spends everything on food and housing.                     |
| greedyEnergy | Covers its needs, drafts energy blueprints, then builds generators and turns spare energy into materials. |
| balanced     | Covers its needs with a reserve, then spends on Harmony, land and wellbeing.                              |

## Summary

| Bot          | Completed | Seasons survived (median) | Score p10 | Score median | Score p90 | Peak citizens (median) | Blackout seasons (mean) | Idle seasons (mean) |
| ------------ | --------- | ------------------------- | --------- | ------------ | --------- | ---------------------- | ----------------------- | ------------------- |
| random       | 29%       | 12                        | 29        | 40           | 194       | 6                      | 3.4                     | 4.3                 |
| greedyFood   | 100%      | 48                        | 282       | 323          | 347       | 66                     | 7.2                     | 4.2                 |
| greedyEnergy | 100%      | 48                        | 228       | 267          | 280       | 51                     | 2.9                     | 4.9                 |
| balanced     | 100%      | 48                        | 327       | 366          | 386       | 45                     | 4.3                     | 8.0                 |

## Score spread

Runs per score band.

| Bot          | 0–49 | 50–99 | 100–149 | 150–199 | 200–249 | 250–299 | 300–349 | 350–399 | 400–449 |
| ------------ | ---- | ----- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| random       | 617  | 81    | 61      | 155     | 76      | 10      | 0       | 0       | 0       |
| greedyFood   | 0    | 0     | 0       | 0       | 1       | 265     | 667     | 67      | 0       |
| greedyEnergy | 0    | 0     | 0       | 0       | 404     | 595     | 1       | 0       | 0       |
| balanced     | 0    | 0     | 0       | 0       | 0       | 2       | 269     | 708     | 21      |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 293       | 563               | 30                   | 114                | 53 / 12 / 14                                          |
| greedyFood   | 1000      | 0                 | 0                    | 0                  | 0 / 29 / 1                                            |
| greedyEnergy | 1000      | 0                 | 0                    | 0                  | 0 / 11 / 0                                            |
| balanced     | 1000      | 0                 | 0                    | 0                  | 0 / 19 / 1                                            |

## Run end

The Graft tier each run earns, how often each vision was achieved (and by which season, median), and the district offered first as the Graft.

| Bot          | Tier: seedling | Tier: sapling | Tier: heartwood |
| ------------ | -------------- | ------------- | --------------- |
| random       | 98%            | 2%            | 0%              |
| greedyFood   | 0%             | 99%           | 2%              |
| greedyEnergy | 24%            | 76%           | 0%              |
| balanced     | 0%             | 39%           | 61%             |

| Bot          | Vision: thrivingCommons | Vision: restoreTheReach | Vision: lanternOfTheValley |
| ------------ | ----------------------- | ----------------------- | -------------------------- |
| random       | 0%                      | 22% (season 37)         | 0% (season 43)             |
| greedyFood   | 100% (season 34)        | 8% (season 44)          | 95% (season 27)            |
| greedyEnergy | 84% (season 46)         | 0%                      | 100% (season 31)           |
| balanced     | 13% (season 45)         | 100% (season 15)        | 100% (season 31)           |

| Bot          | Era 1 goal met | Era 2 goal met | Era 3 goal met | Era 4 goal met |
| ------------ | -------------- | -------------- | -------------- | -------------- |
| random       | 2%             | 1%             | 23%            | 19%            |
| greedyFood   | 100%           | 100%           | 0%             | 89%            |
| greedyEnergy | 100%           | 96%            | 0%             | 100%           |
| balanced     | 100%           | 96%            | 100%           | 92%            |

| Bot          | Graft: mendedCommons | Graft: orchardWard | Graft: foundryDistrict | Graft: millraceQuarter |
| ------------ | -------------------- | ------------------ | ---------------------- | ---------------------- |
| random       | 39%                  | 22%                | 34%                    | 6%                     |
| greedyFood   | 0%                   | 99%                | 0%                     | 1%                     |
| greedyEnergy | 0%                   | 21%                | 62%                    | 17%                    |
| balanced     | 100%                 | 0%                 | 0%                     | 0%                     |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 3338    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5081    | 71%       | 7.0                | +2.3                  | +1.8                    |
| heatWell              | 5752    | 63%       | 8.0                | +1.8                  | +2.9                    |
| orchard               | 7800    | 46%       | 9.1                | +3.3                  | +11.3                   |
| fishPond              | 8043    | 45%       | 9.6                | -0.6                  | +1.1                    |
| cellBank              | 8572    | 42%       | 10.0               | +0.6                  | +2.2                    |
| solarThermalCollector | 8574    | 42%       | 10.3               | -3.8                  | -9.9                    |
| apiary                | 8657    | 42%       | 10.0               | +0.4                  | -0.8                    |
| pollinatorMeadow      | 10390   | 35%       | 11.4               | -2.9                  | +6.2                    |
| treeNursery           | 10668   | 34%       | 11.6               | +3.9                  | +13.9                   |
| commonsPlaza          | 10743   | 34%       | 12.0               | -1.9                  | -6.6                    |
| windSpire             | 10810   | 34%       | 11.7               | -0.2                  | -5.4                    |
| biogasDigester        | 10856   | 33%       | 11.6               | +3.8                  | +7.8                    |
| heatPump              | 10863   | 33%       | 11.8               | +0.1                  | -2.3                    |
| seedbankLibrary       | 11029   | 33%       | 12.2               | -2.3                  | -5.8                    |
| kiln                  | 11065   | 33%       | 12.1               | +0.9                  | +4.7                    |
| weir                  | 11254   | 32%       | 12.3               | -2.5                  | -10.7                   |
| greenhouse            | 11259   | 32%       | 11.9               | -1.8                  | -4.8                    |
| mirrorFilm            | 13515   | 27%       | 13.8               | -3.0                  | -9.8                    |
| levee                 | 13555   | 27%       | 13.9               | +0.5                  | +2.2                    |
| deepRoots             | 13640   | 26%       | 13.8               | +1.5                  | +6.2                    |
| hiveMind              | 13659   | 26%       | 14.1               | +1.2                  | +6.1                    |
| siltTraps             | 13839   | 26%       | 14.1               | -1.3                  | -1.9                    |
| nightShift            | 13947   | 26%       | 14.1               | +0.3                  | -9.2                    |

In runs that reached the end, the draft had cards to offer for 24.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.3  | 1.0      | 0.8   |
| greedyFood   | 1.4    | 0.5  | 0.1      | 2.2   |
| greedyEnergy | 1.2    | 0.2  | 0.8      | 2.8   |
| balanced     | 0.9    | 0.0  | 0.0      | 7.1   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 12%    | 14%    | 11%    | 67%    | 3.4          |
| greedyFood   | 5%     | 89%    | 44%    | 99%    | 7.2          |
| greedyEnergy | 1%     | 43%    | 3%     | 91%    | 2.9          |
| balanced     | 10%    | 39%    | 29%    | 100%   | 4.3          |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | mixedGrid | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | --------- | ---------- | ----------- | --------- |
| random           | 5%             | 37%          | 1%        | 11%        | 36%         | 10%       |
| greedyFood       | 3%             | 14%          | 0%        | 40%        | 2%          | 40%       |
| greedyEnergy     | 6%             | 12%          | 1%        | 25%        | 11%         | 45%       |
| balanced         | 2%             | 15%          | 0%        | 45%        | 1%          | 38%       |
| top 25% by score | 2%             | 14%          | 0%        | 44%        | 1%          | 38%       |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full | Unfed citizen-seasons per run |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- | ----------------------------- |
| random       | 1.32                           | 17%                          | 9%                               | 17.6                          |
| greedyFood   | 2.50                           | 58%                          | 48%                              | 0.0                           |
| greedyEnergy | 1.10                           | 5%                           | 12%                              | 0.0                           |
| balanced     | 1.16                           | 10%                          | 16%                              | 0.0                           |

**No.** The bots that build food only to need (all but random and greedyFood) make 1.13× the food they eat after Year 1, and 8% of it rots. Hunger is rare: 0.001 unfed citizen-seasons per run. Food needs attention every season, though: the random bot, which ignores it, mostly collapses from hunger.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 51% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings and charters are in play; the cards table shows how often each tuning was taken. The bots rank tunings below every blueprint, so stacked tunings are under-tested.

### Is there one dominant strategy?

Median score by bot: balanced 366, greedyFood 323, greedyEnergy 267, random 40. The cards with the biggest early lift: treeNursery (+3.9), biogasDigester (+3.8), orchard (+3.3).

### Do runs feel long in the middle?

Non-random bots have 1.2 idle seasons in Settle, 0.2 in Mend, 0.3 in Flourish and 4.0 in Bloom (12 seasons per era; collapsed runs count fewer seasons). The middle eras are not much quieter than the first.

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, scraps came 460 from citizens and 0 from rotting food; 2 became clutter. Wellbeing lost: 0 to hunger, 20 to unpowered homes, 1 to clutter. 0 of 3000 non-random runs collapsed from clutter.
