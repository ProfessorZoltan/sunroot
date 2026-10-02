# The E3 gate: Willow Reach v2's new cards

The gate, as restated (DECISIONS.md, Q19): **leaving any one new card out of the draft doesn't lower
the bots' Heartwood share**, beyond the noise, so no card is one the bots need to win.
EXPANSION.md first wrote it as "no single new card appears in more than 40% of winning bot runs";
that measured which cards the bots habitually build rather than how strong the cards are (below).

Played by `scripts/e3-gate.ts` as run 3 plays (water and walks to work on), with the three profile
bots (balanced, greedyFood, greedyEnergy), 30 runs each on the same seeds, after hedgerows moved to
tile edges and the heat layer joined. Winning is reaching Heartwood: 16 of 90 runs (18%). The bots
take the first option of a branching evolution and never coppice.

## Leaving each card out: the gate

The same bots and seeds, with one card at a time left out of the draft. A card the bots needed to
win would show as a drop in Heartwood here. The noise is one standard error of the share with every
card in: 4 points (about 4 runs of 90).

| Left out of the draft | Heartwood | Change  | Median score | Collapsed | Source               |
| --------------------- | --------- | ------- | ------------ | --------- | -------------------- |
| Nothing               | 18%       | –       | 335          | 0%        | `scripts/e3-gate.ts` |
| Reed Bed              | 18%       | 0       | 338          | 1%        | `scripts/e3-gate.ts` |
| Bathhouse             | 17%       | −1 run  | 339          | 1%        | `scripts/e3-gate.ts` |
| Rice-fish Paddy       | 20%       | +2 runs | 345          | 1%        | `scripts/e3-gate.ts` |
| Mushroom Cellar       | 19%       | +1 run  | 316          | 1%        | `scripts/e3-gate.ts` |
| Hedgerow              | 18%       | 0       | 333          | 1%        | `scripts/e3-gate.ts` |
| All five              | 16%       | −2 runs | 317          | 0%        | `scripts/e3-gate.ts` |

**The gate passes.** The largest drop is the Bathhouse's, one run of 90, well inside the noise. If
anything the new cards are a little weak in the bots' hands: a draft pick spent on one is a pick
not spent on something else. The Mushroom Cellar is the one that pays: without it the median falls
from 335 to 316, about the same as without all five.

## The first wording: 40% of winning runs

Every new card is drafted in every winning run, because late drafts run out of other cards, so the
table also counts the runs that built each card.

| Card            | Drafted, winning runs | Built, winning runs | Built, all runs | Median score with it | Median score without | Source               |
| --------------- | --------------------- | ------------------- | --------------- | -------------------- | -------------------- | -------------------- |
| Reed Bed        | 100%                  | 69%                 | 32%             | 380                  | 301                  | `scripts/e3-gate.ts` |
| Bathhouse       | 100%                  | 69%                 | 32%             | 380                  | 301                  | `scripts/e3-gate.ts` |
| Rice-fish Paddy | 100%                  | 13%                 | 13%             | 351                  | 331                  | `scripts/e3-gate.ts` |
| Mushroom Cellar | 100%                  | 31%                 | 32%             | 348                  | 312                  | `scripts/e3-gate.ts` |
| Hedgerow        | 100%                  | 69%                 | 67%             | 318                  | 348                  | `scripts/e3-gate.ts` |

Read literally, the Bathhouse, Reed Bed and Hedgerow fail: each was built in 69% of winning runs.
But almost every winning run is the balanced bot's, which builds a bathhouse (and a reed bed for
its grey water) whenever it reaches 12 citizens; and two bots plant a hedge by anything storms
could damage. That measures the bots' habits, not the cards. The "with it / without" scores are
confounded the same way (the balanced bot scores higher anyway).

## The new combos

| Combo             | Layer     | Discovered, all runs | Discovered, winning runs | Source               |
| ----------------- | --------- | -------------------- | ------------------------ | -------------------- |
| Bath Loop         | chain     | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Rice-Fish Loop    | chain     | 4%                   | 6%                       | `scripts/e3-gate.ts` |
| Mushroom Loop     | chain     | 32%                  | 31%                      | `scripts/e3-gate.ts` |
| Heat Cascade      | chain     | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Keyhole Garden    | formation | 62%                  | 63%                      | `scripts/e3-gate.ts` |
| Water Ladder      | formation | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Windbreak         | formation | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Hearth Square     | formation | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Food Forest       | evolution | 6%                   | 19%                      | `scripts/e3-gate.ts` |
| Aquaponics Hall   | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Canal-top Solar   | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Beaver Dam        | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Singing Spire     | evolution | 31%                  | 69%                      | `scripts/e3-gate.ts` |
| Old World Archive | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |
| Coppice Wood      | evolution | 0%                   | 0%                       | `scripts/e3-gate.ts` |

The bots play by simple local rules and stumble on the common combos only (the Keyhole Garden,
since they put farms round a composter anyway; the Singing Spire; the Mushroom Loop). The rest are
there to be found by a player: every one triggers in a unit test.

## Next

Playtest the new cards before tuning them. The bots find them slightly weak, but bots don't chase
combos, and the new cards are mostly combo pieces.
