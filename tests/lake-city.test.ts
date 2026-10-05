/**
 * Lake Gardens in Root City (LG5, proposals/lake-gardens.md, Root City, regions and twists): it
 * opens after 10 runs, however many districts stand; the Canal Quarter, earned by water-led food,
 * and its Mud Boat in the other biomes; the Water Market landmark; the lake's regions, twists and
 * Tempest.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { blueprintPool } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
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
  runSignature,
  type CityState,
  type RunState,
} from '../src/sim';
import { endSeason, place, scenario, uidAt } from './helpers';

const LAKE = biomeContent('lakeGardens');
const REACH = biomeContent('willowReach');
const COAST = biomeContent('windsweptCoast');
const HIGH = biomeContent('highland');
const DESERT = biomeContent('sunDesert');
const CANAL = (tier = 'seedling') => ({ districts: { canalQuarter: tier }, landmarks: [] });

describe('the Canal Quarter', () => {
  const quarter = REACH.districts.find((d) => d.id === 'canalQuarter')!;

  it('is earned by water-led food: chinampas, fisheries and fish ponds, full at half', () => {
    const lean = (foodShare: Record<string, number>) =>
      leanOf({ foodShare } as unknown as Parameters<typeof leanOf>[0], quarter);
    expect(lean({ chinampa: 0.3, lakeFishery: 0.2 })).toBe(1);
    expect(lean({ fishPond: 0.25, floodplainFarm: 0.75 })).toBe(0.5);
    expect(lean({ floodplainFarm: 1 })).toBe(0);
  });

  it("a run's food is counted by what made it", () => {
    let s = scenario(['~ f , , ,', '~ , C , ,', '~ , , , ,'], { content: REACH, season: 'summer' });
    s = place(s, 'floodplainFarm', 1, 0);
    s = endSeason(s);
    const farm = s.lastReport!.yields[uidAt(s, 1, 0)]?.food ?? 0;
    expect(farm).toBeGreaterThan(0);
    expect(s.ledger.food?.floodplainFarm).toBe(farm);
    expect(runSignature(REACH, s).foodShare.floodplainFarm).toBeGreaterThan(0);
  });

  it('fish ponds make 1 more food: winter (Seedling), autumn too (Sapling), spring too (Heartwood)', () => {
    const food = (tier: string | null) => {
      const s = createRun(REACH, { seed: 'canal', ...(tier ? { city: CANAL(tier) } : {}) });
      return contentFor(REACH, s).byId.fishPond!.yields.food!;
    };
    const base = food(null);
    const more = (tier: string) => food(tier).map((n, i) => n - base[i]!);
    expect(more('seedling')).toEqual([0, 0, 0, 1]);
    expect(more('sapling')).toEqual([0, 0, 1, 1]);
    expect(more('heartwood')).toEqual([1, 0, 1, 1]);
  });

  it('adds the Mud Boat to the other biomes, and only with it; on the lake it is a starter', () => {
    for (const c of [REACH, COAST, HIGH, DESERT]) {
      const without = createRun(c, { seed: 'canal', guided: false, water: true });
      const withIt = createRun(c, { seed: 'canal', guided: false, water: true, city: CANAL() });
      expect(blueprintPool(contentFor(c, without), without)).not.toContain('mudBoat');
      expect(blueprintPool(contentFor(c, withIt), withIt)).toContain('mudBoat');
    }
    expect(LAKE.byId.mudBoat!.starter).toBe(true);
  });

  it("a Mud Boat elsewhere lifts the river's silt as compost: 1 a season, 2 in winter", () => {
    expect(REACH.byId.mudBoat!.yields.compost).toEqual([1, 1, 1, 2]);
    let s = scenario(['~ , , ,', '~ , C ,'], { content: REACH, season: 'winter' });
    s = place(s, 'mudBoat', 1, 0);
    s = endSeason({ ...s, stores: { ...s.stores, food: 100 } });
    expect(s.lastReport!.yields[uidAt(s, 1, 0)]?.compost).toBe(2);
    // Beside the water only.
    const dry = scenario(['~ , , ,', '~ , C ,'], { content: REACH });
    expect(() => place(dry, 'mudBoat', 3, 0)).toThrow();
  });

  it('the Sun Quarter brings the Fog Net to the lake too', () => {
    const sun = { districts: { sunQuarter: 'seedling' }, landmarks: [] };
    const s = createRun(LAKE, { seed: 'fog', guided: false, water: true, city: sun });
    expect(blueprintPool(contentFor(LAKE, s), s)).toContain('fogNet');
    const none = createRun(LAKE, { seed: 'fog', guided: false, water: true });
    expect(blueprintPool(contentFor(LAKE, none), none)).not.toContain('fogNet');
  });
});

describe('the Water Market', () => {
  const market = {
    districts: { canalQuarter: 'seedling', orchardWard: 'seedling' },
    landmarks: ['waterMarket'],
  };
  /** A camp with more food than it can store, ended for a season with or without the market. */
  const over = (city?: typeof market) => {
    const s = scenario(['~ , , ,', '~ , C ,'], {
      content: REACH,
      season: 'summer',
      stores: { food: 200 },
      ...(city ? { run: { city } } : {}),
    });
    return s;
  };

  it('keeps food beyond storage a season before it rots, in every biome', () => {
    const plain = endSeason(over());
    expect(plain.lastReport!.food.rotted).toBeGreaterThan(0);
    let kept = endSeason(over(market));
    expect(kept.lastReport!.food.rotted).toBe(0);
    expect(kept.heldOver).toBeGreaterThan(0);
    const held = kept.heldOver!;
    // The next season what was held over rots (as far as food is still beyond storage).
    kept = endSeason(kept);
    expect(kept.lastReport!.food.rotted).toBeGreaterThan(0);
    expect(kept.lastReport!.food.rotted).toBeLessThanOrEqual(held);
    for (const c of [REACH, LAKE, DESERT])
      expect(contentFor(c, createRun(c, { seed: 'm', city: market })).rules.surplusKeeps).toBe(
        true,
      );
  });
});

