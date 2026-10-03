/**
 * The Highland's wonder, animals and festivals (HL6, proposals/highland.md,
 * Wonder, wildlife and festivals): the Cloud Terraces, as the Great Water
 * Garden is the Reach's and the Tidal Lagoon the coast's; mountain hares,
 * dippers, golden eagles and pine martens; the Snowmelt Fair, Shieling Day and
 * Lantern Night.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  computeHarmony,
  createRun,
  eraGoal,
  eraGoalMet,
  eraGoalOr,
  habitatOf,
  scoreRun,
  type RunState,
  type Season,
} from '../src/sim';
import { wonderSiteProblem, wonderStage } from '../src/sim/wonder';
import { contentFor } from '../src/sim/content/modifiers';
import { heatDemand } from '../src/sim/queries';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const HIGH = biomeContent('highland');
const TERRACES = 'cloudTerraces';
const animal = (id: string) => HIGH.wildlife.find((a) => a.id === id)!;

// The stream down column 0; the glen floor (0) to column 2, the slope (1) at
// columns 3 and 4, and the shoulder (2) beyond.
const GLEN = [
  '~ , , , , , , ,',
  '~ , , , , , , ,',
  '~ C , , , , , ,',
  '~ , , , , , , ,',
  '~ , , , , , , ,',
  '~ , , , , , , ,',
  '~ , , , , , , ,',
];
const SLOPE = Array.from({ length: 7 }, () => '0 0 0 1 1 2 2 2');
const start = (year = 7, season: Season = 'spring') =>
  scenario(GLEN, {
    content: HIGH,
    year,
    season,
    heights: SLOPE,
    citizens: 30,
    stores: { food: 500, biomass: 100, materials: 300 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, HIGH), s);
/** A building only an action makes (a coppice wood), set down for a test. */
const put = (s: RunState, type: string, col: number, row: number): RunState => {
  const uid = `b${s.nextUid}`;
  return {
    ...s,
    nextUid: s.nextUid + 1,
    buildings: { ...s.buildings, [uid]: { uid, type, at: at(col, row), builtTurn: s.turn } },
    priority: [...s.priority, uid],
  };
};
const end = (s: RunState) =>
  endSeason({ ...s, stores: { ...s.stores, food: 400, biomass: 60 } }, HIGH);

/** A closed Carbon Loop (coppice → biochar kiln → glen farm) and 2 pump stations, a season on. */
function ready(year = 7, pumps = 2): RunState {
  let s = put(start(year), 'coppiceWood', 3, 0);
  s = build(s, 'biocharKiln', [[2, 0]]);
  s = build(s, 'glenFarm', [[1, 0]]);
  s = build(s, 'irrigationChannel', [
    [1, 5],
    [1, 6],
  ]);
  s = build(
    s,
    'pumpStation',
    (
      [
        [2, 5],
        [2, 6],
      ] as [number, number][]
    ).slice(0, pumps),
  );
  s = end(s);
  expect(s.loops.map((l) => l.combo)).toContain('carbonLoop');
  return s;
}
// Its flower spans the slope (1) and the shoulder (2).
const startTerraces = (s: RunState) => place(s, TERRACES, 5, 3, HIGH);

