/**
 * Golden test, PROPOSED for the playtester's review (Working rules): Rainforest Gardens' Year 1
 * walkthrough (proposals/rainforest-gardens.md), with the water system on as a forest run has it.
 *
 * Checked against the numbers before it is proposed. The proposal's year needed three changes:
 * a home can't stand on rainforest, so the Raised House goes to the old estate and the midden
 * beside it (not between it and the camp); the workshop needs a solar canopy's day energy, which
 * has to stand out of the forest's shade, on the estate, where the cyclone finds it, so the autumn
 * plants a living fence along it; and the midden waits all year for a char hearth's charcoal
 * (the guided draft offers the hearth or the fence, and the fence is wanted twice). FG3's balance
 * changed it again (an understory costs 3; a garden bears nothing in the dry season): the
 * winter's stores run lower, and the banana's mulch shows only from the next summer.
 *
 * | Season | Build                                                              | Materials | Food | Citizens |
 * | Spring | Milpa burned from the rainforest, Salvage Yard, Workshop, Solar Canopy | 12        | 11   | 6        |
 * | Summer | Forest Garden on the rainforest, Raised House on the estate        | 10        | 14   | 7        |
 * | Autumn | Kitchen Midden by the house, understory, living fence by the panel | 9         | 13   | 7        |
 * | Winter | Living fence on the milpa's forest edge, canopy on the garden      | 9         | 6    | 7        |
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import {
  applyCommand,
  canPlace,
  createRun,
  hexDistance,
  hexKey,
  projectSeason,
  type Command,
  type Hex,
  type RunState,
} from '../src/sim';
import { stormExposed } from '../src/sim/queries';

const FOREST = biomeContent('rainforestGardens');
export const FOREST_SEED = 'forest-golden';

const act = (s: RunState, command: Command) => {
  const r = applyCommand(FOREST, s, command);
  if (!r.ok) throw new Error(`${command.type} failed: ${r.error}`);
  return r.state;
};

/** The legal site nearest the camp (ties by position) that also meets `ok`. */
function nearest(s: RunState, id: string, ok: (h: Hex) => boolean = () => true): Hex {
  const camp = s.buildings.b0!.at;
  const site = Object.values(s.map.tiles)
    .filter((t) => ok(t) && canPlace(FOREST, s, id, t).ok)
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
const typeAt = (s: RunState, h: Hex) => s.map.tiles[hexKey(h)]!.type;
const byKey = (a: Hex, b: Hex) => hexKey(a).localeCompare(hexKey(b));

export function forestYear(): RunState[] {
  let s = createRun(FOREST, { seed: FOREST_SEED, guided: true, visions: false, water: true });
  const seasons: RunState[] = [];
  // Spring: the first rains. A milpa burned out of the rainforest by the camp, the estate's
  // salvage, a workshop, and a solar canopy out of the forest's shade for its day energy.
  s = build(s, 'milpa', (h) => typeAt(s, h) === 'woodland');
  s = build(s, 'salvageYard');
  s = build(s, 'workshop', (h) => typeAt(s, h) !== 'woodland' && typeAt(s, h) !== 'floodplain');
  const shaded = (h: Hex) =>
    Object.values(s.map.tiles).some((t) => t.type === 'woodland' && hexDistance(t, h) === 1);
  s = build(s, 'solarCanopy', (h) => typeAt(s, h) !== 'floodplain' && !shaded(h));
  s = end(s, 'kitchenMidden');
  seasons.push(s);
  // Summer: the monsoon. A forest garden that keeps the forest, a raised house on the estate.
  s = build(s, 'forestGarden', (h) => typeAt(s, h) === 'woodland');
  s = build(s, 'raisedHouse');
  s = end(s, 'livingFence');
  seasons.push(s);
  // Autumn: the cyclone. A midden by the house, the garden's understory, a fence by the panel.
  const house = find(s, 'raisedHouse').at;
  s = build(s, 'kitchenMidden', (h) => hexDistance(h, house) === 1);
  s = act(s, { type: 'addLayer', uid: find(s, 'forestGarden').uid, layer: 'understory' });
  const panel = find(s, 'solarCanopy').at;
  const by = Object.values(s.map.tiles)
    .filter((t) => hexDistance(t, panel) === 1)
    .sort(byKey)[0]!;
  s = act(s, { type: 'plantHedge', a: panel, b: by });
  s = end(s, 'stallBarn');
  seasons.push(s);
  // Winter: the dry season. A fence where the milpa meets the forest, and a canopy, slow to grow.
  const milpa = find(s, 'milpa').at;
  const risk = projectSeason(FOREST, s, s.season, { forecast: true }).fireRisk ?? [];
  const edge = Object.values(s.map.tiles)
    .filter((t) => hexDistance(t, milpa) === 1 && risk.includes(hexKey(t)))
    .sort(byKey)[0]!;
  s = act(s, { type: 'plantHedge', a: milpa, b: edge });
  s = act(s, { type: 'addLayer', uid: find(s, 'forestGarden').uid, layer: 'canopy' });
  s = end(s, 'microHydro');
  seasons.push(s);
  return seasons;
}

describe('Rainforest Gardens, Year 1 (golden, PROPOSED)', () => {
  const year = forestYear();

  it('matches the walkthrough table', () => {
    const rows = year.map((s) => ({
      season: s.lastReport!.season,
      materials: s.stores.materials,
      food: s.stores.food,
      citizens: s.citizens,
    }));
    expect(rows).toEqual([
      { season: 'spring', materials: 12, food: 11, citizens: 6 },
      { season: 'summer', materials: 10, food: 14, citizens: 7 },
      { season: 'autumn', materials: 9, food: 13, citizens: 7 },
      { season: 'winter', materials: 9, food: 6, citizens: 7 },
    ]);
  });

  it('spring: clearing is fast food and costs Harmony; the ash gives the field 3', () => {
    const spring = year[0]!;
    const r = spring.lastReport!;
    expect(r.event).toBe('firstRains');
    const milpa = find(spring, 'milpa');
    expect(spring.map.tiles[hexKey(milpa.at)]).toMatchObject({ type: 'scrub', fertility: 3 });
    expect(r.yields[milpa.uid]!.food).toBe(2 + 3);
    expect(spring.harmony).toBe(10);
    // Out of the forest's shade, the canopy gives the workshop its run.
    expect(r.shaded[find(spring, 'solarCanopy').uid]).toBeUndefined();
    expect(r.runs[find(spring, 'workshop').uid]!.runs).toBe(1);
  });

  it('summer: the monsoon washes the bare milpa; homes are cooled from the grid', () => {
    const summer = year[1]!;
    const r = summer.lastReport!;
    expect(r.event).toBe('flood');
    const milpa = find(summer, 'milpa');
    // Sown with the first rains: +1. Then the rain takes 1 of its fertility.
    expect(r.math[milpa.uid]!.join(' ')).toMatch(/\+3 fertility 3 \+1 sown in the first rains/);
    expect(summer.map.tiles[hexKey(milpa.at)]!.fertility).toBe(2);
    expect(r.forest!.leached).toContain(hexKey(milpa.at));
    expect(r.math[find(summer, 'raisedHouse').uid]).toContain(
      'day: 1 cooling from the grid (1 energy)',
    );
  });

  it('autumn: the fence keeps the cyclone off the panel; scraps wait for charcoal', () => {
    const autumn = year[2]!;
    const r = autumn.lastReport!;
    expect(r.event).toBe('storm');
    expect(r.damaged).toEqual([]);
    const panel = find(autumn, 'solarCanopy');
    expect(stormExposed(FOREST, autumn, panel)).toBe(false);
    expect(stormExposed(FOREST, { ...autumn, hedges: [] }, panel)).toBe(true);
    expect(r.math[find(autumn, 'kitchenMidden').uid]).toEqual([
      'took 2 scraps, but no charcoal within 2: no nearer to dark earth',
    ]);
  });

  it('winter: the fire finds cleared edges, but not across the fence; the canopy is slow', () => {
    const winter = year[3]!;
    const r = winter.lastReport!;
    expect(r.event).toBe('fire');
    expect(r.burned).toHaveLength(1);
    const [fence] = winter.hedges.filter((h) => !year[2]!.hedges.includes(h));
    expect(fence).toBeDefined();
    const fenced = fence!.split('|').find((k) => k !== hexKey(find(winter, 'milpa').at))!;
    expect(r.fireRisk).not.toContain(fenced);
    expect(r.burned).not.toContain(fenced);
    const garden = find(winter, 'forestGarden');
    // The dry season: the garden bears nothing; the understory has grown, the canopy hasn't.
    expect(r.yields[garden.uid]?.food ?? 0).toBe(0);
    expect(r.math[garden.uid]!.join(' ')).not.toMatch(/Understory: still growing/);
    expect(r.math[garden.uid]).toContain('Canopy: still growing (0/4 seasons)');
  });
});
