/**
 * Cooling for the interface (the Sun Desert): which wind tower or absorption
 * chiller cools which home this season, what the grid pays, and which homes
 * went hot. Heat's mirror (heatInfo.ts), from the season's cooling links.
 */
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import type { HeatLink, RunState } from '../sim/types';

const GRID = 'grid';

function nameOf(content: Content, state: RunState, uid: string): string {
  return content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'a building since removed';
}

/** Lines about the cooling given or received by the building on this tile. */
export function coolAt(
  content: Content,
  state: RunState,
  links: HeatLink[] | null,
  at: Hex,
  /** Homes shut off hot this season (no grid cooling). */
  hot?: string[],
): string[] {
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === hexKey(at));
  if (!b) return [];
  const rules = content.rules.cooling;
  const lines: string[] = [];
  if (hot?.includes(b.uid))
    lines.push(`Hot: nothing within ${rules.range} tiles cooled it, so it is shut off.`);
  const got = (links ?? []).filter((l) => l.to === b.uid);
  if (got.length > 0) {
    const parts = got.map((l) =>
      l.from === GRID
        ? `${l.amount} from the grid (${rules.gridCoolCost} energy each)`
        : `${l.amount} from the ${nameOf(content, state, l.from)}`,
    );
    lines.push(`Cooling on hot days: ${parts.join(', ')}.`);
  }
  const def = content.byId[b.type];
  if (def?.cooling || def?.chiller) {
    const gave = (links ?? []).filter((l) => l.from === b.uid);
    const total = gave.reduce((s, l) => s + l.amount, 0);
    const to = [...new Set(gave.map((l) => nameOf(content, state, l.to)))];
    lines.push(
      total > 0
        ? `Cools ${to.join(', ')}: ${total} this season (it reaches ${rules.range} tiles).`
        : `Cools nothing this season: nothing within ${rules.range} tiles needs cooling.`,
    );
  }
  return lines;
}

/** The season's cooling in a few sentences, for the season report. */
export function coolNotes(
  content: Content,
  state: RunState,
  links: HeatLink[],
  hot: string[],
): string[] {
  const rules = content.rules.cooling;
  const bySource = new Map<string, number>();
  let fromGrid = 0;
  for (const l of links) {
    if (l.from === GRID) fromGrid += l.amount;
    else bySource.set(l.from, (bySource.get(l.from) ?? 0) + l.amount);
  }
  const lines = [...bySource].map(
    ([uid, n]) => `The ${nameOf(content, state, uid)} cooled homes near it by ${n}.`,
  );
  if (rules.gridCool)
    lines.push(
      fromGrid > 0
        ? `${fromGrid} cooling bought from the grid, at ${rules.gridCoolCost} energy each: a wind tower or shade costs nothing to run.`
        : 'No cooling bought from the grid.',
    );
  if (hot.length > 0)
    lines.push(`Hot, shut off: ${hot.map((uid) => nameOf(content, state, uid)).join(', ')}.`);
  return lines;
}

/** Energy the grid spent cooling each building this season, by slot (for the resolution). */
export function gridCooling(content: Content, links: HeatLink[] | null) {
  const cost = content.rules.cooling.gridCoolCost;
  const out = new Map<string, Record<'day' | 'night', number>>();
  for (const l of links ?? []) {
    if (l.from !== GRID) continue;
    const e = out.get(l.to) ?? { day: 0, night: 0 };
    e[l.slot] += l.amount * cost;
    out.set(l.to, e);
  }
  return out;
}
