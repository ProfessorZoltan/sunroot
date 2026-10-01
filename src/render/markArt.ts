/**
 * Marks for the season (src/game/marks.ts), drawn in code: a wash or outline
 * on the tile, under the buildings, and a small badge over them. Effects that
 * already hold are solid; the coming event's reach is dashed, like a forecast.
 */
import type { Graphics } from 'pixi.js';
import type { Mark, MarkKind } from '../game/marks';
import { hexKey } from '../sim/hex';
import { HEX_RADIUS, hexCorners, hexToPixel, type Point } from './layout';
import { dashedLine } from './tileArt';

const BADGE: Record<MarkKind, { fill: number; ink: number }> = {
  silt: { fill: 0xe0a33b, ink: 0x5a3a14 },
  damaged: { fill: 0xa3401f, ink: 0xfff3e8 },
  unstaffed: { fill: 0x8b9386, ink: 0xffffff },
  shade: { fill: 0x5e6b58, ink: 0xf4ebd6 },
  flood: { fill: 0x3a7d96, ink: 0xffffff },
  floodDamage: { fill: 0xa3401f, ink: 0xffffff },
  sheltered: { fill: 0x3f7a3a, ink: 0xffffff },
  dry: { fill: 0xb98a4e, ink: 0xfff3e0 },
  exposed: { fill: 0x5b6770, ink: 0xffffff },
  calm: { fill: 0x3f7a3a, ink: 0xffffff },
  cold: { fill: 0x7fb2d6, ink: 0xffffff },
};

/** Tile washes and outlines, under the buildings. */
export function drawMarkTiles(g: Graphics, marks: Mark[]): void {
  for (const m of marks) {
    const c = hexToPixel(m.at);
    const corners = hexCorners(c, HEX_RADIUS - 3);
    const ring: Point[] = [];
    for (let i = 0; i <= 6; i++)
      ring.push({ x: corners[(i % 6) * 2]!, y: corners[(i % 6) * 2 + 1]! });
    switch (m.kind) {
      case 'flood':
      case 'floodDamage':
        g.poly(corners).fill({ color: 0x7fb7c8, alpha: 0.28 });
        hatch(g, c, 0x548899, 0.55);
        dashedLine(g, ring, 5, 4, { width: 2, color: m.kind === 'flood' ? 0x3a7d96 : 0xa3401f });
        break;
      case 'sheltered':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x3f7a3a });
        break;
      case 'silt':
        g.poly(corners).fill({ color: 0xc9a25c, alpha: 0.32 });
        for (let i = -1; i <= 1; i++) {
          const y = c.y + i * 8 + 4;
          g.moveTo(c.x - 16, y)
            .quadraticCurveTo(c.x - 8, y - 3, c.x, y)
            .quadraticCurveTo(c.x + 8, y + 3, c.x + 16, y)
            .stroke({ width: 1.4, color: 0x9a6f2c, alpha: 0.55 });
        }
        break;
      case 'dry':
        g.poly(corners).fill({ color: 0xd9b98a, alpha: 0.35 });
        g.moveTo(c.x - 12, c.y + 8)
          .lineTo(c.x - 4, c.y + 2)
          .lineTo(c.x - 7, c.y - 6)
          .moveTo(c.x - 4, c.y + 2)
          .lineTo(c.x + 6, c.y + 5)
          .lineTo(c.x + 12, c.y - 3)
          .stroke({ width: 1.3, color: 0x8a6438, alpha: 0.7 });
        dashedLine(g, ring, 5, 4, { width: 2, color: 0xb98a4e });
        break;
      case 'exposed':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x5b6770 });
        break;
      case 'calm':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x3f7a3a });
        break;
      case 'cold':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x7fb2d6 });
        break;
      case 'damaged':
        g.poly(corners).stroke({ width: 2, color: 0xa3401f, alpha: 0.7 });
        break;
      default:
        break;
    }
  }
}

