/** Procedural papercraft tiles: a darker side for depth, a flat top, and a few details. */
import type { Graphics } from 'pixi.js';
import type { Tile } from '../sim/types';
import { HEX_RADIUS, LIFT, TILE_DEPTH, hexCorners, tileRandom, type Point } from './layout';
import { COLORS, TILE_COLORS } from './palette';

export function drawFogTile(g: Graphics, center: Point): void {
  g.poly(hexCorners(center))
    .fill({ color: COLORS.fog })
    .stroke({ width: 1.5, color: COLORS.fogEdge });
}

export function drawTile(g: Graphics, tile: Tile, center: Point, key: string): void {
  const colors = TILE_COLORS[tile.type];
  g.poly(hexCorners({ x: center.x, y: center.y + TILE_DEPTH })).fill({ color: colors.side });
  g.poly(hexCorners(center)).fill({ color: colors.top }).stroke({ width: 1.6, color: COLORS.gap });
  drawDetails(g, tile, center, tileRandom(key));
}

/**
 * A river with no water in it (the Sun Desert's in summer): a pale sandy bed with rounded
 * stones, ripple marks, and a damp line down the middle where the water was.
 */
export function drawDryRiver(g: Graphics, center: Point, key: string): void {
  const rand = tileRandom(`${key}:dry`);
  g.poly(hexCorners({ x: center.x, y: center.y + TILE_DEPTH })).fill({ color: 0xbfa77e });
  g.poly(hexCorners(center)).fill({ color: 0xe3cfa4 }).stroke({ width: 1.6, color: COLORS.gap });
  g.moveTo(center.x - 3, center.y - 22)
    .quadraticCurveTo(center.x + 5, center.y, center.x - 2, center.y + 22)
    .stroke({ width: 3, color: 0xc4ac83, alpha: 0.8 });
  for (let i = 0; i < 3; i++) {
    const y = center.y - 12 + i * 10;
    g.moveTo(center.x - 18, y)
      .quadraticCurveTo(center.x - 12, y - 3, center.x - 6, y)
      .stroke({ width: 1, color: 0xcdb68c });
  }
  for (let i = 0; i < 6; i++) {
    const x = center.x + (rand() - 0.5) * 40;
    const y = center.y + (rand() - 0.5) * 30;
    g.ellipse(x, y, 2.5 + rand() * 2, 1.8 + rand()).fill({ color: 0xa89c86 });
  }
}

/**
 * The cliff under a raised tile (the Highland): from its raised outline down to the ground it
 * stands on, banded a step at a time. Drawn before the tile, so the tile covers its top.
 */
export function drawCliff(g: Graphics, center: Point, lift: number): void {
  if (lift <= 0) return;
  const top = hexCorners(center);
  const ground = hexCorners({ x: center.x, y: center.y + lift + TILE_DEPTH });
  // Its silhouette: the raised hex's upper corners, the ground hex's lower ones.
  const at = (c: number[], i: number) => [c[i * 2]!, c[i * 2 + 1]!];
  g.poly([
    ...at(top, 4),
    ...at(top, 5),
    ...at(top, 0),
    ...at(ground, 1),
    ...at(ground, 2),
    ...at(ground, 3),
  ])
    .fill({ color: CLIFF.face })
    .stroke({ width: 1, color: CLIFF.line, alpha: 0.6 });
  // A band of rock for each step of height, along the face we see.
  for (let y = LIFT; y < lift + TILE_DEPTH; y += LIFT) {
    const band = hexCorners({ x: center.x, y: center.y + y });
    g.moveTo(...(at(band, 3) as [number, number]))
      .lineTo(...(at(band, 2) as [number, number]))
      .lineTo(...(at(band, 1) as [number, number]))
      .stroke({ width: 1, color: CLIFF.line, alpha: 0.5 });
  }
}

const CLIFF = { face: 0x9a9483, line: 0x6f6a5d };

/** A point inside the hex top, away from the edge. */
function spot(rand: () => number, center: Point, spread = HEX_RADIUS * 0.55): Point {
  const a = rand() * Math.PI * 2;
  const d = Math.sqrt(rand()) * spread;
  return { x: center.x + Math.cos(a) * d, y: center.y + Math.sin(a) * d * 0.9 };
}

