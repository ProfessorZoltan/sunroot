/** Refinements: late-run cards that keep the draft full once the other cards run out. */
import { describe, expect, it } from 'vitest';
import { blueprintPool, refinementPool } from '../src/sim';
import { drawCards } from '../src/sim/draft';
import { act, content, endSeason, place, scenario, uidAt } from './helpers';

const LAND = [
  '^ ^ ^ , ~ f f , ^ ^',
  ' ^ ^ , , ~ f f , ^ ^',
  '^ , C , ~ f f , , ^',
  ' ^ , , , ~ , , , , ^',
];
const tunings = content.tunings.filter((t) => !t.refinement).map((t) => t.id);
const refinements = content.tunings.filter((t) => t.refinement);

/** A late run: every blueprint unlocked and every tuning taken. */
const late = () => {
  const s = scenario(LAND, { year: 8, season: 'spring' });
  s.tunings = [...tunings];
  return s;
};

describe('refinements', () => {
  it('fill the draft once blueprints and tunings run out', () => {
    const s = late();
    expect(blueprintPool(content, s)).toEqual([]);
    const offer = drawCards(content, s, 3);
    expect(offer).toHaveLength(3);
    expect(offer.every((id) => content.tuningById[id]?.refinement)).toBe(true);
  });

  it('never replace a blueprint or tuning while there are enough of those', () => {
    const s = scenario(LAND, { unlockAll: false });
    for (let i = 0; i < 20; i++)
      expect(drawCards(content, s, 3).some((id) => content.tuningById[id]?.refinement)).toBe(false);
  });

  it('are offered only for unlocked buildings, and up to their limit', () => {
    const s = late();
    s.unlocked = ['floodplainFarm', 'cottage'];
    const pool = refinementPool(content, s);
    expect(pool).toEqual(expect.arrayContaining(['terracedFields', 'loftRooms']));
    expect(pool).not.toContain('balancedBlades');
    s.tunings = [...tunings, 'terracedFields', 'terracedFields'];
    expect(refinementPool(content, s)).not.toContain('terracedFields');
    s.tunings = [...tunings, 'insulatedHomes'];
    expect(refinementPool(content, s)).not.toContain('insulatedHomes');
  });

  it('stack: two Terraced Fields make a summer farm +2 food', () => {
    const food = (taken: string[]) => {
      let s = scenario(LAND, { season: 'summer', citizens: 4 });
      s.tunings = taken;
      s = place(s, 'floodplainFarm', 6, 2);
      return endSeason(s).lastReport!.yields[uidAt(s, 6, 2)]?.food ?? 0;
    };
    expect(food(['terracedFields'])).toBe(food([]) + 1);
    expect(food(['terracedFields', 'terracedFields'])).toBe(food([]) + 2);
  });

  it('are picked like tunings', () => {
    let s = late();
    s.draft = { offer: ['loftRooms', 'hotCompost'], picked: null, extraBought: false };
    s = act(s, { type: 'pickCard', card: 'loftRooms' });
    expect(s.tunings.at(-1)).toBe('loftRooms');
  });

  it('every refinement names a building and a limit', () => {
    expect(refinements.length).toBeGreaterThanOrEqual(12);
    for (const r of refinements) {
      expect(content.byId[r.building!]).toBeDefined();
      expect(r.max).toBeGreaterThanOrEqual(1);
    }
  });
});
