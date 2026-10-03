/**
 * The Highland's combos (proposals/highland.md, Combos; HL3): each triggers in
 * a test. Also its stove fuel, the snow fence over the panels, and its
 * tunings and charters.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent, highland, loadBiome } from '../src/content';
import { harmonyLines, hexKey, type Hex, type RunState } from '../src/sim';
import { loopLift } from '../src/sim/combos';
import { applyModifiers } from '../src/sim/content/modifiers';
import { stormExposed } from '../src/sim/queries';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

const HIGH = biomeContent('highland');
/** The Highland with no channel dug for the camp, so a test lays its own. */
const HIGH0 = (() => {
  const raw = structuredClone(highland) as { rules: { water: { campChannel: number } } };
  raw.rules.water.campChannel = 0;
  return loadBiome(raw);
})();
type Season = 'spring' | 'summer' | 'autumn' | 'winter';

const start = (
  rows: string[],
  heights: string[],
  season: Season = 'summer',
  c = HIGH,
  stores: Partial<RunState['stores']> = { food: 60, biomass: 20 },
) =>
  scenario(rows, {
    content: c,
    season,
    heights,
    citizens: 14,
    stores,
    run: { water: true },
  });
const build = (s: RunState, id: string, cells: [number, number][], c = HIGH) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, c), s);
/** A building only an evolution or an action makes (a coppice wood), set down for a test. */
const put = (s: RunState, type: string, col: number, row: number): RunState => {
  const uid = `b${s.nextUid}`;
  return {
    ...s,
    nextUid: s.nextUid + 1,
    buildings: { ...s.buildings, [uid]: { uid, type, at: at(col, row), builtTurn: s.turn } },
    priority: [...s.priority, uid],
  };
};
const end = (s: RunState, c = HIGH) => endSeason({ ...s, stores: { ...s.stores, food: 60 } }, c);
const hits = (s: RunState, combo: string) => s.lastReport!.combos.filter((h) => h.combo === combo);
const typeAt = (s: RunState, c: number, r: number) => s.buildings[uidAt(s, c, r)]!.type;
const math = (s: RunState, c: number, r: number) =>
  (s.lastReport!.math[uidAt(s, c, r)] ?? []).join(' | ');
const loops = (s: RunState) => s.loops.map((l) => l.combo);

// The glen floor: the stream down column 0, level land at height 0.
const FLOOR = ['~ , , , ,', '~ , , , ,', '~ C , , ,', '~ , , , ,'];
const FLAT = ['0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0', '0 0 0 0 0'];

describe('adjacency', () => {
  it('Busy Bees: an apiary next to a glen farm, +1 food', () => {
    let s = build(start(FLOOR, FLAT), 'glenFarm', [[1, 0]]);
    s = build(s, 'apiary', [[2, 0]]);
    s = end(s);
    expect(hits(s, 'busyBees')).toHaveLength(1);
    expect(math(s, 1, 0)).toMatch(/apiary|Apiary/);
  });

  it('Hearth Stones: a bothy next to a heat well burns no biomass', () => {
    const fuel = (well: boolean) => {
      let s = build(start(FLOOR, FLAT, 'winter'), 'bothy', [[3, 0]]);
      if (well) s = build(s, 'heatWell', [[4, 0]]);
      const before = s.stores.biomass;
      s = end(s);
      return { s, burned: before - s.stores.biomass, math: math(s, 3, 0) };
    };
    const alone = fuel(false);
    expect(alone.math).toContain('its stove burned 1 biomass');
    const beside = fuel(true);
    expect(beside.math).toContain('its stove needs no biomass');
    expect(hits(beside.s, 'hearthStones')).toHaveLength(1);
  });

  it('High Pasture: a shieling next to 2 meadows makes +1 food in summer', () => {
    const TOPS = ['m m m', 'm m m', ', C ,'];
    const UP = ['3 3 3', '3 3 3', '1 1 1'];
    let s = build(start(TOPS, UP), 'shieling', [[1, 0]]);
    s = end(s);
    expect(hits(s, 'highPasture')).toHaveLength(1);
    expect(math(s, 1, 0)).toContain('+1 next to');
  });
});

