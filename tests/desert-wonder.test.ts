/**
 * The Sun Desert's wonder, animals and festivals (SD6, proposals/sun-desert.md,
 * Wonder, wildlife and festivals): the Solar Oasis; fennec foxes, sandgrouse,
 * lanner falcons and oryx; the Rain Feast, the Night Market and Star Night.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
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
import { updateWildlife } from '../src/sim/wildlife';
import { contentFor } from '../src/sim/content/modifiers';
import { coolDemand } from '../src/sim/queries';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const D = biomeContent('sunDesert');
const OASIS = 'solarOasis';
const animal = (id: string) => D.wildlife.find((a) => a.id === id)!;

// The oasis on the left; a channel from it along row 1; gravel plain beyond.
const LAND = [
  'g g g g g g g g g g',
  'O g g g g g g g g g',
  'O g g C g g g g g g',
  'g g g g g g g g g g',
  'g g g g g g g g g g',
  'g g g g g g g g g g',
  'g g g g g g g g g g',
];
const start = (year = 7, season: Season = 'spring') =>
  scenario(LAND, {
    content: D,
    year,
    season,
    citizens: 30,
    stores: { food: 500, biomass: 60, materials: 400 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, D), s);
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 400 } }, D);

/** A closed Grey Water Loop (house → reed bed → garden along the channel) and its plants. */
function ready(year = 7, plants = 2): RunState {
  let s = build(start(year), 'irrigationChannel', [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
    [6, 1],
  ]);
  s = build(s, 'mudBrickHouse', [[1, 0]]);
  s = build(s, 'reedBed', [[2, 0]]);
  s = build(s, 'oasisGarden', [[3, 0]]);
  s = build(
    s,
    'concentratedSolarPlant',
    (
      [
        [1, 5],
        [2, 5],
      ] as [number, number][]
    ).slice(0, plants),
  );
  s = end(s);
  expect(s.loops.map((l) => l.combo)).toContain('greyWaterLoop');
  return s;
}
// Its flower beside the channel's end.
const startOasis = (s: RunState) => place(s, OASIS, 6, 3, D);

describe('the Solar Oasis', () => {
  it('needs a closed Grey Water Loop and 2 Concentrated Solar Plants, from era 3', () => {
    expect(rejects(start(), { type: 'place', building: OASIS, at: at(6, 3) }, D)).toMatch(
      /^the Solar Oasis needs a closed Grey Water Loop and 2 /,
    );
    expect(rejects(ready(7, 1), { type: 'place', building: OASIS, at: at(6, 3) }, D)).toMatch(
      /needs 2 .*\(1 now\)/,
    );
    expect(rejects(ready(4), { type: 'place', building: OASIS, at: at(6, 3) }, D)).toBe(
      'the Solar Oasis can be started from era 3',
    );
  });

  it('stands on open land by water, and costs 60 materials and 20 food', () => {
    const s = ready();
    const before = s.stores;
    const t = startOasis(s);
    expect(t.buildings[uidAt(t, 6, 3)]!.type).toBe(OASIS);
    expect(before.materials - t.stores.materials).toBe(60);
    expect(before.food - t.stores.food).toBe(20);
    // Far from any water, it can't start.
    expect(rejects(s, { type: 'place', building: OASIS, at: at(7, 5) }, D)).toMatch(/must touch/);
  });

  it('makes nothing while it is built; finished, energy day and night, water, +60, a Graft tier', () => {
    let s = startOasis(ready());
    const uid = uidAt(s, 6, 3);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(D, s, s.buildings[uid]!));
      s = end(s);
    }
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(s.lastReport!.wondersDone).toEqual([OASIS]);
    s = end(s);
    expect(s.lastReport!.generated[uid]!.energy).toEqual({ day: 2, night: 2 });
    // Its cooling pool runs into the channel beside it.
    expect(s.lastReport!.water!.in['Solar Oasis']).toBe(2);
    const score = scoreRun(D, s);
    expect(score.lines).toContainEqual({ reason: 'Solar Oasis', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Solar Oasis' });
  });

  it('meets the Bloom era goal', () => {
    const bloom = eraGoal(D, 4)!;
    expect(eraGoalOr(contentFor(D, start()), bloom)!.text).toBe('Or finish the Solar Oasis.');
    let s = startOasis(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(contentFor(D, s), s, bloom)).toBe(true);
  });

  it('has a site on at least 35 of 40 deserts', () => {
    const def = D.byId[OASIS]!;
    let fit = 0;
    for (let i = 0; i < 40; i++) {
      const s = createRun(D, { seed: `site-${i}`, water: true, guided: false });
      if (Object.values(s.map.tiles).some((t) => !wonderSiteProblem(D, s, def, t))) fit++;
    }
    expect(fit).toBeGreaterThanOrEqual(35);
  });
});

