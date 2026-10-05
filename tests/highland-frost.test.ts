/**
 * The Highland's late frost (research: waru waru): the snowmelt brings a frost on spring nights,
 * and farms up the slope make less for the rest of the year unless standing water beside them
 * gives back the day's warmth.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import type { RunState } from '../src/sim';
import { at, endSeason, place, scenario, uidAt } from './helpers';

const HIGH = biomeContent('highland');
// A slope above the stream: the top rows at height 1; the banks at the stream's two ends at 0 (the camp's channel takes the west one).
const SLOPE = [', , , , ,', ', , , , ,', ', C , , ,', ', , , , ,', '~ ~ ~ ~ ~'];
const HEIGHTS = ['1 1 1 1 1', '1 1 1 1 1', '1 1 1 1 1', '0 1 1 1 0', '0 0 0 0 0'];
const start = (season: 'spring' | 'summer' = 'spring') =>
  scenario(SLOPE, {
    content: HIGH,
    season,
    heights: HEIGHTS,
    citizens: 12,
    stores: { food: 80 },
    run: { water: true },
  });
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 80 } }, HIGH);
const food = (s: RunState, c: number, r: number) => s.lastReport!.yields[uidAt(s, c, r)]?.food ?? 0;

/** Terraces: one in the open, one by the stream, one beside a cistern. */
function terraces(): RunState {
  let s = start();
  for (const [c, r] of [
    [4, 0],
    [2, 3],
    [0, 0],
  ] as const)
    s = place(s, 'terraceFarm', c, r, HIGH);
  // A cistern beside the third, set down as it stands (its own placement wants a channel).
  s.buildings.bc = { uid: 'bc', type: 'cistern', at: at(1, 0), builtTurn: 0 };
  s.priority.push('bc');
  return s;
}

describe('the late frost', () => {
  it('strikes the farms up the slope with no standing water beside them', () => {
    const s = end(terraces());
    expect(s.lastReport!.frosted).toEqual([uidAt(s, 4, 0)]);
    expect(new Set(s.lastReport!.frostSpared)).toEqual(new Set([uidAt(s, 2, 3), uidAt(s, 0, 0)]));
  });

  it('costs 1 food in summer and in autumn, and nothing the next year', () => {
    let s = end(terraces());
    s = end(s); // summer
    expect(food(s, 4, 0)).toBe(food(s, 2, 3) - 1);
    expect(s.lastReport!.math[uidAt(s, 4, 0)]!.join(' ')).toMatch(/−1 late frost/);
    s = end(s); // autumn
    expect(food(s, 4, 0)).toBe(food(s, 0, 0) - 1);
    s = end(end(s)); // winter, then a new spring: the frost is a new year's to strike
    expect(s.buildings[uidAt(s, 4, 0)]!.frostYear).toBe(2);
  });

  it('spares a farm built after the frost, and farms on the valley floor', () => {
    let s = place(start('summer'), 'terraceFarm', 4, 0, HIGH);
    s = end(s);
    expect(s.buildings[uidAt(s, 4, 0)]!.frostYear).toBeUndefined();
    const floor = end(place(start(), 'glenFarm', 4, 3, HIGH));
    expect(floor.lastReport!.frosted ?? []).not.toContain(uidAt(floor, 4, 3));
  });
});
