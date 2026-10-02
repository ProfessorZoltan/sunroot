import type { Content } from './content/load';
import { hexKey, type Hex } from './hex';
import { placementEvolution } from './combos';
import { buildingsTouching, neighborTiles, occupancy, tileAt } from './queries';
import type { RunState } from './types';
import { available, channelSiteProblem, isChannel } from './water';
import { contentFor } from './content/modifiers';

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
  if (!def.placeable) return { ok: false, reason: `${def.name} can't be built, only evolved` };
  if (!available(contentFor(content, state), def))
    return {
      ok: false,
      reason: def.requiresHeatLayer
        ? `${def.name} joins when energy can no longer heat buildings directly`
        : `${def.name} needs the water system`,
    };
  const tile = tileAt(state, at);
  if (!tile) return { ok: false, reason: 'outside the valley' };
  const occupant = occupancy(state).get(hexKey(at));
  if (occupant) {
    // Some buildings evolve when built over another (a solar canopy over a farm).
    if (placementEvolution(content, buildingId, occupant)) return { ok: true };
    return { ok: false, reason: 'tile already has a building' };
  }
  if (!def.placement.tiles.includes(tile.type)) {
    return { ok: false, reason: `${def.name} can't be built on ${tile.type}` };
  }
  if (tile.type === 'ruin' && (tile.salvage ?? 0) <= 0) {
    return { ok: false, reason: 'the ruin is empty' };
  }
  if (isChannel(def)) {
    const problem = channelSiteProblem(content, state, at);
    if (problem) return { ok: false, reason: problem };
  }
  const { adjacentTo, adjacentToBuildings = [] } = def.placement;
  if (adjacentTo) {
    const touchesTile = neighborTiles(state, at).some((n) => adjacentTo.includes(n.type));
    const touchesBuilding = buildingsTouching(state, at).some((n) =>
      adjacentToBuildings.includes(n.type),
    );
    if (!touchesTile && !touchesBuilding) {
      const names = [
        ...adjacentTo,
        ...adjacentToBuildings.map((id) => content.byId[id]?.name ?? id),
      ];
      return { ok: false, reason: `${def.name} must be next to ${names.join(' or ')}` };
    }
  }
  return { ok: true };
}
