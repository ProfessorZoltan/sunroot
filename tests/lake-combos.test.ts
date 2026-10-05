/**
 * Lake Gardens' own combos (proposals/lake-gardens.md, Combos; LG3): each one triggers. Buildings
 * are set down as they stand (where a test needs one beside another on ground its placement
 * wouldn't take, a bed is made under it), so each test is about the combo, not the placing.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { canPlace, hexKey, type RunState, type TileType } from '../src/sim';
import { findFormations, keptOpen } from '../src/sim/combos';
import { edgesAround } from '../src/sim/edges';
import { stormExposed } from '../src/sim/queries';
import { contentFor } from '../src/sim/content/modifiers';
import { act, at, endSeason, scenario } from './helpers';

const LAKE = biomeContent('lakeGardens');

// Land on the left, shallows in the middle, deep water on the right.
const SHORE = [
  '~ , , , , w w D D',
  '~ , , , , w w D D',
  '~ , C , , w w D D',
  '~ , , , , w w D D',
  '~ , , , , , w w D',
];

function start(season: 'spring' | 'summer' | 'autumn' | 'winter' = 'summer', rows = SHORE) {
  const s = scenario(rows, {
    content: LAKE,
    season,
    citizens: 30,
    stores: { food: 300, materials: 300, scraps: 6, biomass: 10 },
    run: { water: true },
  });
  for (const t of Object.values(s.map.tiles))
    if (t.type === 'shallows' || t.type === 'deep') t.water = 4;
  return s;
}

let n = 0;
/** Sets a building down as it stands, `tile` under it if given; built long ago unless `age`. */
function put(
  s: RunState,
  type: string,
  col: number,
  row: number,
  opts: { tile?: TileType; age?: number } = {},
): string {
  const uid = `t${++n}`;
  const h = at(col, row);
  if (opts.tile) s.map.tiles[hexKey(h)]!.type = opts.tile;
  s.buildings[uid] = { uid, type, at: h, builtTurn: s.turn - (opts.age ?? 8) };
  s.priority.push(uid);
  return uid;
}
const end = (s: RunState) =>
  endSeason({ ...s, stores: { ...s.stores, food: 300 }, wellbeing: 80 }, LAKE);
const hits = (s: RunState) => s.lastReport!.combos.map((h) => h.combo);
const food = (s: RunState, uid: string) => s.lastReport!.yields[uid]?.food ?? 0;

describe('Duck and Rice', () => {
  it('a paddy next to a duck house needs 1 less water', () => {
    const s = start();
    // Young paddies, so they don't become Rice-Duck Paddies first.
    const paddy = put(s, 'riceFishPaddy', 3, 1, { tile: 'bed', age: 1 });
    const lone = put(s, 'riceFishPaddy', 1, 4, { tile: 'bed', age: 1 });
    put(s, 'duckHouse', 3, 0);
    const after = end(s);
    expect(after.lastReport!.water!.uses[paddy]!.need).toBe(1);
    expect(after.lastReport!.water!.uses[lone]!.need).toBe(2);
    expect(hits(after)).toContain('duckAndRice');
  });
});

describe('the Rice-Duck Paddy', () => {
  it('a paddy that has stood 4 seasons beside a duck house becomes one', () => {
    const s = start();
    const old = put(s, 'riceFishPaddy', 3, 1, { tile: 'bed', age: 3 });
    const young = put(s, 'riceFishPaddy', 3, 3, { tile: 'bed', age: 1 });
    put(s, 'duckHouse', 3, 2);
    const after = end(s);
    expect(after.buildings[old]!.type).toBe('riceDuckPaddy');
    expect(after.buildings[young]!.type).toBe('riceFishPaddy');
    expect(hits(after)).toContain('riceDuckPaddy');
    expect(LAKE.byId.riceDuckPaddy!.water!.returns!.amount).toBe(2);
  });
});

