/**
 * The Pixi map. It only reads run state and reports pointer input; the game
 * store turns input into commands. Layers, back to front: fog, terrain (tiles
 * drawn row by row so each row's top covers the side of the row above),
 * river flow, buildings, then the overlay (hover, ghost, preview numbers).
 */
import type { Application } from 'pixi.js';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { PhaseName, Timeline } from '../game/timeline';
import type { Content } from '../sim/content/load';
import { hexKey, hexNeighbors, parseHexKey, type Hex } from '../sim/hex';
import { edgeEnds, edgeTiles } from '../sim/edges';
import type { PlacementPreview, PreviewKey } from '../sim/preview';
import type { RunState, WaterReport } from '../sim/types';
import { channels, waterOn } from '../sim/water';
import { SEASONS } from '../sim/content/schema';
import { drawDitches, drawWater, waterBeside, waterView, type WaterView } from './waterArt';
import type { WalkLine } from '../game/commuteInfo';
import type { HeatLine } from '../game/heatInfo';
import { BUILDING_ART, drawCondition } from './buildingArt';
import {
  HEX_RADIUS,
  boundsOf,
  fogHexes,
  hexCorners,
  hexToPixel,
  liftOf,
  pixelToHex,
  setHeights,
  type Bounds,
  type Point,
} from './layout';
import { COLORS } from './palette';
import { ResolutionPlayer } from './resolution';
import type { Mark } from '../game/marks';
import { drawLift, drawMarkBadges, drawMarkTiles, drawSnowCap } from './markArt';
import { ambientFor, drawAmbient, type Ambient } from './ambient';
import { drawBird, drawDeer, drawOtter, drawSeason, wildlifeFor, type Wildlife } from './seasonArt';
import { dashedLine, drawCliff, drawDryRiver, drawFogTile, drawTile } from './tileArt';
import {
  artScale,
  artSprite,
  armTexture,
  buildingTexture,
  artSeason,
  dryRiverTexture,
  edgeTexture,
  hasArms,
  hasGround,
  rotorSprite,
  rotorTexture,
  propTexture,
  tileTexture,
  wildlifeTexture,
  wonderSprite,
  wonderTexture,
} from './sprites';
import { wonderStage } from '../sim/wonder';
import {
  drawAnimal,
  festivalProps,
  poseAt,
  wildlifeActors,
  type Actor,
  type Prop,
} from './wildlifeArt';
import { animals as wildlifeOf } from '../sim/wildlife';
import { contentFor, effectiveContent } from '../sim/content/modifiers';

export interface MapViewEvents {
  /** The tile under the pointer, and which of its sides the pointer is nearest (for hedges). */
  onHover(hex: Hex | null, side?: number): void;
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
  private readonly shaker = new Container();
  private readonly world = new Container();
  private readonly ground = new Container();
  private readonly built = new Container();
  private cacheResolution = 0;
  private recacheTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly terrain = new Graphics();
  private readonly seasonLayer = new Graphics();
  private readonly flow = new Graphics();
  /** Channel ditches: earthworks, drawn with the ground. */
  private readonly ditches = new Graphics();
  /** Water in the ditches and the river's strength, drawn each frame. */
  private readonly water = new Graphics();
  private waterView: WaterView | null = null;
  /** Walks to work for the building in focus. */
  private readonly walks = new Graphics();
  private walkSignature = '';
  private readonly marksUnder = new Graphics();
  private readonly marksOver = new Graphics();
  private marks: Mark[] = [];
  private readonly underFx = new Container();
  /** Buildings, back to front: hand-made sprites or procedural drawings. */
  private readonly buildingLayer = new Container();
  /** Damage and blackout veils over the buildings. */
  private readonly buildings = new Graphics();
  /** Tiles, back to front, with the buildings drawn with their own tile in their place. */
  private readonly tileLayer = new Container();
  /** Wind spire blades and river wheels, turning (not cached). */
  private readonly rotors = new Container();
  private readonly spinning = new Map<Sprite, number>();
  private readonly wildlife = new Graphics();
  /** The valley's animals (E4) and a festival's props, as sprites. */
  private readonly animalLayer = new Container();
  private actors: { actor: Actor; sprite: Sprite }[] = [];
  /** Animals with no art yet (the coast's), drawn in code each frame. */
  private drawnActors: Actor[] = [];
  /** Wonders drawn with their art over their 7 tiles (for tests). */
  private wondersDrawn = 0;
  private props: Prop[] = [];
  private readonly overFx = new Container();
  private readonly overlay = new Graphics();
  /** The edge the hedge tool aims at. */
  private readonly edgeCursor = new Graphics();
  private readonly labels = new Container();
  private readonly screenFx = new Container();
  private bounds: Bounds | null = null;
  private mapSignature = '';
  private seasonSignature = '';
  private animals: Wildlife = { birds: false, deer: [], otters: [] };
  private ambient: Ambient | null = null;
  private clock = 0;
  private state: RunState | null = null;
  private zoom = 1;
  private pointer: { x: number; y: number; dragging: boolean; button: number } | null = null;
  private player: ResolutionPlayer | null = null;
  /** Follows prefers-reduced-motion: short fades, no drifting or shaking. */
  reducedMotion = false;

