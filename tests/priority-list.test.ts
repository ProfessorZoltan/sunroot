/**
 * The priority list's moves (game/priorities.ts): several buildings at once, and presets by kind.
 * The camp (b0) stays first throughout.
 */
import { describe, expect, it } from 'vitest';
import { PRESETS, applyPreset, moveGroup, nudge, toEnd } from '../src/game/priorities';
import type { BuildingKind } from '../src/sim/content/schema';

const ORDER = ['b0', 'a', 'b', 'c', 'd', 'e'];
const set = (...uids: string[]) => new Set(uids);

describe('moving several buildings at once', () => {
  it('dragged together onto a row: before it going up, after it going down', () => {
    expect(moveGroup(ORDER, set('c', 'e'), 1)).toEqual(['b0', 'c', 'e', 'a', 'b', 'd']);
    expect(moveGroup(ORDER, set('a', 'c'), 4)).toEqual(['b0', 'b', 'd', 'a', 'c', 'e']);
    // Never above the camp, and the camp never moves.
    expect(moveGroup(ORDER, set('d', 'b0'), 0)).toEqual(['b0', 'd', 'a', 'b', 'c', 'e']);
    expect(moveGroup(ORDER, set('a', 'b'), 2)).toEqual(ORDER);
  });

  it('one place up or down, past the others, keeping their order', () => {
    expect(nudge(ORDER, set('b', 'd'), -1)).toEqual(['b0', 'b', 'a', 'd', 'c', 'e']);
    expect(nudge(ORDER, set('a', 'b'), -1)).toEqual(ORDER);
    expect(nudge(ORDER, set('d', 'e'), 1)).toEqual(ORDER);
    expect(nudge(ORDER, set('a', 'c'), 1)).toEqual(['b0', 'b', 'a', 'd', 'c', 'e']);
  });

  it('to the top (after the camp) or the bottom', () => {
    expect(toEnd(ORDER, set('d', 'b'), 'top')).toEqual(['b0', 'b', 'd', 'a', 'c', 'e']);
    expect(toEnd(ORDER, set('a', 'c', 'b0'), 'bottom')).toEqual(['b0', 'b', 'd', 'e', 'a', 'c']);
  });
});

describe('presets by kind', () => {
  const kinds: Record<string, BuildingKind> = {
    b0: 'home',
    a: 'industry',
    b: 'food',
    c: 'energy',
    d: 'food',
    e: 'home',
  };
  const kindOf = (uid: string) => kinds[uid];
  const preset = (id: string) => PRESETS.find((p) => p.id === id)!;

  it('sort by kind, each kind keeping its own order', () => {
    expect(applyPreset(ORDER, kindOf, preset('food'))).toEqual(['b0', 'b', 'd', 'e', 'c', 'a']);
    expect(applyPreset(ORDER, kindOf, preset('energy'))).toEqual(['b0', 'c', 'b', 'd', 'e', 'a']);
  });

  it('every preset ranks every kind once', () => {
    for (const p of PRESETS) expect(new Set(p.kinds).size).toBe(8);
  });
});
