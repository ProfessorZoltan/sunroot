/**
 * Other uses for Seeds (proposals/seed-uses.md): a new set of expeditions before
 * a run, for Seeds that rise with each set.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  applyCityCommand,
  createCity,
  expeditionOffer,
  scoutCost,
  type CityCommand,
  type CityState,
} from '../src/sim';

const REACH = biomeContent('willowReach');
const after = (runs: number, seeds: number): CityState => ({
  ...createCity(REACH, 'scout'),
  runs,
  seeds,
});
function apply(city: CityState, command: CityCommand): CityState {
  const r = applyCityCommand(REACH, city, command);
  if (!r.ok) throw new Error(r.error);
  return r.city;
}
const refuses = (city: CityState, command: CityCommand) => {
  const r = applyCityCommand(REACH, city, command);
  return r.ok ? null : r.error;
};
const scout = (city: CityState) => apply(city, { type: 'scoutExpeditions' });

describe('a new set of expeditions', () => {
  it('costs 5 Seeds, then 10, then 15 before the same run', () => {
    let c = after(2, 40);
    expect(scoutCost(REACH, c)).toBe(5);
    c = scout(c);
    expect(c.seeds).toBe(35);
    expect(scoutCost(REACH, c)).toBe(10);
    c = scout(c);
    expect(c.seeds).toBe(25);
    expect(scoutCost(REACH, c)).toBe(15);
  });

  it('offers 3 other valleys each time, the same ones for the same city', () => {
    const c = after(2, 40);
    const seeds = (x: CityState) => expeditionOffer(REACH, x).map((o) => o.seed);
    const first = seeds(c);
    const second = seeds(scout(c));
    const third = seeds(scout(scout(c)));
    expect(new Set([...first, ...second, ...third]).size).toBe(9);
    expect(seeds(scout(c))).toEqual(second);
  });

  it('leaves the offer as it was when none is bought', () => {
    const c = after(2, 40);
    expect(expeditionOffer(REACH, c)[0]!.seed).toBe('scout-3-a');
  });

  it('turns the biomes round too, once more than one is open', () => {
    const c = after(5, 40);
    const first = (x: CityState) => expeditionOffer(REACH, x)[0]!.biome ?? REACH.id;
    expect(first(scout(c))).not.toBe(first(c));
  });

  it('drops the expedition chosen from the old set', () => {
    let c = apply(after(2, 40), { type: 'chooseExpedition', index: 1 });
    expect(c.expedition).not.toBeNull();
    c = scout(c);
    expect(c.expedition).toBeNull();
  });

  it('is refused without the Seeds, before the first run, or with a Graft to place', () => {
    expect(refuses(after(2, 4), { type: 'scoutExpeditions' })).toBe(
      'a new set of expeditions costs 5 Seeds',
    );
    expect(refuses(after(0, 40), { type: 'scoutExpeditions' })).toBe('no new expeditions on offer');
    const waiting: CityState = {
      ...after(2, 40),
      pending: [{ district: 'orchardWard', tier: 'seedling' } as CityState['pending'][number]],
    };
    expect(refuses(waiting, { type: 'scoutExpeditions' })).toBe('place the Graft first');
  });

  it('starts again at 5 Seeds after the next run', () => {
    let c = scout(scout(after(2, 40)));
    c = apply(c, {
      type: 'sendHome',
      result: { graft: null, earned: 10, spent: 0, tier: 'seedling' },
    });
    expect(c.scouted).toBeUndefined();
    expect(scoutCost(REACH, c)).toBe(5);
  });
});
