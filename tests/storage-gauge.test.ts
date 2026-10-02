/**
 * How full a store of energy or heat is (asked for in playtesting): the season
 * report traces what each store charged and gave, and the gauge shows it now
 * and as it will stand when the season ends.
 */
import { describe, expect, it } from 'vitest';
import { resolveAsIs } from '../src/sim';
import { gaugeLines, storageGauge } from '../src/game/storageInfo';
import { content, endSeason, place, scenario, uidAt } from './helpers';

const ROW = ['^ ^ . , ~ , . ^', '^ . C , ~ , . ^', '^ ^ . , ~ , . ^'];

describe('storage gauges', () => {
  it('a cell bank charges from spare day energy, gives at night, and empties', () => {
    // Winter: the camp's night heat and a cottage's leave the night short.
    let s = scenario(ROW, { season: 'winter', stores: { food: 500 }, citizens: 9 });
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'cellBank', 1, 1);
    const bank = uidAt(s, 1, 1);
    const gauge = storageGauge(content, s, resolveAsIs(content, s, { forecast: true }), bank)!;
    expect(gauge).toMatchObject({ holds: 'energy', capacity: 4, now: 0, after: 0 });
    expect(gauge.charged).toBeGreaterThan(0);
    expect(gauge.given).toBeGreaterThan(0);
    expect(gaugeLines(gauge)[1]).toMatch(/it empties when the season ends/);
    const after = endSeason(s);
    expect(after.lastReport!.storage[bank]).toEqual({
      start: 0,
      charged: gauge.charged,
      given: gauge.given,
    });
  });

  it('a heat well keeps what it holds, less what leaks', () => {
    let s = scenario(ROW, { season: 'spring', stores: { food: 500 } });
    s = place(s, 'heatWell', 3, 1);
    const well = uidAt(s, 3, 1);
    s.buildings[well]!.stored = 3;
    const gauge = storageGauge(content, s, resolveAsIs(content, s, { forecast: true }), well)!;
    expect(gauge).toMatchObject({ holds: 'heat', capacity: 6, now: 3 });
    expect(gauge.after).toBe(endSeason(s).buildings[well]!.stored);
    expect(gaugeLines(gauge)[0]).toBe('Holds 3 of 6 heat now.');
    expect(gaugeLines(gauge)[1]).toMatch(/holding \d when the season ends/);
  });
});
