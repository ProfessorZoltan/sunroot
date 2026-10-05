/**
 * Golden test, PROPOSED for the playtester's review (Working rules): Lake Gardens' Year 1
 * walkthrough (proposals/lake-gardens.md), with the water system on as a lake run has it.
 *
 * Checked against the numbers before it is proposed. The proposal's year didn't fit as first
 * written: a workshop with no spare day energy made nothing, the lake wind damaged both raised
 * beds, and on winter nights the stilt house was shut off with nothing but the camp to light
 * it. So the spring adds a solar canopy; the two chinampas stand side by side, so the willow
 * edge on the edge between them shelters both; and the winter builds a canal wheel on the
 * stream for the nights (the stream runs 10 / 5 / 8 / 8, DECISIONS.md, LG2). The mulberry dyke
 * comes in the winter's draft, for year 2.
 *
 * | Season | Build                                                         | Materials | Food | Citizens |
 * | Spring | 2 Chinampas side by side, Salvage Yard, Workshop, Solar Canopy | 8         | 12   | 6        |
 * | Summer | Stilt House, Wastewater Fishery beside it                      | 6         | 17   | 7        |
 * | Autumn | Mud Boat, Willow Edge between the two chinampas                | 5         | 21   | 8        |
 * | Winter | Canal Wheel on the stream                                      | 5         | 20   | 8        |
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  applyCommand,
  canPlace,
  createRun,
  hexDistance,
  hexKey,
  type Command,
  type Hex,
  type RunState,
} from '../src/sim';
import { stormExposed } from '../src/sim/queries';

const LAKE = biomeContent('lakeGardens');
export const LAKE_SEED = 'lake-golden';

const act = (s: RunState, command: Command) => {
  const r = applyCommand(LAKE, s, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r.state;
};

/** The legal site nearest the camp (ties by position) that also meets `ok`. */
function nearest(s: RunState, id: string, ok: (h: Hex) => boolean = () => true): Hex {
  const camp = s.buildings.b0!.at;
  const site = Object.values(s.map.tiles)
    .filter((t) => ok(t) && canPlace(LAKE, s, id, t).ok)
    .sort(
      (a, b) => hexDistance(a, camp) - hexDistance(b, camp) || hexKey(a).localeCompare(hexKey(b)),
    )[0];
  if (!site) throw new Error(`no site for ${id}`);
  return { q: site.q, r: site.r };
}
const build = (s: RunState, id: string, ok?: (h: Hex) => boolean) =>
  act(s, { type: 'place', building: id, at: nearest(s, id, ok) });
const end = (s: RunState, card: string) =>
  act(act(s, { type: 'pickCard', card }), { type: 'endSeason' });
const find = (s: RunState, type: string) =>
  Object.values(s.buildings).find((b) => b.type === type)!;
const all = (s: RunState, type: string) =>
  Object.values(s.buildings).filter((b) => b.type === type);
/** Nothing built beside it: a solar canopy in the open, out of a tall neighbour's shade. */
const open = (s: RunState) => (h: Hex) =>
  Object.values(s.buildings).every((b) => hexDistance(b.at, h) > 1);

