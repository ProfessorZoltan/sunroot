/**
 * A forecast is what a player can know before ending a season: everything the
 * rules decide, but not chance outcomes. The storm's target is the only chance
 * draw inside a season, so a forecast reports the buildings at risk instead.
 */
import { describe, expect, it } from 'vitest';
import { GameStore } from '../src/game/store';
import { applyCommand, forecastSeason, previewPlacement } from '../src/sim';
import { Turn } from '../src/balance/turn';
import { createRng } from '../src/sim/rng';
import { at, content, place, scenario, uidAt } from './helpers';

const HILLS = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];

const autumnWithSpires = () => {
  let s = scenario(HILLS, { season: 'autumn' });
  s = place(s, 'windSpire', 9, 1);
  s = place(s, 'windSpire', 0, 3);
  return s;
};

describe('forecasts', () => {
  it('name the buildings a storm could disable, without choosing one', () => {
    const s = autumnWithSpires();
    const forecast = forecastSeason(content, s).lastReport!;
    expect(forecast.damaged).toEqual([]);
    expect(forecast.atRisk.sort()).toEqual([uidAt(s, 9, 1), uidAt(s, 0, 3)].sort());
    const real = applyCommand(content, s, { type: 'endSeason' });
    expect(real.ok && real.state.lastReport!.damaged).toHaveLength(1);
    expect(real.ok && real.state.lastReport!.atRisk).toEqual([]);
    // A forecast never moves the run's random stream.
    expect(s.rng).toEqual(autumnWithSpires().rng);
  });

  it('the placement preview warns about the risk instead of foretelling it', () => {
    const s = scenario(HILLS, { season: 'autumn' });
    const p = previewPlacement(content, s, 'windSpire', at(9, 1), undefined, { forecast: true });
    expect(p.ok && p.warnings).toContain(
      'The storms may disable it: it stands on a hill with no woodland beside it.',
    );
    const store = new GameStore(content, s);
    store.selectBuilding('windSpire');
    store.hoverAt(at(9, 1));
    expect(store.placement?.preview.ok && store.placement.preview.warnings).toContain(
      'The storms may disable it: it stands on a hill with no woodland beside it.',
    );
    expect(store.insight.now.damaged).toEqual([]);
  });

  it('bots see the forecast unless told to see the outcome', () => {
    const s = autumnWithSpires();
    const rng = createRng('bot');
    expect(new Turn(content, s, rng).peek()!.report.damaged).toEqual([]);
    expect(new Turn(content, s, rng, 'outcome').peek()!.report.damaged).toHaveLength(1);
  });
});
