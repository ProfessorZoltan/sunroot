/**
 * The Pixi map. It only reads run state and reports pointer input; the game
 * store turns input into commands. Layers, back to front: fog, terrain (tiles
 * drawn row by row so each row's top covers the side of the row above),
 * river flow, buildings, then the overlay (hover, ghost, preview numbers).
 */
import type { Application } from 'pixi.js';
import { Container, Graphics, Text } from 'pixi.js';
import type { Content } from '../sim/content/load';
import { hexKey, type Hex } from '../sim/hex';
import type { PlacementPreview, PreviewKey } from '../sim/preview';
import type { RunState } from '../sim/types';
import { BUILDING_ART, drawCondition } from './buildingArt';
import {
  HEX_RADIUS,
  boundsOf,
  fogHexes,
  hexCorners,
  hexToPixel,
  pixelToHex,
  type Bounds,
  type Point,
} from './layout';
import { COLORS } from './palette';
import { dashedLine, drawFogTile, drawTile } from './tileArt';

export interface MapViewEvents {
  onHover(hex: Hex | null): void;
  onClick(hex: Hex): void;
  onCancel(): void;
}

export interface Placement {
  building: string;
  at: Hex;
  preview: PlacementPreview;
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;
const DRAG_THRESHOLD = 5;

const LABELS: Record<PreviewKey, string> = {
  materials: 'materials',
  food: 'food',
  biomass: 'biomass',
  salvage: 'salvage',
  compost: 'compost',
  knowledge: 'knowledge',
  scraps: 'scraps',
  clutter: 'clutter',
  dayEnergy: 'day energy',
  nightEnergy: 'night energy',
  dayHeat: 'day heat',
  nightHeat: 'night heat',
};

export class MapView {
  private readonly world = new Container();
  private readonly terrain = new Graphics();
  private readonly flow = new Graphics();
  private readonly buildings = new Graphics();
  private readonly overlay = new Graphics();
  private readonly labels = new Container();
  private bounds: Bounds | null = null;
  private mapSignature = '';
  private state: RunState | null = null;
  private zoom = 1;
  private pointer: { x: number; y: number; dragging: boolean; button: number } | null = null;

  constructor(
    private readonly app: Application,
    private readonly content: Content,
    private readonly events: MapViewEvents,
  ) {
    app.stage.addChild(this.world);
    this.world.addChild(this.terrain, this.flow, this.buildings, this.overlay, this.labels);
    this.listen(app.canvas);
  }

  /** Redraws whatever changed in the run state. */
  setState(state: RunState): void {
    const signature = Object.values(state.map.tiles)
      .map((t) => t.type[0])
      .join('');
    if (signature !== this.mapSignature) {
      this.mapSignature = signature;
      this.drawTerrain(state);
      if (!this.bounds) {
        this.bounds = boundsOf([...Object.values(state.map.tiles), ...fogHexes(state.map)]);
        this.fit();
      }
    }
    this.state = state;
    this.drawBuildings(state);
  }

  /** Hover outline, and in placement mode the ghost building and its preview numbers. */
  setOverlay(
    hover: Hex | null,
    placement: Placement | null,
    cursor: 'hover' | 'compost' = 'hover',
  ): void {
    const g = this.overlay.clear();
    for (const child of this.labels.removeChildren()) child.destroy();
    if (placement) {
      const { preview, at, building } = placement;
      const c = hexToPixel(at);
      if (preview.ok) {
        const affected = new Map<string, { at: Hex; lines: [string, number][] }>();
        for (const item of preview.items) {
          const key = hexKey(item.at);
          const entry = affected.get(key) ?? { at: item.at, lines: [] };
          entry.lines.push([LABELS[item.key], item.amount]);
          affected.set(key, entry);
        }
        for (const [key, entry] of affected) {
          if (key !== hexKey(at)) {
            g.poly(hexCorners(hexToPixel(entry.at), HEX_RADIUS - 1.5)).stroke({
              width: 2.5,
              color: COLORS.leadingGold,
            });
          }
        }
        g.poly(hexCorners(c, HEX_RADIUS - 1)).fill({ color: 0xfff3cf, alpha: 0.55 });
        const outline = hexCorners(c, HEX_RADIUS - 1.5);
        const pts: Point[] = [];
        for (let i = 0; i <= 6; i++)
          pts.push({ x: outline[(i % 6) * 2]!, y: outline[(i % 6) * 2 + 1]! });
        dashedLine(g, pts, 5, 4, { width: 2.5, color: COLORS.leadingGold });
        this.ghost(building, c);
        for (const entry of affected.values()) this.numbers(hexToPixel(entry.at), entry.lines);
      } else {
        g.poly(hexCorners(c, HEX_RADIUS - 1.5))
          .fill({ color: COLORS.bad, alpha: 0.18 })
          .stroke({ width: 2.5, color: COLORS.bad });
        this.ghost(building, c, 0.35);
      }
      return;
    }
    if (hover) {
      g.poly(hexCorners(hexToPixel(hover), HEX_RADIUS - 1.5)).stroke({
        width: cursor === 'compost' ? 3 : 2.5,
        color: cursor === 'compost' ? COLORS.good : COLORS.leadingGold,
      });
    }
  }

