/**
 * Golden test: the Windswept Coast's Year 1 walkthrough
 * (proposals/windswept-coast.md), with the water system on as a coast run has
 * it. Reviewed and approved by the playtester; it must always pass, and
 * changes only with their review (Working rules).
 *
 * | Season | Build                                                     | Materials | Food | Citizens |
 * | Spring | Croft, Beachcombing Yard, Workshop, Tide Turbine          | 9         | 8    | 6        |
 * | Summer | 2nd croft, Cottage                                        | 7         | 11   | 7        |
 * | Autumn | Composter, Dune Grass                                     | 8         | 13   | 8        |
 * | Winter | Kelp Farm (the night 1 short)                             | 9         | 8    | 8        |
 *
 *   Spring: a croft by the camp's channel, beachcombing yard, workshop, tide turbine
 *   Summer: a second croft by the channel, a cottage
 *   Autumn: a composter, dune grass
 *   Winter: a kelp farm
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

const COAST = biomeContent('windsweptCoast');
export const COAST_SEED = 'windswept-coast-golden';

const act = (s: RunState, command: Command) => {
  const r = applyCommand(COAST, s, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r.state;
};

/**
 * The legal site nearest the camp (ties by position): how a first-time player would build;
 * with `watered`, only beside the camp's channel.
 */
function nearest(s: RunState, id: string, watered = false): Hex {
  const camp = s.buildings.b0!.at;
  const channel = Object.values(s.buildings).filter((b) => b.type === 'irrigationChannel');
  const site = Object.values(s.map.tiles)
    .filter(
      (t) =>
        (!watered || channel.some((c) => hexDistance(c.at, t) === 1)) &&
        canPlace(COAST, s, id, t).ok,
    )
    .sort(
      (a, b) => hexDistance(a, camp) - hexDistance(b, camp) || hexKey(a).localeCompare(hexKey(b)),
    )[0];
  if (!site) throw new Error(`no site for ${id}`);
  return { q: site.q, r: site.r };
}
const build = (s: RunState, id: string, watered = false) =>
  act(s, { type: 'place', building: id, at: nearest(s, id, watered) });
const end = (s: RunState, card: string) =>
  act(act(s, { type: 'pickCard', card }), { type: 'endSeason' });

export function coastYear(): RunState[] {
  let s = createRun(COAST, { seed: COAST_SEED, guided: true, visions: false, water: true });
  const seasons: RunState[] = [];
  s = build(s, 'croft', true);
  s = build(s, 'beachcombingYard');
  s = build(s, 'workshop');
  s = build(s, 'tideTurbine');
  s = end(s, 'duneGrass');
  seasons.push(s);
  s = build(s, 'croft', true);
  s = build(s, 'cottage');
  s = end(s, 'kelpFarm');
  seasons.push(s);
  s = build(s, 'composter');
  s = build(s, 'duneGrass');
  s = end(s, 'oysterReef');
  seasons.push(s);
  s = build(s, 'kelpFarm');
  s = end(s, 'waveBuoy');
  seasons.push(s);
  return seasons;
}

describe('the Windswept Coast, Year 1 (golden)', () => {
  it('matches the walkthrough table', () => {
    const rows = coastYear().map((s) => ({
      season: s.lastReport!.season,
      materials: s.stores.materials,
      food: s.stores.food,
      citizens: s.citizens,
      night: s.lastReport!.energy.night.shortfall,
    }));
    // Tuned (B3) to grow as the Reach's first year does; the winter night falls 1 short, which
    // the wave buoy drafted that winter answers.
    expect(rows).toEqual([
      { season: 'spring', materials: 9, food: 8, citizens: 6, night: 0 },
      { season: 'summer', materials: 7, food: 11, citizens: 7, night: 0 },
      { season: 'autumn', materials: 8, food: 13, citizens: 8, night: 0 },
      { season: 'winter', materials: 9, food: 8, citizens: 8, night: 1 },
    ]);
  });
});
