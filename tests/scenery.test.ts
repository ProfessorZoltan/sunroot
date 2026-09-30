import { describe, expect, it } from 'vitest';
import { wildlifeFor } from '../src/render/seasonArt';
import { createRun } from '../src/sim';
import { content } from './helpers';

describe('wildlife returns with Harmony', () => {
  it('birds from tier 2, deer from tier 3, otters from tier 4', () => {
    const s = createRun(content, { seed: 'wildlife' });
    const at = (harmony: number) => {
      const w = wildlifeFor(content, { ...s, harmony });
      return { birds: w.birds, deer: w.deer.length, otters: w.otters.length };
    };
    expect(at(19)).toEqual({ birds: false, deer: 0, otters: 0 });
    expect(at(20)).toEqual({ birds: true, deer: 0, otters: 0 });
    expect(at(40)).toEqual({ birds: true, deer: 3, otters: 0 });
    expect(at(70)).toEqual({ birds: true, deer: 3, otters: 2 });
  });

  it('places animals the same way every time, never on a building', () => {
    const s = { ...createRun(content, { seed: 'wildlife' }), harmony: 80 };
    expect(wildlifeFor(content, s)).toEqual(wildlifeFor(content, s));
  });
});
