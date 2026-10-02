/**
 * The heat layer (DECISIONS.md, Teaching by layers; milestone H2), from run 4
 * and in a Long Winter: energy can't heat anything directly. Heat comes only
 * from buildings (solar thermal collectors, heat pumps, heat wells, a warm
 * neighbour), each reaching 2 tiles; a building no source heats is cold, and
 * is shut off like a blackout.
 */
import { describe, expect, it } from 'vitest';
import {
  canPlace,
  createCity,
  energyLedger,
  hexDistance,
  nextRunOptions,
  scoreRun,
  teaching,
  warmCitizens,
  type CityState,
  type RunState,
} from '../src/sim';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';
import { at, content, endSeason, place, scenario, uidAt } from './helpers';

// River in column 4, camp at (2,2): the heat tests' valley.
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];
const CAMP = at(2, 2);

const heatLayer = (season: 'spring' | 'winter' = 'winter') =>
  scenario(VALLEY, { season, stores: { food: 500 }, run: { localHeat: true } });
const night = (s: RunState) => s.lastReport!.energy.night;
const wellbeing = (s: RunState, reason: RegExp) =>
  s.lastReport!.wellbeing.lines.find((l) => reason.test(l.reason));

describe('energy no longer heats', () => {
  it('with no heat source, the camp goes cold in winter and is shut off', () => {
    const s = endSeason(heatLayer());
    expect(night(s).heat).toMatchObject({ demand: 2, direct: 0, cold: 2 });
    expect(night(s).demand).toBe(0);
    expect(night(s).shortfall).toBe(0);
    expect(s.lastReport!.cold).toEqual(['b0']);
    expect(s.lastReport!.blackouts).toContain('b0');
    expect(wellbeing(s, /cold home/)).toMatchObject({
      reason: '1 cold home: no heat source reaches it',
      // An unpowered home's cost, and 1 more for each of the camp's beds.
      amount:
        content.rules.wellbeing.perUnpoweredHome -
        content.byId.foundersCamp!.housing * content.rules.localHeat.coldPerBed,
    });
    expect(s.lastReport!.math.b0).toContain('cold: shut off, no heat source reaches it by night');
  });

  it('the energy ledger counts the heat nobody paid, and still balances', () => {
    const r = endSeason(heatLayer()).lastReport!;
    const ledger = energyLedger(content, r);
    expect(ledger.night.made['Cold: heat no source paid']?.amount).toBe(2);
    const sum = (lines: Record<string, { amount: number }>) =>
      Object.values(lines).reduce((a, l) => a + l.amount, 0);
    expect(sum(ledger.night.made)).toBe(sum(ledger.night.used));
  });
});

describe('the Air-source Heat Pump', () => {
  it('joins only with the heat layer, and stands anywhere', () => {
    const plain = scenario(VALLEY, { season: 'winter' });
    const r = canPlace(content, plain, 'airSourceHeatPump', at(3, 2));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/energy can no longer heat buildings directly/);
    expect(canPlace(content, heatLayer(), 'airSourceHeatPump', at(1, 2)).ok).toBe(true);
  });

  it('pays 2 heat for 1 energy: the camp is warm', () => {
    const s = endSeason(place(heatLayer(), 'airSourceHeatPump', 3, 2));
    expect(night(s).heat).toMatchObject({ demand: 2, pumped: 2, pumpEnergy: 1, cold: 0 });
    expect(night(s).demand).toBe(1);
    expect(s.lastReport!.cold).toEqual([]);
  });

  it('rounds up: an odd heat costs a whole energy', () => {
    // The camp's 2 and a cottage's 1: 3 heat for 2 energy.
    let s = place(heatLayer(), 'cottage', 3, 3);
    s = endSeason(place(s, 'airSourceHeatPump', 3, 2));
    expect(night(s).heat).toMatchObject({ demand: 3, pumped: 3, pumpEnergy: 2, cold: 0 });
  });

  it('out of reach, it leaves a home cold', () => {
    const far = at(8, 3);
    expect(hexDistance(far, CAMP)).toBeGreaterThan(2);
    const s = endSeason(place(heatLayer(), 'airSourceHeatPump', 8, 3));
    expect(night(s).heat).toMatchObject({ pumped: 0, cold: 2 });
    expect(s.lastReport!.cold).toEqual(['b0']);
  });
});

describe('the Water-source Heat Pump', () => {
  it('pays 3 heat for 1 energy (2 tiles from the camp, by the river)', () => {
    expect(hexDistance(at(3, 1), CAMP)).toBe(2);
    const s = endSeason(place(heatLayer(), 'heatPump', 3, 1));
    // The camp needs 2: a whole energy's worth, rounded up.
    expect(night(s).heat).toMatchObject({ demand: 2, pumped: 2, pumpEnergy: 1, cold: 0 });
  });
});

