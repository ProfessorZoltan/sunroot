/**
 * Rainforest Gardens in Root City (FG5, proposals/rainforest-gardens.md, Root City, regions and
 * twists): it opens once 10 districts stand; the Canopy Quarter, earned by layered food, and its
 * Forest Garden in the other biomes (layers and all); the Seed Forest landmark; the forest's
 * regions, twists and Tempest.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { blueprintPool } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
import {
  applyCityCommand,
  biomeOf,
  computeHarmony,
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
import { hexKey } from '../src/sim/hex';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

const FOREST = biomeContent('rainforestGardens');
const REACH = biomeContent('willowReach');
const COAST = biomeContent('windsweptCoast');
const HIGH = biomeContent('highland');
const DESERT = biomeContent('sunDesert');
const LAKE = biomeContent('lakeGardens');
const CANOPY = (tier = 'seedling') => ({ districts: { canopyQuarter: tier }, landmarks: [] });

describe('the Canopy Quarter', () => {
  const quarter = REACH.districts.find((d) => d.id === 'canopyQuarter')!;

  it('is earned by layered food: forest gardens and orchard gardens, full at half', () => {
    const lean = (foodShare: Record<string, number>) =>
      leanOf({ foodShare } as unknown as Parameters<typeof leanOf>[0], quarter);
    expect(lean({ forestGarden: 0.3, orchardGarden: 0.2 })).toBe(1);
    expect(lean({ forestGarden: 0.25, milpa: 0.75 })).toBe(0.5);
    expect(lean({ milpa: 1 })).toBe(0);
    expect(quarter.nativeTo).toEqual(['rainforestGardens']);
  });

  it('orchards and forest gardens make 1 more food: winter, then autumn, then spring', () => {
    const food = (c: typeof REACH, id: string, tier: string | null) => {
      const s = createRun(c, { seed: 'canopy', ...(tier ? { city: CANOPY(tier) } : {}) });
      return contentFor(c, s).byId[id]!.yields.food!;
    };
    for (const [c, id] of [
      [REACH, 'orchard'],
      [REACH, 'forestGarden'],
      [FOREST, 'forestGarden'],
      [FOREST, 'orchardGarden'],
    ] as const) {
      const base = food(c, id, null);
      const more = (tier: string) => food(c, id, tier).map((n, i) => n - base[i]!);
      expect(more('seedling')).toEqual([0, 0, 0, 1]);
      expect(more('sapling')).toEqual([0, 0, 1, 1]);
      expect(more('heartwood')).toEqual([1, 0, 1, 1]);
    }
  });

  it('adds the Forest Garden to the other biomes, and only with it; in the forest it is a starter', () => {
    for (const c of [REACH, COAST, HIGH, DESERT, LAKE]) {
      const without = createRun(c, { seed: 'canopy', guided: false, water: true });
      const withIt = createRun(c, { seed: 'canopy', guided: false, water: true, city: CANOPY() });
      expect(blueprintPool(contentFor(c, without), without)).not.toContain('forestGarden');
      expect(blueprintPool(contentFor(c, withIt), withIt)).toContain('forestGarden');
      expect(c.byId.forestGarden!.placement.tiles).toEqual(['meadow', 'woodland']);
    }
    expect(FOREST.byId.forestGarden!.starter).toBe(true);
  });

  it('a Forest Garden elsewhere grows its layers as in the forest, with no fertility or monsoon', () => {
    let s = scenario(['~ m m m', '~ m C m', '~ m m m'], {
      content: REACH,
      run: { city: CANOPY() },
      stores: { food: 200, materials: 200 },
      citizens: 20,
    });
    const reach = REACH;
    s = place(s, 'forestGarden', 3, 0, reach);
    s = place(s, 'forestGarden', 3, 2, reach);
    const uid = uidAt(s, 3, 0);
    const bare = uidAt(s, 3, 2);
    // A layer goes on from the season after the garden is built.
    s = endSeason(s, reach);
    s = act(s, { type: 'addLayer', uid, layer: 'understory' }, reach);
    for (let i = 0; i < 2; i++) s = endSeason(s, reach);
    // The understory, grown after a season, makes its own food and mulches the ground below it.
    expect(s.buildings[uid]!.layers).toEqual([{ id: 'understory', turn: 1 }]);
    const food = (u: string) => s.lastReport!.yields[u]?.food ?? 0;
    expect(food(uid)).toBeGreaterThanOrEqual(food(bare) + 2);
    expect(s.map.tiles[hexKey(at(3, 0))]!.fertility).toBeUndefined();
    expect(s.lastReport!.forest).toBeUndefined();
  });
});

describe('the Seed Forest', () => {
  const grove = {
    districts: { canopyQuarter: 'seedling', mendedCommons: 'seedling' },
    landmarks: ['seedForest'],
  };

  it('stands where the Canopy Quarter meets the Mended Commons', () => {
    const l = REACH.landmarks.find((x) => x.id === 'seedForest')!;
    expect(l.district).toBe('canopyQuarter');
    expect(l.nextTo.districts).toEqual(['mendedCommons']);
  });

  it('woodland is worth 1 more Harmony a tile, in every biome', () => {
    for (const c of [REACH, COAST, HIGH, DESERT, LAKE, FOREST]) {
      const plain = createRun(c, { seed: 'grove' });
      const withIt = createRun(c, { seed: 'grove', city: grove });
      expect(contentFor(c, withIt).rules.harmony.perTile.woodland).toBe(
        (contentFor(c, plain).rules.harmony.perTile.woodland ?? 0) + 1,
      );
    }
  });

  it('in the forest, Harmony still starts where it would: the wild forest is counted as it stood', () => {
    // Against the Mended Commons alone (its own perk lifts Harmony); the landmark adds nothing here.
    const commons = { districts: grove.districts, landmarks: [] };
    const plain = createRun(FOREST, { seed: 'grove', city: commons });
    const withIt = createRun(FOREST, { seed: 'grove', city: grove });
    expect(withIt.map.wild).toBeGreaterThan(plain.map.wild ?? 0);
    expect(withIt.harmony).toBe(plain.harmony);
    expect(computeHarmony(contentFor(FOREST, withIt), withIt)).toBe(withIt.harmony);
  });
});

describe('Root City sends expeditions to the forest once 10 districts stand', () => {
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
    ...createCity(HOME, 'forest'),
    runs,
    districts: districts(n),
  });

  it('opens with the tenth district, whatever the run', () => {
    expect(openBiomes(HOME, cityWith(12, 9))).not.toContain('rainforestGardens');
    expect(openBiomes(HOME, cityWith(12, 10))).toContain('rainforestGardens');
    expect(openBiomes(HOME, cityWith(9, 10))).toContain('rainforestGardens');
  });

  it('is offered at once, until a run has been there; the offers take turns between six biomes', () => {
    const visited = { windsweptCoast: 1, highland: 1, sunDesert: 1, lakeGardens: 1 };
    for (const runs of [12, 13, 14, 15])
      expect(
        expeditionOffer(HOME, { ...cityWith(runs, 10), biomeRuns: visited }).map((o) => o.biome),
      ).toContain('rainforestGardens');
    const seen = new Set<string>();
    for (const runs of [12, 13, 14, 15, 16, 17])
      for (const o of expeditionOffer(HOME, cityWith(runs, 10))) {
        seen.add(o.biome ?? 'willowReach');
        const c = biomeOf(HOME, o.biome);
        expect(c.twists.map((t) => t.id)).toContain(o.twist);
        if (o.region) expect(c.regions.map((r) => r.id)).toContain(o.region);
      }
    expect(seen.size).toBe(6);
    expect(seen).toContain('rainforestGardens');
  });

  it('a forest expedition plays in the forest, guided the first time', () => {
    let city = cityWith(12, 10);
    let index = -1;
    for (let i = 0; i < 6 && index < 0; i++) {
      index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'rainforestGardens');
      if (index < 0) city = { ...city, runs: city.runs + 1 };
    }
    expect(index).toBeGreaterThanOrEqual(0);
    const chosen = applyCityCommand(HOME, city, { type: 'chooseExpedition', index });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(nextRunBiome(HOME, chosen.city)).toBe('rainforestGardens');
    const options = nextRunOptions(HOME, chosen.city);
    expect(options.guided).toBe(true);
    const s = createRun(biomeOf(HOME, 'rainforestGardens'), options);
    expect(s.contentId).toBe('rainforestGardens');
    expect(s.draft.offer).toEqual(FOREST.guidedYear[0]);
  });
});

describe("the forest's regions, twists and Tempest", () => {
  const run = (region: string | null, twist: string | null = null, seed = 'region') =>
    createRun(FOREST, { seed, water: true, expedition: { twist, request: null, region } });
  const count = (s: RunState, type: string) =>
    Object.values(s.map.tiles).filter((t) => t.type === type).length;
  const SEEDS = ['a', 'b', 'c', 'd'];
  const total = (region: string, type: string) =>
    SEEDS.reduce((n, seed) => n + count(run(region, null, seed), type), 0);

  it('every region and twist makes a forest with a camp, on 20 seeds', () => {
    for (const region of FOREST.regions.map((r) => r.id))
      for (let i = 0; i < 20; i++) expect(() => run(region, null, `forest-${i}`)).not.toThrow();
    for (const twist of FOREST.twists.map((t) => t.id))
      for (let i = 0; i < 5; i++) expect(() => run(null, twist, `forest-${i}`)).not.toThrow();
  });

  it('Old Plantation: the estate over a third of the land, 6 ruins of 36, little forest', () => {
    for (const seed of SEEDS) {
      const s = run('oldPlantation', null, seed);
      const ruins = Object.values(s.map.tiles).filter((t) => t.type === 'ruin');
      expect(ruins.length).toBe(6);
      expect(ruins.every((t) => t.salvage === 36)).toBe(true);
      expect(count(s, 'barren') + count(s, 'ruin')).toBe(40);
    }
    expect(total('oldPlantation', 'woodland')).toBeLessThan(total('deepForest', 'woodland') * 0.7);
  });

  it('River Forest: a floodplain two tiles wide; Volcano Slopes: hills over half the land', () => {
    expect(total('riverForest', 'floodplain')).toBeGreaterThan(
      total('deepForest', 'floodplain') * 2,
    );
    // The usual forest keeps its floodplain to the river's banks.
    const s = run('deepForest');
    expect(s.map.floodOrder.length).toBe(count(s, 'floodplain'));
    expect(total('volcanoSlopes', 'hill')).toBeGreaterThan(total('deepForest', 'hill') * 2);
  });

  it('Swidden Mosaic: twice the clearings, and 3 tiles of dark earth from old gardens', () => {
    for (const seed of SEEDS) expect(count(run('swiddenMosaic', null, seed), 'darkEarth')).toBe(3);
    expect(total('deepForest', 'darkEarth')).toBe(0);
    const open = (r: string) => total(r, 'meadow') + total(r, 'scrub') + total(r, 'darkEarth');
    expect(open('swiddenMosaic')).toBeGreaterThan(open('deepForest') * 1.5);
  });

  it("the forest's own twists: Long Rains, El Niño, Leaf Blight", () => {
    const rules = (twist: string) => contentFor(FOREST, run(null, twist));
    const long = rules('longRains');
    expect(long.calendar).toEqual(['firstRains', 'flood', 'flood', 'fire']);
    expect(long.rules.forest!.leaches).toEqual([false, true, true, false]);
    const dry = rules('elNino');
    expect(dry.calendar).toEqual(['firstRains', 'fire', 'storm', 'fire']);
    expect(dry.rules.forest!.leaches).toEqual([false, false, false, false]);
    expect(dry.rules.water.riverFlow).toEqual(FOREST.rules.water.riverFlow.map((n) => n / 2));
    const blight = rules('leafBlight').byId.forestGarden!.layers![1]!;
    expect(blight.id).toBe('understory');
    expect(blight.yields.food).toEqual([0, 0, 0, 0]);
    expect(blight.helps).toEqual(FOREST.byId.forestGarden!.layers![1]!.helps);
    // Not the Reach's cold, drought or storms.
    for (const id of ['longWinter', 'droughtYear', 'wildStorms'])
      expect(FOREST.twists.map((t) => t.id)).not.toContain(id);
  });

  it('El Niño: fire can catch in summer, and the rain washes nothing out', () => {
    let s = scenario(['~ m m m m', '~ m C m ,', '~ m m m W', '~ m m m m'], {
      content: FOREST,
      season: 'summer',
      run: { expedition: { twist: 'elNino', request: null, region: null } },
      stores: { food: 200, materials: 200, scraps: 10, biomass: 10 },
      citizens: 20,
    });
    const dry = FOREST;
    // The hand-drawn map's forecast is the usual calendar's; the twist's moves the fire to summer.
    const calendar = contentFor(FOREST, s).calendar;
    s.forecast = { event: calendar[1]!, next: calendar[2]! };
    s = place(s, 'milpa', 4, 0, dry);
    s = endSeason(s, dry);
    expect(s.lastReport!.event).toBe('fire');
    expect(s.lastReport!.forest!.leached).toEqual([]);
  });

  it('the harder ones lift the Graft a tier: those that cost the bots points', () => {
    const bonus = (id: string) =>
      [...FOREST.regions, ...FOREST.twists].find((x) => x.id === id)!.graftTierBonus;
    expect(['riverForest', 'leanStart'].map(bonus)).toEqual([1, 1]);
    // Old Plantation scores higher (its estate heals into Harmony); the rest cost little.
    expect(
      ['oldPlantation', 'volcanoSlopes', 'swiddenMosaic', 'longRains', 'elNino', 'leafBlight'].map(
        bonus,
      ),
    ).toEqual([0, 0, 0, 0, 0, 0]);
    for (const x of [...FOREST.regions, ...FOREST.twists])
      expect(x.text.includes('The Graft is one tier higher.')).toBe(x.graftTierBonus === 1);
  });

  it("the forest's Tempest: Steaming Summers and Muggy Nights, and raised houses cramped too", () => {
    const at = (level: number) =>
      contentFor(
        FOREST,
        createRun(FOREST, {
          seed: 'storm',
          expedition: { twist: null, request: null, tempest: level },
        }),
      );
    const all = at(10);
    const ids = FOREST.tempest.levels.map((l) => l.id);
    expect(ids).toContain('tempestSteamingSummers');
    expect(ids).toContain('tempestMuggyNights');
    expect(ids).not.toContain('tempestColdAutumns');
    expect(ids).not.toContain('tempestBitterNights');
    expect(all.byId.raisedHouse!.housing).toBe(FOREST.byId.raisedHouse!.housing - 1);
    expect(all.byId.raisedHouse!.demand!.cool.day[2]).toBe(
      FOREST.byId.raisedHouse!.demand!.cool.day[2]! + 1,
    );
  });
});
