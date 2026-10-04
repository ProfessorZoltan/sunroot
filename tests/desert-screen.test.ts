/**
 * The Sun Desert on screen (SD4, proposals/sun-desert.md): cooling in the
 * season report and tooltips (who cools whom), the river drying, the heatwave
 * and the dust storm in the season's resolution, and heat shimmer, glints and
 * sand in the desert's air. Drawing is checked in e2e; here, the data it draws.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import type { RunState, Season } from '../src/sim';
import { coolAt, coolNotes, gridCooling } from '../src/game/coolInfo';
import { buildTimeline } from '../src/game/timeline';
import { ambientFor } from '../src/render/ambient';
import { riverDry } from '../src/render/mapView';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

const D = biomeContent('sunDesert');
const LAND = ['~ K g g g g g g', '~ f g g g O g E', '~ f g C g O g E', '~ g g g s g g E'];
const start = (season: Season = 'summer') =>
  scenario(LAND, {
    content: D,
    season,
    citizens: 20,
    stores: { food: 200 },
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, D), s);
const kinds = (s: RunState) => buildTimeline(D, s, s.lastReport!).eventFx.map((f) => f.kind);

describe('cooling on screen', () => {
  it('the report says who cooled whom; the grid pays the rest at 2 energy each', () => {
    let s = build(start(), 'mudBrickHouse', [[4, 0]]);
    s = build(s, 'windTower', [[3, 0]]);
    s = endSeason(s, D);
    const cool = s.lastReport!.cool!;
    const tower = uidAt(s, 3, 0);
    const house = uidAt(s, 4, 0);
    // The camp comes first (2 in the heatwave): the tower's 2 go to it, the house's 1 to the grid.
    expect(cool).toContainEqual({ slot: 'day', from: tower, to: 'b0', amount: 2 });
    expect(cool).toContainEqual({ slot: 'day', from: 'grid', to: house, amount: 1 });
    expect(gridCooling(D, cool).get(house)).toEqual({ day: 2, night: 0 });
  });

  it('a tooltip names the source; a tower says whom it cools; the report sums it up', () => {
    let s = build(start(), 'mudBrickHouse', [[4, 0]]);
    s = build(s, 'windTower', [[3, 0]]);
    s = endSeason(s, D);
    const cool = s.lastReport!.cool!;
    expect(coolAt(D, s, cool, at(3, 2)).join(' ')).toContain(
      'Cooling on hot days: 2 from the Wind Tower',
    );
    expect(coolAt(D, s, cool, at(4, 0)).join(' ')).toContain('1 from the grid (2 energy each)');
    expect(coolAt(D, s, cool, at(3, 0)).join(' ')).toMatch(/^Cools Founders' Camp: 2/);
    const notes = coolNotes(D, s, cool, []).join(' ');
    expect(notes).toContain('The Wind Tower cooled homes near it by 2.');
    expect(notes).toContain('1 cooling bought from the grid, at 2 energy each');
  });

  it('no cooling report where nothing needs it (the Reach, or a desert spring)', () => {
    expect(endSeason(start('spring'), D).lastReport!.cool).toBeNull();
    expect(endSeason(scenario(['~ , C ,'], { season: 'summer' })).lastReport!.cool).toBeNull();
  });
});

describe('the season played out', () => {
  it('a heatwave: homes cooled for free, or bought from the grid; the river dries', () => {
    let s = build(start(), 'mudBrickHouse', [[4, 0]]);
    s = build(s, 'windTower', [[3, 0]]);
    s = endSeason(s, D);
    const tl = buildTimeline(D, s, s.lastReport!);
    expect(tl.event).toBe('heatwave');
    expect(tl.land).toBe('desert');
    expect(kinds(s)).toContain('cooled');
    // The house's cooling came from the grid: it shows hot, and the grid's energy flows to it.
    expect(kinds(s)).toContain('hot');
    const house = s.buildings[uidAt(s, 4, 0)]!.at;
    expect(tl.flows.some((f) => f.slot === 'day' && f.to.q === house.q && f.to.r === house.r)).toBe(
      true,
    );
  });

  it('a dust storm: dust on the panels and mirrors', () => {
    let s = build(start('autumn'), 'solarCanopy', [[6, 0]]);
    // A windbreak keeps it from being buried; the dust still settles on its glass.
    s = act(s, { type: 'plantHedge', a: at(6, 0), b: at(5, 0) }, D);
    s = endSeason(s, D);
    const tl = buildTimeline(D, s, s.lastReport!);
    expect(tl.eventFx.some((f) => f.kind === 'dusted')).toBe(true);
    expect(tl.pops.map((p) => p.text)).toContain('dust −1');
  });
});

describe("the desert's map and air", () => {
  it('the river runs dry in summer only, and only with water on', () => {
    expect(riverDry(D, start('summer'))).toBe(true);
    expect(riverDry(D, start('spring'))).toBe(false);
    const dry = scenario(LAND, { content: D, season: 'summer' });
    expect(riverDry(D, dry)).toBe(false);
  });

  it('heat shimmer over open ground in summer; glints on panels; sand, never snow', () => {
    let s = build(start(), 'solarCanopy', [[6, 0]]);
    s = build(s, 'concentratedSolarPlant', [[3, 3]]);
    const summer = ambientFor(D, s);
    expect(summer.shimmer.length).toBeGreaterThan(0);
    expect(summer.glints).toHaveLength(2);
    expect(summer.falling).toBe('sand');
    const winter = ambientFor(D, { ...s, season: 'winter' });
    expect(winter.shimmer).toEqual([]);
    expect(winter.falling).not.toBe('snow');
    // The Reach keeps its own air.
    const reach = ambientFor(biomeContent('willowReach'), scenario(['~ , C ,']));
    expect(reach.shimmer).toEqual([]);
    expect(reach.glints).toEqual([]);
  });
});
