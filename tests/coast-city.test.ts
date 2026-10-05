/**
 * The coast in Root City (B5, proposals/windswept-coast.md, Root City,
 * regions and twists): the Tidal Quarter and its Tide Mill, the Estuary Works
 * landmark and its Estuary Turbine, the coast's regions and its own twists.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent, loadBiome, willowReach } from '../src/content';
import { blueprintPool, draftSize } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
import {
  applyCityCommand,
  biomeOf,
  createCity,
  createRun,
  expeditionOffer,
  hexKey,
  leanOf,
  nextRunBiome,
  nextRunOptions,
  openBiomes,
  tempestUnlockedIn,
  type CityState,
  type RunState,
} from '../src/sim';
import { endSeason, place, rejects, scenario, at, uidAt } from './helpers';

const COAST = biomeContent('windsweptCoast');
const REACH = biomeContent('willowReach');
const QUARTER = { districts: { tidalQuarter: 'seedling' }, landmarks: [] };
const WORKS = {
  districts: { tidalQuarter: 'seedling', millraceQuarter: 'seedling' },
  landmarks: ['estuaryWorks'],
};

// The stream (~) runs east into the sea (=); mudflat (_) along the shore.
const SHORE = ['. , , , _ = =', '. ~ ~ ~ ~ = =', '. C , , _ = =', '. , , : _ = ='];
const start = (city?: { districts: Record<string, string>; landmarks: string[] }) =>
  scenario(SHORE, {
    content: COAST,
    citizens: 10,
    stores: { food: 40 },
    run: city ? { city } : {},
  });
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 40 } }, COAST);

describe('the Tidal Quarter', () => {
  it('is earned by tide-powered runs', () => {
    const quarter = COAST.districts.find((d) => d.id === 'tidalQuarter')!;
    const tidal = { energyShare: { tideTurbine: 0.6 } } as unknown as Parameters<typeof leanOf>[0];
    expect(quarter.signature.sources).toEqual(
      expect.arrayContaining(['tideTurbine', 'waveBuoy', 'tideMill', 'estuaryTurbine']),
    );
    expect(leanOf(tidal, quarter)).toBeGreaterThan(0);
  });

  it('deals 4 cards in the first season of each era, 3 otherwise', () => {
    const s = createRun(COAST, { seed: 'quarter', guided: false, city: QUARTER });
    expect(s.draft.offer).toHaveLength(4);
    const rules = contentFor(COAST, s);
    expect(draftSize(rules, { ...s, turn: 1 })).toBe(3);
    expect(draftSize(rules, { ...s, turn: 12 })).toBe(4);
    const plain = createRun(COAST, { seed: 'quarter', guided: false });
    expect(plain.draft.offer).toHaveLength(3);
  });

  it('adds the Tide Mill to coast drafts, and only with it', () => {
    const s = createRun(COAST, { seed: 'mill', guided: false });
    expect(blueprintPool(COAST, s)).not.toContain('tideMill');
    const q = createRun(COAST, { seed: 'mill', guided: false, city: QUARTER });
    expect(blueprintPool(contentFor(COAST, q), q)).toContain('tideMill');
  });
});

describe('the Tide Mill', () => {
  it('fills with the tide each season and gives it in either slot, on mudflat by the sea', () => {
    let s = start();
    expect(rejects(s, { type: 'place', building: 'tideMill', at: at(2, 2) }, COAST)).toMatch(
      /can't be built|must be next to/,
    );
    // Smokehouses need heat at night, which the grid pays in energy.
    // More than the camp's 2 night energy covers.
    for (const [col, row] of [
      [2, 0],
      [3, 0],
      [2, 2],
      [3, 2],
    ] as const)
      s = place(s, 'smokehouse', col, row, COAST);
    const without = end(s).lastReport!.energy.night;
    s = place(s, 'tideMill', 4, 0, COAST);
    const uid = uidAt(s, 4, 0);
    s = end(s);
    expect(without.storageDischarged).toBe(0);
    expect(s.lastReport!.energy.night.storageDischarged).toBeGreaterThan(0);
    expect(s.lastReport!.storage[uid]!.charged).toBeGreaterThanOrEqual(3);
    // It empties as the season ends: the tide fills it again.
    expect(s.buildings[uid]!.stored ?? 0).toBe(0);
    const given = s.lastReport!.storage[uid]!.given;
    expect(given).toBeGreaterThan(0);
  });
});

describe('the Estuary Works', () => {
  it('starts every coast run with the Estuary Turbine, at the stream mouth', () => {
    const s = createRun(COAST, { seed: 'works', city: WORKS });
    expect(s.unlocked).toContain('estuaryTurbine');
    expect(createRun(COAST, { seed: 'works', city: QUARTER }).unlocked).not.toContain(
      'estuaryTurbine',
    );
    // The Reach has no estuary: the landmark gives it nothing.
    const reach = createRun(REACH, { seed: 'works', city: WORKS });
    expect(reach.unlocked).not.toContain('estuaryTurbine');
    // Only on the stream where it meets the sea.
    const shore = start(WORKS);
    expect(rejects(shore, { type: 'place', building: 'estuaryTurbine', at: at(2, 1) }, COAST)).toBe(
      'Estuary Turbine must be next to sea',
    );
    const built = place(shore, 'estuaryTurbine', 4, 1, COAST);
    const next = end(built);
    expect(next.lastReport!.energy.night.supply).toBeGreaterThan(
      end(shore).lastReport!.energy.night.supply,
    );
  });
});

describe("the coast's regions and twists", () => {
  const run = (region: string | null, twist: string | null = null, seed = 'region') =>
    createRun(COAST, { seed, expedition: { twist, request: null, region } });
  const count = (s: RunState, type: string) =>
    Object.values(s.map.tiles).filter((t) => t.type === type).length;

  it('Shingle Spit: more sea; Saltmarsh Estuary: more mudflat; Drowned Harbour: more ruins', () => {
    for (const seed of ['a', 'b', 'c']) {
      const coast = run('theCoast', null, seed);
      expect(count(run('shingleSpit', null, seed), 'sea')).toBeGreaterThan(count(coast, 'sea'));
      expect(count(run('saltmarshEstuary', null, seed), 'mudflat')).toBeGreaterThanOrEqual(
        count(coast, 'mudflat'),
      );
      expect(count(run('drownedHarbour', null, seed), 'ruin')).toBeGreaterThan(
        count(coast, 'ruin'),
      );
    }
  });

  it('Sea Cliffs: more headland, and the Graft a tier higher', () => {
    const cliffs = COAST.regions.find((r) => r.id === 'seaCliffs')!;
    expect(cliffs.graftTierBonus).toBe(1);
    expect(count(run('seaCliffs', null, 'a'), 'hill')).toBeGreaterThan(
      count(run('theCoast', null, 'a'), 'hill'),
    );
  });

  it('Big Tides: the king tide reaches a ring further (never the camp), the tide turbines +1', () => {
    for (const seed of ['a', 'b', 'c']) {
      const plain = run(null, null, seed);
      const big = run(null, 'bigTides', seed);
      expect(big.map.floodOrder.length).toBeGreaterThan(plain.map.floodOrder.length);
      expect(big.map.floodOrder).not.toContain(hexKey(big.buildings.b0!.at));
      for (const key of plain.map.floodOrder) expect(big.map.floodOrder).toContain(key);
    }
    const turbine = contentFor(COAST, run(null, 'bigTides')).byId.tideTurbine!;
    expect(turbine.generation!.night).toEqual([3, 2, 3, 2]);
  });

  it('Becalmed (wind −1, the Graft a tier higher) and Fogbound (solar −1)', () => {
    const becalmed = contentFor(COAST, run(null, 'becalmed'));
    const wind = COAST.byId.windSpire!.generation!;
    expect(becalmed.byId.windSpire!.generation!.day).toEqual(wind.day.map((n) => n - 1));
    expect(COAST.twists.find((t) => t.id === 'becalmed')!.graftTierBonus).toBe(1);
    const fogbound = contentFor(COAST, run(null, 'fogbound'));
    const solar = COAST.byId.solarCanopy!.generation!;
    expect(fogbound.byId.solarCanopy!.generation!.day).toEqual(solar.day.map((n) => n - 1));
  });
});

describe('Root City sends expeditions to the coast from run 5', () => {
  const HOME = biomeContent('willowReach');
  const cityAt = (runs: number): CityState => ({ ...createCity(HOME, 'atlas'), runs });

  it('the coast opens at run 5; a city already past it has it at once', () => {
    expect(openBiomes(HOME, cityAt(3))).toEqual(['willowReach']);
    expect(openBiomes(HOME, cityAt(4))).toEqual(['willowReach', 'windsweptCoast']);
    expect(openBiomes(HOME, cityAt(9))).toEqual(['willowReach', 'windsweptCoast']);
    // After 10 runs Lake Gardens opens too, however many districts stand.
    expect(openBiomes(HOME, cityAt(12))).toEqual(['willowReach', 'windsweptCoast', 'lakeGardens']);
    // Content loaded on its own knows no other biome.
    expect(openBiomes(loadBiome(willowReach), cityAt(12))).toEqual(['willowReach']);
  });

  it('the offers take turns between the biomes, each with its own twists and regions', () => {
    for (const runs of [4, 5, 6, 7]) {
      const offer = expeditionOffer(HOME, cityAt(runs));
      expect(new Set(offer.map((o) => o.biome ?? 'willowReach')).size).toBe(2);
      for (const o of offer) {
        const c = biomeOf(HOME, o.biome);
        expect(c.twists.map((t) => t.id)).toContain(o.twist);
        if (o.region) expect(c.regions.map((r) => r.id)).toContain(o.region);
      }
    }
    // Each biome leads in turn.
    const first = [4, 5].map((runs) => expeditionOffer(HOME, cityAt(runs))[0]!.biome);
    expect(first).toEqual([undefined, 'windsweptCoast']);
  });

  it('a coast expedition plays on the coast, guided the first time', () => {
    let city = cityAt(5);
    const index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'windsweptCoast');
    const chosen = applyCityCommand(HOME, city, { type: 'chooseExpedition', index });
    expect(chosen.ok).toBe(true);
    city = chosen.ok ? chosen.city : city;
    expect(nextRunBiome(HOME, city)).toBe('windsweptCoast');
    const options = nextRunOptions(HOME, city);
    expect(options.guided).toBe(true);
    const run = createRun(biomeOf(HOME, nextRunBiome(HOME, city)), options);
    expect(run.contentId).toBe('windsweptCoast');
    // Sent home: the next coast run is not guided.
    const home = applyCityCommand(HOME, city, {
      type: 'sendHome',
      result: { graft: null, earned: 10, spent: 0, tier: 'sapling', biome: 'windsweptCoast' },
    });
    expect(home.ok && home.city.biomeRuns).toEqual({ windsweptCoast: 1 });
    const again = home.ok ? home.city : city;
    const coast = expeditionOffer(HOME, again).findIndex((o) => o.biome === 'windsweptCoast');
    const next = applyCityCommand(HOME, again, { type: 'chooseExpedition', index: coast });
    expect(next.ok && nextRunOptions(HOME, next.city).guided).toBe(false);
  });

  it('Tempest levels unlock in the biome where the Heartwood Graft was earned', () => {
    const city = { ...cityAt(6), tempestUnlocked: 2 };
    const sent = applyCityCommand(HOME, city, {
      type: 'sendHome',
      result: { graft: null, earned: 10, spent: 0, tier: 'heartwood', biome: 'windsweptCoast' },
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.events).toContainEqual({ kind: 'tempest', level: 1, biome: 'windsweptCoast' });
    expect(sent.city.tempestUnlocked).toBe(2);
    expect(tempestUnlockedIn(HOME, sent.city, 'windsweptCoast')).toBe(1);
    // Tempest 2 chosen: the Reach plays it, the coast only the level it has unlocked.
    const set = applyCityCommand(HOME, sent.city, { type: 'setTempest', level: 2 });
    const c = set.ok ? set.city : sent.city;
    const reach = expeditionOffer(HOME, c).findIndex((o) => o.biome === undefined);
    const coast = expeditionOffer(HOME, c).findIndex((o) => o.biome === 'windsweptCoast');
    const tempestFor = (index: number) => {
      const r = applyCityCommand(HOME, c, { type: 'chooseExpedition', index });
      return r.ok ? nextRunOptions(HOME, r.city).expedition?.tempest : -1;
    };
    expect(tempestFor(reach)).toBe(2);
    expect(tempestFor(coast)).toBe(1);
  });
});
