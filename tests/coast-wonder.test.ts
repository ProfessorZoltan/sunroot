/**
 * The coast's wonder, animals and festivals (B6, proposals/windswept-coast.md,
 * Wonder, wildlife and festivals): the Tidal Lagoon, as the Great Water Garden
 * is the Reach's; terns, seals, puffins and dolphins; Kite Day, the Harvest of
 * the Sea and Lantern Night.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  computeHarmony,
  eraGoal,
  eraGoalMet,
  eraGoalOr,
  habitatOf,
  scoreRun,
  type RunState,
  type Season,
} from '../src/sim';
import { wonderStage } from '../src/sim/wonder';
import { contentFor } from '../src/sim/content/modifiers';
import { act, endSeason, place, rejects, scenario, uidAt, at } from './helpers';

const COAST = biomeContent('windsweptCoast');
const LAGOON = 'tidalLagoon';
const animal = (id: string) => COAST.wildlife.find((a) => a.id === id)!;

// Saltmarsh (col 3), mudflat (col 4), the sea beyond; a dune at the top for the Kelp Loop.
const SHORE = [
  ', , , " : = = = =',
  ', , , " _ = = = =',
  ', C , " _ = = = =',
  ', , , " _ = = = =',
  ', , , " _ = = = =',
  ', , , " _ = = = =',
  ', , , " _ = = = =',
  ', , , " _ = = = =',
];
const start = (year = 7, season: Season = 'spring', rows = SHORE) =>
  scenario(rows, {
    content: COAST,
    year,
    season,
    citizens: 30,
    stores: { food: 500, biomass: 100, materials: 300 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, COAST), s);
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 400 } }, COAST);

/** A closed Kelp Loop (kelp farm → composter → croft) and 2 oyster reefs, one season on. */
function ready(year = 7, reefs = 2): RunState {
  let s = start(year);
  s = build(s, 'kelpFarm', [[5, 0]]);
  s = build(s, 'composter', [[4, 0]]);
  s = build(s, 'croft', [[3, 0]]);
  s = build(
    s,
    'oysterReef',
    (
      [
        [4, 1],
        [4, 2],
        [4, 3],
      ] as [number, number][]
    ).slice(0, reefs),
  );
  s = end(s);
  expect(s.loops.map((l) => l.combo)).toContain('kelpLoop');
  return s;
}
const startLagoon = (s: RunState) => place(s, LAGOON, 4, 5, COAST);

describe('the Tidal Lagoon', () => {
  it('needs a closed Kelp Loop and 2 oyster reefs, from era 3', () => {
    expect(rejects(start(), { type: 'place', building: LAGOON, at: at(4, 5) }, COAST)).toBe(
      'the Tidal Lagoon needs a closed Kelp Loop and 2 oyster reefs (0 now)',
    );
    expect(rejects(ready(7, 1), { type: 'place', building: LAGOON, at: at(4, 5) }, COAST)).toBe(
      'the Tidal Lagoon needs 2 oyster reefs (1 now)',
    );
    expect(rejects(ready(4), { type: 'place', building: LAGOON, at: at(4, 5) }, COAST)).toBe(
      'the Tidal Lagoon can be started from era 3',
    );
  });

  it('stands on the shore (mudflat, marsh, dune) and the sea, with mudflat and sea among them', () => {
    const s = ready();
    const why = (col: number, row: number) =>
      rejects(s, { type: 'place', building: LAGOON, at: at(col, row) }, COAST);
    expect(why(2, 5)).toBe("the Tidal Lagoon can't be built over scrub");
    expect(why(7, 5)).toBe('the Tidal Lagoon needs mudflat among its 7 tiles');
    expect(startLagoon(s).buildings[uidAt(startLagoon(s), 4, 5)]!.type).toBe(LAGOON);
  });

  it('makes nothing while it is built; finished, 2 energy in each slot, +60 and a Graft tier', () => {
    let s = startLagoon(ready());
    const uid = uidAt(s, 4, 5);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(COAST, s, s.buildings[uid]!));
      s = end(s);
      if (i < 3) expect(s.lastReport!.energy.day.bySource[LAGOON]).toBeUndefined();
    }
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(s.lastReport!.wondersDone).toEqual([LAGOON]);
    s = end(s);
    expect(s.lastReport!.energy.day.bySource[LAGOON]).toBe(2);
    expect(s.lastReport!.energy.night.bySource[LAGOON]).toBe(2);
    const score = scoreRun(COAST, s);
    expect(score.lines).toContainEqual({ reason: 'Tidal Lagoon', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Tidal Lagoon' });
  });

  it('meets the Bloom era goal', () => {
    const bloom = eraGoal(COAST, 4)!;
    // The Lagoon comes with the water system, as the coast's runs have it.
    expect(eraGoalOr(contentFor(COAST, start()), bloom)!.text).toBe('Or finish the Tidal Lagoon.');
    let s = startLagoon(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(contentFor(COAST, s), s, bloom)).toBe(true);
  });
});

