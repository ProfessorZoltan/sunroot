/**
 * Commuting (DECISIONS.md, Teaching by layers): workers walk from their home
 * to their work, and long walks cost wellbeing. Resolved right after
 * staffing, in a fixed order:
 *
 *  1. Each staffed workplace, in staffing (priority) order, houses each of
 *     its workers in the nearest home with a free bed (ties by the homes'
 *     priority): people live near their work. With no bed free, a worker
 *     lives at the Founders' Camp.
 *  2. Citizens who don't work fill the beds left, homes in priority order;
 *     anyone beyond the housing lives at the camp.
 *  3. Every `tilesPerWellbeing` tiles walked beyond `freeDistance`, summed
 *     over all workers, cost 1 wellbeing this season (rounded down).
 *  4. With water on too, each home someone lives in walks to the nearest
 *     drinking water: the river, a lake or reservoir, or a channel, cistern
 *     or well that isn't damaged. Tiles beyond `toWater.freeDistance`, summed
 *     over homes, cost 1 wellbeing for every `toWater.tilesPerWellbeing`.
 */
import { hexDistance } from '../hex';
import { byPriority, defOf, isHome, isWaterTile } from '../queries';
import type { CommuteReport, RunState, Walk, WaterWalkReport } from '../types';
import type { Content } from '../content/load';
import { walksToWater } from '../water';
import type { SeasonContext } from './context';

export function assignCommutes(ctx: SeasonContext): void {
  const { content, state } = ctx;
  const rules = content.rules.commute;
  if (!rules.enabled) return;
  // Workplaces in staffing order: the workers' own list, if the player made one.
  const order = byPriority(state, 'workers');
  const camp = state.buildings.b0 ?? order.find((b) => isHome(defOf(content, b)));
  const homes = order.filter((b) => isHome(defOf(content, b)));

  const beds: Record<string, number> = {};
  for (const h of homes) beds[h.uid] = defOf(content, h).housing;
  const residents: Record<string, number> = {};
  const live = (uid: string) => (residents[uid] = (residents[uid] ?? 0) + 1);
  const rank = new Map(order.map((b, i) => [b.uid, i]));

  // 1. Workers live near their work.
  const walks: Record<string, Walk[]> = {};
  let excess = 0;
  let workers = 0;
  for (const b of order) {
    const need = defOf(content, b).workers;
    if (need === 0 || !ctx.active.has(b.uid)) continue;
    const list: Walk[] = [];
    for (let i = 0; i < need; i++) {
      let best: { uid: string; d: number } | null = null;
      for (const h of homes) {
        if (beds[h.uid]! <= 0) continue;
        const d = hexDistance(h.at, b.at);
        if (!best || d < best.d || (d === best.d && rank.get(h.uid)! < rank.get(best.uid)!))
          best = { uid: h.uid, d };
      }
      if (best) beds[best.uid]! -= 1;
      const home = best?.uid ?? camp?.uid;
      if (!home) break;
      const distance = best?.d ?? hexDistance(camp!.at, b.at);
      live(home);
      workers++;
      list.push({ home, distance });
      excess += Math.max(0, distance - rules.freeDistance);
    }
    walks[b.uid] = list;
  }

  // 2. Everyone else fills the beds left; the rest live at the camp.
  let left = Math.max(0, state.citizens - workers);
  for (const h of homes) {
    const n = Math.min(left, beds[h.uid]!);
    for (let i = 0; i < n; i++) live(h.uid);
    left -= n;
  }
  if (left > 0 && camp) residents[camp.uid] = (residents[camp.uid] ?? 0) + left;

  // 3. What the long walks cost.
  const wellbeing = -Math.floor(excess / rules.tilesPerWellbeing);
  const report: CommuteReport = {
    residents,
    walks,
    excess,
    wellbeing: wellbeing === 0 ? 0 : wellbeing,
  };
  const toWater = waterWalks(content, state, residents);
  if (toWater) report.toWater = toWater;
  ctx.report.commute = report;
}

/** Where homes can fetch drinking water: water tiles, and the buildings that hold it. */
export function drinkingSources(
  content: Content,
  state: RunState,
): { at: { q: number; r: number }; source: string }[] {
  const sources: { at: { q: number; r: number }; source: string }[] = [];
  for (const t of Object.values(state.map.tiles))
    if (isWaterTile(t.type)) sources.push({ at: t, source: t.type });
  for (const b of Object.values(state.buildings))
    if (defOf(content, b).drinkingWater && !b.damage) sources.push({ at: b.at, source: b.type });
  return sources;
}

/** Each lived-in home's walk to water (step 4), or undefined while homes don't walk to water. */
export function waterWalks(
  content: Content,
  state: RunState,
  residents: Record<string, number>,
): WaterWalkReport | undefined {
  const rules = content.rules.commute.toWater;
  if (!rules || !walksToWater(content)) return undefined;
  const sources = drinkingSources(content, state);
  const homes: WaterWalkReport['homes'] = {};
  let excess = 0;
  for (const uid of Object.keys(residents).sort()) {
    const home = state.buildings[uid];
    if (!home || (residents[uid] ?? 0) === 0) continue;
    let best: { distance: number; source: string } | null = null;
    for (const s of sources) {
      const d = hexDistance(s.at, home.at);
      if (!best || d < best.distance) best = { distance: d, source: s.source };
    }
    if (!best) continue;
    homes[uid] = best;
    excess += Math.max(0, best.distance - rules.freeDistance);
  }
  const wellbeing = -Math.floor(excess / rules.tilesPerWellbeing);
  return { homes, excess, wellbeing: wellbeing === 0 ? 0 : wellbeing };
}