  /** Centres the valley in the view at a zoom that fits it. */
  fit(): void {
    if (!this.bounds) return;
    const { width, height } = this.app.screen;
    const w = this.bounds.maxX - this.bounds.minX;
    const h = this.bounds.maxY - this.bounds.minY;
    this.zoom = clamp(Math.min(width / w, height / h) * 0.98, MIN_ZOOM, MAX_ZOOM);
    this.world.scale.set(this.zoom);
    this.world.position.set(
      width / 2 - ((this.bounds.minX + this.bounds.maxX) / 2) * this.zoom,
      height / 2 - ((this.bounds.minY + this.bounds.maxY) / 2) * this.zoom,
    );
  }

  /** Pans just enough to bring a hex into view (for the keyboard cursor). */
  ensureVisible(h: Hex, margin = 70): void {
    const p = this.screenOf(h);
    const { width, height } = this.app.screen;
    const dx = p.x < margin ? margin - p.x : p.x > width - margin ? width - margin - p.x : 0;
    const dy = p.y < margin ? margin - p.y : p.y > height - margin ? height - margin - p.y : 0;
    if (dx || dy) this.pan(dx, dy);
  }

  pan(dx: number, dy: number): void {
    this.world.position.set(this.world.position.x + dx, this.world.position.y + dy);
    this.clampPosition();
  }

  /** Zooms by `factor`, keeping the point under `at` (screen px) still. */
  zoomBy(
    factor: number,
    at: Point = { x: this.app.screen.width / 2, y: this.app.screen.height / 2 },
  ): void {
    const next = clamp(this.zoom * factor, MIN_ZOOM, MAX_ZOOM);
    const world = this.toWorld(at);
    this.zoom = next;
    this.world.scale.set(next);
    this.world.position.set(at.x - world.x * next, at.y - world.y * next);
    this.clampPosition();
  }

  get zoomLevel(): number {
    return this.zoom;
  }

  /** Where a hex's centre is on screen (for tests and pointer tools). */
  screenOf(h: Hex): Point {
    const p = hexToPixel(h);
    return {
      x: p.x * this.zoom + this.world.position.x,
      y: p.y * this.zoom + this.world.position.y,
    };
  }

  /** The valley tile under a screen point, if any. */
  hexAt(screen: Point): Hex | null {
    if (!this.state) return null;
    const h = pixelToHex(this.toWorld(screen));
    return this.state.map.tiles[hexKey(h)] ? h : null;
  }

  private toWorld(p: Point): Point {
    return {
      x: (p.x - this.world.position.x) / this.zoom,
      y: (p.y - this.world.position.y) / this.zoom,
    };
  }

  private clampPosition(): void {
    if (!this.bounds) return;
    const { width, height } = this.app.screen;
    const margin = 120;
    const minX = width - margin - this.bounds.maxX * this.zoom;
    const maxX = margin - this.bounds.minX * this.zoom;
    const minY = height - margin - this.bounds.maxY * this.zoom;
    const maxY = margin - this.bounds.minY * this.zoom;
    this.world.position.set(
      clamp(this.world.position.x, Math.min(minX, maxX), Math.max(minX, maxX)),
      clamp(this.world.position.y, Math.min(minY, maxY), Math.max(minY, maxY)),
    );
  }

