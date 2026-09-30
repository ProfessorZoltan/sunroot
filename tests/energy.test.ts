import { describe, expect, it } from 'vitest';
import { hexDistance } from '../src/sim';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

// A dry valley: river in column 4, hills at the edges, one woodland at (6,2).
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];

// The same valley with more surviving green land (Harmony 10).
const GREEN = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , m m ^ ^',
  '^ ^ m m ~ m m m m ^',
];

describe('generation', () => {
  it('solar canopies lose 1 per slot next to woodland or a tall building', () => {
    expect(hexDistance(at(6, 1), at(6, 2))).toBe(1);
    expect(hexDistance(at(1, 3), at(2, 3))).toBe(1);
    let s = scenario(VALLEY);
    s = place(s, 'solarCanopy', 7, 3); // open ground
    s = place(s, 'solarCanopy', 6, 1); // next to the woodland
    s = place(s, 'seedbankLibrary', 2, 3); // tall
    s = place(s, 'solarCanopy', 1, 3); // next to the library
    s = endSeason(s);
    expect(s.lastReport!.math[uidAt(s, 7, 3)]).toContain('day energy 3 = 3');
    expect(s.lastReport!.math[uidAt(s, 6, 1)]).toContain('day energy 3 -1 = 2');
    expect(s.lastReport!.math[uidAt(s, 1, 3)]).toContain('day energy 3 -1 = 2');
    expect(s.lastReport!.energy.day.bySource.solarCanopy).toBe(7);
  });

  it('solar follows the seasons: 3 / 4 / 2 / 1 by day, nothing at night', () => {
    let s = scenario(VALLEY);
    s = place(s, 'solarCanopy', 7, 3);
    const days: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s);
      days.push(s.lastReport!.energy.day.bySource.solarCanopy ?? 0);
      expect(s.lastReport!.energy.night.bySource.solarCanopy ?? 0).toBe(0);
    }
    expect(days).toEqual([3, 4, 2, 1]);
  });

  it('wind spires need hills, crowd each other within 2 tiles and cost Harmony', () => {
    let s = scenario(GREEN);
    const harmony = s.harmony;
    expect(harmony).toBeGreaterThan(6);
    expect(() => place(s, 'windSpire', 3, 3)).toThrow(/can't be built on scrub/);
    s = place(s, 'windSpire', 0, 0);
    s = place(s, 'windSpire', 1, 1);
    s = place(s, 'windSpire', 9, 0);
    expect(hexDistance(at(0, 0), at(1, 1))).toBeLessThanOrEqual(2);
    expect(s.harmony).toBe(harmony - 6);
    s = endSeason(s);
    const r = s.lastReport!;
    // Spring 2 / 3 each; the crowded pair lose 1 per slot each.
    expect(r.energy.day.bySource.windSpire).toBe(1 + 1 + 2);
    expect(r.energy.night.bySource.windSpire).toBe(2 + 2 + 3);
  });

  it('a pollinator meadow next to a wind spire cancels its Harmony penalty', () => {
    let s = scenario(GREEN);
    s = place(s, 'windSpire', 9, 0);
    const withSpire = s.harmony;
    expect(withSpire).toBeGreaterThan(0);
    s = place(s, 'pollinatorMeadow', 8, 1); // barren -> meadow (+1), meadow (+1), cancels -2
    expect(s.harmony).toBe(withSpire + 1 + 1 + 2);
  });

  it('river wheels must touch the river and gain 1 per slot next to a weir', () => {
    let s = scenario(VALLEY);
    expect(() => place(s, 'riverWheel', 7, 3)).toThrow(/next to river/);
    s = place(s, 'riverWheel', 5, 2);
    s = place(s, 'riverWheel', 3, 4);
    s = place(s, 'weir', 4, 4);
    expect(hexDistance(at(3, 4), at(4, 4))).toBe(1);
    expect(hexDistance(at(5, 2), at(4, 4))).toBeGreaterThan(1);
    s = endSeason(s);
    expect(s.lastReport!.energy.day.bySource.riverWheel).toBe(3 + 4);
    expect(s.lastReport!.energy.night.bySource.riverWheel).toBe(3 + 4);
  });

  it('a digester turns 2 scraps or biomass into 3 energy and 1 compost, up to 2 runs, in its slot', () => {
    let s = scenario(VALLEY, { stores: { scraps: 3, biomass: 4 } });
    s = place(s, 'biogasDigester', 6, 3);
    s = act(s, { type: 'setDigesterSlot', uid: uidAt(s, 6, 3), slot: 'day' });
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.day.bySource.biogasDigester).toBe(6);
    expect(r.energy.night.bySource.biogasDigester ?? 0).toBe(0);
    expect(r.yields[uidAt(s, 6, 3)]?.compost).toBe(2);
    // Scraps are used first: 3 scraps + 1 biomass.
    expect(s.stores.biomass).toBe(3);
  });
});

