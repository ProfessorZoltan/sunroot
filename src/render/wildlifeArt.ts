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
import { keepsakesIn, YOUNG, type Young } from '../game/keepsakes';
import { hexToPixel, tileRandom, type Point } from './layout';

export type ActorKind =
  | 'wildBees'
  | 'otter'
  | 'beaver'
  | 'deer'
  // The coast's, drawn in code until their art comes (drawAnimal).
  | 'tern'
  | 'seal'
  | 'puffin'
  | 'dolphin'
  // The Highland's, drawn in code until their art comes (drawAnimal).
  | 'hare'
  | 'dipper'
  | 'eagle'
  | 'marten'
  // The desert's (their art is delivered: no code drawing).
  | 'fennec'
  | 'sandgrouse'
  | 'falcon'
  | 'oryx'
  // The lake's, drawn in code until their art comes (drawAnimal).
  | 'axolotl'
  | 'heron'
  | 'kingfisher'
  | 'flamingo';

export interface Actor {
  kind: ActorKind;
  /** The tile centres it moves between, there and back. */
  path: Point[];
  /** Where in its round it starts (0 to 1), so animals don't move in step. */
  phase: number;
  /** A young one (a keepsake) beside the animal: drawn smaller, or whitened, until its art comes. */
  young?: Young;
}

/** Where each young one keeps beside its parent, in px. */
const BESIDE: Point[] = [
  { x: -9, y: 5 },
  { x: 10, y: 6 },
];

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
  hares: 'hare',
  dippers: 'dipper',
  eagles: 'eagle',
  martens: 'marten',
  fennecs: 'fennec',
  sandgrouse: 'sandgrouse',
  falcons: 'falcon',
  oryx: 'oryx',
  axolotls: 'axolotl',
  herons: 'heron',
  kingfishers: 'kingfisher',
  flamingos: 'flamingo',
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
  hare: { count: 2, steps: 3 },
  dipper: { count: 2, steps: 2 },
  eagle: { count: 1, steps: 1 },
  marten: { count: 1, steps: 3 },
  fennec: { count: 2, steps: 3 },
  sandgrouse: { count: 3, steps: 2 },
  falcon: { count: 1, steps: 1 },
  oryx: { count: 3, steps: 4 },
  axolotl: { count: 3, steps: 2 },
  heron: { count: 1, steps: 2 },
  kingfisher: { count: 2, steps: 2 },
  flamingo: { count: 5, steps: 3 },
};

/** Whether the animals are shown at all this season (bees keep in over winter, but come out on Lantern Night). */
function hidden(content: Content, state: RunState, kind: ActorKind): boolean {
  const lanterns = festivalThisSeason(content, state)?.showsWildlife ?? false;
  return kind === 'wildBees' && state.season === 'winter' && !lanterns;
}

