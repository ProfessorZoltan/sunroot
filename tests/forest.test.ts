/**
 * Rainforest Gardens' soil and layers (proposals/rainforest-gardens.md, FG1): a forest garden's
 * layers, each growing and yielding and helping the others; fertility, burned into a field
 * cleared from rainforest, washed out by the monsoon where nothing covers it, put back by
 * compost; and dark earth, made by a kitchen midden with a char hearth's charcoal. The biome
 * comes later (FG2), so these tests use the Reach with the forest rules and a few forest
 * buildings added.
 *
 * Maps put the river in the first column; farms stand near it, so the Reach's low river in
 * summer leaves them be.
 */
import { describe, expect, it } from 'vitest';
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { hexKey, type Content, type RunState, type TileType } from '../src/sim';
import { fertilityOf } from '../src/sim/forest';
import { act, at, content, endSeason, place, rejects, scenario, uidAt } from './helpers';

const LAND: TileType[] = ['barren', 'scrub', 'meadow', 'woodland', 'darkEarth'];
const BUILDINGS = [
  {
    id: 'milpa',
    name: 'Milpa',
    cost: 2,
    workers: 1,
    kind: 'food',
    placement: { tiles: ['woodland', 'meadow', 'scrub', 'darkEarth'] },
    farmland: true,
    burns: { from: ['woodland'], to: 'scrub' },
    fertilityFood: 1,
    yields: { food: [2, 3, 2, 0] },
  },
  {
    id: 'forestGarden',
    name: 'Forest Garden',
    cost: 4,
    workers: 1,
    kind: 'food',
    placement: { tiles: ['woodland', 'meadow', 'scrub', 'darkEarth'] },
    farmland: true,
    yields: { food: [1, 2, 2, 1] },
    layers: [
      { id: 'shrub', name: 'Shrub layer', cost: 2, grows: 2, yields: { materials: [0, 1, 2, 0] } },
      {
        id: 'understory',
        name: 'Understory',
        cost: 2,
        grows: 1,
        yields: { food: [1, 1, 1, 1] },
        helps: [{ layer: 'ground', resource: 'food', amount: 1 }],
      },
      {
        id: 'canopy',
        name: 'Canopy',
        cost: 3,
        grows: 4,
        yields: { food: [0, 2, 3, 1] },
        helps: [{ layer: 'shrub', resource: 'materials', amount: 1 }],
        covers: true,
      },
    ],
  },
  {
    id: 'kitchenMidden',
    name: 'Kitchen Midden',
    cost: 2,
    workers: 0,
    kind: 'nature',
    placement: { tiles: LAND },
    midden: { scraps: 2, seasons: 4, range: 2 },
  },
  {
    id: 'charHearth',
    name: 'Char Hearth',
    cost: 3,
    workers: 1,
    kind: 'industry',
    placement: { tiles: LAND },
    charcoal: { biomass: 2 },
  },
];

type Raw = { rules: Record<string, unknown>; buildings: { id: string }[] };
function forest(edit?: (raw: Raw) => void): Content {
  const raw = structuredClone(willowReach) as unknown as Raw;
  raw.rules.forest = {
    maxFertility: 4,
    fertility: { woodland: 3, meadow: 2, scrub: 1, darkEarth: 4 },
    ash: 3,
    leaches: [false, true, false, false],
    bareFactor: 0.5,
    keeps: ['darkEarth'],
    darkEarthFood: 1,
    darkens: ['barren', 'scrub', 'meadow'],
  };
  (raw.rules.harmony as { perTile: Record<string, number> }).perTile.darkEarth = 1;
  // The Reach has its own Forest Garden now (a Canopy Quarter card): the forest's replaces it.
  const ids = new Set(BUILDINGS.map((b) => b.id));
  raw.buildings = [...raw.buildings.filter((b) => !ids.has(b.id)), ...structuredClone(BUILDINGS)];
  edit?.(raw);
  return loadBiome(raw as unknown as typeof willowReach);
}
const F = forest();

