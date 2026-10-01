import { describe, expect, it } from 'vitest';
import { applyRunResult, EMPTY_CITY, type Graft, type RunResult } from '../src/game/city';
import { GameStore } from '../src/game/store';
import { graftOffer, seedsForRun } from '../src/sim';
import { content, scenario } from './helpers';

const DRY = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , m , ^',
];

describe('the store at the edges of a run', () => {
  it('reveals a new era and an achieved vision after the season ends', () => {
    const era = new GameStore(content, scenario(DRY, { year: 3, season: 'winter' }));
    era.dispatch({ type: 'endSeason' });
    expect(era.reveals).toEqual([{ kind: 'era', era: 2 }]);
    era.dismissReveal();
    expect(era.reveals).toEqual([]);

    const s = scenario(DRY, { citizens: 50, wellbeing: 80, stores: { food: 300 } });
    const vision = new GameStore(content, { ...s, vision: 'thrivingCommons' });
    vision.dispatch({ type: 'endSeason' });
    expect(vision.reveals).toContainEqual({ kind: 'vision', id: 'thrivingCommons' });
  });

  it('plants one of the offered districts as the Graft, once, when the Seeds pay for it', () => {
    const results: RunResult[] = [];
    const store = new GameStore(content, scenario(DRY, { year: 12, season: 'winter' }), {
      bankedSeeds: 100,
      onRunEnd: (r) => results.push(r),
      now: () => '2026-10-01T00:00:00Z',
    });
    expect(store.chooseGraft('mendedCommons')).toBe(false); // still playing
    store.dispatch({ type: 'endSeason' });
    expect(store.state.status).toBe('complete');
    expect(store.seedsInHand).toBe(100 + seedsForRun(content, store.state).total);
    expect(store.canPlant).toBe(true);
    const offer = graftOffer(content, store.state);
    const notOffered = content.districts.find(
      (d) => !offer.options.some((o) => o.district.id === d.id),
    )!;
    expect(store.chooseGraft(notOffered.id)).toBe(false);
    const pick = offer.options[1]!.district.id;
    expect(store.chooseGraft(pick)).toBe(true);
    expect(results).toEqual([
      {
        graft: {
          district: pick,
          tier: offer.tier.id,
          score: expect.any(Number),
          seeds: store.seedsEarned,
          seed: 'test',
          vision: null,
          visionAchieved: false,
          sentAt: '2026-10-01T00:00:00Z',
        },
        earned: store.seedsEarned,
        spent: content.progression!.graftCost,
      },
    ]);
    expect(store.chooseGraft(offer.options[0]!.district.id)).toBe(false);
    expect(store.bankSeeds()).toBe(false);
    expect(results).toHaveLength(1);
  });

  it('banks the Seeds when they are too few for a Graft', () => {
    const results: RunResult[] = [];
    const store = new GameStore(content, scenario(DRY, { year: 12, season: 'winter' }), {
      onRunEnd: (r) => results.push(r),
    });
    expect(store.bankSeeds()).toBe(false); // still playing
    store.dispatch({ type: 'endSeason' });
    expect(store.seedsInHand).toBeLessThan(content.progression!.graftCost);
    expect(store.canPlant).toBe(false);
    expect(store.chooseGraft(graftOffer(content, store.state).options[0]!.district.id)).toBe(false);
    expect(store.bankSeeds()).toBe(true);
    expect(results).toEqual([{ graft: null, earned: store.seedsEarned, spent: 0 }]);
  });
});

describe('Root City', () => {
  it('adds a run: its Graft if one was planted, and the Seeds earned less those spent', () => {
    const graft = { district: 'mendedCommons' } as Graft;
    const one = applyRunResult(EMPTY_CITY, { graft: null, earned: 20, spent: 0 });
    expect(one).toEqual({ version: 1, grafts: [], seeds: 20, runs: 1 });
    const two = applyRunResult(one, { graft, earned: 30, spent: 35 });
    expect(two).toEqual({ version: 1, grafts: [graft], seeds: 15, runs: 2 });
  });
});
