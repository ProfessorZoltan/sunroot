/**
 * The valley's animals on the map (EXPANSION.md, E4), while wildlife is on:
 * the animals living in the valley move between their habitat tiles, for show
 * (their effects depend only on the habitat). And a festival's props: bunting
 * around the camp while one is held, lanterns at the homes on Lantern Night.
 *
 * Everything here is worked out from the run state; the map view turns it
 * into sprites and moves them with its clock.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexDistance, hexKey } from '../sim/hex';
import { defOf, isHome } from '../sim/queries';
import type { RunState } from '../sim/types';
import { animals, festivalThisSeason, habitatOf } from '../sim/wildlife';
import { hexToPixel, tileRandom, type Point } from './layout';

export type ActorKind =
  | 'wildBees'
  | 'otter'
  | 'beaver'
  | 'deer'
  // The coast's, drawn in code until their art comes (drawCoastAnimal).
  | 'tern'
  | 'seal'
  | 'puffin'
  | 'dolphin';

export interface Actor {
  kind: ActorKind;
  /** The tile centres it moves between, there and back. */
  path: Point[];
  /** Where in its round it starts (0 to 1), so animals don't move in step. */
  phase: number;
}

/** Which art each animal uses. */
const KIND: Record<string, ActorKind> = {
  wildBees: 'wildBees',
  otters: 'otter',
  beavers: 'beaver',
  deer: 'deer',
  terns: 'tern',
  seals: 'seal',
  puffins: 'puffin',
  dolphins: 'dolphin',
};

/** How many of each animal show at most, and over how many tiles each moves. */
const SHOWN: Record<ActorKind, { count: number; steps: number }> = {
  wildBees: { count: 3, steps: 2 },
  otter: { count: 2, steps: 3 },
  beaver: { count: 1, steps: 2 },
  deer: { count: 2, steps: 4 },
  tern: { count: 3, steps: 3 },
  seal: { count: 2, steps: 2 },
  puffin: { count: 2, steps: 1 },
  dolphin: { count: 2, steps: 4 },
};

/** Whether the animals are shown at all this season (bees keep in over winter, but come out on Lantern Night). */
function hidden(content: Content, state: RunState, kind: ActorKind): boolean {
  const lanterns = festivalThisSeason(content, state)?.showsWildlife ?? false;
  return kind === 'wildBees' && state.season === 'winter' && !lanterns;
}

/** The animals on screen: none until wildlife is on (the procedural deer and otters stand in). */
export function wildlifeActors(content: Content, state: RunState): Actor[] {
  const actors: Actor[] = [];
  for (const a of animals(content)) {
    if (!state.wildlife.includes(a.id)) continue;
    const kind = KIND[a.id];
    if (!kind || hidden(content, state, kind)) continue;
    const tiles = habitatOf(state, a).tiles.map((k) => state.map.tiles[k]!);
    if (tiles.length === 0) continue;
    const { count, steps } = SHOWN[kind];
    // Each starts on a tile of its habitat, the same every time, and walks to the nearest others.
    const starts = tiles
      .map((t) => ({ t, rank: tileRandom(`${hexKey(t)}:${a.id}`)() }))
      .sort((x, y) => x.rank - y.rank)
      .slice(0, count);
    starts.forEach(({ t, rank }, i) => {
      const near = tiles
        .filter((o) => o !== t && hexDistance(o, t) <= 2)
        .sort((x, y) => hexDistance(x, t) - hexDistance(y, t) || hexKey(x).localeCompare(hexKey(y)))
        .slice(0, steps - 1);
      const path = [t, ...near].map((h) => hexToPixel(h));
      // Alone on one tile, it moves about inside it.
      if (path.length === 1) path.push({ x: path[0]!.x + 14, y: path[0]!.y + 4 });
      actors.push({ kind, path, phase: (rank + i * 0.37) % 1 });
    });
  }
  return actors;
}

export interface Pose {
  x: number;
  y: number;
  /** The art's frame name, e.g. `deer.walk.2` or `otter.rest`. */
  frame: string;
  /** Facing left: the art faces right, so it is mirrored. */
  flip: boolean;
}

/** How long an animal takes over each stretch of its path, and how long it rests at each tile. */
const PACE: Record<ActorKind, { move: number; rest: number }> = {
  wildBees: { move: 5000, rest: 2500 },
  otter: { move: 6000, rest: 3000 },
  beaver: { move: 7000, rest: 4000 },
  deer: { move: 9000, rest: 5000 },
  tern: { move: 3000, rest: 2000 },
  seal: { move: 8000, rest: 6000 },
  puffin: { move: 4000, rest: 4000 },
  dolphin: { move: 5000, rest: 1500 },
};

