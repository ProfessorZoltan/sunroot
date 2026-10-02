/**
 * At most 12 tunings and refinements a run (rules.maxTunings; DECISIONS.md,
 * Tunings per run): past that, drafts deal blueprints only, and once those
 * run out the draft is empty.
 */
import { describe, expect, it } from 'vitest';
import { blueprintPool, createRun, refinementPool, tuningsFull, type RunState } from '../src/sim';
import { drawCards, tuningPool } from '../src/sim/draft';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';
import { content } from './helpers';

const MAX = content.rules.maxTunings;
const run = (taken: string[], unlockAll = false): RunState => {
  const s = createRun(content, { seed: 'cap', guided: false });
  s.tunings = [...taken];
  if (unlockAll) s.unlocked = content.buildings.map((b) => b.id);
  return s;
};
// Refinements that stack, taken over and over, stand in for a run's picks.
const stacking = content.tunings.filter((t) => t.refinement && t.max > 1).map((t) => t.id);
const picks = (n: number) => Array.from({ length: n }, (_, i) => stacking[i % stacking.length]!);

describe('tunings per run', () => {
  it('are capped at 12', () => {
    expect(MAX).toBe(12);
  });

  it('below the cap, tunings and refinements are dealt as before', () => {
    const s = run(picks(MAX - 1), true);
    expect(tuningsFull(content, s)).toBe(false);
    expect(tuningPool(content, s).length).toBeGreaterThan(0);
    expect(refinementPool(content, s).length).toBeGreaterThan(0);
  });

  it('at the cap, drafts deal blueprints only, then nothing', () => {
    const open = run(picks(MAX));
    expect(tuningsFull(content, open)).toBe(true);
    expect(tuningPool(content, open)).toEqual([]);
    expect(refinementPool(content, open)).toEqual([]);
    const cards = drawCards(content, open, 3);
    expect(cards).toHaveLength(3);
    for (const c of cards) expect(blueprintPool(content, open)).toContain(c);
    // Every blueprint drafted: the draft is empty.
    expect(drawCards(content, run(picks(MAX), true), 3)).toEqual([]);
  });

  it('whole bot runs never take more than 12', () => {
    for (const bot of ['balanced', 'greedyFood']) {
      let last: RunState | null = null;
      playRun(content, BOTS[bot]!, `cap-${bot}`, { onSeason: (s) => (last = s) });
      expect((last as unknown as RunState).tunings.length).toBeLessThanOrEqual(MAX);
    }
  });
});
