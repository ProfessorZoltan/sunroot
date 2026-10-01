/**
 * Repairs (asked for in playtesting): damaged buildings are repaired
 * automatically at the start of a season while there are materials, unless
 * the player puts a building's repairs on hold; then it stays damaged until
 * they repair it, which they can do at any time for its repair cost.
 */
import { describe, expect, it } from 'vitest';
import { mapMarks } from '../src/game/marks';
import { applyCommand, forecastSeason, repairCost, type RunState } from '../src/sim';
import { act, content, endSeason, place, rejects, scenario, uidAt } from './helpers';

// Floodplain along both banks of a river in column 4.
const RIVER = [
  '^ . , f ~ f , . ^ ^',
  ' ^ . , f ~ f , . . ^',
  '^ . C f ~ f f . R ^',
  ' ^ . m m ~ f , . . ^',
  '^ . . , ~ f , . m ^',
  ' ^ . . , ~ f , . . ^',
];

/** A workshop on the floodplain, flooded at the end of spring. */
const flooded = (hold: boolean, materials = 50) => {
  let s = scenario(RIVER);
  s = place(s, 'workshop', 5, 5);
  if (hold) s = act(s, { type: 'setAutoRepair', uid: uidAt(s, 5, 5), auto: false });
  s = { ...s, stores: { ...s.stores, materials } };
  return endSeason(s);
};

describe('repairs', () => {
  it('by default, the flood damage is repaired at the start of the next season', () => {
    const s = flooded(false);
    const b = s.buildings[uidAt(s, 5, 5)]!;
    expect(s.lastReport!.damaged).toEqual([b.uid]);
    expect(b.damage).toBeUndefined();
    const cost = content.events.flood.repairCost;
    expect(s.notices).toContain(`Repaired Workshop after the flood for ${cost} materials`);
    expect(s.lastReport!.flows.materials!.used['Flood repairs']!.amount).toBe(cost);
  });

  it('on hold, it stays damaged and the materials stay in the stores', () => {
    const repaired = flooded(false);
    const held = flooded(true);
    const b = held.buildings[uidAt(held, 5, 5)]!;
    expect(b.damage?.cause).toBe('flood');
    expect(b.holdRepairs).toBe(true);
    expect(held.notices).toContain('Workshop is flood-damaged: repairs are on hold');
    expect(held.stores.materials - repaired.stores.materials).toBe(content.events.flood.repairCost);
    // It stays held, season after season.
    const later = endSeason(held);
    expect(later.buildings[b.uid]!.damage?.cause).toBe('flood');
  });

  it('repair now pays the cost, clears the damage, counts in the ledger, and undoes', () => {
    const held = flooded(true);
    const uid = uidAt(held, 5, 5);
    const cost = repairCost(content, held.buildings[uid]!)!;
    const fixed = act(held, { type: 'repair', uid });
    expect(fixed.buildings[uid]!.damage).toBeUndefined();
    expect(fixed.stores.materials).toBe(held.stores.materials - cost);
    // The workshop works again this season.
    const forecast = forecastSeason(content, fixed).lastReport!;
    expect(forecast.unstaffed).not.toContain(uid);
    const after = endSeason(fixed);
    expect(after.lastReport!.flows.materials!.used['Flood repairs']!.amount).toBe(cost);
    const undone = act(fixed, { type: 'undo' });
    expect(undone.buildings[uid]!.damage?.cause).toBe('flood');
    expect(undone.stores.materials).toBe(held.stores.materials);
  });

  it('turning automatic repairs back on repairs it at the start of the next season', () => {
    let s = flooded(true);
    const uid = uidAt(s, 5, 5);
    s = act(s, { type: 'setAutoRepair', uid, auto: true });
    expect(s.buildings[uid]!.holdRepairs).toBeUndefined();
    s = endSeason(s);
    expect(s.buildings[uid]!.damage).toBeUndefined();
  });

  it('refuses what it cannot do: no damage, not enough materials', () => {
    const held = flooded(true);
    const uid = uidAt(held, 5, 5);
    const poor = { ...held, stores: { ...held.stores, materials: 0 } };
    expect(rejects(poor, { type: 'repair', uid })).toMatch(/repairing it needs \d+ materials/);
    const fine = act(held, { type: 'repair', uid });
    expect(rejects(fine, { type: 'repair', uid })).toBe('the Workshop needs no repair');
    expect(rejects(held, { type: 'repair', uid: 'nope' })).toBe('unknown building nope');
  });

  it('short of materials, repairs go in priority order and the rest wait', () => {
    const setup = (materials: number, hold: boolean) => {
      let s = scenario(RIVER);
      s = place(s, 'workshop', 5, 5);
      s = place(s, 'workshop', 5, 4);
      const [first, second] = [uidAt(s, 5, 5), uidAt(s, 5, 4)];
      // Put the second workshop first in priority (after the camp).
      const order = s.priority.filter((u) => u !== second);
      order.splice(1, 0, second);
      s = act(s, { type: 'setPriority', order });
      if (hold) {
        s = act(s, { type: 'setAutoRepair', uid: first, auto: false });
        s = act(s, { type: 'setAutoRepair', uid: second, auto: false });
      }
      return { s: { ...s, stores: { ...s.stores, materials } }, first, second };
    };
    // What the season leaves in the stores when nothing is repaired...
    const probe = setup(0, true);
    const left = endSeason(probe.s).stores.materials;
    // ...so start with exactly enough for one repair.
    const cost = content.events.flood.repairCost;
    const { s, first, second } = setup(cost - left, false);
    const after = endSeason(s);
    expect(after.buildings[second]!.damage).toBeUndefined();
    expect(after.buildings[first]!.damage?.cause).toBe('flood');
    expect(after.notices).toContain(
      `Workshop is still flood-damaged: repairs need ${cost} materials`,
    );
  });
});

describe('what the player is told', () => {
  it('a damaged home is its own wellbeing line, not an unpowered one', () => {
    let s: RunState = scenario(RIVER);
    s = place(s, 'cottage', 5, 5); // on the floodplain
    const uid = uidAt(s, 5, 5);
    s = act(s, { type: 'setAutoRepair', uid, auto: false });
    s = endSeason(endSeason(s)); // flooded in spring, still damaged all summer
    const lines = s.lastReport!.wellbeing.lines;
    expect(lines.find((l) => l.kind === 'damagedHomes')?.reason).toBe('1 damaged home');
    expect(lines.some((l) => l.kind === 'unpowered')).toBe(false);
  });

  it("the map's tooltip names the real repair cost, and the hold", () => {
    const held = flooded(true);
    const forecast = forecastSeason(content, held).lastReport;
    const mark = mapMarks(content, held, forecast).find((m) => m.kind === 'damaged')!;
    expect(mark.text).toMatch(/repairs on hold\. Repair it from its panel \(\d+ materials\)/);
    const auto = applyCommand(content, held, {
      type: 'setAutoRepair',
      uid: uidAt(held, 5, 5),
      auto: true,
    });
    const s = auto.ok ? auto.state : held;
    const text = mapMarks(content, s, forecastSeason(content, s).lastReport).find(
      (m) => m.kind === 'damaged',
    )!.text;
    expect(text).toBe(
      `Flood-damaged: idle until repaired for ${content.events.flood.repairCost} materials.`,
    );
  });
});
