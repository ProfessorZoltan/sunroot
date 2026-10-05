/**
 * Spreading compost many times at once, for the most Harmony (sim/compost.ts): asked for in
 * playtesting, as spreading it a tile at a time late in a run was a chore.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, compostPlan, hexKey, type RunState } from '../src/sim';
import { harmonyLines } from '../src/sim/queries';
import { act, at, content, rejects, scenario } from './helpers';

const harmony = (s: RunState) => harmonyLines(content, s).reduce((n, l) => n + l.amount, 0);
const typeAt = (s: RunState, col: number, row: number) => s.map.tiles[hexKey(at(col, row))]!.type;

describe('spreading compost many times', () => {
  // Barren and scrub, the camp in the middle, and no river, so no Wildway to make.
  const LAND = ['. . , .', '. C . W', '. , . m'];
  const valley = (compost = 40) => scenario(LAND, { stores: { compost } });

  it('goes where each spread gives the most Harmony: scrub to meadow before barren to scrub', () => {
    const s = act(valley(), { type: 'autoCompost', times: 1 });
    // The open scrub nearest the camp becomes meadow (+1); barren to scrub would give nothing.
    expect(harmony(s)).toBe(harmony(valley()) + 1);
    expect(['meadow']).toContain(typeAt(s, 1, 2));
  });

  it('every spread a step worth Harmony, before barren land that needs two', () => {
    // 3 scrub (the camp's too) to meadow, and 3 meadows to woodland: +1 each.
    const six = act(valley(), { type: 'autoCompost', times: 6 });
    expect(harmony(six) - harmony(valley())).toBe(6);
    expect(typeAt(six, 0, 0)).toBe('barren');
    // Then barren land: 3 spreads to woodland for +2, the 10th on its own gives nothing.
    const ten = act(valley(), { type: 'autoCompost', times: 10 });
    expect(harmony(ten) - harmony(valley())).toBe(9);
  });

  it('costs compost for each spread, no more than there is, and undoes in one step', () => {
    const cost = content.rules.compostPerTileStep;
    const s = act(valley(3 * cost), { type: 'autoCompost', times: 10 });
    expect(s.stores.compost).toBe(0);
    expect(s.spent.compost!.used['Spread on the land']).toEqual({ amount: 3 * cost, count: 3 });
    const undone = act(s, { type: 'undo' });
    expect(undone.map).toEqual(valley(3 * cost).map);
    expect(rejects(valley(cost - 1), { type: 'autoCompost', times: 1 })).toMatch(/needs/);
    expect(rejects(valley(), { type: 'autoCompost', times: 0 })).toMatch(/at least once/);
  });

  it('the same as spreading it a tile at a time on the tiles it plans', () => {
    const plan = compostPlan(content, valley(), 5);
    const byHand = plan.reduce(
      (s, key) => act(s, { type: 'spreadCompost', at: s.map.tiles[key]! }),
      valley(),
    );
    const auto = act(valley(), { type: 'autoCompost', times: 5 });
    expect(auto.map).toEqual(byHand.map);
    expect(auto.stores).toEqual(byHand.stores);
  });

  it('stops when every tile is woodland', () => {
    // Only the camp's scrub is left: 2 spreads take it to woodland.
    const green = scenario(['W W', 'C W'], { stores: { compost: 40 } });
    expect(compostPlan(content, green, 5)).toHaveLength(2);
    const done = act(green, { type: 'autoCompost', times: 5 });
    expect(done.stores.compost).toBe(40 - 2 * content.rules.compostPerTileStep);
    expect(rejects(done, { type: 'autoCompost', times: 3 })).toMatch(/no land left/);
  });

  it('composts a Wildway into being when the batch reaches it (+10 Harmony)', () => {
    // Meadow from the river with one barren tile short of the edge; the camp's scrub is closer
    // to a single +1, but the Wildway pays far more for the same 2 spreads.
    const strip = scenario(['~ . . . .', '~ m . m m', '~ . , C .'], { stores: { compost: 40 } });
    const s = act(strip, { type: 'autoCompost', times: 2 });
    expect(typeAt(s, 2, 1)).toBe('meadow');
    expect(harmonyLines(content, s).map((l) => l.label)).toContain('Wildway');
    expect(harmony(s) - harmony(strip)).toBe(11);
    // One spread can't reach it: the scrub becomes meadow instead.
    const one = applyCommand(content, strip, { type: 'autoCompost', times: 1 });
    expect(one.ok && typeAt(one.state, 2, 1)).toBe('barren');
  });
});
