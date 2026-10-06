/**
 * Rainforest Gardens' simulation (proposals/rainforest-gardens.md, FG2): the forest's map and
 * its Harmony counted from the forest as it stood; the first rains, the monsoon, the cyclone and
 * the dry season's fire; cooling and shade under the canopy; and the forest's buildings.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  computeHarmony,
  createRun,
  goalProgress,
  harmonyLines,
  hexDistance,
  hexKey,
  hexNeighbors,
  projectSeason,
  type RunState,
  type Season,
  type TileType,
} from '../src/sim';
import { coolDemand } from '../src/sim/queries';
import { edgeKey } from '../src/sim/edges';
import { snowless } from '../src/render/lands';
import { artSeason } from '../src/render/sprites';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const F = biomeContent('rainforestGardens');

// Meadow round the camp (Harmony about 12, so yields aren't multiplied), the river on the left.
const GLADE = ['~ m m m m , ,', '~ m C m m , ,', '~ m m m m , ,', '~ f m , , , ,', '~ f , , , , ,'];
function start(season: Season = 'spring', rows = GLADE): RunState {
  return scenario(rows, {
    content: F,
    season,
    citizens: 30,
    stores: { food: 400, materials: 200, biomass: 20, scraps: 10 },
  });
}
const end = (s: RunState) =>
  endSeason({ ...s, stores: { ...s.stores, food: 400 }, wellbeing: 80 }, F);
const tile = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!;
const made = (s: RunState, uid: string, res: 'food' | 'materials' | 'compost' = 'food') =>
  s.lastReport!.yields[uid]?.[res] ?? 0;
let n = 0;
/** Sets a building down as it stands, built long ago. */
function put(s: RunState, type: string, col: number, row: number, on?: TileType): string {
  const uid = `r${++n}`;
  if (on) tile(s, col, row).type = on;
  s.buildings[uid] = { uid, type, at: at(col, row), builtTurn: s.turn - 8 };
  s.priority.push(uid);
  return uid;
}
/** A forest garden with a grown canopy. */
function canopied(s: RunState, col: number, row: number, on: TileType = 'scrub'): string {
  const uid = put(s, 'forestGarden', col, row, on);
  s.buildings[uid]!.layers = [{ id: 'canopy', turn: s.turn - 4 }];
  return uid;
}

describe('the forest map', () => {
  const maps = Array.from({ length: 20 }, (_, i) =>
    createRun(F, { seed: `forest-${i}`, guided: false }),
  );

  it('is rainforest over half or more, with the river, floodplain, hills and the estate', () => {
    for (const s of maps) {
      const tiles = Object.values(s.map.tiles);
      const count = (t: TileType) => tiles.filter((x) => x.type === t).length;
      expect(count('woodland') / tiles.length).toBeGreaterThanOrEqual(0.45);
      expect(count('woodland') / tiles.length).toBeLessThanOrEqual(0.65);
      expect(count('river')).toBe(10);
      expect(count('hill')).toBeGreaterThan(0);
      expect(count('barren')).toBeGreaterThan(0);
      const ruins = tiles.filter((t) => t.type === 'ruin');
      expect(ruins.map((t) => t.salvage)).toEqual([30, 30, 30, 30]);
      // The floodplain lies along the river.
      for (const key of s.map.floodOrder)
        expect(
          hexNeighbors(s.map.tiles[key]!).some((h) => s.map.tiles[hexKey(h)]?.type === 'river'),
        ).toBe(true);
    }
  });

  it('puts the camp on a clearing by the forest, near the estate', () => {
    for (const s of maps) {
      const camp = s.buildings.b0!.at;
      expect(s.map.tiles[hexKey(camp)]!.type).toBe('scrub');
      expect(hexNeighbors(camp).some((h) => s.map.tiles[hexKey(h)]?.type === 'woodland')).toBe(
        true,
      );
      const estate = Object.values(s.map.tiles).filter(
        (t) => t.type === 'barren' || t.type === 'ruin',
      );
      expect(Math.min(...estate.map((t) => hexDistance(t, camp)))).toBeLessThanOrEqual(2);
    }
  });

  it('counts Harmony from the forest as it stood: 12 to start, less for every tile cleared', () => {
    for (const s of maps) {
      expect(s.harmony).toBe(12);
      expect(s.map.wild).toBeGreaterThan(80);
      expect(harmonyLines(F, s)).toContainEqual({
        label: 'the forest as it stood',
        amount: -s.map.wild!,
      });
    }
    // A milpa burned out of the forest costs its 2 Harmony; healing gains, as elsewhere.
    const s = maps[0]!;
    const wood = Object.values(s.map.tiles).find(
      (t) =>
        t.type === 'woodland' &&
        !Object.values(s.buildings).some((b) => hexKey(b.at) === hexKey(t)),
    )!;
    const t = act(s, { type: 'place', building: 'milpa', at: wood }, F);
    expect(t.harmony).toBe(10);
    expect(computeHarmony(F, t)).toBe(10);
  });

  it('has no snow: the dry season keeps the shared art’s summer look', () => {
    expect(F.land).toBe('forest');
    expect(snowless('forest')).toBe(true);
    expect(artSeason('cottage', 'winter', 'forest')).toBe('summer');
    expect(artSeason('woodland', 'winter', 'forest')).toBe('summer');
  });

  it('starts with the forest’s buildings unlocked: milpa, forest garden, raised house', () => {
    const s = createRun(F, { seed: 'unlocks' });
    for (const id of ['milpa', 'forestGarden', 'raisedHouse', 'workshop', 'salvageYard'])
      expect(s.unlocked).toContain(id);
  });
});

