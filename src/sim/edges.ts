/**
 * Edges between tiles, for buildings that run along borders rather than
 * stand on tiles (the Hedgerow; DECISIONS.md, Hedgerows on edges). An edge is
 * named by the two tiles it lies between; its two ends are the corners it
 * shares with the two tiles next to both. Edges that share an end are joined.
 */
import type { Content } from './content/load';
import type { BuildingDef } from './content/schema';
import { hexDistance, hexKey, hexNeighbors, parseHexKey, type Hex } from './hex';
import { tileAt } from './queries';
import type { RunState } from './types';
import { available } from './water';

/** An edge's key: the two tiles' keys, in order, joined by `|`. */
export function edgeKey(a: Hex, b: Hex): string {
  const [x, y] = [hexKey(a), hexKey(b)].sort();
  return `${x}|${y}`;
}

/** The two tiles an edge lies between. */
export function edgeTiles(key: string): [Hex, Hex] {
  const [a, b] = key.split('|');
  return [parseHexKey(a!), parseHexKey(b!)];
}

/** The six edges around a tile. */
export function edgesAround(h: Hex): string[] {
  return hexNeighbors(h).map((n) => edgeKey(h, n));
}

/** An edge's two ends: each the corner shared with one of the two tiles next to both. */
export function edgeEnds(key: string): [string, string] {
  const [a, b] = edgeTiles(key);
  const common = hexNeighbors(a).filter((n) => hexDistance(n, b) === 1);
  const corner = (c: Hex) => [hexKey(a), hexKey(b), hexKey(c)].sort().join('/');
  return [corner(common[0]!), corner(common[1]!)];
}

/** The building that runs along edges in this content (the Hedgerow), if any. */
export function edgeBuilding(content: Content): BuildingDef | undefined {
  return content.buildings.find((b) => b.edge !== undefined);
}

/** Why a hedge can't be planted between these tiles, or null if it can. */
export function hedgeProblem(content: Content, state: RunState, a: Hex, b: Hex): string | null {
  const def = edgeBuilding(content);
  if (!def || !available(content, def)) return 'hedgerows need the water system';
  if (hexDistance(a, b) !== 1) return 'a hedge runs between two tiles side by side';
  const ta = tileAt(state, a);
  const tb = tileAt(state, b);
  if (!ta || !tb) return 'a hedge runs between two tiles of the valley';
  for (const t of [ta, tb])
    if (!def.placement.tiles.includes(t.type)) return `a hedge can't border ${t.type}`;
  if (state.hedges.includes(edgeKey(a, b))) return 'there is a hedge there already';
  return null;
}

/** Runs of joined hedges: each a list of edge keys (any shape, not only straight). */
export function hedgeRuns(state: RunState): string[][] {
  const byEnd = new Map<string, string[]>();
  for (const e of state.hedges)
    for (const end of edgeEnds(e)) byEnd.set(end, [...(byEnd.get(end) ?? []), e]);
  const seen = new Set<string>();
  const runs: string[][] = [];
  for (const start of state.hedges) {
    if (seen.has(start)) continue;
    const run: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const e = queue.shift()!;
      run.push(e);
      for (const end of edgeEnds(e))
        for (const next of byEnd.get(end) ?? [])
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
    }
    runs.push(run.sort());
  }
  return runs;
}

/** Whether a tile has a hedge along any of its edges. */
export function hedged(state: RunState, h: Hex): boolean {
  return edgesAround(h).some((e) => state.hedges.includes(e));
}
