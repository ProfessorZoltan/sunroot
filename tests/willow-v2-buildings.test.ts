/**
 * Willow Reach v2's new buildings (EXPANSION.md, New buildings; milestone
 * E3): the Reed Bed, Bathhouse, Rice-fish Paddy, Mushroom Cellar and
 * Hedgerow. They join with the water system, so these tests turn it on.
 */
import { describe, expect, it } from 'vitest';
import { canPlace, energyLedger, harmonyLines, type RunState, type WaterReport } from '../src/sim';
import { stormExposed } from '../src/sim/queries';
import { at, content, endSeason, place, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });
const NEW = ['reedBed', 'bathhouse', 'riceFishPaddy', 'mushroomCellar', 'hedgerow'];

// The river in the first column; a channel along the middle row from the river's edge.
const VALLEY = [
  '~ f . . . . .',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f , , C , ,',
];
const start = (season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring', rows = VALLEY) =>
  scenario(rows, { content: W, season, citizens: 30, stores: { food: 500 } });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, W), s);
const channel = (s: RunState, length = 4) =>
  build(
    s,
    'irrigationChannel',
    Array.from({ length }, (_, i) => [1 + i, 2] as [number, number]),
  );
const end = (s: RunState) => endSeason(s, W);
const water = (s: RunState): WaterReport => s.lastReport!.water!;
const use = (s: RunState, col: number, row: number) => water(s).uses[uidAt(s, col, row)]!;
const yieldOf = (s: RunState, col: number, row: number, res: 'food' | 'compost' | 'biomass') =>
  s.lastReport!.yields[uidAt(s, col, row)]?.[res] ?? 0;
const bathLine = (s: RunState) =>
  s.lastReport!.wellbeing.lines.find((l) => l.reason.startsWith('powered Bathhouse'));

describe('Willow Reach v2 joins with water', () => {
  it('none of the new buildings can be built while the run has no water', () => {
    const s = scenario(VALLEY, { citizens: 30 });
    for (const id of NEW) {
      const r = canPlace(content, s, id, at(2, 1));
      expect(r.ok, id).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/needs the water system/);
    }
  });
});

describe('Reed Bed', () => {
  it('stands next to a channel or the river, nowhere else', () => {
    const s = channel(start());
    expect(canPlace(W, s, 'reedBed', at(3, 3)).ok).toBe(true); // beside the channel
    expect(canPlace(W, s, 'reedBed', at(1, 4)).ok).toBe(true); // beside the river
    expect(canPlace(W, s, 'reedBed', at(5, 0)).ok).toBe(false);
  });

  it("cleans a bathhouse's grey water for the farm below it, and gives biomass and Harmony", () => {
    let s = channel(start());
    s = build(s, 'bathhouse', [[2, 1]]);
    s = build(s, 'reedBed', [[3, 3]]);
    s = build(s, 'floodplainFarm', [[4, 1]]);
    const before = harmonyLines(W, s).find((l) => l.label === '1 Reed Bed');
    expect(before).toEqual({ label: '1 Reed Bed', amount: 1 });
    s = end(s);
    // The bath draws 1 fresh; its grey unit, cleaned, waters the farm: only 1 drawn.
    expect(use(s, 4, 1).got).toEqual({ clean: 1, nutrient: 0, grey: 0 });
    expect(water(s).channels[0]!.drawn).toBe(1);
    expect(yieldOf(s, 3, 3, 'biomass')).toBe(1);
  });

  it('beside the river, cleans grey water where a channel rejoins it', () => {
    // A channel along the bank from (1,0) to (1,2) rejoins the river at position 3.
    const BANK = ['~ f m m m', '~ f m m m', '~ f m m m', '~ f m m m', '~ f m m m', '~ f , C ,'];
    const lay = (s: RunState) =>
      build(
        build(s, 'irrigationChannel', [
          [1, 0],
          [1, 1],
          [1, 2],
        ]),
        'bathhouse',
        [[2, 1]],
      );
    const without = end(lay(start('spring', BANK)));
    expect(water(without).greyToRiver).toBe(1);
    // The reed bed at (1,4) touches no channel, only the river where the channel rejoins.
    const s0 = lay(start('spring', BANK));
    expect(canPlace(W, s0, 'reedBed', at(1, 4)).ok).toBe(true);
    const withReeds = end(build(s0, 'reedBed', [[1, 4]]));
    expect(water(withReeds).greyToRiver).toBe(0);
    expect(withReeds.lastReport!.math[uidAt(withReeds, 1, 4)]).toContain(
      'water: cleaned 1 grey water joining the river',
    );
  });
});

