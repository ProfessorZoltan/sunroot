/**
 * Spreading compost many times at once (asked for in playtesting: late in a run, spreading it a
 * tile at a time was a chore). The plan aims at the most Harmony: first a Wildway, if one can be
 * composted into being within the batch and it pays better than single tiles; then, one spread at
 * a time, the tile whose next steps give the most Harmony a spread. Pure and deterministic.
 */
import type { Content } from './content/load';
import type { TileType } from './content/schema';
import { cheapestStrip, combosOf, findFormations } from './combos';
import { hexDistance, hexKey } from './hex';
import { defOf, occupancy } from './queries';
import type { RunState } from './types';

/** The tiles a batch of `times` spreads go to, one key a spread, in order (fewer if land runs out). */
export function compostPlan(content: Content, state: RunState, times: number): string[] {
  const ladder = content.rules.landHealth;
  const perTile = content.rules.harmony.perTile;
  const worth = (t: TileType) => perTile[t] ?? 0;
  // Working copy of the tiles' types; tiles whose Harmony counts as another type (a coppice) are
  // left out, as compost would change nothing there.
  const types = new Map<string, TileType>();
  for (const [key, t] of Object.entries(state.map.tiles)) types.set(key, t.type);
  const masked = new Set(
    Object.values(state.buildings)
      .filter((b) => defOf(content, b).harmonyAsTile)
      .map((b) => hexKey(b.at)),
  );
  const occ = occupancy(state);
  const camp = state.buildings.b0?.at ?? { q: 0, r: 0 };
  const plan: string[] = [];

  /** The best single tile for the next spread: Harmony a spread, over its next steps. */
  const bestTile = (left: number) => {
    let best: { key: string; rate: number; rank: number[] } | null = null;
    for (const [key, type] of types) {
      const at = ladder.indexOf(type);
      if (at < 0 || at === ladder.length - 1 || masked.has(key)) continue;
      let rate = 0;
      for (let k = 1; k <= Math.min(left, ladder.length - 1 - at); k++)
        rate = Math.max(rate, (worth(ladder[at + k]!) - worth(type)) / k);
      // Ties: the worst land first, open ground before built, then near the camp.
      const tile = state.map.tiles[key]!;
      const rank = [-rate, at, occ.has(key) ? 1 : 0, hexDistance(tile, camp)];
      if (!best || before(rank, key, best.rank, best.key)) best = { key, rate, rank };
    }
    return best;
  };
  const step = (key: string) => {
    types.set(key, ladder[ladder.indexOf(types.get(key)!) + 1]!);
    plan.push(key);
  };

  // A Wildway (a strip of green land from the water to the edge) within the batch.
  for (const combo of combosOf(content, 'formation')) {
    const shape = combo.shape;
    if (shape.kind !== 'strip' || combo.effect.harmony <= 0) continue;
    if (findFormations(content, state, [combo]).length > 0) continue;
    const green = shape.tiles.map((t) => ladder.indexOf(t)).filter((i) => i >= 0);
    const stepsTo = (type: string) => {
      if ((shape.tiles as string[]).includes(type)) return 0;
      const at = ladder.indexOf(type as TileType);
      const target = green.filter((i) => i > at).sort((a, b) => a - b)[0];
      return at < 0 || target === undefined ? null : target - at;
    };
    const strip = cheapestStrip(state, stepsTo);
    const left = times - plan.length;
    if (!strip || strip.cost === 0 || strip.cost > left) continue;
    let gain = combo.effect.harmony;
    for (const key of strip.tiles) {
      const from = types.get(key)!;
      gain += worth(ladder[ladder.indexOf(from) + stepsTo(from)!] ?? from) - worth(from);
    }
    if (gain / strip.cost <= (bestTile(left)?.rate ?? 0)) continue;
    for (const key of strip.tiles) for (let n = stepsTo(types.get(key)!)!; n > 0; n--) step(key);
  }

  while (plan.length < times) {
    const best = bestTile(times - plan.length);
    if (!best) break;
    step(best.key);
  }
  return plan;
}

const before = (a: number[], ak: string, b: number[], bk: string): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! < b[i]!;
  return ak < bk;
};