describe('chains', () => {
  it('Kitchen Loop: a composter beside a working glen farm', () => {
    let s = build(start(FLOOR, FLAT), 'glenFarm', [[1, 0]]);
    s = build(s, 'composter', [[2, 0]]);
    s = end(s);
    expect(loops(s)).toContain('kitchenLoop');
  });

  it('Gas Loop and Mushroom Loop: a digester or a mushroom cellar beside a working glen farm', () => {
    let s = build(start(FLOOR, FLAT, 'summer', HIGH0), 'glenFarm', [[1, 0]], HIGH0);
    s = build(s, 'biogasDigester', [[2, 0]], HIGH0);
    s = build(s, 'mushroomCellar', [[1, 1]], HIGH0);
    s = end(s, HIGH0);
    expect(loops(s)).toContain('gasLoop');
    expect(loops(s)).toContain('mushroomLoop');
  });

  it('Carbon Loop: coppice wood, a biochar kiln and a farm in a chain of neighbours', () => {
    let s = put(start(FLOOR, FLAT), 'coppiceWood', 3, 0);
    s = build(s, 'biocharKiln', [[2, 0]]);
    s = build(s, 'glenFarm', [[1, 0]]);
    s = end(s);
    expect(loops(s)).toContain('carbonLoop');
    // From the next season on, the farm makes 1 more.
    s = end(s);
    expect(math(s, 1, 0)).toContain('from the Carbon Loop');
  });

  it('Meltwater Loop: a rewetted bog, a pump station and a terrace; the pump lifts 1 more', () => {
    // A step up from the stream at height 1; a channel from it to the pump.
    const BOG = ['~ , , b', '~ , , ,', '~ C , ,'];
    const ONE = ['1 1 1 1', '1 1 1 1', '1 1 1 1'];
    let s = start(BOG, ONE, 'summer', HIGH0);
    s = build(s, 'irrigationChannel', [[1, 0]], HIGH0);
    s = build(s, 'pumpStation', [[2, 0]], HIGH0);
    s = build(s, 'rewettedBog', [[3, 0]], HIGH0);
    s = build(s, 'terraceFarm', [[2, 1]], HIGH0);
    s = end(s, HIGH0);
    expect(loops(s)).toContain('meltwaterLoop');
    expect(loopLift(HIGH0, s, uidAt(s, 2, 0))).toBe(1);
    expect(harmonyLines(HIGH0, s)).toContainEqual({ label: 'Meltwater Loop', amount: 1 });
    s = end(s, HIGH0);
    expect(math(s, 2, 1)).toContain('from the Meltwater Loop');
  });
});

