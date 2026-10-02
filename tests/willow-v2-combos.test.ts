/**
 * Willow Reach v2's chains and formations (EXPANSION.md, New chains and
 * formations; milestone E3), and the heat cascade (DECISIONS.md Q18 (b)).
 * Each triggers in a test; they join with the water system.
 */
import { describe, expect, it } from 'vitest';
import type { RunState } from '../src/sim';
import { content, endSeason, place, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });

// The river in the first column; a channel along the middle row from the river's edge.
const VALLEY = [
  '~ f . . . . .',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f , , C , ,',
];
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const start = (season: Season = 'spring', rows = VALLEY, biomass = 0) =>
  scenario(rows, { content: W, season, citizens: 30, stores: { food: 500, biomass } });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, W), s);
const channel = (s: RunState) =>
  build(s, 'irrigationChannel', [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ]);
const end = (s: RunState) => endSeason(s, W);
const hits = (s: RunState, combo: string) => s.lastReport!.combos.filter((h) => h.combo === combo);
const yieldOf = (
  s: RunState,
  col: number,
  row: number,
  res: 'food' | 'materials' | 'biomass' | 'compost',
) => s.lastReport!.yields[uidAt(s, col, row)]?.[res] ?? 0;
const math = (s: RunState, col: number, row: number) =>
  s.lastReport!.math[uidAt(s, col, row)] ?? [];

describe('Bath Loop', () => {
  // A kiln at (2,0) warms the bathhouse at (2,1); a reed bed at (3,1) cleans its grey water.
  const bath = (kiln: boolean) => {
    let s = channel(start());
    s = build(s, 'bathhouse', [[2, 1]]);
    s = build(s, 'reedBed', [[3, 1]]);
    if (kiln) s = build(s, 'kiln', [[2, 0]]);
    return s;
  };

  it('closes when a neighbour warms the bath and a reed bed next to it cleans its water', () => {
    let s = end(bath(true));
    expect(hits(s, 'bathLoop')).toHaveLength(1);
    expect(s.loops.map((l) => l.combo)).toContain('bathLoop');
    s = end(s);
    expect(math(s, 2, 0)).toContain('+1 materials from the Bath Loop');
    expect(math(s, 3, 1)).toContain('+1 biomass from the Bath Loop');
  });

  it('not while the grid heats the bath', () => {
    const s = end(bath(false));
    expect(hits(s, 'bathLoop')).toHaveLength(0);
  });
});

describe('Heat Cascade', () => {
  // Kiln (2,0) → bathhouse (2,1) → greenhouse (1,1), in winter, when the greenhouse needs heat.
  const cascade = (kiln: boolean) => {
    let s = channel(start('winter'));
    s = build(s, 'solarCanopy', [
      [5, 0],
      [6, 0],
      [5, 1],
    ]);
    s = build(s, 'bathhouse', [[2, 1]]);
    s = build(s, 'greenhouse', [[1, 1]]);
    if (kiln) s = build(s, 'kiln', [[2, 0]]);
    return end(s);
  };

  it('a warmed bathhouse passes 1 heat on to the greenhouse next to it, and the loop closes', () => {
    const s = cascade(true);
    const bath = uidAt(s, 2, 1);
    const gh = uidAt(s, 1, 1);
    expect(s.lastReport!.neighborHeat).toEqual(
      expect.arrayContaining([
        { slot: 'night', from: uidAt(s, 2, 0), to: bath, amount: 1 },
        { slot: 'day', from: bath, to: gh, amount: 1 },
      ]),
    );
    expect(s.lastReport!.energy.day.heat).toMatchObject({ demand: 1, direct: 0, neighbor: 1 });
    expect(hits(s, 'heatCascade')).toHaveLength(1);
  });

  it('a bathhouse heated from the grid passes nothing on', () => {
    const s = cascade(false);
    expect(s.lastReport!.neighborHeat).toEqual([]);
    expect(s.lastReport!.energy.day.heat).toMatchObject({ direct: 1, neighbor: 0 });
    expect(hits(s, 'heatCascade')).toHaveLength(0);
  });
});

