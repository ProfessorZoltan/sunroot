/**
 * Rainforest Gardens' combos, tunings and charters (proposals/rainforest-gardens.md, FG3): the
 * Midden and Kihamba loops, the Milpa Cycle and the forest's return, Four Storeys, the Subak,
 * the Living Mosaic, Pepper on the Tree and Cool Shade; the forest's tunings, Forest First and
 * Swidden Rights.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  canPlace,
  computeHarmony,
  harmonyLines,
  hexKey,
  projectSeason,
  type RunState,
  type Season,
  type TileType,
} from '../src/sim';
import { contentFor } from '../src/sim/content/modifiers';
import { comboPicture } from '../src/game/comboPicture';
import { at, endSeason, place, rejects, scenario } from './helpers';

const F = biomeContent('rainforestGardens');

// Scrub and a little meadow: Harmony stays low, so yields aren't multiplied.
const FIELD = ['~ , , , , , ,', '~ , C , , , ,', '~ , , , , , ,', '~ , , , , , ,', '~ , , , , , ,'];
function start(season: Season = 'spring', rows = FIELD): RunState {
  return scenario(rows, {
    content: F,
    season,
    citizens: 40,
    stores: { food: 400, materials: 200 },
  });
}
const end = (s: RunState) =>
  endSeason(
    { ...s, stores: { ...s.stores, food: 400, scraps: 20, biomass: 20 }, wellbeing: 80 },
    F,
  );
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
const made = (s: RunState, uid: string, res: 'food' | 'materials' | 'compost' = 'food') =>
  s.lastReport!.yields[uid]?.[res] ?? 0;
const combos = (s: RunState) => s.lastReport!.combos.map((h) => h.combo);
let n = 0;
/** Sets a building down as it stands, built long ago. */
function put(s: RunState, type: string, col: number, row: number, on?: TileType): string {
  const uid = `c${++n}`;
  if (on) tile(s, col, row).type = on;
  s.buildings[uid] = { uid, type, at: at(col, row), builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}
/** A forest garden with these layers, grown. */
function garden(s: RunState, col: number, row: number, layers: string[], on?: TileType): string {
  const uid = put(s, 'forestGarden', col, row, on);
  s.buildings[uid]!.layers = layers.map((id) => ({ id, turn: s.turn - 4 }));
  return uid;
}

describe('the forest’s loops', () => {
  // Spring and summer: no cyclone to strike the members, and the gardens bear.
  it('the Midden Loop: garden, house, midden, hearth; +1 food, dark earth twice as fast', () => {
    let s = start('spring');
    const g = garden(s, 2, 3, []);
    put(s, 'raisedHouse', 3, 3);
    const midden = put(s, 'kitchenMidden', 4, 3);
    put(s, 'charHearth', 5, 3);
    s = end(s);
    expect(s.loops.map((l) => l.combo)).toContain('middenLoop');
    expect(s.buildings[midden]!.darkening).toBe(1);
    const before = s.lastReport!.yields[g]!.food!;
    s = end(s);
    expect(s.lastReport!.math[g]!.join(' ')).toMatch(/\+1 food from the Midden Loop/);
    expect(made(s, g)).toBeGreaterThan(before);
    // A fed season in the loop counts twice: 1, then 3.
    expect(s.buildings[midden]!.darkening).toBe(3);
  });

  it('the Kihamba Loop: bee tree, a garden with its understory, a stall barn', () => {
    const s = start('spring');
    put(s, 'beeTree', 2, 3, 'woodland');
    const g = put(s, 'forestGarden', 3, 3);
    const barn = put(s, 'stallBarn', 4, 3);
    // No understory, no loop.
    expect(end(s).loops.map((l) => l.combo)).not.toContain('kihambaLoop');
    s.buildings[g]!.layers = [{ id: 'understory', turn: s.turn - 1 }];
    let t = end(s);
    expect(t.loops.map((l) => l.combo)).toContain('kihambaLoop');
    t = end(t);
    expect(t.lastReport!.math[g]!.join(' ')).toMatch(/\+1 food from the Kihamba Loop/);
    expect(t.lastReport!.math[barn]!.join(' ')).toMatch(/\+1 compost from the Kihamba Loop/);
  });
});

describe('the Milpa Cycle', () => {
  it('a milpa that has stood 6 seasons by a tree nursery becomes an orchard garden', () => {
    const s = start('summer');
    const milpa = put(s, 'milpa', 3, 3);
    s.buildings[milpa]!.builtTurn = s.turn - 4;
    put(s, 'treeNursery', 4, 3);
    expect(end(s).buildings[milpa]!.type).toBe('milpa');
    s.buildings[milpa]!.builtTurn = s.turn - 5;
    const t = end(s);
    expect(t.buildings[milpa]!.type).toBe('orchardGarden');
    expect(t.lastReport!.combos.map((h) => h.combo)).toContain('milpaCycle');
  });

  it('an orchard garden keeps its field: the monsoon washes nothing from under its trees', () => {
    const s = start('summer');
    const o = put(s, 'orchardGarden', 3, 3);
    tile(s, 3, 3).fertility = 2;
    const t = end(s);
    expect(tile(t, 3, 3).fertility).toBe(2);
    expect(made(t, o)).toBe(2 + 2);
  });

  it('8 seasons on, the forest returns: a forest garden with three layers grown, on woodland', () => {
    const s = start('autumn');
    const o = put(s, 'orchardGarden', 3, 3);
    s.buildings[o]!.evolvedFrom = 'milpa';
    s.buildings[o]!.evolvedTurn = s.turn - 7;
    const t = end(s);
    const b = t.buildings[o]!;
    expect(b.type).toBe('forestGarden');
    expect(b.layers!.map((l) => l.id)).toEqual(['shrub', 'understory', 'canopy']);
    expect(tile(t, 3, 3).type).toBe('woodland');
    // Grown at once: it stands in four storeys from the next season.
    const next = projectSeason(F, t, t.season, { forecast: true });
    expect(next.combos.find((h) => h.combo === 'fourStoreys')?.members).toEqual([o]);
  });
});

describe('the forest’s formations', () => {
  it('Four Storeys: +1 food, and it counts as rainforest for Harmony', () => {
    const s = start('summer');
    const g = garden(s, 3, 3, ['shrub', 'understory']);
    const before = computeHarmony(F, s);
    const plain = end(s);
    s.buildings[g]!.layers!.push({ id: 'canopy', turn: s.turn - 4 });
    expect(computeHarmony(F, s)).toBe(before + 2);
    expect(harmonyLines(F, s).find((l) => l.label.includes('woodland'))?.amount).toBe(2);
    const t = end(s);
    expect(combos(t)).toContain('fourStoreys');
    expect(t.lastReport!.math[g]).toContain('+1 food from the Four Storeys');
    expect(made(plain, g)).toBeLessThan(made(t, g));
  });

  it('the Subak: a water temple ringed by 3 rice terraces; +1 food each in autumn', () => {
    const s = start('autumn');
    put(s, 'waterTemple', 3, 2, 'hill');
    const terraces = [
      [2, 2],
      [4, 2],
      [3, 1],
    ].map(([c, r]) => put(s, 'riceTerrace', c!, r!, 'hill'));
    // A forecast: the cyclone's draw can't strike them.
    const t = projectSeason(F, s, s.season, { forecast: true });
    expect(t.combos.map((h) => h.combo)).toContain('subak');
    for (const uid of terraces) expect(t.math[uid]).toContain('+1 food from the Subak');
  });

  // Rainforest over most of the land, one field beside it.
  const WOODS = ['~ W W W W W', '~ W C W W W', '~ W W W W ,', '~ W W W W W'];

  it('the Living Mosaic: 7 tenths of the land under trees, +5 Harmony and no fire', () => {
    const s = start('winter', WOODS);
    expect(harmonyLines(F, s)).toContainEqual({ label: 'Living Mosaic', amount: 5 });
    const forecast = projectSeason(F, s, s.season, { forecast: true });
    expect(forecast.fireRisk).toEqual([]);
    expect(end(s).lastReport!.burned).toEqual([]);
    // Clear enough of it and the fire can start again.
    for (const [c, r] of [
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
    ] as const)
      tile(s, c, r).type = 'barren';
    expect(projectSeason(F, s, s.season, { forecast: true }).fireRisk!.length).toBeGreaterThan(0);
  });
});

describe('the forest’s neighbours', () => {
  it('Pepper on the Tree: a grown canopy beside another garden, +1 materials', () => {
    const s = start('summer');
    const tall = garden(s, 3, 3, ['canopy']);
    const young = put(s, 'forestGarden', 4, 3);
    const t = end(s);
    expect(combos(t)).toContain('pepperOnTheTree');
    expect(made(t, tall, 'materials')).toBe(1);
    expect(made(t, young, 'materials')).toBe(0);
    // Alone, the canopy bears no pepper.
    delete s.buildings[young];
    s.priority = s.priority.filter((u) => u !== young);
    expect(made(end(s), tall, 'materials')).toBe(0);
  });

  it('Cool Shade: a raised house beside a grown canopy, in summer', () => {
    const s = start('summer');
    put(s, 'raisedHouse', 3, 3);
    const g = put(s, 'forestGarden', 4, 3);
    expect(combos(end(s))).not.toContain('coolShade');
    s.buildings[g]!.layers = [{ id: 'canopy', turn: s.turn - 4 }];
    expect(combos(end(s))).toContain('coolShade');
  });

  it('every forest combo has a picture', () => {
    const own = [
      'middenLoop',
      'kihambaLoop',
      'milpaCycle',
      'forestReturns',
      'fourStoreys',
      'subak',
      'livingMosaic',
      'pepperOnTheTree',
      'coolShade',
    ];
    for (const id of own) {
      const p = comboPicture(F, F.comboById[id]!);
      expect(p.slots.length, id).toBeGreaterThan(0);
    }
    expect(comboPicture(F, F.comboById.fourStoreys!).note).toBe(
      'with its shrub layer, understory and canopy grown',
    );
    expect(comboPicture(F, F.comboById.forestReturns!).note).toBe('once it has stood 8 seasons');
  });
});

describe('the forest’s tunings and charters', () => {
  const tuned = (...tunings: string[]) => contentFor(F, { ...start(), tunings });

  it('eight tunings of its own', () => {
    const c = tuned(
      'deepMulch',
      'coffeeTrade',
      'fastCanopy',
      'firebreaks',
      'seedExchange',
      'coolHouses',
      'secondMilpa',
      'charcoalKilns',
    );
    const layers = c.byId.forestGarden!.layers!;
    expect(layers[1]!.helps[0]!.amount).toBe(2);
    expect(layers[0]!.yields.materials).toEqual([0, 0, 2, 0]);
    expect(layers[2]!.grows).toBe(3);
    expect(c.byId.livingFence!.cost).toBe(0);
    expect(c.byId.forestGarden!.cost).toBe(3);
    expect(c.byId.raisedHouse!.demand!.cool.day).toEqual([0, 0, 0, 0]);
    expect(c.byId.milpa!.yields.food).toEqual([2, 3, 3, 0]);
    expect(c.byId.charHearth!.charcoal!.biomass).toBe(1);
  });

  it('Forest First: no milpa burns the forest, and forest gardens make 1 more food', () => {
    const s = { ...start('summer', ['~ W W ,', '~ , C ,']), charters: ['forestFirst'] };
    expect(rejects(s, { type: 'place', building: 'milpa', at: at(1, 0) }, F)).toBe(
      "the forest may not be cleared: Milpa can't burn woodland",
    );
    expect(canPlace(contentFor(F, s), s, 'milpa', at(3, 0)).ok).toBe(true);
    expect(contentFor(F, s).byId.forestGarden!.yields.food).toEqual([2, 3, 3, 1]);
  });

  it('Swidden Rights: free milpas that burn to meadow, but the rain takes fertility in autumn too', () => {
    let s: RunState = { ...start('autumn', ['~ W W ,', '~ , C ,']), charters: ['swiddenRights'] };
    const materials = s.stores.materials;
    s = place(s, 'milpa', 1, 0, F);
    expect(s.stores.materials).toBe(materials);
    expect(tile(s, 1, 0)).toMatchObject({ type: 'meadow', fertility: 3 });
    s = end(s);
    expect(tile(s, 1, 0).fertility).toBe(2);
  });
});