function drawDetails(g: Graphics, tile: Tile, c: Point, rand: () => number): void {
  const detail = TILE_COLORS[tile.type].detail;
  switch (tile.type) {
    case 'floodplain':
      for (let i = 0; i < 4; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 1.6).fill({ color: detail });
      }
      break;
    case 'scrub':
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 3.5).fill({ color: detail });
      }
      break;
    case 'meadow':
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c);
        g.moveTo(p.x - 3, p.y - 4)
          .lineTo(p.x - 1, p.y)
          .lineTo(p.x + 1, p.y - 4)
          .stroke({ width: 1.2, color: detail, cap: 'round', join: 'round' });
      }
      if (rand() < 0.35) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 1.6).fill({ color: COLORS.sunGold });
      }
      break;
    case 'woodland': {
      const crowns = [
        { x: -6, y: -2 },
        { x: 5, y: -4 },
        { x: 0, y: 5 },
      ];
      for (const [i, o] of crowns.entries()) {
        const x = c.x + o.x + (rand() - 0.5) * 3;
        const y = c.y + o.y + (rand() - 0.5) * 3;
        g.circle(x + 1, y + 1.5, 6.5).fill({ color: COLORS.treeDark });
        g.circle(x, y, 6).fill({ color: i === 1 ? COLORS.treeDark : COLORS.treeLight });
      }
      break;
    }
    case 'hill':
      for (let i = 0; i < 2; i++) {
        const y = c.y - 4 + i * 9 + (rand() - 0.5) * 3;
        const x = c.x + (rand() - 0.5) * 8;
        g.moveTo(x - 12, y + 5)
          .quadraticCurveTo(x, y - 9, x + 12, y + 5)
          .stroke({ width: 1.4, color: detail, cap: 'round' });
      }
      break;
    case 'barren':
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.4);
        g.moveTo(p.x - 6, p.y)
          .quadraticCurveTo(p.x - 3, p.y - 3, p.x, p.y)
          .quadraticCurveTo(p.x + 3, p.y + 3, p.x + 6, p.y)
          .stroke({ width: 1.3, color: detail, cap: 'round' });
      }
      break;
    case 'ruin':
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.4);
        g.rect(p.x - 4, p.y - 2.5, 8, 5).fill({ color: i === 0 ? 0xa89c86 : detail });
      }
      break;
    // The Windswept Coast.
    case 'sea':
      // A soft swell: two or three short crests.
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c);
        g.moveTo(p.x - 6, p.y)
          .quadraticCurveTo(p.x - 3, p.y - 2.5, p.x, p.y)
          .quadraticCurveTo(p.x + 3, p.y - 2.5, p.x + 6, p.y)
          .stroke({ width: 1.2, color: detail, alpha: 0.7, cap: 'round' });
      }
      break;
    case 'mudflat':
      // Ripple marks and a shell or two.
      for (let i = 0; i < 3; i++) {
        const y = c.y - 6 + i * 6 + (rand() - 0.5) * 2;
        const x = c.x + (rand() - 0.5) * 6;
        g.moveTo(x - 10, y)
          .quadraticCurveTo(x - 5, y - 2, x, y)
          .quadraticCurveTo(x + 5, y + 2, x + 10, y)
          .stroke({ width: 1.1, color: detail, cap: 'round' });
      }
      if (rand() < 0.6) {
        const p = spot(rand, c, HEX_RADIUS * 0.4);
        g.circle(p.x, p.y, 1.6).fill({ color: COLORS.paper });
      }
      break;
    case 'saltmarsh': {
      // A creek across it, a pan of water, tufts of samphire.
      const y = c.y + (rand() - 0.5) * 6;
      g.moveTo(c.x - 14, y + 3)
        .quadraticCurveTo(c.x - 4, y - 5, c.x + 2, y + 1)
        .quadraticCurveTo(c.x + 8, y + 6, c.x + 14, y - 2)
        .stroke({ width: 1.8, color: TILE_COLORS.sea.top, cap: 'round' });
      const pan = spot(rand, c, HEX_RADIUS * 0.4);
      g.ellipse(pan.x, pan.y, 3.5, 2).fill({ color: TILE_COLORS.sea.top });
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 2).fill({ color: i === 0 ? 0xb39ac2 : detail });
      }
      break;
    }
    case 'dune':
      // Soft sand ridges with marram tufts.
      for (let i = 0; i < 2; i++) {
        const y = c.y - 3 + i * 8 + (rand() - 0.5) * 3;
        const x = c.x + (rand() - 0.5) * 6;
        g.moveTo(x - 12, y + 3)
          .quadraticCurveTo(x - 2, y - 5, x + 12, y + 2)
          .stroke({ width: 1.3, color: TILE_COLORS.dune.side, cap: 'round' });
      }
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c);
        g.moveTo(p.x - 2.5, p.y - 4)
          .lineTo(p.x, p.y)
          .lineTo(p.x + 2.5, p.y - 4)
          .moveTo(p.x, p.y)
          .lineTo(p.x, p.y - 5)
          .stroke({ width: 1.1, color: detail, cap: 'round', join: 'round' });
      }
      break;
    // The Highland.
    case 'crag':
      // Broken rock: a few angular stones.
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.45);
        g.poly([p.x - 5, p.y + 2, p.x - 1, p.y - 4, p.x + 4, p.y - 1, p.x + 3, p.y + 3]).fill({
          color: i === 0 ? 0xc2beb2 : detail,
        });
      }
      break;
    // The Sun Desert.
    case 'reg':
      // Gravel: scattered pebbles.
      for (let i = 0; i < 5; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 1.2).fill({ color: detail });
      }
      break;
    case 'erg':
      // Dune ridges, sharp-crested.
      for (let i = 0; i < 2; i++) {
        const y = c.y - 4 + i * 8 + (rand() - 0.5) * 3;
        const x = c.x + (rand() - 0.5) * 6;
        g.moveTo(x - 13, y + 4)
          .quadraticCurveTo(x - 3, y - 6, x + 13, y + 1)
          .stroke({ width: 1.4, color: TILE_COLORS.erg.side, cap: 'round' });
      }
      break;
    case 'rock':
      // A red outcrop.
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.4);
        g.poly([p.x - 6, p.y + 3, p.x - 3, p.y - 5, p.x + 4, p.y - 6, p.x + 6, p.y + 3]).fill({
          color: i === 0 ? 0xc49a78 : detail,
        });
      }
      break;
    case 'saltFlat':
      // A crust cracked into plates.
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.5);
        g.moveTo(p.x - 6, p.y)
          .lineTo(p.x, p.y + 2)
          .lineTo(p.x + 5, p.y - 2)
          .stroke({ width: 0.9, color: detail });
      }
      break;
    case 'bog':
      // Dark pools among cotton grass.
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c, HEX_RADIUS * 0.4);
        g.ellipse(p.x, p.y, 4, 2.2).fill({ color: 0x4f5f58 });
      }
      for (let i = 0; i < 3; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 1.5).fill({ color: 0xf4f2ec });
      }
      break;
    case 'oasis':
      // Palms leaning in at the rim.
      for (let i = 0; i < 2; i++) {
        const p = spot(rand, c);
        g.circle(p.x, p.y, 3).fill({ color: TILE_COLORS.oasis.detail });
      }
      break;
    case 'river':
    case 'reservoir':
      break;
  }
}

/** A dashed polyline (Pixi has no dash style). */
export function dashedLine(
  g: Graphics,
  points: Point[],
  dash: number,
  gap: number,
  style: { width: number; color: number; alpha?: number },
): void {
  let drawing = true;
  let left = dash;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = 0;
    while (at < length) {
      const step = Math.min(left, length - at);
      const t0 = at / length;
      const t1 = (at + step) / length;
      if (drawing) {
        g.moveTo(a.x + (b.x - a.x) * t0, a.y + (b.y - a.y) * t0).lineTo(
          a.x + (b.x - a.x) * t1,
          a.y + (b.y - a.y) * t1,
        );
      }
      at += step;
      left -= step;
      if (left <= 0) {
        drawing = !drawing;
        left = drawing ? dash : gap;
      }
    }
  }
  g.stroke({ ...style, cap: 'round' });
}