describe('Bathhouse', () => {
  it('turns 1 clean water and 1 heat into +3 wellbeing, and returns 1 grey', () => {
    let s = channel(start());
    s = build(s, 'bathhouse', [[2, 1]]);
    s = end(s);
    expect(use(s, 2, 1)).toMatchObject({ got: { clean: 1, nutrient: 0, grey: 0 }, short: false });
    expect(bathLine(s)).toMatchObject({ reason: 'powered Bathhouse', amount: 3 });
    // Its grey water soaks away at the channel's dead end.
    expect(water(s).channels[0]!.lost.grey).toBe(1);
    // With no kiln or heat well next to it, its heat comes from the grid.
    expect(s.lastReport!.energy.night.heat).toMatchObject({ demand: 1, direct: 1, neighbor: 0 });
  });

  it('short of water, gives half its wellbeing, rounded down', () => {
    // Two paddies at the intake take all 4 the channel can carry.
    let s = channel(start());
    s = build(s, 'riceFishPaddy', [
      [1, 1],
      [1, 3],
    ]);
    s = build(s, 'bathhouse', [[2, 1]]);
    s = end(s);
    expect(use(s, 2, 1).short).toBe(true);
    expect(bathLine(s)).toMatchObject({
      reason: 'powered Bathhouse, short of water',
      amount: 1,
    });
  });

  it('takes its heat from a staffed kiln next to it, for free', () => {
    let s = channel(start());
    s = build(s, 'bathhouse', [[2, 1]]);
    s = build(s, 'kiln', [[2, 0]]);
    s = end(s);
    expect(s.lastReport!.energy.night.heat).toMatchObject({ demand: 1, direct: 0, neighbor: 1 });
    expect(s.lastReport!.neighborHeat).toEqual([
      { slot: 'night', from: uidAt(s, 2, 0), to: uidAt(s, 2, 1), amount: 1 },
    ]);
    expect(bathLine(s)?.amount).toBe(3);
    // The ledger counts the kiln's heat as made and the bath's heat as used.
    const ledger = energyLedger(W, s.lastReport!);
    const sum = (lines: Record<string, { amount: number }>) =>
      Object.values(lines).reduce((a, l) => a + l.amount, 0);
    expect(ledger.night.made['Heat from a neighbouring kiln or heat well']?.amount).toBe(1);
    expect(sum(ledger.night.made)).toBe(sum(ledger.night.used));
  });

  it("or from a neighbouring heat well's stored heat", () => {
    let s = channel(start());
    s = build(s, 'bathhouse', [[2, 1]]);
    s = build(s, 'heatWell', [[3, 1]]);
    s.buildings[uidAt(s, 3, 1)]!.stored = 3;
    s = end(s);
    expect(s.lastReport!.energy.night.heat).toMatchObject({ direct: 0, neighbor: 1 });
    expect(s.lastReport!.neighborHeat).toEqual([
      { slot: 'night', from: uidAt(s, 3, 1), to: uidAt(s, 2, 1), amount: 1 },
    ]);
  });
});