  constructor(
    private readonly app: Application,
    private readonly content: Content,
    private readonly events: MapViewEvents,
  ) {
    app.stage.addChild(this.shaker, this.screenFx);
    this.shaker.addChild(this.world);
    // The ground and the buildings change only with the run, so each is drawn once into
    // a texture (at the current zoom) instead of re-rasterizing every shape each frame.
    this.ground.addChild(this.terrain, this.tileLayer, this.ditches, this.seasonLayer, this.flow);
    this.built.addChild(this.buildingLayer, this.buildings);
    this.world.addChild(
      this.ground,
      this.water,
      this.marksUnder,
      this.underFx,
      this.built,
      this.rotors,
      this.walks,
      this.marksOver,
      this.wildlife,
      this.animalLayer,
      this.overFx,
      this.overlay,
      this.edgeCursor,
      this.labels,
    );
    this.listen(app.canvas);
    app.ticker.add(this.tick);
    this.applyCacheResolution();
  }

  private lastTick = performance.now();

  /** Wall-clock time, so a slow frame never stretches the season's 5 seconds. */
  private readonly tick = (): void => {
    const now = performance.now();
    const dt = now - this.lastTick;
    this.lastTick = now;
    this.clock += dt;
    this.player?.update(dt);
    if (!this.reducedMotion)
      for (const [rotor, speed] of this.spinning) rotor.rotation += (dt / 1000) * speed;
    // Clouds, smoke and the rest are always about: the wildlife layer redraws each frame.
    if (!this.reducedMotion) {
      this.drawWildlife();
      this.drawWaterNow();
    }
  };

