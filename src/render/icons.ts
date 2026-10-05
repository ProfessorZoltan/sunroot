/**
 * Building and tile icons for the interface, rendered once from the same art as the
 * map (so cards, palette and map always match).
 */
import { Container, Graphics, Rectangle, type Application } from 'pixi.js';
import { TILE_TYPES } from '../sim/content/schema';
import { BUILDING_ART } from './buildingArt';
import { artSprite, tileTexture } from './sprites';
import { drawTile } from './tileArt';

const FRAME = new Rectangle(-22, -24, 44, 44);
/** A whole tile, its side included. */
const TILE_FRAME = new Rectangle(-27, -28, 54, 58);

export async function renderBuildingIcons(app: Application): Promise<Record<string, string>> {
  const icons: Record<string, string> = {};
  for (const [id, art] of Object.entries(BUILDING_ART)) {
    const g = new Graphics();
    art(g, { x: 0, y: 0 });
    icons[id] = await app.renderer.extract.base64({ target: g, frame: FRAME, resolution: 3 });
    g.destroy();
  }
  return icons;
}

/** Every tile type as it looks in this land in summer: its hand-made art, or drawn in code. */
export async function renderTileIcons(
  app: Application,
  land?: string,
): Promise<Record<string, string>> {
  const icons: Record<string, string> = {};
  for (const type of TILE_TYPES) {
    const c = new Container();
    const key = `icon:${type}`;
    const texture = tileTexture(type, key, 'summer', land);
    if (texture) c.addChild(artSprite(texture, { x: 0, y: 0 }));
    else {
      const g = new Graphics();
      drawTile(g, { q: 0, r: 0, type }, { x: 0, y: 0 }, key);
      c.addChild(g);
    }
    icons[type] = await app.renderer.extract.base64({
      target: c,
      frame: TILE_FRAME,
      resolution: 3,
    });
    c.destroy({ children: true });
  }
  return icons;
}
