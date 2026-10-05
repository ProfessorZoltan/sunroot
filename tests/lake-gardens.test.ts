/**
 * Lake Gardens' simulation (proposals/lake-gardens.md, LG2): its map, its four events and its
 * buildings. The lake's own rules (beds, mud, grey water) are tested in lake.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { canPlace, createRun, hexDistance, hexKey, type RunState } from '../src/sim';
import { stormExposed } from '../src/sim/queries';
import { lakeTiles } from '../src/sim/water';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

const LAKE = biomeContent('lakeGardens');

// The stream down the first column; shallows by the land, deep water beyond.
const SHORE = ['~ , , w w D D', '~ , C w w D D', '~ , , w w D D', '~ , , , w w D'];
/** A run on the shore, its lake full as high water leaves it. */
function start(season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer'): RunState {
  const s = scenario(SHORE, {
    content: LAKE,
    season,
    citizens: 20,
    stores: { food: 200, materials: 200 },
    run: { water: true },
  });
  for (const t of Object.values(s.map.tiles))
    if (t.type === 'shallows' || t.type === 'deep') t.water = LAKE.rules.water.lakePerTile;
  return s;
}
const end = (s: RunState) =>
  endSeason({ ...s, stores: { ...s.stores, food: 200 }, wellbeing: 80 }, LAKE);
const build = (s: RunState, id: string, col: number, row: number) => place(s, id, col, row, LAKE);
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
const yieldOf = (s: RunState, col: number, row: number, res: 'food' | 'biomass' | 'compost') =>
  s.lastReport!.yields[uidAt(s, col, row)]?.[res] ?? 0;

describe('the lake map', () => {
  const seeds = Array.from({ length: 20 }, (_, i) => `lake-map-${i}`);
  const runs = seeds.map((seed) => createRun(LAKE, { seed, water: true }));

  it('is a broad lake: shallows round the rim, deep water only away from the land', () => {
    for (const s of runs) {
      const tiles = Object.values(s.map.tiles);
      const lake = tiles.filter((t) => t.type === 'shallows' || t.type === 'deep');
      expect(lake.length / tiles.length).toBeGreaterThan(0.3);
      expect(lake.some((t) => t.type === 'deep')).toBe(true);
      for (const t of lake.filter((x) => x.type === 'deep'))
        for (const n of tiles.filter((x) => hexDistance(x, t) === 1))
          expect(['shallows', 'deep']).toContain(n.type);
      // One lake, still water off the stream.
      expect(lakeTiles(s).size).toBeGreaterThanOrEqual(1);
      expect(lake.every((t) => t.riverIndex === undefined)).toBe(true);
    }
  });

  it('has a stream from the top edge to the shore, reed fringe, and the drowned town', () => {
    for (const s of runs) {
      const stream = s.map.river.map((k) => s.map.tiles[k]!);
      expect(stream.length).toBeGreaterThan(0);
      expect(stream[0]!.r).toBe(0);
      const ruins = Object.values(s.map.tiles).filter((t) => t.type === 'ruin');
      expect(ruins.length).toBe(4);
      for (const r of ruins) expect(r.salvage).toBe(30);
      // High water covers the fringe.
      expect(s.map.floodOrder.every((k) => s.map.tiles[k]!.type === 'floodplain')).toBe(true);
    }
  });

  it('puts the camp on the mainland a short walk from the shallows, at Harmony 12', () => {
    for (const s of runs) {
      const camp = s.buildings.b0!.at;
      const shallows = Object.values(s.map.tiles).filter((t) => t.type === 'shallows');
      const d = Math.min(...shallows.map((t) => hexDistance(t, camp)));
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(2);
      expect(s.harmony).toBe(12);
    }
  });

  it('is the same map from the same seed', () => {
    expect(createRun(LAKE, { seed: 'again', water: true }).map).toEqual(
      createRun(LAKE, { seed: 'again', water: true }).map,
    );
  });
});

