import { describe, expect, it } from 'vitest';
import { computeInsight } from '../src/game/insight';
import { computeHarmony, harmonyLines, projectSeason, resolveAsIs } from '../src/sim';
import { content, endSeason, place, scenario } from './helpers';
import { act, place as placeAt, playToWinter } from './walkthrough';

const DRY = [
  '^ ^ , . ~ . , m ^ ^',
  ' ^ . , , ~ , . m W ^',
  '^ . C , ~ , . . . ^',
  ' ^ . , , ~ , . . . ^',
];

describe('projections', () => {
  it('a projected winter matches the winter that is then played', () => {
    const { state: autumn, sites } = playToWinter();
    const projected = projectSeason(content, autumn, 'winter');
    expect(projected.energy.night.demand).toBe(4);
    let s = act(autumn, { type: 'pickCard', card: 'riverWheel' });
    s = placeAt(s, 'riverWheel', sites.wheel);
    const withWheel = projectSeason(content, s, 'winter');
    s = act(s, { type: 'endSeason' });
    expect(s.lastReport!.energy).toEqual(withWheel.energy);
  });

  it('never changes the state', () => {
    const s = scenario(DRY);
    const before = JSON.stringify(s);
    projectSeason(content, s, 'winter');
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe('Harmony breakdown', () => {
  it('adds up to Harmony', () => {
    let s = scenario(DRY, { stores: { clutter: 1 } });
    s = place(s, 'windSpire', 0, 0);
    s = place(s, 'pollinatorMeadow', 6, 2);
    const lines = harmonyLines(content, s);
    expect(lines.map((l) => l.label)).toEqual([
      '3 meadow tiles',
      '1 woodland tiles × 2',
      '1 Pollinator Meadow',
      '1 Wind Spire',
      '1 clutter',
    ]);
    expect(lines.reduce((n, l) => n + l.amount, 0)).toBe(computeHarmony(content, s));
  });
});

describe('insight', () => {
  it('shows the year: past seasons from history, this one and the rest as projections', () => {
    let s = scenario(DRY);
    s = endSeason(endSeason(s)); // now autumn
    const insight = computeInsight(content, s, resolveAsIs(content, s));
    expect(insight.year.map((y) => y.status)).toEqual(['done', 'done', 'now', 'forecast']);
    expect(insight.year[0]!.day.supply).toBe(2);
    expect(insight.year[3]!.night.demand).toBe(2); // the camp's winter heat
  });

  it("explains this season's change in each store", () => {
    let s = scenario(DRY, { season: 'autumn' });
    s = place(s, 'fishPond', 3, 2);
    s = place(s, 'fishPond', 5, 2);
    const insight = computeInsight(content, s, resolveAsIs(content, s));
    expect(insight.sources.food).toEqual([{ label: 'Fish Pond', amount: 4 }]);
    expect(insight.delta.food).toBe(4 - 6);
    expect(insight.sources.materials[0]).toEqual({ label: 'Foraging', amount: 2 });
    expect(insight.workers).toEqual({ busy: 2, total: 6 });
    expect(insight.now.population.reason).toBe('lowSpareFood');
  });
});