describe('the Cloud Terraces', () => {
  it('needs a closed Carbon Loop and 2 pump stations, from era 3', () => {
    expect(rejects(start(), { type: 'place', building: TERRACES, at: at(5, 3) }, HIGH)).toBe(
      'the Cloud Terraces needs a closed Carbon Loop and 2 pump stations (0 now)',
    );
    expect(rejects(ready(7, 1), { type: 'place', building: TERRACES, at: at(5, 3) }, HIGH)).toBe(
      'the Cloud Terraces needs 2 pump stations (1 now)',
    );
    expect(rejects(ready(4), { type: 'place', building: TERRACES, at: at(5, 3) }, HIGH)).toBe(
      'the Cloud Terraces can be started from era 3',
    );
  });

  it('climbs the slope: its 7 tiles at 2 heights or more, on open land', () => {
    const s = ready();
    const why = (col: number, row: number) =>
      rejects(s, { type: 'place', building: TERRACES, at: at(col, row) }, HIGH);
    // All on the shoulder, at height 2.
    expect(why(6, 3)).toBe(
      'the Cloud Terraces must climb the slope: its 7 tiles at 2 heights or more',
    );
    expect(why(5, 6)).toBe('the Cloud Terraces needs all 7 of its tiles inside the glen');
    expect(startTerraces(s).buildings[uidAt(startTerraces(s), 5, 3)]!.type).toBe(TERRACES);
  });

  it('makes nothing while it is built; finished, +60 and a Graft tier', () => {
    let s = startTerraces(ready());
    const uid = uidAt(s, 5, 3);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(HIGH, s, s.buildings[uid]!));
      s = end(s);
    }
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(s.lastReport!.wondersDone).toEqual([TERRACES]);
    const score = scoreRun(HIGH, s);
    expect(score.lines).toContainEqual({ reason: 'Cloud Terraces', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Cloud Terraces' });
  });

  it('finished, homes within 3 tiles need 2 less heat each night', () => {
    let s = startTerraces(ready());
    s = build(s, 'cottage', [
      [7, 0], // 3 from its centre, on the shoulder: cold up here
      [2, 1], // 4 from it, on the glen floor
    ]);
    const need = (st: RunState, col: number, row: number) =>
      heatDemand(HIGH, st, st.buildings[uidAt(st, col, row)]!, 'night', 3);
    expect([need(s, 7, 0), need(s, 2, 1)]).toEqual([2, 1]);
    // Not while it is built.
    expect(need({ ...s, turn: s.turn + 3 }, 7, 0)).toBe(2);
    const uid = uidAt(s, 5, 3);
    const done = {
      ...s,
      buildings: { ...s.buildings, [uid]: { ...s.buildings[uid]!, finished: s.turn } },
    };
    expect([need(done, 7, 0), need(done, 2, 1)]).toEqual([0, 1]);
    // Never by day.
    expect(heatDemand(HIGH, done, done.buildings[uidAt(done, 7, 0)]!, 'day', 3)).toBe(0);
  });

  it('meets the Bloom era goal', () => {
    const bloom = eraGoal(HIGH, 4)!;
    expect(bloom.goal.kind).toBe('noShortfallYear');
    expect(eraGoalOr(contentFor(HIGH, start()), bloom)!.text).toBe('Or finish the Cloud Terraces.');
    let s = startTerraces(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(contentFor(HIGH, s), s, bloom)).toBe(true);
  });

  it('has a site on at least 35 of 40 glens', () => {
    const def = HIGH.byId[TERRACES]!;
    let fit = 0;
    for (let i = 0; i < 40; i++) {
      const s = createRun(HIGH, { seed: `site-${i}`, water: true, guided: false });
      if (Object.values(s.map.tiles).some((t) => !wonderSiteProblem(HIGH, s, def, t))) fit++;
    }
    expect(fit).toBeGreaterThanOrEqual(35);
  });
});

