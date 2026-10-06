/**
 * The season card's energy (src/game/insight.ts): made (`energyMade`) is energy only, not the heat
 * the heat wells paid homes from their store; used (`energyUsed`) is the buildings' demand and what
 * is set aside for tonight, before any workshop or kiln runs. So what it shows as spare is what the
 * runs can have (asked for in playtesting: a Highland winter's card said 23/21, and the workshops
 * got none of the 2, which were the wells' heat).
 */
import { describe, expect, it } from 'vitest';
import { applyCommand, type RunState, type Slot } from '../src/sim';
import { energyMade, energyUsed } from '../src/game/insight';
import { content, endSeason, place, scenario, uidAt } from './helpers';

// The heat layer's valley (tests/heat-layer.test.ts): river in column 4, camp at (2,2).
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];

/** A winter with no grid heat: a pump, solar canopies, a workshop on clutter, maybe a heat well. */
function winter(well: boolean): RunState {
  let s = scenario(VALLEY, {
    season: 'winter',
    stores: { food: 500, clutter: 10 },
    run: { localHeat: true },
  });
  s = place(s, 'airSourceHeatPump', 3, 2);
  for (const [c, r] of [
    [5, 1],
    [5, 3],
    [7, 3],
    [6, 4],
  ] as const)
    s = place(s, 'solarCanopy', c, r);
  s = place(s, 'workshop', 3, 3);
  // Cottages the night can't power and heat both: their heat must come from a well, by day.
  for (const [c, r] of [
    [3, 1],
    [2, 3],
    [1, 2],
  ] as const)
    s = place(s, 'cottage', c, r);
  if (well) s = place(s, 'heatWell', 2, 1);
  const set = applyCommand(content, s, {
    type: 'setRecipe',
    uid: uidAt(s, 3, 3),
    recipe: 'clutter',
  });
  return set.ok ? set.state : s;
}

/** What a slot's energy went to: used (the card), runs, storage charged after them, unused. */
const spent = (s: RunState, slot: Slot) => {
  const e = s.lastReport!.energy[slot];
  return (
    energyUsed(s.lastReport!, slot) +
    e.sponges +
    (e.storageCharged - e.reserved) +
    (e.heat.wellsCharged ?? 0) +
    e.unused
  );
};

describe("the season card: energy made is energy, not the heat wells' heat", () => {
  it("a heat well paying the camp's night heat from its store adds no energy", () => {
    let s = scenario(VALLEY, { season: 'winter', stores: { food: 500 }, run: { localHeat: true } });
    s = place(s, 'heatWell', 3, 2);
    s.buildings[uidAt(s, 3, 2)]!.stored = 3;
    s = endSeason(s);
    const night = s.lastReport!.energy.night;
    // The ledger still counts the heat as given from storage; the card doesn't count it as energy.
    expect(night.heat.fromWells).toBe(2);
    expect(night.storageDischarged).toBe(2);
    expect(energyMade(s.lastReport!, 'night')).toBe(night.supply);
  });

  it("a slot short of energy is not covered by the wells' heat: what stays on, energy pays", () => {
    // Homes the camp can't power at night, warmed by a full heat well: its heat pays their heat,
    // never the energy they need.
    let s = scenario(VALLEY, { season: 'winter', stores: { food: 500 }, run: { localHeat: true } });
    s = place(s, 'heatWell', 3, 2);
    s.buildings[uidAt(s, 3, 2)]!.stored = 6;
    for (const [c, r] of [
      [3, 1],
      [2, 3],
      [3, 3],
    ] as const)
      s = place(s, 'cottage', c, r);
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.energy.night.heat.fromWells ?? 0).toBeGreaterThan(0);
    const powered = Object.values(r.needs).reduce((n, x) => n + (x.nightEnergy?.got ?? 0), 0);
    expect(powered).toBeLessThanOrEqual(energyMade(r, 'night'));
  });
});

describe('the season card: energy used before the runs', () => {
  it('counts the energy heat pumps spend filling heat wells for the night as used', () => {
    const s = endSeason(winter(true));
    const day = s.lastReport!.energy.day;
    expect(day.heat.wellsReserved).toBeGreaterThan(0);
    expect(energyUsed(s.lastReport!, 'day')).toBe(day.demand + day.heat.wellsReserved!);
    // What the card shows as spare is exactly what the runs had, and what was left after them.
    const spare = day.supply + day.storageDischarged - energyUsed(s.lastReport!, 'day');
    expect(spare).toBe(
      day.sponges + (day.storageCharged - day.reserved) + day.heat.wellsCharged! + day.unused,
    );
  });

  it('every slot balances: made (and the shortfall) = used + runs + charged after them + unused', () => {
    for (const well of [false, true]) {
      const s = endSeason(winter(well));
      for (const slot of ['day', 'night'] as const) {
        const e = s.lastReport!.energy[slot];
        expect(spent(s, slot), `${slot}, well ${well}`).toBe(
          energyMade(s.lastReport!, slot) + e.shortfall,
        );
      }
    }
  });

  it('with no heat well, nothing is set aside: used is the demand', () => {
    const s = endSeason(winter(false));
    for (const slot of ['day', 'night'] as const)
      expect(energyUsed(s.lastReport!, slot)).toBe(s.lastReport!.energy[slot].demand);
  });
});
