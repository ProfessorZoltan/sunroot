/**
 * Golden test: the Year 1 walkthrough from docs/DESIGN.md ("First biome:
 * Willow Reach"). This test must always pass (Working rules).
 *
 * | Season | Build                                      | Materials | Food | Citizens |
 * | Spring | Farm, Salvage Yard, Workshop, Solar Canopy | 11        | 8    | 6        |
 * | Summer | 2nd farm, Cottage                          | 12        | 12   | 7        |
 * | Autumn | Composter, Orchard                         | 10        | 19   | 8        |
 * | Winter | River Wheel                                | 9         | 11   | 8        |
 *
 * Changed from the design (DECISIONS.md, Day energy for industry; awaiting the
 * playtester's review): the Salvage Yard, Workshop and Kiln need 1 day energy
 * each, and workshop and kiln runs use day energy only. Spring to autumn are
 * unchanged; winter ends at 9 materials, not 12 (one workshop run, not two).
 * The Cell Bank no longer covers the winter night: the day leaves it 1 spare
 * energy, which returns nothing, so the camp still blacks out.
 *
 * Sites are found by rule rather than hard-coded coordinates, so the test
 * survives map-generator tuning as long as Willow Reach keeps its shape.
 */
import { describe, expect, it } from 'vitest';
import { act, buildingAt, place, playToWinter, totals } from './walkthrough';

describe('Year 1 walkthrough (golden)', () => {
  it('matches the walkthrough table, building a River Wheel in winter', () => {
    const { state: autumn, sites } = playToWinter();
    let state = act(autumn, { type: 'pickCard', card: 'riverWheel' });
    state = place(state, 'riverWheel', sites.wheel);
    state = act(state, { type: 'endSeason' });
    const winter = state.lastReport!;
    expect(totals(state)).toEqual({ materials: 9, food: 11, citizens: 8 });
    // The wheel fixes the night shortfall; by day, after the salvage yard's and workshop's
    // own 1 each, it leaves spare energy for 1 workshop run.
    expect(winter.energy.night.shortfall).toBe(0);
    expect(winter.blackouts).toEqual([]);
    expect(winter.energy.day.demandBy).toMatchObject({ salvageYard: 1, workshop: 1 });
    expect(winter.runs[buildingAt(state, sites.workshop).uid]?.runs).toBe(1);
    expect(state.year).toBe(2);
    expect(state.season).toBe('spring');
  });

  it('heating creates a 2-energy night shortfall when nothing is built', () => {
    const { state: autumn } = playToWinter();
    let state = act(autumn, { type: 'pickCard', card: 'riverWheel' });
    state = act(state, { type: 'endSeason' });
    const winter = state.lastReport!;
    expect(winter.energy.night.demand - winter.energy.night.supply).toBe(2);
    expect(winter.energy.night.shortfall).toBe(2);
    expect(winter.blackouts.length).toBeGreaterThan(0);
  });

  it('the Cell Bank alternative no longer covers the night, and ends the year at 7 materials', () => {
    const { state: autumn, sites } = playToWinter();
    let state = act(autumn, { type: 'pickCard', card: 'cellBank' });
    state = place(state, 'cellBank', sites.cellBank);
    state = act(state, { type: 'endSeason' });
    const winter = state.lastReport!;
    expect(totals(state)).toEqual({ materials: 7, food: 11, citizens: 8 });
    // 1 spare day energy charges it; 1 stored returns nothing (3 for every 4).
    expect(winter.energy.day.storageCharged).toBe(1);
    expect(winter.energy.night.storageDischarged).toBe(0);
    expect(winter.energy.night.shortfall).toBe(2);
    expect(winter.blackouts.length).toBeGreaterThan(0);
    expect(winter.runs[buildingAt(state, sites.workshop).uid]?.runs ?? 0).toBe(0);
  });
});
