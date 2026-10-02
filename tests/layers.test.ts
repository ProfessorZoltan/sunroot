/**
 * Score lines for the teaching ladder's layers (DECISIONS.md, Teaching by
 * layers): a run with water, or with walks to work, has more to manage, so
 * it gets points for each, and the same play earns the same Graft tier.
 */
import { describe, expect, it } from 'vitest';
import { createRun, loadContent, scoreRun, type RunState } from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { content } from './helpers';

const finished = (options: { water?: boolean; commute?: boolean }): RunState => ({
  ...createRun(content, { seed: 'layers', ...options }),
  status: 'complete',
  turn: 48,
});
const line = (s: RunState, reason: string) =>
  scoreRun(content, s).lines.find((l) => l.reason === reason)?.points;

describe('score lines for the layers', () => {
  const { water, commute } = content.rules.score.layers;

  it('are worth something for each layer', () => {
    expect(water).toBeGreaterThan(0);
    expect(commute).toBeGreaterThan(0);
  });

  it('a run with water, and one with walks to work too, gets a line for each', () => {
    expect(line(finished({}), 'water to manage')).toBeUndefined();
    expect(line(finished({}), 'walks to work')).toBeUndefined();
    expect(line(finished({ water: true }), 'water to manage')).toBe(water);
    const both = finished({ water: true, commute: true });
    expect(line(both, 'water to manage')).toBe(water);
    expect(line(both, 'walks to work')).toBe(commute);
    expect(scoreRun(content, both).total - scoreRun(content, finished({})).total).toBe(
      water + commute,
    );
  });

  it('content with the water system on by itself counts too (the simulator and the tests)', () => {
    const raw = structuredClone(willowReach);
    raw.rules.water.enabled = true;
    const wet = loadContent(raw);
    const s: RunState = { ...createRun(wet, { seed: 'wet' }), status: 'complete', turn: 48 };
    expect(scoreRun(wet, s).lines.find((l) => l.reason === 'water to manage')?.points).toBe(water);
  });
});
