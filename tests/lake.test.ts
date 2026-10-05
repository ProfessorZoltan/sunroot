/**
 * Lake Gardens' lake rules (proposals/lake-gardens.md, LG1): raised beds made on the shallows,
 * the mud that water reaching the lake settles there, dredging and silting, and the lake's grey
 * water with its fisheries and its bloom. The biome comes later (LG2), so these tests use the
 * Reach with the lake rules and a few lake buildings added.
 *
 * Maps put the river in the first column and the lake on the right: shallows (w) by the land,
 * deep water (D) beyond.
 */
import { describe, expect, it } from 'vitest';
import {
  canPlace,
  createRun,
  harmonyLines,
  hexKey,
  type Content,
  type RunState,
  type WaterReport,
} from '../src/sim';
import { lakeTiles } from '../src/sim/water';
import { at, content, endSeason, place, scenario, uidAt, withWater } from './helpers';

const LAND = ['floodplain', 'hill', 'barren', 'scrub', 'meadow', 'woodland', 'bed'];
const BUILDINGS = [
  {
    id: 'chinampa',
    name: 'Chinampa',
    cost: 3,
    workers: 1,
    kind: 'food',
    placement: { tiles: ['shallows'] },
    setsTile: 'bed',
    yields: { food: [1, 2, 2, 0] },
    nextToTilesFood: {
      tiles: ['shallows', 'deep'],
      count: 2,
      amount: 1,
      seasons: [true, true, true, true],
    },
  },
  {
    id: 'mudBoat',
    name: 'Mud Boat',
    cost: 2,
    workers: 1,
    kind: 'industry',
    placement: { tiles: LAND, adjacentTo: ['shallows'] },
    dredges: [3, 3, 3, 6],
  },
  {
    id: 'stiltHouse',
    name: 'Stilt House',
    cost: 3,
    workers: 0,
    kind: 'home',
    placement: { tiles: ['shallows'] },
    housing: 3,
    water: { feeds: { quality: 'grey', amount: 1 } },
  },
  {
    id: 'wastewaterFishery',
    name: 'Wastewater Fishery',
    cost: 4,
    workers: 1,
    kind: 'food',
    placement: { tiles: ['shallows'] },
    eatsGrey: { takesGrey: 3, foodPerGrey: 1 },
  },
  {
    id: 'lakeFishery',
    name: 'Lake Fishery',
    cost: 4,
    workers: 1,
    kind: 'food',
    placement: { tiles: ['deep'] },
    yields: { food: [2, 2, 2, 3] },
    fishesLake: true,
  },
];

const lake = (changes: { selfCleans?: number } = {}): Content =>
  withWater({
    campChannel: 0,
    edit: (raw) => {
      const r = raw as unknown as {
        rules: Record<string, unknown>;
        buildings: unknown[];
        draft?: unknown;
      };
      r.rules.lake = {
        waterPerMud: 2,
        siltAt: 4,
        selfCleans: changes.selfCleans ?? 0,
        greyHarmonyPerUnit: 1,
        bloom: { above: 4, seasons: [false, true, false, false], foodLoss: 1, harmonyFactor: 2 },
      };
      r.rules.plantable = ['shallows'];
      r.buildings.push(...structuredClone(BUILDINGS));
    },
  });
const L = lake();

// Barren and scrub keep Harmony low, so yields aren't multiplied.
const SHORE = ['~ . . . w w D', '~ . . . w w D', '~ , C , w w D', '~ , , , w w D', '~ , , , . . .'];
const start = (season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer', c = L) =>
  scenario(SHORE, { content: c, season, citizens: 30, stores: { food: 500 } });
const build = (s: RunState, id: string, cells: [number, number][], c = L) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, c), s);
const end = (s: RunState, c = L) =>
  endSeason({ ...s, stores: { ...s.stores, food: 500 }, wellbeing: 80 }, c);
const water = (s: RunState): WaterReport => s.lastReport!.water!;
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
const sum = (rec: Record<string, number>) => Object.values(rec).reduce((n, x) => n + x, 0);

describe('the lake rules are off without them', () => {
  it('leave the Reach with no lake to keep', () => {
    expect(content.rules.lake).toBeUndefined();
    expect(createRun(content, { seed: 'x' }).lake).toBeUndefined();
    expect(createRun(L, { seed: 'x' }).lake).toEqual({ grey: 0 });
  });
});

