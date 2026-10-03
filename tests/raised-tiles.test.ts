/**
 * Raised tiles on screen (HL4): the Highland's tiles stand LIFT px a step above
 * the ground, and the pointer finds the front-most raised tile it is over.
 * Level land is placed exactly as before.
 */
import { afterEach, describe, expect, it } from 'vitest';
import {
  LIFT,
  groundPixel,
  hexToPixel,
  liftOf,
  pixelToHex,
  setHeights,
} from '../src/render/layout';
import { hexKey, type Hex } from '../src/sim/hex';
import type { MapState } from '../src/sim/types';

/** A map of the given tiles at the given heights. */
function land(tiles: [Hex, number][]): MapState {
  return {
    tiles: Object.fromEntries(
      tiles.map(([h, height]) => [hexKey(h), { ...h, type: 'meadow' as const, height }]),
    ),
  } as unknown as MapState;
}

afterEach(() => setHeights(null));

describe('raised tiles', () => {
  it('level land is placed as before', () => {
    const h = { q: 2, r: 3 };
    setHeights(land([[h, 0]]));
    expect(hexToPixel(h)).toEqual(groundPixel(h));
    expect(pixelToHex(groundPixel(h))).toEqual(h);
  });

  it('a tile stands LIFT px higher for each step of height', () => {
    const h = { q: 1, r: 1 };
    setHeights(land([[h, 3]]));
    expect(liftOf(h)).toBe(3 * LIFT);
    expect(hexToPixel(h).y).toBe(groundPixel(h).y - 3 * LIFT);
    expect(hexToPixel(h).x).toBe(groundPixel(h).x);
  });

  it('the pointer finds a raised tile at its raised centre', () => {
    const h = { q: 1, r: 1 };
    setHeights(land([[h, 2]]));
    expect(pixelToHex(hexToPixel(h))).toEqual(h);
  });

  it('a raised tile in front covers the low one behind it', () => {
    const back = { q: 1, r: 0 };
    const front = { q: 0, r: 1 };
    setHeights(
      land([
        [back, 0],
        [front, 3],
      ]),
    );
    // Just above the front tile's raised top corner lies the back tile's lower half: covered.
    const top = hexToPixel(front);
    const p = { x: top.x, y: top.y - 20 };
    expect(pixelToHex(p)).toEqual(front);
    // With the front tile level again, the same point is the back tile's.
    setHeights(
      land([
        [back, 0],
        [front, 0],
      ]),
    );
    expect(pixelToHex(p)).toEqual(back);
  });
});
