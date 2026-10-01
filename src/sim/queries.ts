/** Read-only helpers over run state shared by commands and season resolution. */
import { formationHarmony } from './combos';
import type { Content } from './content/load';
import type { BuildingDef, Season, TileType } from './content/schema';
import { SEASONS } from './content/schema';
import { hexDistance, hexKey, hexNeighbors, type Hex } from './hex';
import type { BuildingState, RunState, Tile } from './types';

export function defOf(content: Content, b: BuildingState): BuildingDef {
  const def = content.byId[b.type];
  if (!def) throw new Error(`unknown building type ${b.type}`);
  return def;
}

export function seasonIndex(season: Season): number {
  return SEASONS.indexOf(season);
}

export function tileAt(state: RunState, h: Hex): Tile | undefined {
  return state.map.tiles[hexKey(h)];
}

const occupancyCache = new WeakMap<object, { size: number; map: Map<string, BuildingState> }>();

/**
 * Buildings by tile key. Cached per buildings object: buildings are only ever
 * added, never removed or moved, so the cache is valid while the count holds.
 */
export function occupancy(state: RunState): Map<string, BuildingState> {
  const size = Object.keys(state.buildings).length;
  const cached = occupancyCache.get(state.buildings);
  if (cached && cached.size === size) return cached.map;
  const map = new Map<string, BuildingState>();
  for (const b of Object.values(state.buildings)) map.set(hexKey(b.at), b);
  occupancyCache.set(state.buildings, { size, map });
  return map;
}

export function buildingAt(state: RunState, h: Hex): BuildingState | undefined {
  return Object.values(state.buildings).find((b) => b.at.q === h.q && b.at.r === h.r);
}

/** Buildings in priority order, highest first. */
export function byPriority(state: RunState): BuildingState[] {
  return state.priority.map((uid) => state.buildings[uid]!).filter(Boolean);
}

export function neighborBuildings(
  state: RunState,
  b: BuildingState,
  occ = occupancy(state),
): BuildingState[] {
  return buildingsTouching(state, b.at, occ);
}

/** Buildings on the tiles next to a hex. */
export function buildingsTouching(
  state: RunState,
  h: Hex,
  occ = occupancy(state),
): BuildingState[] {
  return hexNeighbors(h)
    .map((n) => occ.get(hexKey(n)))
    .filter((x): x is BuildingState => x !== undefined);
}

export function neighborTiles(state: RunState, h: Hex): Tile[] {
  return hexNeighbors(h)
    .map((n) => tileAt(state, n))
    .filter((t): t is Tile => t !== undefined);
}

export function isHome(def: BuildingDef): boolean {
  return def.housing > 0;
}

export function isWaterTile(type: TileType): boolean {
  return type === 'river' || type === 'reservoir';
}

/** Distance from a hex to the nearest river, reservoir or pond. */
export function waterDistance(content: Content, state: RunState, h: Hex): number {
  let best = Infinity;
  for (const t of Object.values(state.map.tiles)) {
    if (isWaterTile(t.type)) best = Math.min(best, hexDistance(h, t));
  }
  for (const b of Object.values(state.buildings)) {
    if (defOf(content, b).waterBody) best = Math.min(best, hexDistance(h, b.at));
  }
  return best;
}

export function housingCapacity(content: Content, state: RunState): number {
  return Object.values(state.buildings).reduce((sum, b) => sum + defOf(content, b).housing, 0);
}

export function foodStorage(content: Content, state: RunState): number {
  return Object.values(state.buildings).reduce((sum, b) => sum + defOf(content, b).foodStorage, 0);
}

export function eraOf(content: Content, turn: number): number {
  const year = Math.floor(turn / 4) + 1;
  return Math.min(
    content.rules.eras.length,
    Math.floor((year - 1) / content.rules.yearsPerEra) + 1,
  );
}

export interface HarmonyLine {
  label: string;
  amount: number;
}

/** Where Harmony comes from: green tiles, buildings, wind spires and clutter. */
export function harmonyLines(content: Content, state: RunState): HarmonyLine[] {
  const { harmony } = content.rules;
  const lines: HarmonyLine[] = [];
  const tileCounts = new Map<string, number>();
  for (const t of Object.values(state.map.tiles)) {
    if (harmony.perTile[t.type]) tileCounts.set(t.type, (tileCounts.get(t.type) ?? 0) + 1);
  }
  for (const [type, n] of tileCounts) {
    const each = harmony.perTile[type as TileType]!;
    lines.push({ label: `${n} ${type} tiles${each !== 1 ? ` × ${each}` : ''}`, amount: n * each });
  }
  const byBuilding = new Map<string, { n: number; amount: number }>();
  const penalties = new Map<string, { n: number; amount: number }>();
  const occ = occupancy(state);
  for (const b of Object.values(state.buildings)) {
    const def = defOf(content, b);
    if (def.harmony) {
      const e = byBuilding.get(def.name) ?? { n: 0, amount: 0 };
      byBuilding.set(def.name, { n: e.n + 1, amount: e.amount + def.harmony });
    }
    if (def.harmonyPenalty) {
      const cancelled = neighborBuildings(state, b, occ).some((n) =>
        def.harmonyPenalty!.cancelledByNeighbor.includes(n.type),
      );
      if (!cancelled) {
        const e = penalties.get(def.name) ?? { n: 0, amount: 0 };
        penalties.set(def.name, { n: e.n + 1, amount: e.amount - def.harmonyPenalty.amount });
      }
    }
  }
  for (const [name, e] of byBuilding) lines.push({ label: `${e.n} ${name}`, amount: e.amount });
  for (const [name, e] of penalties) lines.push({ label: `${e.n} ${name}`, amount: e.amount });
  lines.push(...formationHarmony(content, state));
  if (state.stores.clutter > 0) {
    lines.push({
      label: `${state.stores.clutter} clutter`,
      amount: harmony.perClutter * state.stores.clutter,
    });
  }
  return lines;
}

/** Harmony = green tiles + building Harmony - wind spire penalties - clutter (never below 0). */
export function computeHarmony(content: Content, state: RunState): number {
  return Math.max(
    0,
    harmonyLines(content, state).reduce((sum, l) => sum + l.amount, 0),
  );
}

export function harmonyMultiplier(content: Content, harmony: number): number {
  let multiplier = 1;
  for (const tier of content.rules.harmony.tiers)
    if (harmony >= tier.min) multiplier = tier.multiplier;
  return multiplier;
}

/** Improve a land tile along the land-health ladder; returns true if it changed. */
export function improveTile(content: Content, tile: Tile, steps: number, cap?: TileType): boolean {
  const ladder = content.rules.landHealth;
  const at = ladder.indexOf(tile.type);
  if (at < 0) return false;
  const top = cap ? ladder.indexOf(cap) : ladder.length - 1;
  const next = Math.min(at + steps, top);
  if (next <= at) return false;
  tile.type = ladder[next]!;
  return true;
}
