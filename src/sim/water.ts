/**
 * The water system's shape on the map (EXPANSION.md, Water system): which
 * buildings are channel, the channels as paths from their intake down, the
 * lakes, and where a new tile of channel may go. The season's flow is
 * resolved in season/water.ts.
 */
import type { Content } from './content/load';
import type { BuildingDef } from './content/schema';
import { hexDistance, hexKey, hexNeighbors, type Hex } from './hex';
import { defOf, occupancy, tileAt } from './queries';
import type { BuildingState, RunState, Tile } from './types';

/** Whether the water system is on (EXPANSION.md: off in the game until it can be seen, E2). */
export function waterOn(content: Content): boolean {
  return content.rules.water.enabled;
}

export function isChannel(def: BuildingDef): boolean {
  return def.water?.channel ?? false;
}

/** Whether a building exists in this content: water buildings only while water is on. */
export function available(content: Content, def: BuildingDef): boolean {
  // The Air-source Heat Pump joins with the heat layer (no heat from the grid).
  if (def.requiresHeatLayer && content.rules.localHeat.gridHeat) return false;
  return !def.requiresWater || waterOn(content);
}

/** A lake: still water off the river (an oxbow lake), named by its first tile's key. */
export function lakeTiles(state: RunState): Map<string, Tile[]> {
  const isLake = (t: Tile | undefined) =>
    t !== undefined && t.type === 'reservoir' && t.riverIndex === undefined;
  const lakes = new Map<string, Tile[]>();
  const seen = new Set<string>();
  const keys = Object.keys(state.map.tiles)
    .filter((k) => isLake(state.map.tiles[k]))
    .sort();
  for (const start of keys) {
    if (seen.has(start)) continue;
    const tiles: Tile[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const key = queue.shift()!;
      const t = state.map.tiles[key]!;
      tiles.push(t);
      for (const n of hexNeighbors(t)) {
        const k = hexKey(n);
        if (!seen.has(k) && isLake(state.map.tiles[k])) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    tiles.sort((a, b) => hexKey(a).localeCompare(hexKey(b)));
    lakes.set(hexKey(tiles[0]!), tiles);
  }
  return lakes;
}

/** The lake each lake tile belongs to. */
export function lakeOf(lakes: Map<string, Tile[]>): Map<string, string> {
  const of = new Map<string, string>();
  for (const [id, tiles] of lakes) for (const t of tiles) of.set(hexKey(t), id);
  return of;
}

/** River positions next to a hex (river and reservoir tiles on the river). */
export function riverIndexesNear(state: RunState, h: Hex): number[] {
  return hexNeighbors(h)
    .map((n) => tileAt(state, n)?.riverIndex)
    .filter((i): i is number => i !== undefined);
}

/** The first lake (by id) next to a hex, if any. */
export function lakeNear(state: RunState, h: Hex, of: Map<string, string>): string | null {
  const ids = hexNeighbors(h)
    .map((n) => of.get(hexKey(n)))
    .filter((id): id is string => id !== undefined)
    .sort();
  return ids[0] ?? null;
}

export type Intake = { river: number } | { lake: string } | null;

export interface Channel {
  /** Channel tiles' building uids, from the intake down. */
  uids: string[];
  /** Their tile keys, in the same order. */
  keys: string[];
  /** Where it draws its water; null for a channel that touches no water at its ends. */
  intake: Intake;
  /** The river position its far end returns leftovers to, or null (they're lost). */
  rejoinsAt: number | null;
}

/**
 * Every channel: each connected run of channel tiles, as a path from its
 * intake. The intake is the end next to the river (the most upstream, if both
 * are), else an end next to a lake. `include` limits which tiles count (a
 * damaged tile breaks its channel).
 */
export function channels(
  content: Content,
  state: RunState,
  include: (b: BuildingState) => boolean = () => true,
): Channel[] {
  const tiles = new Map<string, BuildingState>();
  for (const b of Object.values(state.buildings)) {
    if (isChannel(defOf(content, b)) && include(b)) tiles.set(hexKey(b.at), b);
  }
  const of = lakeOf(lakeTiles(state));
  const links = (key: string) =>
    hexNeighbors(tiles.get(key)!.at)
      .map(hexKey)
      .filter((k) => tiles.has(k));
  const seen = new Set<string>();
  const result: Channel[] = [];
  for (const start of [...tiles.keys()].sort()) {
    if (seen.has(start)) continue;
    // The connected run of channel containing `start`.
    const group: string[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length > 0) {
      const key = queue.shift()!;
      group.push(key);
      for (const k of links(key)) {
        if (!seen.has(k)) {
          seen.add(k);
          queue.push(k);
        }
      }
    }
    const ends = group.filter((k) => links(k).length <= 1).sort();
    if (ends.length === 0) ends.push([...group].sort()[0]!);
    const riverAt = (k: string) => {
      const near = riverIndexesNear(state, tiles.get(k)!.at);
      return near.length > 0 ? Math.min(...near) : null;
    };
    let first = ends.find((k) => riverAt(k) !== null);
    for (const k of ends) {
      const i = riverAt(k);
      if (i !== null && i < riverAt(first!)!) first = k;
    }
    let intake: Intake = null;
    if (first !== undefined) intake = { river: riverAt(first)! };
    else {
      first = ends.find((k) => lakeNear(state, tiles.get(k)!.at, of) !== null);
      if (first !== undefined) intake = { lake: lakeNear(state, tiles.get(first)!.at, of)! };
      else first = ends[0]!;
    }
    // Walk the path from the intake end.
    const path = [first];
    const onPath = new Set(path);
    for (;;) {
      const next = links(path.at(-1)!)
        .filter((k) => !onPath.has(k))
        .sort()[0];
      if (next === undefined) break;
      path.push(next);
      onPath.add(next);
    }
    const last = tiles.get(path.at(-1)!)!;
    const back = riverIndexesNear(state, last.at);
    let rejoinsAt = back.length > 0 ? Math.max(...back) : null;
    if (rejoinsAt !== null && intake && 'river' in intake)
      rejoinsAt = Math.max(rejoinsAt, intake.river);
    result.push({
      uids: path.map((k) => tiles.get(k)!.uid),
      keys: path,
      intake,
      rejoinsAt,
    });
  }
  return result;
}

/**
 * Where a tile of channel may go: next to the river or a reservoir (starting
 * a channel), or at the end of exactly one channel (extending it). Channels
 * don't branch, and two channels never join.
 */
export function channelSiteProblem(content: Content, state: RunState, at: Hex): string | null {
  const occ = occupancy(state);
  const touching = hexNeighbors(at)
    .map((n) => occ.get(hexKey(n)))
    .filter((b): b is BuildingState => b !== undefined && isChannel(defOf(content, b)));
  if (touching.length === 0) {
    const water = hexNeighbors(at).some((n) => {
      const type = tileAt(state, n)?.type;
      return type === 'river' || type === 'reservoir';
    });
    return water ? null : 'a new channel must start next to the river or a reservoir';
  }
  if (touching.length > 1) return 'channels can only be extended from one end, not joined';
  const end = touching[0]!;
  const links = hexNeighbors(end.at).filter((n) => {
    const b = occ.get(hexKey(n));
    return b !== undefined && isChannel(defOf(content, b));
  }).length;
  return links <= 1 ? null : 'a channel can only be extended from its end';
}

/** A channel path from a tile next to the river towards `goal`, for the Founders' Camp. */
export function campChannelPath(
  content: Content,
  state: RunState,
  goal: Hex,
  length: number,
): Hex[] {
  const def = content.byId[content.rules.water.channelBuilding]!;
  const occ = occupancy(state);
  const free = (h: Hex) => {
    const t = tileAt(state, h);
    return (
      t !== undefined &&
      def.placement.tiles.includes(t.type) &&
      !occ.has(hexKey(h)) &&
      !(h.q === goal.q && h.r === goal.r)
    );
  };
  const distance = hexDistance;
  const starts = Object.values(state.map.tiles)
    .filter((t) => free(t) && riverIndexesNear(state, t).length > 0)
    .sort((a, b) => distance(a, goal) - distance(b, goal) || hexKey(a).localeCompare(hexKey(b)));
  const start = starts[0];
  if (!start || length === 0) return [];
  const path: Hex[] = [{ q: start.q, r: start.r }];
  const taken = (h: Hex) => path.some((p) => p.q === h.q && p.r === h.r);
  while (path.length < length) {
    const end = path.at(-1)!;
    const next = hexNeighbors(end)
      .filter((n) => free(n) && !taken(n))
      // Stay a simple path: the new tile touches only the current end.
      .filter((n) => path.filter((p) => distance(p, n) === 1).length === 1)
      .sort((a, b) => distance(a, goal) - distance(b, goal) || hexKey(a).localeCompare(hexKey(b)));
    if (next.length === 0 || distance(next[0]!, goal) === 0) break;
    path.push(next[0]!);
  }
  return path;
}
