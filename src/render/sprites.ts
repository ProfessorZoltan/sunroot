/**
 * Hand-made art (docs/ART.md), as imported into src/art by
 * scripts/import-art.ts. Every file shares one frame: the tile's centre at
 * `tileCentre`, the tile `tileWidth` across. Anything without a file keeps
 * its procedural drawing, so the game runs (and tests run) without art.
 */
import { Assets, Sprite, type Texture } from 'pixi.js';
import type { Season } from '../sim/content/schema';
import { HEX_RADIUS, tileRandom, type Point } from './layout';

interface ArtInfo {
  frame: [number, number];
  tileCentre: [number, number];
  tileWidth: number;
  /** Buildings drawn with their own tile: they take the tile's place. */
  ground: string[];
  /** Where each rotor turns, in the frame. */
  pivots: Record<string, [number, number]>;
}

// The map's art: Root City's has its own loader (src/ui/cityArt.ts).
const urls = import.meta.glob(['../art/**/*.png', '!../art/city/**'], {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const infos = import.meta.glob('../art/art.json', { eager: true, import: 'default' }) as Record<
  string,
  ArtInfo
>;
const info: ArtInfo | null = Object.values(infos)[0] ?? null;
/** Files by their path in src/art: `tiles/meadow-2.png`, `buildings/cottage.winter.png`. */
const byPath = new Map(Object.entries(urls).map(([k, url]) => [k.replace('../art/', ''), url]));
const textures = new Map<string, Texture>();

/** Loads every texture; resolves with how many. Safe to call when there is no art. */
export async function loadArt(): Promise<number> {
  const paths = [...byPath.keys()].filter((p) => !p.startsWith('icons/'));
  const loaded = (await Assets.load(paths.map((p) => byPath.get(p)!))) as Record<string, Texture>;
  for (const p of paths) {
    const tex = loaded[byPath.get(p)!];
    if (tex) textures.set(p, tex);
  }
  return textures.size;
}

export function artLoaded(): number {
  return textures.size;
}

const pick = (...paths: string[]): Texture | null => {
  for (const p of paths) {
    const t = textures.get(p);
    if (t) return t;
  }
  return null;
};

/**
 * A tile's art: one of its variants (the same every time for a tile), in winter dress if it has
 * one. A biome's land may have its own look for a shared type (the coast's headlands,
 * `hill.coast.png`), which it takes in place of the shared one.
 */
/**
 * Lands whose winter brings no snow (the Sun Desert's green winter, Lake Gardens' low water,
 * Rainforest Gardens' dry season; `SNOWLESS_LANDS`): the shared art's winter dress has snow, so there a shared tile or building
 * keeps its summer look in winter. The land's own looks
 * (`id.land.winter.png`) and its own tiles' and buildings' winter art are used as delivered.
 */
const GREEN_WINTER: Record<string, readonly string[]> = {
  desert: [
    'oasis',
    'reg',
    'erg',
    'rock',
    'saltFlat',
    'oasisGarden',
    'wadiFarm',
    'mudBrickHouse',
    'windTower',
    'absorptionChiller',
    'fogNet',
    'qanat',
    'concentratedSolarPlant',
    'sandBattery',
    'iceHouse',
    'palmWindbreak',
    'saltWorks',
    'threeLayerGarden',
    'fogFence',
    'restoredArray',
    'solarOasis',
  ],
  // Lake Gardens' winter is low water, not snow.
  lake: [
    'shallows',
    'deep',
    'bed',
    'chinampa',
    'mudBoat',
    'stiltHouse',
    'wastewaterFishery',
    'lakeFishery',
    'mulberryDyke',
    'silkHouse',
    'pigPen',
    'duckHouse',
    'willowEdge',
    'floatingSolar',
    'canalWheel',
    'riceDuckPaddy',
    'floatingMarket',
    'floatingCity',
  ],
  // Rainforest Gardens' winter is the dry season: the shared art keeps its summer look; the
  // forest's own tiles and buildings wear their dry-season art.
  forest: [
    'darkEarth',
    'milpa',
    'forestGarden',
    'orchardGarden',
    'raisedHouse',
    'kitchenMidden',
    'charHearth',
    'stallBarn',
    'beeTree',
    'riceTerrace',
    'waterTemple',
    'livingFence',
    'microHydro',
    'canopyWalk',
  ],
};

/** The season whose art a shared tile or building wears in this land (no snow in the desert). */
export function artSeason(id: string, season: Season, land?: string): Season {
  const own = land ? GREEN_WINTER[land] : undefined;
  return season === 'winter' && own && !own.includes(id) ? 'summer' : season;
}

export function tileTexture(
  type: string,
  key: string,
  shown: Season,
  land?: string,
): Texture | null {
  if (land && textures.has(`tiles/${type}.${land}.png`)) {
    if (shown === 'winter')
      return pick(`tiles/${type}.${land}.winter.png`, `tiles/${type}.${land}.png`);
    // A land's look may come in more than one (`woodland.forest-2.png`): the same every time.
    const looks = [`tiles/${type}.${land}.png`, `tiles/${type}.${land}-2.png`].filter((p) =>
      textures.has(p),
    );
    return textures.get(looks[Math.floor(tileRandom(`${key}:variant`)() * looks.length)]!)!;
  }
  const season = artSeason(type, shown, land);
  const variants = [`tiles/${type}.png`, `tiles/${type}-2.png`, `tiles/${type}-3.png`].filter((p) =>
    textures.has(p),
  );
  if (variants.length === 0) return null;
  if (season === 'winter') {
    const winter = pick(`tiles/${type}.winter.png`);
    if (winter) return winter;
  }
  const i = Math.floor(tileRandom(`${key}:variant`)() * variants.length);
  return textures.get(variants[i]!)!;
}

/** Whether the shallows have their own winter art (Lake Gardens' low water). */
export function hasLowWaterArt(): boolean {
  return textures.has('tiles/shallows.winter.png');
}

/** Shallows silted up with mud (Lake Gardens, `shallows.silted.png`), if it has art. */
export function siltedTexture(): Texture | null {
  return pick('tiles/shallows.silted.png');
}

/** The land's dry riverbed (`river.desert.dry.png`), if it has one. */
export function dryRiverTexture(land: string): Texture | null {
  return pick(`tiles/river.${land}.dry.png`);
}

export function buildingTexture(id: string, shown: Season, land?: string): Texture | null {
  // A biome's own dress for a shared building (the desert's sandy canopy), if it has one.
  if (land && textures.has(`buildings/${id}.${land}.png`))
    return shown === 'winter'
      ? pick(`buildings/${id}.${land}.winter.png`, `buildings/${id}.${land}.png`)
      : pick(`buildings/${id}.${land}.png`);
  const season = artSeason(id, shown, land);
  return season === 'winter'
    ? pick(`buildings/${id}.winter.png`, `buildings/${id}.png`)
    : pick(`buildings/${id}.png`);
}

/**
 * A forest garden's layer (Rainforest Gardens, ART-EXPANSION.md): `forestGarden.shrub.png` grown,
 * `forestGarden.shrub.young.png` while it grows (the grown one if no young one came).
 */
export function layerTexture(building: string, layer: string, grown: boolean): Texture | null {
  const own = `buildings/${building}.${layer}`;
  return grown ? pick(`${own}.png`) : pick(`${own}.young.png`, `${own}.png`);
}

export function rotorTexture(id: string, season: Season): Texture | null {
  return season === 'winter'
    ? pick(`buildings/${id}.rotor.winter.png`, `buildings/${id}.rotor.png`)
    : pick(`buildings/${id}.rotor.png`);
}

/** The arms of a connecting piece (a channel, a hedgerow), in HEX_DIRECTIONS order. */
export const ARMS = ['e', 'ne', 'nw', 'w', 'sw', 'se'] as const;

/** One arm of a connecting piece, from its hub towards the neighbour in that direction. */
export function armTexture(id: string, arm: number, season: Season): Texture | null {
  const name = ARMS[arm];
  if (!name) return null;
  return season === 'winter'
    ? pick(`buildings/${id}.${name}.winter.png`, `buildings/${id}.${name}.png`)
    : pick(`buildings/${id}.${name}.png`);
}

/** A hedge along one of the three sides a tile draws (0 east, 1 north-east, 2 north-west). */
export function edgeTexture(id: string, side: number, season: Season): Texture | null {
  const name = ARMS[side];
  if (side > 2 || !name) return null;
  return season === 'winter'
    ? pick(`buildings/${id}.edge.${name}.winter.png`, `buildings/${id}.edge.${name}.png`)
    : pick(`buildings/${id}.edge.${name}.png`);
}

/** Whether a building is drawn as a hub with arms to its neighbours. */
export function hasArms(id: string): boolean {
  return textures.has(`buildings/${id}.e.png`);
}

/** The windows a building lights at night, alone. */
export function windowsTexture(id: string): Texture | null {
  return pick(`buildings/${id}.windows.png`);
}

/** Whether a building's art includes its own tile (and replaces the tile under it). */
export function hasGround(id: string): boolean {
  return (info?.ground.includes(id) ?? false) && textures.has(`buildings/${id}.png`);
}

/** The interface icon for a building, if it has art. */
export function iconUrl(id: string): string | null {
  return byPath.get(`icons/${id}.png`) ?? null;
}

/** How much smaller the art is drawn than it was made. */
export function artScale(): number {
  return info ? (Math.sqrt(3) * HEX_RADIUS) / info.tileWidth : 1;
}

/** A sprite of art, placed so its tile sits on the tile centred at `c`. */
export function artSprite(texture: Texture, c: Point): Sprite {
  const s = new Sprite(texture);
  const [w, h] = info!.frame;
  s.anchor.set(info!.tileCentre[0] / w, info!.tileCentre[1] / h);
  s.scale.set(artScale());
  s.position.set(c.x, c.y);
  return s;
}

/** A rotor sprite, turning about its pivot, for the tile centred at `c`. */
export function rotorSprite(id: string, texture: Texture, c: Point): Sprite | null {
  const pivot = info?.pivots[id];
  if (!pivot) return null;
  const s = new Sprite(texture);
  const [w, h] = info!.frame;
  const k = artScale();
  s.anchor.set(pivot[0] / w, pivot[1] / h);
  s.scale.set(k);
  s.position.set(
    c.x + (pivot[0] - info!.tileCentre[0]) * k,
    c.y + (pivot[1] - info!.tileCentre[1]) * k,
  );
  return s;
}

/** A frame of an animal's art (`deer.walk.2`), in winter dress if it has one. */
export function wildlifeTexture(frame: string, season: Season): Texture | null {
  return season === 'winter'
    ? pick(`wildlife/${frame}.winter.png`, `wildlife/${frame}.png`)
    : pick(`wildlife/${frame}.png`);
}

/** A festival prop: `bunting`, `lantern` or `lantern.lit`. */
export function propTexture(name: string): Texture | null {
  return pick(`festivals/${name}.png`);
}

/** A citizen's frame (`people/citizen.2.walk.1.png`, its `.clothes`), once it comes (docs/ART-PEOPLE.md). */
export function peopleTexture(name: string): Texture | null {
  return pick(`people/${name}.png`);
}

/** Whether a citizen's frame has come. */
export function hasPeopleArt(name: string): boolean {
  return textures.has(`people/${name}.png`);
}

/** Whether a wildlife frame has come (the leaping fish's, `fish.leap.1`). */
export function hasWildlifeArt(name: string): boolean {
  return textures.has(`wildlife/${name}.png`);
}

/** A settlement keepsake's art (`keepsakes/banner.png`, `windowBox`, `birdBox`, `kite`), once it comes. */
export function keepsakeTexture(name: string): Texture | null {
  return pick(`keepsakes/${name}.png`);
}

/** A wonder's art: a construction stage (1 to 3) while it is built, else finished, in winter dress. */
export function wonderTexture(id: string, stage: number | null, season: Season): Texture | null {
  if (stage !== null) return pick(`wonders/${id}.stage${stage}.png`);
  return season === 'winter'
    ? pick(`wonders/${id}.winter.png`, `wonders/${id}.png`)
    : pick(`wonders/${id}.png`);
}

/**
 * A wonder's sprite over its 7 tiles, its centre tile on the tile centred at
 * `c`. Its frame is three standard frames wide and two tall (1536 × 1280 as
 * made), the centre tile's centre at (768, 669) (ART-EXPANSION.md).
 */
export function wonderSprite(texture: Texture, c: Point): Sprite {
  const s = new Sprite(texture);
  s.anchor.set(768 / 1536, 669 / 1280);
  s.scale.set(artScale());
  s.position.set(c.x, c.y);
  return s;
}