describe('storage and demand', () => {
  it('a cell bank reserves spare day energy (4 stored returns 3) to cover a night shortfall', () => {
    let s = scenario(VALLEY, { season: 'winter', stores: { salvage: 10 } });
    // Night: camp heat 2 + 3 cottages x 2 = 8 demand vs 2 supply: short 6.
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cottage', 3, 2);
    s = place(s, 'cottage', 3, 3);
    s = place(s, 'solarCanopy', 7, 3);
    s = place(s, 'solarCanopy', 8, 1);
    s = place(s, 'cellBank', 7, 4);
    s = place(s, 'workshop', 6, 3);
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.day.supply).toBe(4); // camp 2 + solar 1 + 1
    expect(r.energy.day.reserved).toBe(4);
    expect(r.energy.night.storageDischarged).toBe(3);
    expect(r.energy.night.shortfall).toBe(3);
    expect(r.runs[uidAt(s, 6, 3)]?.runs).toBe(0);
  });

  it('blackouts shut off the lowest priority first, homes last', () => {
    let s = scenario(VALLEY, { season: 'autumn' });
    s = place(s, 'commonsPlaza', 3, 2);
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cottage', 3, 3);
    // Night demand: plaza 1 + cottages 2 = 3 vs camp 2: short 1. The plaza goes dark.
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.night.shortfall).toBe(1);
    expect(r.blackouts).toEqual([uidAt(s, 3, 2)]);
    expect(r.wellbeing.lines.some((l) => l.reason.includes('unpowered'))).toBe(false);
  });

  it('winter heating blacks out homes when nothing else is left to shut off', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'cottage', 3, 1);
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.night.shortfall).toBe(2);
    expect(r.blackouts).toEqual([uidAt(s, 3, 1)]);
    expect(r.wellbeing.lines).toContainEqual({ reason: '1 unpowered homes', amount: -2 });
  });

  it('the player can reorder priorities', () => {
    let s = scenario(VALLEY, { season: 'autumn' });
    s = place(s, 'commonsPlaza', 3, 2);
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cottage', 3, 3);
    const plaza = uidAt(s, 3, 2);
    const [c1, c2] = [uidAt(s, 3, 1), uidAt(s, 3, 3)];
    expect(s.priority).toEqual(['b0', c1, c2, plaza]);
    s = act(s, { type: 'setPriority', order: ['b0', plaza, c1, c2] });
    s = endSeason(s);
    expect(s.lastReport!.blackouts).toEqual([c2]);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      reason: 'powered Commons Plaza',
      amount: 3,
    });
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      reason: '1 unpowered homes',
      amount: -2,
    });
  });

  it('a heat well covers night heat 1:1 from spare day energy and keeps leftovers, losing 1 a season', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'solarCanopy', 7, 3);
    s = place(s, 'solarCanopy', 8, 1);
    s = place(s, 'heatWell', 7, 4);
    s = place(s, 'cottage', 3, 1);
    s = endSeason(s);
    const r = s.lastReport!;
    // Night: camp heat 2 + cottage 1 + 1 heat = 4 vs 2. Day 4 spare: 2 reserved as heat, 2 more stored.
    expect(r.energy.day.reserved).toBe(2);
    expect(r.energy.night.storageDischarged).toBe(2);
    expect(r.energy.night.shortfall).toBe(0);
    expect(r.energy.day.storageCharged).toBe(4);
    // 2 heat left over, minus 1 at the end of the season.
    expect(s.buildings[uidAt(s, 7, 4)]!.stored).toBe(1);
  });

  it('a heat well pays a later heat shortfall from its store', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'heatWell', 7, 4);
    s.buildings[uidAt(s, 7, 4)]!.stored = 6;
    s = place(s, 'cottage', 3, 1);
    s = endSeason(s);
    const r = s.lastReport!;
    // Night demand 2 + 2 = 4 vs supply 2: stored heat pays the 2 short (all heat).
    expect(r.energy.night.storageDischarged).toBe(2);
    expect(r.energy.night.shortfall).toBe(0);
    // 6 - 2 paid, + 2 from spare day energy, - 1 at season end.
    expect(s.buildings[uidAt(s, 7, 4)]!.stored).toBe(5);
  });

  it('a kiln next to a heat well charges it for free', () => {
    let s = scenario(VALLEY, { season: 'summer' });
    s = place(s, 'kiln', 5, 2);
    s = place(s, 'heatWell', 5, 3);
    expect(hexDistance(at(5, 2), at(5, 3))).toBe(1);
    // Summer: camp 2 / 2. The kiln runs once on day, once on night; the well gets 2 free heat.
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.runs[uidAt(s, 5, 2)]).toEqual({
      recipe: 'fire',
      runs: 2,
      energy: { day: 2, night: 2 },
    });
    expect(r.yields[uidAt(s, 5, 2)]?.materials).toBe(4);
    expect(s.buildings[uidAt(s, 5, 3)]!.stored).toBe(2 - 1);
  });

  it('greenhouses and libraries only produce when powered', () => {
    let s = scenario(VALLEY, { season: 'summer' });
    s = place(s, 'greenhouse', 6, 3);
    s = place(s, 'seedbankLibrary', 7, 3);
    // Day supply 2 (camp): greenhouse 2 + library 1 = 3 demand; the library (lower priority) blacks out.
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.blackouts).toEqual([uidAt(s, 7, 3)]);
    expect(r.yields[uidAt(s, 6, 3)]?.food).toBe(3);
    expect(r.yields[uidAt(s, 7, 3)]?.knowledge).toBeUndefined();
  });

  it('a pumped reservoir stores energy across seasons and returns 3 of every 4', () => {
    let s = scenario(
      [
        '^ ^ ^ . ~ . , . ^ ^',
        ' ^ ^ . , ~ , . , . ^',
        '^ ^ C ^ ~ , W . ^ ^',
        ' ^ . , , ~ , . . ^ ^',
        '^ ^ . , ~ , . , . ^',
      ],
      { year: 7 },
    );
    s = place(s, 'weir', 4, 3); // rows 0-2 become reservoir
    expect(s.map.tiles[`${at(4, 2).q},${at(4, 2).r}`]!.type).toBe('reservoir');
    s = place(s, 'pumpedReservoir', 3, 2);
    s = endSeason(s); // spring: all 4 spare (camp 2 + 2) stored
    const reservoir = uidAt(s, 3, 2);
    expect(s.buildings[reservoir]!.stored).toBe(4);
    s = place(s, 'commonsPlaza', 6, 3);
    s = place(s, 'cottage', 5, 3);
    s = place(s, 'cottage', 6, 4);
    s = endSeason(s); // summer: night demand 3 + camp 0 = 3 vs 2; short 1 paid by the reservoir
    expect(s.lastReport!.energy.night.storageDischarged).toBe(1);
    expect(s.lastReport!.energy.night.shortfall).toBe(0);
  });
});