describe('Root City sends expeditions to the lake after 10 runs', () => {
  const HOME = REACH;
  const cityAt = (runs: number): CityState => ({ ...createCity(HOME, 'lake'), runs });
  /** With 8 districts standing, so all five biomes are open. */
  const eight = (runs: number): CityState => ({
    ...cityAt(runs),
    districts: Array.from({ length: 8 }, (_, i) => ({
      slot: i,
      district: 'millraceQuarter',
      tier: 'seedling',
      invested: 0,
      run: i + 1,
    })),
  });

  it('opens once 10 runs are done, however many districts stand', () => {
    expect(openBiomes(HOME, cityAt(9))).not.toContain('lakeGardens');
    expect(openBiomes(HOME, cityAt(10))).toContain('lakeGardens');
  });

  it('is offered at once, until a run has been there; then it takes its turn', () => {
    const visited = { windsweptCoast: 1, highland: 1, sunDesert: 1 };
    for (const runs of [10, 11, 12, 13, 14]) {
      const offer = expeditionOffer(HOME, { ...eight(runs), biomeRuns: visited });
      expect(offer.map((o) => o.biome)).toContain('lakeGardens');
    }
    const been = { ...visited, lakeGardens: 1 };
    const offered = [10, 11, 12, 13, 14].map((runs) =>
      expeditionOffer(HOME, { ...eight(runs), biomeRuns: been }).some(
        (o) => o.biome === 'lakeGardens',
      ),
    );
    expect(offered).toContain(false);
    expect(offered).toContain(true);
  });

  it('the offers take turns between the five biomes', () => {
    const seen = new Set<string>();
    for (const runs of [10, 11, 12, 13, 14, 15])
      for (const o of expeditionOffer(HOME, eight(runs))) {
        seen.add(o.biome ?? 'willowReach');
        const c = biomeOf(HOME, o.biome);
        expect(c.twists.map((t) => t.id)).toContain(o.twist);
        if (o.region) expect(c.regions.map((r) => r.id)).toContain(o.region);
      }
    expect([...seen].sort()).toEqual([
      'highland',
      'lakeGardens',
      'sunDesert',
      'willowReach',
      'windsweptCoast',
    ]);
  });

  it('a lake expedition plays on the lake, guided the first time', () => {
    let city = cityAt(10);
    let index = -1;
    for (let i = 0; i < 6 && index < 0; i++) {
      index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'lakeGardens');
      if (index < 0) city = { ...city, runs: city.runs + 1 };
    }
    expect(index).toBeGreaterThanOrEqual(0);
    const chosen = applyCityCommand(HOME, city, { type: 'chooseExpedition', index });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(nextRunBiome(HOME, chosen.city)).toBe('lakeGardens');
    const options = nextRunOptions(HOME, chosen.city);
    expect(options.guided).toBe(true);
    const s = createRun(biomeOf(HOME, 'lakeGardens'), options);
    expect(s.contentId).toBe('lakeGardens');
    expect(s.draft.offer).toEqual(LAKE.guidedYear[0]);
  });
});

