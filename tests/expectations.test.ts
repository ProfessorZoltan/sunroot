/** Rising expectations and harsher seasons in the later eras. */
import { describe, expect, it } from 'vitest';
import { effectiveContent } from '../src/sim';
import { content, endSeason, place, scenario } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];
const line = (s: ReturnType<typeof endSeason>) =>
  s.lastReport!.wellbeing.lines.find((l) => l.kind === 'expectations');

describe('rising expectations', () => {
  it('start in era 3: citizens beyond what civic life serves cost wellbeing', () => {
    const many = { citizens: 35, stores: { food: 300 } };
    expect(line(endSeason(scenario(LAND, { year: 6, season: 'summer', ...many })))).toBeUndefined();
    const s = endSeason(scenario(LAND, { year: 7, season: 'summer', ...many }));
    // 35 citizens, 20 served: 15 beyond, so −2.
    expect(line(s)).toMatchObject({ amount: -2 });
  });

  it('a working Commons Plaza serves 15 more', () => {
    let s = scenario(LAND, { year: 7, season: 'summer', citizens: 35, stores: { food: 300 } });
    s = place(s, 'commonsPlaza', 6, 2);
    s = place(s, 'solarCanopy', 7, 2);
    expect(line(endSeason(s))).toBeUndefined();
  });
});

describe('harsher seasons', () => {
  it('era 3: dearer flood repairs and wilder storms; era 4: colder winter nights', () => {
    const rules = (year: number, tunings: string[] = []) =>
      effectiveContent(content, { ...scenario(LAND, { year }), tunings });
    expect(rules(6).events.flood!.repairCost).toBe(2);
    expect(rules(7).events.flood!.repairCost).toBe(3);
    expect(rules(7).events.storm!.disableCount).toBe(2);
    expect(rules(9).byId.cottage!.demand!.heat.night[3]).toBe(1);
    expect(rules(10).byId.cottage!.demand!.heat.night[3]).toBe(2);
    // Insulated Homes still does away with it.
    expect(rules(10, ['insulatedHomes']).byId.cottage!.demand!.heat.night[3]).toBe(0);
  });
});
