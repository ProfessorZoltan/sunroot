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
| random       | 15%       | 9                         | 24        | 34           | 133       | 6                      | 2.7                     | 4.0                 |
| greedyFood   | 7%        | 27                        | 46        | 59           | 117       | 18                     | 2.2                     | 6.7                 |
| greedyEnergy | 94%       | 48                        | 141       | 153          | 159       | 38                     | 7.7                     | 11.0                |
| balanced     | 83%       | 48                        | 115       | 151          | 170       | 38                     | 6.5                     | 6.6                 |

## Score spread

Runs per score band.

| Bot          | 0–29 | 30–59 | 60–89 | 90–119 | 120–149 | 150–179 | 180–209 | 210–239 |
| ------------ | ---- | ----- | ----- | ------ | ------- | ------- | ------- | ------- |
| random       | 270  | 529   | 47    | 27     | 74      | 51      | 1       | 1       |
| greedyFood   | 1    | 507   | 324   | 82     | 51      | 35      | 0       | 0       |
| greedyEnergy | 0    | 0     | 0     | 62     | 292     | 646     | 0       | 0       |
| balanced     | 0    | 0     | 0     | 164    | 306     | 466     | 58      | 6       |

## How runs end

A collapsed run is blamed on its biggest wellbeing drain over its last 4 seasons.

| Bot          | Completed | Collapsed: hunger | Collapsed: unpowered | Collapsed: clutter | Wellbeing lost per run (hunger / unpowered / clutter) |
| ------------ | --------- | ----------------- | -------------------- | ------------------ | ----------------------------------------------------- |
| random       | 149       | 664               | 35                   | 152                | 56 / 9 / 14                                           |
| greedyFood   | 68        | 0                 | 0                    | 932                | 0 / 12 / 193                                          |
| greedyEnergy | 936       | 0                 | 0                    | 64                 | 0 / 29 / 87                                           |
| balanced     | 825       | 0                 | 0                    | 175                | 0 / 34 / 159                                          |

## Cards

Pick rate is how often a card was taken when it was on offer. Early lift compares runs that picked the card in the first 2 years with runs that did not, among runs that lasted that long, averaged over bots so a bot's own preferences don't skew it. Random-bot picks are random, so its early lift is the least biased measure of a card on its own. Lift needs at least 3 runs on each side.

| Card                  | Offered | Pick rate | Mean season picked | Early lift (all bots) | Early lift (random bot) |
| --------------------- | ------- | --------- | ------------------ | --------------------- | ----------------------- |
| pumpedReservoir       | 2913    | 100%      | 25.0               | –                     | –                       |
| riverWheel            | 5237    | 69%       | 5.5                | -2.2                  | -4.4                    |
| heatWell              | 6162    | 59%       | 6.7                | -0.8                  | -2.8                    |
| orchard               | 7997    | 45%       | 7.4                | -0.1                  | +0.4                    |
| fishPond              | 8444    | 43%       | 8.0                | +1.6                  | +5.1                    |
| cellBank              | 9080    | 40%       | 8.4                | +0.9                  | -3.2                    |
| apiary                | 9121    | 40%       | 8.5                | +0.2                  | +3.6                    |
| solarThermalCollector | 9228    | 39%       | 8.7                | +1.0                  | +4.9                    |
| pollinatorMeadow      | 10922   | 33%       | 9.3                | +1.1                  | +4.1                    |
| windSpire             | 11114   | 33%       | 9.5                | +0.7                  | +0.5                    |
| treeNursery           | 11252   | 32%       | 9.7                | -0.8                  | -2.2                    |
| biogasDigester        | 11520   | 31%       | 9.6                | +1.9                  | +1.9                    |
| commonsPlaza          | 11725   | 31%       | 9.9                | -3.1                  | -7.0                    |
| greenhouse            | 11815   | 31%       | 10.0               | +0.9                  | -1.0                    |
| heatPump              | 11789   | 31%       | 10.0               | -0.0                  | +0.4                    |
| seedbankLibrary       | 11692   | 31%       | 10.3               | +0.3                  | +2.1                    |
| weir                  | 12109   | 30%       | 10.4               | +0.6                  | +1.0                    |
| kiln                  | 12120   | 30%       | 10.4               | -1.1                  | +1.0                    |
| levee                 | 14591   | 25%       | 11.7               | -0.9                  | -4.4                    |

