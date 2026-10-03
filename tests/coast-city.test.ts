/**
 * The coast in Root City (B5, proposals/windswept-coast.md, Root City,
 * regions and twists): the Tidal Quarter and its Tide Mill, the Estuary Works
 * landmark and its Estuary Turbine, the coast's regions and its own twists.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { blueprintPool, draftSize } from '../src/sim/draft';
import { contentFor } from '../src/sim/content/modifiers';
import { createRun, hexKey, leanOf, type RunState } from '../src/sim';
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
