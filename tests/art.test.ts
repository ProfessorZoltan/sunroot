/**
 * The hand-made art (docs/ART.md): every tile type and building has its
 * images in src/art, imported from art/incoming, and the frame's geometry
 * matches the map's.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HEX_RADIUS,
  HEX_SPACING,
  SIDE_FACTOR,
  TILE_DEPTH,
  hexCorners,
  hexToPixel,
} from '../src/render/layout';
import { TILE_TYPES } from '../src/sim';
import { content } from './helpers';

const art = (path: string) => existsSync(new URL(`../src/art/${path}`, import.meta.url));
const info = JSON.parse(readFileSync(new URL('../src/art/art.json', import.meta.url), 'utf8')) as {
  frame: [number, number];
  tileCentre: [number, number];
  tileWidth: number;
  ground: string[];
  pivots: Record<string, [number, number]>;
};

describe('hand-made art', () => {
  it('covers every tile type, in summer (two ways) and winter', () => {
    // The Windswept Coast's and the Highland's tiles are drawn procedurally until their art comes.
    const awaiting = ['sea', 'mudflat', 'saltmarsh', 'dune', 'crag', 'bog'];
    for (const t of TILE_TYPES.filter((x) => !awaiting.includes(x))) {
      for (const f of [`${t}.png`, `${t}-2.png`, `${t}.winter.png`])
        expect(art(`tiles/${f}`), f).toBe(true);
    }
  });

  it('has every animal frame, and the festival cards and props (E4)', () => {
    const frames = [
      'wildBees.1',
      'wildBees.2',
      'wildBees.3',
      'otter.swim.1',
      'otter.swim.2',
      'otter.rest',
      'beaver.swim.1',
      'beaver.swim.2',
      'beaver.carry',
      ...['walk.1', 'walk.2', 'walk.3', 'walk.4', 'graze.1', 'graze.2'].flatMap((f) => [
        `deer.${f}`,
        `deer.${f}.winter`,
      ]),
    ];
    for (const f of frames) expect(art(`wildlife/${f}.png`), f).toBe(true);
    for (const f of content.festivals) expect(art(`festivals/${f.id}.card.webp`), f.id).toBe(true);
    for (const f of ['bunting', 'lantern', 'lantern.lit'])
      expect(art(`festivals/${f}.png`), f).toBe(true);
  });

  it('has each wonder finished, in winter and at its 3 stages, with an icon (E5)', () => {
    for (const b of content.buildings.filter((d) => d.wonder)) {
      for (const f of ['', '.winter', '.stage1', '.stage2', '.stage3'])
        expect(art(`wonders/${b.id}${f}.png`), `${b.id}${f}`).toBe(true);
      expect(art(`icons/${b.id}.png`), b.id).toBe(true);
    }
  });

  it('covers every building in summer and winter, with an icon', () => {
    // Asked for in ART-EXPANSION.md; drawn procedurally until it comes.
    const awaiting = ['well'];
    for (const b of content.buildings) {
      // Wonders have their own frame (below).
      if (awaiting.includes(b.id) || b.wonder) continue;
      for (const f of [
        `buildings/${b.id}.png`,
        `buildings/${b.id}.winter.png`,
        `icons/${b.id}.png`,
      ])
        expect(art(f), f).toBe(true);
    }
  });

  it('lights homes and some others at night, and turns the spires and the river wheel', () => {
    for (const lit of [
      'foundersCamp',
      'cottage',
      'treehouseCommons',
      'bathhouse',
      'aquaponicsHall',
      'mushroomCellar',
      'oldWorldArchive',
    ])
      expect(art(`buildings/${lit}.windows.png`), lit).toBe(true);
    for (const id of ['windSpire', 'riverWheel', 'singingSpire']) {
      expect(art(`buildings/${id}.rotor.png`), id).toBe(true);
      expect(info.pivots[id], id).toHaveLength(2);
    }
  });

  it('draws channels as a hub with an arm to each neighbour, with a sluice gate', () => {
    for (const arm of ['e', 'ne', 'nw', 'w', 'sw', 'se'])
      for (const season of ['', '.winter'])
        expect(art(`buildings/irrigationChannel.${arm}${season}.png`), `${arm}${season}`).toBe(
          true,
        );
    expect(art('buildings/sluiceGate.png')).toBe(true);
  });

  it('draws hedges along the three sides a tile owns (DECISIONS.md, Hedgerows on edges)', () => {
    for (const side of ['e', 'ne', 'nw'])
      for (const season of ['', '.winter'])
        expect(art(`buildings/hedgerow.edge.${side}${season}.png`), `${side}${season}`).toBe(true);
  });

  it('marks only buildings that stand on one kind of tile as carrying their own', () => {
    expect(info.ground).toEqual([
      'beaverDam',
      'coppiceRegrowth',
      'coppiceWood',
      'oldWorldArchive',
      'pumpedReservoir',
      'rewildedRuin',
      'riceFishPaddy',
      'salvageYard',
      'singingSpire',
      'weir',
      'windSpire',
    ]);
    for (const id of info.ground) {
      const tiles = content.byId[id]!.placement.tiles;
      expect(tiles, id).toHaveLength(1);
    }
  });

  it('is imported from everything delivered', () => {
    // Wildlife, festivals and wonders wait for the milestones that use them (E4, E5).
    for (const folder of ['tiles', 'buildings']) {
      const delivered = readdirSync(new URL(`../art/incoming/${folder}`, import.meta.url)).filter(
        (f) => f.endsWith('.png'),
      );
      for (const f of delivered) {
        const id = f.split('.')[0]!;
        const name = f.endsWith('.lit.png') ? `${id}.windows.png` : f;
        expect(art(`${folder}/${name}`), `${folder}/${f}`).toBe(true);
      }
    }
  });
});

describe("the map's hexes match the art", () => {
  it('a tile is as wide as the art scaled, its straight sides 45% of that, its side band 8%', () => {
    const c = hexCorners({ x: 0, y: 0 }, HEX_RADIUS);
    const width = c[0]! - c[8]!;
    const side = c[3]! - c[1]!;
    expect(side / width).toBeCloseTo(180 / 400, 6);
    expect(TILE_DEPTH / width).toBeCloseTo(32 / 400, 2);
    // Slanted edges at 30°.
    expect((c[1]! - c[11]!) / (c[0]! - c[10]!)).toBeCloseTo(Math.tan(Math.PI / 6), 6);
    expect(SIDE_FACTOR).toBeCloseTo(0.779, 3);
    // The art's frame keeps the same shape.
    expect(info.tileWidth / info.frame[0]).toBeCloseTo(400 / 512, 6);
  });

  it('neighbouring tiles meet edge to edge', () => {
    const at = hexToPixel({ q: 0, r: 0 });
    const right = hexToPixel({ q: 1, r: 0 });
    const below = hexToPixel({ q: 0, r: 1 });
    const a = hexCorners(at, HEX_SPACING);
    const b = hexCorners(right, HEX_SPACING);
    const d = hexCorners(below, HEX_SPACING);
    // The right neighbour's left side is this tile's right side.
    expect([b[8], b[9], b[6], b[7]].map((v) => v!.toFixed(6))).toEqual(
      [a[0], a[1], a[2], a[3]].map((v) => v!.toFixed(6)),
    );
    // The lower-right neighbour's top corner is this tile's lower-right corner, and its upper-left
    // corner this tile's bottom corner: they share that edge.
    expect([d[10], d[11]].map((v) => v!.toFixed(6))).toEqual(
      [a[2], a[3]].map((v) => v!.toFixed(6)),
    );
    expect([d[8], d[9]].map((v) => v!.toFixed(6))).toEqual([a[4], a[5]].map((v) => v!.toFixed(6)));
  });
});