  /**
   * Plays a season's resolution over the map. Any resolution still playing
   * is skipped first. `onDone` runs when it ends or is skipped.
   */
  playResolution(
    timeline: Timeline,
    hooks: { onPhase(phase: PhaseName): void; onDone(): void },
  ): void {
    this.stopResolution();
    const player: ResolutionPlayer = new ResolutionPlayer(
      timeline,
      { under: this.underFx, over: this.overFx, screen: this.screenFx, shake: this.shaker },
      this.bounds ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 },
      () => this.app.screen,
      {
        onPhase: hooks.onPhase,
        onDone: () => {
          if (this.player === player) this.endResolution();
          hooks.onDone();
        },
      },
      this.reducedMotion,
    );
    this.player = player;
    if (this.state) this.drawBuildings(this.state);
    this.drawMarks();
    // Setting up can take a while on a slow machine: the season's clock starts now, not at the
    // last frame, so the first frame doesn't skip ahead by the setup time.
    this.lastTick = performance.now();
  }

  /** Skips to the end of the resolution, if one is playing. */
  stopResolution(): void {
    this.player?.skip();
    this.endResolution();
  }

  setResolutionPaused(paused: boolean): void {
    this.player?.setPaused(paused);
  }

  get resolving(): boolean {
    return this.player !== null;
  }

  private endResolution(): void {
    if (!this.player) return;
    this.player.destroy();
    this.player = null;
    if (this.state) this.drawBuildings(this.state);
    this.drawMarks();
  }

  /** Redraws whatever changed in the run state. */
  setState(state: RunState): void {
    // Raised land (the Highland): everything drawn at a tile rises with it.
    setHeights(state.map);
    const signature = Object.values(state.map.tiles)
      .map((t) => t.type)
      .join(',');
    // Art changes with winter, buildings drawn with their own tile take a tile's place, and
    // channels are dug into the ground.
    const terrainSignature = [
      signature,
      state.season === 'winter',
      // A river that runs dry (the Sun Desert's summer) shows its bed.
      riverDry(this.content, state),
      ...Object.values(state.buildings)
        .filter((b) => this.content.byId[b.type]?.water?.channel)
        .map((b) => `~${hexKey(b.at)}`)
        .sort(),
      ...Object.values(state.buildings)
        .filter((b) => hasGround(b.type))
        .map((b) => `${b.type}@${hexKey(b.at)}`)
        .sort(),
      // A wonder carries its own ground over its 7 tiles, a stage at a time.
      ...Object.values(state.buildings)
        .filter((b) => b.footprint)
        .map((b) => `${b.type}:${wonderStage(this.content, state, b)}@${hexKey(b.at)}`)
        .sort(),
    ].join('|');
    if (terrainSignature !== this.mapSignature) {
      this.mapSignature = terrainSignature;
      this.drawTerrain(state);
      this.ground.updateCacheTexture();
      if (!this.bounds) {
        this.bounds = boundsOf([...Object.values(state.map.tiles), ...fogHexes(state.map)]);
        this.fit();
      }
    }
    this.state = state;
    this.drawBuildings(state);
    const seasonSignature = `${signature}|${state.turn}|${Object.keys(state.buildings).length}|${state.harmony}|${state.wildlife.join(',')}|${JSON.stringify(state.festivals)}`;
    if (seasonSignature !== this.seasonSignature) {
      this.seasonSignature = seasonSignature;
      // Hand-made tiles have their own seasons' look: the procedural blossom and snow skip them.
      drawSeason(
        this.seasonLayer,
        this.content,
        state,
        (key) =>
          tileTexture(state.map.tiles[key]!.type, key, state.season, this.content.land) !== null,
      );
      this.ground.updateCacheTexture();
      this.animals = wildlifeFor(this.content, state);
      // With wildlife on, the valley's own animals take the place of the stand-in deer and otters.
      if (wildlifeOf(effectiveContent(this.content, state)).length > 0)
        this.animals = { ...this.animals, deer: [], otters: [] };
      this.placeAnimals(state);
      this.ambient = ambientFor(this.content, state);
      this.drawWildlife();
    }
  }

  /**
   * Marks for the season: lasting effects and the coming event's reach.
   * Hidden while a season plays out, which shows its own effects.
   */
  setMarks(marks: Mark[]): void {
    if (marks === this.marks) return;
    this.marks = marks;
    this.drawMarks();
  }

  private drawMarks(): void {
    const under = this.marksUnder.clear();
    const over = this.marksOver.clear();
    if (this.player) return;
    drawMarkTiles(under, this.marks);
    drawMarkBadges(over, this.marks);
  }

  /**
   * The water to show: this season's forecast while planning, or the season
   * just resolved while it plays out. Null when the run has no water.
   */
  setWater(report: WaterReport | null): void {
    const view = this.state ? waterView(this.state, report) : null;
    this.waterView = view;
    this.drawWaterNow();
  }

  private drawWaterNow(): void {
    const g = this.water.clear();
    if (this.waterView) drawWater(g, this.waterView, this.clock, this.reducedMotion);
  }

  /**
   * Walks to work for the building in focus: a dotted path from each home to
   * the work, green within the free distance and brown beyond it, thicker for
   * more workers. In a Long Winter, also the heat to and from it: a solid
   * orange arc from each heat source to what it warms.
   */
  setWalks(lines: WalkLine[], heat: HeatLine[] = []): void {
    const signature =
      lines.map((l) => `${hexKey(l.from)}>${hexKey(l.to)}x${l.count}`).join('|') +
      '/' +
      heat.map((l) => `${hexKey(l.from)}>${hexKey(l.to)}x${l.amount}`).join('|');
    if (signature === this.walkSignature) return;
    this.walkSignature = signature;
    this.walksShown = lines.length;
    this.heatShown = heat.length;
    const g = this.walks.clear();
    for (const l of heat) {
      const a = hexToPixel(l.from);
      const b = hexToPixel(l.to);
      // Bowed the other way from the walks, so the two never sit on one another.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + 10 };
      const w = Math.min(l.amount, 4);
      g.moveTo(a.x, a.y)
        .quadraticCurveTo(mid.x, mid.y, b.x, b.y)
        .stroke({ width: 5 + w, color: 0xfffbf0, alpha: 0.85 });
      g.moveTo(a.x, a.y)
        .quadraticCurveTo(mid.x, mid.y, b.x, b.y)
        .stroke({ width: 2 + w, color: 0xd9733b, alpha: 1 });
      g.circle(b.x, b.y, 3.5).fill({ color: 0xd9733b }).stroke({ width: 1.5, color: 0xfffbf0 });
    }
    for (const l of lines) {
      const a = hexToPixel(l.from);
      const b = hexToPixel(l.to);
      const color = l.long ? 0x9a6a3c : 0x3f7a3a;
      // A gentle arc, so walks to the same work don't overlap.
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - Math.min(24, l.distance * 4) };
      const points: Point[] = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        points.push({
          x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x,
          y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y,
        });
      }
      // A pale edge under the dashes, so the walk reads over any ground.
      dashedLine(g, points, 5, 3, { width: 4.5 + l.count, color: 0xfffbf0, alpha: 0.85 });
      dashedLine(g, points, 5, 3, { width: 2.5 + l.count, color, alpha: 1 });
      g.circle(a.x, a.y, 4).fill({ color }).stroke({ width: 1.5, color: 0xfffbf0 });
      g.circle(b.x, b.y, 3).fill({ color: 0xfffbf0 }).stroke({ width: 1.5, color });
    }
  }

  /**
   * The hedge tool's aim: the edge, gold where a hedge can go, red where it can't, and pale
   * where one stands (a click clears it).
   */
  setEdgeCursor(edge: { key: string; planted: boolean; problem: string | null } | null): void {
    const g = this.edgeCursor.clear();
    if (!edge) return;
    const [a, b] = edgeLine(edge.key);
    const color = edge.planted ? 0xfffbf0 : edge.problem ? 0xc0392b : COLORS.leadingGold;
    g.moveTo(a.x, a.y)
      .lineTo(b.x, b.y)
      .stroke({ width: 7, color: 0x3a2a1a, alpha: 0.35, cap: 'round' });
    g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ width: 4, color, alpha: 0.95, cap: 'round' });
  }

  /** How many hedges the map draws (for tests). */
  hedgesShown = 0;

  /** How many walks the map shows (for tests). */
  walksShown = 0;
  /** How many heat arcs the map shows (for tests). */
  heatShown = 0;

  /** What the water layer shows (for tests): units carried along each channel. */
  get waterShown(): { channels: number[][]; river: number[] } | null {
    const v = this.waterView;
    return v ? { channels: v.channels.map((c) => c.units), river: v.river?.units ?? [] } : null;
  }

  /** The season the map is painted for, and which animals have returned (for tests). */
  get scenery(): {
    season: string;
    birds: boolean;
    deer: number;
    otters: number;
    /** The valley's own animals on screen (E4), by kind (with art or drawn in code), and a festival's props. */
    animals: Record<string, number>;
    props: Record<string, number>;
    wonders: number;
    butterflies: number;
    bees: number;
    smoke: number;
    fish: number;
    walkers: number;
    falling: string;
  } {
    const a = this.ambient;
    return {
      season: this.state?.season ?? '',
      birds: this.animals.birds,
      deer: this.animals.deer.length,
      otters: this.animals.otters.length,
      animals: count([...this.actors.map((a) => a.actor), ...this.drawnActors].map((a) => a.kind)),
      props: count(this.props.map((p) => p.kind)),
      wonders: this.wondersDrawn,
      butterflies: a?.butterflies.length ?? 0,
      bees: a?.bees.length ?? 0,
      smoke: a?.smoke.length ?? 0,
      fish: a?.fish.length ?? 0,
      walkers: a?.walkers.length ?? 0,
      falling: a?.falling ?? '',
    };
  }

  /** Sprites for the animals living in the valley and the festival's props. */
  private placeAnimals(state: RunState): void {
    for (const child of this.animalLayer.removeChildren()) child.destroy();
    const k = artScale() * SHOW_SCALE;
    // The run's own rules: wildlife comes with the water system, a run option.
    const rules = effectiveContent(this.content, state);
    this.props = festivalProps(rules, state);
    for (const p of this.props) {
      const tex = propTexture(
        p.kind === 'lantern' ? (p.lit ? 'lantern.lit' : 'lantern') : 'bunting',
      );
      if (!tex) continue;
      const s = new Sprite(tex);
      s.position.set(p.at.x, p.at.y);
      if (p.kind === 'bunting' && p.to) {
        // The string runs from its left peg (8, 22) to its right (120, 22), in the 128 px frame.
        s.anchor.set(8 / 128, 22 / 128);
        const span = (112 / 128) * tex.width;
        s.scale.set(Math.hypot(p.to.x - p.at.x, p.to.y - p.at.y) / span, k);
        s.rotation = Math.atan2(p.to.y - p.at.y, p.to.x - p.at.x);
      } else {
        s.anchor.set(0.5, 8 / 128);
        s.scale.set(k);
      }
      this.animalLayer.addChild(s);
    }
    this.actors = [];
    this.drawnActors = [];
    for (const actor of wildlifeActors(rules, state)) {
      const tex = wildlifeTexture(poseAt(actor, 0, true).frame, state.season);
      if (!tex) {
        this.drawnActors.push(actor);
        continue;
      }
      const sprite = new Sprite(tex);
      // Bottom centre (64, 120), where it meets the ground or water; the bees at their centre.
      sprite.anchor.set(0.5, actor.kind === 'wildBees' ? 0.5 : 120 / 128);
      this.animalLayer.addChild(sprite);
      this.actors.push({ actor, sprite });
    }
    this.moveAnimals();
  }

  private moveAnimals(): void {
    const season = this.state?.season ?? 'spring';
    const k = artScale() * SHOW_SCALE;
    for (const { actor, sprite } of this.actors) {
      const pose = poseAt(actor, this.clock, this.reducedMotion);
      const tex = wildlifeTexture(pose.frame, season);
      if (tex && sprite.texture !== tex) sprite.texture = tex;
      sprite.position.set(pose.x, pose.y);
      sprite.scale.set(pose.flip ? -k : k, k);
    }
  }

  private drawWildlife(): void {
    this.moveAnimals();
    const g = this.wildlife.clear();
    const { birds, deer, otters } = this.animals;
    const still = this.reducedMotion;
    if (this.ambient && this.bounds) drawAmbient(g, this.ambient, this.bounds, this.clock, still);
    for (const d of deer) drawDeer(g, d);
    for (const actor of this.drawnActors)
      drawAnimal(g, actor.kind, poseAt(actor, this.clock, still), this.state?.season);
    otters.forEach((o, i) => drawOtter(g, o, still ? 0 : Math.sin(this.clock / 400 + i) * 1.2));
    if (birds && this.bounds) {
      const { minX, maxX, minY } = this.bounds;
      const span = maxX - minX + 200;
      const lead = still ? span * 0.4 : ((this.clock / 40) % span) - 100;
      for (let i = 0; i < 4; i++) {
        const p = { x: maxX - lead + i * 16, y: minY + 70 + (i % 2) * 9 + i * 3 };
        drawBird(g, p, still ? 0.5 : (Math.sin(this.clock / 120 + i) + 1) / 2);
      }
    }
  }

  /** Hover outline, and in placement mode the ghost building and its preview numbers. */
  setOverlay(
    hover: Hex | null,
    placement: Placement | null,
    cursor: 'hover' | 'compost' = 'hover',
    vines: Hex[][] = [],
    sites: { at: Hex; risky: boolean }[] = [],
    terrain: Hex[] = [],
    selected: Hex | null = null,
  ): void {
    const g = this.overlay.clear();
    for (const child of this.labels.removeChildren()) child.destroy();
    // A highlighted terrain: every other tile dimmed, its own tiles outlined.
    if (terrain.length > 0 && this.state) {
      const lit = new Set(terrain.map(hexKey));
      for (const t of Object.values(this.state.map.tiles)) {
        if (lit.has(hexKey(t))) continue;
        g.poly(hexCorners(hexToPixel(t), HEX_RADIUS)).fill({ color: 0x1e2a22, alpha: 0.45 });
      }
      for (const h of terrain)
        g.poly(hexCorners(hexToPixel(h), HEX_RADIUS - 2.5)).stroke({
          width: 2.5,
          color: 0xfff3cf,
          alpha: 0.95,
        });
    }
    // Every tile the building (or compost) could go on, while placing.
    for (const s of sites) {
      const c = hexToPixel(s.at);
      g.poly(hexCorners(c, HEX_RADIUS - 4))
        .fill({ color: s.risky ? 0x7fb7c8 : 0xfff3cf, alpha: 0.3 })
        .stroke({ width: 1.5, color: s.risky ? 0x548899 : COLORS.leadingGold, alpha: 0.75 });
    }
    // Vines grow between the tiles of each combo the placement would form.
    for (const group of vines) drawVine(g, group.map(hexToPixel));
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
        // A wonder takes the 6 tiles around as well.
        for (const t of this.footprintOf(building, placement.at)) {
          const tc = hexToPixel(t);
          g.poly(hexCorners(tc, HEX_RADIUS - 1)).fill({ color: 0xfff3cf, alpha: 0.55 });
          const outline = hexCorners(tc, HEX_RADIUS - 1.5);
          const pts: Point[] = [];
          for (let i = 0; i <= 6; i++)
            pts.push({ x: outline[(i % 6) * 2]!, y: outline[(i % 6) * 2 + 1]! });
          dashedLine(g, pts, 5, 4, { width: 2.5, color: COLORS.leadingGold });
        }
        this.ghost(building, c);
        for (const entry of affected.values()) this.numbers(hexToPixel(entry.at), entry.lines);
      } else {
        for (const t of this.footprintOf(building, placement.at))
          g.poly(hexCorners(hexToPixel(t), HEX_RADIUS - 1.5))
            .fill({ color: COLORS.bad, alpha: 0.18 })
            .stroke({ width: 2.5, color: COLORS.bad });
        this.ghost(building, c, 0.35);
      }
      return;
    }
    // The building selected (in its details or the priority list): a bold gold ring.
    if (selected) {
      g.poly(hexCorners(hexToPixel(selected), HEX_RADIUS - 1)).stroke({
        width: 4,
        color: COLORS.leadingGold,
      });
      g.poly(hexCorners(hexToPixel(selected), HEX_RADIUS - 4.5)).stroke({
        width: 1.5,
        color: 0xfff3cf,
      });
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
    this.scheduleRecache();
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
    this.scheduleRecache();
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
    for (const child of this.tileLayer.removeChildren()) child.destroy();
    const grounded = new Map(
      Object.values(state.buildings)
        .filter((b) => hasGround(b.type))
        .map((b) => [hexKey(b.at), b.type]),
    );
    // Row by row, so each row covers the side band of the row behind it.
    const tiles = Object.entries(state.map.tiles).sort(([, a], [, b]) => a.r - b.r || a.q - b.q);
    // A wonder with its art takes its 7 tiles' place: drawn as the last of them comes up.
    const wonderAt = new Map<string, Sprite | null>();
    for (const b of Object.values(state.buildings)) {
      if (!b.footprint) continue;
      const texture = wonderTexture(b.type, wonderStage(this.content, state, b), state.season);
      if (!texture) continue;
      const covered = [b.at, ...hexNeighbors(b.at)].map(hexKey);
      const last = tiles
        .map(([k]) => k)
        .filter((k) => covered.includes(k))
        .at(-1);
      for (const k of covered) wonderAt.set(k, null);
      if (last) wonderAt.set(last, wonderSprite(texture, hexToPixel(b.at)));
    }
    this.wondersDrawn = [...wonderAt.values()].filter((x) => x !== null).length;
    // Channels drawn by hand: a hub on each channel tile, an arm towards each tile of channel next
    // to it, and at an end an arm into the water beside it (its intake, or where it rejoins).
    const ditch = this.content.rules.water.channelBuilding;
    const channelArt = hasArms(ditch);
    // Each channel tile and its kind: a qanat has its own hub and arms (shaft mounds), and links
    // with the open channel beside it.
    const channelAt = new Map(
      Object.values(state.buildings)
        .filter((b) => this.content.byId[b.type]?.water?.channel)
        .map((b) => [hexKey(b.at), hasArms(b.type) ? b.type : ditch]),
    );
    let procedural: Graphics | null = null;
    const dry = riverDry(this.content, state);
    for (const [key, tile] of tiles) {
      const c = hexToPixel(tile);
      if (wonderAt.has(key)) {
        // Its tiles stand beneath it at their own heights, so on a slope (the Cloud Terraces)
        // its lower edge sits on land; on level ground the art covers them.
        const lift = liftOf(tile);
        if (lift > 0) {
          if (!procedural) this.tileLayer.addChild((procedural = new Graphics()));
          drawCliff(procedural, c, lift);
        }
        const under = tileTexture(tile.type, key, state.season, this.content.land);
        if (under) {
          this.tileLayer.addChild(artSprite(under, c));
          procedural = null;
        } else {
          if (!procedural) this.tileLayer.addChild((procedural = new Graphics()));
          drawTile(procedural, tile, c, key);
        }
        const sprite = wonderAt.get(key);
        if (sprite) {
          this.tileLayer.addChild(sprite);
          procedural = null;
        }
        continue;
      }
      // A raised tile stands on its cliff, drawn first so the tile covers its top.
      const lift = liftOf(tile);
      if (lift > 0) {
        if (!procedural) this.tileLayer.addChild((procedural = new Graphics()));
        drawCliff(procedural, c, lift);
      }
      const own = grounded.get(key);
      // A river that runs dry this season (the Sun Desert's summer) shows its empty bed.
      if (!own && tile.type === 'river' && dry) {
        const bed = dryRiverTexture(this.content.land);
        if (bed) {
          this.tileLayer.addChild(artSprite(bed, c));
          procedural = null;
        } else {
          if (!procedural) this.tileLayer.addChild((procedural = new Graphics()));
          drawDryRiver(procedural, c, key);
        }
        continue;
      }
      const texture = own
        ? buildingTexture(own, state.season, this.content.land)
        : tileTexture(tile.type, key, state.season, this.content.land);
      if (texture) {
        this.tileLayer.addChild(artSprite(texture, c));
        procedural = null;
      } else {
        if (!procedural) this.tileLayer.addChild((procedural = new Graphics()));
        drawTile(procedural, tile, c, key);
      }
      if (channelArt && channelAt.has(key)) {
        const links = hexNeighbors(tile).map((n) => channelAt.has(hexKey(n)));
        const arms = links.map((linked, i) => (linked ? i : -1)).filter((i) => i >= 0);
        if (arms.length <= 1) {
          const water = waterBeside(state, tile);
          if (water) {
            const i = hexNeighbors(tile).findIndex((n) => hexKey(n) === hexKey(water));
            if (i >= 0) arms.push(i);
          }
        }
        const kind = channelAt.get(key)!;
        for (const i of arms) {
          const arm = armTexture(kind, i, artSeason(kind, state.season, this.content.land));
          if (arm) this.tileLayer.addChild(artSprite(arm, c));
        }
        const hub = buildingTexture(kind, state.season, this.content.land);
        if (hub) this.tileLayer.addChild(artSprite(hub, c));
        procedural = null;
      }
    }
    const ditches = this.ditches.clear();
    if (!channelArt) drawDitches(ditches, this.content, state);
    // A sluice gate where each channel leaves the river, at the edge of its first tile.
    const gate = buildingTexture('sluiceGate', state.season, this.content.land);
    if (gate && channelArt) {
      for (const ch of channels(this.content, state)) {
        if (!ch.intake || !('river' in ch.intake)) continue;
        const first = state.buildings[ch.uids[0]!];
        const water = first && waterBeside(state, first.at, ch.intake.river);
        if (!first || !water) continue;
        const a = hexToPixel(first.at);
        const b = hexToPixel(water);
        this.tileLayer.addChild(artSprite(gate, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }));
      }
    }

    // The river's flow line runs through tile centres and on into the fog.
    const f = this.flow.clear();
    const centres = state.map.river.map((k) => hexToPixel(state.map.tiles[k]!));
    if (centres.length >= 2 && !dry) {
      const extend = (a: Point, b: Point): Point => ({
        x: b.x + (b.x - a.x),
        y: b.y + (b.y - a.y),
      });
      const path = [
        extend(centres[1]!, centres[0]!),
        ...centres,
        extend(centres.at(-2)!, centres.at(-1)!),
      ];
      // Over painted water the current is a lighter touch.
      const painted = tileTexture('river', state.map.river[0]!, state.season) !== null;
      dashedLine(f, path, 10, 9, {
        width: painted ? 2 : 3,
        color: 0xcfe7ee,
        alpha: painted ? 0.45 : 1,
      });
    }
  }

  /** Redraws the cached layers sharply for the new zoom, once zooming settles. */
  private scheduleRecache(): void {
    if (this.recacheTimer) clearTimeout(this.recacheTimer);
    this.recacheTimer = setTimeout(() => {
      this.recacheTimer = null;
      this.applyCacheResolution();
    }, 150);
  }

  private applyCacheResolution(): void {
    const resolution = clamp(this.zoom * this.app.renderer.resolution, 1, 4);
    if (Math.abs(resolution - this.cacheResolution) < 0.01) return;
    this.cacheResolution = resolution;
    for (const layer of [this.ground, this.built]) {
      layer.cacheAsTexture(false);
      layer.cacheAsTexture({ resolution, antialias: true });
    }
  }

  private drawnBuildings: { state: RunState; resolving: boolean } | null = null;

  private drawBuildings(state: RunState): void {
    // Hovering re-sends the same state: only redraw (and re-cache) when something changed.
    const resolving = this.player !== null;
    if (this.drawnBuildings?.state === state && this.drawnBuildings.resolving === resolving) return;
    this.drawnBuildings = { state, resolving };
    const g = this.buildings.clear();
    const report = state.lastReport;
    for (const child of this.buildingLayer.removeChildren()) child.destroy();
    for (const child of this.rotors.removeChildren()) child.destroy();
    this.spinning.clear();
    const sorted = Object.values(state.buildings).sort(
      (a, b) => a.at.r - b.at.r || a.at.q - b.at.q,
    );
    const occupant = new Map(sorted.map((b) => [hexKey(b.at), b.uid]));
    // Hedges along tile edges: each drawn by the tile that owns its side (its east, north-east or
    // north-west), just before that tile's building, so it stands behind it.
    const hedgeDef = Object.values(this.content.byId).find((d) => d.edge);
    const hedges = state.hedges
      .map((key) => {
        const [a, b] = edgeTiles(key);
        const i = hexNeighbors(a).findIndex((n) => hexKey(n) === hexKey(b));
        return i < 3 ? { key, owner: a, side: i } : { key, owner: b, side: i - 3 };
      })
      .sort((x, y) => x.owner.r - y.owner.r || x.owner.q - y.owner.q);
    this.hedgesShown = hedges.length;
    let nextHedge = 0;
    const drawHedgesUpTo = (at: Hex | null) => {
      while (nextHedge < hedges.length) {
        const h = hedges[nextHedge]!;
        if (at && (h.owner.r > at.r || (h.owner.r === at.r && h.owner.q > at.q))) return;
        nextHedge++;
        const texture = hedgeDef
          ? edgeTexture(
              hedgeDef.id,
              h.side,
              artSeason(hedgeDef.id, state.season, this.content.land),
            )
          : null;
        if (texture) {
          this.buildingLayer.addChild(artSprite(texture, hexToPixel(h.owner)));
          procedural = null;
        } else {
          if (!procedural) this.buildingLayer.addChild((procedural = new Graphics()));
          const [p, q] = edgeLine(h.key);
          procedural
            .moveTo(p.x, p.y)
            .lineTo(q.x, q.y)
            .stroke({ width: 6, color: COLORS.treeLight, cap: 'round' });
        }
      }
    };
    let procedural: Graphics | null = null;
    for (const b of sorted) {
      drawHedgesUpTo(b.at);
      const c = hexToPixel(b.at);
      // Channels are ditches in the ground (drawn with the terrain); a canal-top solar's
      // panels stand over its ditch.
      const ditchLike =
        this.content.byId[b.type]?.water?.channel &&
        hasArms(this.content.rules.water.channelBuilding) &&
        hasArms(b.type);
      if (b.type === this.content.rules.water.channelBuilding || ditchLike) {
        if (b.damage) drawCondition(g, c, 'damaged');
        continue;
      }
      // A hedgerow reaches out to the hedgerows beside it.
      if (hasArms(b.type)) {
        hexNeighbors(b.at).forEach((n, i) => {
          if (state.buildings[occupant.get(hexKey(n)) ?? '']?.type !== b.type) return;
          const arm = armTexture(b.type, i, artSeason(b.type, state.season, this.content.land));
          if (arm) this.buildingLayer.addChild(artSprite(arm, c));
        });
        procedural = null;
      }
      // A wonder with its art is part of the terrain.
      if (b.footprint && wonderTexture(b.type, null, state.season)) continue;
      const texture = buildingTexture(b.type, state.season, this.content.land);
      // Buildings drawn with their own tile are part of the terrain.
      if (texture && !hasGround(b.type)) {
        this.buildingLayer.addChild(artSprite(texture, c));
        procedural = null;
      } else if (!texture) {
        if (!procedural) this.buildingLayer.addChild((procedural = new Graphics()));
        (BUILDING_ART[b.type] ?? missingArt)(procedural, c);
      }
      const rotor = rotorTexture(b.type, state.season);
      const sprite = rotor ? rotorSprite(b.type, rotor, c) : null;
      if (sprite) {
        // Blades turn quickly, a river wheel slowly; a damaged one stands still.
        sprite.rotation = (b.at.q * 1.7 + b.at.r) % (Math.PI * 2);
        this.rotors.addChild(sprite);
        const wind = b.type === 'windSpire' || b.type === 'singingSpire';
        if (!b.damage) this.spinning.set(sprite, wind ? 1.6 : 0.6);
      }
      if (b.damage) drawCondition(g, c, 'damaged');
      // While the season resolves, blackouts show when night falls.
      else if (report?.blackouts.includes(b.uid) && !this.player) drawCondition(g, c, 'dark');
      // The Highland: a pump station that lifted water last season shows it going up its step;
      // panels high up are snowed under in the seasons they make nothing.
      const lifted = report?.water?.lifted?.[b.uid] ?? 0;
      if (lifted > 0) drawLift(g, c, lifted);
      const snow = this.content.byId[b.type]?.idleAtHeight;
      if (
        snow &&
        snow.seasons.includes(state.season) &&
        (state.map.tiles[hexKey(b.at)]?.height ?? 0) >= snow.from
      )
        drawSnowCap(g, c);
    }
    drawHedgesUpTo(null);
    this.built.updateCacheTexture();
  }

  /** The tiles a building would take at `at`: its own, and a wonder's 6 around it. */
  private footprintOf(building: string, at: Hex): Hex[] {
    return this.content.byId[building]?.wonder ? [at, ...hexNeighbors(at)] : [at];
  }

  private ghost(building: string, c: Point, alpha = 0.75): void {
    const finished = this.content.byId[building]?.wonder
      ? wonderTexture(building, null, this.state?.season ?? 'spring')
      : null;
    if (finished) {
      const sprite = wonderSprite(finished, c);
      sprite.alpha = alpha;
      this.labels.addChild(sprite);
      return;
    }
    const texture = buildingTexture(building, this.state?.season ?? 'spring', this.content.land);
    if (texture) {
      const sprite = artSprite(texture, c);
      sprite.alpha = alpha;
      this.labels.addChild(sprite);
      const rotor = rotorTexture(building, this.state?.season ?? 'spring');
      const blades = rotor ? rotorSprite(building, rotor, c) : null;
      if (blades) {
        blades.alpha = alpha;
        this.labels.addChild(blades);
      }
      return;
    }
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
          fontFamily: '"Sunroot Numbers", "Nunito Variable", system-ui, sans-serif',
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
      const h = this.hexAt(p);
      this.events.onHover(h, h ? nearestSide(h, this.toWorld(p)) : undefined);
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

/** A leafy line through the given points. */
export function drawVine(g: Graphics, pts: Point[]): void {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const mid = {
      x: (a.x + b.x) / 2 + (b.y - a.y) * 0.18,
      y: (a.y + b.y) / 2 - (b.x - a.x) * 0.18,
    };
    g.moveTo(a.x, a.y)
      .quadraticCurveTo(mid.x, mid.y, b.x, b.y)
      .stroke({ width: 3, color: COLORS.good, alpha: 0.85, cap: 'round' });
    for (const t of [0.3, 0.7]) {
      const x = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * mid.x + t * t * b.x;
      const y = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * mid.y + t * t * b.y;
      g.ellipse(x + 3, y - 2, 4, 2.2).fill({ color: COLORS.treeLight });
    }
  }
  for (const p of pts) g.circle(p.x, p.y, 3).fill({ color: COLORS.good });
}

