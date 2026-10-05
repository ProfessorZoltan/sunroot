/**
 * Lake Gardens' wonder, animals and festivals (LG6, proposals/lake-gardens.md, Wonder, wildlife
 * and festivals): the Floating City; axolotls, herons, kingfishers and flamingos; Flower Boats,
 * the Silk Fair and Lanterns on the Water.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  createRun,
  habitatOf,
  eraGoal,
  eraGoalMet,
  eraGoalOr,
  hexKey,
  scoreRun,
  type RunState,
  type Season,
  type TileType,
} from '../src/sim';
import { wonderSiteProblem, wonderStage } from '../src/sim/wonder';
import { updateWildlife } from '../src/sim/wildlife';
import { edgeKey } from '../src/sim/edges';
import { contentFor } from '../src/sim/content/modifiers';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const LAKE = biomeContent('lakeGardens');
const CITY = 'floatingCity';

// Land on the left, shallows in the middle, deep water on the right.
const SHORE = [
  '~ , , , , w w D D',
  '~ , , , , w w D D',
  '~ , C , , w w D D',
  '~ , , , , w w D D',
  '~ , , , , , w w D',
];

function start(year = 7, season: Season = 'spring'): RunState {
  const s = scenario(SHORE, {
    content: LAKE,
    year,
    season,
    citizens: 30,
    stores: { food: 400, materials: 400, biomass: 60, scraps: 6 },
    run: { water: true },
  });
  for (const t of Object.values(s.map.tiles))
    if (t.type === 'shallows' || t.type === 'deep') t.water = 4;
  return s;
}

let n = 0;
/** Sets a building down as it stands, `tile` under it if given, built long ago. */
function put(s: RunState, type: string, col: number, row: number, tile?: TileType): string {
  const uid = `w${++n}`;
  const h = at(col, row);
  if (tile) s.map.tiles[hexKey(h)]!.type = tile;
  s.buildings[uid] = { uid, type, at: h, builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}
const end = (s: RunState) =>
  endSeason({ ...s, stores: { ...s.stores, food: 400 }, wellbeing: 80 }, LAKE);

/** A closed Dyke Loop (silk house, mulberry dyke, fish pond, mud boat) and `beds` chinampas. */
function ready(year = 7, beds = 3): RunState {
  const s = start(year);
  put(s, 'silkHouse', 2, 0);
  put(s, 'mulberryDyke', 3, 0);
  put(s, 'fishPond', 4, 0);
  put(s, 'mudBoat', 4, 1);
  s.map.tiles[hexKey(at(5, 1))]!.mud = 3;
  for (const [c, r] of (
    [
      [5, 2],
      [5, 3],
      [5, 0],
    ] as [number, number][]
  ).slice(0, beds))
    put(s, 'chinampa', c, r, 'bed');
  const t = end(s);
  expect(t.loops.map((l) => l.combo)).toContain('dykeLoop');
  return t;
}
const startCity = (s: RunState) => place(s, CITY, 7, 2, LAKE);

describe('the Floating City', () => {
  it('needs a closed Dyke Loop and 3 chinampas, from era 3', () => {
    expect(rejects(start(), { type: 'place', building: CITY, at: at(7, 2) }, LAKE)).toMatch(
      /^the Floating City needs a closed Dyke Loop and 3 /,
    );
    expect(rejects(ready(7, 2), { type: 'place', building: CITY, at: at(7, 2) }, LAKE)).toMatch(
      /needs 3 chinampas \(2 now\)/,
    );
    expect(rejects(ready(4), { type: 'place', building: CITY, at: at(7, 2) }, LAKE)).toBe(
      'the Floating City can be started from era 3',
    );
  });

  it('stands on the water, shallows among its tiles, and costs 60 materials and 30 biomass', () => {
    const s = ready();
    const before = s.stores;
    const t = startCity(s);
    expect(t.buildings[uidAt(t, 7, 2)]!.type).toBe(CITY);
    expect(before.materials - t.stores.materials).toBe(60);
    expect(before.biomass - t.stores.biomass).toBe(30);
    // On land it can't start.
    expect(rejects(s, { type: 'place', building: CITY, at: at(2, 3) }, LAKE)).toMatch(
      /can't be built over/,
    );
  });

  it('finished: the lake silts and blooms no more, chinampas +1 food, +60 and a Graft tier', () => {
    let s = startCity(ready());
    const uid = uidAt(s, 7, 2);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(LAKE, s, s.buildings[uid]!));
      s = end(s);
    }
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(s.lastReport!.wondersDone).toEqual([CITY]);
    const rules = contentFor(LAKE, s);
    expect(rules.rules.lake!.silts).toBe(false);
    expect(rules.byId.chinampa!.yields.food).toEqual(
      LAKE.byId.chinampa!.yields.food!.map((x) => x + 1),
    );
    // A full shallows tile stays open, and a dirty lake doesn't bloom in summer.
    const full = s.map.tiles[hexKey(at(6, 4))]!;
    full.mud = 4;
    s.lake!.grey = 20;
    while (s.season !== 'summer') s = end(s);
    s = end(s);
    expect(s.map.tiles[hexKey(at(6, 4))]!.silted).toBeUndefined();
    expect(s.lastReport!.lake!.bloom).toBe(false);
    const score = scoreRun(LAKE, s);
    expect(score.lines).toContainEqual({ reason: 'Floating City', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Floating City' });
  });

  it('meets the Bloom era goal', () => {
    const bloom = eraGoal(LAKE, 4)!;
    expect(eraGoalOr(contentFor(LAKE, start()), bloom)!.text).toBe('Or finish the Floating City.');
    let s = startCity(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(contentFor(LAKE, s), s, bloom)).toBe(true);
  });

  it('has a site on at least 35 of 40 lakes', () => {
    const def = LAKE.byId[CITY]!;
    let fit = 0;
    for (let i = 0; i < 40; i++) {
      const s = createRun(LAKE, { seed: `site-${i}`, water: true, guided: false });
      if (Object.values(s.map.tiles).some((t) => !wonderSiteProblem(LAKE, s, def, t))) fit++;
    }
    expect(fit).toBeGreaterThanOrEqual(35);
  });
});

const animal = (id: string) => LAKE.wildlife.find((a) => a.id === id)!;

describe("the lake's animals", () => {
  it('arrive at Harmony 20, 40, 50 and 70', () => {
    expect(LAKE.wildlife.map((a) => [a.id, a.harmony])).toEqual([
      ['axolotls', 20],
      ['herons', 40],
      ['kingfishers', 50],
      ['flamingos', 70],
    ]);
  });

  it('axolotls: open canals beside chinampas while the lake is clean; +1 food in summer', () => {
    const s = start(7, 'summer');
    const bed = put(s, 'chinampa', 5, 2, 'bed');
    expect(habitatOf(s, animal('axolotls')).tiles.length).toBeGreaterThan(0);
    s.lake!.grey = 2;
    expect(habitatOf(s, animal('axolotls')).tiles).toEqual([]);
    s.lake!.grey = 0;
    const withThem = end({ ...s, wildlife: ['axolotls'] });
    const without = end({ ...s, wildlife: [] });
    const food = (t: RunState) => t.lastReport!.yields[bed]?.food ?? 0;
    expect(food(withThem) - food(without)).toBe(1);
  });

  it('herons: reed fringe beside a fishery; fisheries and ponds within 2 make 1 more', () => {
    const s = start(7, 'summer');
    s.map.tiles[hexKey(at(4, 2))]!.type = 'floodplain';
    const pond = put(s, 'fishPond', 3, 2);
    expect(habitatOf(s, animal('herons')).tiles).toEqual([hexKey(at(4, 2))]);
    const food = (t: RunState) => t.lastReport!.yields[pond]?.food ?? 0;
    expect(food(end({ ...s, wildlife: ['herons'] })) - food(end({ ...s, wildlife: [] }))).toBe(1);
  });

  it('kingfishers: willow edges beside open water, 1 wellbeing a run of them', () => {
    const s = start(7, 'summer');
    s.hedges = [edgeKey(at(4, 0), at(5, 0))];
    expect(habitatOf(s, animal('kingfishers')).herds).toBe(1);
    // An edge between two land tiles is no place for them.
    s.hedges = [edgeKey(at(2, 0), at(3, 0))];
    expect(habitatOf(s, animal('kingfishers')).herds).toBe(0);
    s.hedges = [edgeKey(at(4, 0), at(5, 0))];
    const t = end({ ...s, wildlife: ['kingfishers'] });
    expect(t.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 pair of kingfishers',
      amount: 1,
    });
  });

  it('flamingos: 12 open shallows or more on a clean lake, 1 wellbeing a flock', () => {
    // A wide stretch of shallows: 5 rows of them, 3 wide.
    const s = start(7, 'summer');
    for (let r = 0; r < 5; r++)
      for (const c of [5, 6, 7]) s.map.tiles[hexKey(at(c, r))]!.type = 'shallows';
    expect(habitatOf(s, animal('flamingos')).herds).toBe(1);
    s.lake!.grey = 1;
    expect(habitatOf(s, animal('flamingos')).herds).toBe(0);
    s.lake!.grey = 0;
    s.harmony = 70;
    s.wildlife = [];
    updateWildlife(contentFor(LAKE, s), s, true);
    expect(s.wildlife).toContain('flamingos');
    expect(s.notices).toContain('Flamingos have come to the lake');
  });
});