describe("the Highland's animals", () => {
  // The stream, a slope at 1, high meadow at 2, then crags and pine wood on the tops.
  const WILD = [
    '~ , m m m A A W W W',
    '~ , m m m A A W W W',
    '~ C , , , W W W W W',
    '~ , , , , W W W W W',
    ...Array.from({ length: 6 }, () => '~ W W W W W W W W W'),
  ];
  const TOPS = Array.from({ length: 10 }, () => '0 1 2 2 2 3 3 3 3 3');
  /** Brings Harmony down to `target` with clutter (1 Harmony each). */
  function harmonyAt(s: RunState, target: number): RunState {
    s.stores.clutter = 0;
    s.stores.clutter = computeHarmony(HIGH, s) - target;
    expect(s.stores.clutter).toBeGreaterThanOrEqual(0);
    s.harmony = computeHarmony(HIGH, s);
    return s;
  }
  const wild = (season: Season = 'summer') =>
    scenario(WILD, {
      content: HIGH,
      season,
      heights: TOPS,
      citizens: 6,
      stores: { food: 400, biomass: 20 },
      run: { water: true },
    });
  const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 400 } }, HIGH);

  it('arrive at Harmony 20, 40, 50 and 70 where their habitat is', () => {
    let s = place(wild(), 'hillTurbine', 1, 0, HIGH);
    s = place(s, 'lookout', 5, 0, HIGH);
    for (const [id, h] of [
      ['hares', 20],
      ['dippers', 40],
      ['eagles', 50],
      ['martens', 70],
    ] as const) {
      expect(animal(id).harmony).toBe(h);
      expect(habitatOf(s, animal(id)).tiles.length, id).toBeGreaterThan(0);
    }
    s = harmonyAt(s, 70);
    s.wildlife = [];
    s = end(s);
    expect(s.wildlife).toEqual(expect.arrayContaining(['hares', 'dippers', 'eagles', 'martens']));
    expect(s.notices).toContain('Pine Martens have come to the glen');
  });

  it('mountain hares keep to open meadow at height 2 or more', () => {
    const s = wild();
    const hares = habitatOf(s, animal('hares')).tiles;
    expect(hares).toHaveLength(6);
    for (const k of hares) expect(s.map.tiles[k]!.height).toBe(2);
    // A shieling takes its tile from them.
    expect(habitatOf(place(s, 'shieling', 3, 0, HIGH), animal('hares')).tiles).toHaveLength(5);
  });

  it('mountain hares: shielings within 2 of them make 1 more, in summer only', () => {
    const shieling = (hares: boolean, season: Season) => {
      const s = place(wild(season), 'shieling', 3, 0, HIGH);
      s.wildlife = hares ? ['hares'] : [];
      return end(s);
    };
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 3, 0)]?.food ?? 0;
    expect(food(shieling(true, 'summer')) - food(shieling(false, 'summer'))).toBe(1);
    expect(food(shieling(true, 'autumn')) - food(shieling(false, 'autumn'))).toBe(0);
  });

  it('dippers: fish ponds within 2 of the stream by a hill turbine make 1 more', () => {
    const pond = (dippers: boolean) => {
      let s = place(wild(), 'hillTurbine', 1, 0, HIGH);
      s = place(s, 'fishPond', 1, 1, HIGH);
      s.wildlife = dippers ? ['dippers'] : [];
      return end(s);
    };
    expect(habitatOf(wild(), animal('dippers')).tiles).toEqual([]);
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 1, 1)]?.food ?? 0;
    expect(food(pond(true)) - food(pond(false))).toBe(1);
  });

  it('golden eagles at a lookout among crags, pine martens in a big wood: wellbeing', () => {
    let s = place(wild(), 'lookout', 5, 0, HIGH);
    s.wildlife = ['eagles', 'martens'];
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 pair of golden eagles',
      amount: 1,
    });
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 family of pine martens',
      amount: 1,
    });
  });
});

