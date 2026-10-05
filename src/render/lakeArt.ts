/**
 * Lake Gardens' lake on the map (LG4), drawn over the tiles, art or not: the mud lying on the
 * shallows, shallows that have silted up, the water turning murky as grey water gathers and green
 * when it blooms, and in winter the water fallen back from the shallows' rim. What to draw is
 * plain data from the run (`lakeLook`, tested); drawing it is `drawLake`.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexKey, hexNeighbors, type Hex } from '../sim/hex';
import type { RunState } from '../sim/types';
import { HEX_RADIUS, hexCorners, hexToPixel, tileRandom, type Point } from './layout';

export interface LakeLook {
  /** Shallows holding mud, and how much (silted ones apart). */
  mud: { at: Hex; mud: number }[];
  silted: Hex[];
  /** The lake's water: shallows and deep. */
  water: Hex[];
  /** 0 (clear) to 1: how murky its grey water makes it, short of a bloom. */
  murk: number;
  /** It bloomed last season, and is green until the next. */
  bloom: boolean;
  /** Winter: the shallows have fallen back from their rims. */
  low: boolean;
  /** One look for the run's state: redraw when it changes. */
  signature: string;
}

export function lakeLook(content: Content, state: RunState): LakeLook | null {
  const rules = content.rules.lake;
  if (!rules || !state.lake) return null;
  const mud: LakeLook['mud'] = [];
  const silted: Hex[] = [];
  const water: Hex[] = [];
  for (const t of Object.values(state.map.tiles)) {
    if (t.type !== 'shallows' && t.type !== 'deep') continue;
    const at = { q: t.q, r: t.r };
    water.push(at);
    if (t.silted) silted.push(at);
    else if ((t.mud ?? 0) > 0) mud.push({ at, mud: t.mud! });
  }
  const bloom = state.lastReport?.lake?.bloom === true;
  const murk = bloom ? 0 : Math.min(1, state.lake.grey / (rules.bloom.above + 1));
  const low = state.season === 'winter';
  return {
    mud,
    silted,
    water,
    murk,
    bloom,
    low,
    signature: [
      mud.map((m) => `${hexKey(m.at)}:${m.mud}`).join(','),
      silted.map(hexKey).join(','),
      murk.toFixed(2),
      bloom,
      low,
    ].join('|'),
  };
}

const MUD = 0x6e6248;
const SEDGE = 0x7d8a4a;
const ALGAE = 0x8fbf4a;
const MURK = 0x9a9a62;

/** A point inside the hex top, away from the edge. */
function spot(rand: () => number, c: Point, spread = HEX_RADIUS * 0.5): Point {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * spread;
  return { x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.9 };
}

export function drawLake(
  g: Graphics,
  look: LakeLook,
  state: RunState,
  /** Shallows with hand-made art show low water in their own winter look; and silted ones. */
  art: { lowWater: boolean; silted: boolean },
): void {
  g.clear();
  const shallows = new Set(
    Object.values(state.map.tiles)
      .filter((t) => t.type === 'shallows')
      .map(hexKey),
  );
  // Low water: the shallows fall back from the shore, leaving wet mud along each side that
  // touches land, and a few lily pads stranded on it.
  if (look.low && !art.lowWater)
    for (const key of shallows) {
      const t = state.map.tiles[key]!;
      const c = hexToPixel(t);
      drawShoreMud(g, c, shoreSides(state, t), tileRandom(`${key}:low`));
    }
  // Murky, then green: the whole lake at once.
  for (const at of look.water) {
    const c = hexToPixel(at);
    const corners = hexCorners(c, HEX_RADIUS - 2);
    if (look.bloom) {
      g.poly(corners).fill({ color: ALGAE, alpha: 0.42 });
      const rand = tileRandom(`${hexKey(at)}:bloom`);
      for (let i = 0; i < 5; i++) {
        const p = spot(rand, c);
        g.ellipse(p.x, p.y, 3 + rand() * 3, 1.6 + rand()).fill({ color: 0x6f9a3a, alpha: 0.7 });
      }
    } else if (look.murk > 0) {
      g.poly(corners).fill({ color: MURK, alpha: 0.22 * look.murk });
    }
  }
  // Mud on the shallows: dark patches, one for each.
  for (const { at, mud } of look.mud) {
    const c = hexToPixel(at);
    const rand = tileRandom(`${hexKey(at)}:mud`);
    for (let i = 0; i < Math.min(4, mud); i++) {
      const p = spot(rand, c, HEX_RADIUS * 0.42);
      g.ellipse(p.x, p.y, 5.5, 2.8).fill({ color: MUD, alpha: 0.6 });
    }
  }
  // Silted up: mud banks and thick sedge, a little standing water.
  if (!art.silted)
    for (const at of look.silted) {
      const c = hexToPixel(at);
      const rand = tileRandom(`${hexKey(at)}:silted`);
      g.poly(hexCorners(c, HEX_RADIUS - 3)).fill({ color: 0x7a6a4c, alpha: 0.75 });
      g.ellipse(c.x + 4, c.y + 3, 7, 3).fill({ color: 0x8fb0a0, alpha: 0.8 });
      for (let i = 0; i < 7; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.55);
        g.moveTo(p.x - 2.5, p.y - 5)
          .lineTo(p.x, p.y)
          .lineTo(p.x + 2.5, p.y - 5)
          .moveTo(p.x, p.y)
          .lineTo(p.x, p.y - 6)
          .stroke({ width: 1.2, color: SEDGE, cap: 'round', join: 'round' });
      }
    }
}

