/**
 * Seasons repaint the map (docs/DESIGN.md, "Signature visuals"): blossom in
 * spring, silt glittering on flooded farms, leaves turning in autumn, snow in
 * winter. Wildlife returns as Harmony tiers rise: birds, then deer, then otters.
 * Everything is placed from per-tile random streams, so it never flickers.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexKey } from '../sim/hex';
import type { RunState } from '../sim/types';
import { hexToPixel, tileRandom, type Point } from './layout';

const LAND_SPECKS: Record<string, { colors: number[]; per: number; on: string[] }> = {
  spring: { colors: [0xf6d6e0, 0xfff7f0, 0xe58fa8], per: 3, on: ['meadow', 'woodland', 'scrub'] },
  summer: { colors: [], per: 0, on: [] },
  autumn: {
    colors: [0xd98c5f, 0xe0a33b, 0xb85c3c],
    per: 4,
    on: ['meadow', 'woodland', 'scrub', 'floodplain'],
  },
  winter: {
    colors: [0xffffff, 0xf4f8fb],
    per: 6,
    on: ['meadow', 'woodland', 'scrub', 'floodplain', 'barren', 'hill', 'ruin'],
  },
};

const WASH: Record<string, { color: number; alpha: number } | null> = {
  spring: null,
  summer: { color: 0xfff1b8, alpha: 0.06 },
  autumn: { color: 0xe7a45c, alpha: 0.08 },
  winter: { color: 0xeef5fa, alpha: 0.22 },
};

export function drawSeason(g: Graphics, content: Content, state: RunState): void {
  g.clear();
  const wash = WASH[state.season];
  const specks = LAND_SPECKS[state.season]!;
  const occupied = new Set(Object.values(state.buildings).map((b) => hexKey(b.at)));
  for (const [key, tile] of Object.entries(state.map.tiles)) {
    const c = hexToPixel(tile);
    if (wash && tile.type !== 'river' && tile.type !== 'reservoir') {
      g.circle(c.x, c.y, 24).fill(wash);
    }
    if (!specks.on.includes(tile.type)) continue;
    const rand = tileRandom(`${key}:${state.season}`);
    const count = occupied.has(key) ? Math.ceil(specks.per / 2) : specks.per;
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const d = 6 + rand() * 16;
      const color = specks.colors[Math.floor(rand() * specks.colors.length)]!;
      const size = state.season === 'winter' ? 1.6 + rand() * 1.2 : 1.4 + rand();
      g.circle(c.x + Math.cos(a) * d, c.y + Math.sin(a) * d * 0.8, size).fill({ color });
    }
  }
  if (state.season === 'winter') {
    // Frost along the river's banks.
    for (const key of state.map.river) {
      const c = hexToPixel(state.map.tiles[key]!);
      g.ellipse(c.x - 12, c.y + 6, 7, 3).fill({ color: 0xf6fbff, alpha: 0.7 });
      g.ellipse(c.x + 11, c.y - 7, 6, 2.5).fill({ color: 0xf6fbff, alpha: 0.7 });
    }
  }
  // Silt glitters on farms the flood fed, for the seasons it lasts.
  const flood = content.events.flood;
  for (const b of Object.values(state.buildings)) {
    if (b.siltYear !== state.year || !flood.siltSeasons.includes(state.season)) continue;
    const c = hexToPixel(b.at);
    const rand = tileRandom(`${hexKey(b.at)}:silt`);
    for (let i = 0; i < 5; i++) {
      sparkle(g, { x: c.x - 18 + rand() * 36, y: c.y - 10 + rand() * 22 }, 2.5 + rand() * 2);
    }
  }
}

function sparkle(g: Graphics, p: Point, r: number): void {
  g.poly([
    p.x,
    p.y - r,
    p.x + r * 0.28,
    p.y - r * 0.28,
    p.x + r,
    p.y,
    p.x + r * 0.28,
    p.y + r * 0.28,
    p.x,
    p.y + r,
    p.x - r * 0.28,
    p.y + r * 0.28,
    p.x - r,
    p.y,
    p.x - r * 0.28,
    p.y - r * 0.28,
  ]).fill({ color: 0xf8e08e });
}

export interface Wildlife {
  birds: boolean;
  deer: Point[];
  otters: Point[];
}

/** Which animals have returned, and where the deer and otters live. */
export function wildlifeFor(content: Content, state: RunState): Wildlife {
  const tiers = content.rules.harmony.tiers;
  const tier = tiers.filter((t) => state.harmony >= t.min).length - 1;
  const occupied = new Set(Object.values(state.buildings).map((b) => hexKey(b.at)));
  const pick = (types: string[], n: number, salt: string) =>
    Object.entries(state.map.tiles)
      .filter(([key, t]) => types.includes(t.type) && !occupied.has(key))
      .map(([key, t]) => ({ key, t, rank: tileRandom(`${key}:${salt}`)() }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, n)
      .map(({ t }) => hexToPixel(t));
  return {
    birds: tier >= 1,
    deer: tier >= 2 ? pick(['woodland', 'meadow'], 3, 'deer') : [],
    otters: tier >= 3 ? pick(['river'], 2, 'otter') : [],
  };
}

export function drawDeer(g: Graphics, c: Point): void {
  const x = c.x + 6;
  const y = c.y + 6;
  g.ellipse(x, y, 7, 3.5).fill({ color: 0xa0643f });
  g.rect(x - 5, y + 2, 1.4, 5).fill({ color: 0x7a4a2e });
  g.rect(x + 4, y + 2, 1.4, 5).fill({ color: 0x7a4a2e });
  g.moveTo(x + 5, y - 1)
    .lineTo(x + 8, y - 7)
    .stroke({ width: 2.4, color: 0xa0643f });
  g.circle(x + 9, y - 8, 2.4).fill({ color: 0xa0643f });
  g.moveTo(x + 8, y - 10)
    .lineTo(x + 7, y - 14)
    .moveTo(x + 10, y - 10)
    .lineTo(x + 12, y - 14)
    .stroke({ width: 1, color: 0x7a4a2e });
  g.circle(x - 6.5, y - 1, 1.2).fill({ color: 0xfff9ea });
}

export function drawOtter(g: Graphics, c: Point, bob = 0): void {
  const x = c.x - 8;
  const y = c.y + 8 + bob;
  g.ellipse(x, y, 6, 3).fill({ color: 0x6b4a33 });
  g.circle(x + 5, y - 2, 2.6).fill({ color: 0x6b4a33 });
  g.circle(x + 6, y - 2.5, 0.7).fill({ color: 0x1e1e1e });
  g.moveTo(x - 14, y + 1)
    .quadraticCurveTo(x - 10, y - 2, x - 6, y + 1)
    .stroke({ width: 1.2, color: 0xe4f2f5 });
}

export function drawBird(g: Graphics, p: Point, flap: number): void {
  const w = 5;
  const lift = 2 + flap * 2;
  g.moveTo(p.x - w, p.y - lift)
    .quadraticCurveTo(p.x - w / 2, p.y - lift - 1, p.x, p.y)
    .quadraticCurveTo(p.x + w / 2, p.y - lift - 1, p.x + w, p.y - lift)
    .stroke({ width: 1.6, color: 0x2f3b2e, cap: 'round' });
}
