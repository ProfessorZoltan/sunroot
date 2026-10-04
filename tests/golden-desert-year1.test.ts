/**
 * Golden test, PROPOSED for the playtester's review (Working rules): the Sun
 * Desert's Year 1 walkthrough (proposals/sun-desert.md), with the water system
 * on as a desert run has it.
 *
 * Checked against the numbers before it is proposed, as the Highland's lesson
 * asked. The proposal's year didn't fit as first written: a spring of the four
 * buildings it names left too little for summer, a workshop with no spare day
 * energy made nothing, and one oasis garden at 2 / 3 / 4 / 1 couldn't feed six
 * people through the year. Two of the desert's numbers changed (DECISIONS.md,
 * SD2): the camp's panels make 4 by day and 1 by night (sun by day, little by
 * night), and the oasis garden 3 / 4 / 4 / 2. The solar canopy the autumn's
 * windbreak shelters is built that autumn, beside the workshop, so one palm
 * windbreak on the edge between them keeps the dust off both.
 *
 * | Season | Build                                                           | Materials | Food | Citizens |
 * | Spring | Oasis Garden, Salvage Yard, Workshop, Cistern on the wadi bank  | 10        | 9    | 6        |
 * | Summer | Mud-brick House, Wind Tower beside it                           | 7         | 7    | 6        |
 * | Autumn | Fog Net; Solar Canopy by the workshop, a Palm Windbreak between | 8         | 5    | 6        |
 * | Winter | Cell Bank                                                       | 5         | 1    | 6        |
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

const DESERT = biomeContent('sunDesert');
export const DESERT_SEED = 'desert-golden-2';

const act = (s: RunState, command: Command) => {
  const r = applyCommand(DESERT, s, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r.state;
};
const tileOf = (s: RunState, h: Hex) => s.map.tiles[hexKey(h)]!.type;

/** The legal site nearest the camp (ties by position) that also meets `ok`. */
function nearest(s: RunState, id: string, ok: (h: Hex) => boolean = () => true): Hex {
  const camp = s.buildings.b0!.at;
  const site = Object.values(s.map.tiles)
    .filter((t) => ok(t) && canPlace(DESERT, s, id, t).ok)
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

export function desertYear(): RunState[] {
  let s = createRun(DESERT, { seed: DESERT_SEED, guided: true, visions: false, water: true });
  const seasons: RunState[] = [];
  // Spring: a garden by the oasis, the old array's salvage, a workshop, and a cistern on the
  // wadi bank for the flash flood to fill.
  s = build(s, 'oasisGarden');
  s = build(s, 'salvageYard');
  s = build(s, 'workshop');
  s = build(s, 'cistern', (h) => tileOf(s, h) === 'floodplain');
  s = end(s, 'windTower');
  seasons.push(s);
  // Summer: the heatwave; a mud-brick house, and a wind tower within reach of it and the camp.
  s = build(s, 'mudBrickHouse');
  const house = find(s, 'mudBrickHouse').at;
  const camp = s.buildings.b0!.at;
  s = build(s, 'windTower', (h) => hexDistance(h, camp) <= 2 && hexDistance(h, house) <= 2);
  s = end(s, 'fogNet');
  seasons.push(s);
  // Autumn: the dust storm; a fog net at the edge, a solar canopy by the workshop and a palm
  // windbreak on the edge between them.
  s = build(s, 'fogNet');
  const shop = find(s, 'workshop').at;
  s = build(s, 'solarCanopy', (h) => hexDistance(h, shop) === 1);
  s = act(s, { type: 'plantHedge', a: find(s, 'solarCanopy').at, b: shop });
  s = end(s, 'sandBattery');
  seasons.push(s);
  // Winter: cold nights; a cell bank keeps the day for them.
  s = build(s, 'cellBank');
  s = end(s, 'windSpire');
  seasons.push(s);
  return seasons;
}

describe('the Sun Desert, Year 1 (golden, PROPOSED)', () => {
  const year = desertYear();

  it('matches the walkthrough table', () => {
    const rows = year.map((s) => ({
      season: s.lastReport!.season,
      materials: s.stores.materials,
      food: s.stores.food,
      citizens: s.citizens,
    }));
    expect(rows).toEqual([
      { season: 'spring', materials: 10, food: 9, citizens: 6 },
      { season: 'summer', materials: 7, food: 7, citizens: 6 },
      { season: 'autumn', materials: 8, food: 5, citizens: 6 },
      { season: 'winter', materials: 5, food: 1, citizens: 6 },
    ]);
  });

  it('spring: the oasis is the water, and the flash flood fills the cistern', () => {
    const spring = year[0]!;
    const water = spring.lastReport!.water!;
    expect(water.in.spring).toBeGreaterThan(0);
    expect(water.in.flood).toBeGreaterThan(0);
    expect(water.uses[find(spring, 'oasisGarden').uid]!.short).toBe(false);
    expect(find(spring, 'cistern').stored).toBe(DESERT.byId.cistern!.water!.stores);
  });

  it('summer: the river runs dry; the homes are cooled for nothing by the wind tower', () => {
    const summer = year[1]!;
    const r = summer.lastReport!;
    expect(r.event).toBe('heatwave');
    expect(r.water!.riverFlow).toBe(0);
    const cool = r.energy.day.cool!;
    expect(cool.demand).toBeGreaterThan(0);
    expect(cool.bySource.windTower).toBe(cool.demand);
    expect(cool.grid).toBe(0);
    expect(r.hot).toEqual([]);
    // The cistern keeps the flood's water for later.
    expect(find(summer, 'cistern').stored).toBeGreaterThan(0);
  });

  it('autumn: the dust dims the panels and buries what it reaches; the windbreak shelters', () => {
    const autumn = year[2]!;
    const r = autumn.lastReport!;
    expect(r.event).toBe('storm');
    const canopy = find(autumn, 'solarCanopy').uid;
    const shop = find(autumn, 'workshop').uid;
    expect(r.math[canopy]!.join(' ')).toContain('dust storm -1');
    expect(r.damaged).not.toContain(canopy);
    expect(r.damaged).not.toContain(shop);
    expect(r.damaged.length).toBeGreaterThan(0);
    // The fog brings water with no river.
    expect(r.water!.in.fog).toBe(1);
  });

  it('winter: the cell bank carries the day into the cold night; mud-brick walls keep warm', () => {
    const winter = year[3]!;
    const r = winter.lastReport!;
    expect(r.event).toBe('freeze');
    expect(r.energy.night.storageDischarged).toBeGreaterThan(0);
    expect(r.energy.night.heatBy.mudBrickHouse).toBeUndefined();
    expect(r.cold).toEqual([]);
  });
});
