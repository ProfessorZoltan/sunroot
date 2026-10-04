/**
 * The Sun Desert (Milestone 13, SD2; proposals/sun-desert.md): its map, its
 * content and its own rules: the heatwave, the dust storm, fog nets, the
 * Concentrated Solar Plant's mirrors and tank, the sand battery, mud-brick
 * walls, the salt works and placement at the map's edge.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  createRun,
  hexDistance,
  hexKey,
  hexNeighbors,
  type RunState,
  type Season,
} from '../src/sim';
import { coolDemand, harmonyLines, stormExposed } from '../src/sim/queries';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const D = biomeContent('sunDesert');
const seeds = Array.from({ length: 20 }, (_, i) => `desert-${i}`);
const gen = D.map.kind === 'desert' ? D.map : null;

describe('the desert map', () => {
  it('on 20 seeds: a thin river top to bottom, wadi banks beside it, an oasis ringed with scrub', () => {
    for (const seed of seeds) {
      const s = createRun(D, { seed, water: true });
      const tiles = Object.values(s.map.tiles);
      const river = s.map.river.map((k) => s.map.tiles[k]!);
      expect(river).toHaveLength(gen!.height);
      river.forEach((t, i) => expect(t.riverIndex).toBe(i));
      const nearRiver = (t: { q: number; r: number }) => river.some((r) => hexDistance(r, t) === 1);
      for (const t of tiles.filter((x) => x.type === 'floodplain')) expect(nearRiver(t)).toBe(true);
      expect(s.map.floodOrder.length).toBeGreaterThan(0);
      for (const k of s.map.floodOrder) expect(s.map.tiles[k]!.type).toBe('floodplain');
      const oasis = tiles.filter((t) => t.type === 'oasis');
      expect(oasis).toHaveLength(gen!.oasisTiles);
      for (const o of oasis)
        for (const n of hexNeighbors(o))
          expect(['reg', 'erg']).not.toContain(s.map.tiles[hexKey(n)]?.type);
    }
  });

  it('on 20 seeds: rock only at the edges, a salt flat, the old array, the camp near the oasis', () => {
    for (const seed of seeds) {
      const s = createRun(D, { seed, water: true });
      const tiles = Object.values(s.map.tiles);
      for (const t of tiles.filter((x) => x.type === 'rock'))
        expect(hexNeighbors(t).filter((n) => s.map.tiles[hexKey(n)]).length).toBeLessThan(6);
      expect(tiles.filter((t) => t.type === 'erg').length).toBeGreaterThan(0);
      expect(tiles.filter((t) => t.type === 'saltFlat')).toHaveLength(gen!.saltFlat);
      const ruins = tiles.filter((t) => t.type === 'ruin');
      expect(ruins).toHaveLength(gen!.ruins);
      for (const r of ruins) expect(r.salvage).toBe(gen!.ruinSalvage);
      const camp = s.buildings.b0!.at;
      const d = Math.min(
        ...tiles.filter((t) => t.type === 'oasis').map((o) => hexDistance(o, camp)),
      );
      expect(d).toBeGreaterThanOrEqual(gen!.campOasisDistance[0]);
      expect(d).toBeLessThanOrEqual(gen!.campOasisDistance[1]);
      // Its palm groves and meadows; a Wildway formation among them may add to that.
      const land = harmonyLines(D, s).filter(
        (l) => l.label.endsWith('tiles') || l.label.includes('tiles ×'),
      );
      expect(land.reduce((n, l) => n + l.amount, 0)).toBe(gen!.startingHarmony);
    }
  });

  it('the same seed always makes the same desert', () => {
    expect(createRun(D, { seed: 'same' }).map).toEqual(createRun(D, { seed: 'same' }).map);
  });
});

describe('the desert content', () => {
  it("has the proposal's starters and none of the Reach's river farming", () => {
    const starters = D.buildings.filter((b) => b.starter).map((b) => b.id);
    for (const id of ['oasisGarden', 'mudBrickHouse', 'composter', 'workshop', 'salvageYard'])
      expect(starters).toContain(id);
    for (const id of ['cistern', 'solarCanopy']) expect(starters).toContain(id);
    for (const id of ['floodplainFarm', 'orchard', 'riceFishPaddy', 'fishPond', 'weir', 'levee'])
      expect(D.byId[id]).toBeUndefined();
    expect(D.byId.riverWheel).toBeUndefined();
    expect(D.calendar).toEqual(['flood', 'heatwave', 'storm', 'freeze']);
    expect(D.events.flood!.name).toBe('Flash flood');
    expect(D.events.storm!.name).toBe('Dust storm');
    expect(D.rules.water.riverFlow).toEqual([6, 0, 2, 3]);
    expect(D.rules.landHealth).toEqual(['reg', 'scrub', 'meadow', 'woodland']);
    expect(D.land).toBe('desert');
  });

  it('a whole year plays', () => {
    let s = createRun(D, { seed: 'year', water: true });
    for (let i = 0; i < 4; i++) s = endSeason(s, D);
    expect(s.year).toBe(2);
  });
});

/** A small desert: the river down the left, its banks, gravel, an oasis, rock and dunes. */
const LAND = ['~ K g g g g g g', '~ f g g g O g E', '~ f g C g O g E', '~ g g g s g g E'];
const start = (season: Season = 'spring', rows = LAND) =>
  scenario(rows, {
    content: D,
    season,
    citizens: 20,
    stores: { food: 200 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, D), s);
/** A palm windbreak along the edge between two tiles. */
const shelter = (s: RunState, a: [number, number], b: [number, number]) =>
  act(s, { type: 'plantHedge', a: at(...a), b: at(...b) }, D);
const si = (s: RunState) => ['spring', 'summer', 'autumn', 'winter'].indexOf(s.season);
const gen1 = (s: RunState, col: number, row: number) =>
  s.lastReport!.generated[uidAt(s, col, row)]!;

describe('the heatwave', () => {
  it('every home needs 1 more cooling by day, even mud-brick walls that need none otherwise', () => {
    const s = build(start('summer'), 'mudBrickHouse', [[4, 0]]);
    const house = s.buildings[uidAt(s, 4, 0)]!;
    const camp = s.buildings.b0!;
    expect(coolDemand(D, s, house, 'day', si(s))).toBe(1);
    expect(coolDemand(D, s, camp, 'day', si(s))).toBe(2);
    expect(coolDemand(D, s, house, 'night', si(s))).toBe(0);
    // A summer with no heatwave: the walls need nothing, the camp its 1.
    const calm = { ...s, forecast: { ...s.forecast, event: 'freeze' as const } };
    expect(coolDemand(D, calm, house, 'day', si(s))).toBe(0);
    expect(coolDemand(D, calm, camp, 'day', si(s))).toBe(1);
  });

  it('dims the solar canopy by day, not the mirrors of a Concentrated Solar Plant', () => {
    let s = build(start('summer'), 'solarCanopy', [[6, 0]]);
    s = build(s, 'concentratedSolarPlant', [[3, 3]]);
    s = endSeason(s, D);
    expect(gen1(s, 6, 0).energy.day).toBe(4); // 5 in a desert summer, 1 less
    expect(s.lastReport!.math[uidAt(s, 6, 0)]!.join(' ')).toContain('heatwave -1 by day');
    expect(gen1(s, 3, 3).energy.day).toBe(4);
  });

  it('channels lose twice as much to the sun', () => {
    // A channel of 4 from the oasis, and a garden at its end.
    const rows = ['g g g g g g g g', 'O g g g g g g g', 'O g g C g g g g', 'g g g g g g g g'];
    const run = (season: Season) => {
      let s = build(start(season, rows), 'irrigationChannel', [
        [1, 1],
        [2, 1],
        [3, 1],
        [4, 1],
      ]);
      s = build(s, 'oasisGarden', [[5, 0]]);
      return endSeason(s, D).lastReport!.water!.channels[0]!.evaporated;
    };
    expect(run('spring')).toBe(1);
    expect(run('summer')).toBe(2);
  });
});

describe('the dust storm', () => {
  it('dims canopies and mirrors by 1 in every slot they run', () => {
    let s = build(start('autumn'), 'solarCanopy', [[6, 0]]);
    s = build(s, 'concentratedSolarPlant', [[3, 3]]);
    // Windbreaks keep them from being buried, not from the dust on their glass.
    s = shelter(shelter(s, [6, 0], [5, 0]), [3, 3], [2, 3]);
    s = endSeason(s, D);
    expect(gen1(s, 6, 0).energy.day).toBe(3);
    expect(gen1(s, 3, 3).energy).toEqual({ day: 2, night: 1 });
    expect(gen1(s, 3, 3).heat.day).toBe(1);
    expect(s.lastReport!.math[uidAt(s, 6, 0)]!.join(' ')).toContain('dust storm -1');
  });

  it('reaches what stands on the reg or the erg, unless a palm windbreak shelters it', () => {
    let s = build(start('autumn'), 'solarCanopy', [[6, 0]]);
    s = build(s, 'mudBrickHouse', [[2, 1]]);
    s = build(s, 'sandBattery', [[7, 1]]);
    const exposed = (state: RunState, col: number, row: number) =>
      stormExposed(D, state, state.buildings[uidAt(state, col, row)]!);
    expect(exposed(s, 6, 0)).toBe(true);
    expect(exposed(s, 7, 1)).toBe(true); // on the erg
    // The camp stands on scrub; the windbreak along the canopy's edge shelters it.
    expect(stormExposed(D, s, s.buildings.b0!)).toBe(false);
    s = shelter(s, [6, 0], [5, 0]);
    expect(exposed(s, 6, 0)).toBe(false);
  });
});

describe('fog nets', () => {
  it('stand at the edge of the map, on rock, erg or reg', () => {
    const s = start();
    expect(place(s, 'fogNet', 1, 0, D).buildings).toBeDefined();
    expect(place(s, 'fogNet', 7, 2, D).buildings).toBeDefined();
    expect(rejects(s, { type: 'place', building: 'fogNet', at: at(4, 1) }, D)).toMatch(
      'edge of the map',
    );
  });

  it('catch 1 each season (2 in winter) into their own store, up to 2', () => {
    let s = build(start('autumn'), 'fogNet', [[7, 0]]);
    s = endSeason(s, D);
    expect(s.lastReport!.water!.in.fog).toBe(1);
    expect(s.buildings[uidAt(s, 7, 0)]!.stored).toBe(1);
    s = endSeason(s, D);
    expect(s.lastReport!.water!.in.fog).toBe(1); // 2 in winter, but it holds only 2
    expect(s.buildings[uidAt(s, 7, 0)]!.stored).toBe(2);
  });

  it('give their water as a cistern does: beside the river, to what the dry river cannot serve', () => {
    // A wadi farm beside the river in summer, when the river is dry; a fog net upstream of it.
    const farm = (withNet: boolean) => {
      let s = start('spring');
      if (withNet) s = build(s, 'fogNet', [[1, 0]]);
      s = build(s, 'wadiFarm', [[1, 1]]);
      s = endSeason(s, D);
      s = endSeason(s, D);
      return s.lastReport!.water!.uses[uidAt(s, 1, 1)]!;
    };
    expect(farm(false).short).toBe(true);
    expect(farm(true).short).toBe(false);
  });
});

describe('the Concentrated Solar Plant', () => {
  it('stands on the reg; makes energy by day and night, and heat by day', () => {
    const s0 = start('spring');
    expect(
      rejects(s0, { type: 'place', building: 'concentratedSolarPlant', at: at(1, 1) }, D),
    ).toMatch("can't be built on floodplain");
    const s = endSeason(build(s0, 'concentratedSolarPlant', [[3, 3]]), D);
    expect(gen1(s, 3, 3)).toEqual({ energy: { day: 3, night: 2 }, heat: { day: 2, night: 0 } });
  });

  it("its mirrors' spare heat drives an absorption chiller", () => {
    let s = build(start('summer'), 'concentratedSolarPlant', [[3, 3]]);
    s = build(s, 'absorptionChiller', [[4, 2]]);
    s = endSeason(s, D);
    expect(s.lastReport!.energy.day.cool!.bySource.absorptionChiller).toBeGreaterThan(0);
  });

  it('its tank heats the homes within 2 on winter nights', () => {
    const without = endSeason(start('winter'), D).lastReport!.energy.night.heat;
    const s = endSeason(build(start('winter'), 'concentratedSolarPlant', [[3, 3]]), D);
    expect(without.free).toBe(0);
    expect(s.lastReport!.energy.night.heat.free).toBe(2);
  });
});

describe('the sand battery', () => {
  it('stores spare day energy and gives it as heat to the camp on a winter night', () => {
    const canopy = build(start('winter'), 'solarCanopy', [[6, 0]]);
    const without = endSeason(canopy, D).lastReport!;
    const s = endSeason(build(canopy, 'sandBattery', [[4, 2]]), D);
    // The camp's 2 heat at night, which the grid pays at 2 energy each, comes from the sand.
    expect(s.lastReport!.storage[uidAt(s, 4, 2)]!.given).toBe(2);
    expect(without.energy.night.storageDischarged).toBe(0);
    expect(s.lastReport!.energy.night.storageDischarged).toBeGreaterThan(0);
  });
});

describe('mud-brick walls', () => {
  it('need no heat on winter nights and no cooling but in a heatwave', () => {
    const s = build(start('winter'), 'mudBrickHouse', [[4, 0]]);
    const r = endSeason(s, D).lastReport!;
    expect(r.energy.night.heatBy.mudBrickHouse).toBeUndefined();
    expect(r.energy.night.heatBy.foundersCamp).toBe(2);
  });
});

describe('the salt works', () => {
  it('stands only on the salt flat; 1 materials a season, and stores 5 food', () => {
    const s = start();
    expect(rejects(s, { type: 'place', building: 'saltWorks', at: at(3, 3) }, D)).toMatch(
      "can't be built on reg",
    );
    const t = endSeason(build(s, 'saltWorks', [[4, 3]]), D);
    expect(t.lastReport!.flows.materials!.made['Salt Works']!.amount).toBe(1);
    expect(D.byId.saltWorks!.foodStorage).toBe(5);
  });
});

describe('the wadi', () => {
  it('a wadi farm stands on the banks and drinks from the river beside it; the flash flood silts it', () => {
    const s0 = start();
    expect(rejects(s0, { type: 'place', building: 'wadiFarm', at: at(2, 1) }, D)).toMatch(
      "can't be built on reg",
    );
    const s = endSeason(build(s0, 'wadiFarm', [[1, 1]]), D);
    const farm = uidAt(s, 1, 1);
    expect(s.lastReport!.water!.uses[farm]!.from).toBe('river');
    expect(s.lastReport!.silted).toContain(farm);
  });

  it('an oasis garden draws from the oasis beside it and shades a home next to it', () => {
    let s = build(start('summer'), 'oasisGarden', [[4, 1]]);
    s = build(s, 'mudBrickHouse', [[4, 0]]);
    const house = s.buildings[uidAt(s, 4, 0)]!;
    // In the heatwave the house needs 1; the garden's shade takes it off.
    expect(coolDemand(D, s, house, 'day', si(s))).toBe(0);
    s = endSeason(s, D);
    expect(s.lastReport!.water!.uses[uidAt(s, 4, 1)]!.from).toBe('lake');
  });
});
