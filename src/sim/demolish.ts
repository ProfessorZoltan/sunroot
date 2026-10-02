/**
 * Demolishing a building (not in the design; asked for in playtesting). The
 * work takes energy in this season's slot, paid like any demand. The building
 * leaves rubble: clutter, or salvage while a salvage yard stands. Flat land
 * becomes barren; hills, floodplain, river and ruins stay as they are. A weir's
 * reservoir becomes river again. Undo is free until the season ends, as ever.
 */
import type { Content } from './content/load';
import type { TileType } from './content/schema';
import { defOf, tileAt } from './queries';

/** A coppice, or a coppice growing back: woodland the player is working, not a building. */
function coppiced(content: Content, type: string): boolean {
  return content.combos.some(
    (c) =>
      c.layer === 'evolution' &&
      c.when.kind === 'coppiced' &&
      (c.into === type || c.when.regrowth === type),
  );
}
import type { RunState } from './types';

export interface DemolishCheck {
  ok: boolean;
  reason?: string;
  /** Energy the work takes, and in which slot. */
  energy: number;
  slot: 'day' | 'night';
  rubble: number;
  /** What the rubble becomes. */
  into: 'clutter' | 'salvage';
  /** What the tile becomes. */
  tile: TileType | null;
}

export function demolishCheck(content: Content, state: RunState, uid: string): DemolishCheck {
  const rules = content.rules.demolition;
  const b = state.buildings[uid];
  const none = {
    energy: rules.energy,
    slot: rules.slot,
    rubble: 0,
    into: 'clutter' as const,
    tile: null,
  };
  if (state.status !== 'active') return { ...none, ok: false, reason: 'the run is over' };
  if (!b) return { ...none, ok: false, reason: 'no building there' };
  if (b.type === content.campBuilding)
    return { ...none, ok: false, reason: "the Founders' Camp can't be demolished" };
  const def = defOf(content, b);
  if (coppiced(content, b.type))
    return { ...none, ok: false, reason: 'stop coppicing instead: the wood grows back' };
  const rubble = Math.max(1, Math.floor(def.cost * rules.rubbleShare));
  const salvaged = Object.values(state.buildings).some(
    (o) => o.uid !== uid && rules.salvagedBy.includes(o.type) && !o.damage,
  );
  const tile = tileAt(state, b.at);
  const type = tile ? (rules.keeps.includes(tile.type) ? tile.type : rules.tileBecomes) : null;
  return {
    ok: true,
    energy: rules.energy,
    slot: rules.slot,
    rubble,
    into: salvaged ? 'salvage' : 'clutter',
    tile: type,
  };
}

/** Carries out a demolition on a state the caller owns. Returns an error, or null. */
export function demolish(content: Content, s: RunState, uid: string): string | null {
  const check = demolishCheck(content, s, uid);
  if (!check.ok) return check.reason ?? "can't demolish that";
  const b = s.buildings[uid]!;
  const def = defOf(content, b);
  delete s.buildings[uid];
  s.priority = s.priority.filter((id) => id !== uid);
  // A loop that loses a building is broken at once.
  if (s.loops.some((l) => l.members.includes(uid)))
    s.loops = s.loops.filter((l) => !l.members.includes(uid));
  const tile = tileAt(s, b.at);
  if (tile && check.tile) tile.type = check.tile;
  if (def.weir) restoreRiver(content, s);
  s.stores[check.into] += check.rubble;
  return null;
}

/** Reservoir tiles that no standing weir holds back become river again. */
function restoreRiver(content: Content, s: RunState): void {
  const held = new Set<string>();
  for (const w of Object.values(s.buildings)) {
    const weir = defOf(content, w).weir;
    const index = tileAt(s, w.at)?.riverIndex;
    if (!weir || index === undefined) continue;
    for (const key of s.map.river) {
      const i = s.map.tiles[key]!.riverIndex ?? 0;
      if (i < index && i >= index - weir.reservoirTiles) held.add(key);
    }
  }
  for (const key of s.map.river) {
    const t = s.map.tiles[key]!;
    if (t.type === 'reservoir' && !held.has(key)) t.type = 'river';
  }
}
