/**
 * Willow Reach v2's evolutions (EXPANSION.md, New evolutions; milestone E3):
 * one test per evolution, the branching choice, and the coppice action.
 * They join with the water system, so these tests turn it on.
 */
import { describe, expect, it } from 'vitest';
import { harmonyLines, hexKey, type RunState, type WaterReport } from '../src/sim';
import { act, at, content, endSeason, place, rejects, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });

const start = (
  rows: string[],
  season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring',
  c = W,
): RunState => scenario(rows, { content: c, season, citizens: 30, stores: { food: 500 } });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, W), s);
const end = (s: RunState) => endSeason(s, W);
/** Ends the season without taking any branching choice (the helper would take the first). */
const endOnly = (s: RunState) => {
  const picked =
    s.draft.offer.length > 0 && s.draft.picked === null
      ? { ...s, draft: { ...s.draft, offer: [] } }
      : s;
  return act(picked, { type: 'endSeason' }, W);
};
const typeAt = (s: RunState, col: number, row: number) => s.buildings[uidAt(s, col, row)]!.type;
const water = (s: RunState): WaterReport => s.lastReport!.water!;

describe('Food Forest', () => {
  const MEADOWS = ['~ f m m m', '~ f m m m', '~ f m , C'];

  it('an orchard next to an apiary and 2 meadow tiles becomes one', () => {
    let s = build(start(MEADOWS), 'orchard', [[2, 1]]);
    s = build(s, 'apiary', [[3, 1]]);
    s = end(s);
    expect(typeAt(s, 2, 1)).toBe('foodForest');
    expect(s.lastReport!.evolved).toEqual([
      { uid: uidAt(s, 2, 1), from: 'orchard', into: 'foodForest' },
    ]);
    expect(s.lastReport!.discoveries).toContain('foodForest');
    expect(harmonyLines(W, s)).toContainEqual({ label: '1 Food Forest', amount: 2 });
  });

  it('not without the apiary', () => {
    const s = end(build(start(MEADOWS), 'orchard', [[2, 1]]));
    expect(typeAt(s, 2, 1)).toBe('orchard');
  });

  it('makes food in winter with no worker', () => {
    let s = build(start(MEADOWS, 'autumn'), 'orchard', [[2, 1]]);
    s = build(s, 'apiary', [[3, 1]]);
    s = end(s);
    s = end(s); // winter
    expect(s.lastReport!.yields[uidAt(s, 2, 1)]?.food).toBe(1);
  });
});

describe('Aquaponics Hall and the Winter Garden branch', () => {
  // A fish pond at (1,1) by the river; a greenhouse at (2,1) next to it.
  const POND = ['~ f m m m m', '~ f m m m m', '~ f m , C ,'];
  const powered = (s: RunState) =>
    build(s, 'solarCanopy', [
      [4, 0],
      [5, 0],
    ]);

  it('a greenhouse next to a fish pond becomes one, watered by the pond', () => {
    let s = powered(start(POND));
    s = build(s, 'fishPond', [[1, 1]]);
    s = build(s, 'greenhouse', [[2, 1]]);
    s = end(s);
    expect(typeAt(s, 2, 1)).toBe('aquaponicsHall');
    s = end(s);
    const hall = uidAt(s, 2, 1);
    expect(water(s).uses[hall]).toMatchObject({
      from: 'pond',
      got: { clean: 0, nutrient: 1, grey: 0 },
      short: false,
    });
    expect(s.lastReport!.yields[hall]?.food).toBe(4);
  });

  it('next to a heat well too, the player chooses, and the season waits for it', () => {
    let s = powered(start(POND));
    s = build(s, 'fishPond', [[1, 1]]);
    s = build(s, 'greenhouse', [[2, 1]]);
    s = build(s, 'heatWell', [[3, 1]]);
    s = endOnly(s);
    const uid = uidAt(s, 2, 1);
    expect(s.evolutionOffer).toEqual([{ uid, options: ['winterGarden', 'aquaponicsHall'] }]);
    expect(typeAt(s, 2, 1)).toBe('greenhouse');
    const drafted = { ...s, draft: { ...s.draft, offer: [] } };
    expect(rejects(drafted, { type: 'endSeason' }, W)).toMatch(
      /choose what the Greenhouse becomes/,
    );
    expect(rejects(s, { type: 'chooseEvolution', uid, combo: 'foodForest' }, W)).toMatch(
      /not one of its evolutions/,
    );
    s = act(s, { type: 'chooseEvolution', uid, combo: 'aquaponicsHall' }, W);
    expect(typeAt(s, 2, 1)).toBe('aquaponicsHall');
    expect(s.evolutionOffer).toEqual([]);
    s = endOnly(s);
    expect(s.lastReport!.discoveries).toContain('aquaponicsHall');
  });

  it('joins the River Loop in the greenhouse link', () => {
    const loop = content.comboById.riverLoop!;
    if (loop.layer !== 'chain') throw new Error('riverLoop is a chain');
    expect(loop.links[1]!.buildings).toContain('aquaponicsHall');
  });
});