describe('Rice-fish Paddy', () => {
  it('stands only on floodplain next to a channel', () => {
    const s = channel(start());
    expect(canPlace(W, s, 'riceFishPaddy', at(1, 1)).ok).toBe(true);
    expect(canPlace(W, s, 'riceFishPaddy', at(2, 1)).ok).toBe(false); // meadow
    const r = canPlace(W, s, 'riceFishPaddy', at(1, 4));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/next to Irrigation Channel/);
  });

  it('needs 2 water, makes 4 food in summer, and sends nutrient-rich water downstream', () => {
    let s = channel(start('summer'));
    s = build(s, 'riceFishPaddy', [[1, 1]]);
    s = build(s, 'floodplainFarm', [[4, 1]]);
    s = end(s);
    expect(use(s, 1, 1)).toMatchObject({ need: 2, short: false });
    expect(yieldOf(s, 1, 1, 'food')).toBe(4);
    // The farm below takes the paddy's nutrient-rich unit: summer 4, −1 on meadow, +1.
    expect(use(s, 4, 1).got).toEqual({ clean: 0, nutrient: 1, grey: 0 });
    expect(yieldOf(s, 4, 1, 'food')).toBe(4);
  });
});

describe('Mushroom Cellar', () => {
  // Woodland at (3,0); a hill at (2,0) and (3,1).
  const GLADE = ['~ f ^ W , ,', '~ f , ^ , ,', '~ f , C , ,', '~ f , , , ,'];
  const glade = (biomass: number) =>
    scenario(GLADE, {
      content: W,
      season: 'winter',
      citizens: 30,
      stores: { food: 500, biomass },
    });

  it('turns 2 biomass into 2 food and 1 compost, winter included, with no energy', () => {
    let s = build(glade(2), 'mushroomCellar', [[5, 3]]);
    s = end(s);
    expect(yieldOf(s, 5, 3, 'food')).toBe(2);
    expect(yieldOf(s, 5, 3, 'compost')).toBe(1);
    expect(s.lastReport!.runs[uidAt(s, 5, 3)]).toMatchObject({
      runs: 1,
      energy: { day: 0, night: 0 },
    });
  });

  it('does nothing without biomass', () => {
    const s = end(build(glade(1), 'mushroomCellar', [[5, 3]]));
    expect(yieldOf(s, 5, 3, 'food')).toBe(0);
  });

  it('makes 1 more food next to woodland or a tall building', () => {
    let s = build(glade(6), 'mushroomCellar', [[4, 0]]); // beside the woodland
    s = build(s, 'kiln', [[1, 1]]);
    s = build(s, 'mushroomCellar', [[2, 2]]); // beside the kiln, which is tall
    s = build(s, 'mushroomCellar', [[5, 3]]); // neither
    s = end(s);
    expect(yieldOf(s, 4, 0, 'food')).toBe(3);
    expect(yieldOf(s, 2, 2, 'food')).toBe(3);
    expect(yieldOf(s, 5, 3, 'food')).toBe(2);
  });
});

describe('Hedgerow', () => {
  // Woodland at (5,0), away from the hill at (2,0).
  const HILLS = ['~ f ^ , , W', '~ f , ^ , ,', '~ f , C , ,'];
  const hills = () => scenario(HILLS, { content: W, citizens: 30, stores: { food: 500 } });

  it('stands only on scrub or meadow', () => {
    const s = hills();
    expect(canPlace(W, s, 'hedgerow', at(2, 1)).ok).toBe(true);
    expect(canPlace(W, s, 'hedgerow', at(2, 0)).ok).toBe(false); // hill
    expect(canPlace(W, s, 'hedgerow', at(5, 0)).ok).toBe(false); // woodland
  });

  it('counts its scrub tile as meadow for Harmony, without changing the tile', () => {
    const s0 = hills();
    const s = build(s0, 'hedgerow', [[2, 1]]);
    const count = (x: RunState, type: string) =>
      Number(
        harmonyLines(W, x)
          .find((l) => l.label.includes(` ${type} tiles`))
          ?.label.split(' ')[0] ?? 0,
      );
    expect(count(s, 'meadow')).toBe(count(s0, 'meadow') + 1);
    expect(s.map.tiles[`${at(2, 1).q},${at(2, 1).r}`]?.type).toBe('scrub');
  });

  it('shelters the buildings next to it from storms', () => {
    let s = build(hills(), 'solarCanopy', [[2, 0]]);
    const canopy = () => s.buildings[uidAt(s, 2, 0)]!;
    expect(stormExposed(W, s, canopy())).toBe(true);
    s = build(s, 'hedgerow', [[2, 1]]);
    expect(stormExposed(W, s, canopy())).toBe(false);
  });
});