describe("the lake's events", () => {
  it('names a calendar of high water, the bloom, the lake wind and low water', () => {
    expect(LAKE.calendar).toEqual(['flood', 'bloom', 'storm', 'freeze']);
    expect(LAKE.events.bloom!.name).toBe('Algae bloom');
  });

  it('high water settles mud twice as fast', () => {
    let s = build(start('spring'), 'stiltHouse', 3, 2);
    s = end(s);
    expect(s.lastReport!.event).toBe('flood');
    // 1 grey water would settle half a mud; at high water it settles a whole one.
    expect(Object.values(s.lastReport!.lake!.settled)).toEqual([1]);
    let calm = build(start('summer'), 'stiltHouse', 3, 2);
    calm = end(calm);
    expect(calm.lastReport!.lake!.settled).toEqual({});
  });

  it('the lake wind reaches only beds facing deep water, and a willow edge stops it', () => {
    let s = build(start('autumn'), 'chinampa', 3, 1);
    s = build(s, 'chinampa', 4, 1);
    const inner = s.buildings[uidAt(s, 3, 1)]!;
    const outer = s.buildings[uidAt(s, 4, 1)]!;
    expect(stormExposed(LAKE, s, inner)).toBe(false);
    expect(stormExposed(LAKE, s, outer)).toBe(true);
    const hit = end(s);
    expect(hit.lastReport!.damaged).toEqual([outer.uid]);
    const edged = act(s, { type: 'plantHedge', a: at(3, 1), b: at(4, 1) }, LAKE);
    expect(stormExposed(LAKE, edged, outer)).toBe(false);
    expect(end(edged).lastReport!.damaged).toEqual([]);
  });
});

describe("the lake's buildings", () => {
  it('a chinampa is made on shallows beside land, becomes a bed and drinks from the lake', () => {
    const s0 = start();
    expect(canPlace(LAKE, s0, 'chinampa', at(4, 1)).ok).toBe(false); // no land beside it
    expect(canPlace(LAKE, s0, 'chinampa', at(5, 1)).ok).toBe(false); // deep water
    let s = build(s0, 'chinampa', 3, 1);
    expect(tile(s, 3, 1).type).toBe('bed');
    s = end(s);
    expect(s.lastReport!.water!.uses[uidAt(s, 3, 1)]).toMatchObject({ from: 'lake', short: false });
    // 3 in summer, +1 with open water on 2 sides or more.
    expect(yieldOf(s, 3, 1, 'food')).toBe(4);
  });

  it('a lake fishery stands on deep water beside shallows', () => {
    const s = start();
    expect(canPlace(LAKE, s, 'lakeFishery', at(5, 1)).ok).toBe(true);
    expect(canPlace(LAKE, s, 'lakeFishery', at(6, 1)).ok).toBe(false);
    expect(canPlace(LAKE, s, 'lakeFishery', at(3, 1)).ok).toBe(false);
    expect(yieldOf(end(build(start('winter'), 'lakeFishery', 5, 1)), 5, 1, 'food')).toBe(3);
  });

  it('a mulberry dyke feeds the fish beside it, and a silk house spins its leaves', () => {
    let s = build(start(), 'fishPond', 1, 0);
    s = build(s, 'mulberryDyke', 1, 1);
    s = build(s, 'silkHouse', 1, 2);
    s = { ...s, stores: { ...s.stores, biomass: 10 } };
    const before = s.stores.materials;
    s = end(s);
    expect(yieldOf(s, 1, 1, 'biomass')).toBe(2);
    expect(s.lastReport!.math[uidAt(s, 1, 0)]!.join(' ')).toMatch(/Mulberry Dyke/);
    expect(s.lastReport!.runs[uidAt(s, 1, 2)]!.runs).toBeGreaterThan(0);
    expect(s.stores.materials).toBeGreaterThan(before);
  });

  it('a duck house helps the chinampas beside it, spring to autumn', () => {
    let s = build(start(), 'chinampa', 3, 2);
    s = build(s, 'duckHouse', 2, 2);
    expect(yieldOf(end(s), 3, 2, 'food')).toBe(5);
    let w = build(start('winter'), 'chinampa', 3, 2);
    w = build(w, 'duckHouse', 2, 2);
    expect(yieldOf(end(w), 3, 2, 'food')).toBe(2);
  });

  it('a pig pen turns scraps into compost', () => {
    let s = build(start(), 'pigPen', 1, 2);
    s = { ...s, stores: { ...s.stores, scraps: 5 } };
    s = end(s);
    expect(yieldOf(s, 1, 2, 'compost')).toBe(2);
  });

  it('floating solar stands on the water; a canal wheel turns beside the stream', () => {
    const s = start();
    expect(canPlace(LAKE, s, 'floatingSolar', at(5, 0)).ok).toBe(true);
    expect(canPlace(LAKE, s, 'floatingSolar', at(1, 0)).ok).toBe(false);
    expect(canPlace(LAKE, s, 'canalWheel', at(1, 2)).ok).toBe(true);
    expect(canPlace(LAKE, s, 'canalWheel', at(2, 3)).ok).toBe(false);
  });

  it('leaves out the Reach buildings the lake replaces', () => {
    for (const id of ['floodplainFarm', 'orchard', 'weir', 'levee', 'hedgerow', 'riverWheel'])
      expect(LAKE.byId[id], id).toBeUndefined();
    expect(LAKE.buildings.filter((b) => b.starter).map((b) => b.id)).toEqual(
      expect.arrayContaining(['chinampa', 'mudBoat', 'stiltHouse']),
    );
  });
});
