/**
 * PROPOSED golden test for Willow Reach with water (EXPANSION.md, E1): not
 * yet the reference. It becomes the golden test only once the designer has
 * reviewed it (DECISIONS.md, Water expansion: the Year 1 walkthrough).
 *
 * The design's Year 1 walkthrough with the water system on. The camp starts
 * with its 3-tile channel and every building draws through a channel, so the
 * farms go beside it: the first on the floodplain (it still gets the flood's
 * silt), the second on meadow (1 less food a season), with the composter
 * between them. Everything else is built where the design's walkthrough puts it.
 *
 * | Season | Build                                      | Materials | Food | Citizens | Water                                         |
 * | Spring | Farm, Salvage Yard, Workshop, Solar Canopy | 11        | 8    | 6        | 12 in; the channel carries 1 to the farm      |
 * | Summer | 2nd farm (meadow), Cottage                 | 12        | 11   | 7        | 4 in; the channel carries 2; 2 flow on        |
 * | Autumn | Composter, Orchard                         | 10        | 17   | 8        | 8 in; the channel carries 2                   |
 * | Winter | River Wheel                                | 9         | 9    | 8        | 6 in; nothing drinks; the wheel makes 2 a slot |
 */
import { describe, expect, it } from 'vitest';
import { canPlace, createRun, hexKey, hexNeighbors, type Hex, type RunState } from '../src/sim';
import { act, buildingAt, findSites, GOLDEN_SEED, place, totals } from './walkthrough';
import { withWater } from './helpers';

const W = withWater();

/** A dry composter site with two farm sites beside it that touch the camp's channel, floodplain first. */
function waterSites(state: RunState) {
  const channel = new Set(
    Object.values(state.buildings)
      .filter((b) => b.type === 'irrigationChannel')
      .map((b) => hexKey(b.at)),
  );
  const typeAt = (h: Hex) => state.map.tiles[hexKey(h)]?.type;
  const watered = (h: Hex) => hexNeighbors(h).some((n) => channel.has(hexKey(n)));
  for (const t of Object.values(state.map.tiles)) {
    if (typeAt(t) === 'floodplain' || !canPlace(W, state, 'composter', t).ok) continue;
    const fields = hexNeighbors(t)
      .filter((n) => watered(n) && canPlace(W, state, 'floodplainFarm', n).ok)
      .sort((a, b) => Number(typeAt(a) !== 'floodplain') - Number(typeAt(b) !== 'floodplain'));
    if (fields.length >= 2) return { composter: t, farm1: fields[0]!, farm2: fields[1]! };
  }
  throw new Error('golden map has no farms beside the camp channel');
}

describe('Year 1 walkthrough with water (proposed golden)', () => {
  it('builds beside the camp channel and ends the year at 9 materials, 9 food, 8 citizens', () => {
    let state = createRun(W, { seed: GOLDEN_SEED, guided: true });
    expect(totals(state)).toEqual({ materials: 20, food: 12, citizens: 6 });
    expect(
      Object.values(state.buildings).filter((b) => b.type === 'irrigationChannel'),
    ).toHaveLength(3);
    const sites = { ...findSites(state, W), ...waterSites(state) };
    expect(state.map.tiles[hexKey(sites.farm1)]!.type).toBe('floodplain');
    expect(state.map.tiles[hexKey(sites.farm2)]!.type).toBe('meadow');
    const farms = () => [sites.farm1, sites.farm2].map((h) => buildingAt(state, h).uid);

    // --- Spring ---
    state = act(state, { type: 'pickCard', card: 'orchard' }, W);
    state = place(state, 'floodplainFarm', sites.farm1, W);
    state = place(state, 'salvageYard', sites.ruin, W);
    state = place(state, 'workshop', sites.workshop, W);
    state = place(state, 'solarCanopy', sites.solar, W);
    state = act(state, { type: 'endSeason' }, W);
    expect(totals(state)).toEqual({ materials: 11, food: 8, citizens: 6 });
    expect(state.lastReport!.water!.uses[buildingAt(state, sites.farm1).uid]).toMatchObject({
      from: 'channel',
      short: false,
    });
    expect(buildingAt(state, sites.farm1).siltYear).toBe(1);

    // --- Summer ---
    state = act(state, { type: 'pickCard', card: state.draft.offer[0]! }, W);
    state = place(state, 'floodplainFarm', sites.farm2, W);
    state = place(state, 'cottage', sites.cottage, W);
    state = act(state, { type: 'endSeason' }, W);
    expect(totals(state)).toEqual({ materials: 12, food: 11, citizens: 7 });
    const summer = state.lastReport!;
    // The silted farm makes 6; the meadow farm 4 − 1. The channel carries 2 of the river's 4.
    expect(farms().map((uid) => summer.yields[uid]?.food)).toEqual([6, 3]);
    expect(summer.water!.channels[0]!.drawn).toBe(2);
    expect(summer.water!.out['flowed downstream']).toBe(2);

    // --- Autumn ---
    state = act(state, { type: 'pickCard', card: state.draft.offer[0]! }, W);
    state = place(state, 'composter', sites.composter, W);
    state = place(state, 'orchard', sites.orchard, W);
    state = act(state, { type: 'endSeason' }, W);
    expect(totals(state)).toEqual({ materials: 10, food: 17, citizens: 8 });
    expect(state.lastReport!.bonuses.compost).toBe(2);
    expect(state.stores.clutter).toBe(2);

    // --- Winter ---
    expect(state.draft.offer).toContain('riverWheel');
    state = act(state, { type: 'pickCard', card: 'riverWheel' }, W);
    state = place(state, 'riverWheel', sites.wheel, W);
    state = act(state, { type: 'endSeason' }, W);
    // The salvage yard and workshop need 1 day energy each: one workshop run, not two.
    expect(totals(state)).toEqual({ materials: 9, food: 9, citizens: 8 });
    const winter = state.lastReport!;
    // Winter's 6 turns the wheel at ⌈6 ÷ 4⌉ = 2 a slot, the old table's winter value.
    expect(winter.generated[buildingAt(state, sites.wheel).uid]!.energy).toEqual({
      day: 2,
      night: 2,
    });
    expect(winter.energy.night.shortfall).toBe(0);
    expect(winter.water!.uses).toEqual({});
  });
});
