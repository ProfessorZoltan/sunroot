/**
 * Plays a season's resolution timeline (src/game/timeline.ts) on the map: the
 * event, the sun crossing from east to west with the shadows it casts, energy
 * flowing as light into buildings, night with lit windows, and number pops.
 * It reads the timeline only; skipping jumps straight to the end.
 */
import { Container, Graphics, Text } from 'pixi.js';
import type { PhaseName, Pop, Timeline } from '../game/timeline';
import { parseHexKey } from '../sim/hex';
import { drawCondition } from './buildingArt';
import { HEX_RADIUS, hexCorners, hexToPixel, type Bounds, type Point } from './layout';
import { COLORS } from './palette';
import { artSprite, windowsTexture } from './sprites';

export interface ResolutionLayers {
  /** World space, over the terrain and under the buildings (water, shadows). */
  under: Container;
  /** World space, over the buildings (night, light, pops). */
  over: Container;
  /** Screen space (the sun and moon). */
  screen: Container;
  /** Shaken during storms. */
  shake: Container;
}

export interface ResolutionHooks {
  onPhase(phase: PhaseName): void;
  onDone(): void;
}

const POP_LIFE = 1300;

export class ResolutionPlayer {
  private t = 0;
  private phase: PhaseName | null = null;
  private paused = false;
  private done = false;
  private readonly water = new Graphics();
  /** The event on the ground (dry earth, ice, sandbars), under the buildings. */
  private readonly eventGround = new Graphics();
  /** The event on buildings (shields, lightning, frost), over them. */
  private readonly eventMarks = new Graphics();
  /** Rain, wind and snow over everything. */
  private readonly weather = new Graphics();
  private readonly shadows = new Graphics();
  private readonly sky = new Graphics();
  private readonly night = new Graphics();
  private readonly light = new Graphics();
  private readonly particles = new Graphics();
  private readonly glow = new Graphics();
  /** Hand-made homes' lit windows, over the night. */
  private readonly windows = new Container();
  private readonly pops = new Container();
  private readonly sun = new Graphics();
  private readonly shown = new Map<Pop, Container>();
  private readonly shakeOrigin: Point;

  constructor(
    private readonly timeline: Timeline,
    private readonly layers: ResolutionLayers,
    private readonly bounds: Bounds,
    private readonly screen: () => { width: number; height: number },
    private readonly hooks: ResolutionHooks,
    private readonly reducedMotion = false,
  ) {
    layers.under.addChild(this.water, this.eventGround, this.shadows);
    layers.over.addChild(
      this.sky,
      this.eventMarks,
      this.weather,
      this.night,
      this.windows,
      this.light,
      this.glow,
      this.particles,
      this.pops,
    );
    this.night.blendMode = 'multiply';
    layers.screen.addChild(this.sun);
    this.shakeOrigin = { x: layers.shake.position.x, y: layers.shake.position.y };
    this.render();
  }

  get elapsed(): number {
    return this.t;
  }