/** Small badges over the buildings, side by side when a tile has several. */
export function drawMarkBadges(g: Graphics, marks: Mark[]): void {
  const perTile = new Map<string, number>();
  for (const m of marks) {
    if (m.kind === 'flood' || m.kind === 'sheltered') continue; // the tile wash says it
    const key = hexKey(m.at);
    const i = perTile.get(key) ?? 0;
    perTile.set(key, i + 1);
    const c = hexToPixel(m.at);
    const p = { x: c.x + 14 - i * 13, y: c.y - 17 };
    const { fill, ink } = BADGE[m.kind];
    g.circle(p.x, p.y, 7).fill({ color: fill }).stroke({ width: 1.5, color: 0xfffbf0 });
    if (m.coming) g.circle(p.x, p.y, 9).stroke({ width: 1, color: fill, alpha: 0.8 });
    icon(g, m.kind, p, ink);
  }
}

function hatch(g: Graphics, c: Point, color: number, alpha: number): void {
  for (let i = -2; i <= 2; i++) {
    const o = i * 7;
    const half = Math.sqrt(Math.max(0, 18 * 18 - o * o * 0.5));
    g.moveTo(c.x + o - half * 0.7, c.y - half * 0.7)
      .lineTo(c.x + o + half * 0.7, c.y + half * 0.7)
      .stroke({ width: 1.2, color, alpha });
  }
}

function icon(g: Graphics, kind: MarkKind, p: Point, ink: number): void {
  const { x, y } = p;
  switch (kind) {
    case 'silt':
      g.moveTo(x - 4, y + 1)
        .quadraticCurveTo(x - 2, y - 2, x, y + 1)
        .quadraticCurveTo(x + 2, y + 4, x + 4, y + 1)
        .stroke({ width: 1.4, color: ink });
      g.circle(x, y - 3, 1.1).fill({ color: ink });
      break;
    case 'damaged':
    case 'floodDamage':
      g.moveTo(x - 3, y - 3)
        .lineTo(x + 3, y + 3)
        .moveTo(x + 3, y - 3)
        .lineTo(x - 3, y + 3)
        .stroke({ width: 1.8, color: ink, cap: 'round' });
      break;
    case 'unstaffed':
      g.circle(x, y - 2.5, 1.8).fill({ color: ink });
      g.moveTo(x - 3, y + 4)
        .quadraticCurveTo(x, y - 1, x + 3, y + 4)
        .fill({ color: ink });
      g.moveTo(x - 4, y + 4)
        .lineTo(x + 4, y - 4)
        .stroke({ width: 1.2, color: 0xa3401f });
      break;
    case 'shade':
      g.circle(x, y, 3.5).fill({ color: ink });
      g.circle(x + 1.8, y - 1, 3).fill({ color: 0x5e6b58 });
      break;
    case 'flood':
      g.moveTo(x, y - 4)
        .quadraticCurveTo(x + 4, y + 1, x, y + 4)
        .quadraticCurveTo(x - 4, y + 1, x, y - 4)
        .fill({ color: ink });
      break;
    case 'sheltered':
    case 'calm':
      g.moveTo(x - 3.5, y - 3)
        .lineTo(x + 3.5, y - 3)
        .lineTo(x + 3.5, y)
        .quadraticCurveTo(x + 3, y + 3.5, x, y + 4.5)
        .quadraticCurveTo(x - 3, y + 3.5, x - 3.5, y)
        .closePath()
        .fill({ color: ink });
      break;
    case 'dry':
      g.moveTo(x - 3, y + 3)
        .lineTo(x - 1, y)
        .lineTo(x - 2, y - 3)
        .moveTo(x - 1, y)
        .lineTo(x + 3, y + 1)
        .stroke({ width: 1.3, color: ink });
      break;
    case 'exposed':
      for (const dy of [-2, 1.5]) {
        g.moveTo(x - 4, y + dy)
          .lineTo(x + 2, y + dy)
          .quadraticCurveTo(x + 4.5, y + dy - 0.5, x + 3, y + dy - 2.5)
          .stroke({ width: 1.2, color: ink, cap: 'round' });
      }
      break;
    case 'cold':
      for (let i = 0; i < 3; i++) {
        const a = (Math.PI / 3) * i;
        g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4)
          .lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4)
          .stroke({ width: 1.2, color: ink, cap: 'round' });
      }
      break;
  }
}
