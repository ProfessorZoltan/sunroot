/**
 * The same seed always gives the same run. A tiny scripted player (a stand-in
 * for the Milestone 2 bots) plays whole runs; we replay them and compare, and
 * check that the rules' invariants hold every season.
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, canPlace, createRun, hexKey, type Command, type RunState } from '../src/sim';
import { createRng, nextInt } from '../src/sim/rng';
import { content } from './helpers';

/** A simple deterministic player: picks cards and builds whatever it can afford. */
function playRun(seed: string, guided = false, onSeason?: (s: RunState) => void): RunState {
  let s = createRun(content, { seed, guided });
  const playerRng = createRng(`${seed}:player`);
  const pickRng = (n: number) => nextInt(playerRng, n);
  const tiles = Object.values(s.map.tiles);
  const apply = (c: Command) => {
    const r = applyCommand(content, s, c);
    if (r.ok) s = r.state;
    return r.ok;
  };
  while (s.status === 'active') {
    if (s.draft.offer.length > 0)
      apply({ type: 'pickCard', card: s.draft.offer[pickRng(s.draft.offer.length)]! });
    if (s.charterOffer.length > 0)
      apply({ type: 'pickCharter', charter: s.charterOffer[pickRng(s.charterOffer.length)]! });
    const options = s.unlocked.slice();
    for (let attempt = 0; attempt < 3; attempt++) {
      const building = options[pickRng(options.length)]!;
      const def = content.byId[building]!;
      if (s.stores.materials < def.cost) continue;
      const site = tiles.find((t) => canPlace(content, s, building, t).ok);
      if (site) apply({ type: 'place', building, at: { q: site.q, r: site.r } });
    }
    if (!apply({ type: 'endSeason' })) throw new Error('endSeason failed');
    onSeason?.(s);
  }
  return s;
}

describe('determinism', () => {
  it('the same seed and commands give the same run', () => {
    const a = playRun('replay-1');
    const b = playRun('replay-1');
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.turn).toBeGreaterThan(4);
  });

  it('different seeds give different runs', () => {
    expect(JSON.stringify(playRun('replay-1'))).not.toBe(JSON.stringify(playRun('replay-2')));
  });

  it('state survives a JSON round trip mid-run (saves are serialized state)', () => {
    let s = createRun(content, { seed: 'save' });
    const pick = (x: RunState) => {
      const r = applyCommand(content, x, { type: 'pickCard', card: x.draft.offer[0]! });
      return r.ok ? r.state : x;
    };
    const end = (x: RunState) => {
      const r = applyCommand(content, pick(x), { type: 'endSeason' });
      if (!r.ok) throw new Error(r.error);
      return r.state;
    };
    for (let i = 0; i < 5; i++) s = end(s);
    const restored = JSON.parse(JSON.stringify(s)) as RunState;
    expect(restored).toEqual(s);
    expect(JSON.stringify(end(restored))).toBe(JSON.stringify(end(s)));
  });
});

describe('invariants over whole runs', () => {
  it.each(['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5', 'inv-6'])('%s', (seed) => {
    const final = playRun(seed, seed.endsWith('1'), (s) => {
      for (const [res, amount] of Object.entries(s.stores)) {
        expect(amount, res).toBeGreaterThanOrEqual(0);
        expect(Number.isInteger(amount), res).toBe(true);
      }
      expect(s.wellbeing).toBeGreaterThanOrEqual(0);
      expect(s.wellbeing).toBeLessThanOrEqual(100);
      const housing = Object.values(s.buildings).reduce(
        (sum, b) => sum + content.byId[b.type]!.housing,
        0,
      );
      expect(s.citizens).toBeLessThanOrEqual(housing);
      const occupied = Object.values(s.buildings).map((b) => hexKey(b.at));
      expect(new Set(occupied).size).toBe(occupied.length);
      const r = s.lastReport!;
      for (const slot of ['day', 'night'] as const) {
        const e = r.energy[slot];
        expect(e.unused).toBeGreaterThanOrEqual(0);
        expect(e.shortfall).toBeGreaterThanOrEqual(0);
      }
      expect(s.stores.food).toBeLessThanOrEqual(r.food.storage);
    });
    expect(['complete', 'collapsed']).toContain(final.status);
    expect(final.history).toHaveLength(final.turn);
  });
});
