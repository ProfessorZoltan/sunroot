/**
 * Screen layout for the pointy-top hex map, matching the mockup: tiles sit
 * 30 px apart (centre to corner), are drawn 1 px smaller so a paper-coloured
 * gap shows between them, and stand on a 4.5 px darker side for depth.
 */
import { hexKey, hexesWithin, type Hex } from '../sim/hex';
import type { MapState } from '../sim/types';

export const HEX_SPACING = 30;
export const HEX_RADIUS = 29;
export const TILE_DEPTH = 4.5;
const SQRT3 = Math.sqrt(3);

export interface Point {
  x: number;
  y: number;
}

export function hexToPixel(h: Hex): Point {
  return { x: HEX_SPACING * SQRT3 * (h.q + h.r / 2), y: HEX_SPACING * 1.5 * h.r };
}

/** The hex under a point, by cube rounding. */
export function pixelToHex(p: Point): Hex {
  const q = ((SQRT3 / 3) * p.x - p.y / 3) / HEX_SPACING;
  const r = ((2 / 3) * p.y) / HEX_SPACING;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

/** Corner points of a pointy-top hex, flattened [x0, y0, x1, y1, ...]. */
export function hexCorners(center: Point, radius = HEX_RADIUS): number[] {
  const out: number[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    out.push(center.x + radius * Math.cos(angle), center.y + radius * Math.sin(angle));
  }
  return out;
}

/** Fog: hexes within `rings` of the valley that are not part of it. */
export function fogHexes(map: MapState, rings = 2): Hex[] {
  const seen = new Set(Object.keys(map.tiles));
  const out: Hex[] = [];
  for (const t of Object.values(map.tiles)) {
    for (const h of hexesWithin(t, rings)) {
      const key = hexKey(h);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(h);
    }
  }
  return out.sort((a, b) => a.r - b.r || a.q - b.q);
}

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(hexes: Hex[]): Bounds {
  const pts = hexes.map(hexToPixel);
  return {
    minX: Math.min(...pts.map((p) => p.x)) - HEX_SPACING,
    minY: Math.min(...pts.map((p) => p.y)) - HEX_SPACING,
    maxX: Math.max(...pts.map((p) => p.x)) + HEX_SPACING,
    maxY: Math.max(...pts.map((p) => p.y)) + HEX_SPACING + TILE_DEPTH,
  };
}

/** A small deterministic random stream per tile, so tile details never flicker. */
export function tileRandom(key: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
