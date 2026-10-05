/**
 * Golden test, PROPOSED for the playtester's review (Working rules): Lake Gardens' Year 1
 * walkthrough (proposals/lake-gardens.md), with the water system on as a lake run has it.
 *
 * Checked against the numbers before it is proposed. The proposal's year didn't fit as first
 * written: a workshop with no spare day energy made nothing, the lake wind damaged both raised
 * beds, and on winter nights the stilt house was shut off with nothing but the camp to light it.
 * LG3's balance changed it again (a chinampa costs 4 and makes 2 / 3 / 3 / 1; DECISIONS.md, LG3),
 * so the year is spread out: the spring adds a solar canopy, on dry ground with the workshop (the
 * high water floods the reed fringe); the stilt house comes in summer, its fishery in autumn; the
 * two chinampas stand side by side, so the willow edge on the edge between them shelters both; and
 * the winter builds a mud boat by the mud (low water, dredging is easiest) and a canal wheel on the
 * stream for the nights. The autumn closes the Clean Lake Loop (house, fishery, bed).
 *
 * | Season | Build                                                          | Materials | Food | Citizens |
 * | Spring | 2 Chinampas side by side, Salvage Yard, Workshop, Solar Canopy | 6         | 12   | 6        |
 * | Summer | Stilt House                                                    | 11        | 14   | 7        |
 * | Autumn | Wastewater Fishery by the house, Willow Edge between the beds  | 11        | 17   | 8        |
 * | Winter | Mud Boat by the mud, Canal Wheel on the stream                 | 9         | 17   | 8        |
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
  const dry = (h: Hex) => s.map.tiles[hexKey(h)]!.type !== 'floodplain';
  // Spring: high water; two chinampas made side by side on the shallows by the camp, the drowned
  // town's salvage, a workshop on dry ground, and a canopy for its day energy.
  s = build(s, 'chinampa');
  const first = find(s, 'chinampa').at;
  s = build(s, 'chinampa', (h) => hexDistance(h, first) === 1);
  s = build(s, 'salvageYard');
  s = build(s, 'workshop', dry);
  s = build(s, 'solarCanopy', (h) => dry(h) && open(s)(h));
  s = end(s, 'wastewaterFishery');
  seasons.push(s);
  // Summer: the bloom season; a stilt house over the water, its washing water into the lake.
  s = build(s, 'stiltHouse');
  s = end(s, 'willowEdge');
  seasons.push(s);
  // Autumn: the lake wind; a wastewater fishery beside the house, a willow edge between the beds.
  const house = find(s, 'stiltHouse').at;
  s = build(s, 'wastewaterFishery', (h) => hexDistance(h, house) === 1);
  const [a, b] = all(s, 'chinampa');
  s = act(s, { type: 'plantHedge', a: a!.at, b: b!.at });
  s = end(s, 'canalWheel');
  seasons.push(s);
  // Winter: low water; a mud boat by the mud the house's water left, a canal wheel for the nights.
  const muddy = Object.values(s.map.tiles).filter((t) => (t.mud ?? 0) > 0);
  s = build(s, 'mudBoat', (h) => muddy.some((m) => hexDistance(m, h) === 1));
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
      { season: 'spring', materials: 6, food: 12, citizens: 6 },
      { season: 'summer', materials: 11, food: 14, citizens: 7 },
      { season: 'autumn', materials: 11, food: 17, citizens: 8 },
      { season: 'winter', materials: 9, food: 17, citizens: 8 },
    ]);
  });

  it('spring: land is made, not found; high water floods the fringe but not the beds', () => {
    const spring = year[0]!;
    const r = spring.lastReport!;
    expect(r.event).toBe('flood');
    expect(r.flooded.length).toBeGreaterThan(0);
    expect(r.damaged).toEqual([]);
    for (const bed of all(spring, 'chinampa')) {
      expect(spring.map.tiles[hexKey(bed.at)]!.type).toBe('bed');
      expect(r.flooded).not.toContain(hexKey(bed.at));
      expect(r.water!.uses[bed.uid]!.short).toBe(false);
    }
    // The workshop has the canopy's day energy for its run.
    expect(r.runs[find(spring, 'workshop').uid]!.runs).toBeGreaterThan(0);
  });

  it("summer: the stilt house's grey water goes into the lake, which cleans a little itself", () => {
    const summer = year[1]!;
    const r = summer.lastReport!;
    expect(r.event).toBe('bloom');
    expect(r.lake).toMatchObject({ greyIn: 1, cleaned: 1, bloom: false });
    expect(summer.lake!.grey).toBe(0);
  });

  it('autumn: the fishery eats the grey water; the willow edge keeps the wind off both beds', () => {
    const autumn = year[2]!;
    const r = autumn.lastReport!;
    expect(r.event).toBe('storm');
    expect(r.lake).toMatchObject({ greyIn: 1, eaten: 1 });
    expect(r.yields[find(autumn, 'wastewaterFishery').uid]?.food).toBe(1);
    // House, fishery and bed in a chain of neighbours: the Clean Lake Loop.
    expect(autumn.loops.map((l) => l.combo)).toContain('cleanLakeLoop');
    // Both beds face the deep water, and the one edge between them shelters both.
    expect(r.damaged).toEqual([]);
    const unsheltered = { ...autumn, hedges: [] };
    for (const bed of all(autumn, 'chinampa')) {
      expect(stormExposed(LAKE, unsheltered, bed)).toBe(true);
      expect(stormExposed(LAKE, autumn, bed)).toBe(false);
    }
  });

  it('winter: low water; the mud is lifted as compost and the canal wheel lights the nights', () => {
    const winter = year[3]!;
    const r = winter.lastReport!;
    expect(r.event).toBe('freeze');
    expect(r.lake!.dredged[find(winter, 'mudBoat').uid]).toBe(1);
    expect(winter.stores.compost).toBe(1);
    expect(r.blackouts).toEqual([]);
    expect(r.math[find(winter, 'canalWheel').uid]!.join(' ')).toContain('night energy 2');
    // The loop pays from the season after it closed.
    expect(r.math[find(winter, 'wastewaterFishery').uid]!.join(' ')).toMatch(/Clean Lake Loop/);
  });
});
