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

const urls = import.meta.glob('../art/**/*.png', {
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

/** A tile's art: one of its variants (the same every time for a tile), in winter dress if it has one. */
export function tileTexture(type: string, key: string, season: Season): Texture | null {
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

export function buildingTexture(id: string, season: Season): Texture | null {
  return season === 'winter'
    ? pick(`buildings/${id}.winter.png`, `buildings/${id}.png`)
    : pick(`buildings/${id}.png`);
}

export function rotorTexture(id: string, season: Season): Texture | null {
  return season === 'winter'
    ? pick(`buildings/${id}.rotor.winter.png`, `buildings/${id}.rotor.png`)
    : pick(`buildings/${id}.rotor.png`);
}

/** The windows a home lights at night, alone. */
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