  get isPaused(): boolean {
    return this.paused;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  /** Advances by `dt` milliseconds (nothing while paused). */
  update(dt: number): void {
    if (this.done || this.paused) return;
    this.t = Math.min(this.timeline.duration, this.t + dt);
    this.render();
    if (this.t >= this.timeline.duration) this.finish();
  }

  /** Jumps to the end: the map shows the season's outcome. */
  skip(): void {
    if (this.done) return;
    this.t = this.timeline.duration;
    this.finish();
  }

  destroy(): void {
    this.done = true;
    this.layers.shake.position.set(this.shakeOrigin.x, this.shakeOrigin.y);
    for (const g of [
      this.water,
      this.eventGround,
      this.eventMarks,
      this.weather,
      this.shadows,
      this.sky,
      this.night,
      this.windows,
      this.light,
      this.glow,
      this.particles,
    ])
      g.destroy();
    this.pops.destroy({ children: true });
    this.windows.destroy({ children: true });
    this.sun.destroy();
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.hooks.onDone();
  }

  private progress(name: PhaseName): number {
    const p = this.timeline.phases.find((x) => x.name === name)!;
    return clamp01((this.t - p.start) / Math.max(1, p.end - p.start));
  }

  private render(): void {
    const tl = this.timeline;
    const current = tl.phases.find((p) => this.t < p.end)?.name ?? 'settle';
    if (current !== this.phase) {
      // A slow frame can jump over a phase: announce every phase passed, in order,
      // so the year strip still fills the day slot and then the night slot.
      const names = tl.phases.map((p) => p.name);
      const from = this.phase === null ? 0 : names.indexOf(this.phase) + 1;
      for (const name of names.slice(from, names.indexOf(current) + 1)) this.hooks.onPhase(name);
      this.phase = current;
    }
    const dawn = this.progress('day');
    const dusk = this.progress('night');
    const settle = this.progress('settle');
    const isDay = this.t >= phaseStart(tl, 'day') && this.t < phaseStart(tl, 'night');

    this.drawWater();
    this.drawEvent();
    this.drawWeather();
    this.drawShadows(isDay ? dawn : null);
    this.drawSky(current, dawn);
    this.drawNight(dusk, settle);
    this.drawGlow();
    this.drawParticles();
    this.drawPops();
    this.drawSun(current, dawn, dusk);
    this.drawShake();
  }

  /** The flood spreads tile by tile, then drains through the day. */
  private drawWater(): void {
    const g = this.water.clear();
    const drain = this.progress('day');
    for (const f of this.timeline.flood) {
      if (this.t < f.t) continue;
      const rise = clamp01((this.t - f.t) / 250);
      const alpha = 0.6 * rise * (1 - drain * 0.85);
      if (alpha <= 0.01) continue;
      const c = hexToPixel(parseHexKey(f.key));
      g.poly(hexCorners(c, HEX_RADIUS - 1)).fill({ color: 0x7fb7c8, alpha });
      g.moveTo(c.x - 14, c.y + 4)
        .quadraticCurveTo(c.x - 7, c.y, c.x, c.y + 4)
        .quadraticCurveTo(c.x + 7, c.y + 8, c.x + 14, c.y + 4)
        .stroke({ width: 1.5, color: 0xe4f2f5, alpha });
    }
  }

  /**
   * How strongly the event shows: fully through the event phase, fading out
   * over the first half of the day (the map's marks then say what lasts).
   */
  private eventStrength(): number {
    const day = this.progress('day');
    return clamp01(1 - day / 0.5);
  }

  /**
   * What the event did, tile by tile, each from the moment it reaches it: a
   * levee's shield, flood damage, silt settling, farms drying, the river wheel
   * slowing, lightning, wind on exposed buildings, the Mixed Grid's dome and
   * frost on homes that need heat.
   */
  private drawEvent(): void {
    const ground = this.eventGround.clear();
    const g = this.eventMarks.clear();
    const strength = this.eventStrength();
    if (strength <= 0) return;
    const tl = this.timeline;
    const evP = this.progress('event');

    // The river itself: sandbars when it runs low, ice when it freezes.
    if (tl.event === 'lowRiver' || tl.event === 'freeze') {
      tl.river.forEach((h, i) => {
        const c = hexToPixel(h);
        const reach = clamp01(evP * 1.6 - (i / Math.max(1, tl.river.length)) * 0.6);
        if (reach <= 0) return;
        const a = reach * strength;
        if (tl.event === 'lowRiver') {
          ground.poly(hexCorners(c, HEX_RADIUS - 6)).fill({ color: 0xd9c08f, alpha: 0.45 * a });
          ellipse(ground, c.x - 6, c.y + 3, 11, 4, -0.3);
          ground.fill({ color: 0xe8d3a3, alpha: 0.9 * a });
          ellipse(ground, c.x + 8, c.y - 6, 7, 3, 0.4);
          ground.fill({ color: 0xe8d3a3, alpha: 0.8 * a });
        } else {
          ground.poly(hexCorners(c, HEX_RADIUS - 2)).fill({ color: 0xeaf4fa, alpha: 0.55 * a });
          ground
            .moveTo(c.x - 12, c.y - 4)
            .lineTo(c.x - 2, c.y + 2)
            .lineTo(c.x + 10, c.y - 3)
            .moveTo(c.x - 2, c.y + 2)
            .lineTo(c.x + 1, c.y + 11)
            .stroke({ width: 1.2, color: 0x9cc3d8, alpha: 0.8 * a });
        }
      });
    }

    for (const fx of tl.eventFx) {
      const age = this.t - fx.t;
      if (age < 0) continue;
      const rise = this.reducedMotion ? 1 : clamp01(age / 300);
      const a = rise * strength;
      const c = hexToPixel(fx.at);
      const corners = hexCorners(c, HEX_RADIUS - 3);
      const pulse = this.reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(age / 90);
      switch (fx.kind) {
        case 'sheltered':
          shield(g, c, 0x3f7a3a, a);
          g.poly(corners).stroke({ width: 2.5, color: 0x3f7a3a, alpha: 0.8 * a * pulse });
          break;
        case 'flooded':
          g.poly(corners).stroke({ width: 3, color: 0xa3401f, alpha: 0.85 * a * pulse });
          droplets(g, c, age, this.reducedMotion, a);
          break;
        case 'silted': {
          // Gold motes settle onto the farm.
          ground.poly(corners).fill({ color: 0xc9a25c, alpha: 0.35 * a });
          for (let k = 0; k < 6; k++) {
            const fall = this.reducedMotion ? 1 : clamp01((age - k * 60) / 500);
            const x = c.x + (hash(k, fx.at.q, fx.at.r) - 0.5) * 30;
            const y = c.y - 18 + fall * (14 + hash(k + 7, fx.at.q, fx.at.r) * 10);
            g.circle(x, y, 1.8).fill({ color: 0xe0a33b, alpha: a * (fall > 0 ? 1 : 0) });
          }
          break;
        }
        case 'dried': {
          ground.poly(corners).fill({ color: 0xd9b98a, alpha: 0.45 * a });
          const grow = this.reducedMotion ? 1 : clamp01(age / 500);
          cracks(ground, c, grow, a);
          break;
        }
        case 'slowed': {
          // The wheel's turn slows to a stop: a fading arc.
          const turn = this.reducedMotion
            ? 0
            : Math.min(age, 900) / 120 - (Math.min(age, 900) / 900) ** 2 * 3;
          for (let k = 0; k < 3; k++) {
            const s = turn + (k * Math.PI * 2) / 3;
            g.arc(c.x, c.y - 2, 15, s, s + 0.8).stroke({
              width: 2.5,
              color: 0x6c8a96,
              alpha: 0.7 * a,
              cap: 'round',
            });
          }
          break;
        }
        case 'struck': {
          // Two strokes of lightning, a moment apart.
          const flash = this.reducedMotion
            ? 0
            : Math.max(clamp01(1 - age / 160), clamp01(1 - Math.abs(age - 260) / 120));
          if (flash > 0) {
            g.circle(c.x, c.y, 34).fill({ color: 0xfff7d6, alpha: 0.55 * flash });
            bolt(g, c, flash);
          }
          g.poly(corners).stroke({ width: 3, color: 0xa3401f, alpha: 0.85 * a * pulse });
          break;
        }
        case 'exposed':
          // Wind tugs at buildings on the hills.
          gusts(g, c, this.reducedMotion ? 0 : age, a);
          g.poly(corners).stroke({ width: 2, color: 0x5b6770, alpha: 0.7 * a });
          break;
        case 'calm':
          // The Mixed Grid's dome holds the storm off.
          g.arc(c.x, c.y + 6, 24 + 2 * pulse, Math.PI, 0)
            .stroke({ width: 2.5, color: 0x3f7a3a, alpha: 0.8 * a })
            .arc(c.x, c.y + 6, 24, Math.PI, 0)
            .fill({ color: 0x9dbb79, alpha: 0.14 * a });
          break;
        case 'chilled': {
          const grow = this.reducedMotion ? 1 : clamp01(age / 450);
          ground.poly(corners).fill({ color: 0xdcebf5, alpha: 0.4 * a * grow });
          frost(g, c, grow, a);
          break;
        }
      }
    }
  }

  /** Rain and wind for storms and floods, snow for the freeze; still when motion is reduced. */
  private drawWeather(): void {
    const g = this.weather.clear();
    const strength = this.eventStrength();
    const event = this.timeline.event;
    if (strength <= 0 || this.reducedMotion) return;
    if (event !== 'storm' && event !== 'flood' && event !== 'freeze') return;
    const b = this.bounds;
    const w = b.maxX - b.minX;
    const h = b.maxY - b.minY;
    const n = event === 'flood' ? 70 : 110;
    for (let i = 0; i < n; i++) {
      const x0 = b.minX + hash(i, 1, 2) * w;
      const speed = 0.35 + hash(i, 3, 4) * 0.25;
      const y =
        b.minY + ((hash(i, 5, 6) * h + this.t * speed * (event === 'freeze' ? 0.18 : 1)) % h);
      if (event === 'freeze') {
        const x = x0 + Math.sin(this.t / 400 + i) * 6;
        g.circle(x, y, 1.6 + hash(i, 7, 8)).fill({ color: 0xffffff, alpha: 0.85 * strength });
      } else {
        const storm = event === 'storm';
        const slant = storm ? 9 : 3;
        const x = x0 + ((y - b.minY) / h) * slant * 4;
        g.moveTo(x, y)
          .lineTo(x - slant, y + (storm ? 18 : 14))
          .stroke({
            width: storm ? 1.6 : 1.2,
            color: storm ? 0x46606e : 0x6d8796,
            alpha: (storm ? 0.6 : 0.45) * strength,
          });
      }
    }
  }

  /**
   * Shadows fall away from the sun: long to the west at dawn, short at noon,
   * long to the east at dusk. Solar the shade rule dimmed sits in shadow all day.
   */
  private drawShadows(day: number | null): void {
    const g = this.shadows.clear();
    if (day === null) return;
    const fade = Math.min(1, day / 0.08, (1 - day) / 0.08);
    // The sun moves from east (right) to west (left) across the top of the map.
    const angle = Math.PI * day; // 0 = east, pi/2 = overhead, pi = west
    const dir = { x: -Math.cos(angle), y: 0.55 * Math.sin(angle) + 0.25 };
    const len = 10 + 26 * (1 - Math.sin(angle));
    const norm = Math.hypot(dir.x, dir.y) || 1;
    const dx = (dir.x / norm) * len;
    const dy = (dir.y / norm) * len;
    for (const h of this.timeline.casters) {
      const c = hexToPixel(h);
      const tip = { x: c.x + dx, y: c.y + dy };
      ellipse(g, (c.x + tip.x) / 2, (c.y + tip.y) / 2 + 3, len / 2 + 9, 7, Math.atan2(dy, dx));
      g.fill({ color: COLORS.shadow, alpha: 0.16 * fade });
    }
    for (const s of this.timeline.shade) {
      const c = hexToPixel(s.at);
      g.poly(hexCorners(c, HEX_RADIUS - 3)).fill({ color: COLORS.shadow, alpha: 0.2 * fade });
      for (const by of s.by) {
        const from = hexToPixel(by);
        g.moveTo(from.x, from.y)
          .lineTo(c.x, c.y)
          .stroke({ width: 5, color: COLORS.shadow, alpha: 0.12 * fade });
      }
    }
  }

  /** Warm light at dawn and dusk, grey during storms. */
  private drawSky(current: PhaseName, day: number): void {
    const g = this.sky.clear();
    const b = this.bounds;
    let color = 0;
    let alpha = 0;
    if (current === 'event' && this.timeline.event === 'storm') {
      color = 0x5b6770;
      alpha = 0.22;
    } else if (current === 'event' && this.timeline.event === 'freeze') {
      color = 0xcfe3ef;
      alpha = 0.2;
    } else if (current === 'day') {
      color = 0xf2a65a;
      alpha = 0.12 * Math.max(0, 1 - Math.sin(Math.PI * day) * 1.6);
    }
    if (alpha > 0) g.rect(b.minX, b.minY, b.maxX - b.minX, b.maxY - b.minY).fill({ color, alpha });
  }

  /** Night falls, homes light up, blacked-out buildings stay dark. */
  private drawNight(night: number, settle: number): void {
    const g = this.night.clear();
    const l = this.light.clear();
    const depth = Math.min(1, night / 0.25) * (1 - settle);
    if (depth <= 0) return;
    // Multiplying by a deep blue dims the valley the way dusk does, without greying it.
    const b = this.bounds;
    g.rect(b.minX - 4000, b.minY - 4000, b.maxX - b.minX + 8000, b.maxY - b.minY + 8000).fill({
      color: mix(0xffffff, 0x4d5f96, depth),
    });
    const pulse = this.reducedMotion ? 1 : 0.85 + 0.15 * Math.sin(this.t / 140);
    if (this.windows.children.length === 0 && depth > 0) this.makeWindows();
    this.windows.alpha = depth;
    this.timeline.lit.forEach((h, i) => {
      const c = hexToPixel(h);
      l.circle(c.x, c.y - 4, 16).fill({ color: COLORS.sunGold, alpha: 0.22 * depth * pulse });
      // Hand-made homes light their own windows (the sprites above); others get two squares.
      if (windowsTexture(this.timeline.litTypes[i] ?? '')) return;
      l.rect(c.x - 5, c.y - 6, 3, 3).fill({ color: 0xffe08a, alpha: depth });
      l.rect(c.x + 2, c.y - 6, 3, 3).fill({ color: 0xffe08a, alpha: depth });
    });
    if (night > 0.15) for (const h of this.timeline.dark) drawCondition(l, hexToPixel(h), 'dark');
  }

  private makeWindows(): void {
    this.timeline.lit.forEach((h, i) => {
      const texture = windowsTexture(this.timeline.litTypes[i] ?? '');
      if (texture) this.windows.addChild(artSprite(texture, hexToPixel(h)));
    });
  }

  /** Loops at work glow along their buildings from midday on. */
  private drawGlow(): void {
    const g = this.glow.clear();
    const from = phaseStart(this.timeline, 'day') + 600;
    if (this.t < from || this.timeline.glow.length === 0) return;
    const rise = clamp01((this.t - from) / 400);
    const pulse = this.reducedMotion ? 1 : 0.7 + 0.3 * Math.sin(this.t / 180);
    for (const group of this.timeline.glow) {
      const pts = group.map(hexToPixel);
      for (let i = 1; i < pts.length; i++) {
        g.moveTo(pts[i - 1]!.x, pts[i - 1]!.y)
          .lineTo(pts[i]!.x, pts[i]!.y)
          .stroke({ width: 6, color: COLORS.sunGold, alpha: 0.35 * rise * pulse, cap: 'round' });
      }
      for (const p of pts) {
        g.poly(hexCorners(p, HEX_RADIUS - 3)).stroke({
          width: 3,
          color: COLORS.sunGold,
          alpha: 0.9 * rise * pulse,
        });
      }
    }
  }

  /** Light travels from each source to the buildings it powers. */
  private drawParticles(): void {
    const g = this.particles.clear();
    for (const f of this.timeline.flows) {
      const p0 = (this.t - f.t) / f.duration;
      if (p0 < 0 || p0 > 1.6) continue;
      const a = hexToPixel(f.from);
      const b = hexToPixel(f.to);
      const lift = Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.35);
      const color = f.slot === 'day' ? COLORS.sunGold : 0xa9d4ff;
      const count = this.reducedMotion ? 1 : f.particles;
      for (let k = 0; k < count; k++) {
        const p = p0 - k * 0.1;
        if (p < 0 || p > 1) continue;
        const e = p * p * (3 - 2 * p);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - lift };
        const x = (1 - e) * (1 - e) * a.x + 2 * (1 - e) * e * mid.x + e * e * b.x;
        const y = (1 - e) * (1 - e) * a.y + 2 * (1 - e) * e * mid.y + e * e * b.y;
        g.circle(x, y - 6, 6).fill({ color, alpha: 0.25 });
        g.circle(x, y - 6, 2.6).fill({ color: 0xfffbea, alpha: 0.95 });
      }
    }
  }

  /** Numbers rise from the buildings that made them. */
  private drawPops(): void {
    for (const pop of this.timeline.pops) {
      const age = this.t - pop.t;
      let node = this.shown.get(pop);
      if (age < 0 || age > POP_LIFE) {
        if (node) node.visible = false;
        continue;
      }
      if (!node) {
        node = popLabel(pop);
        this.shown.set(pop, node);
        this.pops.addChild(node);
      }
      const c = hexToPixel(pop.at);
      const rise = this.reducedMotion ? 0 : 26 * (age / POP_LIFE);
      node.visible = true;
      node.position.set(c.x, c.y - 26 - rise);
      node.alpha = Math.min(1, age / 150, (POP_LIFE - age) / 300);
    }
  }

  /** The sun arcs over the top of the map from east to west; the moon follows it. */
  private drawSun(current: PhaseName, day: number, night: number): void {
    const g = this.sun.clear();
    const { width } = this.screen();
    const arc = (p: number): Point => ({
      x: width - 60 - p * (width - 120),
      y: 78 - Math.sin(Math.PI * p) * 46,
    });
    if (current === 'day') {
      const p = arc(day);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI / 4) * i + (this.reducedMotion ? 0 : this.t / 900);
        g.moveTo(p.x + Math.cos(a) * 17, p.y + Math.sin(a) * 17)
          .lineTo(p.x + Math.cos(a) * 24, p.y + Math.sin(a) * 24)
          .stroke({ width: 3, color: COLORS.sunGold, cap: 'round' });
      }
      g.circle(p.x, p.y, 13).fill({ color: COLORS.sunGold }).stroke({
        width: 2,
        color: COLORS.leadingGold,
      });
    } else if (current === 'night') {
      const p = arc(night);
      g.circle(p.x, p.y, 16).fill({ color: 0xf6eedb, alpha: 0.25 });
      g.circle(p.x, p.y, 11).fill({ color: 0xf6eedb }).stroke({ width: 1.5, color: 0xd8ccb0 });
      g.circle(p.x - 3, p.y - 2, 2.4).fill({ color: 0xe4d8bd });
      g.circle(p.x + 4, p.y + 3, 1.6).fill({ color: 0xe4d8bd });
    }
  }

  private drawShake(): void {
    const { x, y } = this.shakeOrigin;
    const event = this.progress('event');
    if (this.reducedMotion || this.timeline.event !== 'storm' || event >= 1) {
      this.layers.shake.position.set(x, y);
      return;
    }
    const amp = 3 * (1 - event);
    this.layers.shake.position.set(
      x + Math.sin(this.t / 23) * amp,
      y + Math.cos(this.t / 31) * amp * 0.6,
    );
  }
}

