/** Milestone 8: Root City between runs (src/sim/city.ts). */
import { describe, expect, it } from 'vitest';
import {
  applyCityCommand,
  applyCommand,
  bestTiers,
  canPlace,
  createCity,
  createRun,
  effectiveContent,
  expeditionOffer,
  graftOffer,
  hexDistance,
  makeCitySave,
  neighborSlots,
  nextRunOptions,
  readCity,
  runCity,
  slotHexes,
  standingLandmarks,
  teaching,
  type CityCommand,
  type CityState,
  type Graft,
  type RunOptions,
  type RunState,
} from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { Turn } from '../src/balance/turn';
import { createRng } from '../src/sim/rng';
import { GameStore } from '../src/game/store';
import { loadCity, saveCity, startOver } from '../src/game/city';
import { memorySlot } from '../src/game/saves';
import { content } from './helpers';

const graft = (district: string, tier = 'seedling'): Graft => ({
  district,
  tier,
  score: 100,
  seeds: 20,
  seed: 'test',
  vision: null,
  visionAchieved: false,
  sentAt: '2026-10-01T00:00:00Z',
});

function cmd(city: CityState, command: CityCommand) {
  const r = applyCityCommand(content, city, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r;
}
const run = (city: CityState, command: CityCommand) => cmd(city, command).city;
const refuses = (city: CityState, command: CityCommand) => {
  const r = applyCityCommand(content, city, command);
  expect(r.ok).toBe(false);
  return r.ok ? '' : r.error;
};
/** A city with these districts placed in slots 0, 1, 2, ... */
function cityWith(districts: [string, string?][], seeds = 0): CityState {
  let c = createCity(content, 'city');
  for (const [d, tier] of districts) {
    c = run(c, { type: 'sendHome', result: { graft: graft(d, tier), earned: 35, spent: 35 } });
    c = run(c, { type: 'place', slot: c.districts.length });
  }
  return { ...c, seeds };
}

describe('the city layout', () => {
  it('rings the Heartwood with 6 slots, then 12', () => {
    const hexes = slotHexes(18);
    const centre = { q: 0, r: 0 };
    expect(hexes.slice(0, 6).every((h) => hexDistance(h, centre) === 1)).toBe(true);
    expect(hexes.slice(6).every((h) => hexDistance(h, centre) === 2)).toBe(true);
    expect(new Set(hexes.map((h) => `${h.q},${h.r}`)).size).toBe(18);
  });

  it('a first-ring slot touches 2 first-ring and 3 second-ring slots', () => {
    const n = neighborSlots(content, 0);
    expect(n.filter((s) => s < 6)).toHaveLength(2);
    expect(n.filter((s) => s >= 6)).toHaveLength(3);
    for (const s of n) expect(neighborSlots(content, s)).toContain(0);
  });
});

describe('between runs', () => {
  it('a planted Graft waits to be placed in a free slot', () => {
    let c = createCity(content, 'city');
    c = run(c, {
      type: 'sendHome',
      result: { graft: graft('orchardWard'), earned: 40, spent: 35 },
    });
    expect(c).toMatchObject({ runs: 1, seeds: 5, districts: [] });
    expect(c.pending.map((g) => g.district)).toEqual(['orchardWard']);
    expect(refuses(c, { type: 'chooseExpedition', index: 0 })).toBe('place the Graft first');
    c = run(c, { type: 'place', slot: 3 });
    expect(c.districts).toEqual([
      { slot: 3, district: 'orchardWard', tier: 'seedling', invested: 0, run: 1 },
    ]);
    expect(c.pending).toEqual([]);
  });

  it('banking keeps the Seeds and plants nothing', () => {
    const c = run(createCity(content, 'city'), {
      type: 'sendHome',
      result: { graft: null, earned: 22, spent: 0 },
    });
    expect(c).toMatchObject({ runs: 1, seeds: 22, pending: [], grafts: [] });
    expect(refuses(c, { type: 'sendHome', result: { graft: null, earned: 0, spent: 99 } })).toMatch(
      /not enough Seeds/,
    );
  });

  it('Seeds raise a tier: 15 to Sapling, 30 to Heartwood', () => {
    let c = cityWith([['millraceQuarter']], 50);
    c = run(c, { type: 'upgrade', slot: 0 });
    expect(c.districts[0]).toMatchObject({ tier: 'sapling', invested: 15 });
    expect(c.seeds).toBe(35);
    c = run(c, { type: 'upgrade', slot: 0 });
    expect(c.districts[0]).toMatchObject({ tier: 'heartwood', invested: 45 });
    expect(refuses(c, { type: 'upgrade', slot: 0 })).toMatch(/highest tier/);
    expect(
      refuses({ ...cityWith([['millraceQuarter']]), seeds: 14 }, { type: 'upgrade', slot: 0 }),
    ).toBe('raising it costs 15 Seeds');
  });

  it('a full city: a new Graft replaces a district, which composts into half its upgrades', () => {
    const all = Array.from({ length: 18 }, () => ['foundryDistrict'] as [string]);
    let c = cityWith(all, 30);
    c = run(c, { type: 'upgrade', slot: 4 }); // 15 invested
    c = run(c, {
      type: 'sendHome',
      result: { graft: graft('orchardWard'), earned: 35, spent: 35 },
    });
    const r = cmd(c, { type: 'place', slot: 4 });
    expect(r.events).toContainEqual({ kind: 'composted', district: 'foundryDistrict', seeds: 7 });
    expect(r.city.seeds).toBe(15 + 7);
    expect(r.city.districts.find((d) => d.slot === 4)).toMatchObject({ district: 'orchardWard' });
    expect(r.city.districts).toHaveLength(18);
    // Not full: an occupied slot can't be replaced, and a Graft can't be let go.
    let open = cityWith([['foundryDistrict']]);
    open = run(open, {
      type: 'sendHome',
      result: { graft: graft('orchardWard'), earned: 35, spent: 35 },
    });
    expect(refuses(open, { type: 'place', slot: 0 })).toMatch(/free slot/);
    expect(refuses(open, { type: 'release' })).toMatch(/free slots/);
  });

  it('the best district of each kind gives its perk; perks do not stack', () => {
    const c = cityWith([
      ['orchardWard', 'sapling'],
      ['orchardWard', 'seedling'],
      ['foundryDistrict'],
    ]);
    expect(bestTiers(content, c)).toEqual({ orchardWard: 'sapling', foundryDistrict: 'seedling' });
    const s = createRun(content, { seed: 'perk', city: runCity(content, c) });
    expect(s.stores.food).toBe(content.rules.start.food + 10);
  });
});

describe('landmarks', () => {
  it('Cider Mill: discovered when a Millrace Quarter is placed next to an Orchard Ward', () => {
    let c = cityWith([['orchardWard']]);
    c = run(c, {
      type: 'sendHome',
      result: { graft: graft('millraceQuarter'), earned: 35, spent: 35 },
    });
    const far = neighborSlots(content, 0).includes(3) ? 9 : 3;
    const apart = cmd(c, { type: 'place', slot: far });
    expect(apart.events).toEqual([]);
    const r = cmd(c, { type: 'place', slot: neighborSlots(content, 0)[0]! });
    expect(r.events).toContainEqual({ kind: 'landmark', id: 'ciderMill' });
    expect(r.city.landmarks).toEqual(['ciderMill']);
    expect(runCity(content, r.city).landmarks).toEqual(['ciderMill']);
  });

  it('Heartwood Grove: Mended Commons next to 3 green districts', () => {
    const ring = neighborSlots(content, 0);
    let c = createCity(content, 'city');
    const put = (district: string, slot: number) => {
      c = run(c, { type: 'sendHome', result: { graft: graft(district), earned: 35, spent: 35 } });
      return cmd(c, { type: 'place', slot });
    };
    c = put('mendedCommons', 0).city;
    c = put('orchardWard', ring[0]!).city;
    c = put('orchardWard', ring[1]!).city;
    expect(standingLandmarks(content, c)).toEqual([]);
    const third = put('mendedCommons', ring[2]!);
    expect(third.events).toContainEqual({ kind: 'landmark', id: 'heartwoodGrove' });
  });

  it('a landmark broken by a replacement stays discovered but stops working', () => {
    const c: CityState = {
      ...cityWith([['orchardWard'], ['millraceQuarter']]),
      landmarks: ['ciderMill'],
    };
    expect(neighborSlots(content, 0)).toContain(1);
    expect(runCity(content, c).landmarks).toEqual(['ciderMill']);
    const broken = { ...c, districts: c.districts.filter((d) => d.slot !== 1) };
    expect(runCity(content, broken).landmarks).toEqual([]);
    expect(broken.landmarks).toEqual(['ciderMill']);
  });
});

describe('the Sun Tree', () => {
  it('grows when all 18 slots are filled and 6 districts are Heartwood', () => {
    const tiers = Array.from(
      { length: 18 },
      (_, i) => ['foundryDistrict', i < 5 ? 'heartwood' : 'sapling'] as [string, string],
    );
    let c = cityWith(tiers, 60);
    expect(c.sunTree).toBeNull();
    const r = cmd(c, { type: 'upgrade', slot: 10 });
    expect(r.events).toContainEqual({ kind: 'sunTree' });
    expect(r.city.sunTree).toBe(18);
    c = run(r.city, { type: 'upgrade', slot: 11 });
    expect(c.sunTree).toBe(18); // grown once
  });
});

describe('teaching across runs', () => {
  it('run 1 is guided with blueprints only; tunings join in run 2, charters 3, visions 4', () => {
    expect(teaching(content, 1)).toMatchObject({
      guided: true,
      tunings: false,
      charters: false,
      visions: false,
      water: false,
      joining: [],
      next: { system: 'water', run: 2 },
    });
    // Water joins at run 2, with a guided first year of its own (DECISIONS.md, Teaching by layers).
    expect(teaching(content, 2)).toMatchObject({
      guided: true,
      tunings: true,
      water: true,
      joining: ['water', 'tunings'],
    });
    // Walks to work join at run 3 too (DECISIONS.md, Teaching by layers).
    expect(teaching(content, 3)).toMatchObject({
      guided: false,
      charters: true,
      commute: true,
      joining: ['charters', 'commute'],
    });
    // The heat layer joins at run 4 with visions (DECISIONS.md, Heat needs a building).
    expect(teaching(content, 4)).toMatchObject({
      visions: true,
      localHeat: true,
      joining: ['visions', 'localHeat'],
      next: null,
    });
  });

  it("the next run's options: its teaching, the city's gifts and the expedition", () => {
    let c = cityWith([['orchardWard']]);
    const [a] = expeditionOffer(content, c);
    c = run(c, { type: 'chooseExpedition', index: 0 });
    expect(nextRunOptions(content, c)).toEqual({
      seed: a!.seed,
      guided: true,
      visions: false,
      tunings: true,
      charters: false,
      city: { districts: { orchardWard: 'seedling' }, landmarks: [] },
      expedition: { twist: a!.twist, request: a!.request, region: a!.region },
      water: true,
    });
    expect(run(c, { type: 'embark' }).expedition).toBeNull();
  });
});

describe('the full valley', () => {
  it('every layer from the next run when asked for, and always at a Tempest level', () => {
    const first = createCity(content, 'layers');
    expect(nextRunOptions(content, first).water).toBeUndefined();
    const full = run(first, { type: 'setFullValley', on: true });
    expect(full.fullValley).toBe(true);
    expect(nextRunOptions(content, full).water).toBe(true);
    expect(run(full, { type: 'setFullValley', on: false }).fullValley).toBeUndefined();
    const stormy: CityState = { ...first, tempestUnlocked: 1, tempest: 1 };
    expect(nextRunOptions(content, stormy).water).toBe(true);
  });

  it("a run with water plays the water system, though it's off in the data", () => {
    expect(content.rules.water.enabled).toBe(false);
    const s = createRun(content, { seed: 'wet', water: true });
    expect(effectiveContent(content, s).rules.water.enabled).toBe(true);
    expect(s.unlocked).toContain('irrigationChannel');
    expect(Object.values(s.buildings).filter((b) => b.type === 'irrigationChannel')).toHaveLength(
      3,
    );
    expect(canPlace(content, s, 'cistern', { q: -99, r: -99 }).ok ? '' : 'refused').toBe('refused');
    const picked = applyCommand(content, s, { type: 'pickCard', card: s.draft.offer[0]! });
    if (!picked.ok) throw new Error(picked.error);
    const r = applyCommand(content, picked.state, { type: 'endSeason' });
    expect(r.ok && r.state.lastReport!.water).toBeTruthy();
  });
});

describe('expeditions', () => {
  it('3 options with different twists and requests, the same for the same city', () => {
    const c = cityWith([['orchardWard']]);
    const offer = expeditionOffer(content, c);
    expect(offer).toHaveLength(3);
    expect(new Set(offer.map((o) => o.twist)).size).toBe(3);
    expect(new Set(offer.map((o) => o.request)).size).toBe(3);
    expect(new Set(offer.map((o) => o.seed)).size).toBe(3);
    expect(expeditionOffer(content, c)).toEqual(offer);
    expect(expeditionOffer(content, { ...c, runs: c.runs + 1 })).not.toEqual(offer);
  });

  it('the first run needs no expedition; later ones choose one first', () => {
    const first = createCity(content, 'city');
    expect(run(first, { type: 'embark' }).runs).toBe(0);
    const later = run(first, { type: 'sendHome', result: { graft: null, earned: 12, spent: 0 } });
    expect(refuses(later, { type: 'embark' })).toBe('choose an expedition first');
  });
});

describe('city saves', () => {
  it('round-trip, and the city kept before Milestone 8 moves over with its Grafts waiting', async () => {
    const c = cityWith([['orchardWard', 'sapling']], 12);
    expect(readCity(content, JSON.parse(JSON.stringify(makeCitySave(c, 'now'))), 'x')).toEqual({
      ok: true,
      city: c,
    });
    expect(readCity(content, { ...makeCitySave(c, 'now'), contentId: 'elsewhere' }, 'x')).toEqual({
      ok: false,
      error: 'the city is for elsewhere',
    });
    const old = { version: 1, grafts: [graft('mendedCommons')], seeds: 9, runs: 3 };
    const storage = new Map<string, string>([['sunroot:city', JSON.stringify(old)]]);
    const local = {
      getItem: (k: string) => storage.get(k) ?? null,
      removeItem: (k: string) => storage.delete(k),
    } as unknown as Storage;
    const slot = memorySlot();
    const loaded = await loadCity(content, slot, local, 'new-seed');
    expect(loaded.city).toMatchObject({ seeds: 9, runs: 3, seed: 'new-seed' });
    expect(loaded.city.pending.map((g) => g.district)).toEqual(['mendedCommons']);
    expect(storage.has('sunroot:city')).toBe(false);
    expect((await loadCity(content, slot, null, 'other')).city).toEqual(loaded.city);
  });

  it('start over forgets the city and the run in progress, and the Almanac only if asked', async () => {
    const almanacKey = `sunroot:almanac:${content.id}`;
    const storage = new Map<string, string>([
      [almanacKey, JSON.stringify({ version: 1, discovered: ['sunTrap'], hints: [] })],
      ['sunroot:playlog', '[]'],
      ['sunroot:audio', '{}'],
    ]);
    const local = {
      getItem: (k: string) => storage.get(k) ?? null,
      removeItem: (k: string) => storage.delete(k),
    } as unknown as Storage;
    const city = memorySlot();
    const run = memorySlot({ some: 'run' });
    await saveCity(city, cityWith([['orchardWard', 'sapling']], 12), 'now');

    await startOver(content, { run, city }, local, { almanac: false });
    expect(await run.load()).toBeUndefined();
    expect(await city.load()).toBeUndefined();
    expect(storage.has(almanacKey)).toBe(true);
    // The next visit begins a new city: no runs sent home.
    expect((await loadCity(content, city, local, 'fresh')).city).toEqual(
      createCity(content, 'fresh'),
    );

    await startOver(content, { run, city }, local, { almanac: true });
    expect(storage.has(almanacKey)).toBe(false);
    expect([...storage.keys()]).toEqual(['sunroot:playlog', 'sunroot:audio']);
  });
});

/** Plays a whole run with the balanced bot, as the balance simulator does. */
function playOut(state: RunState): RunState {
  const rng = createRng(`${state.options.seed}:bot`);
  let s = state;
  const ok = (r: ReturnType<typeof applyCommand>) => {
    if (!r.ok) throw new Error(r.error);
    return r.state;
  };
  while (s.status === 'active') {
    const turn = new Turn(content, s, rng, 'forecast');
    BOTS.balanced!.playSeason(turn);
    s = turn.state;
    if (s.draft.offer.length > 0 && !s.draft.picked)
      s = ok(applyCommand(content, s, { type: 'pickCard', card: s.draft.offer[0]! }));
    if (s.visionOffer.length > 0)
      s = ok(applyCommand(content, s, { type: 'pickVision', vision: s.visionOffer[0]! }));
    if (s.charterOffer.length > 0)
      s = ok(applyCommand(content, s, { type: 'pickCharter', charter: s.charterOffer[0]! }));
    // A branching evolution: the first choice, as the balance runner takes.
    for (const o of s.evolutionOffer)
      s = ok(
        applyCommand(content, s, { type: 'chooseEvolution', uid: o.uid, combo: o.options[0]! }),
      );
    s = ok(applyCommand(content, s, { type: 'endSeason' }));
  }
  return s;
}

describe('5 runs in a row', () => {
  it('keep their progression through the store and the saved city', async () => {
    const slot = memorySlot();
    let city = (await loadCity(content, slot, null, 'five')).city;
    await saveCity(slot, city, 'start');
    const seen: { run: number; options: RunOptions; seeds: number }[] = [];
    for (let n = 1; n <= 5; n++) {
      // A reload between runs: the city comes back from its save.
      city = (await loadCity(content, slot, null, 'unused')).city;
      if (city.runs > 0) {
        city = run(city, { type: 'chooseExpedition', index: n % 3 });
      }
      const options = nextRunOptions(content, city);
      city = run(city, { type: 'embark' });
      const store = new GameStore(content, playOut(createRun(content, options)), {
        bankedSeeds: city.seeds,
        onRunEnd: (result) => {
          city = run(city, { type: 'sendHome', result });
        },
      });
      seen.push({ run: n, options, seeds: city.seeds });
      if (store.canPlant) {
        expect(store.chooseGraft(graftOffer(content, store.state).options[0]!.district.id)).toBe(
          true,
        );
      } else {
        expect(store.bankSeeds()).toBe(true);
      }
      if (city.pending.length > 0) city = run(city, { type: 'place', slot: city.districts.length });
      await saveCity(slot, city, `run ${n}`);
    }
    city = (await loadCity(content, slot, null, 'unused')).city;
    expect(city.runs).toBe(5);
    expect(city.seed).toBe('five');
    // Planting cost Seeds; what is left is everything earned less 35 per Graft.
    expect(city.districts.length).toBe(city.grafts.length);
    expect(city.districts.length).toBeGreaterThan(0);
    // Each run was taught what it should be, and later runs carried the city's gifts.
    expect(seen.map((s) => s.options.guided)).toEqual([true, true, false, false, false]);
    expect(seen.map((s) => s.options.water ?? false)).toEqual([false, true, true, true, true]);
    expect(seen.map((s) => s.options.tunings)).toEqual([false, true, true, true, true]);
    expect(seen.map((s) => s.options.charters)).toEqual([false, false, true, true, true]);
    expect(seen.map((s) => s.options.visions)).toEqual([false, false, false, true, true]);
    expect(seen[0]!.options.expedition).toEqual({ twist: null, request: null });
    expect(seen.slice(1).every((s) => s.options.expedition!.twist !== null)).toBe(true);
    const firstPlanted = city.districts[0]!;
    const after = seen.find((s) => s.run > firstPlanted.run)!;
    expect(after.options.city!.districts[firstPlanted.district]).toBeDefined();
  }, 60_000);
});
