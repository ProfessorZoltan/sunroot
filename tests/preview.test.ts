import { describe, expect, it } from 'vitest';
import { previewPlacement, resolveAsIs } from '../src/sim';
import { at, content, place, scenario, uidAt } from './helpers';

const FIELDS = [
  '^ . f f ~ f f f ^ ^',
  ' ^ . f f ~ f f f . ^',
  '^ . C f ~ f f f . ^',
  ' ^ . , , ~ , , . . ^',
];

const ok = (p: ReturnType<typeof previewPlacement>) => {
  if (!p.ok) throw new Error(p.reason);
  return p;
};

describe('placement preview', () => {
  it("shows the new building's own yield", () => {
    const s = scenario(FIELDS, { season: 'autumn' });
    const p = ok(previewPlacement(content, s, 'floodplainFarm', at(5, 1)));
    expect(p.cost).toBe(3);
    expect(p.items).toContainEqual(
      expect.objectContaining({ at: at(5, 1), key: 'food', amount: 5 }),
    );
    expect(p.items).toContainEqual(expect.objectContaining({ key: 'biomass', amount: 1 }));
    expect(p.totals.food).toBe(5);
    expect(p.math).toContain('Food: 5 in autumn = 5');
  });

  it('shows effects on neighbours: an apiary gives +1 to each farm next to it', () => {
    let s = scenario(FIELDS, { season: 'autumn' });
    s = place(s, 'floodplainFarm', 5, 1);
    s = place(s, 'floodplainFarm', 7, 1);
    const p = ok(previewPlacement(content, s, 'apiary', at(6, 1)));
    const food = p.items.filter((i) => i.key === 'food');
    expect(food).toEqual([
      expect.objectContaining({ uid: uidAt(s, 5, 1), amount: 1 }),
      expect.objectContaining({ uid: uidAt(s, 7, 1), amount: 1 }),
    ]);
    expect(p.totals.food).toBe(2);
  });

  it('shows energy by slot, shading included', () => {
    const s = scenario(FIELDS, { season: 'spring' });
    const p = ok(previewPlacement(content, s, 'solarCanopy', at(8, 3)));
    expect(p.items).toEqual([expect.objectContaining({ key: 'dayEnergy', amount: 3 })]);
  });

  it('warns about the coming flood, blackouts and missing workers', () => {
    let s = scenario(FIELDS, { season: 'spring' });
    const flooded = ok(previewPlacement(content, s, 'workshop', at(5, 1)));
    expect(flooded.warnings).toContain('The flood will disable it this season.');

    s = scenario(FIELDS, { season: 'summer', citizens: 0 });
    expect(ok(previewPlacement(content, s, 'workshop', at(8, 3))).warnings).toContain(
      'No free worker: it will not run.',
    );

    s = scenario(FIELDS, { season: 'winter' });
    const dark = ok(previewPlacement(content, s, 'cottage', at(8, 3)));
    expect(dark.warnings).toContain('Not enough energy: it will be shut off.');
    expect(dark.totals.shortfall.night).toBe(2);
  });

  it('explains why a site is not allowed', () => {
    const s = scenario(FIELDS, { unlockAll: false });
    expect(previewPlacement(content, s, 'salvageYard', at(8, 3))).toEqual({
      ok: false,
      reason: "Salvage Yard can't be built on barren",
    });
    expect(previewPlacement(content, s, 'greenhouse', at(8, 3))).toEqual({
      ok: false,
      reason: 'Greenhouse is not unlocked',
    });
  });

  it('never changes the state, and accepts a cached as-is season', () => {
    const s = scenario(FIELDS, { season: 'autumn' });
    const before = JSON.stringify(s);
    const cached = resolveAsIs(content, s);
    const a = previewPlacement(content, s, 'floodplainFarm', at(5, 1), cached);
    const b = previewPlacement(content, s, 'floodplainFarm', at(5, 1));
    expect(a).toEqual(b);
    expect(JSON.stringify(s)).toBe(before);
  });
});
