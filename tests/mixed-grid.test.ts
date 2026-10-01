/**
 * The Mixed Grid (DECISIONS.md, designer's answer to Q3 and Q5): 3 or more
 * built source types, each at least 15% of the energy over the last 4
 * seasons. The camp, storage and the bonus itself don't count. It stops storm
 * damage and adds energy to every slot.
 */
import { describe, expect, it } from 'vitest';
import type { RunState } from '../src/sim';
import { content, endSeason, place, scenario } from './helpers';

const HILLS = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];
const withHistory = (s: RunState, mix: Record<string, number>) => ({
  ...s,
  energyHistory: [mix, mix, mix, mix],
});
const grid = (mix: Record<string, number>, season: 'spring' | 'autumn' = 'spring') =>
  endSeason(withHistory(scenario(HILLS, { season }), mix)).lastReport!;

describe('the Mixed Grid', () => {
  it('counts built sources only, by type', () => {
    expect(
      grid({ solarCanopy: 10, riverWheel: 10, windSpire: 10, foundersCamp: 200 }).mixedGrid,
    ).toBe(true);
    expect(grid({ solarCanopy: 10, riverWheel: 10, foundersCamp: 200 }).mixedGrid).toBe(false);
    // An Agrivoltaic Field is solar: it doesn't make a third type.
    expect(grid({ solarCanopy: 10, agrivoltaicField: 10, riverWheel: 10 }).mixedGrid).toBe(false);
    // The bonus never counts towards itself.
    expect(grid({ solarCanopy: 10, riverWheel: 10, mixedGrid: 50 }).mixedGrid).toBe(false);
    // Each type needs 15% of the built energy.
    expect(grid({ solarCanopy: 100, riverWheel: 100, windSpire: 10 }).mixedGrid).toBe(false);
  });

  it('adds energy to every slot, kept apart from the sources that earned it', () => {
    const r = grid({ solarCanopy: 10, riverWheel: 10, windSpire: 10 });
    const bonus = content.rules.mixedGrid.bonusPerSlot;
    expect(bonus).toBe(1);
    for (const slot of ['day', 'night'] as const) {
      expect(r.energy[slot].bySource.mixedGrid).toBe(bonus);
    }
    expect(r.energy.night.supply).toBe(2 + bonus); // the camp's 2, and the bonus
  });

  it('stops storm damage', () => {
    const storm = (mix: Record<string, number>) => {
      let s = withHistory(scenario(HILLS, { season: 'autumn' }), mix);
      s = place(s, 'windSpire', 9, 1);
      return endSeason(s).lastReport!.damaged;
    };
    expect(storm({ solarCanopy: 10 })).toHaveLength(1);
    expect(storm({ solarCanopy: 10, riverWheel: 10, windSpire: 10 })).toEqual([]);
  });
});
