/**
 * Commuting (DECISIONS.md, Teaching by layers; milestone C1): who lives
 * where, who walks to which work, and what long walks cost. Off in the game
 * until it can be seen (C2), so these tests turn it on with the run option.
 *
 * The maps are one long row of barren land: a tile's distance from another
 * in the same row is the difference in columns.
 */
import { describe, expect, it } from 'vitest';
import {
  createCity,
  forecastSeason,
  nextRunOptions,
  resolveAsIs,
  teaching,
  type CityState,
  type RunState,
} from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { loadContent } from '../src/sim';
import { content, endSeason, place, scenario, uidAt } from './helpers';

// The camp at column 1; workplaces along the row.
const ROW = ['. C . . . . . . . . . .', ', , , , , , , , , , , ,', ', , , , , , , , , , , ,'];

const start = (citizens = 6) =>
  scenario(ROW, { citizens, stores: { food: 500 }, run: { commute: true } });
const commute = (s: RunState) => s.lastReport!.commute!;
const walks = (s: RunState, col: number, row = 0) => commute(s).walks[uidAt(s, col, row)]!;

describe('who lives where', () => {
  it('with no work, citizens fill homes in priority order, the camp first; the rest live at the camp', () => {
    let s = place(start(10), 'cottage', 8, 0);
    s = endSeason(s);
    // The camp houses 6, the cottage 3; the tenth citizen lives at the camp too.
    expect(commute(s).residents).toEqual({ b0: 7, [uidAt(s, 8, 0)]: 3 });
  });

  it('is off unless the run has it', () => {
    const s = endSeason(scenario(ROW, { stores: { food: 500 } }));
    expect(s.lastReport!.commute).toBeNull();
  });
});

describe('who walks where', () => {
  it('each worker comes from the nearest home with someone free', () => {
    let s = place(start(8), 'cottage', 9, 0);
    // Built in this order, so the far workshop is staffed first.
    s = place(s, 'workshop', 10, 0);
    s = place(s, 'workshop', 3, 0);
    s = endSeason(s);
    const cottage = uidAt(s, 9, 0);
    expect(walks(s, 10)).toEqual([{ home: cottage, distance: 1 }]);
    expect(walks(s, 3)).toEqual([{ home: 'b0', distance: 2 }]);
  });

  it('higher-priority work takes the nearest workers first', () => {
    // A cottage of 3 at column 9, and 3 citizens beyond the camp's 6 to live in it.
    let s = place(start(9), 'cottage', 9, 0);
    s = place(s, 'workshop', 11, 0);
    s = place(s, 'workshop', 10, 0);
    s = place(s, 'workshop', 8, 0);
    s = place(s, 'workshop', 7, 0);
    s = endSeason(s);
    const cottage = uidAt(s, 9, 0);
    // The first three take the cottage's 3; the fourth walks from the camp.
    expect([11, 10, 8].map((c) => walks(s, c)[0]!.home)).toEqual([cottage, cottage, cottage]);
    expect(walks(s, 7)).toEqual([{ home: 'b0', distance: 6 }]);
  });
});

describe('what long walks cost', () => {
  it('walks up to 2 tiles are free; every 3 tiles beyond cost 1 wellbeing', () => {
    let s = place(start(), 'workshop', 3, 0);
    s = endSeason(s);
    expect(walks(s, 3)).toEqual([{ home: 'b0', distance: 2 }]);
    expect(commute(s)).toMatchObject({ excess: 0, wellbeing: 0 });

    // 9 and 10 tiles from the camp: 7 + 8 = 15 beyond the free 2, so −5.
    let t = place(start(), 'workshop', 10, 0);
    t = place(t, 'workshop', 11, 0);
    t = endSeason(t);
    expect(commute(t)).toMatchObject({ excess: 15, wellbeing: -5 });
    const line = t.lastReport!.wellbeing.lines.find((l) => l.kind === 'commute');
    expect(line).toEqual({
      kind: 'commute',
      reason: 'long walks to work (15 tiles beyond 2)',
      amount: -5,
    });
  });

  it('a cottage beside the work takes the cost away: workers move in, though the camp has room', () => {
    let far = place(start(), 'workshop', 10, 0);
    far = place(far, 'workshop', 11, 0);
    let near = place(far, 'cottage', 9, 0);
    far = endSeason(far);
    near = endSeason(near);
    expect(commute(far).wellbeing).toBeLessThan(0);
    expect(commute(near)).toMatchObject({ excess: 0, wellbeing: 0 });
    expect(near.wellbeing - far.wellbeing).toBe(-commute(far).wellbeing);
    // The two workers live in the cottage; the other 4 citizens at the camp.
    expect(commute(near).residents).toEqual({ b0: 4, [uidAt(near, 9, 0)]: 2 });
  });

  it('unstaffed and damaged workplaces have no walks', () => {
    let s = place(start(6), 'workshop', 10, 0);
    s.buildings[uidAt(s, 10, 0)]!.damage = { cause: 'storm', turn: s.turn };
    s = endSeason(s);
    expect(commute(s).walks[uidAt(s, 10, 0)]).toBeUndefined();
    expect(commute(s).excess).toBe(0);
  });

  it('a forecast sees the same walks as the season itself', () => {
    const s = place(start(), 'workshop', 10, 0);
    expect(forecastSeason(content, s).lastReport!.commute).toEqual(
      resolveAsIs(content, s).lastReport!.commute,
    );
  });
});

describe('the teaching ladder', () => {
  it('joins at run 3, and with the full valley from any run', () => {
    expect(content.progression!.teaching.commute).toBe(3);
    expect(teaching(content, 2).commute).toBe(false);
    expect(teaching(content, 3)).toMatchObject({ commute: true });
    expect(teaching(content, 3).joining).toEqual(['charters', 'commute']);
    const first = createCity(content, 'c');
    expect(nextRunOptions(content, first).commute).toBeUndefined();
    expect(nextRunOptions(content, { ...first, fullValley: true }).commute).toBe(true);
    const third: CityState = { ...first, runs: 2 };
    expect(nextRunOptions(content, third)).toMatchObject({ water: true, commute: true });
  });

  it('a city whose ladder has no commuting never gets it, even with the full valley', () => {
    const raw = structuredClone(willowReach);
    delete (raw.progression.teaching as { commute?: number }).commute;
    const unlisted = loadContent(raw);
    expect(teaching(unlisted, 5).commute).toBe(false);
    const city: CityState = { ...createCity(unlisted, 'c'), runs: 5, fullValley: true };
    expect(nextRunOptions(unlisted, city).commute).toBeUndefined();
  });
});