In runs that reached the end, the draft had cards to offer for 19.0 of 48 seasons on average: after that every blueprint is unlocked and there is nothing left to pick.

## Idle seasons

Seasons in which the bot built or changed nothing, per run, by era.

| Bot          | Settle | Mend | Flourish | Bloom |
| ------------ | ------ | ---- | -------- | ----- |
| random       | 1.1    | 1.1  | 0.9      | 0.9   |
| greedyFood   | 0.7    | 3.3  | 2.2      | 0.4   |
| greedyEnergy | 1.9    | 4.9  | 2.6      | 1.6   |
| balanced     | 0.2    | 2.7  | 2.2      | 1.5   |

## Blackouts

Share of runs with at least one blackout in that season of the year, and mean blackout seasons per run.

| Bot          | spring | summer | autumn | winter | Mean per run |
| ------------ | ------ | ------ | ------ | ------ | ------------ |
| random       | 8%     | 11%    | 8%     | 63%    | 2.7          |
| greedyFood   | 4%     | 30%    | 4%     | 85%    | 2.2          |
| greedyEnergy | 0%     | 67%    | 9%     | 99%    | 7.7          |
| balanced     | 4%     | 75%    | 21%    | 95%    | 6.5          |

## Energy mix

Share of all energy generated, by source.

| Runs             | biogasDigester | foundersCamp | riverWheel | solarCanopy | windSpire |
| ---------------- | -------------- | ------------ | ---------- | ----------- | --------- |
| random           | 3%             | 53%          | 6%         | 32%         | 6%        |
| greedyFood       | 10%            | 25%          | 55%        | 3%          | 7%        |
| greedyEnergy     | 2%             | 22%          | 30%        | 11%         | 35%       |
| balanced         | 1%             | 25%          | 69%        | 1%          | 5%        |
| top 25% by score | 2%             | 23%          | 47%        | 8%          | 20%       |

## Balance questions

### Is food too easy after Year 1? Do farms outpace population?

| Bot          | Food made / eaten after Year 1 | Share of food made that rots | Seasons ending with storage full |
| ------------ | ------------------------------ | ---------------------------- | -------------------------------- |
| random       | 1.12                           | 5%                           | 3%                               |
| greedyFood   | 1.91                           | 45%                          | 46%                              |
| greedyEnergy | 1.22                           | 16%                          | 22%                              |
| balanced     | 1.28                           | 20%                          | 26%                              |

**Yes.** The non-random bots make 1.37× the food they eat after Year 1; 25% of it rots, and 29% of seasons end with storage full. Rotting food becomes scraps, then clutter, so the surplus is not just wasted: it costs wellbeing and Harmony.

### Does any single energy source dominate?

In the top 25% of runs by score, riverWheel makes 61% of the energy from built sources. **It dominates:** more than half of built energy comes from one source. The mix partly reflects what each bot prefers to build, so compare it with the per-bot table above. Tunings are not in the game yet (Milestone 6), so "once tunings stack" cannot be answered until then.

### Is there one dominant strategy?

Median score by bot: greedyEnergy 153, balanced 151, greedyFood 59, random 34. The cards with the biggest early lift: biogasDigester (+1.9), fishPond (+1.6), pollinatorMeadow (+1.1).

### Do runs feel long in the middle?

Non-random bots have 0.9 idle seasons in Settle, 3.6 in Mend, 2.3 in Flourish and 1.2 in Bloom (12 seasons per era; collapsed runs count fewer seasons). **The middle eras are quieter than the first.**

### What costs wellbeing? (the clutter spiral, DECISIONS.md Q1)

Per non-random run, wellbeing lost: 0 to hunger, 25 to unpowered homes, 146 to clutter. 1171 of 3000 non-random runs collapsed from clutter.
