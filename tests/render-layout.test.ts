import { describe, expect, it } from 'vitest';
import { BUILDING_ART } from '../src/render/buildingArt';
import { fogHexes, hexCorners, hexToPixel, pixelToHex } from '../src/render/layout';
import { TILE_COLORS } from '../src/render/palette';
import { TILE_TYPES, generateMap, hexDistance } from '../src/sim';
import { content } from './helpers';

describe('map layout', () => {
  it('turns every hex centre back into the same hex', () => {
    for (let q = -12; q <= 12; q++) {
      for (let r = -12; r <= 12; r++) expect(pixelToHex(hexToPixel({ q, r }))).toEqual({ q, r });
    }
  });

  it('finds the hex under any point inside a tile', () => {
    const h = { q: 3, r: 4 };
    const c = hexToPixel(h);
    const corners = hexCorners(c, 27);
    for (let i = 0; i < 12; i += 2) {
      expect(pixelToHex({ x: corners[i]!, y: corners[i + 1]! })).toEqual(h);
    }
  });

  it('rings the valley with fog that never covers a tile', () => {
    const { map } = generateMap(content, 'fog');
    const fog = fogHexes(map);
    const valley = Object.values(map.tiles);
    for (const f of fog) {
      expect(map.tiles[`${f.q},${f.r}`]).toBeUndefined();
      expect(Math.min(...valley.map((t) => hexDistance(t, f)))).toBeLessThanOrEqual(2);
    }
  });
});

describe('art', () => {
  it('has a drawing for every building and colours for every tile type', () => {
    // Water buildings are drawn with the water system's screens (E2).
    for (const b of content.buildings.filter((x) => !x.requiresWater))
      expect(BUILDING_ART[b.id], b.id).toBeTypeOf('function');
    for (const t of TILE_TYPES) expect(TILE_COLORS[t], t).toBeDefined();
  });
});
