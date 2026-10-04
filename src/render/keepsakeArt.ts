/**
 * The settlement's keepsakes on the map (proposals/seed-uses.md): the city's banner over the
 * camp, window boxes, lanterns along the channels, bird boxes and kites. Each is drawn in code
 * until its art comes (`keepsakes/id.png`); the bunting and lanterns use the festivals' art.
 */
import type { Graphics } from 'pixi.js';
import { districtLook } from '../game/districtLook';
import { birdBoxTiles, homesOf, keepsakesIn, lanternTiles } from '../game/keepsakes';
import type { Content } from '../sim/content/load';
import type { Hex } from '../sim/hex';
import type { RunState } from '../sim/types';
import { hexToPixel, type Point } from './layout';
import type { Prop } from './wildlifeArt';

/** Where a channel's lantern stands on its tile: at the bank, a little right of the ditch. */
export function lanternAt(h: Hex): Point {
  const c = hexToPixel(h);
  return { x: c.x + 12, y: c.y - 4 };
}

/** The settlement's ornaments this season (the bunting comes with the festival props). */
export function keepsakeProps(content: Content, state: RunState): Prop[] {
  const kept = keepsakesIn(state);
  if (kept.size === 0) return [];
  const props: Prop[] = [];
  const camp = Object.values(state.buildings).find((b) => b.type === content.campBuilding);
  const banner = state.options.city.banner;
  if (kept.has('cityBanner') && camp && banner) {
    const c = hexToPixel(camp.at);
    props.push({
      kind: 'banner',
      at: { x: c.x + 15, y: c.y - 6 },
      color: districtLook(banner).color,
    });
  }
  if (kept.has('windowBoxes') && state.season !== 'winter')
    for (const h of homesOf(content, state).slice(0, 12)) {
      const c = hexToPixel(h);
      props.push({ kind: 'windowBox', at: { x: c.x - 9, y: c.y - 2 } });
    }
  for (const h of lanternTiles(content, state))
    props.push({ kind: 'lantern', at: lanternAt(h), lit: false });
  if (kept.has('birdBoxes'))
    for (const h of birdBoxTiles(content, state)) {
      const c = hexToPixel(h);
      props.push({ kind: 'birdBox', at: { x: c.x - 6, y: c.y - 16 } });
    }
  return props;
}

/** Ornaments without their own art yet, drawn small in code. */
export function drawOrnament(g: Graphics, p: Prop): void {
  const { x, y } = p.at;
  switch (p.kind) {
    case 'banner': {
      // A pole with a swallow-tailed flag in the city's first district's colour.
      g.moveTo(x, y)
        .lineTo(x, y - 30)
        .stroke({ width: 1.4, color: 0x6b4f35, cap: 'round' });
      g.circle(x, y - 31, 1.3).fill({ color: 0xf2c14e });
      g.poly([x, y - 29, x + 13, y - 27, x + 9, y - 24, x + 13, y - 21, x, y - 19]).fill({
        color: Number.parseInt((p.color ?? '#9e9280').slice(1), 16),
      });
      break;
    }
    case 'windowBox': {
      // A little wooden box of flowers under a window.
      g.rect(x, y, 9, 2.4).fill({ color: 0x8a5a3a });
      const flowers = [0xe0607e, 0xf2c14e, 0xf4f0e8, 0xb06ad0];
      for (let i = 0; i < 4; i++)
        g.circle(x + 1.5 + i * 2, y - 0.6, 1.1).fill({ color: flowers[i]! });
      break;
    }
    case 'birdBox': {
      // A box with a round hole and a pitched roof, high on a trunk.
      g.rect(x - 2.5, y - 4, 5, 5).fill({ color: 0xb98a5a });
      g.poly([x - 3.5, y - 4, x, y - 7, x + 3.5, y - 4]).fill({ color: 0x6b4f35 });
      g.circle(x, y - 2, 0.9).fill({ color: 0x2b1d14 });
      break;
    }
    default:
      break;
  }
}

/** Where kites fly in the windy seasons (spring and autumn): over up to 3 homes. */
export function kiteAnchors(content: Content, state: RunState): Point[] {
  if (!keepsakesIn(state).has('kites')) return [];
  if (state.season !== 'spring' && state.season !== 'autumn') return [];
  return homesOf(content, state)
    .slice(0, 3)
    .map((h) => hexToPixel(h));
}

const KITE_COLORS = [0xd9543c, 0x3a6ea5, 0xf2c14e];

/** Kites high over their homes, bobbing on the wind, their strings to the ground. */
export function drawKites(g: Graphics, anchors: Point[], clock: number, still: boolean): void {
  anchors.forEach((a, i) => {
    const t = still ? 0 : clock / 900 + i * 1.7;
    const x = a.x + 22 + Math.sin(t) * 5;
    const y = a.y - 78 - i * 9 + Math.cos(t * 1.3) * 3;
    g.moveTo(a.x + 4, a.y - 6)
      .quadraticCurveTo(a.x + 22, a.y - 30, x, y + 6)
      .stroke({ width: 0.6, color: 0xf4f0e8, alpha: 0.8 });
    g.poly([x, y - 7, x + 5, y, x, y + 6, x - 5, y]).fill({ color: KITE_COLORS[i % 3]! });
    g.moveTo(x, y - 7)
      .lineTo(x, y + 6)
      .stroke({ width: 0.5, color: 0x2b1d14, alpha: 0.5 });
    // Its tail, a few bows on a line.
    for (let k = 1; k <= 3; k++) {
      const tx = x - k * 3 + Math.sin(t * 2 + k) * 1.5;
      const ty = y + 6 + k * 4;
      g.circle(tx, ty, 1).fill({ color: KITE_COLORS[(i + k) % 3]! });
    }
  });
}
