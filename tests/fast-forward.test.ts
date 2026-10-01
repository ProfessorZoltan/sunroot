/** Fast-forward: ends seasons up to next spring, waiting for choices, stopping before trouble. */
import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/game/store';
import { content, place, scenario } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];

/**
 * A store whose fast-forward steps run at once (no pause between seasons), in a
 * late-run state: every blueprint unlocked and no tunings, so no draft is dealt.
 */
const storeFor = (s: Parameters<typeof scenario>[1] = {}) => {
  const state = scenario(LAND, { stores: { food: 200 }, run: { tunings: false }, ...s });
  return new GameStore(content, state, { defer: (step) => step() });
};

describe('fast-forward', () => {
  it('ends the seasons left in the year, then stops at spring', () => {
    const store = storeFor({ season: 'summer' });
    store.fastForward();
    expect(store.state.season).toBe('spring');
    expect(store.state.year).toBe(2);
    expect(store.fastForwardTo).toBeNull();
    expect(store.resolution).toBeNull();
    expect(store.message).toBe('A year went by.');
  });

  it('waits for a card to be picked, then carries on', () => {
    const store = storeFor({ season: 'summer' });
    store.state = {
      ...store.state,
      draft: { offer: ['orchard', 'apiary'], picked: null, extraBought: false },
    };
    store.fastForward();
    expect(store.state.season).toBe('summer');
    expect(store.fastForwardWaiting).toBe('Pick a card to carry on.');
    store.dispatch({ type: 'pickCard', card: 'apiary' });
    expect(store.state.year).toBe(2);
    expect(store.fastForwardTo).toBeNull();
  });

  it('waits while a card is being read', () => {
    const store = storeFor({ season: 'autumn' });
    store.reveals = [{ kind: 'era', era: 2 }];
    store.fastForward();
    expect(store.state.season).toBe('autumn');
    store.dismissReveal();
    expect(store.state.year).toBe(2);
  });

  it('stops rather than end a season short of energy', () => {
    const state = place(
      scenario(LAND, { season: 'winter', stores: { food: 200 } }),
      'cottage',
      6,
      2,
    );
    const store = new GameStore(content, state, { defer: (step) => step() });
    store.fastForward();
    expect(store.state.season).toBe('winter');
    expect(store.fastForwardTo).toBeNull();
    expect(store.message).toMatch(/energy short/);
  });

  it('stops rather than let citizens go hungry', () => {
    const store = storeFor({ season: 'summer', stores: { food: 0 }, citizens: 12 });
    store.fastForward();
    expect(store.state.season).toBe('summer');
    expect(store.message).toMatch(/would go hungry/);
  });

  it('can be stopped', () => {
    const steps: (() => void)[] = [];
    const store = new GameStore(content, scenario(LAND, { stores: { food: 200 } }), {
      defer: (step) => steps.push(step),
    });
    store.fastForward();
    store.stopFastForward();
    steps.forEach((s) => s());
    expect(store.state.turn).toBe(0);
  });
});