describe('Canal-top Solar', () => {
  const VALLEY = ['~ f . . . .', '~ f m m m m', '~ f m m m m', '~ f m m m m', '~ f , , C ,'];
  const lay = (s: RunState) =>
    build(s, 'irrigationChannel', [
      [1, 2],
      [2, 2],
      [3, 2],
      [4, 2],
    ]);

  it('a solar canopy built on a channel becomes one; water still flows, none evaporates', () => {
    let s = lay(start(VALLEY, 'summer'));
    s = build(s, 'floodplainFarm', [[4, 1]]);
    s = build(s, 'solarCanopy', [[2, 2]]);
    expect(typeAt(s, 2, 2)).toBe('canalTopSolar');
    s = end(s);
    const ch = water(s).channels[0]!;
    expect(ch.tiles).toHaveLength(4);
    expect(ch.evaporated).toBe(0);
    expect(water(s).uses[uidAt(s, 4, 1)]!.short).toBe(false);
    // A canopy makes 4 by day in summer; over water, 5.
    expect(s.lastReport!.generated[uidAt(s, 2, 2)]!.energy.day).toBe(5);
  });

  it('without it, the channel loses 1 in summer', () => {
    let s = lay(start(VALLEY, 'summer'));
    s = build(s, 'floodplainFarm', [[4, 1]]);
    s = end(s);
    expect(water(s).channels[0]!.evaporated).toBe(1);
  });
});

describe('Beaver Dam', () => {
  // 25 woodland tiles: Harmony 50.
  const WILD = ['~ W W W W W', '~ W W W W W', '~ W W W W W', '~ W W W W W', '~ W W W W C'];
  const TAME = ['~ W , , , ,', '~ W , , , ,', '~ W , , , ,', '~ W , , , ,', '~ W , , , C'];

  it('a weir next to woodland becomes one once Harmony reaches 50, and reed beds spread', () => {
    // A small settlement, so it lasts the year with no homes built.
    let s = scenario(WILD, { content: W, citizens: 4, stores: { food: 500 } });
    s = build(s, 'weir', [[0, 3]]);
    expect(s.harmony).toBeGreaterThanOrEqual(50);
    s = end(s);
    expect(typeAt(s, 0, 3)).toBe('beaverDam');
    expect(harmonyLines(W, s)).toContainEqual({ label: '1 Beaver Dam', amount: 2 });
    const reeds = (x: RunState) => Object.values(x.buildings).filter((b) => b.type === 'reedBed');
    expect(reeds(s)).toHaveLength(0);
    for (let i = 0; i < 3; i++) s = end(s); // to next spring
    expect(s.season).toBe('spring');
    expect(reeds(s)).toHaveLength(1);
    const reed = reeds(s)[0]!;
    const reservoir = Object.values(s.map.tiles).filter((t) => t.type === 'reservoir');
    expect(reservoir.some((t) => Math.abs(t.q - reed.at.q) + Math.abs(t.r - reed.at.r) <= 2)).toBe(
      true,
    );
  });

  it('not while Harmony is under 50', () => {
    let s = build(start(TAME), 'weir', [[0, 3]]);
    expect(s.harmony).toBeLessThan(50);
    s = end(s);
    expect(typeAt(s, 0, 3)).toBe('weir');
  });
});

describe('Singing Spire', () => {
  const HILL = ['~ f , ^ , ,', '~ f , , , ,', '~ f , C , ,'];

  it('a wind spire with pollinator meadows on 2 sides becomes one: +1 wellbeing, no penalty', () => {
    let s = build(start(HILL), 'windSpire', [[3, 0]]);
    s = build(s, 'pollinatorMeadow', [
      [2, 0],
      [4, 0],
    ]);
    s = end(s);
    expect(typeAt(s, 3, 0)).toBe('singingSpire');
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual(
      expect.objectContaining({ reason: 'Singing Spire', amount: 1 }),
    );
    expect(harmonyLines(W, s).some((l) => l.amount < 0 && /Spire/.test(l.label))).toBe(false);
  });

  it('not with one meadow', () => {
    let s = build(start(HILL), 'windSpire', [[3, 0]]);
    s = build(s, 'pollinatorMeadow', [[2, 0]]);
    s = end(s);
    expect(typeAt(s, 3, 0)).toBe('windSpire');
  });
});

