/**
 * One small papercraft drawing per building, in the style of the mockup:
 * flat shapes with a soft shadow, drawn around the tile centre in a box of
 * about 36 x 30 px. Hand-made art can replace any entry later.
 */
import type { Graphics } from 'pixi.js';
import type { Point } from './layout';
import { hexCorners } from './layout';
import { COLORS } from './palette';

type Art = (g: Graphics, c: Point) => void;

const ROOF = COLORS.terracotta;
const WALL = COLORS.wall;
const DARK = 0x5a3a24;

function shadow(g: Graphics, c: Point, w = 13, h = 4, dy = 9): void {
  g.ellipse(c.x + 1, c.y + dy, w, h).fill({ color: COLORS.shadow, alpha: 0.16 });
}

function house(g: Graphics, x: number, y: number, s = 1, roof: number = ROOF): void {
  g.rect(x - 7 * s, y - 3 * s, 14 * s, 10 * s).fill({ color: WALL });
  g.poly([x - 9 * s, y - 2 * s, x, y - 10 * s, x + 9 * s, y - 2 * s]).fill({ color: roof });
  g.rect(x - 2 * s, y + 2 * s, 4 * s, 5 * s).fill({ color: DARK });
}

function tree(g: Graphics, x: number, y: number, r = 5, fruit = false): void {
  g.rect(x - 1, y + r - 2, 2, 5).fill({ color: COLORS.wood });
  g.circle(x, y, r).fill({ color: COLORS.treeLight });
  if (fruit) {
    g.circle(x - 2, y - 1, 1.3).fill({ color: COLORS.fruit });
    g.circle(x + 2, y + 1.5, 1.3).fill({ color: COLORS.fruit });
  }
}

const MUD = 0xc79f72;

function palm(g: Graphics, x: number, y: number): void {
  g.moveTo(x, y + 8)
    .quadraticCurveTo(x + 1, y + 2, x, y - 4)
    .stroke({ width: 1.8, color: COLORS.wood });
  for (const [dx, dy] of [
    [-6, -2],
    [6, -2],
    [-4, -7],
    [4, -7],
  ] as const)
    g.moveTo(x, y - 4)
      .quadraticCurveTo(x + dx / 2, y - 7, x + dx, y - 4 + dy / 2)
      .stroke({ width: 2, color: COLORS.treeDark, cap: 'round' });
}

function panel(g: Graphics, c: Point, fill: number, line: number): void {
  g.poly([c.x - 12, c.y + 6, c.x - 7, c.y - 6, c.x + 12, c.y - 6, c.x + 7, c.y + 6]).fill({
    color: fill,
  });
  g.moveTo(c.x - 9.5, c.y)
    .lineTo(c.x + 9.5, c.y)
    .moveTo(c.x - 2, c.y - 6)
    .lineTo(c.x - 4, c.y + 6)
    .moveTo(c.x + 5, c.y - 6)
    .lineTo(c.x + 3, c.y + 6)
    .stroke({ width: 1, color: line });
  g.moveTo(c.x - 6, c.y + 6)
    .lineTo(c.x - 6, c.y + 10)
    .moveTo(c.x + 5, c.y + 6)
    .lineTo(c.x + 5, c.y + 10)
    .stroke({ width: 1.5, color: DARK });
}