/** The animals on screen: none until wildlife is on (the procedural deer and otters stand in). */
export function wildlifeActors(content: Content, state: RunState): Actor[] {
  const actors: Actor[] = [];
  const kept = keepsakesIn(state);
  for (const a of animals(content)) {
    const first = actors.length;
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
    // Its young ones, beside the first of them: a step behind, or (the eagles' mate) apart.
    const parent = actors[first];
    for (const young of YOUNG) {
      if (!parent || young.animal !== a.id || !kept.has(young.keepsake)) continue;
      for (let i = 0; i < young.count; i++) {
        const by = young.keepsake === 'eaglePair' ? { x: 18, y: -8 } : BESIDE[i % BESIDE.length]!;
        actors.push({
          kind,
          path: parent.path.map((p) => ({ x: p.x + by.x, y: p.y + by.y })),
          phase:
            (parent.phase + 0.985 - i * 0.012 + (young.keepsake === 'eaglePair' ? 0.3 : 0)) % 1,
          young,
        });
      }
    }
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
  hare: { move: 2500, rest: 5000 },
  dipper: { move: 2000, rest: 4000 },
  eagle: { move: 9000, rest: 6000 },
  marten: { move: 4000, rest: 4000 },
  fennec: { move: 2500, rest: 5000 },
  sandgrouse: { move: 3000, rest: 4000 },
  falcon: { move: 9000, rest: 6000 },
  oryx: { move: 10000, rest: 5000 },
  axolotl: { move: 6000, rest: 5000 },
  heron: { move: 7000, rest: 8000 },
  kingfisher: { move: 1500, rest: 5000 },
  flamingo: { move: 9000, rest: 6000 },
};

/** Where an animal is at a moment, and which frame it shows. With `still`, it keeps to its first tile. */
export function poseAt(actor: Actor, clock: number, still: boolean): Pose {
  // Chicks on the ledge and a pup hauled out keep still, in their resting frame.
  if (actor.young?.rests) still = true;
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
    // The Highland's (ART-EXPANSION.md), drawn in code from the same frame names until art comes.
    case 'hare':
      frame = moving ? `hare.run.${(step % 2) + 1}` : 'hare.sit';
      break;
    case 'dipper':
      frame = `dipper.${(Math.floor(step / 3) % 2) + 1}`;
      break;
    case 'eagle':
      frame = moving ? `eagle.soar.${(Math.floor(step / 4) % 2) + 1}` : 'eagle.perch';
      break;
    case 'marten':
      frame = `marten.${(Math.floor(step / (moving ? 2 : 8)) % 2) + 1}`;
      break;
    // The desert's (ART-EXPANSION.md).
    case 'fennec':
      frame = moving ? `fennec.run.${(step % 2) + 1}` : 'fennec.sit';
      break;
    case 'sandgrouse':
      frame = `sandgrouse.${(Math.floor(step / 3) % 2) + 1}`;
      break;
    case 'falcon':
      frame = moving ? `falcon.fly.${(Math.floor(step / 3) % 2) + 1}` : 'falcon.perch';
      break;
    case 'oryx':
      frame = moving
        ? `oryx.walk.${(step % 4) + 1}`
        : `oryx.graze.${(Math.floor(step / 6) % 2) + 1}`;
      break;
    // The lake's (ART-EXPANSION.md), drawn in code from the same frame names until art comes.
    case 'axolotl':
      frame = moving ? `axolotl.swim.${(Math.floor(step / 2) % 2) + 1}` : 'axolotl.rest';
      break;
    case 'heron':
      frame = moving
        ? `heron.fly.${(Math.floor(step / 4) % 2) + 1}`
        : Math.floor(step / 12) % 3 === 0
          ? 'heron.fish'
          : 'heron.stand';
      break;
    case 'kingfisher':
      frame = moving ? 'kingfisher.dive' : 'kingfisher.perch';
      break;
    case 'flamingo':
      frame = moving
        ? `flamingo.walk.${(step % 2) + 1}`
        : Math.floor(step / 10) % 2 === 0
          ? 'flamingo.feed'
          : 'flamingo.stand';
      break;
  }
  return { x, y, frame, flip };
}

