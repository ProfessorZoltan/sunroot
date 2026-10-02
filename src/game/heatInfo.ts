/**
 * Local heat for the interface (in a Long Winter): which source warms which
 * building this season, from the season's heat links.
 */
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import type { HeatLink, RunState } from '../sim/types';

const GRID = 'grid';

function nameOf(content: Content, state: RunState, uid: string): string {
  return content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'a building since removed';
}

/** Lines about the heat given or received by the building on this tile. */
export function heatAt(
  content: Content,
  state: RunState,
  links: HeatLink[] | null,
  at: Hex,
): string[] {
  if (!links) return [];
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === hexKey(at));
  if (!b) return [];
  const rules = content.rules.localHeat;
  const lines: string[] = [];
  const got = links.filter((l) => l.to === b.uid);
  if (got.length > 0) {
    const parts = got.map((l) =>
      l.from === GRID
        ? `${l.amount} ${l.slot === 'night' ? 'at night ' : ''}from the grid (${rules.gridHeatCost} energy each)`
        : `${l.amount} ${l.slot === 'night' ? 'at night ' : ''}from the ${nameOf(content, state, l.from)}`,
    );
    lines.push(`Heat: ${parts.join(', ')}.`);
  }
  const gave = links.filter((l) => l.from === b.uid);
  const def = content.byId[b.type];
  const isSource =
    def?.heatPump !== undefined ||
    def?.heatGeneration !== undefined ||
    def?.storage?.holds === 'heat';
  if (isSource) {
    const total = gave.reduce((s, l) => s + l.amount, 0);
    const to = [...new Set(gave.map((l) => nameOf(content, state, l.to)))];
    lines.push(
      total > 0
        ? `Warms ${to.join(', ')}: ${total} heat this season (it reaches ${rules.range} tiles).`
        : `Warms nothing this season: nothing within ${rules.range} tiles needs its heat.`,
    );
  }
  return lines;
}

/** A source's heat to a building, for the map to draw. */
export interface HeatLine {
  from: Hex;
  to: Hex;
  amount: number;
}

/** The heat to and from the building `uid` (the grid has no place on the map). */
export function heatLines(
  state: RunState,
  links: HeatLink[] | null,
  uid: string | null,
): HeatLine[] {
  if (!links || !uid || !state.buildings[uid]) return [];
  const lines = new Map<string, HeatLine>();
  for (const l of links) {
    if (l.from === GRID || (l.from !== uid && l.to !== uid)) continue;
    const from = state.buildings[l.from];
    const to = state.buildings[l.to];
    if (!from || !to) continue;
    const key = `${l.from}>${l.to}`;
    const line = lines.get(key);
    if (line) line.amount += l.amount;
    else lines.set(key, { from: from.at, to: to.at, amount: l.amount });
  }
  return [...lines.values()];
}

/** The season report's lines on local heat. */
export function heatNotes(content: Content, state: RunState, links: HeatLink[]): string[] {
  const cost = content.rules.localHeat.gridHeatCost;
  const fromGrid = links.filter((l) => l.from === GRID).reduce((s, l) => s + l.amount, 0);
  const bySource = new Map<string, number>();
  for (const l of links)
    if (l.from !== GRID) bySource.set(l.from, (bySource.get(l.from) ?? 0) + l.amount);
  const lines = [...bySource].map(
    ([uid, n]) => `The ${nameOf(content, state, uid)} warmed buildings near it with ${n} heat.`,
  );
  lines.push(
    fromGrid > 0
      ? `${fromGrid} heat bought from the grid, at ${cost} energy each (${fromGrid * (cost - 1)} energy more than heat from a source).`
      : 'No heat bought from the grid.',
  );
  return lines;
}
