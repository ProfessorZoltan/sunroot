/**
 * Root City's imported art (src/art/city, docs/ART-CITY.md), for the city screen:
 * where each file is, and how to place it on a district's hex. Anything without
 * a file is drawn in code as before.
 */
import { HEX_RADIUS, HEX_SPACING } from '../render/layout';

interface CityInfo {
  frame: [number, number];
  tileCentre: [number, number];
  tileWidth: number;
  city?: {
    tallFrame: [number, number];
    tallTileCentre: [number, number];
    pivots: Record<string, [number, number]>;
  };
}

const urls = import.meta.glob('../art/city/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const infos = import.meta.glob('../art/art.json', { eager: true, import: 'default' }) as Record<
  string,
  CityInfo
>;
const info: CityInfo | null = Object.values(infos)[0] ?? null;
const byName = new Map(
  Object.entries(urls).map(([k, url]) => [
    k.replace('../art/city/', '').replace(/\.png$/, ''),
    url,
  ]),
);

/** A city art file's URL by its name without `.png` (`orchardWard.sapling`), or null. */
export function cityArtUrl(name: string): string | null {
  return byName.get(name) ?? null;
}

/** Whether any city art has been imported (the city is drawn in code until then). */
export const hasCityArt = () => byName.size > 0;

/** A rotor's pivot, in the imported frame, by its file name without `.rotor.png`. */
export function cityPivot(name: string): [number, number] | null {
  return info?.city?.pivots[name] ?? null;
}

export interface Placement {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where an image goes so its tile sits on the hex centred at (cx, cy), in a city drawn at
 * `spacing` (the map's HEX_SPACING scaled). Tall images (the Heartwood) have their tile at the bottom.
 */
export function placeArt(cx: number, cy: number, spacing: number, tall = false): Placement | null {
  if (!info) return null;
  const k = ((spacing / HEX_SPACING) * Math.sqrt(3) * HEX_RADIUS) / info.tileWidth;
  const [w, h] = tall && info.city ? info.city.tallFrame : info.frame;
  const [ox, oy] = tall && info.city ? info.city.tallTileCentre : info.tileCentre;
  return { x: cx - ox * k, y: cy - oy * k, width: w * k, height: h * k };
}

/** How much a frame's pixel is scaled in the city (for rotor pivots). */
export function artScaleAt(spacing: number): number {
  return info ? ((spacing / HEX_SPACING) * Math.sqrt(3) * HEX_RADIUS) / info.tileWidth : 1;
}
