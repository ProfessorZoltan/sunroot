/**
 * Small life about the valley, beside the birds, deer and otters (asked for
 * in playtesting): butterflies over pollinator meadows, bees round apiaries,
 * smoke from kilns and workshops that ran and from homes kept warm, fish
 * leaping in ponds and the river, citizens walking to work, petals, seeds,
 * leaves or snow on the wind, and clouds' shadows drifting over; in the Sun
 * Desert, heat shimmer over the open sand and gravel in summer, sun glinting
 * on mirrors and panels, and sand on the wind instead of snow. Where each
 * lives is plain data from the run (tested); drawing it is a function of the
 * clock, and it holds still when the player prefers reduced motion.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexKey } from '../sim/hex';
import type { RunState } from '../sim/types';
import { heatDemand } from '../sim/queries';
import { hexToPixel, tileRandom, type Bounds, type Point } from './layout';

export type FallingKind = 'petal' | 'fluff' | 'leaf' | 'snow' | 'sand';

export interface Ambient {
  butterflies: Point[];
  bees: Point[];
  smoke: Point[];
  fish: Point[];
  walkers: { from: Point; to: Point }[];
  /** Heat shimmer over open ground (the Sun Desert's summer). */
  shimmer: Point[];
  /** Sun glinting on mirrors and panels (the Sun Desert). */
  glints: Point[];
  falling: FallingKind;
  clouds: number;
}

const FALLING: Record<string, FallingKind> = {
  spring: 'petal',
  summer: 'fluff',
  autumn: 'leaf',
  winter: 'snow',
};

/** At most this many of each, so the map stays calm and cheap to draw. */
export const AMBIENT_CAPS = {
  butterflies: 10,
  bees: 12,
  smoke: 10,
  fish: 6,
  walkers: 6,
  shimmer: 8,
  glints: 8,
};

/** Sources whose mirrors or panels catch the light in the desert. */
const GLINTING = ['concentratedSolarPlant', 'solarCanopy', 'restoredArray', 'agrivoltaicField'];

export function ambientFor(content: Content, state: RunState): Ambient {
  const tiers = content.rules.harmony.tiers;
  const tier = tiers.filter((t) => state.harmony >= t.min).length - 1;
  const warm = state.season === 'spring' || state.season === 'summer';
  const winter = state.season === 'winter';
  const buildings = Object.values(state.buildings).filter((b) => !b.damage);
  const occupied = new Set(Object.values(state.buildings).map((b) => hexKey(b.at)));
  const def = (type: string) => content.byId[type];
  const of = (type: string) => buildings.filter((b) => b.type === type);
  const wild = (types: string[], n: number, salt: string) =>
    Object.entries(state.map.tiles)
      .filter(([key, t]) => types.includes(t.type) && !occupied.has(key))
      .map(([key, t]) => ({ t, rank: tileRandom(`${key}:${salt}`)() }))
      .sort((a, b) => a.rank - b.rank)
      .slice(0, n)
      .map(({ t }) => hexToPixel(t));

  const butterflies = warm
    ? [
        ...of('pollinatorMeadow').flatMap((b) => [hexToPixel(b.at), hexToPixel(b.at)]),
        ...(tier >= 1 ? wild(['meadow'], 3, 'butterfly') : []),
      ]
    : [];
  const bees = winter ? [] : of('apiary').flatMap((b) => [0, 1, 2].map(() => hexToPixel(b.at)));
  const ran = state.lastReport?.runs ?? {};
  const smoke = buildings
    .filter((b) => {
      const d = def(b.type);
      if (!d) return false;
      if ((ran[b.uid]?.runs ?? 0) > 0) return true;
      // A smokehouse at work (the coast's): staffed and standing last season.
      const report = state.lastReport;
      if (d.stopsRot && report && !report.unstaffed.includes(b.uid) && !b.damage) return true;
      // Homes that need heat this season.
      const si = ['spring', 'summer', 'autumn', 'winter'].indexOf(state.season);
      return d.housing > 0 && heatDemand(content, state, b, 'night', si) > 0;
    })
    .map((b) => chimney(hexToPixel(b.at)));
  const fish = winter
    ? []
    : [
        ...of('fishPond').map((b) => hexToPixel(b.at)),
        ...(tier >= 2 ? wild(['river'], 2, 'fish') : []),
      ];

  // Citizens walk from homes to the nearest places that need workers.
  const homes = buildings.filter((b) => (def(b.type)?.housing ?? 0) > 0);
  const work = buildings.filter((b) => (def(b.type)?.workers ?? 0) > 0);
  const walkers: Ambient['walkers'] = [];
  const count = Math.min(AMBIENT_CAPS.walkers, Math.floor(state.citizens / 4));
  if (work.length > 0) {
    for (let i = 0; walkers.length < count && i < count * 3 && homes.length > 0; i++) {
      const home = homes[i % homes.length]!;
      const near = [...work].sort((a, b) => dist(a.at, home.at) - dist(b.at, home.at));
      const to = near[Math.floor(i / homes.length) % near.length]!;
      if (hexKey(to.at) === hexKey(home.at)) continue;
      walkers.push({ from: hexToPixel(home.at), to: hexToPixel(to.at) });
    }
  }

  const desert = content.land === 'desert';
  const shimmer = desert && state.season === 'summer' ? wild(['reg', 'erg'], 8, 'shimmer') : [];
  const glints = desert
    ? buildings.filter((b) => GLINTING.includes(b.type)).map((b) => hexToPixel(b.at))
    : [];
  // No snow in the desert: sand on the wind, and in its green winter, seeds.
  const falling: FallingKind = desert
    ? winter
      ? 'fluff'
      : 'sand'
    : (FALLING[state.season] ?? 'petal');

  return {
    butterflies: butterflies.slice(0, AMBIENT_CAPS.butterflies),
    bees: bees.slice(0, AMBIENT_CAPS.bees),
    smoke: smoke.slice(0, AMBIENT_CAPS.smoke),
    fish: fish.slice(0, AMBIENT_CAPS.fish),
    walkers,
    shimmer: shimmer.slice(0, AMBIENT_CAPS.shimmer),
    glints: glints.slice(0, AMBIENT_CAPS.glints),
    falling,
    clouds: 2,
  };
}

