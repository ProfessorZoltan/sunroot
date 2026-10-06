/**
 * Rainforest Gardens' wonder, animals and festivals (FG6, proposals/rainforest-gardens.md, Wonder,
 * wildlife and festivals): the Canopy Walk; hummingbirds, fruit bats, hornbills and jaguars; the
 * Feast of the First Rains, the Harvest of the Canopy and Odalan.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  createRun,
  eraGoal,
  eraGoalMet,
  eraGoalOr,
  habitatOf,
  hexKey,
  scoreRun,
  type RunState,
  type Season,
  type TileType,
} from '../src/sim';
import { grownLayers } from '../src/sim/queries';
import { wonderSiteProblem, wonderStage } from '../src/sim/wonder';
import { updateWildlife } from '../src/sim/wildlife';
import { contentFor } from '../src/sim/content/modifiers';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const F = biomeContent('rainforestGardens');
const WALK = 'canopyWalk';
const ALL = ['shrub', 'understory', 'canopy'];

// Scrub on the left for the settlement; rainforest on the right for the Walk.
const GLADE = [
  '~ , , , , , W W W',
  '~ , , , , , W W W',
  '~ , C , , , W W W',
  '~ , , , , , W W W',
  '~ , , , , , , , ,',
];

function start(year = 7, season: Season = 'spring', rows = GLADE): RunState {
  return scenario(rows, {
    content: F,
    year,
    season,
    citizens: 30,
    stores: { food: 400, materials: 400, biomass: 60, scraps: 20 },
    run: { water: true },
  });
}

let n = 0;
/** Sets a building down as it stands, `tile` under it if given, built long ago. */
function put(s: RunState, type: string, col: number, row: number, tile?: TileType): string {
  const uid = `f${++n}`;
  const h = at(col, row);
  if (tile) s.map.tiles[hexKey(h)]!.type = tile;
  s.buildings[uid] = { uid, type, at: h, builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}
/** A forest garden with these layers, added `ago` seasons back. */
function garden(s: RunState, col: number, row: number, layers = ALL, ago = 4): string {
  const uid = put(s, 'forestGarden', col, row);
  s.buildings[uid]!.layers = layers.map((id) => ({ id, turn: s.turn - ago }));
  return uid;
}
const end = (s: RunState) =>
  endSeason(
    {
      ...s,
      stores: { ...s.stores, food: 400, scraps: 20, biomass: Math.max(s.stores.biomass, 40) },
      wellbeing: 80,
    },
    F,
  );

/** A closed Midden Loop along the bottom row and `grown` gardens in all four storeys. */
function ready(year = 7, grown = 3): RunState {
  const s = start(year);
  garden(s, 1, 4);
  put(s, 'raisedHouse', 2, 4);
  put(s, 'kitchenMidden', 3, 4);
  put(s, 'charHearth', 4, 4);
  garden(s, 1, 0);
  garden(s, 3, 0, grown >= 3 ? ALL : ['shrub', 'understory']);
  const t = end(s);
  expect(t.loops.map((l) => l.combo)).toContain('middenLoop');
  return { ...t, stores: { ...t.stores, biomass: 60 } };
}
const startWalk = (s: RunState) => place(s, WALK, 7, 2, F);

describe('the Canopy Walk', () => {
  it('needs a closed Midden Loop and 3 forest gardens grown in all their storeys, from era 3', () => {
    expect(rejects(start(), { type: 'place', building: WALK, at: at(7, 2) }, F)).toMatch(
      /^the Canopy Walk needs a closed Midden Loop and 3 forest gardens with every layer grown \(0 now\)/,
    );
    expect(rejects(ready(7, 2), { type: 'place', building: WALK, at: at(7, 2) }, F)).toBe(
      'the Canopy Walk needs 3 forest gardens with every layer grown (2 now)',
    );
    expect(rejects(ready(4), { type: 'place', building: WALK, at: at(7, 2) }, F)).toBe(
      'the Canopy Walk can be started from era 3',
    );
  });

  it('stands on rainforest, and costs 60 materials and 30 biomass', () => {
    const s = ready();
    const t = startWalk(s);
    expect(t.buildings[uidAt(t, 7, 2)]!.type).toBe(WALK);
    expect(s.stores.materials - t.stores.materials).toBe(60);
    expect(s.stores.biomass - t.stores.biomass).toBe(30);
    expect(rejects(s, { type: 'place', building: WALK, at: at(3, 2) }, F)).toMatch(
      /can't be built over scrub/,
    );
  });

  it('finished: no field washes in the monsoon, layers grow a season sooner, +60 and a tier', () => {
    let s = startWalk(ready());
    const uid = uidAt(s, 7, 2);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(F, s, s.buildings[uid]!));
      s = end(s);
    }
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(s.lastReport!.wondersDone).toEqual([WALK]);
    const rules = contentFor(F, s);
    expect(rules.rules.forest!.leaches).toEqual([false, false, false, false]);
    expect(rules.byId.forestGarden!.layers!.map((l) => l.grows)).toEqual(
      F.byId.forestGarden!.layers!.map((l) => l.grows - 1),
    );
    // A milpa in the open keeps its fertility through the monsoon.
    put(s, 'milpa', 5, 4);
    while (s.season !== 'summer') s = end(s);
    s = end(s);
    expect(s.lastReport!.forest!.leached).toEqual([]);
    const score = scoreRun(F, s);
    expect(score.lines).toContainEqual({ reason: 'Canopy Walk', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Canopy Walk' });
  });

  it('meets the Bloom era goal', () => {
    const bloom = eraGoal(F, 4)!;
    expect(eraGoalOr(contentFor(F, start()), bloom)!.text).toBe('Or finish the Canopy Walk.');
    let s = startWalk(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(contentFor(F, s), s, bloom)).toBe(true);
  });

  it('has a site on every one of 40 forests', () => {
    const def = F.byId[WALK]!;
    let fit = 0;
    for (let i = 0; i < 40; i++) {
      const s = createRun(F, { seed: `site-${i}`, water: true, guided: false });
      if (Object.values(s.map.tiles).some((t) => !wonderSiteProblem(F, s, def, t))) fit++;
    }
    expect(fit).toBe(40);
  });
});

const animal = (id: string) => F.wildlife.find((a) => a.id === id)!;
// Scrub with a little forest, so Harmony stays low and yields aren't multiplied.
const CLEARING = [
  '~ , , , , , ,',
  '~ , C , , , ,',
  '~ , , , , , ,',
  '~ , , , , , ,',
  '~ , , , , , ,',
];

describe("the forest's animals", () => {
  it('arrive at Harmony 20, 40, 50 and 70', () => {
    expect(F.wildlife.map((a) => [a.id, a.harmony])).toEqual([
      ['hummingbirds', 20],
      ['fruitBats', 40],
      ['hornbills', 50],
      ['jaguars', 70],
    ]);
  });

  it('hummingbirds: a garden with its coffee grown; gardens and milpas within 2 +1 food in spring', () => {
    const s = start(7, 'spring', CLEARING);
    const g = garden(s, 4, 3, ['shrub'], 0);
    expect(habitatOf(s, animal('hummingbirds'), undefined, F).tiles).toEqual([]);
    s.buildings[g]!.layers = [{ id: 'shrub', turn: s.turn - 2 }];
    expect(habitatOf(s, animal('hummingbirds'), undefined, F).tiles).toEqual([hexKey(at(4, 3))]);
    const near = put(s, 'milpa', 4, 1);
    const far = put(s, 'milpa', 1, 0);
    const food = (t: RunState, uid: string) => t.lastReport!.yields[uid]?.food ?? 0;
    const withThem = end({ ...s, wildlife: ['hummingbirds'] });
    const without = end({ ...s, wildlife: [] });
    expect(food(withThem, near) - food(without, near)).toBe(1);
    expect(food(withThem, far) - food(without, far)).toBe(0);
    expect(food(withThem, g) - food(without, g)).toBe(1);
  });

  it('fruit bats: a grown canopy beside rainforest; canopies within 2 grow a season sooner', () => {
    const s = start(7, 'spring', CLEARING);
    s.map.tiles[hexKey(at(6, 2))]!.type = 'woodland';
    garden(s, 5, 2, ['canopy'], 4);
    expect(habitatOf(s, animal('fruitBats'), undefined, F).tiles).toEqual([hexKey(at(5, 2))]);
    // A canopy 3 seasons in, of its 4: grown where the bats are.
    const young = garden(s, 4, 3, ['canopy'], 3);
    const b = s.buildings[young]!;
    const c = contentFor(F, s);
    expect(grownLayers(c, s, b)).toEqual([]);
    expect(grownLayers(c, { ...s, wildlife: ['fruitBats'] }, b).map((l) => l.id)).toEqual([
      'canopy',
    ]);
    // Out of their reach, it grows in its own time.
    const far = garden(s, 1, 4, ['canopy'], 3);
    expect(grownLayers(c, { ...s, wildlife: ['fruitBats'] }, s.buildings[far]!)).toEqual([]);
  });

  it('hornbills: 6 rainforest tiles together; each autumn bare and scrub beside them heal a step', () => {
    const rows = [
      '~ . , W W W ,',
      '~ , C W W W .',
      '~ , , , , , ,',
      '~ . . . . . .',
      '~ . . . . . .',
    ];
    const s = start(7, 'autumn', rows);
    expect(habitatOf(s, animal('hornbills')).herds).toBe(1);
    put(s, 'workshop', 6, 1);
    const t = end({ ...s, wildlife: ['hornbills'] });
    const type = (st: RunState, c: number, r: number) => st.map.tiles[hexKey(at(c, r))]!.type;
    // Beside the forest: scrub to meadow; under a building, as it was; far off, as it was.
    expect(type(t, 6, 0)).toBe('meadow');
    expect(type(t, 5, 2)).toBe('meadow');
    expect(type(t, 6, 1)).toBe('barren');
    expect(type(t, 1, 0)).toBe('barren');
    expect(type(t, 3, 4)).toBe('barren');
    expect(t.lastReport!.wildlife!.healed).toContain(hexKey(at(6, 0)));
    // Only in autumn.
    const summer = end({ ...start(7, 'summer', rows), wildlife: ['hornbills'] });
    expect(type(summer, 6, 0)).toBe('scrub');
  });

  it('jaguars: 10 rainforest tiles unbroken, 1 wellbeing a range', () => {
    const rows = [
      '~ , , W W W W',
      '~ , C W W W W',
      '~ , , , W W ,',
      '~ , , , , , ,',
      '~ , , , , , ,',
    ];
    const s = start(7, 'summer', rows);
    expect(habitatOf(s, animal('jaguars')).herds).toBe(1);
    s.map.tiles[hexKey(at(5, 2))]!.type = 'scrub';
    expect(habitatOf(s, animal('jaguars')).herds).toBe(0);
    s.map.tiles[hexKey(at(5, 2))]!.type = 'woodland';
    const t = end({ ...s, wildlife: ['jaguars'] });
    expect(t.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 range of jaguars',
      amount: 1,
    });
    s.harmony = 70;
    s.wildlife = [];
    updateWildlife(contentFor(F, s), s, true);
    expect(s.wildlife).toContain('jaguars');
    expect(s.notices).toContain('Jaguars have come to the forest');
  });
});

