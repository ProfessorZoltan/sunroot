/**
 * Milestone 3's "every building is placeable with correct rules": on real
 * generated maps, each of the biome's buildings has a legal site, and placing
 * it there works. The map only ever offers what the simulation allows.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, canPlace, createRun, hexKey, type RunState } from '../src/sim';
import { content } from './helpers';

// Evolved buildings (Milestone 6) are never placed; they come from evolutions.
// Water buildings exist only while the water system is on (tests/water.test.ts places them).
const ORDER = content.buildings
  .filter((b) => b.placeable && b.id !== content.campBuilding && !b.requiresWater)
  .map((b) => b.id);

/** Places a weir where its reservoir touches a hill, then the Pumped Reservoir, as a player would. */
function withWeirBelowABluff(s: RunState): RunState {
  for (const t of Object.values(s.map.tiles)) {
    if (!canPlace(content, s, 'weir', t).ok) continue;
    const weir = applyCommand(content, s, { type: 'place', building: 'weir', at: t });
    if (!weir.ok) continue;
    const hill = Object.values(weir.state.map.tiles).find(
      (x) => canPlace(content, weir.state, 'pumpedReservoir', x).ok,
    );
    if (!hill) continue;
    const both = applyCommand(content, weir.state, {
      type: 'place',
      building: 'pumpedReservoir',
      at: hill,
    });
    if (both.ok) return both.state;
  }
  throw new Error('no weir site gives the Pumped Reservoir a hill beside its reservoir');
}

describe('every building can be placed', () => {
  it.each(['seed-a', 'seed-b', 'seed-c', 'willow-reach-golden'])('on %s', (seed) => {
    let s = withWeirBelowABluff(createRun(content, { seed, sandbox: true }));
    for (const id of ORDER.filter((x) => x !== 'weir' && x !== 'pumpedReservoir')) {
      // Empty tiles only: a canopy may also be built over a farm, which evolves it.
      const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
      const site = Object.values(s.map.tiles).find(
        (t) => !taken.has(hexKey(t)) && canPlace(content, s, id, t).ok,
      );
      expect(site, `${id} has a legal site`).toBeDefined();
      const result = applyCommand(content, s, { type: 'place', building: id, at: site! });
      expect(result.ok, `${id} places`).toBe(true);
      if (result.ok) s = result.state;
    }
    expect(new Set(Object.values(s.buildings).map((b) => b.type)).size).toBe(ORDER.length + 1);
  });

  it('sandbox runs unlock everything and start with 999 materials', () => {
    const s = createRun(content, { seed: 'sandbox', sandbox: true });
    expect(s.unlocked).toHaveLength(
      content.buildings.filter((b) => b.placeable && !b.requiresWater).length,
    );
    expect(s.stores.materials).toBe(999);
  });
});