describe("the coast's animals", () => {
  /** Brings Harmony down to `target` with clutter (1 Harmony each). */
  function harmonyAt(s: RunState, target: number): RunState {
    s.stores.clutter = 0;
    s.stores.clutter = computeHarmony(COAST, s) - target;
    expect(s.stores.clutter).toBeGreaterThanOrEqual(0);
    s.harmony = computeHarmony(COAST, s);
    return s;
  }
  // Meadows for Harmony, dunes, the mudflat and open sea.
  const WILD = [
    'W W W W m : _ = = = =',
    'W W W W m : _ = = = =',
    'W W W W m : ^ = = = =',
    'W W W W m : _ = = = =',
    'W W W W m : _ = = = =',
    'W W W W m : _ = = = =',
    'W W W W m : _ = = = =',
    'W W W W C : _ = = = =',
  ];
  const wild = (season: Season = 'summer') =>
    scenario(WILD, {
      content: COAST,
      season,
      citizens: 4,
      stores: { food: 400 },
      run: { water: true },
    });

  it('arrive at Harmony 20, 40, 50 and 70 where their habitat is', () => {
    let s = place(wild(), 'oysterReef', 6, 1, COAST);
    s = place(s, 'lighthouse', 6, 2, COAST);
    for (const [id, h] of [
      ['terns', 20],
      ['seals', 40],
      ['puffins', 50],
      ['dolphins', 70],
    ] as const) {
      expect(animal(id).harmony).toBe(h);
      expect(habitatOf(s, animal(id)).tiles.length, id).toBeGreaterThan(0);
    }
    s = harmonyAt(s, 70);
    s.wildlife = [];
    s = end(s);
    expect(s.wildlife).toEqual(expect.arrayContaining(['terns', 'seals', 'puffins', 'dolphins']));
    expect(s.notices).toContain('Dolphins have come to the coast');
  });

  it('terns: a croft next to 2 dunes makes 1 more in summer', () => {
    const crofts = (terns: boolean) => {
      const s = place(wild(), 'croft', 4, 1, COAST); // meadow, next to the dunes of col 5
      s.wildlife = terns ? ['terns'] : [];
      return end(s);
    };
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 4, 1)]?.food ?? 0;
    expect(food(crofts(true)) - food(crofts(false))).toBe(1);
  });

  it('seals: kelp farms within 2 of them make 1 more', () => {
    const kelp = (seals: boolean) => {
      // The seals' mudflat (6,0) is beside the reef; the kelp farm is within 2 of it.
      let s = place(wild(), 'oysterReef', 6, 1, COAST);
      s = place(s, 'kelpFarm', 7, 1, COAST);
      s.wildlife = seals ? ['seals'] : [];
      return end(s);
    };
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 7, 1)]?.food ?? 0;
    expect(food(kelp(true)) - food(kelp(false))).toBe(1);
  });

  it('puffins at a lighthouse and dolphins in open sea: wellbeing every season', () => {
    let s = place(wild(), 'lighthouse', 6, 2, COAST);
    s.wildlife = ['puffins', 'dolphins'];
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 colony of puffins',
      amount: 1,
    });
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 pod of dolphins',
      amount: 1,
    });
  });
});

describe("the coast's festivals", () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, COAST);
  it('Kite Day: spring, 5 materials, +3 wellbeing, wind spires +1 that season', () => {
    const kites = (held: boolean) => {
      // A wind spire on the headland.
      const rows = [', , , ^ _ = = =', ', C , , _ = = ='];
      let s = place(start(7, 'spring', rows), 'windSpire', 3, 0, COAST);
      if (held) s = hold(s, 'kiteDay');
      return end(s);
    };
    const spire = (s: RunState) => s.lastReport!.energy.day.bySource.windSpire ?? 0;
    expect(spire(kites(true)) - spire(kites(false))).toBe(1);
    expect(
      kites(true).lastReport!.wellbeing.lines.find((l) => l.reason === 'Kite Day')!.amount,
    ).toBe(3);
  });

  it('the Harvest of the Sea and Lantern Night', () => {
    expect(COAST.festivals.map((f) => [f.id, f.season])).toEqual([
      ['kiteDay', 'spring'],
      ['harvestOfTheSea', 'autumn'],
      ['lanternNight', 'winter'],
    ]);
    let s = hold(start(7, 'autumn'), 'harvestOfTheSea');
    s = end(s);
    expect(s.freeRerolls).toBe(1);
  });
});

describe("the coast's animals on screen", () => {
  it('each moves about its habitat, drawn in code until its art comes', async () => {
    const { wildlifeActors, poseAt, drawCoastAnimal } = await import('../src/render/wildlifeArt');
    const { Graphics } = await import('pixi.js');
    const rows = [', , : _ = = = =', ', , : ^ = = = =', ', C : _ = = = =', ', , : _ = = = ='];
    let s = scenario(rows, { content: COAST, run: { water: true } });
    // The seals' mudflat (3,3) is beside the reef.
    s = place(s, 'oysterReef', 3, 2, COAST);
    s = place(s, 'lighthouse', 3, 1, COAST);
    s.wildlife = ['terns', 'seals', 'puffins', 'dolphins'];
    const actors = wildlifeActors(contentFor(COAST, s), s);
    expect([...new Set(actors.map((a) => a.kind))].sort()).toEqual([
      'dolphin',
      'puffin',
      'seal',
      'tern',
    ]);
    const g = new Graphics();
    for (const a of actors)
      for (const t of [0, 4000, 9000]) drawCoastAnimal(g, a.kind, poseAt(a, t, false));
    expect(g.bounds.width).toBeGreaterThan(0);
  });
});
