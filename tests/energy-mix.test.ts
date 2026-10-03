/**
 * The Energy mix chart's data (src/game/energyMix.ts): the year's 8 slots, each
 * one's energy by family of source, and what was needed.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { computeInsight } from '../src/game/insight';
import { FAMILIES, energyMix, familyOf } from '../src/game/energyMix';
import { createRun, projectSeason, type RunState } from '../src/sim';
import { resolveSeason } from '../src/sim/season/resolve';
import { endSeason, place, scenario } from './helpers';

const REACH = biomeContent('willowReach');

/** The year as the interface sees it, in the given state. */
const yearOf = (s: RunState) => computeInsight(REACH, s, resolveSeason(REACH, s)).year;

describe('the energy mix', () => {
  it('sorts each source into its family, the same in every biome', () => {
    expect(familyOf(REACH, 'foundersCamp')).toBe('camp');
    expect(familyOf(REACH, 'solarCanopy')).toBe('sun');
    expect(familyOf(REACH, 'agrivoltaicField')).toBe('sun');
    expect(familyOf(REACH, 'windSpire')).toBe('wind');
    expect(familyOf(REACH, 'riverWheel')).toBe('water');
    expect(familyOf(REACH, 'biogasDigester')).toBe('biogas');
    expect(familyOf(REACH, 'mixedGrid')).toBe('other');
    const coast = biomeContent('windsweptCoast');
    expect(familyOf(coast, 'tideTurbine')).toBe('tide');
    expect(familyOf(biomeContent('highland'), 'hillTurbine')).toBe('water');
    // Bottom to top: the camp first, as the colours were checked.
    expect(FAMILIES.map((f) => f.id)).toEqual([
      'camp',
      'water',
      'tide',
      'sun',
      'storage',
      'biogas',
      'wind',
      'other',
    ]);
  });

  it('gives 8 slots in order, each adding up to what was made', () => {
    let s = scenario([', , , ,', ', C , ,', ', , , ,'], { citizens: 6, stores: { food: 40 } });
    s = place(s, 'solarCanopy', 0, 0);
    const { points, families } = energyMix(REACH, yearOf(s));
    expect(points.map((p) => `${p.season} ${p.slot}`)).toEqual([
      'spring day',
      'spring night',
      'summer day',
      'summer night',
      'autumn day',
      'autumn night',
      'winter day',
      'winter night',
    ]);
    expect(families.map((f) => f.id)).toEqual(['camp', 'sun']);
    // Solar makes nothing at night.
    for (const p of points.filter((x) => x.slot === 'night')) expect(p.values.sun).toBe(0);
    // Each slot's stack is the energy made and given back by storage.
    for (const p of points) {
      const sum = Object.values(p.values).reduce((a, b) => a + b, 0);
      expect(p.total).toBe(sum);
    }
    const summer = projectSeason(REACH, s, 'summer', { forecast: true }).energy.day;
    expect(points[2]!.total).toBe(summer.supply + summer.storageDischarged);
    expect(points[2]!.status).toBe('forecast');
  });

  it('keeps the mix of seasons already played', () => {
    let s = createRun(REACH, { seed: 'mix' });
    s = endSeason(s);
    const spring = energyMix(REACH, yearOf(s)).points[0]!;
    expect(spring.status).toBe('done');
    expect(spring.values.camp).toBeGreaterThan(0);
    expect(spring.total).toBe(
      s.history[0]!.energy.day.supply + (s.history[0]!.energy.day.discharged ?? 0),
    );
  });
});
