/**
 * Screen layout for the pointy-top hex map. Tiles sit 30 px apart (centre to
 * corner), are drawn 1 px smaller so a paper-coloured gap shows between them,
 * and stand on a 4 px darker side for depth.
 *
 * The hexes are a little flatter than regular ones, to match the hand-made
 * art (docs/ART.md): the slanted edges keep their 30° slope, and the vertical
 * sides are SIDE_FACTOR of a regular hexagon's. The tiles still fit together
 * edge to edge.
 */
import { hexKey, hexNeighbors, hexesWithin, type Hex } from '../sim/hex';
import type { MapState } from '../sim/types';

export const HEX_SPACING = 30;
export const HEX_RADIUS = 29;
export const TILE_DEPTH = 4;
/**
 * A vertical side's length as a share of a regular hexagon's (1 is regular):
 * the art's straight sides are 180 px on a tile 400 px wide.
 */
export const SIDE_FACTOR = 180 / (400 / Math.sqrt(3));
const SQRT3 = Math.sqrt(3);
/** From a tile's centre to its top or bottom corner, for a hex of radius 1. */
export const HALF_HEIGHT = (1 + SIDE_FACTOR) / 2;
/** Between the centres of neighbouring rows, for a hex of radius 1. */
const ROW_STEP = 0.5 + SIDE_FACTOR;

export interface Point {
  x: number;
  y: number;
}

export function hexToPixel(h: Hex): Point {
  return { x: HEX_SPACING * SQRT3 * (h.q + h.r / 2), y: HEX_SPACING * ROW_STEP * h.r };
}

/** The hex under a point: the nearest centre's, checked against its neighbours' outlines. */
export function pixelToHex(p: Point): Hex {
  const r = p.y / (HEX_SPACING * ROW_STEP);
  const q = p.x / (HEX_SPACING * SQRT3) - r / 2;
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  const guess = { q: rq + 0, r: rr + 0 };
  // Rounding is exact for regular hexes; near a flattened hex's corners, a neighbour may hold the point.
  if (inside(p, guess)) return guess;
  return hexNeighbors(guess).find((n) => inside(p, n)) ?? guess;
}

function inside(p: Point, h: Hex): boolean {
  const c = hexToPixel(h);
  const dx = Math.abs(p.x - c.x) / HEX_SPACING;
  const dy = Math.abs(p.y - c.y) / HEX_SPACING;
  const w = SQRT3 / 2;
  return dx <= w && dy <= HALF_HEIGHT - (dx / w) * 0.5 + 1e-9;
}

/** Corner points of a pointy-top hex, flattened [x0, y0, x1, y1, ...]. */
export function hexCorners(center: Point, radius = HEX_RADIUS): number[] {
  const w = (SQRT3 / 2) * radius;
  const top = HALF_HEIGHT * radius;
  const side = (SIDE_FACTOR / 2) * radius;
  // Clockwise from the upper right corner, as before: right top, right bottom, bottom, ...
  return [
    center.x + w,
    center.y - side,
    center.x + w,
    center.y + side,
    center.x,
    center.y + top,
    center.x - w,
    center.y + side,
    center.x - w,
    center.y - side,
    center.x,
    center.y - top,
  ];
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
