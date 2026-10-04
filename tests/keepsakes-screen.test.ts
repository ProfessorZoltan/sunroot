/**
 * Keepsakes on screen (proposals/seed-uses.md): the young ones beside their animals, and the
 * settlement's ornaments. Drawing is checked in e2e; here, what is drawn and where.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { contentFor } from '../src/sim/content/modifiers';
import type { RunState, Season } from '../src/sim';
import { YOUNG, lanternTiles, youngFrame } from '../src/game/keepsakes';
import { festivalProps, poseAt, wildlifeActors } from '../src/render/wildlifeArt';
import { keepsakeProps, kiteAnchors } from '../src/render/keepsakeArt';
import { place, scenario } from './helpers';

const REACH = biomeContent('willowReach');
const keep = (s: RunState, keepsakes: string[], banner?: string): RunState => ({
  ...s,
  options: { ...s.options, city: { ...s.options.city, keepsakes, ...(banner ? { banner } : {}) } },
});
// A meadow, woods of 4 for the deer, the river, and the camp.
const LAND = ['~ m m W W', '~ , C W W', '~ , , , ,'];
const valley = (season: Season = 'summer') =>
  scenario(LAND, { season, citizens: 6, stores: { food: 60 }, run: { water: true } });

describe('the young ones', () => {
  it('one for each animal, named for the art guide', () => {
    const wildlife = REACH.keepsakes.filter((k) => k.kind === 'wildlife').map((k) => k.id);
    expect(YOUNG.map((y) => y.keepsake).sort()).toEqual([...wildlife].sort());
    expect(youngFrame('deer.walk.2', 'white')).toBe('deer.white.walk.2');
  });

  it('walk beside their animal as extra figures, only with the keepsake', () => {
    const s = valley();
    s.wildlife = ['deer', 'wildBees'];
    const rules = contentFor(REACH, s);
    const plain = wildlifeActors(rules, s);
    const kept = wildlifeActors(rules, keep(s, ['whiteHart', 'bumblebees']));
    expect(kept.length - plain.length).toBe(2);
    const hart = kept.find((a) => a.young?.keepsake === 'whiteHart')!;
    expect(hart.kind).toBe('deer');
    // Beside the first deer, a few px off, on the same round.
    const deer = kept.find((a) => a.kind === 'deer' && !a.young)!;
    expect(Math.abs(hart.path[0]!.x - deer.path[0]!.x)).toBeLessThan(20);
    // Not without its animal.
    expect(wildlifeActors(rules, keep({ ...s, wildlife: [] }, ['whiteHart']))).toEqual([]);
  });

  it('chicks and pups keep still in their resting frame', () => {
    const s = valley();
    s.wildlife = ['deer'];
    const hart = wildlifeActors(contentFor(REACH, s), keep(s, ['whiteHart'])).find((a) => a.young)!;
    const resting = { ...hart, young: { ...hart.young!, rests: true } };
    expect(poseAt(resting, 12345, false)).toEqual(poseAt(resting, 0, true));
  });
});

describe('ornaments on the settlement', () => {
  it("the city's banner over the camp, in its first district's colour", () => {
    const props = keepsakeProps(REACH, keep(valley(), ['cityBanner'], 'orchardWard'));
    expect(props).toEqual([expect.objectContaining({ kind: 'banner', color: '#E0A33B' })]);
  });

  it('bunting all year, without a festival', () => {
    const s = place(valley('autumn'), 'cottage', 2, 0);
    expect(festivalProps(REACH, s)).toEqual([]);
    expect(festivalProps(REACH, keep(s, ['bunting'])).map((p) => p.kind)).toContain('bunting');
  });

  it('window boxes on homes (the camp too), not in winter; bird boxes on the woods beside them', () => {
    const s = place(valley(), 'cottage', 2, 0);
    const count = (x: RunState, kind: string) =>
      keepsakeProps(REACH, x).filter((p) => p.kind === kind).length;
    const both = keep(s, ['windowBoxes', 'birdBoxes']);
    expect(count(both, 'windowBox')).toBe(2);
    expect(count(both, 'birdBox')).toBeGreaterThan(0);
    expect(count(keep({ ...s, season: 'winter' }, ['windowBoxes']), 'windowBox')).toBe(0);
  });

  it('lanterns along the channels; kites in spring and autumn', () => {
    // The camp's own channel, in a run with water.
    const s = place(valley('spring'), 'cottage', 2, 0);
    expect(lanternTiles(REACH, s)).toEqual([]);
    expect(lanternTiles(REACH, keep(s, ['channelLanterns'])).length).toBeGreaterThan(0);
    expect(kiteAnchors(REACH, keep(s, ['kites']))).toHaveLength(2);
    expect(kiteAnchors(REACH, keep({ ...s, season: 'summer' }, ['kites']))).toEqual([]);
  });
});
