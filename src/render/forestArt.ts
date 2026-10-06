/**
 * Rainforest Gardens on the map (FG4): a forest garden's layers drawn over it, each as far grown
 * as it is (coffee bushes, a banana, a canopy crown that widens over its seasons), until
 * hand-made art comes. Pure drawing from what `forestLook` reads off the run.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { layersOf } from '../sim/forest';
import type { BuildingState, RunState } from '../sim/types';
import type { Point } from './layout';
import { COLORS } from './palette';

export interface LayerLook {
  id: string;
  /** 0 when just added, 1 when grown. */
  grown: number;
}

/** A building's layers as the map draws them, each with how far it has grown. */
export function layerLooks(content: Content, state: RunState, b: BuildingState): LayerLook[] {
  return layersOf(content, state, b).map((l) => ({
    id: l.def.id,
    grown: l.grows === 0 ? 1 : Math.min(1, l.age / l.grows),
  }));
}

/** The layers over a forest garden's own drawing: shrubs low left, banana right, crown above. */
export function drawLayers(g: Graphics, c: Point, layers: LayerLook[]): void {
  const of = (id: string) => layers.find((l) => l.id === id);
  const shrub = of('shrub');
  if (shrub) {
    const s = 0.5 + 0.5 * shrub.grown;
    for (const [dx, dy] of [
      [-11, 7],
      [-6, 9],
    ] as const) {
      g.circle(c.x + dx, c.y + dy, 3 * s).fill({ color: 0x4f7a3a });
      if (shrub.grown >= 1) g.circle(c.x + dx + 1, c.y + dy - 1, 1).fill({ color: 0xb8322a });
    }
  }
  const banana = of('understory');
  if (banana) {
    const s = 0.5 + 0.5 * banana.grown;
    const x = c.x + 11;
    const y = c.y + 4;
    g.moveTo(x, y + 4)
      .lineTo(x, y - 6 * s)
      .stroke({ width: 1.6, color: COLORS.wood });
    for (const dx of [-5, 5])
      g.moveTo(x, y - 6 * s)
        .quadraticCurveTo(x + dx * 0.6 * s, y - 10 * s, x + dx * s, y - 4 * s)
        .stroke({ width: 2.4, color: 0x8fbf4a, cap: 'round' });
  }
  const canopy = of('canopy');
  if (canopy) {
    const r = 4 + 8 * canopy.grown;
    g.rect(c.x - 1, c.y - 12, 2, 8).fill({ color: COLORS.wood });
    g.circle(c.x, c.y - 12 - r * 0.4, r).fill({ color: 0x3f6a2a, alpha: 0.95 });
    g.circle(c.x - r * 0.4, c.y - 14 - r * 0.4, r * 0.55).fill({ color: COLORS.treeLight });
    if (canopy.grown >= 1)
      for (const [dx, dy] of [
        [-4, -12],
        [3, -16],
        [5, -11],
      ] as const)
        g.circle(c.x + dx, c.y + dy, 1.4).fill({ color: COLORS.fruit });
  }
}
