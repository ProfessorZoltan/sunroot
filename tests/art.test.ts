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
import { biomeContent } from '../src/content';
import { content } from './helpers';

const COAST = biomeContent('windsweptCoast');
const HIGH = biomeContent('highland');
const DESERT = biomeContent('sunDesert');
/** Buildings of every biome, each once. */
const drawn = [
  ...content.buildings,
  ...COAST.buildings.filter((b) => !content.byId[b.id]),
  ...HIGH.buildings.filter((b) => !content.byId[b.id] && !COAST.byId[b.id]),
  ...DESERT.buildings.filter((b) => !content.byId[b.id] && !COAST.byId[b.id] && !HIGH.byId[b.id]),
];
const byId = { ...DESERT.byId, ...HIGH.byId, ...COAST.byId, ...content.byId };
/** Buildings drawn in code until their art comes (the art guide asks for it). */
const AWAITING_ART = new Set(['iceHouse']);
/** Tiles drawn in code until their art comes (Lake Gardens, before its art guide). */
const TILES_AWAITING_ART = new Set(['shallows', 'deep', 'bed']);

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
    // The coast's tiles came with one summer look (the sea with three).
    const coast = ['mudflat', 'saltmarsh', 'dune'];
    for (const t of TILE_TYPES) {
      if (TILES_AWAITING_ART.has(t)) continue;
      const second = coast.includes(t) ? [] : [`${t}-2.png`];
      for (const f of [`${t}.png`, ...second, `${t}.winter.png`])
        expect(art(`tiles/${f}`), f).toBe(true);
    }
    expect(art('tiles/sea-3.png')).toBe(true);
  });

  it("gives the coast its own headlands, in place of the Reach's hills", () => {
    for (const f of ['hill.coast.png', 'hill.coast.winter.png'])
      expect(art(`tiles/${f}`), f).toBe(true);
    expect(COAST.land).toBe('coast');
  });

  it('gives the desert its own look for the shared tiles, a dry riverbed and a sandy canopy', () => {
    expect(DESERT.land).toBe('desert');
    for (const t of [
      'floodplain',
      'meadow',
      'scrub',
      'woodland',
      'ruin',
      'river',
      'river.desert.dry',
    ])
      for (const season of ['', '.winter']) {
        const f = t.includes('.') ? `${t}${season}.png` : `${t}.desert${season}.png`;
        expect(art(`tiles/${f}`), f).toBe(true);
      }
    for (const f of ['solarCanopy.desert.png', 'solarCanopy.desert.winter.png'])
      expect(art(`buildings/${f}`), f).toBe(true);
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
      // The coast's (B6), each with a winter dress.
      ...['tern.fly.1', 'tern.fly.2', 'tern.rest', 'seal.swim.1', 'seal.swim.2', 'seal.rest']
        .concat(['puffin.1', 'puffin.2', 'dolphin.1', 'dolphin.2', 'dolphin.3'])
        .flatMap((f) => [f, `${f}.winter`]),
      // The Highland's (HL6) and the desert's fennecs and oryx (SD6), each with a winter dress.
      ...['hare.run.1', 'hare.run.2', 'hare.sit', 'dipper.1', 'dipper.2', 'marten.1', 'marten.2']
        .concat(['eagle.soar.1', 'eagle.soar.2', 'eagle.perch', 'fennec.run.1', 'fennec.run.2'])
        .concat(['fennec.sit', 'oryx.walk.1', 'oryx.walk.2', 'oryx.walk.3', 'oryx.walk.4'])
        .concat(['oryx.graze.1', 'oryx.graze.2'])
        .flatMap((f) => [f, `${f}.winter`]),
      // The sandgrouse and the falcons, the same all year.
      'sandgrouse.1',
      'sandgrouse.2',
      'falcon.fly.1',
      'falcon.fly.2',
      'falcon.perch',
    ];
    for (const f of frames) expect(art(`wildlife/${f}.png`), f).toBe(true);
    for (const f of [
      ...content.festivals,
      ...COAST.festivals,
      ...HIGH.festivals,
      ...DESERT.festivals,
    ])
      expect(art(`festivals/${f.id}.card.webp`), f.id).toBe(true);
    for (const f of ['bunting', 'lantern', 'lantern.lit'])
      expect(art(`festivals/${f}.png`), f).toBe(true);
  });

  it("has the keepsakes: every young one's frames and the settlement's three props", () => {
    // Each young one's frames are its animal's, its own name after the animal's (ART-EXPANSION.md).
    const young: Record<string, string[]> = {
      'wildBees.bumble': ['1', '2', '3'],
      'otter.cub': ['swim.1', 'swim.2', 'rest'],
      'beaver.kit': ['swim.1', 'swim.2', 'carry'],
      'deer.white': ['walk.1', 'walk.2', 'walk.3', 'walk.4', 'graze.1', 'graze.2'],
      'tern.chick': ['rest'],
      'seal.pup': ['rest'],
      'puffin.fish': ['1', '2'],
      'dolphin.calf': ['1', '2', '3'],
      'hare.young': ['run.1', 'run.2', 'sit'],
      'dipper.young': ['1', '2'],
      'marten.kit': ['1', '2'],
      'fennec.cub': ['run.1', 'run.2', 'sit'],
      'sandgrouse.chick': ['1', '2'],
      'falcon.chick': ['perch'],
      'oryx.calf': ['walk.1', 'walk.2', 'walk.3', 'walk.4', 'graze.1', 'graze.2'],
    };
    for (const [name, frames] of Object.entries(young))
      for (const f of frames) expect(art(`wildlife/${name}.${f}.png`), `${name}.${f}`).toBe(true);
    for (const f of ['banner', 'windowBox', 'birdBox'])
      expect(art(`keepsakes/${f}.png`), f).toBe(true);
  });

  it('has the leaping fish of each land, and the first citizen (ART-PEOPLE.md)', () => {
    for (const land of ['', 'coast.', 'glen.', 'desert.'])
      for (const n of [1, 2, 3])
        expect(art(`wildlife/fish.${land}leap.${n}.png`), `fish.${land}leap.${n}`).toBe(true);
    for (const f of ['walk.1', 'walk.2', 'walk.3', 'walk.4', 'stand', 'work'])
      for (const layer of ['', '.clothes'])
        expect(art(`people/citizen.2.${f}${layer}.png`), `citizen.2.${f}${layer}`).toBe(true);
  });

  it('has every Root City district at each tier, and each landmark along its three edges', () => {
    const tiers = content.rules.score.tiers.map((t) => t.id);
    for (const d of content.districts)
      for (const tier of tiers)
        expect(art(`city/${d.id}.${tier}.png`), `${d.id}.${tier}`).toBe(true);
    for (const l of content.landmarks)
      for (const side of ['e', 'ne', 'nw'])
        expect(art(`city/${l.id}.edge.${side}.png`), `${l.id}.edge.${side}`).toBe(true);
  });

  it('has each wonder finished, in winter and at its 3 stages, with an icon (E5)', () => {
    for (const b of drawn.filter((d) => d.wonder)) {
      for (const f of ['', '.winter', '.stage1', '.stage2', '.stage3'])
        expect(art(`wonders/${b.id}${f}.png`), `${b.id}${f}`).toBe(true);
      expect(art(`icons/${b.id}.png`), b.id).toBe(true);
    }
  });

  it('covers every building in summer and winter, with an icon', () => {
    for (const b of drawn) {
      // Wonders have their own frame (above); some are still drawn in code.
      if (b.wonder || AWAITING_ART.has(b.id)) continue;
      // A building only on edges (the snow fence) comes as its 3 edge pieces.
      const pieces = ['e', 'ne', 'nw'].flatMap((d) => [
        `buildings/${b.id}.edge.${d}.png`,
        `buildings/${b.id}.edge.${d}.winter.png`,
      ]);
      if (b.edge && !art(`buildings/${b.id}.png`)) {
        for (const f of [...pieces, `icons/${b.id}.png`]) expect(art(f), f).toBe(true);
        continue;
      }
      for (const f of [
        `buildings/${b.id}.png`,
        `buildings/${b.id}.winter.png`,
        `icons/${b.id}.png`,
      ])
        expect(art(f), f).toBe(true);
    }
  });

  it('lights homes and some others at night, and turns the spires, the wheels and the turbines', () => {
    for (const lit of [
      'foundersCamp',
      'cottage',
      'treehouseCommons',
      'bathhouse',
      'aquaponicsHall',
      'mushroomCellar',
      'oldWorldArchive',
      'lighthouse',
      'bothy',
      'lookout',
      'mudBrickHouse',
      'concentratedSolarPlant',
    ])
      expect(art(`buildings/${lit}.windows.png`), lit).toBe(true);
    for (const id of [
      'windSpire',
      'riverWheel',
      'singingSpire',
      'tideTurbine',
      'hillTurbine',
      'cascade',
    ]) {
      expect(art(`buildings/${id}.rotor.png`), id).toBe(true);
      expect(info.pivots[id], id).toHaveLength(2);
    }
  });

  it('draws channels and qanats as a hub with an arm to each neighbour, with a sluice gate', () => {
    for (const id of ['irrigationChannel', 'qanat'])
      for (const arm of ['e', 'ne', 'nw', 'w', 'sw', 'se'])
        for (const season of ['', '.winter'])
          expect(art(`buildings/${id}.${arm}${season}.png`), `${id}.${arm}${season}`).toBe(true);
    expect(art('buildings/sluiceGate.png')).toBe(true);
  });

  it('draws hedges along the three sides a tile owns (DECISIONS.md, Hedgerows on edges)', () => {
    for (const id of ['hedgerow', 'palmWindbreak'])
      for (const side of ['e', 'ne', 'nw'])
        for (const season of ['', '.winter'])
          expect(art(`buildings/${id}.edge.${side}${season}.png`), `${id} ${side}${season}`).toBe(
            true,
          );
  });

  it('marks only buildings that stand on one kind of tile, or fields, as carrying their own', () => {
    expect(info.ground).toEqual([
      'batRoost',
      'beaverDam',
      'concentratedSolarPlant',
      'coppiceRegrowth',
      'coppiceWood',
      'croft',
      'estuaryTurbine',
      'glenFarm',
      'hangingGarden',
      'lighthouse',
      'lookout',
      'machairCroft',
      'oasisGarden',
      'oldWorldArchive',
      'pumpedReservoir',
      'restoredArray',
      'rewettedBog',
      'rewildedRuin',
      'riceFishPaddy',
      'rockPool',
      'saltWorks',
      'salvageYard',
      'singingSpire',
      'terraceFarm',
      'threeLayerGarden',
      'wadiFarm',
      'weir',
      'windSpire',
    ]);
    for (const id of info.ground) {
      const def = byId[id]!;
      // A croft's strips are its ground, on whichever land it is dug (ART-EXPANSION.md).
      if (def.farmland) continue;
      expect(def.placement.tiles, id).toHaveLength(1);
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
        // A delivered icon takes the icon's place; lit windows are kept alone.
        const path = f.endsWith('.icon.png')
          ? `icons/${id}.png`
          : `${folder}/${f.endsWith('.lit.png') ? `${id}.windows.png` : f}`;
        expect(art(path), `${folder}/${f}`).toBe(true);
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
