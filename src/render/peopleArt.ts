/**
 * The citizens and the fish in hand-made art (docs/ART-PEOPLE.md): which of the cast each walker
 * is, the colour of their clothes and their size; where they are and which frame they show; and
 * the fish's leap. Until a piece of art comes, ambient.ts draws it in code as before.
 */
import type { Point } from './layout';

/** The cast: citizen.1 to citizen.12. */
export const CAST_SIZE = 12;

/** The clothing colours the game tints the clothes layer with. */
export const CLOTHES = [
  0x3f7a3a, // moss
  0xc8553d, // brick
  0x2a78d6, // cornflower
  0xe0a33b, // ochre
  0x7b5aa6, // plum
  0x2f6b6b, // teal
  0xd9798a, // rose
  0xcdb48a, // sand
] as const;

/** The citizens delivered: those with a first walking (or rolling) frame. */
export function castOf(has: (name: string) => boolean): number[] {
  return Array.from({ length: CAST_SIZE }, (_, i) => i + 1).filter(
    (n) => has(`citizen.${n}.walk.1`) || has(`citizen.${n}.roll.1`),
  );
}

export interface WalkerLook {
  /** Which of the cast. */
  citizen: number;
  /** The clothes' tint. */
  color: number;
  /** A little taller or shorter than painted, so no two adults match (±5%). */
  size: number;
}

/** Walker i's look: different neighbours in the cast and in colour, the same every time. */
export function walkerLook(i: number, cast: number[]): WalkerLook | null {
  if (cast.length === 0) return null;
  // Steps of 5 and 3 through the cast and the colours keep neighbours apart.
  return {
    citizen: cast[(i * 5) % cast.length]!,
    color: CLOTHES[(i * 3 + 1) % CLOTHES.length]!,
    size: 1 + (((i * 7) % 5) - 2) * 0.025,
  };
}

/** Walking one way, and resting at each end (at home, then at work), in ms. */
export const WALK = 5200;
export const PAUSE = 1800;
const ROUND = 2 * (WALK + PAUSE);

export interface WalkerPose {
  x: number;
  y: number;
  /** The frame, e.g. `walk.3`, `stand` or `work`. */
  frame: string;
  /** Facing left (the art faces right). */
  flip: boolean;
}

/**
 * Where walker i is, between home (`from`) and work (`to`), and what it is doing: resting at home,
 * walking there, working, walking back. Still (reduced motion): standing half way.
 */
export function walkerPose(
  w: { from: Point; to: Point },
  i: number,
  clock: number,
  still: boolean,
  rolls: boolean,
): WalkerPose {
  const at = (p: number) => ({
    x: w.from.x + (w.to.x - w.from.x) * p,
    // Feet on the ground a little below the tile's centre, as the code-drawn walkers stand.
    y: w.from.y + (w.to.y - w.from.y) * p + 14,
  });
  const right = w.to.x >= w.from.x;
  if (still) return { ...at(0.5), frame: 'stand', flip: !right };
  const t = (clock + i * 0.37 * ROUND) % ROUND;
  const step = Math.floor(clock / 160 + i * 3);
  const moving = rolls ? `roll.${(step % 2) + 1}` : `walk.${(step % 4) + 1}`;
  if (t < PAUSE) return { ...at(0), frame: 'stand', flip: right };
  if (t < PAUSE + WALK) return { ...at((t - PAUSE) / WALK), frame: moving, flip: !right };
  if (t < 2 * PAUSE + WALK) return { ...at(1), frame: 'work', flip: !right };
  return { ...at(1 - (t - 2 * PAUSE - WALK) / WALK), frame: moving, flip: right };
}

/** The art's names for a land's leaping fish (`fish.coast.leap`), the valley's if it has none. */
export function fishName(land: string, has: (name: string) => boolean): string | null {
  const own = `fish.${land}.leap`;
  if (land !== 'valley' && has(`${own}.1`)) return own;
  return has('fish.leap.1') ? 'fish.leap' : null;
}

export interface FishPose {
  x: number;
  y: number;
  /** 1 rising, 2 at the top, 3 diving. */
  frame: 1 | 2 | 3;
}

/** Fish i's leap: in the air for a moment, then a long pause (null) while its rings spread. */
export function fishPose(c: Point, i: number, clock: number, still: boolean): FishPose | null {
  // The same leap as the code-drawn fish (ambient.ts).
  const cycle = still ? 0.5 : ((clock / 3600 + i * 0.41) % 1) * 2.4;
  if (cycle > 1) return null;
  return {
    x: c.x - 8 + cycle * 16,
    y: c.y + 6 - Math.sin(Math.PI * cycle) * 12,
    frame: cycle < 0.34 ? 1 : cycle < 0.67 ? 2 : 3,
  };
}
