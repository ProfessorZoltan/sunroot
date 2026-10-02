/** Read-only helpers over run state shared by commands and season resolution. */
import { formationHarmony, shelteredByFormation } from './combos';
import { edgeBuilding, hedged } from './edges';
import { finishedProjects } from './projects';
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
  for (const b of Object.values(state.buildings)) {
    map.set(hexKey(b.at), b);
    // A wonder covers the tiles around it as well.
    if (b.footprint) for (const n of hexNeighbors(b.at)) map.set(hexKey(n), b);
  }
  occupancyCache.set(state.buildings, { size, map });
  return map;
}

export function buildingAt(state: RunState, h: Hex): BuildingState | undefined {
  return Object.values(state.buildings).find(
    (b) =>
      (b.at.q === h.q && b.at.r === h.r) || (b.footprint && hexDistance(b.at, h) <= b.footprint),
  );
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
  // A wonder's own tiles are not its neighbours.
  if (b.footprint)
    return [
      ...new Set(
        hexNeighbors(b.at)
          .flatMap((n) => buildingsTouching(state, n, occ))
          .filter((x) => x !== b),
      ),
    ];
  return buildingsTouching(state, b.at, occ).filter((x) => x !== b);
}

/** Buildings on the tiles next to a hex. */
export function buildingsTouching(
  state: RunState,
  h: Hex,
  occ = occupancy(state),
): BuildingState[] {
  // A wonder touching a tile on two sides is still one neighbour.
  return [
    ...new Set(
      hexNeighbors(h)
        .map((n) => occ.get(hexKey(n)))
        .filter((x): x is BuildingState => x !== undefined),
    ),
  ];
}

export function neighborTiles(state: RunState, h: Hex): Tile[] {
  return hexNeighbors(h)
    .map((n) => tileAt(state, n))
    .filter((t): t is Tile => t !== undefined);
}

export function isHome(def: BuildingDef): boolean {
  return def.housing > 0;
}

/**
 * What repairing a damaged building costs in materials, or null when it needs
 * no repair (undamaged, or storm damage that clears by itself).
 */
export function repairCost(content: Content, b: BuildingState): number | null {
  if (!b.damage) return null;
  const cost = content.events[b.damage.cause].repairCost;
  return b.damage.cause === 'storm' && cost === 0 ? null : cost;
}

/** Whether a storm can damage this building: on exposed land, with no woodland beside it. */
export function stormExposed(content: Content, state: RunState, b: BuildingState): boolean {
  if (defOf(content, b).stormProof) return false;
  const type = tileAt(state, b.at)?.type;
  if (!type || !content.events.storm.exposedOn.includes(type)) return false;
  if (neighborTiles(state, b.at).some((t) => t.type === 'woodland')) return false;
  // A hedgerow next to it breaks the wind: one along an edge of its tile, or a hedgerow building
  // beside it; a Windbreak further.
  if (hedged(state, b.at)) return false;
  if (neighborBuildings(state, b).some((n) => defOf(content, n).sheltersNeighbors)) return false;
  return !shelteredByFormation(content, state, b);
}

/** Where a building stands, as a sentence says it: "on a hill", "on barren land". */
export function standsOn(type: TileType | undefined): string {
  const places: Partial<Record<TileType, string>> = {
    hill: 'on a hill',
    barren: 'on barren land',
    scrub: 'on scrub',
    meadow: 'in a meadow',
    floodplain: 'on the floodplain',
    woodland: 'in woodland',
    ruin: 'in a ruin',
  };
  return (type && places[type]) ?? 'in the open';
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
  // A building may make its tile count as another type (a Hedgerow on scrub counts as meadow).
  const asTile = new Map<string, TileType>();
  for (const b of Object.values(state.buildings)) {
    const t = defOf(content, b).harmonyAsTile;
    if (t) asTile.set(hexKey(b.at), t);
  }
  for (const t of Object.values(state.map.tiles)) {
    const type = asTile.get(hexKey(t)) ?? t.type;
    if (harmony.perTile[type]) tileCounts.set(type, (tileCounts.get(type) ?? 0) + 1);
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
  // Hedges along tile edges: 1 Harmony for every few segments.
  const hedge = edgeBuilding(content);
  const segments = state.hedges.length;
  if (hedge?.edge && segments >= hedge.edge.harmonyPer)
    lines.push({
      label: `${segments} hedge segment${segments > 1 ? 's' : ''}`,
      amount: Math.floor(segments / hedge.edge.harmonyPer),
    });
  for (const [name, e] of penalties) lines.push({ label: `${e.n} ${name}`, amount: e.amount });
  lines.push(...formationHarmony(content, state));
  if (harmony.bonus !== 0) lines.push({ label: 'Root City', amount: harmony.bonus });
  const grey = state.lastReport?.water?.greyToRiver ?? 0;
  if (grey > 0 && content.rules.water.enabled)
    lines.push({
      label: `${grey} grey water in the river`,
      amount: -grey * content.rules.water.greyHarmonyPerUnit,
    });
  for (const p of finishedProjects(content, state))
    if (p.effect.harmony !== 0) lines.push({ label: p.name, amount: p.effect.harmony });
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
