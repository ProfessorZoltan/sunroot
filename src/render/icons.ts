/**
 * Building icons for the interface, rendered once from the same art as the
 * map (so cards, palette and map always match).
 */
import { Graphics, Rectangle, type Application } from 'pixi.js';
import { BUILDING_ART } from './buildingArt';

const FRAME = new Rectangle(-22, -24, 44, 44);

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