describe('the Floating Market', () => {
  it('a commons plaza next to 2 stilt houses and the water becomes one', () => {
    const s = start();
    const plaza = put(s, 'commonsPlaza', 4, 1);
    put(s, 'stiltHouse', 5, 1);
    put(s, 'stiltHouse', 4, 0);
    const after = end(s);
    expect(after.buildings[plaza]!.type).toBe('floatingMarket');
    expect(hits(after)).toContain('floatingMarket');
    // One stilt house is not enough.
    const t = start();
    const other = put(t, 'commonsPlaza', 4, 1);
    put(t, 'stiltHouse', 5, 1);
    expect(end(t).buildings[other]!.type).toBe('commonsPlaza');
  });
});

describe('the Floating Garden', () => {
  // A pool of shallows at (2, 1), land all round it.
  const POOL = [', , , , ,', ', , w , ,', ', , , , C', ', , , , ,'];
  /** The pool ringed by `beds` chinampas, and a stilt house whose grey water runs into it. */
  function garden(beds: number) {
    const s = start('summer', POOL);
    const ring: string[] = [];
    for (const [c, r] of [
      [1, 1],
      [3, 1],
      [2, 0],
      [3, 0],
    ].slice(0, beds))
      ring.push(put(s, 'chinampa', c!, r!, { tile: 'bed' }));
    put(s, 'stiltHouse', 2, 2, { tile: 'floodplain' });
    s.map.tiles[hexKey(at(2, 1))]!.settling = 1;
    return { s, ring };
  }

  it('4 chinampas round an open pool: +1 food each in summer, and the pool never silts', () => {
    const { s, ring } = garden(4);
    expect(findFormations(contentFor(LAKE, s), s).some((h) => h.combo === 'floatingGarden')).toBe(
      true,
    );
    expect(keptOpen(contentFor(LAKE, s), s)).toEqual(new Set([hexKey(at(2, 1))]));
    const after = end(s);
    for (const uid of ring)
      expect(after.lastReport!.math[uid]!.join(' ')).toMatch(/\+1 food from the Floating Garden/);
    // The house's grey water came in at the pool and left no mud there.
    expect(Object.keys(after.lastReport!.water!.lakeIn!)).toEqual([hexKey(at(2, 1))]);
    expect(after.map.tiles[hexKey(at(2, 1))]!.mud ?? 0).toBe(0);
  });

  it('with 3 the pool takes the mud, and nothing in other seasons', () => {
    const { s } = garden(3);
    expect(end(s).map.tiles[hexKey(at(2, 1))]!.mud).toBe(1);
    const { s: autumn } = garden(4);
    autumn.season = 'autumn';
    autumn.turn += 2;
    const after = end(autumn);
    expect(Object.values(after.lastReport!.math).flat().join(' ')).not.toMatch(/Floating Garden/);
  });
});

describe('the Willow Shore', () => {
  it('4 willow edges joined end to end keep the lake wind off within 2 tiles', () => {
    const s = start('autumn');
    const bed = put(s, 'chinampa', 6, 2, { tile: 'bed' }); // beside the deep water
    expect(stormExposed(contentFor(LAKE, s), s, s.buildings[bed]!)).toBe(true);
    s.hedges = edgesAround(at(4, 1)).slice(0, 4).sort();
    expect(findFormations(contentFor(LAKE, s), s).some((h) => h.combo === 'willowShore')).toBe(
      true,
    );
    expect(stormExposed(contentFor(LAKE, s), s, s.buildings[bed]!)).toBe(false);
  });
});

