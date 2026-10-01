import { describe, expect, it } from 'vitest';
import type { Graft } from '../src/game/city';
import { GameStore } from '../src/game/store';
import { graftOffer } from '../src/sim';
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

  it('sends one of the offered districts home as the Graft, once, when the run is over', () => {
    const sent: Graft[] = [];
    const store = new GameStore(content, scenario(DRY, { year: 12, season: 'winter' }), {
      onGraft: (g) => sent.push(g),
      now: () => '2026-10-01T00:00:00Z',
    });
    expect(store.chooseGraft('mendedCommons')).toBe(false); // still playing
    store.dispatch({ type: 'endSeason' });
    expect(store.state.status).toBe('complete');
    const offer = graftOffer(content, store.state);
    const notOffered = content.districts.find(
      (d) => !offer.options.some((o) => o.district.id === d.id),
    )!;
    expect(store.chooseGraft(notOffered.id)).toBe(false);
    const pick = offer.options[1]!.district.id;
    expect(store.chooseGraft(pick)).toBe(true);
    expect(sent).toEqual([
      {
        district: pick,
        tier: offer.tier.id,
        score: expect.any(Number),
        seed: 'test',
        vision: null,
        visionAchieved: false,
        sentAt: '2026-10-01T00:00:00Z',
      },
    ]);
    expect(store.chooseGraft(offer.options[0]!.district.id)).toBe(false);
    expect(sent).toHaveLength(1);
  });
});
