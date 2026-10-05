/**
 * What would go short if the season ended now (asked for in playtesting): which buildings would
 * be shut off for want of power, heat or cooling, and which would get too little water. Read
 * from the season's preview, so it changes as the player builds.
 */
import { SEASONS, type Content, type RunState, type SeasonReport } from '../sim';

export type Need = 'power' | 'heat' | 'water' | 'cooling';
export const NEEDS: Need[] = ['power', 'heat', 'water', 'cooling'];

export interface Shortfall {
  uid: string;
  needs: Need[];
  /** One line for each need, for a tooltip or a list. */
  lines: string[];
}

/** Every building that would be short of something, in priority order. */
export function shortfalls(content: Content, state: RunState, report: SeasonReport): Shortfall[] {
  const si = SEASONS.indexOf(state.season);
  const cold = new Set(report.cold);
  const hot = new Set(report.hot ?? []);
  const out: Shortfall[] = [];
  for (const uid of state.priority) {
    const b = state.buildings[uid];
    if (!b) continue;
    const def = content.byId[b.type];
    if (!def) continue;
    const needs: Need[] = [];
    const lines: string[] = [];
    const wants = (kind: 'heat' | 'cool') =>
      (['day', 'night'] as const).some((slot) => (def.demand?.[kind][slot][si] ?? 0) > 0);
    if (cold.has(uid)) {
      needs.push('heat');
      lines.push('No heat source reaches it: shut off cold.');
    } else if (hot.has(uid)) {
      needs.push('cooling');
      lines.push('Nothing cools it: shut off hot.');
    } else if (report.blackouts.includes(uid)) {
      needs.push('power');
      // With heat or cooling paid from the grid, a blackout leaves it without those too.
      const also = [...(wants('heat') ? ['heat'] : []), ...(wants('cool') ? ['cooling'] : [])];
      if (wants('heat')) needs.push('heat');
      if (wants('cool')) needs.push('cooling');
      lines.push(
        `Not enough energy: shut off in the blackout${also.length > 0 ? `, so no ${also.join(' or ')} from the grid either` : ''}.`,
      );
    }
    const water = report.water?.uses[uid];
    if (water?.short) {
      needs.push('water');
      const got = Object.values(water.got).reduce((n, x) => n + x, 0);
      lines.push(
        water.from === null
          ? `No water within reach: it needs ${water.need} and gets none.`
          : `Short of water: it needs ${water.need} and gets ${got}.`,
      );
    }
    if (needs.length > 0) out.push({ uid, needs, lines });
  }
  return out;
}

/** The buildings short of one need (or of anything). */
export function shortOf(list: Shortfall[], need: Need | 'any'): Shortfall[] {
  return need === 'any' ? list : list.filter((s) => s.needs.includes(need));
}