describe("the desert's animals", () => {
  // The oasis, scrub and dunes, rock at the top, and a wide gravel plain.
  const WILD = [
    'K K g g g g g g',
    'O , , E E g g g',
    'O , C , E g g g',
    'g g g g g g g g',
    'g g g g g g g g',
  ];
  const wild = (season: Season = 'summer') =>
    scenario(WILD, {
      content: D,
      season,
      citizens: 10,
      stores: { food: 400 },
      run: { water: true },
    });

  it('arrive at Harmony 20, 40, 50 and 70 where their habitat is', () => {
    let s = place(wild(), 'fogNet', 0, 0, D);
    s = place(s, 'windTower', 2, 0, D);
    for (const [id, h] of [
      ['fennecs', 20],
      ['sandgrouse', 40],
      ['falcons', 50],
      ['oryx', 70],
    ] as const) {
      expect(animal(id).harmony).toBe(h);
      expect(habitatOf(s, animal(id)).tiles.length, id).toBeGreaterThan(0);
    }
    // At Harmony 70 all four come.
    s.harmony = 70;
    s.wildlife = [];
    updateWildlife(contentFor(D, s), s, true);
    expect(s.wildlife).toEqual(
      expect.arrayContaining(['fennecs', 'sandgrouse', 'falcons', 'oryx']),
    );
    expect(s.notices).toContain('Oryx have come to the desert');
  });

  it('fennec foxes: oasis gardens within 2 of them make 1 more in summer', () => {
    const garden = (foxes: boolean, season: Season) => {
      const s = place(wild(season), 'oasisGarden', 1, 1, D);
      s.wildlife = foxes ? ['fennecs'] : [];
      return end(s);
    };
    const food = (s: RunState) => s.lastReport!.yields[uidAt(s, 1, 1)]?.food ?? 0;
    expect(food(garden(true, 'summer')) - food(garden(false, 'summer'))).toBe(1);
    expect(food(garden(true, 'autumn')) - food(garden(false, 'autumn'))).toBe(0);
  });

  it('sandgrouse at the oasis by a fog net carry 1 water a season to cisterns within 2', () => {
    const cistern = (birds: boolean) => {
      let s = place(wild('autumn'), 'fogNet', 0, 0, D);
      s = place(s, 'cistern', 1, 2, D);
      s.wildlife = birds ? ['sandgrouse'] : [];
      return end(s);
    };
    expect(cistern(true).lastReport!.water!.in.sandgrouse).toBe(1);
    expect(cistern(false).lastReport!.water!.in.sandgrouse).toBeUndefined();
  });

  it('lanner falcons at a wind tower on the rocks, oryx on a wide plain: wellbeing', () => {
    let s = place(wild(), 'windTower', 2, 0, D);
    s.wildlife = ['falcons', 'oryx'];
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 pair of lanner falcons',
      amount: 1,
    });
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 herd of oryx',
      amount: 1,
    });
  });
});

describe("the desert's festivals", () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, D);
  const LITTLE = ['~ f g g', '~ f g g', '~ g C g'];
  const town = (season: Season) =>
    scenario(LITTLE, {
      content: D,
      year: 2,
      season,
      citizens: 6,
      stores: { food: 60 },
      run: { water: true },
    });

  it('the Rain Feast, the Night Market and Star Night', () => {
    expect(D.festivals.map((f) => [f.id, f.season, f.cost])).toEqual([
      ['rainFeast', 'spring', { food: 5 }],
      ['nightMarket', 'summer', { materials: 5 }],
      ['starNight', 'winter', { materials: 5 }],
    ]);
  });

  it('the Rain Feast: +3 wellbeing, and every cistern fills', () => {
    const feast = (held: boolean) => {
      let s = place(town('spring'), 'cistern', 1, 2, D);
      if (held) s = hold(s, 'rainFeast');
      return endSeason(s, D);
    };
    expect(feast(true).lastReport!.water!.in['Rain Feast']).toBe(D.byId.cistern!.water!.stores);
    expect(
      feast(true).lastReport!.wellbeing.lines.find((l) => l.reason === 'Rain Feast')!.amount,
    ).toBe(3);
  });

  it('the Night Market: homes need 1 less cooling that summer', () => {
    let s = place(town('summer'), 'mudBrickHouse', 3, 0, D);
    const house = () => s.buildings[uidAt(s, 3, 0)]!;
    // The run's own rules: festivals come with the water system, a run option.
    expect(coolDemand(contentFor(D, s), s, house(), 'day', 1)).toBe(1);
    s = hold(s, 'nightMarket');
    expect(coolDemand(contentFor(D, s), s, house(), 'day', 1)).toBe(0);
  });

  it('Star Night: homes use 1 less energy at night that winter', () => {
    const night = (held: boolean) => {
      let s = place(town('winter'), 'mudBrickHouse', 3, 0, D);
      if (held) s = hold(s, 'starNight');
      return endSeason(s, D).lastReport!.energy.night.demandBy.mudBrickHouse ?? 0;
    };
    expect(night(false) - night(true)).toBe(1);
  });
});
