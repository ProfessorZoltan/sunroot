import type { Content } from './content/load';
import { hexKey, type Hex } from './hex';
import { neighborTiles, occupancy, tileAt } from './queries';
import type { RunState } from './types';

export type PlacementCheck = { ok: true } | { ok: false; reason: string };

/**
 * Site rules only: terrain, adjacency and occupancy. Placing also needs the
 * blueprint unlocked and the materials to pay for it (see the place command).
 */
export function canPlace(
  content: Content,
  state: RunState,
  buildingId: string,
  at: Hex,
): PlacementCheck {
  const def = content.byId[buildingId];
  if (!def) return { ok: false, reason: `unknown building ${buildingId}` };
  const tile = tileAt(state, at);
  if (!tile) return { ok: false, reason: 'outside the valley' };
  if (occupancy(state).has(hexKey(at))) return { ok: false, reason: 'tile already has a building' };
  if (!def.placement.tiles.includes(tile.type)) {
    return { ok: false, reason: `${def.name} can't be built on ${tile.type}` };
  }
  if (tile.type === 'ruin' && (tile.salvage ?? 0) <= 0) {
    return { ok: false, reason: 'the ruin is empty' };
  }
  const adjacentTo = def.placement.adjacentTo;
  if (adjacentTo && !neighborTiles(state, at).some((n) => adjacentTo.includes(n.type))) {
    return { ok: false, reason: `${def.name} must be next to ${adjacentTo.join(' or ')}` };
  }
  return { ok: true };
}
