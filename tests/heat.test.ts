/**
 * Heat routes: the Heat Pump and Solar Thermal Collector from
 * docs/proposals/heat-routes.md.
 */
import { describe, expect, it } from 'vitest';
import { canPlace, hexDistance, hexKey } from '../src/sim';
import { at, content, endSeason, place, scenario, uidAt } from './helpers';
import * as walk from './walkthrough';

// River in column 4, one woodland at (6,2), camp at (2,2).
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];

describe('Heat Pump', () => {
  it('must touch the river, a reservoir or a Fish Pond', () => {
    let s = scenario(VALLEY);
    expect(() => place(s, 'heatPump', 7, 3)).toThrow(/next to river or reservoir or Fish Pond/);
    expect(canPlace(content, s, 'heatPump', at(5, 2)).ok).toBe(true);
    // (6,3) is 2 tiles from the river, but touches a pond at (5,3).
    expect(canPlace(content, s, 'heatPump', at(6, 3)).ok).toBe(false);
    s = place(s, 'fishPond', 5, 3);
    expect(hexDistance(at(5, 3), at(6, 3))).toBe(1);
    expect(canPlace(content, s, 'heatPump', at(6, 3)).ok).toBe(true);
  });

  it("pays 3 heat for each energy, in whole energy's worth; the grid pays what is left", () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cottage', 3, 2);
    s = place(s, 'heatPump', 5, 2);
    s = endSeason(s);
    const night = s.lastReport!.energy.night;
    // Energy 2 (cottages) + heat 4 (camp 2, cottages 1 + 1): 3 through the pump for 1, 1 direct.
    expect(night.heat).toMatchObject({ demand: 4, pumped: 3, pumpEnergy: 1, direct: 1 });
    expect(night.demand).toBe(2 + 1 + 1);
    expect(night.shortfall).toBe(2);
    expect(s.lastReport!.math[uidAt(s, 5, 2)]).toContain('night: paid 3 heat with 1 energy');
  });

  it('pays at most 6 heat a slot', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    for (const row of [0, 1, 2, 3, 4]) s = place(s, 'cottage', 3, row);
    s = place(s, 'heatPump', 5, 2);
    s = endSeason(s);
    const night = s.lastReport!.energy.night;
    // Heat 7: 6 pumped for 2 energy, 1 direct; plus 5 energy for the cottages.
    expect(night.heat).toMatchObject({ demand: 7, pumped: 6, pumpEnergy: 2, direct: 1 });
    expect(night.demand).toBe(5 + 1 + 2);
  });

  it("a second pump takes only whole energy's worth of what the first leaves", () => {
    let s = scenario(VALLEY, { season: 'winter' });
    for (const row of [0, 1, 2, 3, 4]) s = place(s, 'cottage', 3, row);
    s = place(s, 'heatPump', 5, 1);
    s = place(s, 'heatPump', 5, 2);
    s = endSeason(s);
    // Heat 7: 6 through the first pump; the last 1 is less than the second's 3 a unit.
    expect(s.lastReport!.energy.night.heat).toMatchObject({ pumped: 6, pumpEnergy: 2, direct: 1 });
  });

  it('blackouts recount demand, because a pump saves less as heat demand falls', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cottage', 3, 2);
    s = place(s, 'cottage', 3, 3);
    s = place(s, 'heatPump', 5, 2);
    s = endSeason(s);
    // Demand 6 (energy 3, pump 1, heat 2 direct) vs 2: shutting one cottage leaves 4, two leave 2.
    const r = s.lastReport!;
    expect(r.energy.night.shortfall).toBe(4);
    expect(r.blackouts).toEqual([uidAt(s, 3, 3), uidAt(s, 3, 2)]);
  });

  it('is not flood-tolerant', () => {
    let s = scenario(['^ . , f ~ f , . ^ ^', ' ^ . C f ~ f , . . ^', '^ . , f ~ f f . R ^']);
    s = place(s, 'heatPump', 5, 1);
    s = endSeason(s);
    expect(s.lastReport!.damaged).toEqual([uidAt(s, 5, 1)]);
  });
});