describe('heat wells', () => {
  it('charge only through a pump, never straight from energy', () => {
    const well = (pump: boolean) => {
      let s = place(heatLayer('spring'), 'heatWell', 3, 3);
      if (pump) s = place(s, 'airSourceHeatPump', 3, 2);
      return endSeason(s);
    };
    // Spring: the camp's 2 day and 2 night energy are spare. The pump turns them into heat.
    const pumped = well(true);
    expect(pumped.lastReport!.energy.day.storageCharged).toBe(0);
    expect(pumped.lastReport!.energy.day.heat).toMatchObject({ stored: 4, pumpEnergy: 2 });
    expect(pumped.lastReport!.energy.night.heat).toMatchObject({ stored: 2, pumpEnergy: 1 });
    // Full at 6, less 1 lost at the season's end.
    expect(pumped.buildings[uidAt(pumped, 3, 3)]!.stored).toBe(5);
    const bare = well(false);
    expect(bare.lastReport!.energy.day.storageCharged).toBe(0);
    expect(bare.buildings[uidAt(bare, 3, 3)]!.stored).toBe(0);
  });

  it("pay a home's whole heat from their store", () => {
    let s = place(heatLayer(), 'heatWell', 3, 2);
    s.buildings[uidAt(s, 3, 2)]!.stored = 3;
    s = endSeason(s);
    expect(night(s).heat.cold).toBe(0);
    expect(night(s).storageDischarged).toBe(2);
    expect(s.lastReport!.cold).toEqual([]);
  });

  it('keep what they hold rather than half-warm a home', () => {
    let s = place(heatLayer(), 'heatWell', 3, 2);
    s.buildings[uidAt(s, 3, 2)]!.stored = 1;
    s = endSeason(s);
    expect(s.lastReport!.cold).toEqual(['b0']);
    expect(night(s).storageDischarged).toBe(0);
  });
});

describe('heat kept close: the score line is earned', () => {
  const line = (s: RunState) =>
    scoreRun(content, s).lines.find((l) => l.reason.endsWith('in homes kept warm'));
  const per = content.rules.score.layers.localHeat;

  it('counts the citizens in homes that were never cold', () => {
    // The camp (6 beds) warmed by a pump all winter, and a cottage beyond its reach.
    let s = place(heatLayer(), 'airSourceHeatPump', 3, 2);
    s = place(s, 'cottage', 8, 3);
    s.citizens = 9;
    s = endSeason(s);
    expect(s.everCold).toEqual([uidAt(s, 8, 3)]);
    expect(warmCitizens(content, s)).toBe(content.byId.foundersCamp!.housing);
    expect(line(s)).toEqual({
      reason: `${content.byId.foundersCamp!.housing} citizens in homes kept warm`,
      points: content.byId.foundersCamp!.housing * per,
    });
  });

  it('a home cold once stays out of the count; and no line without the heat layer', () => {
    let s = endSeason(heatLayer());
    expect(s.everCold).toContain('b0');
    s = endSeason(place(s, 'airSourceHeatPump', 3, 2));
    expect(warmCitizens(content, s)).toBe(0);
    const plain = endSeason(scenario(VALLEY, { season: 'winter', stores: { food: 500 } }));
    expect(scoreRun(content, plain).lines.some((l) => l.reason.endsWith('kept warm'))).toBe(false);
  });
});

describe('the teaching ladder', () => {
  it('the heat layer joins at run 4, and the full valley brings it', () => {
    expect(content.progression!.teaching.localHeat).toBe(4);
    expect(teaching(content, 3).localHeat).toBe(false);
    expect(teaching(content, 4).localHeat).toBe(true);
    const run4: CityState = { ...createCity(content, 'h'), runs: 3 };
    expect(nextRunOptions(content, run4).localHeat).toBe(true);
    const full: CityState = { ...createCity(content, 'h'), runs: 1, fullValley: true };
    expect(nextRunOptions(content, full).localHeat).toBe(true);
  });
});

describe('whole runs', () => {
  const balances = (run: Parameters<typeof playRun>[3]) => {
    let cold = 0;
    playRun(content, BOTS.balanced!, 'heat-layer-ledger', {
      ...run,
      onSeason: (s) => {
        const r = s.lastReport!;
        const ledger = energyLedger(content, r);
        for (const slot of ['day', 'night'] as const) {
          const sum = (lines: Record<string, { amount: number }>) =>
            Object.values(lines).reduce((a, l) => a + l.amount, 0);
          expect(sum(ledger[slot].made), `${r.season} ${r.year} ${slot}`).toBe(
            sum(ledger[slot].used),
          );
          expect(r.energy[slot].heat.direct).toBe(0);
          cold += r.energy[slot].heat.cold;
        }
      },
    });
    return cold;
  };

  it('with the heat layer, no heat is ever paid from the grid and the ledger balances', () => {
    balances({ run: { localHeat: true } });
  });

  it('in a Long Winter likewise', () => {
    balances({ run: { expedition: { twist: 'longWinter', request: null } } });
  });
});
