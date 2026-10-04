/**
 * The Sun Desert's combos (proposals/sun-desert.md, Combos; SD3): each
 * triggers in a test. Also the rules they rest on (a courtyard needs no
 * cooling, homes' grey water, night-only formation power, a qanat's length,
 * buildings that rest), and its tunings and charters.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { harmonyLines, hexKey, type Hex, type RunState, type Season } from '../src/sim';
import { applyModifiers } from '../src/sim/content/modifiers';
import { coolDemand, stormExposed } from '../src/sim/queries';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

const D = biomeContent('sunDesert');

/** The oasis down the left; gravel plain; two palm groves. */
const LAND = ['g g W g g g', 'O g W g g g', 'O g g C g g', 'g g g g g g'];
const start = (season: Season = 'summer', rows = LAND) =>
  scenario(rows, {
    content: D,
    season,
    citizens: 20,
    stores: { food: 200, biomass: 20 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, D), s);
/** A building set down where placement would refuse it, for a test. */
const put = (s: RunState, type: string, col: number, row: number): RunState => {
  const uid = `b${s.nextUid}`;
  return {
    ...s,
    nextUid: s.nextUid + 1,
    buildings: { ...s.buildings, [uid]: { uid, type, at: at(col, row), builtTurn: s.turn } },
    priority: [...s.priority, uid],
  };
};
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 200 } }, D);
const hits = (s: RunState, combo: string) => s.lastReport!.combos.filter((h) => h.combo === combo);
const typeAt = (s: RunState, c: number, r: number) => s.buildings[uidAt(s, c, r)]!.type;
const math = (s: RunState, c: number, r: number) =>
  (s.lastReport!.math[uidAt(s, c, r)] ?? []).join(' | ');
const si = (s: RunState) => ['spring', 'summer', 'autumn', 'winter'].indexOf(s.season);

describe('adjacency', () => {
  it('Courtyard: a mud-brick house next to a wind tower and a cistern needs no cooling', () => {
    let s = build(start(), 'mudBrickHouse', [[4, 0]]);
    s = build(s, 'windTower', [[5, 0]]);
    const house = () => s.buildings[uidAt(s, 4, 0)]!;
    // The heatwave's 1, with a tower only.
    expect(coolDemand(D, s, house(), 'day', si(s))).toBe(1);
    s = put(s, 'cistern', 4, 1);
    expect(coolDemand(D, s, house(), 'day', si(s))).toBe(0);
    s = end(s);
    expect(hits(s, 'courtyard')).toHaveLength(1);
  });

  it('Date Shade: an oasis garden next to 2 palm groves, +1 food in summer and autumn', () => {
    let s = build(start(), 'oasisGarden', [[1, 1]]);
    s = end(s);
    expect(hits(s, 'dateShade')).toHaveLength(1);
    expect(math(s, 1, 1)).toContain('+1 next to 2 woodland');
    // Not in spring.
    const spring = end(build(start('spring'), 'oasisGarden', [[1, 1]]));
    expect(hits(spring, 'dateShade')).toHaveLength(0);
  });
});

