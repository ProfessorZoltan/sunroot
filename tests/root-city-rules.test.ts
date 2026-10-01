/**
 * Milestone 8 in a run: what Root City's districts and landmarks, and the
 * expedition's twist and request, change in the simulation.
 */
import { describe, expect, it } from 'vitest';
import {
  createRun,
  effectiveContent,
  harmonyLines,
  readSave,
  makeSave,
  scoreRun,
  seedsForRun,
  type RunCity,
  type RunState,
} from '../src/sim';
import { blueprintPool, dealCharters, drawCards, tuningPool } from '../src/sim/draft';
import { content, endSeason, place, scenario, uidAt } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];
const city = (districts: Record<string, string>, landmarks: string[] = []): RunCity => ({
  districts,
  landmarks,
});

describe('district perks', () => {
  it('Millrace Quarter: river wheels cost 5, 4 or 3 by tier', () => {
    for (const [tier, cost] of [
      ['seedling', 5],
      ['sapling', 4],
      ['heartwood', 3],
    ] as const) {
      let s = scenario(LAND, { run: { city: city({ millraceQuarter: tier }) } });
      const before = s.stores.materials;
      s = place(s, 'riverWheel', 5, 2);
      expect(before - s.stores.materials).toBe(cost);
    }
  });

  it('Orchard Ward: the run starts with +6, +10 or +15 food', () => {
    const base = createRun(content, { seed: 'perk' }).stores.food;
    const food = (tier: string) =>
      createRun(content, { seed: 'perk', city: city({ orchardWard: tier }) }).stores.food;
    expect([food('seedling'), food('sapling'), food('heartwood')]).toEqual([
      base + 6,
      base + 10,
      base + 15,
    ]);
  });

  it('Mended Commons: +4 Harmony all run, shown as a Root City line', () => {
    const plain = scenario(LAND);
    const s = scenario(LAND, { run: { city: city({ mendedCommons: 'seedling' }) } });
    const rules = effectiveContent(content, s);
    expect(harmonyLines(rules, s)).toContainEqual({ label: 'Root City', amount: 4 });
    expect(endSeason(s).harmony).toBe(endSeason(plain).harmony + 4);
  });

  it('Foundry District: workshops get a 3rd run in year 1 only', () => {
    const runs = (year: number) => {
      let s = scenario(LAND, {
        year,
        season: 'summer',
        stores: { salvage: 20 },
        run: { city: city({ foundryDistrict: 'seedling' }) },
      });
      s = place(s, 'workshop', 6, 2);
      for (const c of [5, 6, 7]) s = place(s, 'solarCanopy', c, 3);
      return endSeason(s).lastReport!.runs[uidAt(s, 6, 2)]!.runs;
    };
    expect(runs(1)).toBe(3);
    expect(runs(2)).toBe(2);
  });
});

describe('cards Root City adds to drafts', () => {
  it('come only with their district: the Cider Press, Spillway, Kiln Loop and Rewilders', () => {
    const plain = createRun(content, { seed: 'cards' });
    expect(blueprintPool(content, plain)).not.toContain('ciderPress');
    expect(tuningPool(content, plain)).not.toContain('spillway');
    expect(tuningPool(content, plain)).not.toContain('kilnLoop');
    expect(dealCharters(content, { ...plain, rng: { ...plain.rng } })).not.toContain('rewilders');
    const all = createRun(content, {
      seed: 'cards',
      city: city({
        orchardWard: 'seedling',
        millraceQuarter: 'seedling',
        foundryDistrict: 'seedling',
        mendedCommons: 'seedling',
      }),
    });
    expect(blueprintPool(content, all)).toContain('ciderPress');
    expect(tuningPool(content, all)).toEqual(expect.arrayContaining(['spillway', 'kilnLoop']));
    const charters = new Set<string>();
    for (let i = 0; i < 40; i++) {
      for (const id of dealCharters(content, createRun(content, { ...all.options, seed: `c${i}` })))
        charters.add(id);
    }
    expect(charters).toContain('rewilders');
  });

  it('Cider Press: each neighbouring orchard that bore food turns 1 spare food into +1 wellbeing', () => {
    let s = scenario(LAND, { season: 'autumn', stores: { food: 20 }, citizens: 4 });
    s = place(s, 'orchard', 6, 2);
    s = place(s, 'orchard', 7, 2);
    s.buildings[uidAt(s, 6, 2)]!.builtTurn = -8; // mature
    s.buildings[uidAt(s, 7, 2)]!.builtTurn = -8;
    const without = endSeason(s);
    s = place(s, 'ciderPress', 6, 3);
    const after = endSeason(s);
    const line = after.lastReport!.wellbeing.lines.find((l) => l.reason.startsWith('Cider Press'));
    expect(line?.amount).toBe(2);
    expect(after.wellbeing).toBe(without.wellbeing + 2);
    expect(after.stores.food).toBe(without.stores.food - 2);
  });

  it('Spillway: a weir no longer costs fish ponds downstream any food', () => {
    const fish = (tunings: string[]) => {
      let s = scenario(LAND, { season: 'summer', citizens: 8 });
      s.tunings = tunings;
      s = place(s, 'weir', 4, 1);
      s = place(s, 'fishPond', 5, 3);
      return endSeason(s).lastReport!.yields[uidAt(s, 5, 3)]?.food ?? 0;
    };
    expect(fish(['spillway'])).toBe(fish([]) + 1);
  });

  it('Kiln Loop: a firing needs 1 energy; Rewilders: nurseries 2 steps, meadows +1 Harmony', () => {
    const rules = effectiveContent(content, { tunings: ['kilnLoop'], charters: ['rewilders'] });
    expect(rules.byId.kiln!.recipes!.energyPerRun).toBe(1);
    expect(rules.byId.treeNursery!.improvesNeighborSteps).toBe(2);
    expect(rules.byId.pollinatorMeadow!.harmony).toBe(2);
  });
});

