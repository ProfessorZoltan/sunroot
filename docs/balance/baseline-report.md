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
| random       | 17%       | 9                         | 24        | 34           | 140       | 6                      | 2.8                     | 4.1                 |
| greedyFood   | 100%      | 48                        | 169       | 174          | 182       | 42                     | 14.1                    | 14.5                |
| greedyEnergy | 100%      | 48                        | 155       | 164          | 170       | 36                     | 9.5                     | 17.7                |
| balanced     | 100%      | 48                        | 199       | 208          | 219       | 36                     | 10.4                    | 13.0                |

## Score spread

Runs per score band.

| Bot          | 0–29 | 30–59 | 60–89 | 90–119 | 120–149 | 150–179 | 180–209 | 210–239 |
| ------------ | ---- | ----- | ----- | ------ | ------- | ------- | ------- | ------- |
| random       | 267  | 514   | 43    | 27     | 73      | 72      | 3       | 1       |
| greedyFood   | 0    | 0     | 0     | 0      | 0       | 852     | 148     | 0       |
| greedyEnergy | 0    | 0     | 0     | 0      | 0       | 1000    | 0       | 0       |
| balanced     | 0    | 0     | 0     | 0      | 0       | 8       | 553     | 439     |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 171       | 664               | 37                   | 128                | 56 / 10 / 12                                          |
| greedyFood   | 1000      | 0                 | 0                    | 0                  | 0 / 94 / 1                                            |
| greedyEnergy | 1000      | 0                 | 0                    | 0                  | 0 / 44 / 0                                            |
| balanced     | 1000      | 0                 | 0                    | 0                  | 0 / 58 / 0                                            |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 3224    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5239    | 69%       | 5.5                | -0.9                  | -5.5                    |
| heatWell              | 6167    | 59%       | 6.7                | -1.5                  | -2.4                    |
| orchard               | 8007    | 45%       | 7.4                | -0.2                  | -0.3                    |
| fishPond              | 8459    | 43%       | 8.0                | +2.1                  | +7.8                    |
| cellBank              | 9072    | 40%       | 8.4                | -1.3                  | -2.1                    |
| apiary                | 9110    | 40%       | 8.5                | +0.0                  | +0.1                    |
| solarThermalCollector | 9232    | 39%       | 8.7                | +1.4                  | +7.4                    |
| pollinatorMeadow      | 10915   | 33%       | 9.3                | +1.8                  | +5.7                    |
| windSpire             | 11120   | 33%       | 9.5                | -0.6                  | +1.6                    |
| treeNursery           | 11206   | 33%       | 9.7                | +0.4                  | -5.5                    |
| biogasDigester        | 11490   | 32%       | 9.6                | +1.1                  | +1.0                    |
| commonsPlaza          | 11723   | 31%       | 9.9                | -1.2                  | -5.1                    |
| heatPump              | 11746   | 31%       | 10.0               | -0.3                  | +1.2                    |
| seedbankLibrary       | 11710   | 31%       | 10.3               | +0.9                  | +2.9                    |
| greenhouse            | 11843   | 31%       | 10.0               | -0.6                  | -1.8                    |
| weir                  | 12161   | 30%       | 10.5               | -0.4                  | -1.5                    |
| kiln                  | 12160   | 30%       | 10.4               | +0.1                  | -0.2                    |
| levee                 | 14644   | 25%       | 11.8               | -0.7                  | -3.4                    |

In runs that reached the end, the draft had cards to offer for 19.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.1  | 1.0      | 0.9   |
| greedyFood   | 0.6    | 5.2  | 4.5      | 4.1   |
| greedyEnergy | 1.5    | 5.6  | 5.6      | 4.9   |
| balanced     | 0.3    | 2.8  | 5.3      | 4.7   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 8%     | 11%    | 8%     | 63%    | 2.8          |
| greedyFood   | 9%     | 97%    | 49%    | 96%    | 14.1         |
| greedyEnergy | 4%     | 80%    | 10%    | 100%   | 9.5          |
| balanced     | 11%    | 79%    | 32%    | 99%    | 10.4         |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | ---------- | ----------- | --------- |
| random           | 3%             | 52%          | 7%         | 32%         | 6%        |
| greedyFood       | 2%             | 28%          | 62%        | 4%          | 4%        |
| greedyEnergy     | 9%             | 24%          | 20%        | 13%         | 34%       |
| balanced         | 2%             | 26%          | 68%        | 1%          | 4%        |
| top 25% by score | 2%             | 26%          | 68%        | 1%          | 4%        |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- |
| random       | 1.14                           | 7%                           | 4%                               |
| greedyFood   | 1.62                           | 37%                          | 45%                              |
| greedyEnergy | 1.19                           | 14%                          | 21%                              |
| balanced     | 1.25                           | 18%                          | 24%                              |

**Yes.** The non-random bots make 1.37× the food they eat after Year 1; 25% of it rots, and 30% of seasons end with storage full. Rotting food becomes biomass, so the surplus is wasted but does no harm.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 92% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings are not in the game yet (Milestone 6), so "once tunings stack" cannot be answered until then.

### Is there one dominant strategy?

Median score by bot: balanced 208, greedyFood 174, greedyEnergy 164, random 34. The cards with the biggest early lift: fishPond (+2.1), pollinatorMeadow (+1.8), solarThermalCollector (+1.4).

### Do runs feel long in the middle?

Non-random bots have 0.8 idle seasons in Settle, 4.5 in Mend, 5.2 in Flourish and 4.6 in Bloom (12 seasons per era; collapsed runs count fewer seasons). **The middle eras are quieter than the first.**

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, scraps came 355 from citizens and 0 from rotting food; 9 became clutter. Wellbeing lost: 0 to hunger, 65 to unpowered homes, 0 to clutter. 0 of 3000 non-random runs collapsed from clutter.