export const BUILDING_ART: Record<string, Art> = {
  foundersCamp(g, c) {
    shadow(g, c, 14);
    g.poly([c.x - 12, c.y + 8, c.x, c.y - 10, c.x + 12, c.y + 8]).fill({ color: ROOF });
    g.poly([c.x - 3, c.y + 8, c.x, c.y - 1, c.x + 3, c.y + 8]).fill({ color: DARK });
    g.moveTo(c.x, c.y - 10)
      .lineTo(c.x, c.y - 17)
      .stroke({ width: 1.3, color: DARK });
    g.poly([c.x, c.y - 17, c.x + 6, c.y - 15, c.x, c.y - 13]).fill({ color: COLORS.sunGold });
  },
  floodplainFarm(g, c) {
    g.poly(hexCorners(c, 22))
      .fill({ color: COLORS.field })
      .stroke({ width: 1.5, color: COLORS.leadingGold });
    for (let i = -2; i <= 2; i++) {
      g.moveTo(c.x - 14, c.y + i * 5 + 3).lineTo(c.x + 14, c.y + i * 5 - 3);
    }
    g.stroke({ width: 1.2, color: COLORS.furrow });
  },
  orchard(g, c) {
    shadow(g, c, 14, 4, 10);
    tree(g, c.x - 8, c.y - 2, 5.5, true);
    tree(g, c.x + 7, c.y - 4, 5.5, true);
    tree(g, c.x, c.y + 4, 5.5, true);
  },
  apiary(g, c) {
    shadow(g, c, 9);
    g.roundRect(c.x - 7, c.y - 8, 14, 15, 5)
      .fill({ color: 0xf6d98a })
      .stroke({ width: 1.5, color: 0x8a5a1c });
    g.moveTo(c.x - 7, c.y - 3)
      .lineTo(c.x + 7, c.y - 3)
      .moveTo(c.x - 7, c.y + 2)
      .lineTo(c.x + 7, c.y + 2);
    g.stroke({ width: 1.3, color: 0x8a5a1c });
    g.circle(c.x + 11, c.y - 9, 1.8).fill({ color: DARK });
  },
  fishPond(g, c) {
    g.ellipse(c.x, c.y + 1, 14, 9)
      .fill({ color: COLORS.water })
      .stroke({ width: 1.5, color: 0x7fb3b8 });
    g.poly([c.x - 5, c.y + 1, c.x + 3, c.y - 2, c.x + 3, c.y + 4]).fill({ color: 0xe58f4a });
    g.poly([c.x + 3, c.y + 1, c.x + 7, c.y - 2, c.x + 7, c.y + 4]).fill({ color: 0xe58f4a });
  },
  greenhouse(g, c) {
    shadow(g, c, 14);
    g.rect(c.x - 12, c.y - 3, 24, 11)
      .fill({ color: 0xcfe7ee, alpha: 0.95 })
      .stroke({ width: 1.3, color: 0x6c9fae });
    g.moveTo(c.x - 12, c.y - 3)
      .quadraticCurveTo(c.x, c.y - 16, c.x + 12, c.y - 3)
      .fill({ color: 0xe7f4f6 })
      .stroke({ width: 1.3, color: 0x6c9fae });
    g.circle(c.x - 5, c.y + 3, 2).fill({ color: COLORS.treeLight });
    g.circle(c.x + 4, c.y + 3, 2).fill({ color: COLORS.treeLight });
  },
  composter(g, c) {
    shadow(g, c, 12, 4, 7);
    g.ellipse(c.x, c.y + 3, 11, 6).fill({ color: 0x7a5236 });
    g.ellipse(c.x - 2, c.y + 1, 6, 3).fill({ color: 0x96673f });
    g.moveTo(c.x - 4, c.y - 4)
      .quadraticCurveTo(c.x - 7, c.y - 8, c.x - 4, c.y - 12)
      .moveTo(c.x + 3, c.y - 4)
      .quadraticCurveTo(c.x, c.y - 8, c.x + 3, c.y - 12)
      .stroke({ width: 1.3, color: 0xfffdf6, alpha: 0.9, cap: 'round' });
  },
  salvageYard(g, c) {
    shadow(g, c, 13);
    g.rect(c.x - 12, c.y + 2, 8, 5).fill({ color: COLORS.stone });
    g.rect(c.x - 3, c.y + 4, 7, 4).fill({ color: 0xa89c86 });
    g.moveTo(c.x + 7, c.y + 8)
      .lineTo(c.x + 7, c.y - 12)
      .lineTo(c.x - 6, c.y - 12)
      .stroke({ width: 2, color: 0x3f4a36 });
    g.moveTo(c.x - 6, c.y - 12)
      .lineTo(c.x - 6, c.y - 4)
      .stroke({ width: 1, color: 0x3f4a36 });
    g.rect(c.x - 8, c.y - 4, 4, 3).fill({ color: COLORS.sunGold });
  },
  workshop(g, c) {
    shadow(g, c, 14);
    g.rect(c.x - 12, c.y - 3, 24, 11).fill({ color: WALL });
    g.poly([
      c.x - 12,
      c.y - 3,
      c.x - 12,
      c.y - 9,
      c.x - 4,
      c.y - 3,
      c.x - 4,
      c.y - 9,
      c.x + 4,
      c.y - 3,
      c.x + 4,
      c.y - 9,
      c.x + 12,
      c.y - 3,
    ]).fill({ color: ROOF });
    g.rect(c.x - 3, c.y + 1, 6, 7).fill({ color: DARK });
  },
  kiln(g, c) {
    shadow(g, c, 12);
    g.rect(c.x + 3, c.y - 14, 5, 12).fill({ color: 0x8a4a24 });
    g.moveTo(c.x - 11, c.y + 8)
      .quadraticCurveTo(c.x - 11, c.y - 8, c.x, c.y - 8)
      .quadraticCurveTo(c.x + 11, c.y - 8, c.x + 11, c.y + 8)
      .closePath()
      .fill({ color: 0xc9774a });
    g.moveTo(c.x - 4, c.y + 8)
      .quadraticCurveTo(c.x, c.y - 1, c.x + 4, c.y + 8)
      .fill({ color: 0xf2a14a });
    g.circle(c.x + 6, c.y - 18, 2.5).fill({ color: 0xd2c4aa, alpha: 0.8 });
  },
  cottage(g, c) {
    shadow(g, c);
    house(g, c.x, c.y);
  },
  commonsPlaza(g, c) {
    g.ellipse(c.x, c.y + 2, 14, 9)
      .fill({ color: 0xe8dcc0 })
      .stroke({ width: 1.3, color: 0xc9b98e });
    g.circle(c.x, c.y + 1, 4).fill({ color: COLORS.water });
    tree(g, c.x - 9, c.y - 4, 4);
    tree(g, c.x + 9, c.y - 4, 4);
    g.circle(c.x + 5, c.y + 7, 1.5).fill({ color: COLORS.flowerPink });
  },
  ciderPress(g, c) {
    shadow(g, c, 12);
    // A timber press house with a barrel and a few apples.
    g.rect(c.x - 9, c.y - 5, 14, 12).fill({ color: COLORS.wood });
    g.poly([c.x - 11, c.y - 5, c.x - 2, c.y - 13, c.x + 7, c.y - 5]).fill({ color: ROOF });
    g.roundRect(c.x + 5, c.y - 1, 7, 9, 2).fill({ color: 0xa8743f });
    g.rect(c.x + 5, c.y + 2, 7, 1.2).fill({ color: DARK });
    for (const [dx, dy] of [
      [-6, 9],
      [-2, 10],
      [2, 9],
    ] as const)
      g.circle(c.x + dx, c.y + dy, 1.8).fill({ color: 0xc4513f });
  },
  seedbankLibrary(g, c) {
    shadow(g, c, 13);
    g.rect(c.x - 10, c.y - 6, 20, 14).fill({ color: WALL });
    for (const dx of [-6, -1, 4]) g.rect(c.x + dx, c.y - 4, 2, 10).fill({ color: 0xd8c29a });
    g.poly([c.x - 12, c.y - 6, c.x, c.y - 15, c.x + 12, c.y - 6]).fill({ color: COLORS.solarTeal });
  },
  treeNursery(g, c) {
    shadow(g, c, 14);
    for (const [dx, dy] of [
      [-9, -3],
      [0, -3],
      [9, -3],
      [-5, 5],
      [5, 5],
    ] as const) {
      g.rect(c.x + dx - 2.5, c.y + dy + 1, 5, 4).fill({ color: COLORS.wood });
      g.circle(c.x + dx, c.y + dy - 1, 3.2).fill({ color: COLORS.treeLight });
    }
  },
  pollinatorMeadow(g, c) {
    const flowers = [
      [-8, -3, COLORS.flowerPink],
      [3, -7, COLORS.sunGold],
      [8, 2, COLORS.flowerPink],
      [-2, 5, 0xffffff],
      [-10, 6, COLORS.sunGold],
      [5, 8, 0xffffff],
    ] as const;
    for (const [dx, dy, color] of flowers) {
      g.moveTo(c.x + dx, c.y + dy)
        .lineTo(c.x + dx, c.y + dy + 5)
        .stroke({ width: 1, color: COLORS.good });
      g.circle(c.x + dx, c.y + dy, 2.4).fill({ color });
    }
  },
  weir(g, c) {
    g.rect(c.x - 16, c.y - 4, 32, 8)
      .fill({ color: 0xa89c86 })
      .stroke({ width: 1.2, color: 0x7a7060 });
    for (const dx of [-10, -2, 6]) g.rect(c.x + dx, c.y - 4, 4, 8).fill({ color: COLORS.stone });
    g.moveTo(c.x - 12, c.y + 8)
      .quadraticCurveTo(c.x - 6, c.y + 5, c.x, c.y + 8)
      .quadraticCurveTo(c.x + 6, c.y + 11, c.x + 12, c.y + 8)
      .stroke({ width: 1.5, color: 0xffffff, alpha: 0.8 });
  },
  levee(g, c) {
    g.moveTo(c.x - 15, c.y + 6)
      .quadraticCurveTo(c.x, c.y - 10, c.x + 15, c.y + 6)
      .stroke({ width: 7, color: 0x9a7b52, cap: 'round' });
    g.moveTo(c.x - 13, c.y + 4)
      .quadraticCurveTo(c.x, c.y - 11, c.x + 13, c.y + 4)
      .stroke({ width: 2, color: COLORS.treeLight, cap: 'round' });
  },
  /** A basin of ditch; on the map, arms join it to its neighbours (waterArt.ts). */
  irrigationChannel(g, c) {
    g.circle(c.x, c.y, 7.5).fill({ color: 0x6b5232, alpha: 0.75 });
    g.circle(c.x, c.y, 5).fill({ color: 0x9a9a78 });
    g.circle(c.x, c.y, 3).fill({ color: 0x58a7cf });
  },
  cistern(g, c) {
    shadow(g, c, 12, 4, 8);
    g.ellipse(c.x, c.y + 4, 11, 5).fill({ color: COLORS.stone });
    g.rect(c.x - 11, c.y - 4, 22, 8).fill({ color: COLORS.stone });
    g.ellipse(c.x, c.y - 4, 11, 5).fill({ color: 0xb8ad98 });
    g.ellipse(c.x, c.y - 4, 8.5, 3.5).fill({ color: 0x6fb3cf });
    g.moveTo(c.x - 11, c.y)
      .lineTo(c.x + 11, c.y)
      .stroke({ width: 1, color: 0x7d7262 });
  },
  /** A stone well under a little gabled roof, with its bucket. */
  well(g, c) {
    shadow(g, c, 11, 4, 8);
    g.ellipse(c.x, c.y + 5, 9, 4).fill({ color: COLORS.stone });
    g.rect(c.x - 9, c.y - 1, 18, 6).fill({ color: COLORS.stone });
    g.ellipse(c.x, c.y - 1, 9, 4).fill({ color: 0xb8ad98 });
    g.ellipse(c.x, c.y - 1, 6.5, 2.8).fill({ color: 0x4f8fb0 });
    for (const dx of [-8, 8])
      g.moveTo(c.x + dx, c.y)
        .lineTo(c.x + dx, c.y - 15)
        .stroke({ width: 1.6, color: 0x7a5a36 });
    g.poly([c.x - 12, c.y - 13, c.x, c.y - 21, c.x + 12, c.y - 13]).fill({ color: 0xa4553a });
    g.moveTo(c.x, c.y - 13)
      .lineTo(c.x, c.y - 6)
      .stroke({ width: 0.8, color: 0x5a4630 });
    g.rect(c.x - 2.2, c.y - 6, 4.4, 3.4).fill({ color: 0x8a6a42 });
  },
  /** Reeds in a shallow pool: grey water goes in, clean water comes out. */
  reedBed(g, c) {
    g.ellipse(c.x, c.y + 3, 14, 7)
      .fill({ color: COLORS.water })
      .stroke({ width: 1.2, color: 0x7fb3b8 });
    for (const [dx, h] of [
      [-9, 12],
      [-5, 15],
      [-1, 11],
      [3, 16],
      [7, 12],
      [10, 9],
    ] as const) {
      g.moveTo(c.x + dx, c.y + 5)
        .quadraticCurveTo(c.x + dx - 1, c.y + 5 - h / 2, c.x + dx + 1, c.y + 5 - h)
        .stroke({ width: 1.3, color: 0x5f8a45, cap: 'round' });
      g.ellipse(c.x + dx + 1, c.y + 5 - h, 1.2, 2.6).fill({ color: 0x8a5a2c });
    }
  },
  /** A steaming pool under a roof. */
  bathhouse(g, c) {
    shadow(g, c, 15);
    g.rect(c.x - 13, c.y - 2, 26, 10).fill({ color: WALL });
    g.poly([c.x - 15, c.y - 1, c.x - 9, c.y - 10, c.x + 9, c.y - 10, c.x + 15, c.y - 1]).fill({
      color: COLORS.solarTeal,
    });
    g.ellipse(c.x, c.y + 4, 8, 3).fill({ color: 0x6fb3cf });
    for (const dx of [-4, 0, 4]) {
      g.moveTo(c.x + dx, c.y - 12)
        .quadraticCurveTo(c.x + dx - 3, c.y - 15, c.x + dx, c.y - 18)
        .stroke({ width: 1.2, color: 0xfffdf6, alpha: 0.9, cap: 'round' });
    }
  },
  /** Flooded terraces with rice and a fish. */
  riceFishPaddy(g, c) {
    g.poly(hexCorners(c, 22))
      .fill({ color: 0xa7d3c4 })
      .stroke({ width: 1.5, color: COLORS.leadingGold });
    g.moveTo(c.x - 16, c.y - 3)
      .lineTo(c.x + 16, c.y - 3)
      .moveTo(c.x - 16, c.y + 5)
      .lineTo(c.x + 16, c.y + 5)
      .stroke({ width: 1.5, color: 0x8a7a52 });
    for (let i = -3; i <= 3; i++) {
      for (const y of [-9, 0]) {
        g.moveTo(c.x + i * 4.5, c.y + y + 2)
          .lineTo(c.x + i * 4.5 + 1, c.y + y - 2)
          .stroke({ width: 1.2, color: 0x5f8a45 });
      }
    }
    g.poly([c.x - 3, c.y + 10, c.x + 3, c.y + 8, c.x + 3, c.y + 12]).fill({ color: 0xe58f4a });
  },
  /** A mound with a door, mushrooms on top. */
  mushroomCellar(g, c) {
    shadow(g, c, 13, 4, 8);
    g.moveTo(c.x - 13, c.y + 8)
      .quadraticCurveTo(c.x, c.y - 12, c.x + 13, c.y + 8)
      .fill({ color: 0x8aa66a });
    g.roundRect(c.x - 3.5, c.y - 1, 7, 9, 3).fill({ color: DARK });
    for (const [dx, dy, r] of [
      [-7, -1, 3],
      [6, -2, 2.5],
      [1, -7, 2.2],
    ] as const) {
      g.rect(c.x + dx - 0.7, c.y + dy, 1.4, 3).fill({ color: 0xf3e8d2 });
      g.ellipse(c.x + dx, c.y + dy, r, r * 0.6).fill({ color: 0xc8643c });
    }
  },
  /** A low line of shrubs with a few flowers. */
  hedgerow(g, c) {
    shadow(g, c, 15, 3.5, 7);
    for (const dx of [-11, -5, 1, 7, 12]) {
      g.circle(c.x + dx, c.y + 1 - (dx % 2 === 0 ? 1 : 0), 4.6).fill({ color: COLORS.treeLight });
    }
    for (const [dx, dy] of [
      [-8, -2],
      [4, -3],
      [10, 0],
    ] as const)
      g.circle(c.x + dx, c.y + dy, 1.2).fill({ color: 0xffffff });
  },
  // Willow Reach v2's evolved forms (E3), built on the drawings they grow from.
  foodForest(g, c) {
    BUILDING_ART.orchard!(g, c);
    for (const [dx, dy, color] of [
      [-12, 8, COLORS.flowerPink],
      [11, 7, COLORS.sunGold],
      [-1, -10, 0xffffff],
    ] as const)
      g.circle(c.x + dx, c.y + dy, 2).fill({ color });
    g.circle(c.x + 12, c.y - 8, 1.6).fill({ color: COLORS.sunGold });
  },
  aquaponicsHall(g, c) {
    BUILDING_ART.greenhouse!(g, c);
    g.rect(c.x - 10, c.y + 4, 20, 3).fill({ color: COLORS.water });
    g.poly([c.x - 2, c.y + 5.5, c.x + 2, c.y + 4, c.x + 2, c.y + 7]).fill({ color: 0xe58f4a });
  },
  canalTopSolar(g, c) {
    BUILDING_ART.irrigationChannel!(g, c);
    panel(g, { x: c.x, y: c.y - 5 }, COLORS.solarTeal, 0x9fc6c8);
  },
  beaverDam(g, c) {
    BUILDING_ART.weir!(g, c);
    for (const [dx, a] of [
      [-12, -0.4],
      [-4, 0.3],
      [5, -0.2],
      [12, 0.4],
    ] as const) {
      g.moveTo(c.x + dx - Math.cos(a) * 5, c.y - 6 - Math.sin(a) * 5)
        .lineTo(c.x + dx + Math.cos(a) * 5, c.y - 6 + Math.sin(a) * 5)
        .stroke({ width: 2, color: COLORS.wood, cap: 'round' });
    }
  },
  /** Drawn when its art is missing: pools on the 6 tiles around a pavilion at the centre. */
  greatWaterGarden(g, c) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      const x = c.x + Math.cos(a) * 52;
      const y = c.y + Math.sin(a) * 45;
      g.ellipse(x, y, 17, 10).fill({ color: COLORS.water }).stroke({ width: 2, color: 0x3f7d8c });
      g.circle(x - 6, y - 2, 2.2).fill({ color: COLORS.flowerPink });
    }
    g.ellipse(c.x, c.y + 4, 16, 8).fill({ color: COLORS.water });
    g.poly([c.x - 11, c.y - 2, c.x, c.y - 16, c.x + 11, c.y - 2]).fill({ color: COLORS.wood });
    g.rect(c.x - 8, c.y - 2, 16, 6).fill({ color: 0xf3e3c3 });
  },
  tidalLagoon(g, c) {
    // A ring of sea wall around a lagoon of 7 tiles, its turbine house at the centre.
    g.ellipse(c.x, c.y + 2, 62, 54).stroke({ width: 5, color: COLORS.stone });
    g.ellipse(c.x, c.y + 2, 58, 50).fill({ color: 0x6fa5bb, alpha: 0.55 });
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = c.x + Math.cos(a) * 40;
      const y = c.y + Math.sin(a) * 34;
      g.moveTo(x - 6, y)
        .quadraticCurveTo(x - 3, y - 2.5, x, y)
        .quadraticCurveTo(x + 3, y - 2.5, x + 6, y)
        .stroke({ width: 1.4, color: 0xd6ecf2, cap: 'round' });
    }
    g.rect(c.x - 9, c.y - 4, 18, 9).fill({ color: 0xf3e3c3 });
    g.poly([c.x - 11, c.y - 4, c.x, c.y - 13, c.x + 11, c.y - 4]).fill({ color: 0x6c7f86 });
    g.circle(c.x + 14, c.y + 6, 3).fill({ color: 0x4f8196 });
    g.circle(c.x - 14, c.y + 6, 3).fill({ color: 0x4f8196 });
  },
  /** Drawn when its art is missing: garden terraces stepping up over 7 tiles, a glasshouse at the centre. */
  cloudTerraces(g, c) {
    // Three curved walls, lowest in front, each holding a band of garden.
    for (const [dy, rx, ry, green] of [
      [42, 74, 22, 0x7da35e],
      [8, 70, 20, 0x6d9a55],
      [-26, 60, 17, 0x5e8a4c],
    ] as const) {
      g.ellipse(c.x, c.y + dy, rx, ry).fill({ color: green });
      g.moveTo(c.x - rx, c.y + dy)
        .quadraticCurveTo(c.x, c.y + dy + ry * 2, c.x + rx, c.y + dy)
        .stroke({ width: 3, color: COLORS.stone, cap: 'round' });
      for (let i = -3; i <= 3; i++)
        g.circle(c.x + i * rx * 0.26, c.y + dy + ry * 0.55 - Math.abs(i), 2).fill({
          color: i % 2 === 0 ? COLORS.flowerPink : COLORS.sunGold,
        });
    }
    // The glasshouse.
    g.roundRect(c.x - 10, c.y - 8, 20, 12, 3).fill({ color: 0xd4e6e4, alpha: 0.9 });
    g.poly([c.x - 11, c.y - 7, c.x, c.y - 16, c.x + 11, c.y - 7]).fill({ color: 0xbcd8d6 });
    g.moveTo(c.x - 4, c.y - 8)
      .lineTo(c.x - 4, c.y + 4)
      .moveTo(c.x + 4, c.y - 8)
      .lineTo(c.x + 4, c.y + 4)
      .stroke({ width: 1, color: 0x7f9a98 });
    // Mist below.
    for (const [dx, dy, r] of [
      [-50, 62, 13],
      [-28, 67, 10],
      [36, 65, 12],
      [56, 60, 9],
    ] as const)
      g.ellipse(c.x + dx, c.y + dy, r, r * 0.45).fill({ color: 0xffffff, alpha: 0.55 });
  },
  /** Drawn when its art is missing: long beds in flower on the 6 tiles round a willow island. */
  floatingCity(g, c) {
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      const x = c.x + Math.cos(a) * 48;
      const y = c.y + Math.sin(a) * 42;
      // Two beds on each tile, a canal between them, a canoe now and then.
      for (const side of [-1, 1]) {
        const bx = x + Math.cos(a + Math.PI / 2) * 9 * side;
        const by = y + Math.sin(a + Math.PI / 2) * 8 * side;
        g.ellipse(bx, by, 13, 5.5)
          .fill({ color: 0x8fb36a })
          .stroke({ width: 1.4, color: 0x5a4632 });
        for (let k = -1; k <= 1; k++)
          g.circle(bx + k * 6, by - 1, 1.8).fill({
            color: k === 0 ? COLORS.sunGold : (i + k) % 2 === 0 ? 0xc23b7a : 0xe89a2c,
          });
      }
      if (i % 2 === 0) g.ellipse(x, y, 5, 1.6).fill({ color: 0x8a5a3a });
    }
    // The willow island at the centre, with its pavilion.
    g.circle(c.x, c.y + 2, 17)
      .fill({ color: 0x7fa35a })
      .stroke({ width: 1.6, color: 0x5a4632 });
    for (const [dx, dy] of [
      [-11, -4],
      [11, -3],
      [-6, 9],
      [8, 9],
    ] as const) {
      g.rect(c.x + dx - 1, c.y + dy - 8, 2, 9).fill({ color: COLORS.wood });
      g.ellipse(c.x + dx, c.y + dy - 12, 3.4, 7).fill({ color: 0x6d9a4a });
    }
    g.rect(c.x - 7, c.y - 3, 14, 7).fill({ color: 0xf3e3c3 });
    g.poly([c.x - 9, c.y - 3, c.x, c.y - 12, c.x + 9, c.y - 3]).fill({ color: 0x7a4e8a });
  },
  solarOasis(g, c) {
    // A flower of mirrors round a tower, its cooling pool and garden at the foot.
    for (let ring = 0; ring < 2; ring++) {
      const r = 34 + ring * 26;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + ring * 0.26;
        const x = c.x + Math.cos(a) * r;
        const y = c.y + Math.sin(a) * r * 0.6 + 6;
        g.poly([x - 6, y + 2, x - 4, y - 3, x + 6, y - 3, x + 4, y + 2]).fill({
          color: 0xbfd6e6,
        });
      }
    }
    g.ellipse(c.x, c.y + 14, 20, 8).fill({ color: COLORS.water });
    for (const dx of [-24, 24]) palm(g, c.x + dx, c.y + 6);
    g.rect(c.x - 4, c.y - 40, 8, 48).fill({ color: COLORS.stone });
    g.circle(c.x, c.y - 42, 6).fill({ color: COLORS.sunGold });
  },
  singingSpire(g, c) {
    BUILDING_ART.windSpire!(g, c);
    for (const [dx, dy] of [
      [-12, 9],
      [12, 8],
    ] as const)
      g.circle(c.x + dx, c.y + dy, 2.2).fill({ color: COLORS.flowerPink });
    g.moveTo(c.x + 8, c.y - 16)
      .quadraticCurveTo(c.x + 12, c.y - 19, c.x + 15, c.y - 16)
      .stroke({ width: 1.2, color: COLORS.sunGold, cap: 'round' });
  },
  oldWorldArchive(g, c) {
    shadow(g, c, 14);
    g.rect(c.x - 12, c.y - 4, 24, 12).fill({ color: COLORS.stone });
    g.poly([c.x - 14, c.y - 4, c.x, c.y - 13, c.x + 14, c.y - 4]).fill({ color: 0x8a8070 });
    for (const dx of [-8, -3, 2, 7]) g.rect(c.x + dx, c.y - 2, 3, 8).fill({ color: 0xfffbf0 });
    for (const [dx, color] of [
      [-8, ROOF],
      [2, COLORS.solarTeal],
    ] as const)
      g.rect(c.x + dx, c.y - 2, 3, 8).fill({ color });
  },
  coppiceWood(g, c) {
    shadow(g, c, 13, 4, 8);
    for (const [dx, dy] of [
      [-8, 2],
      [0, -4],
      [8, 3],
    ] as const) {
      g.ellipse(c.x + dx, c.y + dy + 4, 3.5, 2).fill({ color: COLORS.wood });
      for (const lean of [-3, 0, 3]) {
        g.moveTo(c.x + dx, c.y + dy + 3)
          .lineTo(c.x + dx + lean, c.y + dy - 7)
          .stroke({ width: 1.2, color: 0x5f8a45, cap: 'round' });
      }
    }
    g.rect(c.x - 13, c.y + 7, 10, 2.5).fill({ color: COLORS.wood });
  },
  coppiceRegrowth(g, c) {
    for (const [dx, dy] of [
      [-8, 2],
      [0, -4],
      [8, 3],
    ] as const) {
      g.ellipse(c.x + dx, c.y + dy + 4, 3.5, 2).fill({ color: COLORS.wood });
      g.circle(c.x + dx, c.y + dy - 1, 3.5).fill({ color: COLORS.treeLight });
    }
  },
  solarCanopy(g, c) {
    shadow(g, c, 13, 4, 11);
    panel(g, c, COLORS.solarTeal, 0x9fc6c8);
  },
  riverWheel(g, c) {
    shadow(g, c, 12, 4, 12);
    g.circle(c.x, c.y, 11).stroke({ width: 2, color: COLORS.wood });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.moveTo(c.x, c.y).lineTo(c.x + Math.cos(a) * 11, c.y + Math.sin(a) * 11);
    }
    g.stroke({ width: 1.2, color: COLORS.wood });
    g.circle(c.x, c.y, 2.5).fill({ color: DARK });
  },
  windSpire(g, c) {
    shadow(g, c, 7, 3, 12);
    g.poly([c.x - 2, c.y + 12, c.x - 1, c.y - 12, c.x + 1, c.y - 12, c.x + 2, c.y + 12]).fill({
      color: 0xf6eedb,
    });
    for (const a of [-90, 30, 150]) {
      const r = (a * Math.PI) / 180;
      g.moveTo(c.x, c.y - 12).lineTo(c.x + Math.cos(r) * 11, c.y - 12 + Math.sin(r) * 11);
    }
    g.stroke({ width: 2.2, color: 0xf6eedb, cap: 'round' });
    g.circle(c.x, c.y - 12, 2).fill({ color: COLORS.leadingGold });
  },
  biogasDigester(g, c) {
    shadow(g, c, 13);
    g.moveTo(c.x - 12, c.y + 8)
      .quadraticCurveTo(c.x - 12, c.y - 10, c.x, c.y - 10)
      .quadraticCurveTo(c.x + 12, c.y - 10, c.x + 12, c.y + 8)
      .closePath()
      .fill({ color: 0x6f9a5c });
    g.moveTo(c.x - 10, c.y)
      .lineTo(c.x + 10, c.y)
      .stroke({ width: 1.2, color: 0x4a6e43 });
    g.rect(c.x + 10, c.y - 4, 6, 3).fill({ color: COLORS.stone });
  },
  cellBank(g, c) {
    shadow(g, c, 11);
    g.roundRect(c.x - 10, c.y - 8, 20, 16, 3).fill({ color: 0x3e6e73 });
    for (const dx of [-6, -1, 4]) g.rect(c.x + dx, c.y - 5, 3, 10).fill({ color: 0x9ccfc9 });
    g.rect(c.x - 3, c.y - 11, 6, 3).fill({ color: 0x3e6e73 });
  },
  heatWell(g, c) {
    shadow(g, c, 12);
    g.ellipse(c.x, c.y + 3, 11, 6).fill({ color: COLORS.stone });
    g.ellipse(c.x, c.y + 1, 8, 4).fill({ color: 0xe0703a });
    g.ellipse(c.x, c.y + 1, 4, 2).fill({ color: 0xf2c14e });
    g.moveTo(c.x - 11, c.y + 3)
      .lineTo(c.x - 11, c.y - 6)
      .lineTo(c.x + 11, c.y - 6)
      .lineTo(c.x + 11, c.y + 3);
    g.stroke({ width: 1.6, color: COLORS.wood });
  },
  pumpedReservoir(g, c) {
    g.poly([c.x - 15, c.y - 7, c.x + 15, c.y - 7, c.x + 10, c.y + 9, c.x - 10, c.y + 9]).fill({
      color: 0xa89c86,
    });
    g.poly([c.x - 12, c.y - 4, c.x + 12, c.y - 4, c.x + 8, c.y + 6, c.x - 8, c.y + 6]).fill({
      color: 0x74acc0,
    });
    g.moveTo(c.x - 6, c.y)
      .lineTo(c.x + 6, c.y)
      .stroke({ width: 1.2, color: 0xcfe7ee });
  },
  heatPump(g, c) {
    shadow(g, c, 11);
    g.roundRect(c.x - 11, c.y - 8, 22, 16, 3)
      .fill({ color: 0xe8e0cc })
      .stroke({ width: 1.3, color: 0x8c7b5e });
    g.circle(c.x - 3, c.y, 5).stroke({ width: 1.3, color: 0x5e6b58 });
    g.moveTo(c.x - 7, c.y)
      .lineTo(c.x + 1, c.y)
      .moveTo(c.x - 3, c.y - 4)
      .lineTo(c.x - 3, c.y + 4);
    g.stroke({ width: 1, color: 0x5e6b58 });
    g.rect(c.x + 5, c.y - 5, 3, 4).fill({ color: 0xe0703a });
    g.rect(c.x + 5, c.y + 1, 3, 4).fill({ color: 0x5b7fa8 });
    // It draws its heat from the water beside it.
    g.moveTo(c.x - 12, c.y + 11)
      .quadraticCurveTo(c.x - 6, c.y + 8, c.x, c.y + 11)
      .quadraticCurveTo(c.x + 6, c.y + 14, c.x + 12, c.y + 11)
      .stroke({ width: 1.5, color: 0x58a7cf });
  },
  /** An outdoor unit with a big fan: heat from the air. */
  airSourceHeatPump(g, c) {
    shadow(g, c, 11);
    g.roundRect(c.x - 10, c.y - 9, 20, 18, 3)
      .fill({ color: 0xf2ece0 })
      .stroke({ width: 1.3, color: 0x8c7b5e });
    g.circle(c.x, c.y, 7).fill({ color: 0xdcd3c0 }).stroke({ width: 1.3, color: 0x5e6b58 });
    for (let i = 0; i < 3; i++) {
      const a = (i * 2 * Math.PI) / 3;
      g.moveTo(c.x, c.y).lineTo(c.x + Math.cos(a) * 6, c.y + Math.sin(a) * 6);
    }
    g.stroke({ width: 1.6, color: 0x5e6b58 });
    g.rect(c.x + 6, c.y - 8, 3, 3).fill({ color: 0xe0703a });
  },
  solarThermalCollector(g, c) {
    shadow(g, c, 13, 4, 11);
    panel(g, c, 0x8a4a24, 0xf2a14a);
  },
  // Evolved buildings (Milestone 6).
  winterGarden(g, c) {
    BUILDING_ART.greenhouse!(g, c);
    g.circle(c.x, c.y - 7, 2.5).fill({ color: COLORS.flowerPink });
    g.circle(c.x - 8, c.y + 4, 1.6).fill({ color: COLORS.fruit });
    g.circle(c.x + 8, c.y + 4, 1.6).fill({ color: COLORS.sunGold });
    g.moveTo(c.x - 13, c.y + 9)
      .quadraticCurveTo(c.x, c.y + 13, c.x + 13, c.y + 9)
      .stroke({ width: 1.5, color: COLORS.terracotta });
  },
  agrivoltaicField(g, c) {
    BUILDING_ART.floodplainFarm!(g, c);
    g.moveTo(c.x - 7, c.y + 2)
      .lineTo(c.x - 7, c.y - 6)
      .moveTo(c.x + 7, c.y + 2)
      .lineTo(c.x + 7, c.y - 6)
      .stroke({ width: 1.5, color: DARK });
    panel(g, { x: c.x, y: c.y - 10 }, COLORS.solarTeal, 0x9fc6c8);
  },
  rewildedRuin(g, c) {
    shadow(g, c, 13);
    g.rect(c.x - 12, c.y + 2, 8, 5).fill({ color: COLORS.stone });
    g.rect(c.x + 2, c.y - 6, 9, 13).fill({ color: 0xb4a88f });
    g.moveTo(c.x + 3, c.y + 7)
      .quadraticCurveTo(c.x + 1, c.y - 2, c.x + 6, c.y - 7)
      .stroke({ width: 1.6, color: COLORS.treeDark });
    tree(g, c.x - 5, c.y - 5, 5);
    g.circle(c.x + 9, c.y - 1, 1.5).fill({ color: COLORS.flowerPink });
    g.circle(c.x - 9, c.y + 1, 1.5).fill({ color: COLORS.flowerPink });
  },
  treehouseCommons(g, c) {
    shadow(g, c, 14, 4, 11);
    g.rect(c.x - 2, c.y, 4, 11).fill({ color: COLORS.wood });
    g.circle(c.x, c.y - 4, 12).fill({ color: COLORS.treeLight });
    g.circle(c.x - 6, c.y - 8, 6).fill({ color: COLORS.treeDark, alpha: 0.35 });
    house(g, c.x + 1, c.y - 3, 0.7);
    g.moveTo(c.x - 9, c.y + 10)
      .lineTo(c.x - 4, c.y + 1)
      .stroke({ width: 1.2, color: DARK });
  },
  // The Windswept Coast.
  croft(g, c) {
    // Lazy-beds: raised strips of potatoes and oats inside a drystone dyke.
    g.poly(hexCorners(c, 21)).fill({ color: 0xc9cf8a }).stroke({ width: 2, color: COLORS.stone });
    for (let i = -2; i <= 2; i++)
      g.roundRect(c.x - 13, c.y + i * 5 - 1.5, 26, 3, 1.5).fill({
        color: i % 2 === 0 ? 0x8fae62 : 0xd9c37a,
      });
  },
  machairCroft(g, c) {
    BUILDING_ART.croft!(g, c);
    for (const [x, y, color] of [
      [-8, -6, COLORS.flowerPink],
      [6, -1, COLORS.sunGold],
      [-2, 5, 0xffffff],
      [9, 6, COLORS.flowerPink],
      [-11, 2, COLORS.sunGold],
    ] as const)
      g.circle(c.x + x, c.y + y, 1.6).fill({ color });
  },
  tideTurbine(g, c) {
    // A float tower in the race, the blades just under the water.
    g.ellipse(c.x, c.y + 6, 13, 5).fill({ color: 0x4f8196, alpha: 0.6 });
    for (const a of [20, 140, 260]) {
      const r = (a * Math.PI) / 180;
      g.moveTo(c.x, c.y + 6).lineTo(c.x + Math.cos(r) * 11, c.y + 6 + Math.sin(r) * 4);
    }
    g.stroke({ width: 2.2, color: 0xd6ecf2, alpha: 0.7, cap: 'round' });
    g.rect(c.x - 2.5, c.y - 12, 5, 18).fill({ color: 0xf6eedb });
    g.rect(c.x - 2.5, c.y - 12, 5, 4).fill({ color: COLORS.leadingGold });
    g.circle(c.x, c.y - 13, 1.8).fill({ color: COLORS.terracotta });
  },
  waveBuoy(g, c) {
    g.ellipse(c.x, c.y + 6, 11, 3.5).fill({ color: 0xd6ecf2, alpha: 0.5 });
    g.ellipse(c.x, c.y + 3, 9, 5)
      .fill({ color: COLORS.sunGold })
      .stroke({
        width: 1.2,
        color: COLORS.leadingGold,
      });
    g.rect(c.x - 1, c.y - 10, 2, 12).fill({ color: DARK });
    g.circle(c.x, c.y - 11, 2.2).fill({ color: COLORS.terracotta });
  },
  kelpFarm(g, c) {
    // Lines of floats with brown fronds beneath, and a little boat.
    for (const dy of [-6, 2]) {
      g.moveTo(c.x - 13, c.y + dy).lineTo(c.x + 11, c.y + dy - 3);
      g.stroke({ width: 1, color: 0xf6eedb, alpha: 0.8 });
      for (let i = 0; i < 4; i++) {
        const x = c.x - 10 + i * 7;
        const y = c.y + dy - (i * 3) / 4;
        g.moveTo(x, y)
          .quadraticCurveTo(x + 2, y + 4, x - 1, y + 7)
          .stroke({ width: 1.6, color: 0x7a6a32, alpha: 0.8, cap: 'round' });
        g.circle(x, y, 1.6).fill({ color: COLORS.terracotta });
      }
    }
    g.poly([c.x + 2, c.y + 9, c.x + 14, c.y + 9, c.x + 11, c.y + 12, c.x + 5, c.y + 12]).fill({
      color: COLORS.wood,
    });
  },
  kelpForest(g, c) {
    for (let i = 0; i < 6; i++) {
      const x = c.x - 12 + i * 5;
      g.moveTo(x, c.y + 10)
        .quadraticCurveTo(x + 4, c.y + 2, x - 1, c.y - 6 + (i % 2) * 3)
        .stroke({ width: 2, color: i % 2 ? 0x6d6a2c : 0x8a7a3a, cap: 'round' });
    }
    g.circle(c.x + 6, c.y - 7, 2.4).fill({ color: 0x5e6b70 });
  },
  oysterReef(g, c) {
    // Trestles of oyster bags on the mud, shells heaped beside.
    shadow(g, c, 13, 3, 8);
    for (const dy of [-4, 3]) {
      g.rect(c.x - 12, c.y + dy, 22, 3).fill({ color: 0x8c8574 });
      g.moveTo(c.x - 10, c.y + dy + 3)
        .lineTo(c.x - 10, c.y + dy + 6)
        .moveTo(c.x + 7, c.y + dy + 3)
        .lineTo(c.x + 7, c.y + dy + 6)
        .stroke({ width: 1, color: DARK });
    }
    for (const [x, y] of [
      [-6, 10],
      [-2, 11],
      [3, 10],
      [12, 4],
    ] as const)
      g.ellipse(c.x + x, c.y + y, 2.4, 1.4).fill({ color: 0xece4d2 });
  },
  beachcombingYard(g, c) {
    shadow(g, c, 14);
    // A lean-to, driftwood stacked, a float or two and a net.
    g.poly([c.x - 13, c.y + 7, c.x - 13, c.y - 5, c.x - 1, c.y - 9, c.x - 1, c.y + 7]).fill({
      color: 0x9b8a6c,
    });
    for (let i = 0; i < 3; i++)
      g.moveTo(c.x + 1, c.y + 7 - i * 3)
        .lineTo(c.x + 13, c.y + 5 - i * 3)
        .stroke({ width: 2, color: 0xb8a27e, cap: 'round' });
    g.circle(c.x + 10, c.y - 6, 2.5).fill({ color: COLORS.terracotta });
    g.circle(c.x + 5, c.y - 5, 2).fill({ color: COLORS.sunGold });
    g.moveTo(c.x - 11, c.y - 3)
      .lineTo(c.x - 3, c.y + 5)
      .moveTo(c.x - 3, c.y - 5)
      .lineTo(c.x - 11, c.y + 3)
      .stroke({ width: 0.8, color: 0x5e6b58 });
  },
  duneGrass(g, c) {
    // Marram in rows, with a line of fencing to hold the sand.
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4; i++) {
        const x = c.x - 10 + i * 7 + (row % 2) * 3;
        const y = c.y - 6 + row * 7;
        g.moveTo(x - 3, y - 4)
          .lineTo(x, y + 1)
          .lineTo(x + 3, y - 4)
          .moveTo(x, y + 1)
          .lineTo(x, y - 5);
      }
    g.stroke({ width: 1.2, color: 0x8a9a52, cap: 'round', join: 'round' });
    g.moveTo(c.x - 13, c.y + 11).lineTo(c.x + 13, c.y + 8);
    g.stroke({ width: 1.2, color: COLORS.wood });
  },
  seaWall(g, c) {
    shadow(g, c, 14, 4, 8);
    g.poly([c.x - 15, c.y + 6, c.x - 13, c.y - 4, c.x + 13, c.y - 8, c.x + 15, c.y + 2]).fill({
      color: COLORS.stone,
    });
    g.moveTo(c.x - 13, c.y - 4).lineTo(c.x + 13, c.y - 8);
    g.stroke({ width: 2, color: 0xc4b9a2 });
    for (let i = -1; i <= 1; i++)
      g.moveTo(c.x + i * 8, c.y - 5 - i).lineTo(c.x + i * 8 + 1, c.y + 4 - i);
    g.stroke({ width: 1, color: 0x7c7262 });
  },
  lighthouse(g, c) {
    shadow(g, c, 8, 3, 12);
    g.poly([c.x - 5, c.y + 12, c.x - 3, c.y - 10, c.x + 3, c.y - 10, c.x + 5, c.y + 12]).fill({
      color: 0xfbf5e6,
    });
    g.rect(c.x - 4.2, c.y - 2, 8.4, 4).fill({ color: COLORS.terracotta });
    g.rect(c.x - 4.8, c.y + 6, 9.6, 4).fill({ color: COLORS.terracotta });
    g.rect(c.x - 3, c.y - 16, 6, 6).fill({ color: COLORS.sunGold });
    g.poly([c.x - 4, c.y - 16, c.x, c.y - 20, c.x + 4, c.y - 16]).fill({ color: DARK });
  },
  smokehouse(g, c) {
    shadow(g, c, 12);
    g.rect(c.x - 9, c.y - 3, 18, 11).fill({ color: 0x4a3f36 });
    g.poly([c.x - 11, c.y - 2, c.x, c.y - 11, c.x + 11, c.y - 2]).fill({ color: 0x2f2a26 });
    g.rect(c.x - 2, c.y + 2, 4, 6).fill({ color: COLORS.leadingGold });
    g.moveTo(c.x + 2, c.y - 12)
      .quadraticCurveTo(c.x - 1, c.y - 16, c.x + 3, c.y - 20)
      .stroke({ width: 1.4, color: 0xd8d4cc, alpha: 0.9, cap: 'round' });
  },
  desalinator(g, c) {
    shadow(g, c, 14);
    g.roundRect(c.x - 12, c.y - 6, 9, 14, 3)
      .fill({ color: 0xe9eef0 })
      .stroke({
        width: 1.2,
        color: 0x6c9fae,
      });
    g.roundRect(c.x - 1, c.y - 3, 9, 11, 3)
      .fill({ color: 0xe9eef0 })
      .stroke({
        width: 1.2,
        color: 0x6c9fae,
      });
    g.moveTo(c.x + 8, c.y + 4)
      .lineTo(c.x + 14, c.y + 4)
      .stroke({ width: 2, color: 0x6c9fae });
    panel(g, { x: c.x + 2, y: c.y - 12 }, COLORS.solarTeal, 0x9fc6c8);
  },
  tideMill(g, c) {
    // A mill house on the mudflat with its pond walled off from the sea, and its wheel.
    shadow(g, c, 14);
    g.ellipse(c.x + 4, c.y + 5, 10, 5)
      .fill({ color: COLORS.water })
      .stroke({ width: 1.8, color: COLORS.stone });
    house(g, c.x - 6, c.y - 1, 0.9, 0x6c7f86);
    g.circle(c.x + 5, c.y - 3, 6).stroke({ width: 1.6, color: COLORS.wood });
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 4;
      g.moveTo(c.x + 5 - Math.cos(a) * 6, c.y - 3 - Math.sin(a) * 6).lineTo(
        c.x + 5 + Math.cos(a) * 6,
        c.y - 3 + Math.sin(a) * 6,
      );
    }
    g.stroke({ width: 1, color: COLORS.wood });
  },
  estuaryTurbine(g, c) {
    // A low weir across the stream's mouth with turbines under a walkway, a flag on its tower.
    shadow(g, c, 14, 4, 8);
    g.rect(c.x - 14, c.y, 28, 5).fill({ color: COLORS.stone });
    for (let i = -1; i <= 1; i++) g.circle(c.x + i * 8, c.y + 7, 3).fill({ color: 0x4f8196 });
    g.rect(c.x - 2.5, c.y - 12, 5, 12).fill({ color: 0xf6eedb });
    g.poly([c.x + 2.5, c.y - 12, c.x + 9, c.y - 10, c.x + 2.5, c.y - 8]).fill({
      color: COLORS.leadingGold,
    });
  },
  // The Highland (drawn in code until its art comes).
  terraceFarm(g, c) {
    // Stepped strips held by drystone walls, across the slope.
    for (let i = 0; i < 3; i++) {
      const y = c.y - 9 + i * 7;
      g.roundRect(c.x - 13 + i * 2, y, 24 - i * 2, 5, 2).fill({
        color: i === 1 ? 0xd9c37a : 0x9fbf6a,
      });
      g.moveTo(c.x - 13 + i * 2, y + 5)
        .lineTo(c.x + 11, y + 5)
        .stroke({ width: 1.6, color: COLORS.stone });
    }
  },
  hangingGarden(g, c) {
    // The terraces in flower, bees among them.
    BUILDING_ART.terraceFarm!(g, c);
    for (const [x, y, color] of [
      [-8, -8, COLORS.flowerPink],
      [4, -1, COLORS.leadingGold],
      [-4, 6, COLORS.flowerPink],
      [8, 5, 0xb48ad6],
    ] as const)
      g.circle(c.x + x, c.y + y, 1.8).fill({ color });
  },
  glenFarm(g, c) {
    g.poly(hexCorners(c, 21))
      .fill({ color: COLORS.field })
      .stroke({ width: 1.5, color: COLORS.stone });
    for (let i = -2; i <= 2; i++) g.moveTo(c.x - 14, c.y + i * 5).lineTo(c.x + 14, c.y + i * 5);
    g.stroke({ width: 1.1, color: COLORS.furrow });
  },
  shieling(g, c) {
    // A small turf-roofed hut on the high pasture, a few sheep.
    shadow(g, c, 10);
    g.rect(c.x - 7, c.y - 2, 12, 8).fill({ color: COLORS.stone });
    g.poly([c.x - 9, c.y - 1, c.x - 1, c.y - 8, c.x + 7, c.y - 1]).fill({ color: COLORS.treeDark });
    for (const [x, y] of [
      [8, 6],
      [12, 2],
    ] as const)
      g.ellipse(c.x + x, c.y + y, 3, 2).fill({ color: 0xf4f2ec });
  },
  hillTurbine(g, c) {
    // A little hydro house with its wheel turning in the falling stream.
    shadow(g, c, 11);
    house(g, c.x - 4, c.y, 0.8, 0x6c7f86);
    g.circle(c.x + 8, c.y + 2, 6).stroke({ width: 1.6, color: COLORS.wood });
    g.moveTo(c.x + 2, c.y + 2)
      .lineTo(c.x + 14, c.y + 2)
      .moveTo(c.x + 8, c.y - 4)
      .lineTo(c.x + 8, c.y + 8);
    g.stroke({ width: 1, color: COLORS.wood });
  },
  cascade(g, c) {
    // The hydro house, white water falling past it to the next wheel.
    BUILDING_ART.hillTurbine!(g, c);
    g.moveTo(c.x + 12, c.y - 8)
      .quadraticCurveTo(c.x + 16, c.y, c.x + 12, c.y + 10)
      .stroke({ width: 2, color: 0xe8f2f4, alpha: 0.9, cap: 'round' });
  },
  batRoost(g, c) {
    // The old mine's mouth, grown over; bats at dusk.
    shadow(g, c, 13);
    g.roundRect(c.x - 9, c.y - 6, 18, 13, 6).fill({ color: COLORS.stone });
    g.ellipse(c.x, c.y + 3, 5, 4).fill({ color: DARK });
    tree(g, c.x - 9, c.y - 6, 4);
    for (const [x, y] of [
      [3, -12],
      [9, -9],
    ] as const)
      g.moveTo(c.x + x - 3, c.y + y)
        .lineTo(c.x + x, c.y + y + 2)
        .lineTo(c.x + x + 3, c.y + y)
        .stroke({ width: 1.2, color: DARK });
  },
  bothy(g, c) {
    shadow(g, c, 11);
    g.rect(c.x - 9, c.y - 3, 18, 10).fill({ color: COLORS.stone });
    g.poly([c.x - 11, c.y - 2, c.x, c.y - 10, c.x + 11, c.y - 2]).fill({ color: 0x5e6b58 });
    g.rect(c.x - 2, c.y + 2, 4, 5).fill({ color: DARK });
    g.rect(c.x + 5, c.y - 12, 3, 5).fill({ color: COLORS.stone });
  },
  pumpStation(g, c) {
    shadow(g, c, 11);
    g.rect(c.x - 8, c.y - 4, 12, 11).fill({ color: WALL });
    g.poly([c.x - 10, c.y - 3, c.x - 2, c.y - 10, c.x + 6, c.y - 3]).fill({ color: 0x6c7f86 });
    g.moveTo(c.x + 4, c.y + 4)
      .lineTo(c.x + 13, c.y + 4)
      .lineTo(c.x + 13, c.y - 8)
      .stroke({ width: 2.2, color: 0x6c9fae });
  },
  biocharKiln(g, c) {
    shadow(g, c, 11);
    g.roundRect(c.x - 9, c.y - 6, 18, 13, 6).fill({ color: 0x4a3f36 });
    g.rect(c.x - 3, c.y + 1, 6, 6).fill({ color: COLORS.leadingGold });
    g.moveTo(c.x + 2, c.y - 7)
      .quadraticCurveTo(c.x - 1, c.y - 12, c.x + 3, c.y - 16)
      .stroke({ width: 1.4, color: 0xd8d4cc, alpha: 0.9, cap: 'round' });
  },
  snowFence(g, c) {
    for (let i = -2; i <= 2; i++) g.moveTo(c.x + i * 5, c.y + 6).lineTo(c.x + i * 5, c.y - 4);
    g.moveTo(c.x - 12, c.y - 1).lineTo(c.x + 12, c.y - 1);
    g.stroke({ width: 1.4, color: COLORS.wood });
  },
  rewettedBog(g, c) {
    for (const [x, y, r] of [
      [-6, 0, 5],
      [5, 3, 4],
      [1, -5, 3],
    ] as const)
      g.ellipse(c.x + x, c.y + y, r, r * 0.6).fill({ color: 0x5f7f86 });
    for (let i = 0; i < 5; i++)
      g.circle(c.x - 10 + i * 5, c.y + 8 - (i % 2) * 3, 1.5).fill({ color: 0xf4f2ec });
  },
  lookout(g, c) {
    shadow(g, c, 8, 3, 10);
    g.rect(c.x - 4, c.y - 10, 8, 18).fill({ color: COLORS.stone });
    g.rect(c.x - 6, c.y - 13, 12, 3).fill({ color: DARK });
    g.rect(c.x - 2, c.y - 8, 4, 3).fill({ color: COLORS.sunGold });
  },
  rockPool(g, c) {
    shadow(g, c, 13);
    g.rect(c.x - 12, c.y - 2, 7, 9).fill({ color: COLORS.stone });
    g.ellipse(c.x + 3, c.y + 2, 10, 6)
      .fill({ color: COLORS.water })
      .stroke({ width: 1.5, color: 0x8c8574 });
    g.moveTo(c.x - 1, c.y + 4)
      .quadraticCurveTo(c.x + 2, c.y, c.x + 1, c.y - 3)
      .stroke({ width: 1.4, color: 0x6d7a3c, cap: 'round' });
    g.circle(c.x + 7, c.y + 3, 1.6).fill({ color: COLORS.terracotta });
  },
  // The Sun Desert (SD2), drawn simply until its art comes (SD4).
  oasisGarden(g, c) {
    g.poly(hexCorners(c, 20)).fill({ color: 0x9db86a });
    palm(g, c.x - 7, c.y - 2);
    palm(g, c.x + 7, c.y - 4);
    g.circle(c.x, c.y + 6, 2).fill({ color: COLORS.treeLight });
  },
  wadiFarm(g, c) {
    g.poly(hexCorners(c, 21)).fill({ color: COLORS.field }).stroke({ width: 1.5, color: MUD });
    for (let i = -2; i <= 2; i++) g.moveTo(c.x - 14, c.y + i * 5).lineTo(c.x + 14, c.y + i * 5);
    g.stroke({ width: 1.1, color: COLORS.furrow });
  },
  mudBrickHouse(g, c) {
    shadow(g, c, 12);
    g.rect(c.x - 10, c.y - 6, 20, 14).fill({ color: MUD });
    g.rect(c.x - 11, c.y - 8, 22, 3).fill({ color: 0xb98a5c });
    g.rect(c.x - 2, c.y + 2, 4, 6).fill({ color: DARK });
    g.rect(c.x + 4, c.y - 3, 3, 3).fill({ color: DARK });
  },
  windTower(g, c) {
    shadow(g, c, 10);
    g.rect(c.x - 5, c.y - 16, 10, 24).fill({ color: MUD });
    for (const y of [-14, -10]) g.rect(c.x - 4, c.y + y, 8, 2).fill({ color: DARK });
    g.rect(c.x - 6, c.y - 18, 12, 3).fill({ color: 0xb98a5c });
  },
  absorptionChiller(g, c) {
    shadow(g, c, 12);
    g.roundRect(c.x - 10, c.y - 6, 20, 13, 3)
      .fill({ color: 0xd9dfe2 })
      .stroke({ width: 1.3, color: 0x6c9fae });
    g.circle(c.x - 4, c.y, 3.5).stroke({ width: 1.3, color: 0x6c9fae });
    g.circle(c.x + 4, c.y, 3.5).stroke({ width: 1.3, color: COLORS.terracotta });
  },
  fogNet(g, c) {
    g.moveTo(c.x - 12, c.y + 8)
      .lineTo(c.x - 12, c.y - 10)
      .moveTo(c.x + 12, c.y + 8)
      .lineTo(c.x + 12, c.y - 10);
    g.stroke({ width: 1.6, color: COLORS.wood });
    g.rect(c.x - 12, c.y - 10, 24, 12).fill({ color: 0xf4f2ec, alpha: 0.7 });
    for (let i = -1; i <= 1; i++)
      g.moveTo(c.x - 12, c.y - 4 + i * 4).lineTo(c.x + 12, c.y - 4 + i * 4);
    g.stroke({ width: 0.8, color: 0x9aa7aa });
    g.ellipse(c.x, c.y + 7, 6, 2.5).fill({ color: COLORS.water });
  },
  qanat(g, c) {
    // A line of shafts over the channel underground.
    for (const x of [-9, 0, 9]) {
      g.circle(c.x + x, c.y + x * 0.2, 4).fill({ color: MUD });
      g.circle(c.x + x, c.y + x * 0.2, 2).fill({ color: DARK });
    }
  },
  concentratedSolarPlant(g, c) {
    shadow(g, c, 15);
    for (const [x, y] of [
      [-11, 4],
      [-4, 7],
      [5, 7],
      [12, 4],
    ] as const)
      g.poly([
        c.x + x - 3,
        c.y + y + 2,
        c.x + x - 2,
        c.y + y - 2,
        c.x + x + 3,
        c.y + y - 2,
        c.x + x + 2,
        c.y + y + 2,
      ]).fill({ color: 0xbfd6e6 });
    g.rect(c.x - 2, c.y - 16, 4, 18).fill({ color: COLORS.stone });
    g.circle(c.x, c.y - 17, 3.5).fill({ color: COLORS.sunGold });
  },
  iceHouse(g, c) {
    // A yakhchal: a stepped mud-brick cone over its pit, with a shade wall to the south.
    shadow(g, c, 13);
    g.rect(c.x - 15, c.y - 2, 4, 10).fill({ color: 0xb98a5c });
    g.moveTo(c.x - 9, c.y + 7)
      .lineTo(c.x - 2, c.y - 17)
      .lineTo(c.x + 2, c.y - 17)
      .lineTo(c.x + 9, c.y + 7)
      .closePath()
      .fill({ color: MUD })
      .stroke({ width: 1.2, color: DARK });
    for (const y of [-9, -1]) g.moveTo(c.x - 6 + (y + 9) * 0.1, c.y + y).lineTo(c.x + 6, c.y + y);
    g.stroke({ width: 0.9, color: DARK, alpha: 0.6 });
    g.ellipse(c.x + 11, c.y + 6, 4, 2).fill({ color: 0xd8ecf6 });
  },
  sandBattery(g, c) {
    shadow(g, c, 11);
    g.roundRect(c.x - 8, c.y - 12, 16, 20, 4)
      .fill({ color: 0xc9b089 })
      .stroke({ width: 1.3, color: DARK });
    g.rect(c.x - 5, c.y - 4, 10, 3).fill({ color: COLORS.terracotta });
  },
  threeLayerGarden(g, c) {
    g.poly(hexCorners(c, 20)).fill({ color: 0x86a95a });
    palm(g, c.x - 8, c.y - 4);
    palm(g, c.x + 8, c.y - 5);
    palm(g, c.x, c.y - 8);
    tree(g, c.x - 4, c.y + 4, 3.5, true);
    tree(g, c.x + 5, c.y + 4, 3.5, true);
  },
  fogFence(g, c) {
    for (const x of [-14, -5, 5, 14]) g.moveTo(c.x + x, c.y + 8).lineTo(c.x + x, c.y - 10);
    g.stroke({ width: 1.6, color: COLORS.wood });
    g.rect(c.x - 14, c.y - 10, 28, 12).fill({ color: 0xf4f2ec, alpha: 0.7 });
    g.ellipse(c.x, c.y + 7, 9, 3).fill({ color: COLORS.water });
  },
  restoredArray(g, c) {
    shadow(g, c, 14);
    panel(g, { x: c.x - 4, y: c.y - 2 }, 0x2f4f6f, 0x9fb6c8);
    panel(g, { x: c.x + 6, y: c.y + 4 }, 0x2f4f6f, 0x9fb6c8);
  },
  palmWindbreak(g, c) {
    palm(g, c.x - 7, c.y);
    palm(g, c.x + 6, c.y - 2);
  },
  saltWorks(g, c) {
    for (const [x, y] of [
      [-7, -3],
      [6, -3],
      [0, 5],
    ] as const)
      g.rect(c.x + x - 5, c.y + y - 3, 10, 6)
        .fill({ color: 0xf4f2ec })
        .stroke({ width: 1, color: 0x9aa7aa });
    g.poly([c.x + 10, c.y + 8, c.x + 13, c.y + 2, c.x + 16, c.y + 8]).fill({ color: 0xffffff });
  },
  // Lake Gardens (LG2): drawn here until their art comes.
  /** A raised bed: a field edged with stakes and willow, water at its feet. */
  chinampa(g, c) {
    g.poly(hexCorners(c, 21)).fill({ color: 0x9fbf6a }).stroke({ width: 1.5, color: 0x6e8a3e });
    for (let i = -1; i <= 1; i++)
      g.moveTo(c.x - 12, c.y + i * 6 + 2)
        .lineTo(c.x + 12, c.y + i * 6 - 2)
        .stroke({ width: 2, color: 0x5f8a45, cap: 'round' });
    for (const [dx, dy] of [
      [-15, 0],
      [15, 0],
      [0, -15],
    ] as const)
      g.rect(c.x + dx - 1, c.y + dy - 4, 2, 6).fill({ color: COLORS.wood });
    tree(g, c.x + 12, c.y - 10, 3.5);
  },
  /** A flat boat with a heap of mud and a long pole. */
  mudBoat(g, c) {
    shadow(g, c, 13, 3.5, 7);
    g.poly([c.x - 13, c.y, c.x + 13, c.y, c.x + 9, c.y + 6, c.x - 9, c.y + 6]).fill({
      color: COLORS.wood,
    });
    g.ellipse(c.x - 2, c.y - 2, 7, 4).fill({ color: 0x6b5236 });
    g.moveTo(c.x + 5, c.y + 4)
      .lineTo(c.x + 12, c.y - 14)
      .stroke({ width: 1.4, color: DARK });
  },
  /** A house on stilts over the water. */
  stiltHouse(g, c) {
    g.ellipse(c.x, c.y + 9, 13, 3.5).fill({ color: COLORS.water });
    for (const dx of [-6, -2, 2, 6])
      g.moveTo(c.x + dx, c.y + 3)
        .lineTo(c.x + dx, c.y + 10)
        .stroke({ width: 1.4, color: COLORS.wood });
    house(g, c.x, c.y - 3, 0.9);
  },
  /** Ponds in a row, with a sluice between them, fish in the water. */
  wastewaterFishery(g, c) {
    for (const dx of [-7, 7])
      g.ellipse(c.x + dx, c.y + 1, 7, 6)
        .fill({ color: 0x8fbfa4 })
        .stroke({ width: 1.2, color: 0x6a9a8a });
    g.rect(c.x - 1, c.y - 3, 2, 8).fill({ color: COLORS.stone });
    g.poly([c.x - 9, c.y + 1, c.x - 5, c.y - 1, c.x - 5, c.y + 3]).fill({ color: 0xe58f4a });
    g.poly([c.x + 5, c.y + 2, c.x + 9, c.y, c.x + 9, c.y + 4]).fill({ color: 0xe58f4a });
  },
  /** Net floats in deep water, and a boat. */
  lakeFishery(g, c) {
    g.circle(c.x, c.y, 11).stroke({ width: 1.2, color: 0xf3dfbd });
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.circle(c.x + Math.cos(a) * 11, c.y + Math.sin(a) * 11, 1.6).fill({ color: 0xd9543c });
    }
    g.poly([c.x - 6, c.y - 1, c.x + 6, c.y - 1, c.x + 4, c.y + 3, c.x - 4, c.y + 3]).fill({
      color: COLORS.wood,
    });
  },
  /** Mulberry bushes on a bank. */
  mulberryDyke(g, c) {
    shadow(g, c, 14, 4, 9);
    g.roundRect(c.x - 14, c.y + 3, 28, 5, 2).fill({ color: 0x8a6a46 });
    for (const dx of [-9, 0, 9]) {
      g.circle(c.x + dx, c.y - 1, 5).fill({ color: 0x4f7a3e });
      g.circle(c.x + dx - 1, c.y - 2, 1.1).fill({ color: 0x4b2a4a });
    }
  },
  /** A long low house with racks of silkworm trays. */
  silkHouse(g, c) {
    shadow(g, c, 14);
    g.rect(c.x - 12, c.y - 4, 24, 11).fill({ color: WALL });
    g.poly([c.x - 14, c.y - 3, c.x - 10, c.y - 10, c.x + 10, c.y - 10, c.x + 14, c.y - 3]).fill({
      color: 0x8a5a7a,
    });
    for (const dx of [-7, 0, 7]) g.rect(c.x + dx - 2, c.y, 4, 3).fill({ color: 0xfaf3e6 });
  },
  /** A sty: a fence and a pink pig. */
  pigPen(g, c) {
    shadow(g, c, 13);
    g.rect(c.x - 12, c.y - 6, 24, 14).stroke({ width: 1.5, color: COLORS.wood });
    g.ellipse(c.x, c.y + 1, 6, 4).fill({ color: 0xe9a6a0 });
    g.circle(c.x + 6, c.y, 2.6).fill({ color: 0xe9a6a0 });
  },
  /** A small hut and two ducks. */
  duckHouse(g, c) {
    shadow(g, c, 11);
    house(g, c.x - 4, c.y, 0.7, 0x7c8f5a);
    for (const [dx, dy] of [
      [7, 3],
      [10, -2],
    ] as const) {
      g.ellipse(c.x + dx, c.y + dy, 3, 2).fill({ color: 0xffffff });
      g.circle(c.x + dx + 2.5, c.y + dy - 2, 1.3).fill({ color: 0x3f7a3a });
    }
  },
  /** Willow stakes in a row, sprouting. */
  willowEdge(g, c) {
    shadow(g, c, 15, 3.5, 7);
    for (const dx of [-10, -4, 2, 8]) {
      g.moveTo(c.x + dx, c.y + 6)
        .lineTo(c.x + dx, c.y - 4)
        .stroke({ width: 1.6, color: COLORS.wood });
      g.ellipse(c.x + dx + 1, c.y - 6, 3, 4).fill({ color: 0x9cbf6a });
    }
  },
  /** Panels on floats over the water. */
  floatingSolar(g, c) {
    g.ellipse(c.x, c.y + 8, 15, 3).fill({ color: 0xffffff, alpha: 0.5 });
    panel(g, { x: c.x - 4, y: c.y - 1 }, COLORS.solarTeal, 0x9fc6c8);
  },
  /** A small undershot wheel. */
  canalWheel(g, c) {
    shadow(g, c, 10, 3.5, 10);
    g.circle(c.x, c.y, 8).stroke({ width: 1.8, color: COLORS.wood });
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.moveTo(c.x, c.y).lineTo(c.x + Math.cos(a) * 8, c.y + Math.sin(a) * 8);
    }
    g.stroke({ width: 1.1, color: COLORS.wood });
    g.circle(c.x, c.y, 2).fill({ color: DARK });
  },
  /** A rice-fish paddy with ducks on it. */
  riceDuckPaddy(g, c) {
    BUILDING_ART.riceFishPaddy!(g, c);
    for (const [dx, dy] of [
      [-6, 4],
      [5, -3],
    ] as const) {
      g.ellipse(c.x + dx, c.y + dy, 3, 2).fill({ color: 0xffffff });
      g.circle(c.x + dx + 2.5, c.y + dy - 2, 1.3).fill({ color: 0x3f7a3a });
    }
  },
  /** A plaza with boats moored at its edge. */
  floatingMarket(g, c) {
    BUILDING_ART.commonsPlaza!(g, c);
    for (const [dx, dy, col] of [
      [-12, 9, 0xd98c5f],
      [11, 10, 0x8a5a7a],
    ] as const)
      g.poly([
        c.x + dx - 5,
        c.y + dy,
        c.x + dx + 5,
        c.y + dy,
        c.x + dx + 3,
        c.y + dy + 3,
        c.x + dx - 3,
        c.y + dy + 3,
      ]).fill({
        color: col,
      });
  },
};

/** Damaged buildings get a grey veil and a crack; blacked-out ones a dim veil. */
export function drawCondition(g: Graphics, c: Point, condition: 'damaged' | 'dark'): void {
  g.circle(c.x, c.y, 15).fill({
    color: condition === 'damaged' ? 0x6b6a5c : 0x1e2a33,
    alpha: 0.35,
  });
  if (condition === 'damaged') {
    g.moveTo(c.x - 6, c.y - 8)
      .lineTo(c.x - 1, c.y - 2)
      .lineTo(c.x - 4, c.y + 2)
      .lineTo(c.x + 3, c.y + 8)
      .stroke({ width: 1.8, color: 0xfff9ea });
  }
}