describe("the forest's seasons", () => {
  it('names them: first rains, monsoon, cyclone, dry season', () => {
    expect(F.calendar).toEqual(['firstRains', 'flood', 'storm', 'fire']);
    expect(F.calendar.map((e) => F.events[e]!.name)).toEqual([
      'First rains',
      'Monsoon',
      'Cyclone',
      'Dry season',
    ]);
  });

  it('the first rains: a milpa sown with them makes 1 more food in summer', () => {
    let s = start('spring');
    const old = put(s, 'milpa', 4, 3, 'scrub');
    s = place(s, 'milpa', 5, 3, F);
    const sown = uidAt(s, 5, 3);
    s = end(s);
    s = end(s);
    expect(made(s, sown) - made(s, old)).toBe(1);
    expect(s.lastReport!.math[sown]!.join(' ')).toMatch(/\+1 sown in the first rains/);
    // Sown in summer, nothing more in autumn: 2, and 1 for the scrub's fertility.
    let t = place(s, 'milpa', 6, 3, F);
    const late = uidAt(t, 6, 3);
    t = end(t);
    expect(made(t, late)).toBe(2 + 1);
    expect(t.lastReport!.math[late]!.join(' ')).not.toMatch(/first rains/);
  });

  it('the monsoon washes the bare fields and floods the floodplain: silt in autumn', () => {
    let s = start('summer');
    const field = put(s, 'milpa', 4, 3, 'scrub');
    const paddy = put(s, 'riceFishPaddy', 1, 3);
    s = end(s);
    expect(s.lastReport!.forest!.leached).toContain(hexKey(at(4, 3)));
    expect(s.lastReport!.flooded).toContain(hexKey(at(1, 3)));
    expect(s.buildings[paddy]!.siltYear).toBe(s.year);
    expect(made(s, field)).toBeGreaterThan(0);
    s = end(s);
    expect(s.lastReport!.math[paddy]!.join(' ')).toMatch(/× 1.5 silt/);
  });

  it('the cyclone strikes what stands on cleared land, and fells a garden’s canopy', () => {
    const s = start('autumn');
    const garden = canopied(s, 5, 3);
    const t = end(s);
    expect(t.lastReport!.damaged).toContain(garden);
    expect(t.lastReport!.felled).toEqual([garden]);
    expect(t.buildings[garden]!.layers).toEqual([]);
    // Forest beside it shelters it.
    const sheltered = start('autumn');
    tile(sheltered, 6, 3).type = 'woodland';
    const g2 = canopied(sheltered, 5, 3);
    expect(end(sheltered).lastReport!.damaged).not.toContain(g2);
  });

  // One tile of forest, beside a tile of scrub.
  const EDGE = ['~ m m m m', '~ m C m ,', '~ m m m W'];

  it('the dry season: fire catches where cleared ground meets the forest', () => {
    const s = start('winter', EDGE);
    const forecast = projectSeason(F, s, s.season, { forecast: true });
    expect(forecast.fireRisk).toEqual([hexKey(at(4, 2))]);
    expect(forecast.burned).toBeUndefined();
    expect(tile(s, 4, 2).type).toBe('woodland');
    const t = end(s);
    expect(t.lastReport!.burned).toEqual([hexKey(at(4, 2))]);
    expect(tile(t, 4, 2).type).toBe('scrub');
  });

  it('a living fence between them keeps the fire out', () => {
    const s = start('winter', EDGE);
    const fenced = act(s, { type: 'plantHedge', a: at(4, 1), b: at(4, 2) }, F);
    expect(fenced.hedges).toEqual([edgeKey(at(4, 1), at(4, 2))]);
    const t = end(fenced);
    expect(t.lastReport!.fireRisk).toEqual([]);
    expect(tile(t, 4, 2).type).toBe('woodland');
  });
});

