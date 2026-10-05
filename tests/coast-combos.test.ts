/**
 * The Windswept Coast's combos (proposals/windswept-coast.md, Combos; B3):
 * each triggers in a test.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { harmonyLines, hexKey, type RunState } from '../src/sim';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const COAST = biomeContent('windsweptCoast');
type Season = 'spring' | 'summer' | 'autumn' | 'winter';
const start = (rows: string[], season: Season = 'spring', water = false) =>
  scenario(rows, {
    content: COAST,
    season,
    citizens: 12,
    stores: { food: 40, biomass: 20 },
    run: water ? { water: true } : {},
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, COAST), s);
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 40 } }, COAST);
const hits = (s: RunState, combo: string) => s.lastReport!.combos.filter((h) => h.combo === combo);
const typeAt = (s: RunState, c: number, r: number) => s.buildings[uidAt(s, c, r)]!.type;
const math = (s: RunState, c: number, r: number) =>
  (s.lastReport!.math[uidAt(s, c, r)] ?? []).join(' | ');

// The shore: dunes and mudflat between the land and the sea.
const SHORE = [', , : _ = =', ', , : _ = =', ', C : _ = =', ', , : _ = ='];

describe('adjacency', () => {
  it('Shellfish Beds: an oyster reef and a kelp farm side by side, +1 food each', () => {
    let s = build(start(SHORE, 'summer'), 'oysterReef', [[3, 0]]);
    s = build(s, 'kelpFarm', [[4, 0]]);
    s = end(s);
    expect(hits(s, 'shellfishBeds')).toHaveLength(1);
    expect(math(s, 3, 0)).toMatch(/\+1/);
    expect(math(s, 4, 0)).toMatch(/\+1/);
  });

  it('Lee of the Dunes: dune grass beside a building keeps the gale off it', () => {
    const HEAD = [', , , , = =', ', ^ ^ ^ = =', ', , : : = =', ', C , , = ='];
    const exposed = (grass: boolean) => {
      let s = build(start(HEAD, 'autumn'), 'windSpire', [[3, 1]]);
      if (grass) s = build(s, 'duneGrass', [[3, 2]]);
      s = end(s);
      return s.lastReport!.exposed.includes(uidAt(s, 3, 1));
    };
    expect(exposed(false)).toBe(true);
    expect(exposed(true)).toBe(false);
  });
});

describe('chains', () => {
  it('Kelp Loop: kelp farm, composter and croft in a chain of neighbours', () => {
    const COVE = [', , , , = =', ', , , : = =', ', C , : = =', ', , , , = ='];
    let s = build(start(COVE), 'croft', [[2, 2]]);
    s = build(s, 'composter', [[3, 2]]);
    s = build(s, 'kelpFarm', [[4, 2]]);
    s = end(s);
    expect(s.loops.map((l) => l.combo)).toContain('kelpLoop');
  });

  it('Sweetwater Loop: tide turbine, desalinator and greenhouse in a chain of neighbours', () => {
    const POINT = [', , , _ = =', ', , , : = =', ', C , , = =', ', , , , = ='];
    let s = build(start(POINT, 'spring', true), 'tideTurbine', [[4, 0]]);
    s = build(s, 'desalinator', [[3, 1]]);
    s = build(s, 'greenhouse', [[2, 1]]);
    s = end(s);
    expect(s.loops.map((l) => l.combo)).toContain('sweetwaterLoop');
  });

  it('Shore Loop: a bathhouse, an oyster reef that cleans its water, and a kelp farm', () => {
    // A stream on the west; a channel from it along row 1 to the reef on the mudflat.
    const BAY = ['~ , , , _ =', '~ , , , _ =', '~ C , , _ =', '~ , , , _ ='];
    let s = start(BAY, 'spring', true);
    // The camp starts with a channel from the stream ending at (1,1); extend it to the reef.
    s = build(s, 'irrigationChannel', [
      [2, 0],
      [3, 0],
    ]);
    s = build(s, 'bathhouse', [[3, 1]]);
    s = build(s, 'oysterReef', [[4, 0]]);
    s = build(s, 'kelpFarm', [[5, 0]]);
    s = build(s, 'solarCanopy', [
      [2, 3],
      [3, 3],
    ]);
    s = end(s);
    expect(s.lastReport!.water!.cleaned[uidAt(s, 4, 0)] ?? 0).toBeGreaterThan(0);
    expect(s.loops.map((l) => l.combo)).toContain('shoreLoop');
  });

  it('Kitchen Loop: a composter among crofts', () => {
    let s = build(start(SHORE), 'croft', [[1, 0]]);
    s = build(s, 'composter', [[1, 1]]);
    s = end(s);
    expect(s.loops.map((l) => l.combo)).toContain('kitchenLoop');
  });
});

describe('formations', () => {
  const SEA_ROW = ['= = = = = =', ', " " " , =', ', C , , , =', ', , , , , ='];

  it('Breakwater: 3 sea walls in a line, +2 Harmony', () => {
    let s = build(start(SEA_ROW), 'seaWall', [
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    s = end(s);
    expect(hits(s, 'breakwater')).toHaveLength(1);
    expect(harmonyLines(COAST, s)).toContainEqual({ label: 'Breakwater', amount: 2 });
  });

  it('Dune Line: 4 dune grass in a line shelters what is within 2 from gales', () => {
    const DUNES = ['= = = = = = =', ', : : : : , =', ', C , , , , =', ', , , , , , ='];
    let s = build(start(DUNES, 'autumn'), 'duneGrass', [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
    ]);
    s = build(s, 'kelpFarm', [[2, 0]]);
    s = end(s);
    expect(hits(s, 'duneLine')).toHaveLength(1);
    expect(s.lastReport!.exposed).not.toContain(uidAt(s, 2, 0));
  });

  it('Wind Ridge: 3 wind spires in a row on headlands, +1 energy each', () => {
    const HEAD = [', , , , = =', ', ^ ^ ^ = =', ', , , , = =', ', C , , = ='];
    let s = build(start(HEAD, 'summer'), 'windSpire', [
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    s = end(s);
    expect(hits(s, 'windRidge')).toHaveLength(1);
    expect(math(s, 2, 1)).toMatch(/formation \+1/);
  });
});

describe('evolutions', () => {
  it('Machair Croft: a croft next to 2 dune grass', () => {
    const MACHAIR = [', , , =', ', : : =', ', C , =', ', , , ='];
    let s = build(start(MACHAIR), 'croft', [[2, 2]]);
    s = build(s, 'duneGrass', [
      [1, 1],
      [2, 1],
    ]);
    s = end(s);
    expect(typeAt(s, 2, 2)).toBe('machairCroft');
    expect(COAST.byId.machairCroft!.saltProof).toBe(true);
  });

  it('Kelp Forest: a kelp farm next to 2 oyster reefs', () => {
    let s = build(start(SHORE), 'oysterReef', [
      [3, 0],
      [3, 1],
    ]);
    s = build(s, 'kelpFarm', [[4, 0]]);
    s = end(s);
    expect(typeAt(s, 4, 0)).toBe('kelpForest');
  });

  it('Rock Pool: an emptied salvage yard by the shore, or a Rewilded Ruin; the player chooses', () => {
    const HARBOUR = [', R : =', ', , : =', ', C , =', ', , , ='];
    let s = build(start(HARBOUR), 'salvageYard', [[1, 0]]);
    s.map.tiles[hexKey(at(1, 0))]!.salvage = 0;
    s = end(s);
    const uid = uidAt(s, 1, 0);
    expect(s.evolutionOffer).toEqual([{ uid, options: ['rockPool', 'rewildedRuin'] }]);
    s = act(s, { type: 'chooseEvolution', uid, combo: 'rockPool' }, COAST);
    expect(typeAt(s, 1, 0)).toBe('rockPool');
  });

  it('Rewilded Ruin: an emptied salvage yard inland', () => {
    const INLAND = [', , , R', ', , , ,', ', C , ,', ', , , ,'];
    let s = build(start(INLAND), 'salvageYard', [[3, 0]]);
    s.map.tiles[hexKey(at(3, 0))]!.salvage = 0;
    s = end(s);
    expect(s.evolutionOffer).toEqual([]);
    expect(typeAt(s, 3, 0)).toBe('rewildedRuin');
  });
});

describe('desalinated water down a channel', () => {
  // No river: the only fresh water is what the desalinator makes from the sea.
  const DRY = [', , , , : =', ', , , , : =', ', C , , : =', ', , , , : ='];
  const plant = (power = true) => {
    let s = build(start(DRY, 'spring', true), 'desalinator', [[4, 1]]);
    if (power)
      s = build(s, 'solarCanopy', [
        [0, 3],
        [1, 3],
      ]);
    return s;
  };

  it('a new channel may start beside a desalinator, and nowhere else away from water', () => {
    const channel = { type: 'place' as const, building: 'irrigationChannel', at: at(3, 1) };
    expect(rejects(start(DRY, 'spring', true), channel, COAST)).toBe(
      'a new channel must start next to the river, a reservoir or a desalinator',
    );
    expect(() => act(plant(), channel, COAST)).not.toThrow();
  });

  it('its water runs from the desalinator down the channel to a croft inland', () => {
    const lay = (channel: boolean) => {
      let s = plant();
      if (channel)
        s = build(s, 'irrigationChannel', [
          [3, 1],
          [2, 1],
        ]);
      s = build(s, 'croft', [[1, 1]]);
      return end(s);
    };
    const s = lay(true);
    const water = s.lastReport!.water!;
    const croft = water.uses[uidAt(s, 1, 1)]!;
    expect(croft).toMatchObject({ need: 1, from: 'channel', short: false });
    expect(croft.got.clean).toBe(1);
    expect(water.channels.find((c) => c)!.intake).toEqual({ source: uidAt(s, 4, 1) });
    expect(water.in['Desalinator']).toBe(2);
    // Without the channel the croft, 3 tiles from the desalinator, gets nothing.
    const dry = lay(false);
    expect(dry.lastReport!.water!.uses[uidAt(dry, 1, 1)]!.short).toBe(true);
  });
});