/** Where an animal is at a moment, and which frame it shows. With `still`, it keeps to its first tile. */
export function poseAt(actor: Actor, clock: number, still: boolean): Pose {
  const { kind, path } = actor;
  // There and back: 0 → n-1 → 0.
  const stops = [...path, ...path.slice(1, -1).reverse()];
  const { move, rest } = PACE[kind];
  const leg = move + rest;
  const round = stops.length * leg;
  const t = still ? 0 : (clock + actor.phase * round) % round;
  const i = Math.floor(t / leg);
  const into = t - i * leg;
  const from = stops[i]!;
  const to = stops[(i + 1) % stops.length]!;
  const moving = !still && into >= rest;
  const f = moving ? (into - rest) / move : 0;
  const ease = f * f * (3 - 2 * f);
  // A little off the centre, so animals don't stand on buildings' doorsteps.
  const lift = kind === 'wildBees' ? -10 + Math.sin(clock / 300 + actor.phase * 9) * 2 : 4;
  const x = from.x + (to.x - from.x) * ease + (kind === 'wildBees' ? Math.sin(clock / 700) * 3 : 0);
  const y = from.y + (to.y - from.y) * ease + lift;
  const flip =
    (moving ? to.x - from.x : stops[(i + stops.length - 1) % stops.length]!.x - from.x) < 0;
  const step = still ? 0 : Math.floor(clock / 160 + actor.phase * 7);
  let frame: string;
  switch (kind) {
    case 'wildBees':
      frame = `wildBees.${(step % 3) + 1}`;
      break;
    case 'otter':
      frame = moving ? `otter.swim.${(Math.floor(step / 2) % 2) + 1}` : 'otter.rest';
      break;
    case 'beaver':
      frame = moving ? `beaver.swim.${(Math.floor(step / 2) % 2) + 1}` : 'beaver.carry';
      break;
    case 'deer':
      frame = moving
        ? `deer.walk.${(step % 4) + 1}`
        : `deer.graze.${(Math.floor(step / 6) % 2) + 1}`;
      break;
    // The coast's (ART-EXPANSION.md); drawn in code from the same frame names until art comes.
    case 'tern':
      frame = moving ? `tern.fly.${(step % 2) + 1}` : 'tern.rest';
      break;
    case 'seal':
      frame = moving ? `seal.swim.${(Math.floor(step / 2) % 2) + 1}` : 'seal.rest';
      break;
    case 'puffin':
      frame = `puffin.${(Math.floor(step / 4) % 2) + 1}`;
      break;
    case 'dolphin':
      frame = moving ? `dolphin.${(Math.floor(step / 2) % 3) + 1}` : 'dolphin.1';
      break;
  }
  return { x, y, frame, flip };
}

/** The coast's animals, drawn in code at tile scale until their art comes. */
export function drawCoastAnimal(g: Graphics, kind: ActorKind, pose: Pose): void {
  const { x, y } = pose;
  const dir = pose.flip ? -1 : 1;
  const flap = pose.frame.endsWith('.2') ? 1 : 0;
  const moving = /\.(fly|swim)\./.test(pose.frame) || /dolphin\.[23]$/.test(pose.frame);
  switch (kind) {
    case 'tern': {
      // A white bird with a black cap, wings up or down, a little above the dunes.
      const yy = y - 12;
      g.moveTo(x - 5, yy - 2 - flap * 2)
        .lineTo(x, yy)
        .lineTo(x + 5, yy - 2 - flap * 2)
        .stroke({ width: 1.4, color: 0xffffff, cap: 'round', join: 'round' });
      g.circle(x + dir * 1.5, yy - 0.5, 1.1).fill({ color: 0x222222 });
      break;
    }
    case 'seal':
      g.ellipse(x, y, 6.5, 2.8).fill({ color: 0x7c8287 });
      g.circle(x + dir * 6, y - 1.5, 2.2).fill({ color: 0x7c8287 });
      g.circle(x + dir * 6.8, y - 2, 0.6).fill({ color: 0x1e1e1e });
      break;
    case 'puffin':
      g.ellipse(x, y - 3, 2.6, 3.6).fill({ color: 0x222222 });
      g.ellipse(x + dir * 0.6, y - 2.5, 1.5, 2.6).fill({ color: 0xffffff });
      g.poly([x + dir * 2, y - 6, x + dir * 4.5, y - 5.2, x + dir * 2, y - 4.4]).fill({
        color: 0xe58f4a,
      });
      break;
    case 'dolphin': {
      // A grey back and fin rising out of the water, a ripple behind.
      const rise = moving ? 1.5 + (pose.frame.endsWith('.3') ? 2 : flap) : 0.5;
      g.moveTo(x - 6, y)
        .quadraticCurveTo(x, y - 3 - rise, x + 6, y)
        .stroke({ width: 2.4, color: 0x6c7a82, cap: 'round' });
      g.poly([x - 1, y - 2 - rise, x + 1.5, y - 5 - rise, x + 2.5, y - 1.5 - rise]).fill({
        color: 0x6c7a82,
      });
      g.moveTo(x - 10 * dir, y + 1)
        .lineTo(x - 7 * dir, y + 1)
        .stroke({ width: 1, color: 0xe4f2f5 });
      break;
    }
    default:
      break;
  }
}

export interface Prop {
  kind: 'bunting' | 'lantern';
  at: Point;
  /** Bunting: the far end of its string. */
  to?: Point;
  lit?: boolean;
}

/** A festival's props this season: bunting from the camp to its neighbours; lanterns at homes. */
export function festivalProps(content: Content, state: RunState): Prop[] {
  const f = festivalThisSeason(content, state);
  if (!f) return [];
  const props: Prop[] = [];
  const camp = Object.values(state.buildings).find((b) => b.type === content.campBuilding);
  if (camp) {
    const near = Object.values(state.buildings)
      // Strung to buildings, not to the channels.
      .filter(
        (b) => b !== camp && hexDistance(b.at, camp.at) === 1 && !defOf(content, b).water?.channel,
      )
      .sort((x, y) => hexKey(x.at).localeCompare(hexKey(y.at)))
      .slice(0, 4);
    const c = hexToPixel(camp.at);
    for (const b of near) {
      const p = hexToPixel(b.at);
      props.push({ kind: 'bunting', at: { x: c.x, y: c.y - 14 }, to: { x: p.x, y: p.y - 14 } });
    }
  }
  if (f.showsWildlife) {
    const homes = state.priority
      .map((uid) => state.buildings[uid]!)
      .filter((b) => isHome(defOf(content, b)))
      .slice(0, 10);
    for (const h of homes) {
      const p = hexToPixel(h.at);
      props.push({ kind: 'lantern', at: { x: p.x + 11, y: p.y - 18 }, lit: true });
    }
  }
  return props;
}
