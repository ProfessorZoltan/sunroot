/**
 * Rainforest Gardens on the map (FG4): a forest garden's layers drawn over it, each as far grown
 * as it is (coffee bushes, a banana, a canopy crown that widens over its seasons), for any layer
 * whose art is missing; and the canopy's shade under the woodland art. Pure drawing.
 */
import type { Graphics } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { layersOf } from '../sim/forest';
import type { BuildingState, RunState } from '../sim/types';
import { hexKey, hexNeighbors, type Hex } from '../sim/hex';
import { HEX_RADIUS, hexCorners, hexToPixel, type Point } from './layout';
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

/** Deep shade under the rainforest's woodland (the art guide's forest green). */
export const CANOPY_SHADE = 0x2f4a24;

/**
 * The canopy closed over the woodland: deep shade under each woodland tile, across the gutter
 * between two woodland tiles and over the corner where three meet. Drawn beneath every tile, so
 * it shows only where the trees let light through; gutters beside other land stay as they are.
 */
export function drawCanopyShade(g: Graphics, woodland: Hex[]): void {
  const at = new Set(woodland.map(hexKey));
  const corners = (h: Hex, r: number) => {
    const flat = hexCorners(hexToPixel(h), r);
    return Array.from({ length: flat.length / 2 }, (_, i) => ({
      x: flat[2 * i]!,
      y: flat[2 * i + 1]!,
    }));
  };
  // A tile's corner nearest a point: where its side or corner faces a neighbour's.
  const nearest = (h: Hex, p: Point) =>
    corners(h, HEX_RADIUS - 0.5).sort(
      (a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
    );
  const fill = (pts: Point[]) => g.poly(pts.flatMap((p) => [p.x, p.y])).fill(CANOPY_SHADE);
  for (const h of woodland) {
    g.poly(hexCorners(hexToPixel(h), HEX_RADIUS)).fill(CANOPY_SHADE);
    const near = hexNeighbors(h).filter((n) => at.has(hexKey(n)));
    for (const n of near) {
      if (hexKey(n) < hexKey(h)) continue;
      const [a1, a2] = nearest(h, hexToPixel(n));
      fill([a1!, a2!, nearest(n, a2!)[0]!, nearest(n, a1!)[0]!]);
      // The corner shared with a third woodland tile beside both.
      for (const m of near) {
        if (hexKey(m) <= hexKey(n) || !hexNeighbors(n).some((x) => hexKey(x) === hexKey(m)))
          continue;
        const [p, q, r] = [h, n, m].map(hexToPixel);
        const mid = { x: (p!.x + q!.x + r!.x) / 3, y: (p!.y + q!.y + r!.y) / 3 };
        fill([h, n, m].map((t) => nearest(t, mid)[0]!));
      }
    }
  }
}