describe("the lake's regions, twists and Tempest", () => {
  const run = (region: string | null, twist: string | null = null, seed = 'region') =>
    createRun(LAKE, { seed, water: true, expedition: { twist, request: null, region } });
  const count = (s: RunState, type: string) =>
    Object.values(s.map.tiles).filter((t) => t.type === type).length;
  const SEEDS = ['a', 'b', 'c', 'd'];
  const total = (region: string, type: string) =>
    SEEDS.reduce((n, seed) => n + count(run(region, null, seed), type), 0);

  it('every region and twist makes a lake with a camp, on 20 seeds', () => {
    for (const region of LAKE.regions.map((r) => r.id))
      for (let i = 0; i < 20; i++) expect(() => run(region, null, `lake-${i}`)).not.toThrow();
    for (const twist of LAKE.twists.map((t) => t.id))
      for (let i = 0; i < 5; i++) expect(() => run(null, twist, `lake-${i}`)).not.toThrow();
  });

  it('Delta Mouth: a bigger stream and reed all round; Reed Marsh: deeper fringe, little deep water', () => {
    expect(contentFor(LAKE, run('deltaMouth')).rules.water.riverFlow).toEqual([14, 8, 10, 10]);
    expect(total('deltaMouth', 'floodplain')).toBeGreaterThan(total('openLake', 'floodplain'));
    expect(total('reedMarsh', 'floodplain')).toBeGreaterThan(total('openLake', 'floodplain'));
    expect(total('reedMarsh', 'deep')).toBeLessThan(total('openLake', 'deep'));
  });

  it('Drowned Town: 7 ruins of 36; Island Chain: islands and few shallows', () => {
    for (const seed of SEEDS) {
      const ruins = Object.values(run('drownedTown', null, seed).map.tiles).filter(
        (t) => t.type === 'ruin',
      );
      expect(ruins.length).toBe(7);
      expect(ruins.every((t) => t.salvage === 36)).toBe(true);
    }
    expect(total('islandChain', 'shallows')).toBeLessThan(total('openLake', 'shallows'));
    // The harder ones raise the Graft a tier.
    const bonus = (id: string) =>
      [...LAKE.regions, ...LAKE.twists].find((x) => x.id === id)!.graftTierBonus;
    expect(['reedMarsh', 'monsoon', 'droughtYear', 'leanStart'].map(bonus)).toEqual([1, 1, 1, 1]);
    expect(['islandChain', 'bloomYear', 'drySeason'].map(bonus)).toEqual([0, 0, 0]);
  });

  it("the lake's own twists: Dry Season, Bloom Year, Monsoon; and Drought Year in its terms", () => {
    const rules = (twist: string) => contentFor(LAKE, run(null, twist));
    const dry = rules('drySeason');
    expect(dry.rules.water.riverFlow[1]).toBe(0);
    expect(dry.byId.chinampa!.water!.needs).toEqual([1, 2, 1, 0]);
    expect(rules('bloomYear').rules.lake!.bloom.above).toBe(2);
    const monsoon = run(null, 'monsoon');
    expect(contentFor(LAKE, monsoon).calendar[2]).toBe('flood');
    expect(contentFor(LAKE, monsoon).byId.chinampa!.yields.food).toEqual(
      LAKE.byId.chinampa!.yields.food!.map((n) => n + 1),
    );
    expect(rules('droughtYear').rules.water.riverFlow).toEqual([5, 2, 4, 4]);
    // Not the Reach's cold or storms.
    expect(LAKE.twists.map((t) => t.id)).not.toContain('longWinter');
  });

  it("the lake's Tempest: Silty Water, and stilt houses cramped and cold too", () => {
    const at = (level: number) =>
      contentFor(
        LAKE,
        createRun(LAKE, {
          seed: 'storm',
          expedition: { twist: null, request: null, tempest: level },
        }),
      );
    const all = at(10);
    expect(all.rules.lake!.waterPerMud).toBe(1);
    expect(all.byId.stiltHouse!.housing).toBe(LAKE.byId.stiltHouse!.housing - 1);
    expect(all.byId.stiltHouse!.demand!.heat.night[3]).toBe(
      LAKE.byId.stiltHouse!.demand!.heat.night[3]! + 1,
    );
    expect(LAKE.tempest.levels.map((l) => l.id)).not.toContain('tempestColdAutumns');
  });
});