describe('Rice-Fish Loop', () => {
  it('closes with a composter between a paddy and a farm that got its nutrient-rich water', () => {
    // Paddy (1,1) at the intake; composter (2,1); farm (3,1) further down the channel.
    let s = channel(start('summer', VALLEY, 10));
    s = build(s, 'riceFishPaddy', [[1, 1]]);
    s = build(s, 'composter', [[2, 1]]);
    s = build(s, 'floodplainFarm', [[3, 1]]);
    s = end(s);
    expect(s.lastReport!.water!.uses[uidAt(s, 3, 1)]!.got.nutrient).toBe(1);
    expect(hits(s, 'riceFishLoop')).toHaveLength(1);
  });
});

describe('Mushroom Loop', () => {
  it('closes with a working cellar next to a working farm; both make +1 after', () => {
    let s = channel(start('spring', VALLEY, 10));
    s = build(s, 'floodplainFarm', [[3, 1]]);
    s = build(s, 'mushroomCellar', [[4, 1]]);
    s = end(s);
    expect(hits(s, 'mushroomLoop')).toHaveLength(1);
    s = end(s);
    expect(math(s, 3, 1)).toContain('+1 food from the Mushroom Loop');
    expect(math(s, 4, 1)).toContain('+1 food from the Mushroom Loop');
  });
});

describe('Keyhole Garden', () => {
  // A composter at (3,1) with farms at (2,1), (4,1) and (3,2).
  const garden = (farms: [number, number][], c = W) => {
    let s = scenario(VALLEY, {
      content: c,
      citizens: 30,
      stores: { food: 500, biomass: 10 },
    });
    s = place(s, 'composter', 3, 1, c);
    for (const [col, row] of farms) s = place(s, 'floodplainFarm', col, row, c);
    return endSeason(s, c);
  };

  it('a composter with 3 farms next to it makes twice the compost', () => {
    const three = garden([
      [2, 1],
      [4, 1],
      [3, 2],
    ]);
    expect(hits(three, 'keyholeGarden')).toHaveLength(1);
    expect(yieldOf(three, 3, 1, 'compost')).toBe(4);
    const two = garden([
      [2, 1],
      [4, 1],
    ]);
    expect(yieldOf(two, 3, 1, 'compost')).toBe(2);
  });

  it('not without water: run 1 plays as before', () => {
    const s = garden(
      [
        [2, 1],
        [4, 1],
        [3, 2],
      ],
      content,
    );
    expect(hits(s, 'keyholeGarden')).toHaveLength(0);
    expect(yieldOf(s, 3, 1, 'compost')).toBe(2);
  });
});

describe('Water Ladder', () => {
  const TERRACES = ['~ f f f f f', ' ~ . . . . .', '~ . , C , ,'];

  it('3 paddies in a row each make +1 food', () => {
    let s = start('summer', TERRACES);
    s = build(s, 'irrigationChannel', [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
    s = build(s, 'riceFishPaddy', [
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    s = end(s);
    expect(hits(s, 'waterLadder')).toHaveLength(1);
    for (const col of [1, 2, 3]) expect(math(s, col, 0)).toContain('+1 food from the Water Ladder');
  });
});

describe('Hearth Square', () => {
  it('a bathhouse, a Commons Plaza and a cottage all touching: +5 wellbeing in winter', () => {
    const square = (season: Season) => {
      let s = channel(start(season));
      s = build(s, 'bathhouse', [[2, 1]]);
      s = build(s, 'commonsPlaza', [[3, 1]]);
      s = build(s, 'cottage', [[3, 0]]);
      return end(s);
    };
    const line = (s: RunState) =>
      s.lastReport!.wellbeing.lines.find((l) => l.reason === 'Hearth Square');
    const winter = square('winter');
    expect(hits(winter, 'hearthSquare')).toHaveLength(1);
    expect(line(winter)?.amount).toBe(5);
    expect(line(square('spring'))).toBeUndefined();
  });
});