describe("the lake's loops", () => {
  it('the Dyke Loop: silk, leaves, fish and mud; +1 each, and the boat lifts 1 more', () => {
    const s = start();
    const silk = put(s, 'silkHouse', 2, 0);
    const dyke = put(s, 'mulberryDyke', 3, 0);
    const pond = put(s, 'fishPond', 4, 0);
    const boat = put(s, 'mudBoat', 4, 1);
    // Mud for the boat to lift, on the shallows beside it.
    s.map.tiles[hexKey(at(5, 1))]!.mud = 3;
    let t = end(s);
    expect(hits(t)).toContain('dykeLoop');
    expect(t.loops.find((l) => l.combo === 'dykeLoop')!.members.sort()).toEqual(
      [silk, dyke, pond, boat].sort(),
    );
    const lifted = t.lastReport!.lake!.dredged[boat];
    expect(lifted).toBe(3);
    t.map.tiles[hexKey(at(5, 1))]!.mud = 4;
    t = end(t);
    expect(t.lastReport!.lake!.dredged[boat]).toBe(4);
    expect(t.lastReport!.math[pond]!.join(' ')).toMatch(/from the Dyke Loop/);
    expect(t.lastReport!.math[dyke]!.join(' ')).toMatch(/\+1 biomass from the Dyke Loop/);
  });

  it('the VAC Loop: pond, house, pen and bed; +1 food on the pond and bed, +1 compost on the pen', () => {
    const s = start();
    const pond = put(s, 'fishPond', 4, 2);
    const house = put(s, 'stiltHouse', 5, 2);
    const pen = put(s, 'pigPen', 4, 3);
    const bed = put(s, 'chinampa', 3, 3, { tile: 'bed' });
    expect([pond, house, pen, bed]).toHaveLength(4);
    let t = end(s);
    expect(hits(t)).toContain('vacLoop');
    t = { ...t, stores: { ...t.stores, scraps: 6 } };
    t = end(t);
    for (const uid of [pond, bed])
      expect(t.lastReport!.math[uid]!.join(' ')).toMatch(/\+1 food from the VAC Loop/);
    expect(t.lastReport!.math[pen]!.join(' ')).toMatch(/\+1 compost from the VAC Loop/);
  });

  it('the Clean Lake Loop: house, fishery and bed; +1 food, and the fishery takes 1 more grey', () => {
    const s = start();
    put(s, 'stiltHouse', 5, 0);
    const fishery = put(s, 'wastewaterFishery', 5, 1);
    const bed = put(s, 'chinampa', 4, 1, { tile: 'bed' });
    s.lake!.grey = 10;
    let t = end(s);
    expect(hits(t)).toContain('cleanLakeLoop');
    expect(t.lastReport!.lake!.eaten).toBe(3);
    t = end({ ...t, lake: { grey: 10 } });
    expect(t.lastReport!.lake!.eaten).toBe(4);
    expect(food(t, fishery)).toBe(4 + 1);
    expect(t.lastReport!.math[bed]!.join(' ')).toMatch(/\+1 food from the Clean Lake Loop/);
  });
});

describe("the lake's charters", () => {
  it('Water First: raised beds stop at half the shallows; fisheries and ponds make 1 more', () => {
    // 2 shallows tiles in all: with 1 made a bed, beds are already half of them.
    const s = start('summer', [', , w w D', ', C , , ,']);
    s.charters = ['waterFirst'];
    const c = contentFor(LAKE, s);
    expect(c.rules.lake!.bedShare).toBe(0.5);
    expect(canPlace(c, s, 'chinampa', at(2, 0)).ok).toBe(true);
    const t = act(s, { type: 'place', building: 'chinampa', at: at(2, 0) }, LAKE);
    expect(canPlace(c, t, 'chinampa', at(3, 0))).toEqual({
      ok: false,
      reason: "no more beds: they may be 50% of the lake's shallows at most",
    });
    expect(c.byId.lakeFishery!.yields.food).toEqual([3, 3, 3, 4]);
  });

  it('Canal Keepers: the lake never blooms, and chinampas cost 1 more', () => {
    const s = start();
    s.charters = ['canalKeepers'];
    s.lake!.grey = 20;
    expect(end(s).lastReport!.lake!.bloom).toBe(false);
    expect(contentFor(LAKE, s).byId.chinampa!.cost).toBe(5);
  });
});