describe('Old World Archive and the Rewilded Ruin branch', () => {
  const RUIN = ['~ f R , ,', '~ f , , ,', '~ f , C ,'];
  const emptied = (s: RunState) => {
    s.map.tiles[hexKey(at(2, 0))]!.salvage = 0;
    return s;
  };

  it('an empty salvage yard next to a library offers the choice', () => {
    let s = build(start(RUIN), 'salvageYard', [[2, 0]]);
    s = emptied(build(s, 'seedbankLibrary', [[3, 0]]));
    s = endOnly(s);
    const uid = uidAt(s, 2, 0);
    expect(s.evolutionOffer).toEqual([{ uid, options: ['rewildedRuin', 'oldWorldArchive'] }]);
    s = act(s, { type: 'chooseEvolution', uid, combo: 'oldWorldArchive' }, W);
    s = endOnly(s);
    expect(typeAt(s, 2, 0)).toBe('oldWorldArchive');
    expect(s.lastReport!.yields[uid]?.knowledge).toBe(2);
  });

  it('without a library, it rewilds as before', () => {
    let s = emptied(build(start(RUIN), 'salvageYard', [[2, 0]]));
    s = endOnly(s);
    expect(s.evolutionOffer).toEqual([]);
    expect(typeAt(s, 2, 0)).toBe('rewildedRuin');
  });

  it('without water, a library makes no difference: only the Rewilded Ruin', () => {
    let s = scenario(RUIN, { citizens: 30, stores: { food: 500 } });
    s = place(s, 'salvageYard', 2, 0);
    s = emptied(place(s, 'seedbankLibrary', 3, 0));
    s = act(s, { type: 'endSeason' });
    expect(s.evolutionOffer).toEqual([]);
    expect(typeAt(s, 2, 0)).toBe('rewildedRuin');
  });
});

describe('Coppice Wood (a player action)', () => {
  const GROVE = ['~ f W W ,', '~ f , , ,', '~ f , C ,'];
  const coppice = (s: RunState, col: number, row: number) =>
    act(s, { type: 'coppice', at: at(col, row) }, W);
  const count = (s: RunState, type: string) =>
    Number(
      harmonyLines(W, s)
        .find((l) => l.label.includes(` ${type} tiles`))
        ?.label.split(' ')[0] ?? 0,
    );

  it('needs woodland with a workshop next to it', () => {
    const s = start(GROVE);
    expect(rejects(s, { type: 'coppice', at: at(2, 0) }, W)).toMatch(/needs a Workshop next to it/);
    const w = build(s, 'workshop', [[2, 1]]);
    expect(rejects(w, { type: 'coppice', at: at(3, 1) }, W)).toMatch(/only woodland/);
    expect(rejects(s, { type: 'coppice', at: at(2, 0) })).toMatch(/needs the water system/);
  });

  it('makes 2 materials a season and counts as meadow, not woodland, for Harmony', () => {
    let s = build(start(GROVE), 'workshop', [[2, 1]]);
    const woods = count(s, 'woodland');
    s = coppice(s, 2, 0);
    expect(typeAt(s, 2, 0)).toBe('coppiceWood');
    expect(count(s, 'woodland')).toBe(woods - 1);
    expect(s.map.tiles[hexKey(at(2, 0))]!.type).toBe('woodland');
    s = end(s);
    expect(s.lastReport!.yields[uidAt(s, 2, 0)]?.materials).toBe(2);
    expect(s.lastReport!.discoveries).toContain('coppiceWood');
    expect(rejects(s, { type: 'demolish', uid: uidAt(s, 2, 0) }, W)).toMatch(/stop coppicing/);
  });

  it('stopped, it grows back into woodland after 2 seasons', () => {
    // Solar for the workshop's day energy, so a blackout doesn't wear the crowded camp down.
    let s = build(build(start(GROVE), 'workshop', [[2, 1]]), 'solarCanopy', [[4, 1]]);
    s = coppice(s, 2, 0);
    s = end(s);
    const uid = uidAt(s, 2, 0);
    s = act(s, { type: 'stopCoppice', uid }, W);
    expect(typeAt(s, 2, 0)).toBe('coppiceRegrowth');
    s = end(s);
    expect(s.buildings[uid]).toBeDefined();
    expect(s.lastReport!.yields[uid]?.materials ?? 0).toBe(0);
    s = end(s);
    expect(s.buildings[uid]).toBeUndefined();
    expect(s.map.tiles[hexKey(at(2, 0))]!.type).toBe('woodland');
  });
});