function popLabel(pop: Pop): Container {
  const node = new Container();
  const color = pop.tone === 'good' ? COLORS.good : pop.tone === 'bad' ? COLORS.bad : COLORS.ink;
  const text = new Text({
    text: pop.text,
    style: {
      fontFamily: 'Nunito, system-ui, sans-serif',
      fontSize: 12,
      fontWeight: '800',
      fill: color,
    },
    resolution: 3,
  });
  const pill = new Graphics()
    .roundRect(-text.width / 2 - 6, -8, text.width + 12, 16, 8)
    .fill({ color: 0xfffbf0, alpha: 0.96 })
    .stroke({ width: 1, color: pop.tone === 'bad' ? 0xd9a08c : 0x9dbb79 });
  text.position.set(-text.width / 2, -8);
  node.addChild(pill, text);
  return node;
}

/** A small shield over a tile a levee keeps dry. */
function shield(g: Graphics, c: Point, color: number, a: number): void {
  const x = c.x;
  const y = c.y - 14;
  g.moveTo(x - 8, y - 7)
    .lineTo(x + 8, y - 7)
    .lineTo(x + 8, y)
    .quadraticCurveTo(x + 7, y + 7, x, y + 9)
    .quadraticCurveTo(x - 7, y + 7, x - 8, y)
    .closePath()
    .fill({ color, alpha: 0.9 * a })
    .stroke({ width: 1.5, color: 0xfffbf0, alpha: a });
}