describe('cooling and shade under the canopy', () => {
  it('homes need 1 cooling on summer days, none beside a grown canopy', () => {
    const s = start('summer');
    const house = put(s, 'raisedHouse', 3, 0, 'meadow');
    expect(coolDemand(F, s, s.buildings[house]!, 'day', 1)).toBe(1);
    expect(coolDemand(F, s, s.buildings[house]!, 'day', 0)).toBe(0);
    canopied(s, 4, 0, 'meadow');
    expect(coolDemand(F, s, s.buildings[house]!, 'day', 1)).toBe(0);
  });

  it('a young canopy neither cools nor shades; a grown one shades solar beside it', () => {
    const s = start('summer');
    const solar = put(s, 'solarCanopy', 5, 1, 'scrub');
    const garden = put(s, 'forestGarden', 5, 2, 'scrub');
    s.buildings[garden]!.layers = [{ id: 'canopy', turn: s.turn - 3 }];
    expect(end(s).lastReport!.shaded[solar]).toBeUndefined();
    s.buildings[garden]!.layers = [{ id: 'canopy', turn: s.turn - 4 }];
    expect(end(s).lastReport!.shaded[solar]).toEqual([hexKey(at(5, 2))]);
  });
});

describe("the forest's buildings", () => {
  it('a kitchen midden stands beside a home', () => {
    const s = start();
    expect(rejects(s, { type: 'place', building: 'kitchenMidden', at: at(5, 3) }, F)).toMatch(
      /^Kitchen Midden must be next to /,
    );
    expect(uidAt(place(s, 'kitchenMidden', 3, 1, F), 3, 1)).toBeDefined();
  });

  it('a stall barn beside a garden: 2 biomass to 2 compost, and +1 food to the garden', () => {
    const s = start('summer');
    const garden = put(s, 'forestGarden', 5, 3, 'scrub');
    expect(rejects(s, { type: 'place', building: 'stallBarn', at: at(3, 0) }, F)).toMatch(
      /must be next to Forest Garden/,
    );
    const without = end(s);
    const barn = put(s, 'stallBarn', 6, 3, 'scrub');
    const t = end(s);
    expect(made(t, barn, 'compost')).toBe(2);
    expect(made(t, garden) - made(without, garden)).toBe(1);
  });

  it('a bee tree keeps the forest and helps fields within 2 in spring', () => {
    const s = start('spring');
    tile(s, 3, 3).type = 'woodland';
    const field = put(s, 'milpa', 5, 3, 'scrub');
    const before = computeHarmony(F, s);
    const t = place(s, 'beeTree', 3, 3, F);
    expect(tile(t, 3, 3).type).toBe('woodland');
    expect(t.harmony).toBe(before);
    expect(made(end(t), field) - made(end(s), field)).toBe(1);
  });

  it('micro-hydro by the river: strongest in the monsoon', () => {
    const s = start('summer');
    expect(rejects(s, { type: 'place', building: 'microHydro', at: at(4, 2) }, F)).toMatch(
      /must be next to river/,
    );
    const hydro = put(s, 'microHydro', 1, 1, 'meadow');
    expect(end(s).lastReport!.generated[hydro]!.energy).toEqual({ day: 4, night: 4 });
  });

  it('rice terraces on the hills; nothing needs heat in the tropics', () => {
    expect(F.byId.riceTerrace!.placement.tiles).toEqual(['hill']);
    for (const b of F.buildings)
      for (const slot of ['day', 'night'] as const)
        expect(b.demand?.heat[slot].every((x) => x === 0) ?? true, b.id).toBe(true);
  });

  it('Black Earth, a vision: tiles of dark earth made', () => {
    const s = start();
    const vision = F.visions.find((v) => v.id === 'blackEarth')!;
    tile(s, 5, 3).type = 'darkEarth';
    expect(goalProgress(F, s, vision.goal)).toEqual({
      share: 1 / 8,
      text: '1 of 8 tiles of dark earth',
    });
  });
});
