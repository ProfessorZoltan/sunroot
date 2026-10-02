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
 */
import { hexDistance } from '../hex';
import { byPriority, defOf, isHome } from '../queries';
import type { CommuteReport, Walk } from '../types';
import type { SeasonContext } from './context';

export function assignCommutes(ctx: SeasonContext): void {
  const { content, state } = ctx;
  const rules = content.rules.commute;
  if (!rules.enabled) return;
  const order = byPriority(state);
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
  ctx.report.commute = report;
}
