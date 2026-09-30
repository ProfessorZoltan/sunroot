/**
 * Golden test: the Year 1 walkthrough from docs/DESIGN.md ("First biome:
 * Willow Reach"). This test must always pass (Working rules).
 *
 * | Season | Build                                      | Materials | Food | Citizens |
 * | Spring | Farm, Salvage Yard, Workshop, Solar Canopy | 11        | 8    | 6        |
 * | Summer | 2nd farm, Cottage                          | 12        | 12   | 7        |
 * | Autumn | Composter, Orchard                         | 10        | 19   | 8        |
 * | Winter | River Wheel                                | 12        | 11   | 8        |
 *
 * The winter choice is real: a Cell Bank also covers the shortfall for 5
 * materials but uses the workshop's spare day energy, ending the year at 7
 * materials instead of 12.
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
    expect(totals(state)).toEqual({ materials: 12, food: 11, citizens: 8 });
    // The wheel fixes the night shortfall and leaves spare day energy for 2 workshop runs.
    expect(winter.energy.night.shortfall).toBe(0);
    expect(winter.blackouts).toEqual([]);
    expect(winter.runs[buildingAt(state, sites.workshop).uid]?.runs).toBe(2);
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

  it('the Cell Bank alternative covers the shortfall but ends the year at 7 materials', () => {
    const { state: autumn, sites } = playToWinter();
    let state = act(autumn, { type: 'pickCard', card: 'cellBank' });
    state = place(state, 'cellBank', sites.cellBank);
    state = act(state, { type: 'endSeason' });
    const winter = state.lastReport!;
    expect(totals(state)).toEqual({ materials: 7, food: 11, citizens: 8 });
    expect(winter.energy.night.storageDischarged).toBe(2);
    expect(winter.energy.night.shortfall).toBe(0);
    expect(winter.blackouts).toEqual([]);
    expect(winter.runs[buildingAt(state, sites.workshop).uid]?.runs ?? 0).toBe(0);
  });
});
