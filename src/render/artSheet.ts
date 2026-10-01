/**
 * The art sheet (?art): every tile and building as the game draws it now,
 * each in the same fixed frame that hand-made art is delivered in (see
 * docs/ART.md). `scripts/export-art.ts` saves them as PNGs for artists to
 * draw over. Nothing here is used in play.
 */
import { Graphics, Rectangle, type Application } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { TILE_TYPES, type TileType } from '../sim/content/schema';
import { BUILDING_ART } from './buildingArt';
import { HEX_RADIUS, TILE_DEPTH } from './layout';
import { drawTile } from './tileArt';

/**
 * The frame, in game pixels: 64 wide, 96 tall, with the tile's centre at
 * (32, 60). Art is delivered at SCALE times this (256 x 384, centre at
 * 128, 240).
 */
export const ART_FRAME = { width: 64, height: 96, anchorX: 32, anchorY: 60 } as const;
export const ART_SCALE = 4;

export interface ArtEntry {
  kind: 'tile' | 'building' | 'context';
  id: string;
  name: string;
  /** PNG as a data URL, ART_SCALE times the game size. */
  png: string;
}

const FRAME = new Rectangle(
  -ART_FRAME.anchorX,
  -ART_FRAME.anchorY,
  ART_FRAME.width,
  ART_FRAME.height,
);

const TILE_NAMES: Record<TileType, string> = {
  river: 'River',
  reservoir: 'Reservoir',
  floodplain: 'Floodplain',
  hill: 'Hill',
  ruin: 'Ruin',
  barren: 'Barren',
  scrub: 'Scrub',
  meadow: 'Meadow',
  woodland: 'Woodland',
};

/** A tile each building usually stands on, for the in-context pictures. */
function homeTile(content: Content, id: string): TileType {
  const tiles = content.byId[id]?.placement?.tiles ?? [];
  for (const t of ['meadow', 'hill', 'ruin', 'floodplain', 'scrub'] as const)
    if (tiles.includes(t)) return t;
  return id === 'weir' ? 'river' : 'meadow';
}

export async function renderArtSheet(app: Application, content: Content): Promise<ArtEntry[]> {
  const out: ArtEntry[] = [];
  const shoot = async (g: Graphics) => {
    const png = await app.renderer.extract.base64({
      target: g,
      frame: FRAME,
      resolution: ART_SCALE,
    });
    g.destroy();
    return png;
  };
  const tile = (g: Graphics, type: TileType) =>
    drawTile(g, { q: 0, r: 0, type }, { x: 0, y: 0 }, `art:${type}`);

  for (const type of TILE_TYPES) {
    const g = new Graphics();
    tile(g, type);
    out.push({ kind: 'tile', id: type, name: TILE_NAMES[type], png: await shoot(g) });
  }
  for (const [id, art] of Object.entries(BUILDING_ART)) {
    const name = content.byId[id]?.name ?? id;
    const alone = new Graphics();
    art(alone, { x: 0, y: 0 });
    out.push({ kind: 'building', id, name, png: await shoot(alone) });
    const ctx = new Graphics();
    tile(ctx, homeTile(content, id));
    art(ctx, { x: 0, y: 0 });
    out.push({ kind: 'context', id, name, png: await shoot(ctx) });
  }
  return out;
}

/** The frame's guide lines, for the template image (in game pixels, centre at 0, 0). */
export const ART_GUIDES = {
  hexRadius: HEX_RADIUS,
  tileDepth: TILE_DEPTH,
  /** Keep a building's base inside this hex so the tile's rim shows round it. */
  footprintRadius: 22,
  /** Most buildings stay below this height above the centre; tall ones may reach the frame top. */
  usualTop: -30,
};