describe('formations', () => {
  it('Water Stair: a pump with 2 terraces climbing straight up from it, +1 food each', () => {
    const STAIR = ['~ , , , ,', '~ , , , ,', '~ C , , ,'];
    const STEPS = ['0 0 0 0 0', '0 0 1 2 2', '0 0 0 0 0'];
    let s = start(STAIR, STEPS, 'summer', HIGH0);
    s = build(s, 'irrigationChannel', [[1, 0]], HIGH0);
    s = build(s, 'pumpStation', [[1, 1]], HIGH0);
    s = build(
      s,
      'terraceFarm',
      [
        [2, 1],
        [3, 1],
      ],
      HIGH0,
    );
    s = end(s, HIGH0);
    expect(hits(s, 'waterStair')).toHaveLength(1);
    expect(math(s, 3, 1)).toContain('from the Water Stair');
    // On level ground it is no stair.
    let flat = start(
      STAIR,
      STEPS.map((r) => r.replace(/2/g, '1')),
      'summer',
      HIGH0,
    );
    flat = build(flat, 'irrigationChannel', [[1, 0]], HIGH0);
    flat = build(flat, 'pumpStation', [[1, 1]], HIGH0);
    flat = build(
      flat,
      'terraceFarm',
      [
        [2, 1],
        [3, 1],
      ],
      HIGH0,
    );
    expect(hits(end(flat, HIGH0), 'waterStair')).toHaveLength(0);
  });

  it('Snow Line: 4 snow fences end to end shelter everything within 2 from gales', () => {
    const TOPS = ['m m m m m', 'm m m m m', 'm m m m m', ', , C , ,'];
    const UP = ['3 3 3 3 3', '3 3 3 3 3', '3 3 3 3 3', '1 1 1 1 1'];
    let s = build(start(TOPS, UP, 'autumn'), 'shieling', [[4, 0]]);
    const shieling = () => s.buildings[uidAt(s, 4, 0)]!;
    expect(stormExposed(HIGH, s, shieling())).toBe(true);
    // Fences along 4 sides of the tile at (2,1).
    const c: Hex = at(2, 1);
    const sides = [
      [1, 0],
      [1, -1],
      [0, -1],
      [-1, 0],
    ];
    for (const [dq, dr] of sides)
      s = act(s, { type: 'plantHedge', a: c, b: { q: c.q + dq!, r: c.r + dr! } }, HIGH);
    expect(stormExposed(HIGH, s, shieling())).toBe(false);
    s = end(s);
    expect(hits(s, 'snowLine')).toHaveLength(1);
  });

  it('Ridge Spires: 3 wind spires in a row at height 2 or more, +1 energy each and no Harmony cost', () => {
    const RIDGE = ['. . . .', '. . . .', ', C , ,'];
    const spires = (h: string) => {
      let s = build(start(RIDGE, [`${h} ${h} ${h} ${h}`, '1 1 1 1', '1 1 1 1']), 'windSpire', [
        [0, 0],
        [1, 0],
        [2, 0],
      ]);
      s = end(s);
      return s;
    };
    const high = spires('2');
    expect(hits(high, 'ridgeSpires')).toHaveLength(1);
    expect(math(high, 1, 0)).toMatch(/formation \+1/);
    expect(harmonyLines(HIGH, high).some((l) => l.label.includes('Wind Spire'))).toBe(false);
    const low = spires('1');
    expect(hits(low, 'ridgeSpires')).toHaveLength(0);
    expect(harmonyLines(HIGH, low).some((l) => l.label.includes('Wind Spire'))).toBe(true);
  });

  it('Sun Terrace: 3 solar canopies in a row on the slopes', () => {
    const SLOPE = ['. . . .', '. . . .', ', C , ,'];
    let s = build(start(SLOPE, ['1 1 1 1', '1 1 1 1', '1 1 1 1']), 'solarCanopy', [
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
    s = end(s);
    expect(hits(s, 'sunTerrace')).toHaveLength(1);
  });

  it('Keyhole Garden: a composter with 3 farms beside it doubles its compost', () => {
    let s = build(start(FLOOR, FLAT, 'summer', HIGH0), 'composter', [[2, 1]], HIGH0);
    s = build(
      s,
      'glenFarm',
      [
        [2, 0],
        [1, 1],
        [3, 1],
      ],
      HIGH0,
    );
    s = end(s, HIGH0);
    expect(hits(s, 'keyholeGarden')).toHaveLength(1);
  });
});

describe('evolutions', () => {
  it('Hanging Garden: a terrace next to 2 terraces and a pollinator meadow', () => {
    const SLOPE = ['~ , , , ,', '~ , , , ,', '~ , , C ,'];
    const ONE = ['1 1 1 1 1', '1 1 1 1 1', '1 1 1 1 1'];
    let s = build(
      start(SLOPE, ONE, 'summer', HIGH0),
      'terraceFarm',
      [
        [2, 0],
        [3, 0],
        [2, 1],
      ],
      HIGH0,
    );
    s = build(s, 'pollinatorMeadow', [[1, 1]], HIGH0);
    s = end(s, HIGH0);
    expect(typeAt(s, 2, 1)).toBe('hangingGarden');
    expect(HIGH.byId.hangingGarden!.workers).toBe(0);
  });

  it('Cascade: 2 hill turbines next to each other down the stream', () => {
    const STREAM = ['~ , ,', '~ , ,', '~ , C'];
    const ONE = ['2 1 1', '1 1 1', '1 1 1'];
    let s = build(
      start(STREAM, ONE, 'summer', HIGH0),
      'hillTurbine',
      [
        [1, 0],
        [1, 1],
      ],
      HIGH0,
    );
    s = end(s, HIGH0);
    expect(typeAt(s, 1, 0)).toBe('cascade');
    expect(typeAt(s, 1, 1)).toBe('cascade');
  });

  it('Bat Roost: a salvage yard whose old mine is empty', () => {
    const MINE = [', , R', ', , ,', ', C ,'];
    const UP = ['1 1 1', '1 1 1', '1 1 1'];
    let s = build(start(MINE, UP), 'salvageYard', [[2, 0]]);
    s.map.tiles[hexKey(at(2, 0))]!.salvage = 0;
    s = end(s);
    expect(typeAt(s, 2, 0)).toBe('batRoost');
    expect(HIGH.byId.rewildedRuin).toBeUndefined();
  });
});

describe('the stove and the fence', () => {
  it('a bothy with no biomass for its stove goes cold', () => {
    let s = build(start(FLOOR, FLAT, 'winter', HIGH, { food: 60, biomass: 0 }), 'bothy', [[3, 0]]);
    s = end(s);
    expect(math(s, 3, 0)).toContain('no biomass for its stove');
    expect(s.lastReport!.cold).toContain(uidAt(s, 3, 0));
  });

  it('a solar canopy up high in winter keeps 1 by day beside a snow fence', () => {
    const TOPS = ['. . .', '. . .', ', C ,'];
    const UP = ['2 2 2', '2 2 2', '0 0 0'];
    let s = build(start(TOPS, UP, 'winter'), 'solarCanopy', [[1, 0]]);
    s = act(s, { type: 'plantHedge', a: at(1, 0), b: at(2, 0) }, HIGH);
    s = end(s);
    expect(math(s, 1, 0)).toContain('a fence keeps the drift off: 1 by day');
    expect(s.lastReport!.energy.day.bySource.solarCanopy).toBe(1);
  });
});

describe('tunings and charters', () => {
  it('each Highland card changes what it says', () => {
    const own = [
      'deeperHeatWells',
      'dryStoneTerraces',
      'hardyOats',
      'steeperWheels',
      'thickWalls',
      'woolTrade',
      'widerWatch',
      'strongerPumps',
      'mountainRescue',
      'hearthKeepers',
    ];
    const cards = [...HIGH.tunings, ...HIGH.charters];
    for (const id of own) {
      const card = cards.find((c) => c.id === id)!;
      expect(card, id).toBeDefined();
      const changed = applyModifiers(HIGH, card.modifiers);
      expect(JSON.stringify(changed.buildings) + JSON.stringify(changed.events), id).not.toBe(
        JSON.stringify(HIGH.buildings) + JSON.stringify(HIGH.events),
      );
    }
    const kept = applyModifiers(HIGH, cards.find((c) => c.id === 'hearthKeepers')!.modifiers);
    expect(kept.byId.bothy!.heatFuel!.amount).toBe(0);
    const rescue = applyModifiers(HIGH, cards.find((c) => c.id === 'mountainRescue')!.modifiers);
    expect(rescue.events.storm!.disableCount).toBe(0);
  });
});