export function lakeYear(): RunState[] {
  let s = createRun(LAKE, { seed: LAKE_SEED, guided: true, visions: false, water: true });
  const seasons: RunState[] = [];
  // Spring: high water; two chinampas made side by side on the shallows by the camp, the drowned
  // town's salvage, a workshop, and a canopy for its day energy.
  s = build(s, 'chinampa');
  const first = find(s, 'chinampa').at;
  s = build(s, 'chinampa', (h) => hexDistance(h, first) === 1);
  s = build(s, 'salvageYard');
  s = build(s, 'workshop');
  s = build(s, 'solarCanopy', open(s));
  s = end(s, 'wastewaterFishery');
  seasons.push(s);
  // Summer: the bloom season; a stilt house over the water, and a wastewater fishery beside it
  // to eat its washing water.
  s = build(s, 'stiltHouse');
  const house = find(s, 'stiltHouse').at;
  s = build(s, 'wastewaterFishery', (h) => hexDistance(h, house) === 1);
  s = end(s, 'willowEdge');
  seasons.push(s);
  // Autumn: the lake wind; a mud boat near the fishery, and a willow edge between the beds.
  const fishery = find(s, 'wastewaterFishery').at;
  s = build(s, 'mudBoat', (h) => hexDistance(h, fishery) <= 2);
  const [a, b] = all(s, 'chinampa');
  s = act(s, { type: 'plantHedge', a: a!.at, b: b!.at });
  s = end(s, 'canalWheel');
  seasons.push(s);
  // Winter: low water; a canal wheel on the stream for the cold nights.
  s = build(s, 'canalWheel');
  s = end(s, 'mulberryDyke');
  seasons.push(s);
  return seasons;
}

describe('Lake Gardens, Year 1 (golden, PROPOSED)', () => {
  const year = lakeYear();

  it('matches the walkthrough table', () => {
    const rows = year.map((s) => ({
      season: s.lastReport!.season,
      materials: s.stores.materials,
      food: s.stores.food,
      citizens: s.citizens,
    }));
    expect(rows).toEqual([
      { season: 'spring', materials: 8, food: 12, citizens: 6 },
      { season: 'summer', materials: 6, food: 17, citizens: 7 },
      { season: 'autumn', materials: 5, food: 21, citizens: 8 },
      { season: 'winter', materials: 5, food: 20, citizens: 8 },
    ]);
  });

  it('spring: land is made, not found; high water floods the fringe but not the beds', () => {
    const spring = year[0]!;
    const r = spring.lastReport!;
    expect(r.event).toBe('flood');
    expect(r.flooded.length).toBeGreaterThan(0);
    for (const bed of all(spring, 'chinampa')) {
      expect(spring.map.tiles[hexKey(bed.at)]!.type).toBe('bed');
      expect(r.flooded).not.toContain(hexKey(bed.at));
      expect(r.water!.uses[bed.uid]!.short).toBe(false);
    }
    // The workshop has the canopy's day energy for its run.
    expect(r.runs[find(spring, 'workshop').uid]!.runs).toBeGreaterThan(0);
  });

  it("summer: the stilt house's grey water is the fishery's feed, so the lake doesn't bloom", () => {
    const summer = year[1]!;
    const r = summer.lastReport!;
    expect(r.event).toBe('bloom');
    expect(r.lake).toMatchObject({ greyIn: 1, eaten: 1, bloom: false });
    expect(r.yields[find(summer, 'wastewaterFishery').uid]?.food).toBe(1);
    expect(summer.lake!.grey).toBe(0);
  });

  it('autumn: the mud the water left is lifted as compost; the willow edge keeps the wind off', () => {
    const autumn = year[2]!;
    const r = autumn.lastReport!;
    expect(r.event).toBe('storm');
    expect(r.lake!.dredged[find(autumn, 'mudBoat').uid]).toBe(1);
    expect(autumn.stores.compost).toBe(1);
    // Both beds face the deep water, and the one edge between them shelters both.
    expect(r.damaged).toEqual([]);
    const unsheltered = { ...autumn, hedges: [] };
    for (const bed of all(autumn, 'chinampa')) {
      expect(stormExposed(LAKE, unsheltered, bed)).toBe(true);
      expect(stormExposed(LAKE, autumn, bed)).toBe(false);
    }
  });

  it('winter: low water; the canal wheel lights the stilt house through the cold nights', () => {
    const winter = year[3]!;
    const r = winter.lastReport!;
    expect(r.event).toBe('freeze');
    expect(r.blackouts).toEqual([]);
    expect(r.math[find(winter, 'canalWheel').uid]!.join(' ')).toContain('night energy 2');
  });
});
