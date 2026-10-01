# Sunroot balance report

4000 runs of willowReach: 1000 seeds for each of 4 bots. Every bot plays the same seeds. Scores use the provisional formula in the content file (the real one is an open question for Milestone 7).

Reproduce with `npm run balance -- --runs 1000 --bots random,greedyFood,greedyEnergy,balanced --seed balance`. Every run is also a row in `runs.csv`.

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
| random       | 29%       | 12                        | 24        | 35           | 166       | 6                      | 3.4                     | 4.3                 |
| greedyFood   | 100%      | 48                        | 212       | 224          | 235       | 65                     | 6.6                     | 3.9                 |
| greedyEnergy | 100%      | 48                        | 196       | 204          | 211       | 54                     | 2.4                     | 4.5                 |
| balanced     | 100%      | 48                        | 278       | 291          | 307       | 48                     | 4.0                     | 5.8                 |

## Score spread

Runs per score band.

| Bot          | 0–39 | 40–79 | 80–119 | 120–159 | 160–199 | 200–239 | 240–279 | 280–319 | 320–359 |
| ------------ | ---- | ----- | ------ | ------- | ------- | ------- | ------- | ------- | ------- |
| random       | 587  | 106   | 29     | 145     | 121     | 12      | 0       | 0       | 0       |
| greedyFood   | 0    | 0     | 0      | 0       | 12      | 944     | 44      | 0       | 0       |
| greedyEnergy | 0    | 0     | 0      | 0       | 273     | 727     | 0       | 0       | 0       |
| balanced     | 0    | 0     | 0      | 0       | 0       | 0       | 122     | 865     | 13      |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 293       | 563               | 30                   | 114                | 53 / 12 / 14                                          |
| greedyFood   | 1000      | 0                 | 0                    | 0                  | 0 / 28 / 1                                            |
| greedyEnergy | 1000      | 0                 | 0                    | 0                  | 0 / 9 / 0                                             |
| balanced     | 1000      | 0                 | 0                    | 0                  | 0 / 19 / 1                                            |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 3338    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5090    | 71%       | 7.1                | +1.9                  | +3.4                    |
| heatWell              | 5773    | 62%       | 8.0                | +0.6                  | +2.7                    |
| orchard               | 7880    | 46%       | 9.2                | +2.7                  | +10.9                   |
| fishPond              | 8104    | 45%       | 9.6                | +0.6                  | +1.6                    |
| apiary                | 8518    | 43%       | 9.9                | -0.0                  | -1.2                    |
| cellBank              | 8609    | 42%       | 9.9                | +1.1                  | +2.2                    |
| solarThermalCollector | 8708    | 41%       | 10.3               | -2.2                  | -9.3                    |
| pollinatorMeadow      | 10443   | 35%       | 11.5               | -1.6                  | +4.9                    |
| heatPump              | 10628   | 34%       | 11.6               | -0.7                  | -2.0                    |
| windSpire             | 10716   | 34%       | 11.6               | -0.9                  | -6.7                    |
| treeNursery           | 10720   | 34%       | 11.6               | +3.6                  | +11.4                   |
| commonsPlaza          | 10758   | 34%       | 12.0               | -1.7                  | -5.9                    |
| biogasDigester        | 10872   | 33%       | 11.6               | +3.7                  | +7.6                    |
| seedbankLibrary       | 11007   | 33%       | 12.1               | -1.6                  | -5.0                    |
| greenhouse            | 11092   | 33%       | 11.9               | -1.4                  | -3.6                    |
| kiln                  | 11103   | 32%       | 12.1               | +0.2                  | +2.4                    |
| weir                  | 11355   | 32%       | 12.3               | -2.9                  | -9.6                    |
| mirrorFilm            | 13445   | 27%       | 13.8               | -1.7                  | -7.8                    |
| levee                 | 13633   | 27%       | 14.0               | +0.5                  | +3.3                    |
| deepRoots             | 13685   | 26%       | 13.9               | +0.8                  | +4.5                    |
| siltTraps             | 13777   | 26%       | 14.1               | -0.3                  | -1.3                    |
| hiveMind              | 13750   | 26%       | 14.1               | +1.1                  | +4.9                    |
| nightShift            | 13877   | 26%       | 14.1               | -1.9                  | -8.4                    |

In runs that reached the end, the draft had cards to offer for 24.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.3  | 1.0      | 0.8   |
| greedyFood   | 0.5    | 0.6  | 0.3      | 2.4   |
| greedyEnergy | 0.6    | 0.7  | 0.7      | 2.5   |
| balanced     | 0.2    | 0.0  | 0.0      | 5.5   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 12%    | 14%    | 11%    | 67%    | 3.4          |
| greedyFood   | 8%     | 91%    | 24%    | 90%    | 6.6          |
| greedyEnergy | 1%     | 58%    | 3%     | 73%    | 2.4          |
| balanced     | 10%    | 53%    | 22%    | 94%    | 4.0          |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | ---------- | ----------- | --------- |
| random           | 5%             | 37%          | 11%        | 37%         | 10%       |
| greedyFood       | 5%             | 14%          | 40%        | 4%          | 38%       |
| greedyEnergy     | 10%            | 12%          | 20%        | 12%         | 46%       |
| balanced         | 2%             | 15%          | 45%        | 1%          | 37%       |
| top 25% by score | 2%             | 15%          | 45%        | 1%          | 37%       |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- |
| random       | 1.32                           | 17%                          | 9%                               |
| greedyFood   | 2.49                           | 58%                          | 57%                              |
| greedyEnergy | 1.27                           | 18%                          | 28%                              |
| balanced     | 1.40                           | 26%                          | 32%                              |

**Yes.** The non-random bots make 1.77× the food they eat after Year 1; 41% of it rots, and 39% of seasons end with storage full. Rotting food becomes biomass, so the surplus is wasted but does no harm.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 53% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings and charters are in play; the cards table shows how often each tuning was taken. The bots rank tunings below every blueprint, so stacked tunings are under-tested.

### Is there one dominant strategy?

Median score by bot: balanced 291, greedyFood 224, greedyEnergy 204, random 35. The cards with the biggest early lift: biogasDigester (+3.7), treeNursery (+3.6), orchard (+2.7). **balanced leads by more than 25%.**

### Do runs feel long in the middle?

Non-random bots have 0.4 idle seasons in Settle, 0.5 in Mend, 0.4 in Flourish and 3.5 in Bloom (12 seasons per era; collapsed runs count fewer seasons). The middle eras are not much quieter than the first.

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, scraps came 461 from citizens and 0 from rotting food; 2 became clutter. Wellbeing lost: 0 to hunger, 19 to unpowered homes, 1 to clutter. 0 of 3000 non-random runs collapsed from clutter.