describe('Solar Thermal Collector', () => {
  it('makes 2 / 3 / 3 / 2 heat by day, none at night, 1 less in shade', () => {
    let s = scenario(VALLEY);
    s = place(s, 'solarThermalCollector', 7, 3); // open ground
    s = place(s, 'solarThermalCollector', 6, 1); // next to the woodland
    const open: number[] = [];
    const shaded: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s);
      const math = s.lastReport!.math;
      open.push(Number(math[uidAt(s, 7, 3)]![0]!.split('= ')[1]));
      shaded.push(Number(math[uidAt(s, 6, 1)]![0]!.split('= ')[1]));
      expect(s.lastReport!.energy.night.heat.bySource.solarThermalCollector ?? 0).toBe(0);
      expect(s.lastReport!.energy.day.bySource.solarThermalCollector).toBeUndefined();
    }
    expect(open).toEqual([2, 3, 3, 2]);
    expect(shaded).toEqual([1, 2, 2, 1]);
    // The report names what casts the shade, so the resolution can draw it.
    expect(s.lastReport!.shaded).toEqual({ [uidAt(s, 6, 1)]: [hexKey(at(6, 2))] });
  });

  it('pays day heat directly: a winter greenhouse needs no heating energy', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'greenhouse', 6, 3);
    s = place(s, 'solarThermalCollector', 8, 1);
    s = endSeason(s);
    const day = s.lastReport!.energy.day;
    expect(day.heat).toMatchObject({ demand: 1, free: 1, direct: 0 });
    expect(day.demand).toBe(2);
    expect(day.shortfall).toBe(0);
    expect(s.lastReport!.yields[uidAt(s, 6, 3)]?.food).toBe(3);
  });

  it('banks day heat in a Heat Well for the night, leaving day energy for the workshop', () => {
    const setup = (collector: boolean) => {
      let s = scenario(VALLEY, { season: 'winter', stores: { salvage: 10 } });
      s = place(s, 'cottage', 3, 1);
      s = place(s, 'heatWell', 7, 4);
      s = place(s, 'workshop', 6, 3);
      if (collector) s = place(s, 'solarThermalCollector', 7, 3);
      return endSeason(s);
    };
    // Night: cottage 1 + heat 3 = 4 vs 2, short 2.
    const withCollector = setup(true).lastReport!;
    expect(withCollector.energy.day.heat.stored).toBe(2);
    expect(withCollector.energy.day.reserved).toBe(0);
    expect(withCollector.energy.night.storageDischarged).toBe(2);
    expect(withCollector.energy.night.shortfall).toBe(0);
    expect(Object.values(withCollector.runs)[0]?.runs).toBe(1);
    // Without it, the well reserves the day energy the workshop needed.
    const without = setup(false).lastReport!;
    expect(without.energy.day.reserved).toBe(2);
    expect(without.energy.night.shortfall).toBe(0);
    expect(Object.values(without.runs)[0]?.runs).toBe(0);
  });

  it('Heat Wells reserve for night heat before Cell Banks, whatever the build order', () => {
    let s = scenario(VALLEY, { season: 'winter' });
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cellBank', 7, 3);
    s = place(s, 'heatWell', 7, 4);
    s = endSeason(s);
    // Night short 2, all heat: the well covers it 1:1 from 2 day energy (a bank would need 3).
    const r = s.lastReport!;
    expect(r.energy.day.reserved).toBe(2);
    expect(r.energy.night.storageDischarged).toBe(2);
  });

  it('charges Heat Wells with free heat before spare energy', () => {
    let s = scenario(VALLEY, { season: 'autumn' });
    s = place(s, 'solarThermalCollector', 7, 3);
    s = place(s, 'heatWell', 7, 4);
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.day.heat.stored).toBe(3);
    // 3 heat + 2 day energy + 1 of the night's 2 fills the well to 6; it loses 1 at season end.
    expect(r.energy.day.storageCharged).toBe(2);
    expect(r.energy.night.storageCharged).toBe(1);
    expect(s.buildings[uidAt(s, 7, 4)]!.stored).toBe(5);
  });

  it('does not count toward the Mixed Grid bonus', () => {
    let s = scenario(VALLEY);
    s = place(s, 'solarThermalCollector', 7, 3);
    s = endSeason(s);
    expect(s.energyHistory.at(-1)).not.toHaveProperty('solarThermalCollector');
  });
});

describe('the Year 1 winter with heat routes (proposal worked example)', () => {
  const winterWith = (build: [string, (sites: walk.Sites) => { q: number; r: number }][]) => {
    const { state: autumn, sites } = walk.playToWinter();
    let s = walk.act(autumn, { type: 'pickCard', card: autumn.draft.offer[0]! });
    s.unlocked.push(...build.map(([id]) => id));
    for (const [id, site] of build) s = walk.place(s, id, site(sites));
    return walk.act(s, { type: 'endSeason' });
  };
  const nearRiver = (sites: walk.Sites) => {
    const { state } = walk.playToWinter();
    const used = new Set(Object.values(sites).map(hexKey));
    return Object.values(state.map.tiles).find(
      (t) =>
        t.type !== 'floodplain' &&
        !used.has(hexKey(t)) &&
        canPlace(walk.content, state, 'heatPump', t).ok,
    )!;
  };

  it('a Water-source Heat Pump alone covers the night: 3 heat for 1 energy', () => {
    const s = winterWith([['heatPump', nearRiver]]);
    const night = s.lastReport!.energy.night;
    expect(night.heat).toMatchObject({ demand: 3, pumped: 3, direct: 0 });
    expect(night.demand).toBe(2);
    expect(night.shortfall).toBe(0);
    expect(walk.totals(s).materials).toBe(10 - 7 + 2 + 3);
  });

  it('a collector and a Heat Well cover it, ending the year at 5 materials', () => {
    const s = winterWith([
      ['solarThermalCollector', (sites) => sites.cellBank],
      ['heatWell', (sites) => sites.wheel],
    ]);
    const r = s.lastReport!;
    expect(r.energy.night.shortfall).toBe(0);
    expect(r.blackouts).toEqual([]);
    expect(walk.totals(s)).toEqual({ materials: 10 - 10 + 2 + 3, food: 11, citizens: 8 });
  });
});