/** Water drips off a flooded building. */
function droplets(g: Graphics, c: Point, age: number, still: boolean, a: number): void {
  for (let k = 0; k < 3; k++) {
    const p = still ? 0.5 : (age / 600 + k / 3) % 1;
    const x = c.x - 10 + k * 10;
    const y = c.y - 10 + p * 18;
    g.moveTo(x, y - 3)
      .quadraticCurveTo(x + 2.5, y + 1, x, y + 3)
      .quadraticCurveTo(x - 2.5, y + 1, x, y - 3)
      .fill({ color: 0x3a7d96, alpha: a * (1 - p * 0.6) });
  }
}

/** Cracks spreading through dry earth. */
function cracks(g: Graphics, c: Point, grow: number, a: number): void {
  const arms = [
    [-14, 8, -5, 2, -8, -7],
    [-5, 2, 6, 5, 13, -3],
    [6, 5, 9, 13, 4, 16],
  ];
  for (const [x1, y1, x2, y2, x3, y3] of arms) {
    const mx = x1! + (x2! - x1!) * Math.min(1, grow * 2);
    const my = y1! + (y2! - y1!) * Math.min(1, grow * 2);
    g.moveTo(c.x + x1!, c.y + y1!).lineTo(c.x + mx, c.y + my);
    if (grow > 0.5) {
      const k = (grow - 0.5) * 2;
      g.lineTo(c.x + x2! + (x3! - x2!) * k, c.y + y2! + (y3! - y2!) * k);
    }
    g.stroke({ width: 1.4, color: 0x8a6438, alpha: 0.8 * a });
  }
}