function chimney(c: Point): Point {
  return { x: c.x + 6, y: c.y - 16 };
}

function dist(a: { q: number; r: number }, b: { q: number; r: number }): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

const wave = (x: number) => Math.sin(x);

/**
 * Draws the valley's small life at `clock` (ms). `still` (reduced motion)
 * draws each in one resting pose and leaves out what only makes sense moving.
 */
export function drawAmbient(
  g: Graphics,
  a: Ambient,
  bounds: Bounds,
  clock: number,
  still: boolean,
): void {
  const t = still ? 0 : clock;

  // Clouds' shadows drift slowly from west to east, under everything else here.
  if (!still) {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    for (let i = 0; i < a.clouds; i++) {
      const span = w + 400;
      const x = bounds.minX - 200 + ((t / (90 + i * 30) + i * span * 0.55) % span);
      const y = bounds.minY + h * (0.3 + i * 0.35);
      // Fades in and out at the valley's edges rather than drifting over the margin.
      const edge = Math.min(1, (x - bounds.minX) / 160, (bounds.maxX - x) / 160);
      if (edge <= 0) continue;
      for (const [dx, dy, r] of [
        [0, 0, 46],
        [38, 8, 36],
        [-36, 10, 32],
        [8, 18, 34],
      ] as const)
        g.ellipse(x + dx, y + dy, r * 1.4, r * 0.62).fill({ color: 0x2f3b2e, alpha: 0.04 * edge });
    }
  }

  // Heat shimmer: faint wavering lines rising off the open ground.
  if (!still)
    a.shimmer.forEach((c, i) => {
      for (let k = 0; k < 3; k++) {
        const p = (t / 1800 + k / 3 + i * 0.29) % 1;
        const y = c.y + 6 - p * 26;
        const x = c.x - 12 + k * 9;
        g.moveTo(x, y);
        for (let s = 1; s <= 4; s++) g.lineTo(x + s * 3, y + wave(t / 160 + s + i + k) * 1.6);
        g.stroke({ width: 1.2, color: 0xfff4dc, alpha: 0.45 * Math.sin(Math.PI * p) });
      }
    });

  // Sun glints on mirrors and panels: a brief star now and then.
  a.glints.forEach((c, i) => {
    const p = still ? 0 : (t / 2600 + i * 0.37) % 1;
    const flash = still ? 0 : Math.max(0, 1 - Math.abs(p - 0.1) * 12);
    if (flash <= 0) return;
    const x = c.x - 4 + (i % 3) * 4;
    const y = c.y - 6;
    const r = 5 * flash;
    g.moveTo(x - r, y)
      .lineTo(x + r, y)
      .moveTo(x, y - r)
      .lineTo(x, y + r)
      .stroke({ width: 1.4, color: 0xffffff, alpha: 0.9 * flash });
    g.circle(x, y, 1.6 * flash).fill({ color: 0xfff7d6, alpha: flash });
  });

  // Citizens on their way: a small figure walking there and back.
  a.walkers.forEach((w, i) => {
    const p = still ? 0.5 : pingPong(t / 5200 + i * 0.37);
    const x = w.from.x + (w.to.x - w.from.x) * p;
    const y = w.from.y + (w.to.y - w.from.y) * p + 8;
    const step = still ? 0 : wave(t / 90 + i) * 1.2;
    g.moveTo(x - 1.2, y + 2)
      .lineTo(x - 1.2 - step, y + 6)
      .moveTo(x + 1.2, y + 2)
      .lineTo(x + 1.2 + step, y + 6)
      .stroke({ width: 1.2, color: 0x4a3b2c, cap: 'round' });
    g.roundRect(x - 2.2, y - 3.5, 4.4, 6, 2).fill({
      color: WALKER_COATS[i % WALKER_COATS.length]!,
    });
    g.circle(x, y - 5.5, 1.9).fill({ color: 0xe8c39e });
  });

  // Smoke curls up from chimneys and fades.
  a.smoke.forEach((c, i) => {
    for (let k = 0; k < 3; k++) {
      const p = still ? k / 3 : (t / 2400 + k / 3 + i * 0.13) % 1;
      const x = c.x + wave(p * 5 + i) * 3 + p * 6;
      const y = c.y - p * 22;
      g.circle(x, y, 2.2 + p * 3.5).fill({ color: 0xe9e4da, alpha: 0.55 * (1 - p) });
    }
  });

  // Fish leap in an arc now and then.
  a.fish.forEach((c, i) => {
    const cycle = still ? 0.5 : ((t / 3600 + i * 0.41) % 1) * 2.4; // a leap, then a long pause
    if (cycle > 1) {
      if (!still && cycle < 1.25) {
        // Rings on the water where it landed.
        const r = 3 + (cycle - 1) * 30;
        g.ellipse(c.x + 8, c.y + 6, r, r * 0.4).stroke({
          width: 1,
          color: 0xffffff,
          alpha: 0.7 * (1 - (cycle - 1) * 4),
        });
      }
      return;
    }
    const x = c.x - 8 + cycle * 16;
    const y = c.y + 6 - Math.sin(Math.PI * cycle) * 12;
    const ang = (cycle - 0.5) * 1.6;
    g.ellipse(x, y, 4, 1.8).fill({ color: 0xc7d3d6 });
    const tx = x - Math.cos(ang) * 4.5;
    const ty = y - Math.sin(ang) * 4.5;
    g.poly([tx, ty, tx - 2.5, ty - 2, tx - 2.5, ty + 2]).fill({ color: 0xa9b8bc });
  });

  // Bees circle their apiary.
  a.bees.forEach((c, i) => {
    const ang = still ? i * 2.1 : t / (260 + (i % 3) * 70) + i * 2.1;
    const x = c.x + Math.cos(ang) * (10 + (i % 3) * 4);
    const y = c.y - 8 + Math.sin(ang * 1.3) * 6;
    g.ellipse(x, y, 1.8, 1.3).fill({ color: 0xe0a33b });
    g.circle(x - 0.6, y - 1.4, 1).fill({ color: 0xffffff, alpha: 0.8 });
  });

  // Butterflies flutter in loose loops over their meadows.
  a.butterflies.forEach((c, i) => {
    const s = still ? i : t / 1400 + i * 1.7;
    const x = c.x + wave(s) * 14 + wave(s * 2.3) * 4;
    const y = c.y - 10 + wave(s * 1.6 + 1) * 8;
    const open = still ? 1 : 0.35 + 0.65 * Math.abs(wave(t / 70 + i));
    const color = BUTTERFLIES[i % BUTTERFLIES.length]!;
    g.ellipse(x - 2.2 * open, y, 2.4 * open, 2).fill({ color });
    g.ellipse(x + 2.2 * open, y, 2.4 * open, 2).fill({ color });
    g.rect(x - 0.4, y - 1.8, 0.8, 3.6).fill({ color: 0x3a2e24 });
  });

  // Petals, seeds, leaves or snow carried across the valley.
  if (!still) {
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const n = a.falling === 'snow' ? 26 : 14;
    for (let i = 0; i < n; i++) {
      const r = tileRandom(`falling:${i}`);
      const speed = 0.012 + r() * 0.01;
      const y = bounds.minY + ((r() * h + t * speed) % h);
      const x = bounds.minX + ((r() * w + t * speed * 0.8 + wave(t / 900 + i) * 12) % w);
      const spin = t / 300 + i;
      switch (a.falling) {
        case 'petal':
          g.ellipse(x, y, 2.4, 1.3 * Math.abs(wave(spin)) + 0.3).fill({ color: 0xf2b8c8 });
          break;
        case 'fluff':
          g.circle(x, y, 1.4).fill({ color: 0xffffff, alpha: 0.9 });
          g.moveTo(x, y)
            .lineTo(x + 2, y + 3)
            .stroke({ width: 0.6, color: 0xffffff, alpha: 0.7 });
          break;
        case 'leaf':
          g.ellipse(x, y, 3, 1.5 * Math.abs(wave(spin)) + 0.3).fill({
            color: LEAVES[i % LEAVES.length]!,
          });
          break;
        case 'snow':
          g.circle(x, y, 1.3 + r() * 0.8).fill({ color: 0xffffff, alpha: 0.9 });
          break;
        case 'sand':
          g.circle(x, y, 0.9 + r() * 0.6).fill({ color: 0xd9b98a, alpha: 0.75 });
          break;
      }
    }
  }
}

const WALKER_COATS = [0x3f7a3a, 0xc8553d, 0x2a78d6, 0xe0a33b, 0x7b5aa6, 0x2f6b6b];
const BUTTERFLIES = [0xf2c14e, 0xffffff, 0xe58fa8, 0x8fb8e5];
const LEAVES = [0xd98c5f, 0xe0a33b, 0xb85c3c];

function pingPong(x: number): number {
  const f = ((x % 2) + 2) % 2;
  const p = f < 1 ? f : 2 - f;
  return p * p * (3 - 2 * p);
}
