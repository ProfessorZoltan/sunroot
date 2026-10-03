/**
 * Biome wonders (EXPANSION.md, E5): Willow Reach's is the Great Water Garden.
 *
 * A wonder is one building over a flower of 7 tiles: its own (the centre) and
 * the 6 around it. It can be started once a run, from its era, once the run
 * has the loops and buildings it needs; it is paid for at once and takes its
 * seasons to build. Finished, it adds to the score and raises the Graft.
 */
import type { Content } from './content/load';
import type { BuildingDef, Resource } from './content/schema';
import { hexKey, hexNeighbors, type Hex } from './hex';
import { defOf, occupancy, tileAt } from './queries';
import type { BuildingState, RunState } from './types';
import { available, isChannel } from './water';
import { edgeKey } from './edges';

/** The wonders this content has. */
export function wonders(content: Content): BuildingDef[] {
  return content.buildings.filter((d) => d.wonder && available(content, d));
}

/** The 7 tiles of a wonder centred at `at`: the centre first, then its neighbours. */
export function flower(at: Hex): Hex[] {
  return [at, ...hexNeighbors(at)];
}

/** The wonder of this type in the run, if it has been started. */
export function wonderOf(state: RunState, id: string): BuildingState | undefined {
  return Object.values(state.buildings).find((b) => b.type === id);
}

/** Seasons built so far (0 while its first season is under way), and whether it is finished. */
export function wonderProgress(
  def: BuildingDef,
  b: BuildingState,
  state: RunState,
): { built: number; seasons: number; done: boolean } {
  const seasons = def.wonder?.seasons ?? 0;
  if (b.finished !== undefined) return { built: seasons, seasons, done: true };
  return { built: Math.min(seasons - 1, state.turn - b.builtTurn), seasons, done: false };
}

/** Whether a building is a finished wonder (or not a wonder at all: then it simply stands). */
export function wonderDone(content: Content, state: RunState, b: BuildingState): boolean {
  const def = defOf(content, b);
  return !def.wonder || wonderProgress(def, b, state).done;
}

/** The construction stage to draw: 1 to 3 while building, null once finished. */
export function wonderStage(content: Content, state: RunState, b: BuildingState): number | null {
  const def = defOf(content, b);
  if (!def.wonder) return null;
  const p = wonderProgress(def, b, state);
  return p.done ? null : Math.min(3, p.built + 1);
}

/** Finished wonders' score lines and Graft lift. */
export function finishedWonders(content: Content, state: RunState): BuildingDef[] {
  return Object.values(state.buildings)
    .map((b) => ({ b, def: content.byId[b.type] }))
    .filter(({ b, def }) => def?.wonder && wonderProgress(def, b, state).done)
    .map(({ def }) => def!);
}

/** What the run still needs before the wonder can be started, or null if nothing. */
export function wonderNeeds(content: Content, state: RunState, def: BuildingDef): string | null {
  const w = def.wonder;
  if (!w) return null;
  if (wonderOf(state, def.id)) return `the ${def.name} is already started`;
  if (state.era < def.minEra && !state.options.sandbox)
    return `the ${def.name} can be started from era ${def.minEra}`;
  const missing: string[] = [];
  for (const id of w.needsLoops) {
    if (!state.loops.some((l) => l.combo === id))
      missing.push(`a closed ${content.comboById[id]?.name ?? id}`);
  }
  for (const [id, n] of Object.entries(w.needsBuildings)) {
    const have = Object.values(state.buildings).filter((b) => b.type === id).length;
    if (have < n) {
      const name = (content.byId[id]?.name ?? id).toLowerCase();
      missing.push(`${n} ${name}s (${have} now)`);
    }
  }
  return missing.length > 0 ? `the ${def.name} needs ${missing.join(' and ')}` : null;
}

/** Why the wonder can't be centred here, or null if it can (site rules only). */
export function wonderSiteProblem(
  content: Content,
  state: RunState,
  def: BuildingDef,
  at: Hex,
): string | null {
  const occ = occupancy(state);
  const tiles = flower(at);
  for (const h of tiles) {
    const t = tileAt(state, h);
    if (!t) return `the ${def.name} needs all 7 of its tiles inside the valley`;
    if (occ.has(hexKey(h))) return `the ${def.name} needs 7 free tiles`;
    if (!def.placement.tiles.includes(t.type))
      return `the ${def.name} can't be built over ${t.type}`;
  }
  for (const type of def.wonder?.mustInclude ?? [])
    if (!tiles.some((h) => tileAt(state, h)?.type === type))
      return `the ${def.name} needs ${type} among its 7 tiles`;
  // A hedge running between two of its tiles is in the way.
  const keys = new Set(tiles.map(hexKey));
  for (const h of tiles)
    for (const n of hexNeighbors(h))
      if (keys.has(hexKey(n)) && state.hedges.includes(edgeKey(h, n)))
        return `a hedge runs through where the ${def.name} would go`;
  if (def.wonder?.nearWater) {
    const wet = tiles.some((h) =>
      hexNeighbors(h).some((n) => {
        if (keys.has(hexKey(n))) return false;
        const t = tileAt(state, n);
        const b = occ.get(hexKey(n));
        return (
          t?.type === 'river' ||
          t?.type === 'reservoir' ||
          (b !== undefined && isChannel(defOf(content, b)))
        );
      }),
    );
    if (!wet) return `the ${def.name} must touch the river, a reservoir or a channel`;
  }
  return null;
}

/** Pays a wonder's costs beyond materials; returns what it couldn't pay for, or null. */
export function wonderExtraCost(def: BuildingDef): [Resource, number][] {
  return Object.entries(def.wonder?.alsoCosts ?? {}) as [Resource, number][];
}

/** Wonders that come into reach at the start of their era join the palette. */
export function unlockWonders(content: Content, state: RunState): string[] {
  const added: string[] = [];
  for (const def of wonders(content)) {
    if (!def.placeable || state.unlocked.includes(def.id) || state.era < def.minEra) continue;
    state.unlocked = [...state.unlocked, def.id];
    added.push(def.id);
  }
  return added;
}

/** One line on what a wonder needs, costs and gives, for notices and the interface. */
export function wonderBrief(content: Content, id: string): string {
  const def = content.byId[id]!;
  const w = def.wonder!;
  const needs = [
    ...w.needsLoops.map((l) => `a closed ${content.comboById[l]?.name ?? l}`),
    ...Object.entries(w.needsBuildings).map(
      ([b, n]) => `${n} ${(content.byId[b]?.name ?? b).toLowerCase()}s`,
    ),
  ];
  const cost = [
    `${def.cost} materials`,
    ...wonderExtraCost(def).map(([res, n]) => `${n} ${res}`),
  ].join(', ');
  const lift =
    w.graftTiers > 0
      ? ` and the Graft ${w.graftTiers > 1 ? `${w.graftTiers} tiers` : 'a tier'} higher`
      : '';
  return `7 tiles, ${w.seasons} seasons to build, ${cost}${needs.length ? `; it needs ${needs.join(' and ')}` : ''}. Finished: +${w.score} to the score${lift}.`;
}