/** How long the rings spread round a raised bed just made. */
export const BED_RISE_MS = 1400;

/** Rings spreading on the water round a bed rising out of it; `p` runs 0 to 1. */
export function drawBedRising(g: Graphics, c: Point, p: number): void {
  for (let k = 0; k < 3; k++) {
    const q = p * 1.3 - k * 0.18;
    if (q <= 0 || q >= 1) continue;
    const r = HEX_RADIUS * (0.7 + q * 0.9);
    g.ellipse(c.x, c.y + 2, r, r * 0.55).stroke({
      width: 1.6,
      color: 0xffffff,
      alpha: 0.75 * (1 - q),
    });
  }
}

/** The corners (in `hexCorners` order) either side of each neighbour's direction. */
const SIDE_CORNERS: readonly [number, number][] = [
  [0, 1],
  [5, 0],
  [4, 5],
  [3, 4],
  [2, 3],
  [1, 2],
];

/** The sides of a shallows tile that touch land (in `hexNeighbors` order), where low water shows. */
export function shoreSides(state: RunState, at: Hex): number[] {
  return hexNeighbors(at)
    .map((n, i) => ({ t: state.map.tiles[hexKey(n)], i }))
    .filter(({ t }) => t !== undefined && t.type !== 'shallows' && t.type !== 'deep')
    .map(({ i }) => i);
}

/**
 * Wet mud along each shore side: the strip between that edge and a line a third of the way in.
 * Side i lies between the corners either side of neighbour i's direction.
 */
function drawShoreMud(g: Graphics, c: Point, sides: number[], rand: () => number): void {
  const outer = hexCorners(c, HEX_RADIUS - 2);
  const inner = hexCorners(c, HEX_RADIUS * 0.62);
  for (const side of sides) {
    const [i, j] = SIDE_CORNERS[side]!;
    g.poly([
      outer[i * 2]!,
      outer[i * 2 + 1]!,
      outer[j * 2]!,
      outer[j * 2 + 1]!,
      inner[j * 2]!,
      inner[j * 2 + 1]!,
      inner[i * 2]!,
      inner[i * 2 + 1]!,
    ]).fill({ color: 0x8f7d58, alpha: 0.6 });
    const mx = (outer[i * 2]! + outer[j * 2]! + inner[i * 2]! + inner[j * 2]!) / 4;
    const my = (outer[i * 2 + 1]! + outer[j * 2 + 1]! + inner[i * 2 + 1]! + inner[j * 2 + 1]!) / 4;
    g.ellipse(mx + (rand() - 0.5) * 6, my + (rand() - 0.5) * 3, 2.6, 1.4).fill({
      color: 0x7f9a6a,
      alpha: 0.9,
    });
  }
}