describe('teaching across runs', () => {
  it('a run without tunings or charters never deals them', () => {
    const s = createRun(content, { seed: 'teach', tunings: false, charters: false });
    for (let i = 0; i < 20; i++) {
      expect(drawCards(content, s, 3).some((id) => content.tuningById[id])).toBe(false);
    }
    expect(dealCharters(content, s)).toEqual([]);
  });
});

describe('landmarks', () => {
  it('Cider Mill: orchards produce one season sooner', () => {
    const food = (landmarks: string[]) => {
      let s = scenario(LAND, { season: 'spring', run: { city: city({}, landmarks) } });
      s = place(s, 'orchard', 6, 2);
      s = endSeason(s);
      return endSeason(s).lastReport!.yields[uidAt(s, 6, 2)]?.food ?? 0;
    };
    expect(food([])).toBe(0);
    expect(food(['ciderMill'])).toBeGreaterThan(0);
  });

  it('Heartwood Grove: the Wildway may cross one tile of other land', () => {
    const map = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', 'm . m m ~ , C , , ^'];
    const labels = (s: RunState) =>
      harmonyLines(effectiveContent(content, s), s).map((l) => l.label);
    expect(labels(scenario(map))).not.toContain('Wildway');
    const grove = scenario(map, { run: { city: city({}, ['heartwoodGrove']) } });
    expect(labels(grove)).toContain('Wildway');
    // Two gaps are still too many.
    const twoGaps = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', 'm . . m ~ , C , , ^'];
    expect(
      labels(scenario(twoGaps, { run: { city: city({}, ['heartwoodGrove']) } })),
    ).not.toContain('Wildway');
  });
});

describe('expeditions', () => {
  it('a Drought Year: farms 2 tiles from water lose half their summer food', () => {
    const map = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , m , , ^'];
    const food = (twist: string | null) => {
      let s = scenario(map, {
        season: 'summer',
        run: { expedition: { twist, request: null } },
      });
      s = place(s, 'floodplainFarm', 6, 2);
      return endSeason(s).lastReport!.yields[uidAt(s, 6, 2)]?.food ?? 0;
    };
    expect(food('droughtYear')).toBeLessThan(food(null));
  });

  it('a hard twist lifts the Graft a tier, but never past Heartwood', () => {
    const ended = (twist: string | null) => ({
      ...scenario(LAND, { run: { expedition: { twist, request: null } } }),
      status: 'collapsed' as const,
    });
    const plain = scoreRun(content, ended(null));
    const lifted = scoreRun(content, ended('droughtYear'));
    expect(plain.tier.id).toBe('seedling');
    expect(lifted.tier.id).toBe('sapling');
    expect(lifted.total).toBe(plain.total);
    expect(lifted.lift).toEqual({ tiers: 1, by: 'Drought Year' });
    expect(lifted.next?.tier.id).toBe('heartwood');
    expect(scoreRun(content, ended('fairWeather')).lift).toBeNull();
  });

  it('a city request met is remembered and earns 5 more Seeds', () => {
    let s = scenario(LAND, {
      season: 'winter',
      year: 12,
      stores: { food: 200 },
      run: { expedition: { twist: null, request: 'harmonyFifty' } },
    });
    const missed = endSeason(s);
    expect(missed.requestMet).toBeNull();
    s = { ...s, map: { ...s.map, tiles: structuredClone(s.map.tiles) } };
    for (const t of Object.values(s.map.tiles))
      if (t.type === 'scrub' || t.type === 'hill') t.type = 'woodland';
    s.seasonStart = { ...s.seasonStart!, map: s.map };
    const met = endSeason(s);
    expect(met.lastReport!.requestMet).toBe(true);
    expect(met.requestMet).toBe(s.turn);
    const extra = seedsForRun(content, met).lines.find((l) => l.reason.startsWith('city request'));
    expect(extra?.points).toBe(5);
    expect(seedsForRun(content, missed).lines.some((l) => l.reason.startsWith('city'))).toBe(false);
  });

  it('a save from before Root City loads with no city, expedition or request', () => {
    const s = createRun(content, { seed: 'old' });
    const old = JSON.parse(JSON.stringify(makeSave(s, '2026-10-01T00:00:00Z')));
    delete old.state.requestMet;
    for (const k of ['tunings', 'charters', 'city', 'expedition']) delete old.state.options[k];
    const read = readSave(content, old);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.state.requestMet).toBeNull();
    expect(read.save.state.options).toEqual(s.options);
  });
});
