/**
 * More varied expeditions (asked for in playtesting): each expedition is a
 * valley region (a variation of the map) as well as a twist, and new twists
 * change how a run plays rather than only making it harder.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  computeHarmony,
  createCity,
  createRun,
  effectiveContent,
  expeditionOffer,
  forecastSeason,
  generateMap,
  hexDistance,
  hexKey,
  nextRunOptions,
  scoreRun,
  type CityState,
  type RunExpedition,
  type RunState,
} from '../src/sim';
import { computeInsight } from '../src/game/insight';
import { content, endSeason, place, scenario, uidAt } from './helpers';

const SEEDS = Array.from({ length: 40 }, (_, i) => `valley-${i}`);
const run = (seed: string, expedition: RunExpedition) => createRun(content, { seed, expedition });
const inRegion = (seed: string, region: string | null) =>
  run(seed, { twist: null, request: null, region });
const count = (s: RunState, type: string) =>
  Object.values(s.map.tiles).filter((t) => t.type === type).length;
const avg = (region: string | null, type: string) =>
  SEEDS.reduce((n, seed) => n + count(inRegion(seed, region), type), 0) / SEEDS.length;
const riverDistance = (s: RunState, key: string) =>
  Math.min(...s.map.river.map((k) => hexDistance(s.map.tiles[k]!, s.map.tiles[key]!)));

describe('regions: variations of the valley', () => {
  it('The Reach is the valley as it was: the same map as a run with no region', () => {
    for (const seed of SEEDS.slice(0, 10))
      expect(inRegion(seed, 'theReach').map).toEqual(inRegion(seed, null).map);
  });

  it('every region makes a playable valley on every seed: a river, a camp, the starting Harmony', () => {
    for (const region of content.regions) {
      const valley = effectiveContent(content, {
        tunings: [],
        charters: [],
        options: { expedition: { twist: null, region: region.id } },
      });
      for (const seed of SEEDS) {
        const s = inRegion(seed, region.id);
        expect(s.map.river).toHaveLength(valley.map.height);
        expect(s.map.tiles[hexKey(s.buildings.b0!.at)]).toBeDefined();
        expect(computeHarmony(content, s)).toBe(valley.map.startingHarmony);
      }
    }
  });

  it('Oxbow Lakes: still water off the river, ringed with floodplain, that a weir never drains', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const s = inRegion(seed, 'oxbowLakes');
      const lakes = Object.entries(s.map.tiles).filter(([, t]) => t.type === 'reservoir');
      expect(lakes.length).toBeGreaterThanOrEqual(2);
      for (const [key] of lakes) {
        expect(s.map.river).not.toContain(key);
        expect(riverDistance(s, key)).toBeGreaterThanOrEqual(2);
      }
    }
    expect(avg('oxbowLakes', 'floodplain')).toBeGreaterThan(avg(null, 'floodplain') + 5);
    // A weir built and demolished leaves the lakes as they were.
    let s = { ...inRegion('valley-1', 'oxbowLakes'), unlocked: ['weir'] };
    s.stores.materials = 200;
    const lakes = Object.keys(s.map.tiles).filter((k) => s.map.tiles[k]!.type === 'reservoir');
    const weirAt = s.map.tiles[s.map.river[6]!]!;
    const placed = applyCommand(content, s, { type: 'place', building: 'weir', at: weirAt });
    expect(placed.ok).toBe(true);
    s = placed.ok ? placed.state : s;
    const uid = Object.values(s.buildings).find((b) => b.type === 'weir')!.uid;
    const gone = applyCommand(content, s, { type: 'demolish', uid });
    expect(gone.ok).toBe(true);
    if (gone.ok) for (const k of lakes) expect(gone.state.map.tiles[k]!.type).toBe('reservoir');
  });

  it('The Broad Wash: floodplain two tiles deep on both banks', () => {
    expect(avg('broadWash', 'floodplain')).toBeGreaterThan(avg(null, 'floodplain') * 1.8);
    const s = inRegion('valley-3', 'broadWash');
    const twoOut = Object.keys(s.map.tiles).filter((k) => riverDistance(s, k) === 2);
    const wet = twoOut.filter((k) => s.map.tiles[k]!.type === 'floodplain');
    expect(wet.length).toBeGreaterThan(twoOut.length * 0.6); // all but the bluff
  });

  it('Old Town: nine ruins of 30 salvage; Old Grove: six groves and Harmony 24, the usual 5 ruins', () => {
    for (const seed of SEEDS.slice(0, 10)) {
      const town = inRegion(seed, 'oldTown');
      const ruins = Object.values(town.map.tiles).filter((t) => t.type === 'ruin');
      expect(ruins).toHaveLength(9);
      expect(ruins.every((t) => t.salvage === 30)).toBe(true);
      const grove = inRegion(seed, 'oldGrove');
      expect(count(grove, 'woodland')).toBe(6);
      expect(count(grove, 'ruin')).toBe(5);
      expect(grove.harmony).toBe(24);
    }
  });

  it('High Banks: more hills and less floodplain; Wandering River: the river reaches the edges', () => {
    expect(avg('highBanks', 'hill')).toBeGreaterThan(avg(null, 'hill') + 15);
    expect(avg('highBanks', 'floodplain')).toBeLessThan(avg(null, 'floodplain') * 0.7);
    const cols = (region: string | null) =>
      SEEDS.flatMap((seed) => {
        const s = inRegion(seed, region);
        return s.map.river.map((k) => Object.keys(s.map.tiles).indexOf(k) % s.map.width);
      });
    expect(Math.min(...cols('wanderingRiver'))).toBeLessThanOrEqual(3);
    expect(Math.max(...cols('wanderingRiver'))).toBeGreaterThanOrEqual(8);
    expect(Math.min(...cols(null))).toBeGreaterThanOrEqual(3);
  });
});

describe('a hard valley lifts the Graft', () => {
  it('High Banks lifts it a tier, and with a hard twist two, never past Heartwood', () => {
    const ended = (region: string | null, twist: string | null) => {
      const s = inRegion('lift', region);
      return {
        ...s,
        options: { ...s.options, expedition: { twist, request: null, region } },
        status: 'complete' as const,
        harmony: 0,
        citizens: 0,
        turn: 48,
      };
    };
    const plain = scoreRun(content, ended(null, null));
    expect(plain.tier.id).toBe('seedling');
    const banks = scoreRun(content, ended('highBanks', null));
    expect(banks.total).toBe(plain.total);
    expect(banks.lift).toEqual({ tiers: 1, by: 'High Banks' });
    expect(banks.tier.id).toBe('sapling');
    const both = scoreRun(content, ended('highBanks', 'droughtYear'));
    expect(both.lift).toEqual({ tiers: 2, by: 'High Banks and Drought Year' });
    expect(both.tier.id).toBe('heartwood');
    expect(scoreRun(content, ended('oxbowLakes', null)).lift).toBeNull();
  });
});

describe('expeditions offer regions', () => {
  const later = (): CityState => ({ ...createCity(content, 'valleys'), runs: 2 });

  it('3 different regions, carried into the run, whose map the card shows', () => {
    const offer = expeditionOffer(content, later());
    expect(new Set(offer.map((o) => o.region)).size).toBe(3);
    const city = { ...later(), expedition: offer[1]! };
    const options = nextRunOptions(content, city);
    expect(options.expedition?.region).toBe(offer[1]!.region);
    // The card's thumbnail generates the map the run will play.
    const valley = effectiveContent(content, {
      tunings: [],
      charters: [],
      options: { expedition: { twist: offer[1]!.twist, region: offer[1]!.region } },
    });
    expect(createRun(content, options).map).toEqual(generateMap(valley, offer[1]!.seed).map);
  });

  it('an expedition chosen before regions existed sets out to the valley as it is', () => {
    const offer = expeditionOffer(content, later());
    const { region: _r, ...old } = offer[0]!;
    const options = nextRunOptions(content, { ...later(), expedition: old });
    expect(options.expedition?.region).toBeNull();
  });
});

// Floodplain along both banks of a river in column 4.
const RIVER = [
  '^ . , f ~ f , . ^ ^',
  ' ^ . , f ~ f , . . ^',
  '^ . C f ~ f f . R ^',
  ' ^ . m m ~ f , . . ^',
];
const HILLS = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'];
const twist = (id: string | null) => ({ run: { expedition: { twist: id, request: null } } });

describe('new twists change how a run plays', () => {
  it('Rich Silt: twice the silt, dearer repairs', () => {
    const summerFood = (id: string | null) => {
      let s = scenario(RIVER, twist(id));
      s = place(s, 'floodplainFarm', 5, 1);
      s = endSeason(endSeason(s));
      return s.lastReport!.yields[uidAt(s, 5, 1)]!.food!;
    };
    expect(summerFood(null)).toBe(6); // 4 + 50%
    expect(summerFood('richSilt')).toBe(8); // 4 + 100%
    const rules = (id: string | null) =>
      effectiveContent(content, { tunings: [], charters: [], options: twist(id).run });
    expect(rules('richSilt').events.flood.repairCost).toBe(rules(null).events.flood.repairCost + 2);
  });

  it('Steady Winds and Clear Skies trade wind against solar', () => {
    // In winter: no storm to damage the spire.
    const winterEnergy = (id: string | null, building: string, col: number, row: number) => {
      let s = scenario(HILLS, { season: 'winter', ...twist(id) });
      s = place(s, building, col, row);
      s = endSeason(s);
      return s.lastReport!.generated[uidAt(s, col, row)]!.energy;
    };
    const base = winterEnergy(null, 'windSpire', 0, 0);
    expect(winterEnergy('steadyWinds', 'windSpire', 0, 0)).toEqual({
      day: base.day + 1,
      night: base.night + 1,
    });
    expect(winterEnergy('clearSkies', 'windSpire', 0, 0)).toEqual({
      day: base.day - 1,
      night: base.night - 1,
    });
    const solar = winterEnergy(null, 'solarCanopy', 6, 2);
    expect(winterEnergy('clearSkies', 'solarCanopy', 6, 2).day).toBe(solar.day + 1);
    const storms = effectiveContent(content, {
      tunings: [],
      charters: [],
      options: twist('steadyWinds').run,
    });
    expect(storms.events.storm.disableCount).toBe(2);
  });

  it('Lean Start: 5 materials, 4 food and 4 citizens, the Graft a tier higher', () => {
    const s = run('lean', { twist: 'leanStart', request: null });
    expect([s.stores.materials, s.stores.food, s.citizens]).toEqual([5, 4, 4]);
    expect(content.twists.find((t) => t.id === 'leanStart')!.graftTierBonus).toBe(1);
  });

  it('Big Families: citizens arrive two at a time, but only when the harvest leaves 4 spare', () => {
    // Summer: each floodplain farm makes 4 food; 6 citizens eat 6.
    const FARMS: [number, number][] = [
      [3, 0],
      [5, 0],
      [3, 1],
    ];
    const grow = (id: string | null, farms: number) => {
      let s = scenario(RIVER, { ...twist(id), season: 'summer', wellbeing: 70, citizens: 6 });
      s = place(s, 'cottage', 7, 3); // room for more
      for (const [c, r] of FARMS.slice(0, farms)) s = place(s, 'floodplainFarm', c, r);
      const report = endSeason(s).lastReport!;
      return { spare: report.food.produced - report.food.eaten, change: report.population.change };
    };
    expect(grow(null, 3)).toEqual({ spare: 6, change: 1 });
    expect(grow('bigFamilies', 3)).toEqual({ spare: 6, change: 2 });
    expect(grow(null, 2)).toEqual({ spare: 2, change: 1 });
    expect(grow('bigFamilies', 2)).toEqual({ spare: 2, change: 0 });
  });

  it("Scavengers' Valley: richer ruins, costlier clutter", () => {
    const s = run('scavenge', { twist: 'scavengers', request: null });
    const ruins = Object.values(s.map.tiles).filter((t) => t.type === 'ruin');
    expect(ruins.every((t) => t.salvage === 36)).toBe(true);
    const plain = run('scavenge', { twist: null, request: null });
    const harmony = (state: RunState, clutter: number) =>
      computeHarmony(
        effectiveContent(content, { tunings: [], charters: [], options: state.options }),
        { ...state, stores: { ...state.stores, clutter } },
      );
    expect(harmony(s, 0) - harmony(s, 3)).toBe(6);
    expect(harmony(plain, 0) - harmony(plain, 3)).toBe(3);
  });
});

describe('the hard twists bite (asked for in playtesting)', () => {
  const rulesOf = (id: string | null) =>
    effectiveContent(content, { tunings: [], charters: [], options: twist(id).run });

  it('Drought Year: every farm keeps a quarter of its summer food, even beside the river', () => {
    const summer = (id: string | null) => {
      let s = scenario(RIVER, { ...twist(id), season: 'summer' });
      s = place(s, 'floodplainFarm', 5, 1); // next to the river
      s = endSeason(s);
      return { food: s.lastReport!.yields[uidAt(s, 5, 1)]!.food!, dried: s.lastReport!.dried };
    };
    const plain = summer(null);
    const dry = summer('droughtYear');
    expect(plain.dried).toEqual([]);
    expect(dry.dried).toHaveLength(1);
    expect(dry.food).toBeLessThanOrEqual(Math.ceil(plain.food / 4));
  });

  it('Long Winter: colder nights from autumn to spring, and weaker solar', () => {
    const base = rulesOf(null);
    const cold = rulesOf('longWinter');
    for (const home of ['foundersCamp', 'cottage', 'treehouseCommons']) {
      const night = (c: typeof base) => c.byId[home]!.demand!.heat.night;
      expect(night(cold)[3]! - night(base)[3]!).toBe(4);
      expect(night(cold)[2]! - night(base)[2]!).toBe(3);
      expect(night(cold)[0]! - night(base)[0]!).toBe(2);
    }
    const solar = (c: typeof base) => c.byId.solarCanopy!.generation!.day;
    expect(solar(cold)[2]).toBe(solar(base)[2]! - 1);
    expect(solar(cold)[3]).toBe(Math.max(0, solar(base)[3]! - 1));
  });

  it('Wild Storms: open land is exposed, the Mixed Grid gives no shelter, damage waits for repairs', () => {
    const mixed = { solarCanopy: 10, riverWheel: 10, windSpire: 10 };
    const autumn = (id: string | null, materials = 200) => {
      let s = scenario(RIVER, { ...twist(id), season: 'autumn' });
      s = { ...s, energyHistory: [mixed, mixed, mixed, mixed] };
      s = place(s, 'cottage', 7, 3); // barren land, not a hill
      s = { ...s, stores: { ...s.stores, materials } };
      return endSeason(s);
    };
    const calm = autumn(null);
    expect(calm.lastReport!.exposed).toEqual([]);
    const wild = autumn('wildStorms');
    expect(wild.lastReport!.mixedGrid).toBe(true);
    expect(wild.lastReport!.damaged).toContain(uidAt(wild, 7, 3));
    // Repaired at the start of winter for 3 materials, like flood damage...
    expect(wild.buildings[uidAt(wild, 7, 3)]!.damage).toBeUndefined();
    expect(wild.notices).toContain('Repaired Cottage after the storm for 3 materials');
    // ...and still damaged while there is nothing to repair it with.
    const broke = autumn('wildStorms', 0);
    expect(broke.buildings[uidAt(broke, 7, 3)]!.damage?.cause).toBe('storm');
    expect(broke.notices).toContain('Cottage is still storm-damaged: repairs need 3 materials');
    expect(rulesOf('wildStorms').events.storm.repairCost).toBe(3);
  });

  it('without the twist, storms stay as they were: hills only, a season of damage, the Mixed Grid shelters', () => {
    const storm = content.events.storm;
    expect(storm.exposedOn).toEqual(['hill']);
    expect(storm.mixedGridShelters).toBe(true);
    expect(storm.repairCost).toBe(0);
    let s = scenario(HILLS, { season: 'autumn' });
    s = place(s, 'windSpire', 9, 1);
    s = endSeason(s);
    expect(s.lastReport!.damaged).toHaveLength(1);
    expect(Object.values(s.buildings).some((b) => b.damage)).toBe(false);
  });
});

describe("a run's modifiers apply once", () => {
  it('the year strip forecasts a Long Winter without applying it twice', () => {
    const s = run('winter-forecast', { twist: 'longWinter', request: null });
    const insight = computeInsight(content, s, forecastSeason(content, s));
    const winter = insight.year[3]!.day.report!;
    const rules = effectiveContent(content, s);
    // Solar canopies make 0 by day in a Long Winter, not less: the forecast resolves.
    expect(rules.byId.solarCanopy!.generation!.day[3]).toBe(0);
    expect(winter.season).toBe('winter');
    expect(() => effectiveContent(rules, s)).toThrow(/already applied/);
  });
});
