/**
 * The Sun Desert in Root City (SD5, proposals/sun-desert.md, Root City, regions
 * and twists): it opens once 8 districts stand; the Sun Quarter and its Fog Net;
 * the Glassworks landmark; the desert's regions and its own twists.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { blueprintPool } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
import { coolDemand } from '../src/sim/queries';
import {
  applyCityCommand,
  biomeOf,
  createCity,
  createRun,
  expeditionOffer,
  leanOf,
  nextRunBiome,
  nextRunOptions,
  openBiomes,
  type CityDistrict,
  type CityState,
  type RunState,
} from '../src/sim';
import { place, scenario, uidAt } from './helpers';

const DESERT = biomeContent('sunDesert');
const REACH = biomeContent('willowReach');
const COAST = biomeContent('windsweptCoast');
const HIGH = biomeContent('highland');
const SUN = (tier = 'seedling') => ({ districts: { sunQuarter: tier }, landmarks: [] });

describe('the Sun Quarter', () => {
  const quarter = REACH.districts.find((d) => d.id === 'sunQuarter')!;

  it('is earned by sun-led runs: canopies, mirrors, agrivoltaics and restored arrays, full at half', () => {
    const lean = (energyShare: Record<string, number>) =>
      leanOf({ energyShare } as unknown as Parameters<typeof leanOf>[0], quarter);
    expect(lean({ solarCanopy: 0.3, concentratedSolarPlant: 0.2 })).toBe(1);
    expect(lean({ restoredArray: 0.25 })).toBe(0.5);
    expect(lean({ windSpire: 0.9 })).toBe(0);
  });

  it('solar canopies make 1 more by day: winter (Seedling), autumn too (Sapling), spring too (Heartwood)', () => {
    const day = (tier: string | null) => {
      const s = createRun(REACH, { seed: 'sun', ...(tier ? { city: SUN(tier) } : {}) });
      return contentFor(REACH, s).byId.solarCanopy!.generation!.day;
    };
    const base = day(null);
    const more = (tier: string) => day(tier).map((n, i) => n - base[i]!);
    expect(more('seedling')).toEqual([0, 0, 0, 1]);
    expect(more('sapling')).toEqual([0, 0, 1, 1]);
    expect(more('heartwood')).toEqual([1, 0, 1, 1]);
  });

  it('adds the Fog Net to the other biomes, and only with it; the desert offers it anyway', () => {
    for (const c of [REACH, COAST, HIGH]) {
      const without = createRun(c, { seed: 'sun', guided: false, water: true });
      const withIt = createRun(c, { seed: 'sun', guided: false, water: true, city: SUN() });
      // The run's own rules: the Fog Net needs the water system, a run option.
      expect(blueprintPool(contentFor(c, without), without)).not.toContain('fogNet');
      expect(blueprintPool(contentFor(c, withIt), withIt)).toContain('fogNet');
    }
    const desert = createRun(DESERT, { seed: 'sun', water: true });
    expect(blueprintPool(contentFor(DESERT, desert), desert)).toContain('fogNet');
  });

  it('a Fog Net in the Reach stands at the edge of the valley and catches water there too', () => {
    const W = contentFor(REACH, createRun(REACH, { seed: 'sun', water: true }));
    expect(W.byId.fogNet!.placement.atEdge).toBe(true);
    expect(W.byId.fogNet!.water!.collects).toEqual([1, 1, 1, 2]);
  });
});

describe('the Glassworks', () => {
  it('the Sun Quarter next to the Foundry District: greenhouses and canopies cost 1 less', () => {
    const works = {
      districts: { sunQuarter: 'seedling', foundryDistrict: 'seedling' },
      landmarks: ['glassworks'],
    };
    for (const c of [REACH, DESERT]) {
      const rules = contentFor(c, createRun(c, { seed: 'glass', city: works }));
      expect(rules.byId.greenhouse!.cost).toBe(c.byId.greenhouse!.cost - 1);
      expect(rules.byId.solarCanopy!.cost).toBe(c.byId.solarCanopy!.cost - 1);
    }
  });
});

describe("the desert's regions and twists", () => {
  const run = (region: string | null, twist: string | null = null, seed = 'region') =>
    createRun(DESERT, { seed, water: true, expedition: { twist, request: null, region } });
  const tiles = (s: RunState) => Object.values(s.map.tiles);
  const count = (s: RunState, type: string) => tiles(s).filter((t) => t.type === type).length;

  it('every region and twist makes a desert with a camp, on 20 seeds', () => {
    for (const region of DESERT.regions.map((r) => r.id))
      for (let i = 0; i < 20; i++) expect(() => run(region, null, `dune-${i}`)).not.toThrow();
    for (const twist of DESERT.twists.map((t) => t.id))
      for (let i = 0; i < 5; i++) expect(() => run(null, twist, `dune-${i}`)).not.toThrow();
  });

  it('Wadi Country: banks all along the river, and a bigger flash flood', () => {
    for (const seed of ['a', 'b'])
      expect(count(run('wadiCountry', null, seed), 'floodplain')).toBeGreaterThan(
        count(run('theOasis', null, seed), 'floodplain'),
      );
    expect(contentFor(DESERT, run('wadiCountry')).rules.water.riverFlow[0]).toBe(10);
  });

  it('The Erg: more dunes and stronger sun, the Graft a tier higher; Salt Pan; Old Array', () => {
    for (const seed of ['a', 'b']) {
      const oasis = run('theOasis', null, seed);
      expect(count(run('theErg', null, seed), 'erg')).toBeGreaterThan(count(oasis, 'erg'));
      expect(count(run('saltPan', null, seed), 'saltFlat')).toBe(8);
      const array = run('oldArray', null, seed);
      expect(count(array, 'ruin')).toBe(7);
      for (const t of tiles(array).filter((x) => x.type === 'ruin')) expect(t.salvage).toBe(36);
    }
    const erg = contentFor(DESERT, run('theErg'));
    expect(erg.byId.solarCanopy!.generation!.day).toEqual(
      DESERT.byId.solarCanopy!.generation!.day.map((n) => n + 1),
    );
    expect(DESERT.regions.find((r) => r.id === 'theErg')!.graftTierBonus).toBe(1);
  });

  it('Haboob Year: a dust storm in summer; Rainy Year: a second flash flood in autumn', () => {
    expect(contentFor(DESERT, run(null, 'haboobYear')).calendar).toEqual([
      'flood',
      'storm',
      'storm',
      'freeze',
    ]);
    const rainy = contentFor(DESERT, run(null, 'rainyYear'));
    expect(rainy.calendar).toEqual(['flood', 'heatwave', 'flood', 'freeze']);
    expect(rainy.byId.wadiFarm!.yields!.food).toEqual(
      DESERT.byId.wadiFarm!.yields!.food!.map((n) => n + 1),
    );
  });

  it('Scorching Year: homes need cooling on spring and autumn days too', () => {
    const expedition = { twist: 'scorchingYear', request: null, region: null };
    let s = scenario([', , ,', ', C ,'], {
      content: DESERT,
      season: 'spring',
      citizens: 6,
      run: { expedition },
    });
    s = place(s, 'mudBrickHouse', 0, 0, DESERT);
    const house = s.buildings[uidAt(s, 0, 0)]!;
    expect(coolDemand(contentFor(DESERT, s), s, house, 'day', 0)).toBe(1);
    expect(coolDemand(DESERT, s, house, 'day', 0)).toBe(0);
    expect(DESERT.twists.find((t) => t.id === 'scorchingYear')!.graftTierBonus).toBe(1);
  });

  it('Drought Year: the river half as high, the oasis spring weaker', () => {
    const dry = contentFor(DESERT, run(null, 'droughtYear')).rules.water;
    expect(dry.riverFlow).toEqual([3, 0, 1, 1]);
    expect(dry.oasisPerTile).toBe(1);
  });

  it('keeps the shared twists that fit the desert, and not the ones that don’t', () => {
    const ids = DESERT.twists.map((t) => t.id);
    for (const id of ['droughtYear', 'clearSkies', 'leanStart', 'bigFamilies', 'scavengers'])
      expect(ids).toContain(id);
    expect(ids).toContain('steadyWinds');
    for (const id of ['longWinter', 'wildStorms']) expect(ids).not.toContain(id);
  });
});

describe('Root City sends expeditions to the desert once 8 districts stand', () => {
  const HOME = REACH;
  const districts = (n: number): CityDistrict[] =>
    Array.from({ length: n }, (_, i) => ({
      slot: i,
      district: 'millraceQuarter',
      tier: 'seedling',
      invested: 0,
      run: i + 1,
    }));
  const cityWith = (runs: number, n: number): CityState => ({
    ...createCity(HOME, 'desert'),
    runs,
    districts: districts(n),
  });

  it('opens with the eighth district, whatever the run', () => {
    expect(openBiomes(HOME, cityWith(9, 7))).not.toContain('sunDesert');
    expect(openBiomes(HOME, cityWith(9, 8))).toEqual([
      'willowReach',
      'windsweptCoast',
      'highland',
      'sunDesert',
    ]);
  });

  it('the offers take turns between the four biomes', () => {
    const seen = new Set<string>();
    // Before the lake opens (after 10 runs).
    for (const runs of [6, 7, 8, 9])
      for (const o of expeditionOffer(HOME, cityWith(runs, 8))) {
        seen.add(o.biome ?? 'willowReach');
        const c = biomeOf(HOME, o.biome);
        expect(c.twists.map((t) => t.id)).toContain(o.twist);
        if (o.region) expect(c.regions.map((r) => r.id)).toContain(o.region);
      }
    expect([...seen].sort()).toEqual(['highland', 'sunDesert', 'willowReach', 'windsweptCoast']);
  });

  it('a desert expedition plays in the desert, guided the first time', () => {
    let city = cityWith(9, 8);
    let index = -1;
    for (let i = 0; i < 4 && index < 0; i++) {
      index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'sunDesert');
      if (index < 0) city = { ...city, runs: city.runs + 1 };
    }
    expect(index).toBeGreaterThanOrEqual(0);
    const chosen = applyCityCommand(HOME, city, { type: 'chooseExpedition', index });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(nextRunBiome(HOME, chosen.city)).toBe('sunDesert');
    const options = nextRunOptions(HOME, chosen.city);
    expect(options.guided).toBe(true);
    const s = createRun(biomeOf(HOME, nextRunBiome(HOME, chosen.city)), options);
    expect(s.contentId).toBe('sunDesert');
    expect(s.draft.offer).toEqual(DESERT.guidedYear[0]);
  });
});
