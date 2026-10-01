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
| random       | 17%       | 9                         | 24        | 34           | 142       | 6                      | 2.7                     | 4.0                 |
| greedyFood   | 100%      | 48                        | 170       | 176          | 182       | 42                     | 15.3                    | 14.7                |
| greedyEnergy | 100%      | 48                        | 156       | 164          | 170       | 36                     | 9.5                     | 17.8                |
| balanced     | 100%      | 48                        | 200       | 208          | 218       | 36                     | 10.5                    | 13.3                |

## Score spread

Runs per score band.

| Bot          | 0–29 | 30–59 | 60–89 | 90–119 | 120–149 | 150–179 | 180–209 | 210–239 |
| ------------ | ---- | ----- | ----- | ------ | ------- | ------- | ------- | ------- |
| random       | 262  | 527   | 32    | 27     | 74      | 73      | 5       | 0       |
| greedyFood   | 0    | 0     | 0     | 0      | 1       | 760     | 239     | 0       |
| greedyEnergy | 0    | 0     | 0     | 0      | 2       | 998     | 0       | 0       |
| balanced     | 0    | 0     | 0     | 0      | 0       | 6       | 575     | 419     |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 172       | 681               | 26                   | 121                | 56 / 9 / 12                                           |
| greedyFood   | 1000      | 0                 | 0                    | 0                  | 0 / 95 / 2                                            |
| greedyEnergy | 1000      | 0                 | 0                    | 0                  | 0 / 44 / 0                                            |
| balanced     | 1000      | 0                 | 0                    | 0                  | 0 / 52 / 0                                            |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 3216    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5223    | 69%       | 5.5                | +1.9                  | +3.4                    |
| heatWell              | 6126    | 59%       | 6.7                | +0.0                  | +1.1                    |
| orchard               | 8076    | 45%       | 7.5                | +0.8                  | +3.2                    |
| fishPond              | 8557    | 42%       | 8.0                | +0.1                  | +0.7                    |
| apiary                | 9116    | 40%       | 8.5                | +0.3                  | +0.6                    |
| solarThermalCollector | 9255    | 39%       | 8.7                | +0.3                  | +2.1                    |
| cellBank              | 9259    | 39%       | 8.5                | -1.0                  | -1.9                    |
| pollinatorMeadow      | 10914   | 33%       | 9.4                | +2.2                  | +6.6                    |
| windSpire             | 11237   | 33%       | 9.6                | -3.4                  | -11.1                   |
| biogasDigester        | 11374   | 32%       | 9.6                | +0.6                  | +1.0                    |
| treeNursery           | 11408   | 32%       | 9.7                | +0.3                  | -4.4                    |
| commonsPlaza          | 11510   | 32%       | 9.8                | -0.3                  | -0.5                    |
| heatPump              | 11806   | 31%       | 10.0               | +0.7                  | +6.8                    |
| seedbankLibrary       | 11803   | 31%       | 10.3               | +0.5                  | +1.8                    |
| greenhouse            | 11934   | 30%       | 10.1               | -0.4                  | -1.5                    |
| kiln                  | 11998   | 30%       | 10.3               | -1.1                  | -2.9                    |
| weir                  | 12132   | 30%       | 10.4               | -0.6                  | -3.7                    |
| levee                 | 14589   | 25%       | 11.7               | -1.0                  | -1.2                    |

In runs that reached the end, the draft had cards to offer for 19.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.1  | 0.9      | 0.9   |
| greedyFood   | 0.6    | 5.1  | 4.5      | 4.5   |
| greedyEnergy | 1.6    | 5.7  | 5.6      | 4.9   |
| balanced     | 0.3    | 2.8  | 5.4      | 4.9   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 8%     | 10%    | 9%     | 64%    | 2.7          |
| greedyFood   | 12%    | 97%    | 68%    | 99%    | 15.3         |
| greedyEnergy | 4%     | 81%    | 9%     | 100%   | 9.5          |
| balanced     | 6%     | 74%    | 37%    | 99%    | 10.5         |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | ---------- | ----------- | --------- |
| random           | 4%             | 52%          | 7%         | 31%         | 6%        |
| greedyFood       | 2%             | 29%          | 60%        | 5%          | 4%        |
| greedyEnergy     | 10%            | 23%          | 21%        | 13%         | 32%       |
| balanced         | 1%             | 26%          | 70%        | 1%          | 2%        |
| top 25% by score | 1%             | 26%          | 70%        | 1%          | 2%        |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- |
| random       | 1.17                           | 9%                           | 5%                               |
| greedyFood   | 1.57                           | 35%                          | 43%                              |
| greedyEnergy | 1.20                           | 14%                          | 21%                              |
| balanced     | 1.26                           | 18%                          | 24%                              |

**Yes.** The non-random bots make 1.36× the food they eat after Year 1; 25% of it rots, and 29% of seasons end with storage full. Rotting food becomes biomass, so the surplus is wasted but does no harm.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 95% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings are not in the game yet (Milestone 6), so "once tunings stack" cannot be answered until then.

### Is there one dominant strategy?

Median score by bot: balanced 208, greedyFood 176, greedyEnergy 164, random 34. The cards with the biggest early lift: pollinatorMeadow (+2.2), riverWheel (+1.9), orchard (+0.8).

### Do runs feel long in the middle?

Non-random bots have 0.8 idle seasons in Settle, 4.5 in Mend, 5.2 in Flourish and 4.8 in Bloom (12 seasons per era; collapsed runs count fewer seasons). **The middle eras are quieter than the first.**

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, scraps came 356 from citizens and 0 from rotting food; 9 became clutter. Wellbeing lost: 0 to hunger, 64 to unpowered homes, 1 to clutter. 0 of 3000 non-random runs collapsed from clutter.