function missingArt(g: Graphics, c: Point): void {
  g.circle(c.x, c.y, 8).fill({ color: 0xff00ff });
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** A corner of the map: the middle of the three tiles that meet there. */
function cornerPoint(corner: string): Point {
  const pts = corner.split('/').map((k) => hexToPixel(parseHexKey(k)));
  return {
    x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
    y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
  };
}

/** An edge between two tiles, as its two corners. */
function edgeLine(key: string): [Point, Point] {
  const [a, b] = edgeEnds(key);
  return [cornerPoint(a), cornerPoint(b)];
}

/** Which side of a tile (HEX_DIRECTIONS order) a point is nearest. */
function nearestSide(h: Hex, p: Point): number {
  const c = hexToPixel(h);
  let best = 0;
  let bestD = Infinity;
  hexNeighbors(h).forEach((n, i) => {
    const m = hexToPixel(n);
    const d = Math.hypot((c.x + m.x) / 2 - p.x, (c.y + m.y) / 2 - p.y);
    if (d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * Animals and festival props are drawn half as big again as the tile scale
 * they were made at, so they can be seen at the usual zoom (a deer at tile
 * scale is a quarter of a tile long).
 */
const SHOW_SCALE = 1.5;

function count(kinds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const k of kinds) out[k] = (out[k] ?? 0) + 1;
  return out;
}

/** Whether the river runs dry this season (no flow: the Sun Desert's summer). */
export function riverDry(content: Content, state: RunState): boolean {
  // The run's own rules: water is a run option (the content's is off until a run turns it on).
  const rules = contentFor(content, state);
  return waterOn(rules) && rules.rules.water.riverFlow[SEASONS.indexOf(state.season)] === 0;
}
