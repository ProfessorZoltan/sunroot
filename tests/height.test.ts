/**
 * Height (Milestone 12, HL1; proposals/highland.md, Height): tiles rise in
 * steps from the valley floor. A channel carries water up a step only as far
 * as the pump stations beside it lift it; homes high up need more heat on
 * autumn and winter nights; wind spires up high make more; panels up high
 * are snowed under in winter. Land without heights plays as before.
 */
import { describe, expect, it } from 'vitest';
import { loadBiome, willowReach } from '../src/content';
import { heatDemand } from '../src/sim/queries';
import type { RunState, Season } from '../src/sim';
import { endSeason, place, scenario, uidAt } from './helpers';

/** Willow Reach, with water on, a Pump Station and the Highland's height rules. */
function highReach() {
  const raw = structuredClone(willowReach) as {
    rules: { water: { enabled: boolean; campChannel: number } };
    buildings: Record<string, unknown>[];
  };
  raw.rules.water.enabled = true;
  raw.rules.water.campChannel = 0;
  raw.buildings.push({
    id: 'pumpStation',
    name: 'Pump Station',
    cost: 6,
    workers: 0,
    kind: 'water',
    placement: {
      tiles: ['floodplain', 'hill', 'barren', 'scrub', 'meadow', 'woodland'],
      adjacentTo: [],
      adjacentToBuildings: ['irrigationChannel'],
    },
    pump: { lift: 2 },
    demand: { energy: { day: [2, 2, 2, 2] } },
  });
  const def = (id: string) => raw.buildings.find((b) => b.id === id)!;
  def('cottage').heatAtHeight = { from: 2, add: 1, seasons: ['autumn', 'winter'] };
  def('windSpire').generationAtHeight = { from: 2, add: 1 };
  def('solarCanopy').idleAtHeight = { from: 2, seasons: ['winter'] };
  return loadBiome(raw);
}
const H = highReach();

// The river down the left; a channel will run east along row 1, up a step at column 3.
const GLEN = ['~ m m m m m m', '~ , , , , , ,', '~ m m m m m m', '~ , , C , , ,'];
const STEP = ['0 0 0 1 1 1 1', '0 0 0 1 1 1 1', '0 0 0 1 1 1 1', '0 0 0 1 1 1 1'];
const start = (season: Season = 'summer', heights = STEP) =>
  scenario(GLEN, { content: H, season, heights, citizens: 12, stores: { food: 80 } });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, H), s);
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 80 } }, H);
const watered = (s: RunState, col: number, row: number) => {
  const u = s.lastReport!.water!.uses[uidAt(s, col, row)]!;
  return u.got.clean + u.got.nutrient + u.got.grey;
};

/** A channel from the river along row 1 to column 5, and farms beside it on row 0. */
function farms(s: RunState, cols: number[]): RunState {
  s = build(s, 'irrigationChannel', [
    [1, 1],
    [2, 1],
    [3, 1],
    [4, 1],
    [5, 1],
  ]);
  return build(
    s,
    'floodplainFarm',
    cols.map((c) => [c, 0] as [number, number]),
  );
}

describe('water flows only downhill', () => {
  it('a farm above a rise gets nothing without a pump station; below it, as before', () => {
    const s = end(farms(start(), [2, 4]));
    expect(watered(s, 2, 0)).toBe(1);
    expect(watered(s, 4, 0)).toBe(0);
    expect(s.lastReport!.water!.uses[uidAt(s, 4, 0)]!.short).toBe(true);
  });

  it('a pump station beside the rise lifts 2 a season: two farms above it are watered, not three', () => {
    let s = farms(start(), [3, 4, 5]);
    s = build(s, 'pumpStation', [[3, 2]]);
    s = end(s);
    const got = [3, 4, 5].map((c) => watered(s, c, 0));
    expect(got.reduce((a, b) => a + b, 0)).toBe(2);
    expect(s.lastReport!.math[uidAt(s, 3, 2)]).toContain('water: lifted 2 up a step');
    expect(s.lastReport!.water!.lifted![uidAt(s, 3, 2)]).toBe(2);
  });

  it('a rise of two steps carries nothing, even with a pump', () => {
    const steep = STEP.map((r) => r.replace(/1/g, '2'));
    let s = farms(start('summer', steep), [4]);
    s = build(s, 'pumpStation', [[3, 2]]);
    s = end(s);
    expect(watered(s, 4, 0)).toBe(0);
  });

  it('a farm draws only from channel at its own height or above, never from below', () => {
    // (3,0) stands at height 1 beside channel at heights 0 and 1: it takes only from the higher.
    const s = end(farms(start(), [3]));
    expect(watered(s, 3, 0)).toBe(0);
  });

  it('water in and out still balance', () => {
    let s = farms(start(), [2, 4, 5]);
    s = build(s, 'pumpStation', [[3, 2]]);
    s = end(s);
    const w = s.lastReport!.water!;
    const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);
    expect(sum(w.in)).toBe(sum(w.out));
  });

  it('land without heights is level: the same map, no rise, every farm watered', () => {
    const flat = STEP.map((r) => r.replace(/1/g, '0'));
    const s = end(farms(start('summer', flat), [2, 4]));
    expect(watered(s, 4, 0)).toBe(1);
  });
});

describe('cold, wind and snow up high', () => {
  const TOPS = ['0 0 0 2 2 2 2', '0 0 0 2 2 2 2', '0 0 0 2 2 2 2', '0 0 0 2 2 2 2'];
  it('a cottage at height 2 needs 1 more heat on autumn and winter nights', () => {
    for (const [season, extra] of [
      ['spring', 0],
      ['autumn', 1],
      ['winter', 1],
    ] as const) {
      const s = build(start(season, TOPS), 'cottage', [
        [1, 3],
        [5, 3],
      ]);
      const si = ['spring', 'summer', 'autumn', 'winter'].indexOf(season);
      const low = heatDemand(H, s, s.buildings[uidAt(s, 1, 3)]!, 'night', si);
      const high = heatDemand(H, s, s.buildings[uidAt(s, 5, 3)]!, 'night', si);
      expect(high - low, season).toBe(extra);
    }
  });

  it('a wind spire at height 2 makes 1 more in each slot', () => {
    const hills = ['^ ^ ^', '^ C ^'];
    const s = endSeason(
      place(
        place(scenario(hills, { content: H, heights: ['0 2 2', '0 0 0'] }), 'windSpire', 0, 0, H),
        'windSpire',
        2,
        0,
        H,
      ),
      H,
    );
    expect(s.lastReport!.math[uidAt(s, 2, 0)]).toContain('at height 2 +1');
    expect(s.lastReport!.math[uidAt(s, 0, 0)]!.join(' ')).not.toContain('at height');
  });

  it('solar canopies up high are snowed under in winter; low ones are not', () => {
    let s = build(start('winter', TOPS), 'solarCanopy', [
      [1, 2],
      [5, 2],
    ]);
    s = end(s);
    expect(s.lastReport!.math[uidAt(s, 5, 2)]).toContain(
      'under snow at height 2: nothing this winter',
    );
    const day = s.lastReport!.energy.day.bySource.solarCanopy ?? 0;
    expect(day).toBe(H.byId.solarCanopy!.generation!.day[3]);
  });
});