describe("the forest's festivals", () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, F);
  const food = (t: RunState, uid: string) => t.lastReport!.yields[uid]?.food ?? 0;

  it('the Feast of the First Rains, the Harvest of the Canopy and Odalan', () => {
    expect(F.festivals.map((f) => [f.id, f.season, f.cost])).toEqual([
      ['rainsFeast', 'spring', { food: 5 }],
      ['canopyHarvest', 'summer', { materials: 5 }],
      ['odalan', 'autumn', { materials: 5 }],
    ]);
    expect(F.festivals.find((f) => f.id === 'odalan')!.showsWildlife).toBe(true);
  });

  it('the Feast of the First Rains: milpas sown this spring +1 food, and +3 wellbeing', () => {
    const s = start(7, 'spring', CLEARING);
    const old = put(s, 'milpa', 4, 3);
    const sown = put(s, 'milpa', 4, 1);
    s.buildings[sown]!.builtTurn = s.turn;
    const held = end(hold(s, 'rainsFeast'));
    const plain = end(s);
    expect(food(held, sown) - food(plain, sown)).toBe(1);
    expect(food(held, old) - food(plain, old)).toBe(0);
    expect(held.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'festival',
      reason: 'Feast of the First Rains',
      amount: 3,
    });
  });

  it('the Harvest of the Canopy: gardens with their canopy grown +1 food that summer', () => {
    const s = start(7, 'summer', CLEARING);
    const crowned = garden(s, 4, 3, ['canopy']);
    const bare = garden(s, 4, 1, []);
    const held = end(hold(s, 'canopyHarvest'));
    const plain = end(s);
    expect(food(held, crowned) - food(plain, crowned)).toBe(1);
    expect(food(held, bare) - food(plain, bare)).toBe(0);
  });

  it('Odalan: rice terraces beside a Water Temple +1 food that autumn', () => {
    const s = start(7, 'autumn', CLEARING);
    // No cyclone to damage the terraces this autumn.
    s.forecast = { ...s.forecast, event: 'firstRains' };
    put(s, 'waterTemple', 4, 2, 'hill');
    const under = put(s, 'riceTerrace', 4, 3, 'hill');
    const apart = put(s, 'riceTerrace', 1, 4, 'hill');
    const held = end(hold(s, 'odalan'));
    const plain = end(s);
    expect(food(held, under) - food(plain, under)).toBe(1);
    expect(food(held, apart) - food(plain, apart)).toBe(0);
  });
});
