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
| greedyFood   | 100%      | 48                        | 223       | 234          | 247       | 66                     | 6.3                     | 3.3                 |
| greedyEnergy | 100%      | 48                        | 188       | 194          | 198       | 50                     | 2.1                     | 4.3                 |
| balanced     | 100%      | 48                        | 273       | 287          | 302       | 45                     | 3.3                     | 7.2                 |

## Score spread

Runs per score band.

| Bot          | 0–39 | 40–79 | 80–119 | 120–159 | 160–199 | 200–239 | 240–279 | 280–319 | 320–359 |
| ------------ | ---- | ----- | ------ | ------- | ------- | ------- | ------- | ------- | ------- |
| random       | 587  | 106   | 29     | 145     | 121     | 12      | 0       | 0       | 0       |
| greedyFood   | 0    | 0     | 0      | 0       | 1       | 686     | 313     | 0       | 0       |
| greedyEnergy | 0    | 0     | 0      | 0       | 924     | 76      | 0       | 0       | 0       |
| balanced     | 0    | 0     | 0      | 0       | 0       | 0       | 234     | 759     | 7       |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 293       | 563               | 30                   | 114                | 53 / 12 / 14                                          |
| greedyFood   | 1000      | 0                 | 0                    | 0                  | 0 / 27 / 2                                            |
| greedyEnergy | 1000      | 0                 | 0                    | 0                  | 0 / 8 / 0                                             |
| balanced     | 1000      | 0                 | 0                    | 0                  | 0 / 17 / 2                                            |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 3338    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5088    | 71%       | 7.0                | +1.7                  | +3.4                    |
| heatWell              | 5756    | 63%       | 8.0                | +1.0                  | +2.7                    |
| orchard               | 7842    | 46%       | 9.1                | +2.8                  | +10.9                   |
| fishPond              | 8142    | 44%       | 9.6                | +0.2                  | +1.6                    |
| apiary                | 8576    | 42%       | 10.0               | -0.0                  | -1.2                    |
| cellBank              | 8586    | 42%       | 9.9                | +1.1                  | +2.2                    |
| solarThermalCollector | 8731    | 41%       | 10.4               | -2.4                  | -9.3                    |
| pollinatorMeadow      | 10349   | 35%       | 11.4               | -1.6                  | +4.9                    |
| treeNursery           | 10603   | 34%       | 11.5               | +4.0                  | +11.4                   |
| windSpire             | 10726   | 34%       | 11.6               | -1.7                  | -6.7                    |
| heatPump              | 10735   | 34%       | 11.7               | -0.3                  | -2.0                    |
| commonsPlaza          | 10796   | 33%       | 12.0               | -2.0                  | -5.9                    |
| biogasDigester        | 10963   | 33%       | 11.5               | +3.4                  | +7.6                    |
| kiln                  | 10999   | 33%       | 12.1               | +0.5                  | +2.4                    |
| seedbankLibrary       | 11032   | 33%       | 12.2               | -1.6                  | -5.0                    |
| weir                  | 11248   | 32%       | 12.3               | -2.4                  | -9.6                    |
| greenhouse            | 11204   | 32%       | 11.9               | -1.4                  | -3.6                    |
| mirrorFilm            | 13377   | 27%       | 13.8               | -1.8                  | -7.8                    |
| levee                 | 13552   | 27%       | 14.0               | +1.1                  | +3.3                    |
| deepRoots             | 13670   | 26%       | 13.9               | +0.5                  | +4.5                    |
| hiveMind              | 13611   | 26%       | 14.0               | +1.7                  | +4.9                    |
| nightShift            | 13932   | 26%       | 14.1               | -1.9                  | -8.4                    |
| siltTraps             | 13899   | 26%       | 14.1               | -0.5                  | -1.3                    |

In runs that reached the end, the draft had cards to offer for 24.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.3  | 1.0      | 0.8   |
| greedyFood   | 0.5    | 0.5  | 0.1      | 2.2   |
| greedyEnergy | 0.2    | 0.5  | 1.0      | 2.7   |
| balanced     | 0.1    | 0.0  | 0.0      | 7.0   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 12%    | 14%    | 11%    | 67%    | 3.4          |
| greedyFood   | 7%     | 86%    | 22%    | 88%    | 6.3          |
| greedyEnergy | 1%     | 28%    | 5%     | 78%    | 2.1          |
| balanced     | 10%    | 32%    | 21%    | 95%    | 3.3          |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | ---------- | ----------- | --------- |
| random           | 5%             | 37%          | 11%        | 37%         | 10%       |
| greedyFood       | 3%             | 14%          | 44%        | 2%          | 38%       |
| greedyEnergy     | 12%            | 12%          | 23%        | 11%         | 41%       |
| balanced         | 2%             | 15%          | 47%        | 1%          | 35%       |
| top 25% by score | 2%             | 15%          | 47%        | 1%          | 35%       |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full | Unfed citizen-seasons per run |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- | ----------------------------- |
| random       | 1.32                           | 17%                          | 9%                               | 17.6                          |
| greedyFood   | 2.51                           | 59%                          | 46%                              | 0.0                           |
| greedyEnergy | 1.09                           | 4%                           | 9%                               | 0.0                           |
| balanced     | 1.18                           | 11%                          | 16%                              | 0.0                           |

**No.** The bots that build food only to need (all but random and greedyFood) make 1.13× the food they eat after Year 1, and 8% of it rots. Hunger is rare: 0.013 unfed citizen-seasons per run. Food needs attention every season, though: the random bot, which ignores it, mostly collapses from hunger.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 56% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings and charters are in play; the cards table shows how often each tuning was taken. The bots rank tunings below every blueprint, so stacked tunings are under-tested.

### Is there one dominant strategy?

Median score by bot: balanced 287, greedyFood 234, greedyEnergy 194, random 35. The cards with the biggest early lift: treeNursery (+4.0), biogasDigester (+3.4), orchard (+2.8).

### Do runs feel long in the middle?

Non-random bots have 0.3 idle seasons in Settle, 0.3 in Mend, 0.4 in Flourish and 4.0 in Bloom (12 seasons per era; collapsed runs count fewer seasons). The middle eras are not much quieter than the first.

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, scraps came 447 from citizens and 0 from rotting food; 3 became clutter. Wellbeing lost: 0 to hunger, 17 to unpowered homes, 1 to clutter. 0 of 3000 non-random runs collapsed from clutter.
