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
