/**
 * Local heat (DECISIONS.md, Teaching by layers; milestones H1 and H2): free
 * heat, heat pumps and heat wells reach only buildings within 2 tiles. These
 * tests keep heat from the grid (energy paid 1:1, reaching anywhere) so they
 * test reach alone; tests/heat-layer.test.ts tests the heat layer, where the
 * grid can't pay heat at all.
 */
import { describe, expect, it } from 'vitest';
import { canPlace, hexDistance, hexKey, type Content, type Hex, type RunState } from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';
import { act, at, endSeason, place, scenario, uidAt } from './helpers';

// River in column 4, camp at (2,2): the heat tests' valley.
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];
const CAMP = at(2, 2);

/**
 * Willow Reach with local heat on (or off), the grid still paying heat. The water-source pump
 * pays 2 heat an energy here, as it did in H1, so the tests are about reach alone.
 */
function local(on: boolean): Content {
  const raw = structuredClone(willowReach);
  raw.rules.localHeat.enabled = on;
  const pump = raw.buildings.find((b) => b.id === 'heatPump') as { heatPump?: unknown };
  pump.heatPump = { heatPerEnergy: 2, maxHeatPerSlot: 4 };
  return loadBiome(raw);
}
const L = local(true);
const P = local(false);
const winter = (c: Content) =>
  scenario(VALLEY, { content: c, season: 'winter', stores: { food: 500 } });
const put = (s: RunState, id: string, col: number, row: number, c: Content = L) =>
  place(s, id, col, row, c);
const night = (s: RunState) => s.lastReport!.energy.night;
/** The first open tile for `id` at exactly `d` tiles from `from`, in map order. */
function siteAt(s: RunState, id: string, from: Hex, d: number): Hex {
  const t = Object.values(s.map.tiles).find(
    (x) =>
      hexDistance(x, from) === d &&
      !Object.values(s.buildings).some((b) => hexKey(b.at) === hexKey(x)) &&
      canPlace(L, s, id, x).ok,
  );
  if (!t) throw new Error(`no ${id} site ${d} from ${hexKey(from)}`);
  return { q: t.q, r: t.r };
}

describe('heat pumps', () => {
  it('pay only for buildings within 2 tiles; the rest is paid from the grid', () => {
    // The pump at (5,2) reaches the cottages at (3,2) and (3,3), 2 tiles away, not the camp at 3.
    const build = (s: RunState, c: Content) => {
      let t = put(s, 'cottage', 3, 2, c);
      t = put(t, 'cottage', 3, 3, c);
      // Two river wheels, so the night isn't short and no one is shut off.
      t = put(t, 'riverWheel', 5, 1, c);
      t = put(t, 'riverWheel', 5, 3, c);
      return put(t, 'heatPump', 5, 2, c);
    };
    expect(hexDistance(at(5, 2), CAMP)).toBe(3);
    const pooled = endSeason(build(winter(P), P), P);
    const near = endSeason(build(winter(L), L), L);
    // Heat 4: the camp's 2 and the cottages' 1 each.
    expect(night(pooled).heat).toMatchObject({ demand: 4, pumped: 4, direct: 0 });
    expect(night(near).heat).toMatchObject({ demand: 4, pumped: 2, direct: 2 });
    const links = near.lastReport!.heat!.filter((l) => l.slot === 'night');
    const pump = uidAt(near, 5, 2);
    expect(links).toEqual(
      expect.arrayContaining([
        { slot: 'night', from: pump, to: uidAt(near, 3, 2), amount: 1 },
        { slot: 'night', from: pump, to: uidAt(near, 3, 3), amount: 1 },
        { slot: 'night', from: 'grid', to: 'b0', amount: 2 },
      ]),
    );
  });
});

describe('free heat', () => {
  it('reaches a greenhouse within 2 tiles of a collector, not one further', () => {
    const s0 = winter(L);
    const collector = at(7, 3);
    let near = put(s0, 'solarThermalCollector', 7, 3);
    near = put(near, 'greenhouse', 7, 1);
    let far = put(s0, 'solarThermalCollector', 7, 3);
    far = put(far, 'greenhouse', 1, 3);
    expect(hexDistance(collector, at(7, 1))).toBeLessThanOrEqual(2);
    expect(hexDistance(collector, at(1, 3))).toBeGreaterThan(2);
    near = endSeason(near, L);
    far = endSeason(far, L);
    expect(near.lastReport!.energy.day.heat).toMatchObject({ demand: 1, free: 1, direct: 0 });
    expect(far.lastReport!.energy.day.heat).toMatchObject({ demand: 1, free: 0, direct: 1 });
  });
});

describe('heat wells', () => {
  /** Two cottages beside the camp make the winter night short; a well full of heat stands by. */
  const shortNight = (s: RunState, wellAt: Hex) => {
    let t = put(s, 'cottage', 3, 2);
    t = put(t, 'cottage', 3, 3);
    t = act(t, { type: 'place', building: 'heatWell', at: wellAt }, L);
    const well = Object.values(t.buildings).find((b) => hexKey(b.at) === hexKey(wellAt))!;
    well.stored = 6;
    return endSeason(t, L);
  };

  it('cover only the heat of buildings within 2 tiles', () => {
    const s0 = winter(L);
    const near = siteAt(s0, 'heatWell', CAMP, 1);
    const far = siteAt(s0, 'heatWell', CAMP, 5);
    // Heat 4 at night (camp 2, cottages 1 + 1) and 2 energy for the cottages, against the camp's 2.
    const close = shortNight(s0, near);
    const away = shortNight(s0, far);
    expect(night(close).storageDischarged).toBeGreaterThan(0);
    expect(night(away).storageDischarged).toBe(0);
    expect(night(away).shortfall).toBeGreaterThan(night(close).shortfall);
  });

  it('charge only from collectors within 2 tiles', () => {
    const s0 = scenario(VALLEY, { content: L, season: 'spring' });
    const collector = at(7, 3);
    let near = put(s0, 'solarThermalCollector', 7, 3);
    near = put(near, 'heatWell', 7, 1);
    let far = put(s0, 'solarThermalCollector', 7, 3);
    far = put(far, 'heatWell', 1, 3);
    expect(hexDistance(collector, at(7, 1))).toBeLessThanOrEqual(2);
    expect(hexDistance(collector, at(1, 3))).toBeGreaterThan(2);
    near = endSeason(near, L);
    far = endSeason(far, L);
    expect(near.lastReport!.energy.day.heat.stored).toBe(2);
    expect(far.lastReport!.energy.day.heat.stored).toBe(0);
  });
});

describe('with local heat off', () => {
  it('a whole run plays exactly as with an unlimited range', () => {
    const withRange = (enabled: boolean, range: number): Content => {
      const raw = structuredClone(willowReach);
      raw.rules.localHeat = { ...raw.rules.localHeat, enabled, range };
      return loadBiome(raw);
    };
    const seasons = (c: Content) => {
      const out: string[] = [];
      playRun(c, BOTS.balanced!, 'heat-same', {
        onSeason: (s) => out.push(JSON.stringify([s.lastReport!.energy, s.lastReport!.blackouts])),
      });
      return out;
    };
    expect(seasons(withRange(true, 99))).toEqual(seasons(withRange(false, 2)));
  });

  it('records no heat links', () => {
    expect(endSeason(winter(P), P).lastReport!.heat).toBeNull();
  });
});
