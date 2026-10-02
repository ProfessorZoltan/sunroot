/**
 * Hedgerows on edges (DECISIONS.md, Hedgerows on edges): a hedge runs along
 * the edge between two tiles instead of standing on one. It shelters the
 * tiles on both its sides from storms, every 2 segments give 1 Harmony, and 4
 * joined end to end make a Windbreak. Willow Reach v2 content: with water.
 */
import { describe, expect, it } from 'vitest';
import { harmonyLines, hexDistance, type Hex, type RunState } from '../src/sim';
import { edgeEnds, edgeKey, edgesAround, hedgeRuns } from '../src/sim/edges';
import { findFormations } from '../src/sim/combos';
import { stormExposed } from '../src/sim/queries';
import { act, at, content, endSeason, place, rejects, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });
// Scrub above, hills in rows 3 and 4 (storms reach them), the river in the first column.
const VALLEY = [
  '~ f , , , , , ,',
  '~ f , , , , , ,',
  '~ f , , , , , ,',
  '~ f ^ ^ ^ ^ ^ ^',
  '~ f ^ ^ ^ ^ ^ ^',
  '~ f , C , , , ,',
];
const start = () => scenario(VALLEY, { content: W, citizens: 10, stores: { food: 500 } });
const plant = (s: RunState, a: Hex, b: Hex) => act(s, { type: 'plantHedge', a, b }, W);
/** Hedges along the given edges of a tile (indexes in HEX_DIRECTIONS order). */
const around = (s: RunState, h: Hex, sides: number[]) => {
  const n = edgesAround(h);
  return sides.reduce((acc, i) => {
    const [a, b] = n[i]!.split('|').map((k) => {
      const [q, r] = k.split(',').map(Number);
      return { q: q!, r: r! };
    });
    return plant(acc, a!, b!);
  }, s);
};

describe('edges', () => {
  it('are named by the two tiles they lie between, either way round', () => {
    expect(edgeKey(at(2, 1), at(3, 1))).toBe(edgeKey(at(3, 1), at(2, 1)));
    expect(edgesAround(at(3, 1))).toHaveLength(6);
  });

  it('meet at corners: two edges of one tile next to each other share an end', () => {
    const [e0, e1, , e3] = edgesAround(at(3, 1));
    const shared = (x: string, y: string) => edgeEnds(x).filter((c) => edgeEnds(y).includes(c));
    expect(shared(e0!, e1!)).toHaveLength(1);
    expect(shared(e0!, e3!)).toHaveLength(0);
  });
});

describe('planting a hedge', () => {
  it('costs 2 materials and stands between two land tiles, leaving both free to build on', () => {
    let s = start();
    const before = s.stores.materials;
    s = plant(s, at(3, 1), at(4, 1));
    expect(s.hedges).toEqual([edgeKey(at(3, 1), at(4, 1))]);
    expect(s.stores.materials).toBe(before - 2);
    s = place(s, 'cottage', 3, 1, W);
    s = place(s, 'cottage', 4, 1, W);
    expect(uidAt(s, 3, 1)).toBeTruthy();
  });

  it('not along the river, twice on one edge, between tiles apart, or by itself on a tile', () => {
    const s = plant(start(), at(3, 1), at(4, 1));
    expect(rejects(s, { type: 'plantHedge', a: at(0, 1), b: at(1, 1) }, W)).toMatch(/border river/);
    expect(rejects(s, { type: 'plantHedge', a: at(4, 1), b: at(3, 1) }, W)).toMatch(/already/);
    expect(rejects(s, { type: 'plantHedge', a: at(2, 1), b: at(5, 1) }, W)).toMatch(/side by side/);
    expect(rejects(s, { type: 'place', building: 'hedgerow', at: at(5, 1) }, W)).toMatch(
      /along the edge between two tiles/,
    );
  });

  it('needs the water system', () => {
    const s = scenario(VALLEY, { citizens: 10 });
    expect(rejects(s, { type: 'plantHedge', a: at(3, 1), b: at(4, 1) })).toMatch(/water system/);
  });

  it('can be cleared, and undone like any other command', () => {
    let s = plant(start(), at(3, 1), at(4, 1));
    s = act(s, { type: 'removeHedge', a: at(4, 1), b: at(3, 1) }, W);
    expect(s.hedges).toEqual([]);
    s = act(plant(s, at(3, 1), at(4, 1)), { type: 'undo' }, W);
    expect(s.hedges).toEqual([]);
    s = endSeason(plant(s, at(3, 1), at(4, 1)), W);
    expect(s.hedges).toHaveLength(1);
  });
});

describe('what a hedge does', () => {
  it('shelters the buildings on both its sides from storms', () => {
    let s = start();
    s = place(s, 'solarCanopy', 3, 3, W);
    s = place(s, 'solarCanopy', 4, 3, W);
    const exposed = (col: number) => stormExposed(W, s, s.buildings[uidAt(s, col, 3)]!);
    expect([exposed(3), exposed(4)]).toEqual([true, true]);
    s = plant(s, at(3, 3), at(4, 3));
    expect([exposed(3), exposed(4)]).toEqual([false, false]);
  });

  it('gives 1 Harmony for every 2 segments', () => {
    const line = (s: RunState) => harmonyLines(W, s).find((l) => /hedge segment/.test(l.label));
    let s = plant(start(), at(3, 1), at(4, 1));
    expect(line(s)).toBeUndefined();
    s = plant(s, at(4, 1), at(5, 1));
    expect(line(s)).toEqual({ label: '2 hedge segments', amount: 1 });
    s = plant(s, at(5, 1), at(6, 1));
    expect(line(s)).toEqual({ label: '3 hedge segments', amount: 1 });
  });
});

describe('the Windbreak', () => {
  const centre = at(4, 1);
  const windbreak = (s: RunState) => findFormations(W, s).filter((h) => h.combo === 'windbreak');

  it('4 hedges joined end to end shelter everything within 2 tiles', () => {
    let s = place(start(), 'solarCanopy', 4, 3, W);
    s = place(s, 'solarCanopy', 7, 4, W);
    expect(hexDistance(at(4, 3), centre)).toBe(2);
    const canopy = (col: number, row: number) => s.buildings[uidAt(s, col, row)]!;
    s = around(s, centre, [0, 1, 2]);
    expect(hedgeRuns(s)).toHaveLength(1);
    expect(windbreak(s)).toHaveLength(0);
    expect(stormExposed(W, s, canopy(4, 3))).toBe(true);
    s = around(s, centre, [3]);
    expect(windbreak(s)).toHaveLength(1);
    expect(windbreak(s)[0]!.edges).toHaveLength(4);
    expect(stormExposed(W, s, canopy(4, 3))).toBe(false);
    // Further than 2 tiles from every tile along the run: still exposed.
    expect(stormExposed(W, s, canopy(7, 4))).toBe(true);
  });

  it("4 hedges that don't join are no windbreak", () => {
    let s = start();
    for (const col of [2, 4, 6]) s = plant(s, at(col, 0), at(col, 1));
    s = plant(s, at(7, 2), at(6, 2));
    expect(hedgeRuns(s).length).toBeGreaterThan(1);
    expect(windbreak(s)).toHaveLength(0);
  });

  it('is in the content as a run of 4 hedges', () => {
    const combo = content.comboById.windbreak!;
    expect(combo.layer === 'formation' && combo.shape).toEqual({ kind: 'hedgeRun', length: 4 });
  });
});
