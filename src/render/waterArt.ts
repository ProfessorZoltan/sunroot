/**
 * Water on the map (EXPANSION.md, E2): channel ditches dug into the ground,
 * and the water flowing in them and in the river, thinning as it is used.
 *
 * The ditches are earthworks, drawn with the terrain: each tile of channel
 * is a basin with an arm to each neighbouring tile of channel, and the ends
 * of a channel reach into the water they draw from or return to. The water
 * is drawn every frame over it, from a season's water report: the width of
 * each stretch follows the water it carries, and small marks drift
 * downstream while it flows.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexKey, hexNeighbors, type Hex } from '../sim/hex';
import type { RunState, Tile, WaterReport } from '../sim/types';
import { hexToPixel, type Point } from './layout';

const BANK = 0x6b5232;
/** A damp, muddy bed: what a ditch looks like with no water in it. */
const BED = 0x9a9a78;
const WATER = 0x58a7cf;
const SHINE = 0xe3f3f8;

/** A stretch of flowing water: a polyline and the units each segment carries. */
export interface WaterStream {
  points: Point[];
  /** Units carried along each segment (one fewer than points). */
  units: number[];
}

export interface WaterView {
  channels: WaterStream[];
  river: WaterStream | null;
  /** The river's flow at the top this season, to scale its width. */
  riverFlow: number;
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

function isChannelAt(content: Content, state: RunState): Map<string, Hex> {
  const at = new Map<string, Hex>();
  for (const b of Object.values(state.buildings))
    if (content.byId[b.type]?.water?.channel) at.set(hexKey(b.at), b.at);
  return at;
}

/** The water tile an end of a channel touches: at this river position, or any lake, or any. */
function waterBeside(state: RunState, h: Hex, riverIndex?: number): Tile | undefined {
  const tiles = hexNeighbors(h)
    .map((n) => state.map.tiles[hexKey(n)])
    .filter((t): t is Tile => t !== undefined && (t.type === 'river' || t.type === 'reservoir'));
  if (riverIndex !== undefined) return tiles.find((t) => t.riverIndex === riverIndex);
  return tiles[0];
}

/** Draws every ditch: basins, arms between tiles of channel, and arms into the water at the ends. */
export function drawDitches(g: Graphics, content: Content, state: RunState): void {
  const channel = isChannelAt(content, state);
  if (channel.size === 0) return;
  const arms: [Point, Point][] = [];
  for (const [key, h] of channel) {
    const c = hexToPixel(h);
    const links = hexNeighbors(h).filter((n) => channel.has(hexKey(n)));
    for (const n of links) if (key < hexKey(n)) arms.push([c, hexToPixel(n)]);
    // An end of a channel reaches into the water beside it (its intake, or where it rejoins).
    if (links.length <= 1) {
      const water = waterBeside(state, h);
      if (water) arms.push([c, mid(c, hexToPixel(water))]);
    }
  }
  for (const [width, color, alpha] of [
    [12, BANK, 0.75],
    [7, BED, 1],
  ] as const) {
    for (const [a, b] of arms) g.moveTo(a.x, a.y).lineTo(b.x, b.y);
    g.stroke({ width, color, alpha, cap: 'round' });
    for (const h of channel.values()) {
      const c = hexToPixel(h);
      g.circle(c.x, c.y, width / 2 + 1.5).fill({ color, alpha });
    }
  }
}

/** The water a season's report puts in the channels and the river, as streams to draw. */
export function waterView(state: RunState, report: WaterReport | null): WaterView | null {
  if (!report) return null;
  const channels: WaterStream[] = [];
  for (const ch of report.channels) {
    if (!ch) continue;
    const tiles = ch.tiles.map((uid) => state.buildings[uid]).filter((b) => b !== undefined);
    if (tiles.length !== ch.tiles.length || tiles.length === 0) continue;
    const centres = tiles.map((b) => hexToPixel(b.at));
    const points: Point[] = [];
    const units: number[] = [];
    if (ch.intake) {
      const water =
        'river' in ch.intake ? waterBeside(state, tiles[0]!.at, ch.intake.river) : undefined;
      const source = water ?? waterBeside(state, tiles[0]!.at);
      if (source) {
        points.push(mid(centres[0]!, hexToPixel(source)));
        units.push((ch.carried[0] ?? 0) + (ch.usedAt[0] ?? 0));
      }
    }
    centres.forEach((c, i) => {
      points.push(c);
      if (i < centres.length - 1) units.push(ch.carried[i] ?? 0);
    });
    if (ch.rejoinsAt !== null) {
      const back = waterBeside(state, tiles.at(-1)!.at, ch.rejoinsAt);
      if (back) {
        points.push(mid(centres.at(-1)!, hexToPixel(back)));
        units.push(ch.carried.at(-1) ?? 0);
      }
    }
    if (points.length >= 2) channels.push({ points, units });
  }
  const riverTiles = state.map.river.map((k) => state.map.tiles[k]!);
  const river =
    riverTiles.length >= 2
      ? {
          points: riverTiles.map((t) => hexToPixel(t)),
          units: riverTiles.slice(0, -1).map((t) => report.flowAt[t.riverIndex ?? 0] ?? 0),
        }
      : null;
  return { channels, river, riverFlow: report.riverFlow };
}

/** Width of flowing water carrying `units` (0 is a dry ditch: nothing drawn). */
export function streamWidth(units: number): number {
  return units <= 0 ? 0 : 1.6 + Math.min(units, 6) * 0.75;
}

/**
 * The water in the ditches and the river's strength, with marks drifting
 * downstream (still when `still`, for reduced motion).
 */
export function drawWater(g: Graphics, view: WaterView, clock: number, still: boolean): void {
  // The river: a pale band whose width follows its flow (thin in a dry summer).
  if (view.river) {
    const { points, units } = view.river;
    for (let i = 0; i < units.length; i++) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const share = view.riverFlow > 0 ? units[i]! / view.riverFlow : 0;
      if (share <= 0) continue;
      g.moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: 2 + share * 8, color: SHINE, alpha: 0.28, cap: 'round' });
    }
  }
  for (const s of view.channels) {
    for (let i = 0; i < s.units.length; i++) {
      const w = streamWidth(s.units[i]!);
      if (w === 0) continue;
      const a = s.points[i]!;
      const b = s.points[i + 1]!;
      g.moveTo(a.x, a.y)
        .lineTo(b.x, b.y)
        .stroke({ width: w, color: WATER, alpha: 0.95, cap: 'round' });
    }
    // Marks drifting downstream, where water flows.
    let along = still ? 0 : (clock / 1000) * 14;
    for (let i = 0; i < s.units.length; i++) {
      const a = s.points[i]!;
      const b = s.points[i + 1]!;
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (s.units[i]! > 0) {
        for (let d = ((-along % 9) + 9) % 9; d < length; d += 9) {
          const t = d / length;
          g.circle(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, 0.9).fill({
            color: SHINE,
            alpha: 0.9,
          });
        }
      }
      along += length;
    }
  }
}
