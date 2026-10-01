/**
 * The season report's ledger: every resource made and used, by what. It must
 * balance exactly: the stores at the start of a season, plus everything made,
 * minus everything used, are the stores at the start of the next.
 */
import { describe, expect, it } from 'vitest';
import { BOTS } from '../src/balance/bots';
import { Turn } from '../src/balance/turn';
import { applyCommand, createRun, energyLedger, RESOURCES, type RunState } from '../src/sim';
import { createRng } from '../src/sim/rng';
import { content, endSeason, place, scenario } from './helpers';

const ok = (r: ReturnType<typeof applyCommand>) => {
  if (!r.ok) throw new Error(r.error);
  return r.state;
};

/** Plays a run with a bot, checking the ledger every season. */
function checkRun(bot: string, seed: string): number {
  let s = createRun(content, { seed, visions: true });
  const rng = createRng(`${seed}:bot`);
  let seasons = 0;
  while (s.status === 'active') {
    const turn = new Turn(content, s, rng, 'forecast');
    BOTS[bot]!.playSeason(turn);
    s = turn.state;
    if (s.draft.offer.length > 0 && !s.draft.picked)
      s = ok(applyCommand(content, s, { type: 'pickCard', card: s.draft.offer[0]! }));
    if (s.visionOffer.length > 0)
      s = ok(applyCommand(content, s, { type: 'pickVision', vision: s.visionOffer[0]! }));
    if (s.charterOffer.length > 0)
      s = ok(applyCommand(content, s, { type: 'pickCharter', charter: s.charterOffer[0]! }));
    const start = s.seasonStart!.stores;
    const next = ok(applyCommand(content, s, { type: 'endSeason' }));
    const flows = next.lastReport!.flows;
    for (const res of RESOURCES) {
      const sum = (lines: Record<string, { amount: number }> | undefined) =>
        Object.values(lines ?? {}).reduce((n, l) => n + l.amount, 0);
      const made = sum(flows[res]?.made);
      const used = sum(flows[res]?.used);
      expect(start[res] + made - used, `${bot} ${seed} turn ${s.turn} ${res}`).toBe(
        next.stores[res],
      );
    }
    // Energy and heat balance too, slot by slot.
    const energy = energyLedger(content, next.lastReport!);
    for (const slot of ['day', 'night'] as const) {
      const sum = (lines: Record<string, { amount: number }>) =>
        Object.values(lines).reduce((n, l) => n + l.amount, 0);
      expect(sum(energy[slot].made), `${bot} ${seed} turn ${s.turn} ${slot} energy`).toBe(
        sum(energy[slot].used),
      );
    }
    s = next;
    seasons++;
  }
  return seasons;
}

describe('the season report ledger', () => {
  it('balances every season of whole runs, for every kind of bot', () => {
    let seasons = 0;
    for (const bot of ['balanced', 'greedyFood', 'greedyEnergy', 'random'])
      for (const seed of ['ledger-1', 'ledger-2']) seasons += checkRun(bot, seed);
    expect(seasons).toBeGreaterThan(200);
  }, 60_000);

  it('names what made and used each resource, and bonuses apart from base yields', () => {
    const MAP = [
      '^ ^ ^ , ~ , , , ^ ^',
      ' ^ ^ , , ~ f f f ^ ^',
      '^ , C , ~ f f f , ^',
      ' ^ , , , ~ f f f , ^',
    ];
    let s = scenario(MAP, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'apiary', 6, 3);
    const next = endSeason(s);
    const food = next.lastReport!.flows.food!;
    expect(food.made['Floodplain Farm']).toEqual({ amount: expect.any(Number), count: 1 });
    expect(food.made['Apiary bonus']).toEqual({ amount: 1, count: 1 });
    expect(food.used['Citizens eat']!.amount).toBe(6);
    const materials = next.lastReport!.flows.materials!;
    expect(materials.used['Building: Floodplain Farm']).toEqual({ amount: 3, count: 1 });
    expect(materials.used['Building: Apiary']).toEqual({ amount: 3, count: 1 });
  });

  it('keeps the last report of each season', () => {
    let s: RunState = scenario(
      ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'],
      {
        stores: { food: 100 },
      },
    );
    for (let i = 0; i < 6; i++) s = endSeason(s);
    expect(s.recentReports.map((r) => `${r.season} ${r.year}`)).toEqual([
      'autumn 1',
      'winter 1',
      'spring 2',
      'summer 2',
    ]);
    expect(s.recentReports.at(-1)).toBe(s.lastReport);
  });
});
