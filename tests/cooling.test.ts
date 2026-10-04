/**
 * SD1 (proposals/sun-desert.md): cooling, heat's mirror, and dry water. On a test
 * Reach with a hut that needs cooling in summer, a wind tower, a shading garden
 * and a qanat. The real biomes have none of these, so they play as before (their
 * golden tests).
 */
import { describe, expect, it } from 'vitest';
import type { Content, RunState, Season } from '../src/sim';
import type willowReach from '../src/content/willow-reach.json';
import { endSeason, place, scenario, uidAt, withWater } from './helpers';

type Raw = typeof willowReach;
const find = (raw: Raw, id: string) => raw.buildings.find((b) => b.id === id)!;

/** The Reach with desert pieces added, and grid cooling on or off. */
function desertish(gridCool = true): Content {
  return withWater({
    campChannel: 0,
    edit: (raw) => {
      const hut = structuredClone(find(raw, 'cottage')) as Record<string, unknown>;
      Object.assign(hut, {
        id: 'hut',
        name: 'Hut',
        demand: { energy: { night: [0, 0, 0, 0] }, cool: { day: [0, 1, 0, 0] } },
      });
      const tower = structuredClone(find(raw, 'well')) as Record<string, unknown>;
      Object.assign(tower, {
        id: 'windTower',
        name: 'Wind Tower',
        drinkingWater: false,
        requiresWalks: false,
        cooling: {
          day: [2, 2, 2, 2],
          besideBonus: { amount: 1, tiles: ['oasis'], buildings: ['cistern'] },
        },
      });
      const garden = structuredClone(find(raw, 'pollinatorMeadow')) as Record<string, unknown>;
      Object.assign(garden, { id: 'palmGarden', name: 'Palm Garden', shades: 1 });
      const qanat = structuredClone(find(raw, 'irrigationChannel')) as Record<string, unknown>;
      Object.assign(qanat, {
        id: 'qanat',
        name: 'Qanat',
        water: { channel: true, underground: true },
      });
      raw.buildings.push(hut as never, tower as never, garden as never, qanat as never);
      (raw.rules as Record<string, unknown>).cooling = { range: 2, gridCool, gridCoolCost: 2 };
    },
  });
}
const D = desertish();

// The river down the left; open scrub to the right; an oasis at the far right.
const LAND = ['~ , , , , , , O', '~ , , , , , , O', '~ , , C , , , ,', '~ , , , , , , ,'];
const start = (season: Season = 'summer', c = D, rows = LAND) =>
  scenario(rows, { content: c, season, citizens: 20, stores: { food: 200 } });
const build = (s: RunState, id: string, cells: [number, number][], c = D) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, c), s);
const cool = (s: RunState) => s.lastReport!.energy.day.cool!;

describe('cooling', () => {
  it('a hot day: a home that needs cooling is cooled by the grid, at 2 energy each', () => {
    const without = endSeason(start(), D);
    const s = endSeason(build(start(), 'hut', [[1, 0]]), D);
    expect(cool(s)).toMatchObject({ demand: 1, free: 0, grid: 1, gridEnergy: 2, hot: 0 });
    expect(s.lastReport!.energy.day.demand - without.lastReport!.energy.day.demand).toBe(2);
    // Not in spring: the hut needs cooling only in summer.
    const spring = endSeason(build(start('spring'), 'hut', [[1, 0]]), D);
    expect(cool(spring).demand).toBe(0);
  });

  it('a wind tower cools the homes within 2, nearest first, before the grid', () => {
    // A tower at (3,0) makes 2: the huts at (1,0) and (4,0) are within 2; (6,3) is not.
    let s = build(start(), 'windTower', [[3, 0]]);
    s = build(s, 'hut', [
      [1, 0],
      [4, 0],
      [6, 3],
    ]);
    s = endSeason(s, D);
    expect(cool(s)).toMatchObject({ demand: 3, free: 2, grid: 1 });
    expect(cool(s).bySource).toEqual({ windTower: 2 });
    expect(s.lastReport!.math[uidAt(s, 6, 3)]!.join(' ')).toContain('cooling from the grid');
  });

  it('a wind tower beside water (an oasis, a cistern) cools 1 more', () => {
    // Beside the oasis at (7,0): 3 cooling for 3 huts.
    let s = build(start(), 'windTower', [[6, 0]]);
    s = build(s, 'hut', [
      [5, 0],
      [5, 1],
      [6, 1],
    ]);
    s = endSeason(s, D);
    expect(cool(s)).toMatchObject({ demand: 3, free: 3, grid: 0 });
  });

  it('shade beside a home takes 1 off its cooling, as does a shading edge along it', () => {
    let s = build(start(), 'hut', [[2, 0]]);
    s = build(s, 'palmGarden', [[3, 0]]);
    expect(cool(endSeason(s, D)).demand).toBe(0);
    // A shading hedge along one of its edges.
    const shady = desertish();
    shady.byId.hedgerow!.shades = 1;
    let t = build(start('summer', shady), 'hut', [[2, 0]], shady);
    t = { ...t, hedges: [`${'2,0'}|${'3,0'}`] };
    expect(cool(endSeason(t, shady)).demand).toBe(0);
  });

  it('without grid cooling, a home nothing cools is shut off hot, costing as a cold home', () => {
    const H = desertish(false);
    const s = endSeason(build(start('summer', H), 'hut', [[1, 0]], H), H);
    expect(cool(s).hot).toBe(1);
    expect(s.lastReport!.hot).toEqual([uidAt(s, 1, 0)]);
    expect(s.lastReport!.wellbeing.lines.map((l) => l.reason)).toContain(
      '1 hot home: nothing cools it',
    );
    // A wind tower in reach keeps it on.
    let t = build(start('summer', H), 'hut', [[1, 0]], H);
    t = endSeason(build(t, 'windTower', [[2, 0]], H), H);
    expect(t.lastReport!.hot).toEqual([]);
  });
});

describe('dry water', () => {
  it("an oasis's spring fills each of its tiles every season, whatever was taken", () => {
    let s = start('spring');
    s = endSeason(s, D);
    expect(s.lastReport!.water!.in.spring).toBe(4);
    for (const key of ['7,0', '7,1'].map((k) => k))
      expect(Object.values(s.map.tiles).find((t) => `${t.q},${t.r}` === key)).toBeDefined();
    // Emptied, it is full again the next season.
    for (const t of Object.values(s.map.tiles)) if (t.type === 'oasis') t.water = 0;
    s = endSeason(s, D);
    expect(s.lastReport!.water!.in.spring).toBe(4);
  });

  it('a qanat loses nothing to the sun; an open channel of the same length loses 1', () => {
    const run = (id: string) => {
      let s = build(
        start('summer', D, [
          '~ , , , , , , O',
          '~ , , , , , , O',
          '~ , , C f , , ,',
          '~ , , , , , , ,',
        ]),
        id,
        Array.from({ length: 4 }, (_, i) => [1 + i, 3] as [number, number]),
      );
      s = build(s, 'floodplainFarm', [[4, 2]]);
      return endSeason(s, D).lastReport!.water!.channels[0]!;
    };
    expect(run('irrigationChannel').evaporated).toBe(1);
    expect(run('qanat').evaporated).toBe(0);
  });
});