/** A lightning bolt from the sky onto a building. */
function bolt(g: Graphics, c: Point, a: number): void {
  g.moveTo(c.x + 6, c.y - 90)
    .lineTo(c.x - 4, c.y - 52)
    .lineTo(c.x + 5, c.y - 48)
    .lineTo(c.x - 6, c.y - 12)
    .stroke({ width: 5, color: 0xfff3b0, alpha: 0.5 * a, join: 'miter' })
    .moveTo(c.x + 6, c.y - 90)
    .lineTo(c.x - 4, c.y - 52)
    .lineTo(c.x + 5, c.y - 48)
    .lineTo(c.x - 6, c.y - 12)
    .stroke({ width: 2, color: 0xffffff, alpha: a, join: 'miter' });
}

/** Wind streaks blowing past a building. */
function gusts(g: Graphics, c: Point, age: number, a: number): void {
  for (let k = 0; k < 3; k++) {
    const p = (age / 700 + k / 3) % 1;
    const x = c.x - 22 + p * 44;
    const y = c.y - 12 + k * 9;
    g.moveTo(x - 10, y)
      .lineTo(x + 4, y)
      .quadraticCurveTo(x + 9, y - 1, x + 7, y - 4)
      .stroke({ width: 1.5, color: 0x5b6770, alpha: a * Math.sin(Math.PI * p), cap: 'round' });
  }
}

