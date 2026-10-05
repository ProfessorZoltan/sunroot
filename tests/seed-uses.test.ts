/**
 * Other uses for Seeds (proposals/seed-uses.md): a new set of expeditions before
 * a run, for Seeds that rise with each set; and keepsakes, bought once and kept,
 * only to look at.
 */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent } from '../src/content';
import {
  applyCityCommand,
  createCity,
  createRun,
  expeditionOffer,
  keepsakesOn,
  nextRunOptions,
  runCity,
  scoutCost,
  type CityCommand,
  type CityState,
} from '../src/sim';
import { endSeason } from './helpers';

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

describe('keepsakes', () => {
  const buy = (city: CityState, id: string) => apply(city, { type: 'buyKeepsake', id });
  const price = (id: string) => REACH.keepsakes.find((k) => k.id === id)!.cost;

  it('20 young ones at 20 Seeds; 6 settlement ornaments at 30 or 40; 4 city ones at 40 to 60', () => {
    const of = (kind: string) => REACH.keepsakes.filter((k) => k.kind === kind);
    expect(of('wildlife')).toHaveLength(20);
    expect(of('wildlife').every((k) => k.cost === 20)).toBe(true);
    expect(of('settlement').map((k) => k.cost)).toEqual([30, 30, 40, 40, 30, 40]);
    expect(of('city').map((k) => k.cost)).toEqual([50, 40, 60, 40]);
  });

  it("each young one joins an animal of some biome, every biome's animals one each", () => {
    const animals = Object.keys(BIOMES).flatMap((id) => biomeContent(id).wildlife.map((a) => a.id));
    const joined = REACH.keepsakes.filter((k) => k.kind === 'wildlife').map((k) => k.animal);
    expect([...joined].sort()).toEqual([...animals].sort());
  });

  it('is bought once, for its price, open from the start', () => {
    let c = after(0, 50);
    c = buy(c, 'whiteHart');
    expect(c.seeds).toBe(50 - price('whiteHart'));
    expect(c.keepsakes).toEqual(['whiteHart']);
    expect(refuses(c, { type: 'buyKeepsake', id: 'whiteHart' })).toBe(
      "The white hart is already the city's",
    );
    expect(refuses(after(0, 10), { type: 'buyKeepsake', id: 'fountain' })).toBe(
      'The fountain costs 60 Seeds',
    );
    expect(refuses(c, { type: 'buyKeepsake', id: 'unicorn' })).toBe('unknown keepsake unicorn');
  });

  it('switches off and on again for free', () => {
    let c = buy(buy(after(1, 100), 'bunting'), 'fireflies');
    c = apply(c, { type: 'setKeepsake', id: 'bunting', on: false });
    expect(keepsakesOn(c)).toEqual(['fireflies']);
    c = apply(c, { type: 'setKeepsake', id: 'bunting', on: true });
    expect(keepsakesOn(c)).toEqual(['bunting', 'fireflies']);
    expect(c.keepsakesOff).toBeUndefined();
    expect(refuses(c, { type: 'setKeepsake', id: 'kites', on: true })).toBe(
      'buy the keepsake first',
    );
  });

  it("goes with every run: those on, and the banner in the first district's colour", () => {
    let c: CityState = {
      ...after(2, 100),
      districts: [
        { slot: 3, district: 'orchardWard', tier: 'seedling', invested: 0, run: 2 },
        { slot: 0, district: 'foundryDistrict', tier: 'seedling', invested: 0, run: 1 },
      ],
    };
    expect(runCity(REACH, c).keepsakes).toBeUndefined();
    c = buy(buy(c, 'cityBanner'), 'otterCubs');
    expect(runCity(REACH, c)).toMatchObject({
      keepsakes: ['cityBanner', 'otterCubs'],
      banner: 'foundryDistrict',
    });
    c = apply(c, { type: 'setKeepsake', id: 'cityBanner', on: false });
    expect(runCity(REACH, c).banner).toBeUndefined();
    const s = createRun(REACH, nextRunOptions(REACH, c));
    expect(s.options.city.keepsakes).toEqual(['otterCubs']);
  });

  it('changes nothing in how a run plays', () => {
    const plain = createRun(REACH, { seed: 'keep', water: true });
    const dressed = createRun(REACH, {
      seed: 'keep',
      water: true,
      city: { districts: {}, landmarks: [], keepsakes: REACH.keepsakes.map((k) => k.id) },
    });
    let a = plain;
    let b = dressed;
    for (let i = 0; i < 8 && a.status === 'active'; i++) {
      a = endSeason(a, REACH);
      b = endSeason(b, REACH);
    }
    expect(a.turn).toBeGreaterThan(1);
    // Everything but the keepsakes themselves (in the options, and the season's starting copy).
    const plainOf = (x: unknown) =>
      JSON.stringify(x, (k: string, v: unknown) => (k === 'keepsakes' ? undefined : v));
    expect(plainOf(b)).toBe(plainOf(a));
  });
});
