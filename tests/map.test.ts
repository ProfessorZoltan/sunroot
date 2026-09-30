import { describe, expect, it } from 'vitest';
import { axialToOffset, computeHarmony, createRun, generateMap, hexDistance } from '../src/sim';
import { content } from './helpers';

const SEEDS = Array.from({ length: 60 }, (_, i) => `seed-${i}`);

describe('Willow Reach map generation', () => {
  it('is deterministic per seed and varies between seeds', () => {
    expect(generateMap(content, 'a')).toEqual(generateMap(content, 'a'));
    expect(generateMap(content, 'a')).not.toEqual(generateMap(content, 'b'));
  });

  it.each(SEEDS)('%s: a 120-tile valley with a river, floodplain, hills and ruins', (seed) => {
    const { map, camp } = generateMap(content, seed);
    const tiles = Object.values(map.tiles);
    expect(tiles).toHaveLength(120);
    const count = (type: string) => tiles.filter((t) => t.type === type).length;

    // The river runs from the top edge to the bottom edge without gaps.
    expect(map.river).toHaveLength(map.height);
    const river = map.river.map((k) => map.tiles[k]!);
    river.forEach((t, i) => {
      expect(t.riverIndex).toBe(i);
      if (i > 0) expect(hexDistance(t, river[i - 1]!)).toBe(1);
    });

    // Floodplain lies within 2 tiles of the river, on most of both banks.
    const riverDistance = (h: { q: number; r: number }) =>
      Math.min(...river.map((r) => hexDistance(h, r)));
    for (const t of tiles.filter((x) => x.type === 'floodplain')) {
      expect(riverDistance(t)).toBeLessThanOrEqual(2);
    }
    expect(count('floodplain')).toBeGreaterThanOrEqual(10);
    expect(map.floodOrder).toHaveLength(count('floodplain'));

    // Hills only at the edges.
    for (const t of tiles.filter((x) => x.type === 'hill')) {
      const { col } = axialToOffset(t);
      expect(col < 2 || col >= map.width - 2).toBe(true);
    }
    expect(count('hill')).toBeGreaterThan(0);

    expect(count('ruin')).toBe(content.map.ruins);
    for (const t of tiles.filter((x) => x.type === 'ruin')) expect(t.salvage).toBe(24);

    // The camp stands on plain land near the river, and some river bank is dry.
    const campTile = map.tiles[`${camp.q},${camp.r}`]!;
    expect(['barren', 'scrub']).toContain(campTile.type);
    expect(riverDistance(camp)).toBeGreaterThanOrEqual(2);
    expect(riverDistance(camp)).toBeLessThanOrEqual(3);
  });

  it.each(SEEDS)('%s: starts at Harmony 18', (seed) => {
    const s = createRun(content, { seed });
    expect(s.harmony).toBe(18);
    expect(computeHarmony(content, s)).toBe(18);
  });
});