// Little woodland and no meadow to speak of: Harmony stays below 20, so yields aren't multiplied.
const MAP = ['~ W W . . .', '~ , , C . .', '~ , , . . .', '~ . . . . .'];
const start = (season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring') =>
  scenario(MAP, { content: F, season, citizens: 30, stores: { food: 500, materials: 200 } });
const end = (s: RunState) =>
  endSeason(
    { ...s, stores: { ...s.stores, food: 500, scraps: 20, biomass: 20 }, wellbeing: 80 },
    F,
  );
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
const made = (s: RunState, uid: string, res: 'food' | 'materials' = 'food') =>
  s.lastReport!.yields[uid]?.[res] ?? 0;

let n = 0;
/** Sets a building down as it stands, built long ago. */
function put(s: RunState, type: string, col: number, row: number): string {
  const uid = `f${++n}`;
  s.buildings[uid] = { uid, type, at: at(col, row), builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}

describe('the forest rules are off without them', () => {
  it('leave the Reach with no fertility, and its compost as it was', () => {
    expect(content.rules.forest).toBeUndefined();
    const s = scenario(MAP, { stores: { compost: 10 } });
    expect(fertilityOf(content, tile(s, 1, 1))).toBeNull();
    expect(rejects(s, { type: 'spreadCompost', at: at(1, 0) })).toBe(
      "compost can't improve woodland",
    );
  });

  it('a forest building needs them, and a layer can help only one it has', () => {
    expect(() =>
      loadBiome({
        ...structuredClone(willowReach),
        buildings: [...structuredClone(willowReach.buildings), BUILDINGS[0]],
      } as unknown as typeof willowReach),
    ).toThrow(/milpa needs rules.forest/);
    expect(() =>
      forest((raw) => {
        const garden = raw.buildings.find((b) => b.id === 'forestGarden') as unknown as {
          layers: { helps: { layer: string }[] }[];
        };
        garden.layers[2]!.helps[0]!.layer = 'vines';
      }),
    ).toThrow(/forestGarden.layers.canopy helps vines, which is not one of its layers/);
  });
});

describe('fertility', () => {
  it('a milpa burns rainforest clear: a field of scrub with 3 fertility, and less Harmony', () => {
    const s = start();
    const t = place(s, 'milpa', 1, 0, F);
    expect(tile(t, 1, 0)).toMatchObject({ type: 'scrub', fertility: 3 });
    expect(t.harmony).toBe(s.harmony - 2);
    // On a clearing it burns nothing: the field has the scrub's own fertility.
    const c = place(s, 'milpa', 1, 1, F);
    expect(tile(c, 1, 1).type).toBe('scrub');
    expect(fertilityOf(F, tile(c, 1, 1))).toBe(1);
  });

  it('a milpa makes 1 more food for each point of fertility', () => {
    let s = place(start(), 'milpa', 1, 0, F);
    s = place(s, 'milpa', 1, 1, F);
    s = end(s);
    expect(made(s, uidAt(s, 1, 0))).toBe(2 + 3);
    expect(made(s, uidAt(s, 1, 1))).toBe(2 + 1);
    expect(s.lastReport!.math[uidAt(s, 1, 0)]!.join(' ')).toMatch(/\+3 fertility 3/);
  });

  it('the monsoon washes 1 out of every farmed tile nothing covers, after the harvest', () => {
    let s = start('summer');
    const milpa = put(s, 'milpa', 1, 1);
    tile(s, 1, 1).fertility = 3;
    s = end(s);
    expect(made(s, milpa)).toBe(3 + 3);
    expect(tile(s, 1, 1).fertility).toBe(2);
    expect(s.lastReport!.forest!.leached).toEqual([hexKey(at(1, 1))]);
    // Only the monsoon: autumn's rain leaves it be.
    s = end(s);
    expect(tile(s, 1, 1).fertility).toBe(2);
    // Open land with nothing farmed on it keeps its own.
    expect(tile(s, 2, 1).fertility).toBeUndefined();
  });

  it('a field with none left makes half, and wears a step down the ladder each monsoon', () => {
    let s = start('summer');
    const milpa = put(s, 'milpa', 1, 1);
    tile(s, 1, 1).fertility = 0;
    s = end(s);
    expect(made(s, milpa)).toBe(1); // 3 × 0.5, rounded down
    expect(s.lastReport!.math[milpa]!.join(' ')).toMatch(/× 0.5 no fertility left/);
    expect(tile(s, 1, 1).type).toBe('barren');
    expect(s.lastReport!.forest!.wornOut).toEqual([hexKey(at(1, 1))]);
  });

  it('compost spread on a field feeds it 1, up to 4, as well as healing the land', () => {
    let s = start();
    s.stores.compost = 20;
    put(s, 'milpa', 1, 1);
    tile(s, 1, 1).fertility = 3;
    s = act(s, { type: 'spreadCompost', at: at(1, 1) }, F);
    expect(tile(s, 1, 1)).toMatchObject({ type: 'meadow', fertility: 4 });
    s = act(s, { type: 'spreadCompost', at: at(1, 1) }, F);
    expect(tile(s, 1, 1)).toMatchObject({ type: 'woodland', fertility: 4 });
    expect(rejects(s, { type: 'spreadCompost', at: at(1, 1) }, F)).toBe(
      "compost can't improve woodland",
    );
    // At the top of the ladder, a field short of fertility still takes it.
    tile(s, 1, 1).fertility = 1;
    s = act(s, { type: 'spreadCompost', at: at(1, 1) }, F);
    expect(tile(s, 1, 1).fertility).toBe(2);
    // Land with no field on it only heals.
    s = act(s, { type: 'spreadCompost', at: at(2, 1) }, F);
    expect(tile(s, 2, 1)).toMatchObject({ type: 'meadow' });
    expect(tile(s, 2, 1).fertility).toBeUndefined();
  });
});

describe("a forest garden's layers", () => {
  const add = (s: RunState, uid: string, layer: string) =>
    act(s, { type: 'addLayer', uid, layer }, F);

  it('are added one a season, from the season after it is built, each for its cost', () => {
    let s = place(start(), 'forestGarden', 1, 1, F);
    const uid = uidAt(s, 1, 1);
    expect(rejects(s, { type: 'addLayer', uid, layer: 'canopy' }, F)).toBe(
      'the Forest Garden takes one layer a season: add its canopy next season',
    );
    s = end(s);
    const before = s.stores.materials;
    s = add(s, uid, 'canopy');
    expect(before - s.stores.materials).toBe(3);
    expect(s.buildings[uid]!.layers).toEqual([{ id: 'canopy', turn: s.turn }]);
    expect(rejects(s, { type: 'addLayer', uid, layer: 'shrub' }, F)).toMatch(/one layer a season/);
    s = end(s);
    expect(rejects(s, { type: 'addLayer', uid, layer: 'canopy' }, F)).toBe(
      'the Forest Garden has its canopy already',
    );
    expect(rejects(s, { type: 'addLayer', uid, layer: 'vines' }, F)).toBe(
      'the Forest Garden has no vines layer',
    );
    s.stores.materials = 1;
    expect(rejects(s, { type: 'addLayer', uid, layer: 'shrub' }, F)).toBe(
      'the shrub layer costs 2 materials',
    );
    const milpa = put(s, 'milpa', 2, 2);
    expect(rejects(s, { type: 'addLayer', uid: milpa, layer: 'shrub' }, F)).toBe(
      'the Milpa takes no layers',
    );
  });

  it("don't change the state they were added to", () => {
    let s = start();
    const uid = put(s, 'forestGarden', 1, 1);
    s = add(s, uid, 'understory');
    const t = add(end(s), uid, 'shrub');
    expect(s.buildings[uid]!.layers).toHaveLength(1);
    expect(t.buildings[uid]!.layers).toHaveLength(2);
  });

  it('each yields once grown; the understory mulches the ground layer, +1 food', () => {
    let s = start();
    const uid = put(s, 'forestGarden', 1, 1);
    s = add(s, uid, 'understory');
    s = end(s); // spring: still growing
    expect(made(s, uid)).toBe(1);
    expect(s.lastReport!.math[uid]).toContain('Understory: still growing (0/1 seasons)');
    s = end(s); // summer: ground 2 + 1 mulch, understory 1
    expect(made(s, uid)).toBe(3 + 1);
    expect(s.lastReport!.math[uid]!.join(' ')).toMatch(/Food: 2 in summer \+1 understory/);
    expect(s.lastReport!.flows.food!.made['Forest Garden (understory)']!.amount).toBe(1);
  });

  it('the canopy helps the shrub layer, +1 materials while it makes any', () => {
    const s = start('autumn');
    const uid = put(s, 'forestGarden', 1, 1);
    s.buildings[uid]!.layers = [
      { id: 'shrub', turn: s.turn - 2 },
      { id: 'canopy', turn: s.turn - 4 },
    ];
    const t = end(s);
    expect(made(t, uid, 'materials')).toBe(2 + 1);
    expect(made(t, uid)).toBe(2 + 3);
    // In winter the shrub makes nothing, and the canopy adds nothing to it.
    expect(made(end(t), uid, 'materials')).toBe(0);
  });

  it('a grown canopy covers the tile: the monsoon washes none of its fertility out', () => {
    const s = start('summer');
    const covered = put(s, 'forestGarden', 1, 1);
    const young = put(s, 'forestGarden', 1, 2);
    s.buildings[covered]!.layers = [{ id: 'canopy', turn: s.turn - 4 }];
    s.buildings[young]!.layers = [{ id: 'canopy', turn: s.turn - 3 }];
    const t = end(s);
    expect(fertilityOf(F, tile(t, 1, 1))).toBe(1);
    expect(fertilityOf(F, tile(t, 1, 2))).toBe(0);
  });
});

describe('dark earth', () => {
  /** A midden at (3, 2) beside the camp, a char hearth beside it, a milpa within 1. */
  function ready() {
    const s = start();
    const midden = put(s, 'kitchenMidden', 3, 2);
    const hearth = put(s, 'charHearth', 4, 2);
    const milpa = put(s, 'milpa', 2, 2);
    return { s, midden, hearth, milpa };
  }

  it('a midden fed scraps, with charcoal near, turns a field within 1 to dark earth in 4 seasons', () => {
    const { midden, hearth, ...r } = ready();
    let s = r.s;
    for (let i = 0; i < 3; i++) s = end(s);
    expect(s.buildings[midden]!.darkening).toBe(3);
    expect(s.lastReport!.forest!.charcoal).toEqual([hearth]);
    expect(s.lastReport!.flows.biomass!.used['Char Hearth']!.amount).toBe(2);
    expect(s.lastReport!.flows.scraps!.used['Kitchen Midden']!.amount).toBe(2);
    s = end(s);
    expect(s.lastReport!.forest!.darkened).toEqual([hexKey(at(2, 2))]);
    expect(tile(s, 2, 2)).toMatchObject({ type: 'darkEarth', fertility: 4 });
    expect(s.buildings[midden]!.darkening).toBe(0);
  });

  it('no charcoal near, or too few scraps: no nearer', () => {
    const { s, midden, hearth } = ready();
    const cold = { ...s, buildings: { ...s.buildings } };
    delete cold.buildings[hearth];
    const t = end(cold);
    expect(t.buildings[midden]!.darkening).toBeUndefined();
    expect(t.lastReport!.math[midden]!.join(' ')).toMatch(/no charcoal within 2/);
    const hungry = endSeason({ ...s, stores: { ...s.stores, scraps: 1, biomass: 20 } }, F);
    expect(hungry.lastReport!.forest!.middens).toEqual({});
    expect(hungry.lastReport!.math[midden]!.join(' ')).toMatch(/took 1 scraps of the 2/);
  });

  it('dark earth: +1 food to a farm on it, and the monsoon never washes it out', () => {
    let s = start('summer');
    const milpa = put(s, 'milpa', 1, 1);
    tile(s, 1, 1).type = 'darkEarth';
    s = end(s);
    expect(made(s, milpa)).toBe(3 + 4 + 1);
    expect(s.lastReport!.math[milpa]!.join(' ')).toMatch(/\+1 dark earth/);
    expect(fertilityOf(F, tile(s, 1, 1))).toBe(4);
    expect(s.lastReport!.forest!.leached).toEqual([]);
  });
});