describe('chains', () => {
  it("Grey Water Loop: a house's grey water, cleaned by reeds, waters a garden", () => {
    // A channel from the oasis along row 1; the house, the reed bed and the garden along it.
    const rows = ['g g g g g g', 'O g g g g g', 'O g g C g g', 'g g g g g g'];
    let s = build(start('summer', rows), 'irrigationChannel', [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
    s = build(s, 'mudBrickHouse', [[1, 0]]);
    s = build(s, 'reedBed', [[2, 0]]);
    s = build(s, 'oasisGarden', [[3, 0]]);
    s = end(s);
    const water = s.lastReport!.water!;
    expect(water.in['grey water from homes']).toBe(1);
    expect(water.cleaned[uidAt(s, 2, 0)]).toBe(1);
    expect(water.uses[uidAt(s, 3, 0)]!.got.clean).toBeGreaterThan(0);
    expect(s.loops.map((l) => l.combo)).toContain('greyWaterLoop');
    // The next season the garden makes +1 food in the loop.
    s = end(s);
    expect(math(s, 3, 0)).toContain('Grey Water Loop');
  });

  it('Kitchen Loop: a composter beside a working oasis garden', () => {
    let s = build(start(), 'oasisGarden', [[1, 0]]);
    s = build(s, 'composter', [[1, 1]]);
    s = end(s);
    expect(s.loops.map((l) => l.combo)).toContain('kitchenLoop');
  });
});

describe('formations', () => {
  it('Heliostat Line: 3 Concentrated Solar Plants in a row on the reg, +1 each by night', () => {
    let s = build(start('spring'), 'concentratedSolarPlant', [
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    s = end(s);
    expect(hits(s, 'heliostatLine')).toHaveLength(1);
    const g = s.lastReport!.generated[uidAt(s, 2, 3)]!;
    expect(g.energy).toEqual({ day: 3, night: 3 });
    // Its heat is the mirrors', not the formation's.
    expect(g.heat.day).toBe(2);
  });

  it('Green Wall: 4 palm windbreaks end to end; nothing within 2 is buried, +1 Harmony', () => {
    let s = build(start('autumn'), 'solarCanopy', [[5, 0]]);
    const canopy = () => s.buildings[uidAt(s, 5, 0)]!;
    expect(stormExposed(D, s, canopy())).toBe(true);
    const c: Hex = at(3, 1);
    for (const [dq, dr] of [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
    ])
      s = act(s, { type: 'plantHedge', a: c, b: { q: c.q + dq!, r: c.r + dr! } }, D);
    expect(stormExposed(D, s, canopy())).toBe(false);
    expect(harmonyLines(D, s).map((l) => l.label)).toContain('Green Wall');
    s = end(s);
    expect(hits(s, 'greenWall')).toHaveLength(1);
  });

  it('Long Qanat: a qanat of 4 tiles; the garden beside it makes +1 food', () => {
    const rows = ['g g g g g g', 'O g g g g g', 'O g g C g g', 'g g g g g g'];
    const run = (tiles: number) => {
      let s = build(
        start('summer', rows),
        'qanat',
        Array.from({ length: tiles }, (_, i) => [1 + i, 1] as [number, number]),
      );
      s = build(s, 'oasisGarden', [[tiles, 0]]);
      return end(s);
    };
    const long = run(4);
    expect(hits(long, 'longQanat')).toHaveLength(1);
    expect(math(long, 4, 0)).toContain('+1 food from the Long Qanat');
    expect(hits(run(3), 'longQanat')).toHaveLength(0);
  });
});

describe('evolutions', () => {
  it('Three-Layer Garden: a garden next to 2 gardens and a tree nursery', () => {
    let s = build(start(), 'oasisGarden', [
      [1, 0],
      [1, 1],
      [1, 2],
    ]);
    s = build(s, 'treeNursery', [[2, 1]]);
    s = end(s);
    expect(typeAt(s, 1, 1)).toBe('threeLayerGarden');
    expect(typeAt(s, 1, 0)).toBe('oasisGarden');
    expect(D.byId.threeLayerGarden!.water!.needs).toEqual([0, 0, 0, 0]);
  });

  it('Fog Fence: a fog net next to 2 fog nets catches 2 a season', () => {
    let s = build(start('spring'), 'fogNet', [
      [3, 0],
      [4, 0],
      [5, 0],
    ]);
    s = end(s);
    expect(typeAt(s, 4, 0)).toBe('fogFence');
    s = end(s);
    expect(s.buildings[uidAt(s, 4, 0)]!.stored).toBeGreaterThanOrEqual(3);
  });

  it('Restored Array: a salvage yard whose old array is empty; 2 energy by day, no worker', () => {
    const rows = ['g g R g', 'g g g g', 'g C g g'];
    let s = build(start('winter', rows), 'salvageYard', [[2, 0]]);
    s.map.tiles[hexKey(at(2, 0))]!.salvage = 0;
    s = end(s);
    expect(typeAt(s, 2, 0)).toBe('restoredArray');
    s = end(s);
    expect(s.lastReport!.generated[uidAt(s, 2, 0)]!.energy.day).toBe(2);
    expect(D.byId.restoredArray!.workers).toBe(0);
  });
});

describe('tunings and charters', () => {
  it('each desert card changes what it says', () => {
    const own = [
      'deeperCisterns',
      'whitewashedWalls',
      'cleanMirrors',
      'dateHarvest',
      'nightWatch',
      'saltTrade',
      'widerTowers',
      'fogWeavers',
      'waterKeepers',
      'siesta',
    ];
    const cards = [...D.tunings, ...D.charters];
    const all = (c: typeof D) =>
      JSON.stringify(c.buildings) + JSON.stringify(c.events) + JSON.stringify(c.rules);
    for (const id of own) {
      const card = cards.find((c) => c.id === id)!;
      expect(card, id).toBeDefined();
      expect(all(applyModifiers(D, card.modifiers)), id).not.toBe(all(D));
    }
    const keepers = applyModifiers(D, cards.find((c) => c.id === 'waterKeepers')!.modifiers);
    expect(keepers.rules.water.evaporation.seasons).toEqual([false, false, false, false]);
  });

  it('Siesta: homes need no cooling, and workshops rest all summer', () => {
    const siesta = applyModifiers(D, D.charters.find((c) => c.id === 'siesta')!.modifiers);
    let s = scenario(LAND, {
      content: siesta,
      season: 'summer',
      citizens: 20,
      stores: { food: 200 },
      run: { water: true },
    });
    s = place(s, 'workshop', 4, 0, siesta);
    s = place(s, 'mudBrickHouse', 5, 0, siesta);
    s = endSeason(s, siesta);
    expect(s.lastReport!.math[uidAt(s, 4, 0)]!.join(' ')).toContain('rests this summer');
    expect(s.lastReport!.energy.day.cool!.demand).toBe(0);
  });
});
