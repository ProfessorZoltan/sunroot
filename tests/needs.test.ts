/**
 * The map's needs labels (src/game/needs.ts): what each working building gets this season of
 * water, day and night energy, heat and cooling, out of what it needs (X/Y). The season's report
 * keeps each building's needs (`report.needs`); the labels are read from the season's preview.
 */
import { describe, expect, it } from 'vitest';
import { forecastSeason, type Content, type RunState, type Season } from '../src/sim';
import type willowReach from '../src/content/willow-reach.json';
import { needLabels, needText } from '../src/game/needs';
import { GameStore } from '../src/game/store';
import { content, place, scenario, uidAt, withWater } from './helpers';

const LAND = ['~ f , , , ,', '~ f , , , ,', '~ f C , , ,', '~ f , , , ,'];
const now = (s: RunState, c: Content = content) => forecastSeason(c, s).lastReport!;

describe('building needs', () => {
  it('a cottage: night energy, and heat in winter; all of it while it is on, none once off', () => {
    const spring = place(scenario(LAND), 'cottage', 3, 0);
    const report = now(spring);
    expect(report.blackouts).not.toContain(uidAt(spring, 3, 0));
    expect(report.needs[uidAt(spring, 3, 0)]).toEqual({ nightEnergy: { got: 1, need: 1 } });
    // A winter night the camp can't cover: it is shut off, and gets none.
    const winter = place(scenario(LAND, { season: 'winter' }), 'cottage', 3, 0);
    const cold = now(winter);
    expect(cold.blackouts).toContain(uidAt(winter, 3, 0));
    expect(cold.needs[uidAt(winter, 3, 0)]).toEqual({
      nightEnergy: { got: 0, need: 1 },
      heat: { got: 0, need: 1 },
    });
  });

  it('a workshop needs day energy', () => {
    const s = place(scenario(LAND), 'workshop', 3, 0);
    expect(now(s).needs[uidAt(s, 3, 0)]).toEqual({ dayEnergy: { got: 1, need: 1 } });
  });

  it('shut off in a blackout: none of its energy or heat', () => {
    const homes: [number, number][] = [
      [3, 0],
      [4, 0],
      [5, 0],
      [3, 1],
      [4, 1],
      [5, 1],
    ];
    const s = homes.reduce(
      (acc, [c, r]) => place(acc, 'cottage', c, r),
      scenario(LAND, { season: 'winter' }),
    );
    const report = now(s);
    expect(report.blackouts.length).toBeGreaterThan(0);
    for (const [c, r] of homes) {
      const uid = uidAt(s, c, r);
      const off = report.blackouts.includes(uid);
      expect(report.needs[uid]!.nightEnergy).toEqual({ got: off ? 0 : 1, need: 1 });
      expect(report.needs[uid]!.heat).toEqual({ got: off ? 0 : 1, need: 1 });
    }
  });

  it('water: what the farm got of what it needs', () => {
    const W = withWater();
    const s = place(
      scenario(LAND, { content: W, run: { water: true } }),
      'floodplainFarm',
      1,
      0,
      W,
    );
    const label = needLabels(s, now(s, W)).find((l) => l.uid === uidAt(s, 1, 0))!;
    expect(label.lines).toEqual([{ kind: 'water', got: 0, need: 1, short: true }]);
    expect(needText(label.lines[0]!)).toBe('water 0/1');
  });

  it('cooling: from the grid while it is on; none once it is shut off hot', () => {
    type Raw = typeof willowReach;
    const hot = (gridCool: boolean) =>
      withWater({
        edit: (raw: Raw) => {
          const hut = structuredClone(raw.buildings.find((b) => b.id === 'cottage')!) as Record<
            string,
            unknown
          >;
          Object.assign(hut, {
            id: 'hut',
            name: 'Hut',
            demand: { energy: { night: [0, 0, 0, 0] }, cool: { day: [0, 1, 0, 0] } },
          });
          raw.buildings.push(hut as never);
          (raw.rules as Record<string, unknown>).cooling = { range: 2, gridCool, gridCoolCost: 2 };
        },
      });
    const at = (c: Content, season: Season) =>
      place(scenario(LAND, { content: c, season }), 'hut', 3, 0, c);
    for (const [gridCool, got] of [
      [true, 1],
      [false, 0],
    ] as const) {
      const C = hot(gridCool);
      const s = at(C, 'summer');
      expect(now(s, C).needs[uidAt(s, 3, 0)]).toEqual({ cooling: { got, need: 1 } });
    }
    // No cooling needed in spring: no label at all.
    const C = hot(true);
    const spring = at(C, 'spring');
    expect(needLabels(spring, now(spring, C))).toEqual([]);
  });

  it('one label per building with a need, in priority order; none for those without', () => {
    let s = place(scenario(LAND, { season: 'winter' }), 'cottage', 3, 0);
    s = place(s, 'pollinatorMeadow', 4, 0);
    s = place(s, 'workshop', 5, 0);
    const report = now(s);
    const labels = needLabels(s, report);
    expect(labels.map((l) => l.uid)).toEqual(s.priority.filter((uid) => report.needs[uid]));
    expect(labels.map((l) => l.uid)).toContain(uidAt(s, 5, 0));
    expect(labels.map((l) => l.uid)).not.toContain(uidAt(s, 4, 0));
    const cottage = labels.find((l) => l.uid === uidAt(s, 3, 0))!;
    expect(cottage.lines.map((l) => l.kind)).toEqual(['nightEnergy', 'heat']);
  });

  it('shown on the map only while the player toggles them on', () => {
    const store = new GameStore(content, place(scenario(LAND), 'workshop', 3, 0));
    expect(store.needLabels).toEqual([]);
    store.setShowNeeds(true);
    expect(store.needLabels.map((l) => l.lines.map(needText))).toContainEqual(['day 1/1']);
    store.setShowNeeds(false);
    expect(store.needLabels).toEqual([]);
  });
});