describe("the lake's festivals", () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, LAKE);

  it('Flower Boats, the Silk Fair and Lanterns on the Water', () => {
    expect(LAKE.festivals.map((f) => [f.id, f.season, f.cost])).toEqual([
      ['flowerBoats', 'spring', { food: 5 }],
      ['silkFair', 'summer', { materials: 5 }],
      ['lanternsOnTheWater', 'autumn', { materials: 5 }],
    ]);
    const f = (id: string) => LAKE.festivals.find((x) => x.id === id)!;
    expect(f('flowerBoats').freeRerolls).toBe(1);
    expect(f('lanternsOnTheWater')).toMatchObject({ needsNightPowered: true, showsWildlife: true });
  });

  it('the Silk Fair: silk houses run once more that summer, and +3 wellbeing', () => {
    const fair = (held: boolean) => {
      let s = start(7, 'summer');
      const silk = put(s, 'silkHouse', 2, 0);
      put(s, 'solarCanopy', 3, 3);
      put(s, 'solarCanopy', 1, 3);
      s.stores.biomass = 40;
      if (held) s = hold(s, 'silkFair');
      const t = end(s);
      return { runs: t.lastReport!.runs[silk]?.runs ?? 0, t };
    };
    const max = LAKE.byId.silkHouse!.recipes!.maxRuns;
    expect(fair(false).runs).toBe(max);
    const held = fair(true);
    expect(held.runs).toBe(max + 1);
    expect(held.t.lastReport!.wellbeing.lines.find((l) => l.reason === 'Silk Fair')!.amount).toBe(
      3,
    );
  });
});
