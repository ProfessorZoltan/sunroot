/**
 * Energy and heat stay apart in the report (asked for in playtesting): what
 * each building needs of each, and, in runs 1 to 3 where energy may still pay
 * heat directly, the energy turned into heat shown as its own line.
 */
import { describe, expect, it } from 'vitest';
import { energyLedger } from '../src/sim';
import { content, endSeason, place, scenario } from './helpers';

const ROW = ['^ ^ . , ~ , . ^', '^ . C , ~ , . ^', '^ ^ . , ~ , . ^'];

describe('energy and heat apart', () => {
  it("a building's energy and heat are reported separately", () => {
    let s = scenario(ROW, { season: 'winter', stores: { food: 500 }, citizens: 9 });
    s = place(s, 'cottage', 3, 1);
    s = endSeason(s);
    const night = s.lastReport!.energy.night;
    // The cottage needs 1 energy and 1 heat at night; the camp needs only heat.
    expect(night.demandBy).toEqual({ cottage: 1 });
    expect(night.heatBy).toEqual({ foundersCamp: 2, cottage: 1 });
    // In run 1, energy pays that heat directly: 3 turned into heat, on top of the cottage's 1.
    expect(night.heat).toMatchObject({ demand: 3, direct: 3 });
    expect(night.demand).toBe(1 + 3);
  });

  it('the ledger names the heat lines apart, and still balances', () => {
    let s = scenario(ROW, { season: 'winter', stores: { food: 500 }, citizens: 9 });
    s = place(s, 'cottage', 3, 1);
    const ledger = energyLedger(content, endSeason(s).lastReport!);
    expect(ledger.night.used['Cottage']?.amount).toBe(1);
    expect(ledger.night.used['Cottage (heat)']?.amount).toBe(1);
    expect(ledger.night.used["Founders' Camp (heat)"]?.amount).toBe(2);
    const sum = (lines: Record<string, { amount: number }>) =>
      Object.values(lines).reduce((a, l) => a + l.amount, 0);
    expect(sum(ledger.night.made)).toBe(sum(ledger.night.used));
  });
});
