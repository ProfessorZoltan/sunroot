/**
 * Walks to water (DECISIONS.md, Walks to water): with walks to work and the
 * water system both on, each home someone lives in walks to the nearest
 * drinking water, and long walks cost wellbeing. The Well joins with it.
 *
 * The maps are a row of barren land with the river in the first column: a
 * tile's distance from the river is its column.
 */
import { describe, expect, it } from 'vitest';
import { canPlace, type RunState } from '../src/sim';
import { at, content, endSeason, place, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });
const ROW = ['~ C . . . . . . . . . .', '~ , , , , , , , , , , ,', '~ , , , , , , , , , , ,'];
const free = W.rules.commute.toWater!.freeDistance;
const per = W.rules.commute.toWater!.tilesPerWellbeing;

const start = (citizens = 9, run: { commute?: boolean } = { commute: true }) =>
  scenario(ROW, { content: W, citizens, stores: { food: 500 }, run });
const toWater = (s: RunState) => s.lastReport!.commute!.toWater!;
const line = (s: RunState) =>
  s.lastReport!.wellbeing.lines.find((l) => l.reason.startsWith('long walks to water'));

describe('walks to water', () => {
  it('each lived-in home walks to the nearest drinking water; tiles beyond the free distance cost wellbeing', () => {
    // The camp beside the river; a cottage 8 tiles out, lived in by the 3 beyond the camp's 6.
    const s = endSeason(place(start(), 'cottage', 8, 0, W), W);
    const cottage = uidAt(s, 8, 0);
    expect(toWater(s).homes).toEqual({
      b0: { distance: 1, source: 'river' },
      [cottage]: { distance: 8, source: 'river' },
    });
    expect(toWater(s).excess).toBe(8 - free);
    expect(line(s)).toEqual({
      kind: 'commute',
      reason: `long walks to water (${8 - free} tiles beyond ${free})`,
      amount: -Math.floor((8 - free) / per),
    });
  });

  it('an empty home walks nowhere', () => {
    const s = endSeason(place(start(6), 'cottage', 8, 0, W), W);
    expect(Object.keys(toWater(s).homes)).toEqual(['b0']);
    expect(line(s)).toBeUndefined();
  });

  it('a well, a channel or a cistern is drinking water too', () => {
    let s = place(start(), 'cottage', 8, 0, W);
    expect(s.unlocked).toContain('well');
    s = place(s, 'well', 9, 0, W);
    s = endSeason(s, W);
    expect(toWater(s).homes[uidAt(s, 8, 0)]).toEqual({ distance: 1, source: 'well' });
    expect(line(s)).toBeUndefined();

    let c = place(start(), 'cottage', 4, 2, W);
    c = ['irrigationChannel', 'irrigationChannel', 'irrigationChannel'].reduce(
      (acc, id, i) => place(acc, id, 1 + i, 2, W),
      c,
    );
    c = endSeason(c, W);
    expect(toWater(c).homes[uidAt(c, 4, 2)]).toEqual({
      distance: 1,
      source: 'irrigationChannel',
    });
  });

  it('is off without walks to work, and without water; the Well with it', () => {
    const noWalks = endSeason(place(start(9, {}), 'cottage', 8, 0, W), W);
    expect(noWalks.lastReport!.commute).toBeNull();
    expect(noWalks.unlocked).not.toContain('well');
    const r = canPlace(W, start(9, {}), 'well', at(5, 0));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/joins when homes walk to water/);

    const dry = endSeason(
      place(
        scenario(ROW, { citizens: 9, stores: { food: 500 }, run: { commute: true } }),
        'cottage',
        8,
        0,
      ),
    );
    expect(dry.lastReport!.commute!.toWater).toBeUndefined();
    expect(content.byId.well!.requiresWalks).toBe(true);
  });
});
