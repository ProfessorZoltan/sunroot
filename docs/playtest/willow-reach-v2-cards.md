# Playtesting Willow Reach v2's new cards

The bots can't tell us whether the five new cards are worth a pick: they build them out of habit
and never chase the combos the cards are made for ([balance/e3-gate.md](../balance/e3-gate.md)).
They found the cards slightly weak, the Mushroom Cellar aside. This guide is for tuning them by
playing instead.

## Getting to the cards

| Way in                               | What you get                                                                                                                    | Source         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Run 2 or later                       | The cards join the draft with water, as a player meets them                                                                     | DECISIONS.md   |
| `?seed=pt-1&water=1&guided=0`        | A one-off run with water and no guided year, so the new cards can come up from the first draft (any seed; reuse one to compare) | `src/main.tsx` |
| `?seed=pt-1&water=1&heat=1&guided=0` | The same with the heat layer, for the Bathhouse and Heat Cascade without grid heat                                              | `src/main.tsx` |
| `?sandbox&water=1`                   | Every building on the palette and no draft: build a combo straight away to see it work                                          | `src/main.tsx` |
| **Start over** (Root City)           | Back to run 1 as a new player                                                                                                   | DECISIONS.md   |

## The cards

| Card            | Cost, workers | What it does                                                                                           | Combos it is for                       | Source       |
| --------------- | ------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------- | ------------ |
| Reed Bed        | 3, none       | Beside a channel or the river; cleans grey water; 1 biomass spring to autumn; +1 Harmony               | Bath Loop                              | DECISIONS.md |
| Bathhouse       | 8, 1          | 1 clean water and 1 heat a night: +3 wellbeing (1 short of water); sends 1 grey water down its channel | Bath Loop, Heat Cascade, Hearth Square | DECISIONS.md |
| Rice-fish Paddy | 5, 1          | Floodplain beside a channel; 2 water; 4 food in summer; sends nutrient-rich water to the farms below   | Rice-Fish Loop, Water Ladder           | DECISIONS.md |
| Mushroom Cellar | 5, 1          | 2 biomass into 2 food and 1 compost a season, winter too, no energy; +1 food beside woodland or a kiln | Mushroom Loop                          | DECISIONS.md |
| Hedgerow        | 2 a segment   | Runs along a tile edge; storms can't damage buildings on either side; 1 Harmony per 2 segments         | Windbreak (4 joined)                   | DECISIONS.md |

## What to look for

For each card, the questions that decide its tuning:

1. **Would you pick it over the other two cards?** Note when you passed on it, and why (too dear,
   no spot for it, didn't see what it was for).
2. **Did its combo happen?** Each card is mostly a combo piece. Did you find the combo on your own,
   from the hint, or not at all? Did it feel worth the layout it asked for?
3. **Was the payoff felt?** The season report shows what each building made; did the numbers
   change a decision?
4. **Was anything fiddly?** Hedges along edges and the Bathhouse's heat are new to place.

Press **Note** (top bar) in the season it happens; the note is kept with that season.

## What the log records

The playtest log (Help, **?**, then Download CSV) now has, for each season, beside the time,
undos, card and notes:

| Column       | What it holds                                                      | Source                |
| ------------ | ------------------------------------------------------------------ | --------------------- |
| `placed`     | Buildings placed, with `hedgerow` for each hedge and `coppiceWood` | `src/game/playlog.ts` |
| `card`       | The card picked, so passed-over new cards show by their absence    | `src/game/playlog.ts` |
| `layers`     | `water`, `walks`, `heat`: the layers the run plays with            | `src/game/playlog.ts` |
| `discovered` | Combos found as the season ended, and evolutions chosen in it      | `src/game/playlog.ts` |

Send the CSV with your notes; the tuning comes from both.

## What the bots saw (for comparison)

| Card            | Built in runs | Without it, the bots' Heartwood share | Source               |
| --------------- | ------------- | ------------------------------------- | -------------------- |
| Reed Bed        | 32%           | No change                             | `scripts/e3-gate.ts` |
| Bathhouse       | 32%           | 1 run of 90 lower (noise)             | `scripts/e3-gate.ts` |
| Rice-fish Paddy | 13%           | 2 runs of 90 higher                   | `scripts/e3-gate.ts` |
| Mushroom Cellar | 32%           | 1 run higher, but median score −19    | `scripts/e3-gate.ts` |
| Hedgerow        | 67%           | No change                             | `scripts/e3-gate.ts` |