  private drawTerrain(state: RunState): void {
    const g = this.terrain.clear();
    for (const h of fogHexes(state.map)) drawFogTile(g, hexToPixel(h));
    const tiles = Object.entries(state.map.tiles).sort(([, a], [, b]) => a.r - b.r || a.q - b.q);
    for (const [key, tile] of tiles) drawTile(g, tile, hexToPixel(tile), key);

    // The river's flow line runs through tile centres and on into the fog.
    const f = this.flow.clear();
    const centres = state.map.river.map((k) => hexToPixel(state.map.tiles[k]!));
    if (centres.length >= 2) {
      const extend = (a: Point, b: Point): Point => ({
        x: b.x + (b.x - a.x),
        y: b.y + (b.y - a.y),
      });
      const path = [
        extend(centres[1]!, centres[0]!),
        ...centres,
        extend(centres.at(-2)!, centres.at(-1)!),
      ];
      dashedLine(f, path, 10, 9, { width: 3, color: 0xcfe7ee });
    }
  }

  private drawBuildings(state: RunState): void {
    const g = this.buildings.clear();
    const report = state.lastReport;
    const sorted = Object.values(state.buildings).sort(
      (a, b) => a.at.r - b.at.r || a.at.q - b.at.q,
    );
    for (const b of sorted) {
      const c = hexToPixel(b.at);
      (BUILDING_ART[b.type] ?? missingArt)(g, c);
      if (b.damage) drawCondition(g, c, 'damaged');
      else if (report?.blackouts.includes(b.uid)) drawCondition(g, c, 'dark');
    }
  }

  private ghost(building: string, c: Point, alpha = 0.75): void {
    const g = new Graphics();
    (BUILDING_ART[building] ?? missingArt)(g, c);
    g.alpha = alpha;
    this.labels.addChild(g);
  }

  private numbers(c: Point, lines: [string, number][]): void {
    const top = c.y - 22 - lines.length * 15;
    lines.forEach(([label, amount], i) => {
      const text = new Text({
        text: `${amount > 0 ? '+' : '−'}${Math.abs(amount)} ${label}`,
        style: {
          fontFamily: 'Nunito, system-ui, sans-serif',
          fontSize: 12,
          fontWeight: '700',
          fill: amount > 0 ? COLORS.good : COLORS.bad,
        },
        resolution: 3,
      });
      const pill = new Graphics()
        .roundRect(c.x - text.width / 2 - 5, top + i * 15 - 1, text.width + 10, 15, 7)
        .fill({ color: 0xfffbf0, alpha: 0.95 })
        .stroke({ width: 1, color: amount > 0 ? 0x9dbb79 : 0xd9a08c });
      text.position.set(c.x - text.width / 2, top + i * 15);
      this.labels.addChild(pill, text);
    });
  }

  private listen(canvas: HTMLCanvasElement): void {
    const local = (e: PointerEvent | WheelEvent): Point => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('pointerdown', (e) => {
      const p = local(e);
      this.pointer = { ...p, dragging: false, button: e.button };
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = local(e);
      if (this.pointer) {
        const dx = p.x - this.pointer.x;
        const dy = p.y - this.pointer.y;
        if (this.pointer.dragging || Math.hypot(dx, dy) > DRAG_THRESHOLD) {
          this.pointer.dragging = true;
          this.pan(dx, dy);
          this.pointer.x = p.x;
          this.pointer.y = p.y;
          canvas.style.cursor = 'grabbing';
          return;
        }
      }
      this.events.onHover(this.hexAt(p));
    });
    canvas.addEventListener('pointerup', (e) => {
      const pointer = this.pointer;
      this.pointer = null;
      canvas.style.cursor = '';
      if (!pointer || pointer.dragging) return;
      if (pointer.button === 2) {
        this.events.onCancel();
        return;
      }
      const hex = this.hexAt(local(e));
      if (hex && pointer.button === 0) this.events.onClick(hex);
    });
    canvas.addEventListener('pointerleave', () => this.events.onHover(null));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomBy(Math.exp(-e.deltaY * 0.0015), local(e));
      },
      { passive: false },
    );
  }
}

function missingArt(g: Graphics, c: Point): void {
  g.circle(c.x, c.y, 8).fill({ color: 0xff00ff });
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