/** Frost creeping over a home: six-armed crystals at its corners. */
function frost(g: Graphics, c: Point, grow: number, a: number): void {
  const spots = [
    { x: c.x - 13, y: c.y - 10 },
    { x: c.x + 13, y: c.y - 8 },
    { x: c.x, y: c.y + 12 },
  ];
  spots.forEach((p, i) => {
    const r = 5 * clamp01(grow * 1.5 - i * 0.25);
    if (r <= 0) return;
    for (let k = 0; k < 3; k++) {
      const ang = (Math.PI / 3) * k + Math.PI / 6;
      g.moveTo(p.x - Math.cos(ang) * r, p.y - Math.sin(ang) * r)
        .lineTo(p.x + Math.cos(ang) * r, p.y + Math.sin(ang) * r)
        .stroke({ width: 1.4, color: 0x7fb2d6, alpha: 0.95 * a, cap: 'round' });
    }
  });
}

/** A fixed pseudo-random number in [0, 1) for drawing: the same every frame. */
export function hash(a: number, b: number, c: number): number {
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function phaseStart(tl: Timeline, name: PhaseName): number {
  return tl.phases.find((p) => p.name === name)!.start;
}

function ellipse(g: Graphics, cx: number, cy: number, rx: number, ry: number, angle: number) {
  const pts: number[] = [];
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  for (let i = 0; i < 16; i++) {
    const a = (Math.PI * 2 * i) / 16;
    const x = Math.cos(a) * rx;
    const y = Math.sin(a) * ry;
    pts.push(cx + x * cos - y * sin, cy + x * sin + y * cos);
  }
  g.poly(pts);
}

/** Linear mix of two colours. */
function mix(a: number, b: number, t: number): number {
  const ch = (shift: number) => {
    const x = (a >> shift) & 0xff;
    const y = (b >> shift) & 0xff;
    return Math.round(x + (y - x) * t) << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