describe("the Highland's festivals", () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, HIGH);

  it('the Snowmelt Fair, Shieling Day and Lantern Night', () => {
    expect(HIGH.festivals.map((f) => [f.id, f.season, f.cost])).toEqual([
      ['snowmeltFair', 'spring', { materials: 5 }],
      ['shielingDay', 'summer', { food: 5 }],
      ['lanternNight', 'winter', { materials: 5 }],
    ]);
  });

  it('the Snowmelt Fair: +3 wellbeing, and the melt fills every cistern', () => {
    const fair = (held: boolean) => {
      // A cistern beside the stream, above the snowmelt (height 1).
      const rows = ['~ , , ,', '~ , , ,', '~ C , ,'];
      let s = scenario(rows, {
        content: HIGH,
        year: 2,
        heights: ['0 1 1 1', '0 1 1 1', '0 1 1 1'],
        citizens: 6,
        stores: { food: 40, biomass: 10 },
        run: { water: true },
      });
      s = place(s, 'cistern', 1, 0, HIGH);
      if (held) s = hold(s, 'snowmeltFair');
      return endSeason(s, HIGH);
    };
    const cap = HIGH.byId.cistern!.water!.stores;
    expect(fair(true).lastReport!.water!.in['Snowmelt Fair']).toBe(cap);
    expect(fair(false).lastReport!.water!.in['Snowmelt Fair']).toBeUndefined();
    expect(
      fair(true).lastReport!.wellbeing.lines.find((l) => l.reason === 'Snowmelt Fair')!.amount,
    ).toBe(3);
  });

  it('Shieling Day: +3 wellbeing, and shielings make 1 more that summer', () => {
    const day = (held: boolean) => {
      const rows = ['~ , m m', '~ , m m', '~ C , ,'];
      let s = scenario(rows, {
        content: HIGH,
        season: 'summer',
        heights: ['0 1 2 2', '0 1 2 2', '0 1 2 2'],
        citizens: 6,
        stores: { food: 40, biomass: 10 },
        run: { water: true },
      });
      s = place(s, 'shieling', 2, 0, HIGH);
      if (held) s = hold(s, 'shielingDay');
      return endSeason(s, HIGH);
    };
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 2, 0)]?.food ?? 0;
    expect(food(day(true)) - food(day(false))).toBe(1);
    expect(
      day(true).lastReport!.wellbeing.lines.find((l) => l.reason === 'Shieling Day')!.amount,
    ).toBe(3);
  });
});

describe("the Highland's animals on screen", () => {
  it('each moves about its habitat, drawn in code until its art comes', async () => {
    const { wildlifeActors, poseAt, drawAnimal } = await import('../src/render/wildlifeArt');
    const { Graphics } = await import('pixi.js');
    const rows = ['~ , m m A A W W', '~ , m m A A W W', '~ C , , W W W W'];
    let s = scenario(rows, {
      content: HIGH,
      heights: ['0 1 2 2 3 3 3 3', '0 1 2 2 3 3 3 3', '0 1 2 2 3 3 3 3'],
      run: { water: true },
    });
    s = place(s, 'hillTurbine', 1, 0, HIGH);
    s = place(s, 'lookout', 4, 0, HIGH);
    s.wildlife = ['hares', 'dippers', 'eagles', 'martens'];
    const actors = wildlifeActors(contentFor(HIGH, s), s);
    expect([...new Set(actors.map((a) => a.kind))].sort()).toEqual([
      'dipper',
      'eagle',
      'hare',
      'marten',
    ]);
    const g = new Graphics();
    for (const a of actors)
      for (const season of ['summer', 'winter'])
        for (const t of [0, 4000, 9000]) drawAnimal(g, a.kind, poseAt(a, t, false), season);
    expect(g.bounds.width).toBeGreaterThan(0);
  });

  it("the animals' frames are the art guide's file names", async () => {
    const { poseAt } = await import('../src/render/wildlifeArt');
    const frames = (kind: 'hare' | 'dipper' | 'eagle' | 'marten') => {
      const actor = {
        kind,
        path: [
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ],
        phase: 0,
      };
      return new Set(Array.from({ length: 400 }, (_, i) => poseAt(actor, i * 97, false).frame));
    };
    expect([...frames('hare')].sort()).toEqual(['hare.run.1', 'hare.run.2', 'hare.sit']);
    expect([...frames('dipper')].sort()).toEqual(['dipper.1', 'dipper.2']);
    expect([...frames('eagle')].sort()).toEqual(['eagle.perch', 'eagle.soar.1', 'eagle.soar.2']);
    expect([...frames('marten')].sort()).toEqual(['marten.1', 'marten.2']);
  });
});
