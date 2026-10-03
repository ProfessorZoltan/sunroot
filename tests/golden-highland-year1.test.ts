/**
 * Golden test, PROPOSED for the playtester's review (Working rules): the
 * Highland's Year 1 walkthrough (proposals/highland.md), with the water system
 * on as a Highland run has it.
 *
 * The proposal's year doesn't fit the Highland's numbers: after spring there
 * are 9 materials and its summer (a step of channel, a terrace farm, a pump
 * station) costs 10, and with the stream low in summer the pump's 2 day
 * energy leaves the workshop none. This is the same lesson played on what
 * the glen can pay for. Re-derived after HL3's tuning (glen and terrace farms
 * +1 food in summer and autumn): food is up, materials and citizens are not
 * (DECISIONS.md, The Highland).
 *
 * | Season | Build                                                      | Materials | Food | Citizens |
 * | Spring | Glen Farm, Salvage Yard, Workshop, Hill Turbine            | 9         | 8    | 6        |
 * | Summer | Solar Canopy; a channel up a step, a Terrace Farm (dry)    | 9         | 9    | 6        |
 * | Autumn | Pump Station (the terrace watered), Composter              | 5         | 14   | 6        |
 * | Winter | Bothy (warm by its stove; the camp cold)                   | 3         | 8    | 6        |
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

const HIGH = biomeContent('highland');
export const HIGHLAND_SEED = 'highland-golden-22';

const act = (s: RunState, command: Command) => {
  const r = applyCommand(HIGH, s, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r.state;
};
const heightOf = (s: RunState, h: Hex) => s.map.tiles[hexKey(h)]?.height ?? 0;
const channels = (s: RunState) =>
  Object.values(s.buildings).filter((b) => b.type === 'irrigationChannel');

/** The legal site nearest the camp (ties by position) that also meets `ok`. */
function nearest(s: RunState, id: string, ok: (h: Hex) => boolean = () => true): Hex {
  const camp = s.buildings.b0!.at;
  const site = Object.values(s.map.tiles)
    .filter((t) => ok(t) && canPlace(HIGH, s, id, t).ok)
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
const uidOf = (s: RunState, type: string) =>
  Object.values(s.buildings).find((b) => b.type === type)!.uid;

export function highlandYear(): RunState[] {
  let s = createRun(HIGH, { seed: HIGHLAND_SEED, guided: true, visions: false, water: true });
  const seasons: RunState[] = [];
  // Spring: a glen farm beside the camp's channel, on the floor; the mine, the workshop, and a
  // hill turbine where the stream drops.
  const camp = channels(s);
  s = build(s, 'glenFarm', (h) => camp.some((c) => hexDistance(c.at, h) === 1));
  s = build(s, 'salvageYard');
  s = build(s, 'workshop');
  s = build(s, 'hillTurbine');
  s = end(s, 'pumpStation');
  seasons.push(s);
  // Summer: solar on low ground for the dry spell; the camp's channel dug up a step, and a
  // terrace farm beside it, which stays dry: water doesn't climb.
  s = build(s, 'solarCanopy', (h) => heightOf(s, h) <= 1);
  s = build(s, 'irrigationChannel', (h) => heightOf(s, h) === 1);
  const step = channels(s).find((c) => heightOf(s, c.at) === 1)!.at;
  s = build(s, 'terraceFarm', (h) => hexDistance(h, step) === 1 && heightOf(s, h) === 1);
  s = end(s, 'heatWell');
  seasons.push(s);
  // Autumn: a pump station beside the step lifts water to the terrace; a composter.
  s = build(s, 'pumpStation', (h) => hexDistance(h, step) === 1);
  s = build(s, 'composter');
  s = end(s, 'biocharKiln');
  seasons.push(s);
  // Winter: a bothy, heated by its own stove.
  s = build(s, 'bothy');
  s = end(s, 'snowFence');
  seasons.push(s);
  return seasons;
}

describe('the Highland, Year 1 (golden, PROPOSED)', () => {
  const year = highlandYear();

  it('matches the walkthrough table', () => {
    const rows = year.map((s) => ({
      season: s.lastReport!.season,
      materials: s.stores.materials,
      food: s.stores.food,
      citizens: s.citizens,
    }));
    expect(rows).toEqual([
      { season: 'spring', materials: 9, food: 8, citizens: 6 },
      { season: 'summer', materials: 9, food: 9, citizens: 6 },
      { season: 'autumn', materials: 5, food: 14, citizens: 6 },
      { season: 'winter', materials: 3, food: 8, citizens: 6 },
    ]);
  });

  it('teaches the glen: water flows down, the pump lifts it, the bothy heats itself', () => {
    const [, summer, autumn, winter] = year;
    const terrace = uidOf(summer!, 'terraceFarm');
    // Summer: the terrace above the camp's channel gets nothing.
    expect(summer!.lastReport!.water!.uses[terrace]!.short).toBe(true);
    // Autumn: the pump station lifts water up the step, and the terrace has its share.
    expect(autumn!.lastReport!.water!.uses[terrace]!.short).toBe(false);
    expect(autumn!.lastReport!.math[uidOf(autumn!, 'pumpStation')]!.join(' ')).toContain(
      'up a step',
    );
    // Winter: the bothy keeps warm; the camp, with no heat well yet, does not.
    expect(winter!.lastReport!.cold).not.toContain(uidOf(winter!, 'bothy'));
    expect(winter!.lastReport!.cold).toContain('b0');
  });
});
