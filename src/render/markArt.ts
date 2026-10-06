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
  salt: { fill: 0xf2f0ea, ink: 0x5b6770 },
  saltBonus: { fill: 0x7f9868, ink: 0xffffff },
  frost: { fill: 0xd8ecf6, ink: 0x3f6f8c },
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
  unpowered: { fill: 0x3b3f46, ink: 0xf2c94c },
  hot: { fill: 0xd9682b, ink: 0xfff3e0 },
  walk: { fill: 0x9a6a3c, ink: 0xfff3e0 },
  bloom: { fill: 0x6f9a3a, ink: 0xf2f7e4 },
  wash: { fill: 0x4f7fa6, ink: 0xeef5fb },
  fire: { fill: 0xc8501e, ink: 0xfff1d6 },
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
      case 'salt':
        // A white crust of salt, in flecks.
        g.poly(corners).fill({ color: 0xf4f2ec, alpha: 0.35 });
        for (let i = 0; i < 7; i++) {
          const a = i * 2.4;
          const d = 6 + (i % 3) * 5;
          g.circle(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, 1.5).fill({
            color: 0xffffff,
            alpha: 0.85,
          });
        }
        break;
      case 'saltBonus':
        g.poly(corners).stroke({ width: 2, color: 0x7f9868, alpha: 0.7 });
        break;
      case 'frost':
        // Rime: a pale wash, dashed while it is coming.
        g.poly(corners).fill({ color: 0xe8f4fa, alpha: m.coming ? 0.18 : 0.32 });
        if (m.coming) dashedLine(g, ring, 5, 4, { width: 2, color: 0x7fb2d6 });
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
      case 'unpowered':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x3b3f46 });
        break;
      case 'hot':
        dashedLine(g, ring, 5, 4, { width: 2, color: 0xd9682b });
        break;
      case 'damaged':
        g.poly(corners).stroke({ width: 2, color: 0xa3401f, alpha: 0.7 });
        break;
      case 'bloom':
        g.poly(corners).fill({ color: 0x8fbf4a, alpha: 0.25 });
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x6f9a3a });
        break;
      case 'wash':
        g.poly(corners).fill({ color: 0x6f9fc6, alpha: 0.2 });
        dashedLine(g, ring, 5, 4, { width: 2, color: 0x4f7fa6 });
        break;
      case 'fire':
        g.poly(corners).fill({ color: 0xe0782e, alpha: 0.25 });
        dashedLine(g, ring, 5, 4, { width: 2, color: 0xc8501e });
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
    case 'salt':
      // Three grains of salt.
      for (const [dx, dy] of [
        [-2.5, 1.5],
        [2.5, 1.5],
        [0, -2.5],
      ] as const)
        g.rect(x + dx - 1.4, y + dy - 1.4, 2.8, 2.8).fill({ color: ink });
      break;
    case 'frost':
      // A six-armed frost star.
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        g.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4)
          .lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4)
          .stroke({ width: 1.4, color: ink, cap: 'round' });
      }
      break;
    case 'unpowered':
      // A lightning bolt.
      g.moveTo(x + 1, y - 5)
        .lineTo(x - 3, y + 1)
        .lineTo(x, y + 1)
        .lineTo(x - 1, y + 5)
        .lineTo(x + 3, y - 1)
        .lineTo(x, y - 1)
        .closePath()
        .fill({ color: ink });
      break;
    case 'hot':
      // A small sun.
      g.circle(x, y, 2.2).fill({ color: ink });
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        g.moveTo(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4)
          .lineTo(x + Math.cos(a) * 5, y + Math.sin(a) * 5)
          .stroke({ width: 1.2, color: ink, cap: 'round' });
      }
      break;
    case 'saltBonus':
      // A sprig of samphire.
      g.moveTo(x, y + 4)
        .lineTo(x, y - 4)
        .moveTo(x, y)
        .lineTo(x - 3, y - 3)
        .moveTo(x, y + 1)
        .lineTo(x + 3, y - 2)
        .stroke({ width: 1.4, color: ink, cap: 'round' });
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
    case 'walk':
      // Two footprints.
      g.ellipse(x - 1.8, y + 1.5, 1.4, 2.4).fill({ color: ink });
      g.ellipse(x + 1.8, y - 1.5, 1.4, 2.4).fill({ color: ink });
      break;
    case 'wash':
      // A raindrop.
      g.moveTo(x, y - 4)
        .quadraticCurveTo(x + 3.5, y + 1, x, y + 3.5)
        .quadraticCurveTo(x - 3.5, y + 1, x, y - 4)
        .fill({ color: ink });
      break;
    case 'fire':
      // A flame.
      g.moveTo(x, y - 4.5)
        .quadraticCurveTo(x + 4, y, x + 1.5, y + 3.5)
        .lineTo(x - 1.5, y + 3.5)
        .quadraticCurveTo(x - 4, y, x, y - 4.5)
        .fill({ color: ink });
      break;
    case 'bloom':
      // Three specks of algae.
      for (const [dx, dy] of [
        [-2.5, 1.5],
        [2.5, 1],
        [0, -2.5],
      ] as const)
        g.circle(x + dx, y + dy, 1.6).fill({ color: ink });
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

/** Water going up a step at a pump station (the Highland): a chevron and a drop per unit. */
export function drawLift(g: Graphics, c: Point, units: number): void {
  const x = c.x + HEX_RADIUS * 0.45;
  const y = c.y - HEX_RADIUS * 0.15;
  g.moveTo(x - 4, y + 2)
    .lineTo(x, y - 3)
    .lineTo(x + 4, y + 2)
    .stroke({ width: 2, color: LIFT_BLUE, cap: 'round', join: 'round' });
  for (let i = 0; i < Math.min(units, 3); i++)
    g.circle(x - 3 + i * 3, y + 6, 1.3).fill({ color: LIFT_BLUE });
}

/** Snow lying on a building that makes nothing under it (high panels in winter). */
export function drawSnowCap(g: Graphics, c: Point): void {
  g.ellipse(c.x, c.y - 8, HEX_RADIUS * 0.42, 4).fill({ color: 0xf7f9fb, alpha: 0.95 });
  g.ellipse(c.x - 4, c.y - 10, HEX_RADIUS * 0.22, 2.5).fill({ color: 0xffffff });
}

const LIFT_BLUE = 0x3f8fb4;
