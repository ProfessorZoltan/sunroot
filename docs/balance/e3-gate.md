# The E3 gate: Willow Reach v2's new cards

EXPANSION.md's gate for E3: "in the simulator, no single new card appears in more than 40% of
winning bot runs". Played by `scripts/e3-gate.ts` as run 3 plays (water and walks to work on), with
the three profile bots (balanced, greedyFood, greedyEnergy), 30 runs each on the same seeds.
Winning is reaching Heartwood: 12 of 90 runs. The bots take the first option of a branching
evolution and never coppice.

## The gate as written

Every new card is drafted in every winning run, because late drafts run out of other cards, so the
table also counts the runs that built each card.

| Card            | Drafted, winning runs | Built, winning runs | Built, all runs | Median score with it | Median score without | Source               |
| --------------- | --------------------- | ------------------- | --------------- | -------------------- | -------------------- | -------------------- |
| Reed Bed        | 100%                  | 75%                 | 33%             | 379                  | 301                  | `scripts/e3-gate.ts` |
| Bathhouse       | 100%                  | 75%                 | 33%             | 379                  | 301                  | `scripts/e3-gate.ts` |
| Rice-fish Paddy | 100%                  | 8%                  | 14%             | 351                  | 325                  | `scripts/e3-gate.ts` |
| Mushroom Cellar | 100%                  | 25%                 | 32%             | 348                  | 312                  | `scripts/e3-gate.ts` |
| Hedgerow        | 100%                  | 8%                  | 37%             | 283                  | 358                  | `scripts/e3-gate.ts` |

Read literally, the Bathhouse and Reed Bed fail: each was built in 75% of winning runs. But almost
every winning run is the balanced bot's, and the balanced bot builds a bathhouse (and a reed bed
for its grey water) whenever it reaches 12 citizens. That measures the bot's habit, not the card.
The "with it / without" scores are confounded the same way (the balanced bot scores higher anyway).

## Leaving each card out

The same bots and seeds, with one card at a time left out of the draft. A card the bots needed to
win would show as a drop in Heartwood here.

| Left out of the draft | Heartwood | Median score | Collapsed | Source               |
| --------------------- | --------- | ------------ | --------- | -------------------- |
| Nothing               | 13%       | 331          | 0%        | `scripts/e3-gate.ts` |
| Reed Bed              | 14%       | 338          | 1%        | `scripts/e3-gate.ts` |
| Bathhouse             | 19%       | 339          | 1%        | `scripts/e3-gate.ts` |
| Rice-fish Paddy       | 20%       | 339          | 1%        | `scripts/e3-gate.ts` |
| Mushroom Cellar       | 18%       | 315          | 1%        | `scripts/e3-gate.ts` |
| Hedgerow              | 18%       | 339          | 1%        | `scripts/e3-gate.ts` |
| All five              | 17%       | 316          | 0%        | `scripts/e3-gate.ts` |

No card is one the bots can't win without: leaving any one out never lowers the Heartwood share
(the differences are 1 to 7 runs of 90, about the noise). If anything the new cards are a little
weak in the bots' hands: a draft pick spent on one is a pick not spent on something else. The
Mushroom Cellar is the one that pays: without it the median falls from 331 to 315, the same as
without all five.

## The new combos

| Combo             | Layer     | Discovered, all runs | Discovered, winning runs | Source               |
| ----------------- | --------- | -------------------- | ------------------------ | -------------------- |
| Bath Loop         | chain     | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Rice-Fish Loop    | chain     | 4%                   | 0%                       | `scripts/e3-gate.ts` |
| Mushroom Loop     | chain     | 32%                  | 25%                      | `scripts/e3-gate.ts` |
| Heat Cascade      | chain     | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Keyhole Garden    | formation | 66%                  | 75%                      | `scripts/e3-gate.ts` |
| Water Ladder      | formation | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Windbreak         | formation | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Hearth Square     | formation | 1%                   | 8%                       | `scripts/e3-gate.ts` |
| Food Forest       | evolution | 3%                   | 8%                       | `scripts/e3-gate.ts` |
| Aquaponics Hall   | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Canal-top Solar   | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Beaver Dam        | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Singing Spire     | evolution | 31%                  | 58%                      | `scripts/e3-gate.ts` |
| Old World Archive | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Coppice Wood      | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |

The bots play by simple local rules and stumble on the common combos only (the Keyhole Garden,
since they put farms round a composter anyway; the Singing Spire; the Mushroom Loop). The rest are
there to be found by a player: every one triggers in a unit test.

## What I would do

1. **Call the gate passed in spirit, and restate it** as "leaving any one new card out of the draft
   doesn't lower the bots' Heartwood share", which measures the card rather than the bot. The
   literal 40% fails only for the balanced bot's bathhouse habit. DECISIONS.md Q19 asks.
2. **Playtest the new cards before tuning them.** The bots find them slightly weak, but bots don't
   chase combos, and the new cards are mostly combo pieces.