describe('raised beds', () => {
  it('turn the shallows they are built on into a bed, which is no longer lake', () => {
    let s = start();
    const before = [...lakeTiles(s).values()].flat().length;
    s = build(s, 'chinampa', [[4, 2]]);
    expect(tile(s, 4, 2).type).toBe('bed');
    expect([...lakeTiles(s).values()].flat().length).toBe(before - 1);
    // On the bed, next to open water: +1 food for the water beside it.
    s = end(s);
    expect(s.lastReport!.yields[uidAt(s, 4, 2)]?.food).toBe(3);
    expect(s.lastReport!.math[uidAt(s, 4, 2)]!.join(' ')).toMatch(/next to 3 shallows or deep/);
  });
});

describe('water reaching the lake', () => {
  it('runs in from a home on no channel, settling mud on open shallows beside it', () => {
    let s = build(start(), 'stiltHouse', [[4, 2]]);
    s = end(s);
    const w = water(s);
    expect(w.out['into the lake']).toBe(1);
    expect(sum(w.in)).toBe(sum(w.out));
    // Of its neighbours, three are open shallows: the first of them by key takes the water.
    expect(w.lakeIn).toEqual({ [hexKey(at(4, 3))]: { clean: 0, nutrient: 0, grey: 1 } });
    expect(s.lake!.grey).toBe(1);
    // 1 water is half a mud: it waits on the tile until the next.
    expect(tile(s, 4, 3).mud ?? 0).toBe(0);
    expect(tile(s, 4, 3).settling).toBe(1);
    s = end(s);
    expect(tile(s, 4, 3).mud).toBe(1);
    expect(s.lastReport!.lake!.settled).toEqual({ [hexKey(at(4, 3))]: 1 });
    expect(s.lake!.grey).toBe(2);
  });

  it('runs in at the end of a channel that ends at the lake, not lost', () => {
    // A channel from the river along row 2 to the shore; a bathhouse on it returns grey water.
    let s = build(start(), 'irrigationChannel', [
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    s = build(s, 'bathhouse', [[2, 0]]);
    s = end(s);
    const w = water(s);
    expect(w.channels[0]!.rejoinsAt).toBeNull();
    expect(w.out['lost at channel ends'] ?? 0).toBe(0);
    expect(w.out['into the lake']).toBe(1);
    const [entry, u] = Object.entries(w.lakeIn!)[0]!;
    expect(u).toEqual({ clean: 0, nutrient: 0, grey: 1 });
    expect([at(4, 0), at(4, 1), at(4, 2)].map(hexKey)).toContain(entry);
    expect(sum(w.in)).toBe(sum(w.out));
    expect(s.lake!.grey).toBe(1);
  });

  it("leaves the river's grey water and its Harmony cost alone", () => {
    const s = end(build(start(), 'stiltHouse', [[4, 2]]));
    expect(water(s).greyToRiver).toBe(0);
    const lines = harmonyLines(L, s);
    expect(lines.find((l) => l.label.includes('in the river'))).toBeUndefined();
    expect(lines.find((l) => l.label === '1 grey water in the lake')!.amount).toBe(-1);
  });
});

describe("the lake's grey water", () => {
  it('feeds a wastewater fishery, up to what it takes, food for each', () => {
    let s = start();
    s.lake!.grey = 5;
    s = build(s, 'wastewaterFishery', [[5, 1]]);
    s = end(s);
    expect(s.lastReport!.lake!.eaten).toBe(3);
    expect(s.lastReport!.yields[uidAt(s, 5, 1)]?.food).toBe(3);
    expect(s.lake!.grey).toBe(2);
  });

  it('is cleaned a little each season by the lake itself', () => {
    const c = lake({ selfCleans: 1 });
    let s = start('summer', c);
    s.lake!.grey = 3;
    s = end(s, c);
    expect(s.lastReport!.lake!.cleaned).toBe(1);
    expect(s.lake!.grey).toBe(2);
  });

  it('blooms above 4 in summer: lake fisheries make 1 less, its Harmony cost doubles', () => {
    let s = build(start(), 'lakeFishery', [[6, 1]]);
    s.lake!.grey = 5;
    s = end(s);
    expect(s.lastReport!.lake!.bloom).toBe(true);
    expect(s.lastReport!.yields[uidAt(s, 6, 1)]?.food).toBe(1);
    expect(s.lastReport!.math[uidAt(s, 6, 1)]!.join(' ')).toMatch(/−1 algae bloom/);
    const line = harmonyLines(L, s).find((l) => l.label.includes('in the lake'))!;
    expect(line).toEqual({ label: '5 grey water in the lake, blooming', amount: -10 });
  });

  it("doesn't bloom at 4 or less, nor outside summer", () => {
    let s = build(start(), 'lakeFishery', [[6, 1]]);
    s.lake!.grey = 4;
    s = end(s);
    expect(s.lastReport!.lake!.bloom).toBe(false);
    expect(s.lastReport!.yields[uidAt(s, 6, 1)]?.food).toBe(2);
    let a = build(start('autumn'), 'lakeFishery', [[6, 1]]);
    a.lake!.grey = 9;
    a = end(a);
    expect(a.lastReport!.lake!.bloom).toBe(false);
  });
});

describe('mud', () => {
  it('silts a shallows tile up at 4: not water, not land, until dredged', () => {
    let s = start();
    Object.assign(tile(s, 4, 3), { mud: 3, settling: 1 });
    s = build(s, 'stiltHouse', [[4, 2]]);
    s = end(s);
    const t = tile(s, 4, 3);
    expect(t.mud).toBe(4);
    expect(t.silted).toBe(true);
    // A full tile takes no more: the next water washes on to the next open shallows beside the house.
    expect(t.settling).toBe(0);
    expect([...lakeTiles(s).values()].flat().map(hexKey)).not.toContain(hexKey(at(4, 3)));
    const why = canPlace(L, s, 'wastewaterFishery', at(4, 3));
    expect(why).toEqual({ ok: false, reason: 'silted up: a mud boat must dredge it first' });
    s = end(s);
    expect(Object.keys(water(s).lakeIn!)).not.toContain(hexKey(at(4, 3)));
  });

  it('is lifted by a mud boat, the fullest tile first, as compost', () => {
    let s = start();
    Object.assign(tile(s, 4, 3), { mud: 2 });
    Object.assign(tile(s, 4, 2), { mud: 4, silted: true });
    s = build(s, 'mudBoat', [[3, 3]]);
    const compost = s.stores.compost;
    s = end(s);
    expect(s.lastReport!.lake!.dredged).toEqual({ [uidAt(s, 3, 3)]: 3 });
    expect(s.stores.compost - compost).toBeGreaterThanOrEqual(3);
    expect(s.lastReport!.yields[uidAt(s, 3, 3)]?.compost).toBe(3);
    // The silted tile, fuller, went first and opens again; what was left came from the other.
    expect(tile(s, 4, 2).mud).toBe(1);
    expect(tile(s, 4, 2).silted).toBeUndefined();
    expect(tile(s, 4, 3).mud).toBe(2);
    expect(canPlace(L, s, 'wastewaterFishery', at(4, 2))).toEqual({ ok: true });
  });

  it('is lifted twice as fast in winter, and a boat can be set beside silted shallows', () => {
    let s = start('winter');
    Object.assign(tile(s, 4, 3), { mud: 4, silted: true });
    Object.assign(tile(s, 4, 2), { mud: 4, silted: true });
    s = build(s, 'mudBoat', [[3, 3]]);
    s = end(s);
    expect(s.lastReport!.lake!.dredged).toEqual({ [uidAt(s, 3, 3)]: 6 });
  });
});

describe('the lake stays deterministic and conserves its water', () => {
  it('accounts for every unit over a year of homes, a fishery and a boat', () => {
    let s = start('spring');
    s = build(s, 'stiltHouse', [
      [4, 2],
      [4, 0],
    ]);
    s = build(s, 'wastewaterFishery', [[5, 1]]);
    s = build(s, 'mudBoat', [[3, 3]]);
    for (let i = 0; i < 8; i++) {
      s = end(s);
      expect(sum(water(s).in)).toBe(sum(water(s).out));
    }
    const again = (() => {
      let t = start('spring');
      t = build(t, 'stiltHouse', [
        [4, 2],
        [4, 0],
      ]);
      t = build(t, 'wastewaterFishery', [[5, 1]]);
      t = build(t, 'mudBoat', [[3, 3]]);
      for (let i = 0; i < 8; i++) t = end(t);
      return t;
    })();
    expect(again.map).toEqual(s.map);
    expect(again.lake).toEqual(s.lake);
  });
});
