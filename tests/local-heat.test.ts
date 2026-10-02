/**
 * Local heat (DECISIONS.md, Teaching by layers; milestone H1): free heat,
 * heat pumps and heat wells reach only buildings within 2 tiles; energy paid
 * 1:1 from the grid reaches anywhere. Off in the game until it can be seen,
 * so these tests turn it on with the run option.
 */
import { describe, expect, it } from 'vitest';
import {
  canPlace,
  createCity,
  hexDistance,
  nextRunOptions,
  teaching,
  type CityState,
  hexKey,
  loadContent,
  type Content,
  type Hex,
  type RunState,
} from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { BOTS } from '../src/balance/bots';
import { playRun } from '../src/balance/runner';
import { act, at, content, endSeason, place, scenario, uidAt } from './helpers';

// River in column 4, camp at (2,2): the heat tests' valley.
const VALLEY = [
  '^ ^ ^ . ~ . , . ^ ^',
  ' ^ ^ . , ~ , . , . ^',
  '^ ^ C , ~ , W . ^ ^',
  ' ^ . , , ~ , . . ^ ^',
  '^ ^ . , ~ , . , . ^',
];
const CAMP = at(2, 2);

const winter = (local: boolean) =>
  scenario(VALLEY, { season: 'winter', stores: { food: 500 }, run: { localHeat: local } });
const night = (s: RunState) => s.lastReport!.energy.night;
/** The first open tile for `id` at exactly `d` tiles from `from`, in map order. */
function siteAt(s: RunState, id: string, from: Hex, d: number): Hex {
  const t = Object.values(s.map.tiles).find(
    (x) =>
      hexDistance(x, from) === d &&
      !Object.values(s.buildings).some((b) => hexKey(b.at) === hexKey(x)) &&
      canPlace(content, s, id, x).ok,
  );
  if (!t) throw new Error(`no ${id} site ${d} from ${hexKey(from)}`);
  return { q: t.q, r: t.r };
}

describe('heat pumps', () => {
  it('pay only for buildings within 2 tiles; the rest is paid from the grid', () => {
    // The pump at (5,2) reaches the cottages at (3,2) and (3,3), 2 tiles away, not the camp at 3.
    const build = (s: RunState) => {
      let t = place(s, 'cottage', 3, 2);
      t = place(t, 'cottage', 3, 3);
      // Two river wheels, so the night isn't short and no one is shut off.
      t = place(t, 'riverWheel', 5, 1);
      t = place(t, 'riverWheel', 5, 3);
      return place(t, 'heatPump', 5, 2);
    };
    expect(hexDistance(at(5, 2), CAMP)).toBe(3);
    const pooled = endSeason(build(winter(false)));
    const local = endSeason(build(winter(true)));
    // Heat 4: the camp's 2 and the cottages' 1 each.
    expect(night(pooled).heat).toMatchObject({ demand: 4, pumped: 4, direct: 0 });
    expect(night(local).heat).toMatchObject({ demand: 4, pumped: 2, direct: 2 });
    const links = local.lastReport!.heat!.filter((l) => l.slot === 'night');
    const pump = uidAt(local, 5, 2);
    expect(links).toEqual(
      expect.arrayContaining([
        { slot: 'night', from: pump, to: uidAt(local, 3, 2), amount: 1 },
        { slot: 'night', from: pump, to: uidAt(local, 3, 3), amount: 1 },
        { slot: 'night', from: 'grid', to: 'b0', amount: 2 },
      ]),
    );
  });
});

describe('free heat', () => {
  it('reaches a greenhouse within 2 tiles of a collector, not one further', () => {
    const s0 = winter(true);
    const collector = at(7, 3);
    let near = place(s0, 'solarThermalCollector', 7, 3);
    near = place(near, 'greenhouse', 7, 1);
    let far = place(s0, 'solarThermalCollector', 7, 3);
    far = place(far, 'greenhouse', 1, 3);
    expect(hexDistance(collector, at(7, 1))).toBeLessThanOrEqual(2);
    expect(hexDistance(collector, at(1, 3))).toBeGreaterThan(2);
    near = endSeason(near);
    far = endSeason(far);
    expect(near.lastReport!.energy.day.heat).toMatchObject({ demand: 1, free: 1, direct: 0 });
    expect(far.lastReport!.energy.day.heat).toMatchObject({ demand: 1, free: 0, direct: 1 });
  });
});

describe('heat wells', () => {
  /** Two cottages beside the camp make the winter night short; a well full of heat stands by. */
  const shortNight = (s: RunState, wellAt: Hex) => {
    let t = place(s, 'cottage', 3, 2);
    t = place(t, 'cottage', 3, 3);
    t = act(t, { type: 'place', building: 'heatWell', at: wellAt });
    const well = Object.values(t.buildings).find((b) => hexKey(b.at) === hexKey(wellAt))!;
    well.stored = 6;
    return endSeason(t);
  };

  it('cover only the heat of buildings within 2 tiles', () => {
    const s0 = winter(true);
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
    const s0 = scenario(VALLEY, { season: 'spring', run: { localHeat: true } });
    const collector = at(7, 3);
    let near = place(s0, 'solarThermalCollector', 7, 3);
    near = place(near, 'heatWell', 7, 1);
    let far = place(s0, 'solarThermalCollector', 7, 3);
    far = place(far, 'heatWell', 1, 3);
    expect(hexDistance(collector, at(7, 1))).toBeLessThanOrEqual(2);
    expect(hexDistance(collector, at(1, 3))).toBeGreaterThan(2);
    near = endSeason(near);
    far = endSeason(far);
    expect(near.lastReport!.energy.day.heat.stored).toBe(2);
    expect(far.lastReport!.energy.day.heat.stored).toBe(0);
  });
});

describe('the teaching ladder', () => {
  it('local heat is on no rung until it can be seen, even with the full valley', () => {
    expect(content.progression!.teaching.localHeat).toBeUndefined();
    expect(teaching(content, 4).localHeat).toBe(false);
    const city: CityState = { ...createCity(content, 'h'), runs: 5, fullValley: true };
    expect(nextRunOptions(content, city).localHeat).toBeUndefined();
  });
});

describe('with local heat off', () => {
  it('a whole run plays exactly as with an unlimited range', () => {
    const withRange = (enabled: boolean, range: number): Content => {
      const raw = structuredClone(willowReach);
      raw.rules.localHeat = { enabled, range };
      return loadContent(raw);
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
    expect(endSeason(winter(false)).lastReport!.heat).toBeNull();
  });
});
