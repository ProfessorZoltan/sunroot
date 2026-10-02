/** The marks drifting along a channel move downstream, from its intake to its end. */
import { describe, expect, it } from 'vitest';
import { markOffset } from '../src/render/waterArt';

describe('channel flow marks', () => {
  it('drift away from the intake as time passes', () => {
    // A mark at the head of the first segment moves further along it.
    expect(markOffset(0, 0)).toBe(0);
    expect(markOffset(2, 0)).toBe(2);
    expect(markOffset(5, 0)).toBe(5);
  });

  it('line up across segments: a mark 4 along the stream sits 1 into a segment starting at 3', () => {
    expect(markOffset(4, 3)).toBe(1);
    expect(markOffset(13, 3)).toBe(1);
  });
});