/** The coast's, the Highland's and the lake's animals, drawn in code at tile scale until their art comes. */
export function drawAnimal(g: Graphics, kind: ActorKind, pose: Pose, season = 'summer'): void {
  const { x, y } = pose;
  const dir = pose.flip ? -1 : 1;
  const flap = pose.frame.endsWith('.2') ? 1 : 0;
  const moving =
    /\.(fly|swim|run|soar|walk)\./.test(pose.frame) ||
    /dolphin\.[23]$/.test(pose.frame) ||
    pose.frame === 'kingfisher.dive';
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
    case 'hare': {
      // Brown in summer, white in winter; long ears, stretched out when it runs.
      const coat = season === 'winter' ? 0xf4f4f0 : 0x9a7653;
      const stretch = moving ? 1.5 + flap : 0;
      g.ellipse(x - dir * stretch * 0.5, y - 2.5, 3.6 + stretch, 2.6).fill({ color: coat });
      g.circle(x + dir * (3 + stretch), y - 4.5, 1.9).fill({ color: coat });
      g.moveTo(x + dir * (2.6 + stretch), y - 6)
        .lineTo(x + dir * (1.4 + stretch + (moving ? -1.5 : 0)), y - 10)
        .stroke({ width: 1.1, color: coat, cap: 'round' });
      g.circle(x + dir * (3.8 + stretch), y - 4.8, 0.5).fill({ color: 0x1e1e1e });
      break;
    }
    case 'dipper': {
      // A small dark bird with a white bib, bobbing on a stone in the stream.
      const bob = flap;
      g.ellipse(x, y + 1, 4, 1.6).fill({ color: 0x8c8574 });
      g.ellipse(x, y - 2 + bob, 2.8, 2.2).fill({ color: 0x3b2f2a });
      g.circle(x + dir * 2.2, y - 3.6 + bob, 1.4).fill({ color: 0x3b2f2a });
      g.ellipse(x + dir * 1.3, y - 2.2 + bob, 1, 1.3).fill({ color: 0xffffff });
      break;
    }
    case 'eagle': {
      if (moving) {
        // Soaring high over the crags: broad wings, fingered tips.
        const yy = y - 26 - flap;
        g.moveTo(x - 9, yy - 1 - flap)
          .quadraticCurveTo(x - 4, yy - 3, x, yy)
          .quadraticCurveTo(x + 4, yy - 3, x + 9, yy - 1 - flap)
          .stroke({ width: 2.2, color: 0x5a4030, cap: 'round', join: 'round' });
        g.circle(x + dir * 1, yy - 0.5, 1).fill({ color: 0xc89a4a });
      } else {
        // Perched on the lookout's top.
        const yy = y - 18;
        g.ellipse(x, yy, 2.4, 3.6).fill({ color: 0x5a4030 });
        g.circle(x + dir * 1.2, yy - 3.8, 1.5).fill({ color: 0xc89a4a });
        g.poly([x + dir * 2.4, yy - 4.2, x + dir * 3.8, yy - 3.4, x + dir * 2.4, yy - 3]).fill({
          color: 0xe0b23a,
        });
      }
      break;
    }
    case 'marten': {
      // A long dark-brown body, a cream throat and a bushy tail, among the pines.
      const arch = moving ? flap * 1.2 : 0;
      g.ellipse(x, y - 2 - arch, 4.2, 1.8).fill({ color: 0x5b3a22 });
      g.circle(x + dir * 4.2, y - 3, 1.7).fill({ color: 0x5b3a22 });
      g.circle(x + dir * 4.4, y - 2.1, 0.9).fill({ color: 0xf0d9a8 });
      g.moveTo(x - dir * 3.8, y - 2)
        .quadraticCurveTo(x - dir * 7, y - 1 - arch, x - dir * 8, y - 4)
        .stroke({ width: 1.8, color: 0x5b3a22, cap: 'round' });
      break;
    }
    case 'axolotl': {
      // A small pink axolotl in the canal, its frilly gills out, its tail swishing as it swims.
      const swish = moving ? (flap ? 1.2 : -1.2) : 0;
      g.ellipse(x, y, 4, 1.6).fill({ color: 0xf2a7b8 });
      g.circle(x + dir * 3.6, y - 0.4, 1.7).fill({ color: 0xf2a7b8 });
      for (const dy of [-1.6, 0, 1.4])
        g.moveTo(x + dir * 2.6, y - 0.4 + dy * 0.6)
          .lineTo(x + dir * 1.4, y - 0.6 + dy * 1.4)
          .stroke({ width: 0.9, color: 0xd9667f, cap: 'round' });
      g.moveTo(x - dir * 3.6, y)
        .lineTo(x - dir * 6.5, y + swish)
        .stroke({ width: 1.2, color: 0xf2a7b8, cap: 'round' });
      g.circle(x + dir * 4.2, y - 0.8, 0.4).fill({ color: 0x1e1e1e });
      break;
    }
    case 'heron': {
      if (moving) {
        // Flying low over the water, its neck folded, slow wingbeats.
        const yy = y - 18;
        g.moveTo(x - 8, yy - 1 - flap * 2)
          .quadraticCurveTo(x - 3, yy - 3, x, yy)
          .quadraticCurveTo(x + 3, yy - 3, x + 8, yy - 1 - flap * 2)
          .stroke({ width: 2, color: 0x8a95a0, cap: 'round', join: 'round' });
        g.circle(x + dir * 1.8, yy + 0.4, 1.3).fill({ color: 0x8a95a0 });
        g.moveTo(x + dir * 2.8, yy + 0.6)
          .lineTo(x + dir * 5.4, yy + 1)
          .stroke({ width: 0.9, color: 0xe0b23a, cap: 'round' });
      } else {
        // Standing in the reeds on long legs; stabbing at a fish now and then.
        const fish = pose.frame === 'heron.fish';
        g.moveTo(x - 1, y)
          .lineTo(x - 1, y - 6)
          .moveTo(x + 1, y)
          .lineTo(x + 1, y - 6)
          .stroke({ width: 0.8, color: 0x6d5a3e });
        g.ellipse(x, y - 8, 2.6, 3.4).fill({ color: 0x9aa5ae });
        const hx = x + dir * (fish ? 4 : 1.5);
        const hy = y - (fish ? 6 : 14);
        g.moveTo(x + dir * 0.8, y - 10)
          .lineTo(hx, hy)
          .stroke({ width: 1.2, color: 0xdfe4e8, cap: 'round' });
        g.circle(hx, hy, 1.2).fill({ color: 0xdfe4e8 });
        g.moveTo(hx + dir * 0.8, hy)
          .lineTo(hx + dir * 3.4, hy + (fish ? 2 : 0.4))
          .stroke({ width: 0.9, color: 0xe0b23a, cap: 'round' });
      }
      break;
    }
    case 'kingfisher': {
      // A small bright bird on a willow twig; now and then a blue streak down to the water.
      if (moving) {
        g.moveTo(x - dir * 6, y - 10)
          .lineTo(x, y - 2)
          .stroke({ width: 1.6, color: 0x2f8fd0, cap: 'round' });
        g.circle(x, y - 2, 1.4).fill({ color: 0xe8803a });
      } else {
        const yy = y - 10;
        g.moveTo(x - 4, yy + 2.4)
          .lineTo(x + 4, yy + 2)
          .stroke({ width: 0.8, color: 0x7a5a3a });
        g.ellipse(x, yy, 1.8, 2.2).fill({ color: 0x2f8fd0 });
        g.ellipse(x + dir * 0.4, yy + 0.6, 1.1, 1.3).fill({ color: 0xe8803a });
        g.circle(x + dir * 1.2, yy - 2, 1.2).fill({ color: 0x2f8fd0 });
        g.moveTo(x + dir * 2.2, yy - 2)
          .lineTo(x + dir * 4.4, yy - 1.8)
          .stroke({ width: 0.8, color: 0x1e1e1e, cap: 'round' });
      }
      break;
    }
    case 'flamingo': {
      // Pink, on long legs in the open shallows; head down to feed, or up.
      const feed = pose.frame === 'flamingo.feed';
      const step = moving ? flap * 1.5 : 0;
      g.moveTo(x - 0.8, y)
        .lineTo(x - 0.8 + step, y - 6)
        .moveTo(x + 0.8, y)
        .lineTo(x + 0.8 - step, y - 6)
        .stroke({ width: 0.8, color: 0xe57b8c });
      g.ellipse(x, y - 8, 3, 2).fill({ color: 0xf29aac });
      const hx = x + dir * (feed ? 3.6 : 1.6);
      const hy = y - (feed ? 2 : 14);
      g.moveTo(x + dir * 1.8, y - 8.6)
        .quadraticCurveTo(x + dir * 3.4, y - 12, hx, hy)
        .stroke({ width: 1.1, color: 0xf29aac, cap: 'round' });
      g.circle(hx, hy, 1.1).fill({ color: 0xf29aac });
      g.circle(hx + dir * 1, hy + 0.4, 0.6).fill({ color: 0x2a2a2a });
      break;
    }
    default:
      break;
  }
}

export interface Prop {
  /** A festival's bunting and lanterns, and the settlement's keepsakes (keepsakeArt.ts). */
  kind: 'bunting' | 'lantern' | 'banner' | 'windowBox' | 'birdBox';
  at: Point;
  /** Bunting: the far end of its string. */
  to?: Point;
  lit?: boolean;
  /** The banner's colour. */
  color?: string;
}

/**
 * A festival's props this season: bunting from the camp to its neighbours; lanterns at homes.
 * The Bunting keepsake keeps the bunting up all year.
 */
export function festivalProps(content: Content, state: RunState): Prop[] {
  const f = festivalThisSeason(content, state);
  if (!f && !keepsakesIn(state).has('bunting')) return [];
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
  if (f?.showsWildlife) {
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
