/**
 * The Highland in Root City (HL5, proposals/highland.md, Root City, regions and
 * twists): it opens once 4 districts stand; the Ridge Quarter and its Bothy; the
 * Charcoal Works landmark; the Highland's regions and its own twists.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { blueprintPool } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
import { heatDemand } from '../src/sim/queries';
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
  type CityDistrict,
  type CityState,
  type RunState,
} from '../src/sim';
import { endSeason, place, scenario, uidAt } from './helpers';

const HIGH = biomeContent('highland');
const REACH = biomeContent('willowReach');
const COAST = biomeContent('windsweptCoast');
const RIDGE = (tier = 'seedling') => ({ districts: { ridgeQuarter: tier }, landmarks: [] });

describe('the Ridge Quarter', () => {
  const quarter = REACH.districts.find((d) => d.id === 'ridgeQuarter')!;

  it('is earned by heat-led runs: heat from stoves, collectors and warm neighbours', () => {
    const signature = (localHeat: number) =>
      ({ localHeat, energyShare: {} }) as unknown as Parameters<typeof leanOf>[0];
    expect(quarter.signature.metric).toBe('localHeat');
    expect(leanOf(signature(0.5), quarter)).toBe(1);
    expect(leanOf(signature(0), quarter)).toBe(0);
    // A winter in the glen with a bothy: its stove's heat counts.
    let s = scenario(['~ , , ,', '~ , C ,', '~ , , ,'], {
      content: HIGH,
      season: 'winter',
      heights: ['0 0 0 0', '0 0 0 0', '0 0 0 0'],
      citizens: 8,
      stores: { food: 40, biomass: 10 },
    });
    s = place(s, 'bothy', 3, 0, HIGH);
    s = endSeason(s, HIGH);
    expect(runSignature(HIGH, s).localHeat).toBeGreaterThan(0);
  });

  it('homes need less heat at night: winter (Seedling), autumn too (Sapling), spring too (Heartwood)', () => {
    let s = scenario([', , ,', ', C ,'], { citizens: 6 });
    s = place(s, 'cottage', 0, 0);
    const cottage = s.buildings[uidAt(s, 0, 0)]!;
    const need = (tier: string | null, si: number) => {
      const run: RunState = tier ? { ...s, options: { ...s.options, city: RIDGE(tier) } } : s;
      return heatDemand(contentFor(REACH, run), run, cottage, 'night', si);
    };
    const base = [0, 1, 2, 3].map((si) => need(null, si));
    expect(base[3]).toBeGreaterThan(0);
    const less = (tier: string) => [0, 1, 2, 3].map((si) => base[si]! - need(tier, si));
    const cut = (si: number) => (base[si]! > 0 ? 1 : 0); // never below 0
    expect(less('seedling')).toEqual([0, 0, 0, cut(3)]);
    expect(less('sapling')).toEqual([0, 0, cut(2), cut(3)]);
    expect(less('heartwood')).toEqual([cut(0), 0, cut(2), cut(3)]);
  });

  it('adds the Bothy to the Reach and the coast, and only with it; the Highland has it anyway', () => {
    for (const c of [REACH, COAST]) {
      const without = createRun(c, { seed: 'ridge', guided: false });
      const withIt = createRun(c, { seed: 'ridge', guided: false, city: RIDGE() });
      expect(blueprintPool(c, without)).not.toContain('bothy');
      expect(blueprintPool(c, withIt)).toContain('bothy');
    }
    expect(createRun(HIGH, { seed: 'ridge' }).unlocked).toContain('bothy');
  });
});

describe('the Charcoal Works', () => {
  it('the Ridge Quarter next to the Foundry District: kilns and biochar kilns run once more', () => {
    const works = {
      districts: { ridgeQuarter: 'seedling', foundryDistrict: 'seedling' },
      landmarks: ['charcoalWorks'],
    };
    const reach = contentFor(REACH, createRun(REACH, { seed: 'works', city: works }));
    expect(reach.byId.kiln!.recipes!.maxRuns).toBe(REACH.byId.kiln!.recipes!.maxRuns + 1);
    const high = contentFor(HIGH, createRun(HIGH, { seed: 'works', city: works }));
    expect(high.byId.biocharKiln!.digester!.maxRuns).toBe(
      HIGH.byId.biocharKiln!.digester!.maxRuns + 1,
    );
  });
});

describe("the Highland's regions and twists", () => {
  const run = (region: string | null, twist: string | null = null, seed = 'region') =>
    createRun(HIGH, { seed, water: true, expedition: { twist, request: null, region } });
  const tiles = (s: RunState) => Object.values(s.map.tiles);
  const count = (s: RunState, type: string) => tiles(s).filter((t) => t.type === type).length;

  it('every region and twist makes a glen with a camp, on 20 seeds', () => {
    for (const region of HIGH.regions.map((r) => r.id))
      for (let i = 0; i < 20; i++) expect(() => run(region, null, `glen-${i}`)).not.toThrow();
    for (const twist of HIGH.twists.map((t) => t.id))
      for (let i = 0; i < 5; i++) expect(() => run(null, twist, `glen-${i}`)).not.toThrow();
  });

  it('Corrie Lochs: 2 tarns at height 2, which the snowmelt fills', () => {
    for (const seed of ['a', 'b', 'c']) {
      const s = run('corrieLochs', null, seed);
      const tarns = tiles(s).filter((t) => t.type === 'reservoir');
      expect(tarns).toHaveLength(4);
      for (const t of tarns) expect(t.height).toBe(2);
      expect(count(run('theGlen', null, seed), 'reservoir')).toBe(0);
      // The spring's snowmelt fills them.
      const after = endSeason({ ...s, stores: { ...s.stores, food: 40 } }, HIGH);
      const water = tiles(after)
        .filter((t) => t.type === 'reservoir')
        .reduce((n, t) => n + (t.water ?? 0), 0);
      expect(water).toBeGreaterThan(0);
    }
  });

  it('High Plateau: more land high up, and the Graft a tier higher', () => {
    const high = (s: RunState) => tiles(s).filter((t) => (t.height ?? 0) >= 2).length;
    for (const seed of ['a', 'b'])
      expect(high(run('highPlateau', null, seed))).toBeGreaterThan(
        high(run('theGlen', null, seed)),
      );
    expect(HIGH.regions.find((r) => r.id === 'highPlateau')!.graftTierBonus).toBe(1);
  });

  it('Old Pinewood: more woods; Old Mines: more workings, fuller', () => {
    for (const seed of ['a', 'b']) {
      const glen = run('theGlen', null, seed);
      expect(count(run('oldPinewood', null, seed), 'woodland')).toBeGreaterThan(
        count(glen, 'woodland'),
      );
      const mines = run('oldMines', null, seed);
      expect(count(mines, 'ruin')).toBe(7);
      for (const t of tiles(mines).filter((x) => x.type === 'ruin')) expect(t.salvage).toBe(36);
    }
  });

  it('Deep Winter: high panels are snowed under in autumn too; the Graft a tier higher', () => {
    const rules = contentFor(HIGH, run(null, 'deepWinter'));
    expect(rules.byId.solarCanopy!.idleAtHeight!.seasons).toEqual(['autumn', 'winter']);
    expect(HIGH.twists.find((t) => t.id === 'deepWinter')!.graftTierBonus).toBe(1);
  });

  it('Föhn Wind: homes need 1 less heat on winter nights, and the snowmelt floods further', () => {
    for (const seed of ['a', 'b', 'c']) {
      const plain = run(null, null, seed);
      const fohn = run(null, 'fohnWind', seed);
      expect(fohn.map.floodOrder.length).toBeGreaterThan(plain.map.floodOrder.length);
      for (const key of plain.map.floodOrder) expect(fohn.map.floodOrder).toContain(key);
      expect(fohn.map.floodOrder).not.toContain(
        `${fohn.buildings.b0!.at.q},${fohn.buildings.b0!.at.r}`,
      );
    }
    expect(contentFor(HIGH, run(null, 'fohnWind')).rules.localHeat.homeRelief).toEqual([
      0, 0, 0, 1,
    ]);
  });

  it('Late Thaw: spring stays in deep snow, and the snowmelt comes in summer', () => {
    const s = run(null, 'lateThaw');
    expect(s.forecast).toEqual({ event: 'freeze', next: 'flood' });
    expect(contentFor(HIGH, s).calendar).toEqual(['freeze', 'flood', 'storm', 'freeze']);
  });

  it('keeps the shared twists that fit the glen, and not the ones that don’t', () => {
    const ids = HIGH.twists.map((t) => t.id);
    for (const id of ['leanStart', 'bigFamilies', 'scavengers', 'steadyWinds', 'wildStorms'])
      expect(ids).toContain(id);
    for (const id of ['droughtYear', 'longWinter', 'clearSkies']) expect(ids).not.toContain(id);
  });
});

describe('Root City sends expeditions to the Highland once 4 districts stand', () => {
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
    ...createCity(HOME, 'highland'),
    runs,
    districts: districts(n),
  });

  it('opens with the fourth district, whatever the run; at once for a city that has them', () => {
    expect(openBiomes(HOME, cityWith(6, 3))).toEqual(['willowReach', 'windsweptCoast']);
    expect(openBiomes(HOME, cityWith(6, 4))).toEqual(['willowReach', 'windsweptCoast', 'highland']);
    expect(openBiomes(HOME, cityWith(2, 4))).toEqual(['willowReach', 'highland']);
  });

  it('the offers take turns between the three biomes, each with its own twists and regions', () => {
    const seen = new Set<string>();
    for (const runs of [6, 7, 8]) {
      for (const o of expeditionOffer(HOME, cityWith(runs, 5))) {
        const biome = o.biome ?? 'willowReach';
        seen.add(biome);
        const c = biomeOf(HOME, o.biome);
        expect(c.twists.map((t) => t.id)).toContain(o.twist);
        if (o.region) expect(c.regions.map((r) => r.id)).toContain(o.region);
      }
    }
    expect([...seen].sort()).toEqual(['highland', 'willowReach', 'windsweptCoast']);
  });

  it('a Highland expedition plays in the glen, guided the first time', () => {
    let city = cityWith(6, 4);
    let index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'highland');
    if (index < 0) {
      city = { ...city, runs: city.runs + 1 };
      index = expeditionOffer(HOME, city).findIndex((o) => o.biome === 'highland');
    }
    const chosen = applyCityCommand(HOME, city, { type: 'chooseExpedition', index });
    expect(chosen.ok).toBe(true);
    if (!chosen.ok) return;
    expect(nextRunBiome(HOME, chosen.city)).toBe('highland');
    const options = nextRunOptions(HOME, chosen.city);
    expect(options.guided).toBe(true);
    const s = createRun(biomeOf(HOME, nextRunBiome(HOME, chosen.city)), options);
    expect(s.contentId).toBe('highland');
  });
});
