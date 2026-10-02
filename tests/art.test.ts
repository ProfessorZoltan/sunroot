/**
 * The hand-made art (docs/ART.md): every tile type and building has its
 * images in src/art, imported from art/incoming, and the frame's geometry
 * matches the map's.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HEX_RADIUS,
  HEX_SPACING,
  SIDE_FACTOR,
  TILE_DEPTH,
  hexCorners,
  hexToPixel,
} from '../src/render/layout';
import { TILE_TYPES } from '../src/sim';
import { content } from './helpers';

const art = (path: string) => existsSync(new URL(`../src/art/${path}`, import.meta.url));
const info = JSON.parse(readFileSync(new URL('../src/art/art.json', import.meta.url), 'utf8')) as {
  frame: [number, number];
  tileCentre: [number, number];
  tileWidth: number;
  ground: string[];
  pivots: Record<string, [number, number]>;
};

describe('hand-made art', () => {
  it('covers every tile type, in summer (two ways) and winter', () => {
    for (const t of TILE_TYPES) {
      for (const f of [`${t}.png`, `${t}-2.png`, `${t}.winter.png`])
        expect(art(`tiles/${f}`), f).toBe(true);
    }
  });

  it('covers every building in summer and winter, with an icon', () => {
    // Water buildings exist only with the water system, whose art comes with E2 (ART-EXPANSION.md).
    for (const b of content.buildings.filter((x) => !x.requiresWater && !x.requiresHeatLayer)) {
      for (const f of [
        `buildings/${b.id}.png`,
        `buildings/${b.id}.winter.png`,
        `icons/${b.id}.png`,
      ])
        expect(art(f), f).toBe(true);
    }
  });

  it('lights the homes at night and turns the wind spire and river wheel', () => {
    for (const home of ['foundersCamp', 'cottage', 'treehouseCommons'])
      expect(art(`buildings/${home}.windows.png`), home).toBe(true);
    for (const id of ['windSpire', 'riverWheel']) {
      expect(art(`buildings/${id}.rotor.png`), id).toBe(true);
      expect(info.pivots[id], id).toHaveLength(2);
    }
  });

  it('marks only buildings that stand on one kind of tile as carrying their own', () => {
    expect(info.ground).toEqual([
      'pumpedReservoir',
      'rewildedRuin',
      'salvageYard',
      'weir',
      'windSpire',
    ]);
    for (const id of info.ground) {
      const tiles = content.byId[id]!.placement.tiles;
      expect(tiles, id).toHaveLength(1);
    }
  });

  it('is imported from everything delivered', () => {
    const delivered = readdirSync(new URL('../art/incoming', import.meta.url)).filter((f) =>
      f.endsWith('.png'),
    );
    for (const f of delivered) {
      const id = f.split('.')[0]!.replace(/-\d+$/, '');
      const folder = (TILE_TYPES as readonly string[]).includes(id) ? 'tiles' : 'buildings';
      const name = f.endsWith('.lit.png') ? `${id}.windows.png` : f;
      expect(art(`${folder}/${name}`), f).toBe(true);
    }
  });
});

describe("the map's hexes match the art", () => {
  it('a tile is as wide as the art scaled, its straight sides 45% of that, its side band 8%', () => {
    const c = hexCorners({ x: 0, y: 0 }, HEX_RADIUS);
    const width = c[0]! - c[8]!;
    const side = c[3]! - c[1]!;
    expect(side / width).toBeCloseTo(180 / 400, 6);
    expect(TILE_DEPTH / width).toBeCloseTo(32 / 400, 2);
    // Slanted edges at 30°.
    expect((c[1]! - c[11]!) / (c[0]! - c[10]!)).toBeCloseTo(Math.tan(Math.PI / 6), 6);
    expect(SIDE_FACTOR).toBeCloseTo(0.779, 3);
    // The art's frame keeps the same shape.
    expect(info.tileWidth / info.frame[0]).toBeCloseTo(400 / 512, 6);
  });

  it('neighbouring tiles meet edge to edge', () => {
    const at = hexToPixel({ q: 0, r: 0 });
    const right = hexToPixel({ q: 1, r: 0 });
    const below = hexToPixel({ q: 0, r: 1 });
    const a = hexCorners(at, HEX_SPACING);
    const b = hexCorners(right, HEX_SPACING);
    const d = hexCorners(below, HEX_SPACING);
    // The right neighbour's left side is this tile's right side.
    expect([b[8], b[9], b[6], b[7]].map((v) => v!.toFixed(6))).toEqual(
      [a[0], a[1], a[2], a[3]].map((v) => v!.toFixed(6)),
    );
    // The lower-right neighbour's top corner is this tile's lower-right corner, and its upper-left
    // corner this tile's bottom corner: they share that edge.
    expect([d[10], d[11]].map((v) => v!.toFixed(6))).toEqual(
      [a[2], a[3]].map((v) => v!.toFixed(6)),
    );
    expect([d[8], d[9]].map((v) => v!.toFixed(6))).toEqual([a[4], a[5]].map((v) => v!.toFixed(6)));
  });
});
