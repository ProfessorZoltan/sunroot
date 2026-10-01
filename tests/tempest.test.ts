/**
 * Tempest levels (DESIGN.md, Root City and progression): 1 to 10, unlocked
 * one at a time by a Heartwood Graft at the level below. Level N plays with
 * the hardships of levels 1 to N; the run earns more Seeds, and its Graft
 * carries the Tempest mark into Root City.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCityCommand,
  createCity,
  createRun,
  effectiveContent,
  makeCitySave,
  nextRunOptions,
  readCity,
  seedsForRun,
  type CityCommand,
  type CityState,
  type Graft,
  type RunState,
} from '../src/sim';
import { content, scenario } from './helpers';

const LEVELS = content.tempest.levels.length;
const top = content.rules.score.tiers.at(-1)!.id;
const graft = (tempest = 0): Graft => ({
  district: 'orchardWard',
  tier: top,
  score: 400,
  seeds: 40,
  seed: 'test',
  vision: null,
  visionAchieved: false,
  sentAt: '2026-10-01T00:00:00Z',
  ...(tempest ? { tempest } : {}),
});
const apply = (city: CityState, command: CityCommand) => {
  const r = applyCityCommand(content, city, command);
  if (!r.ok) throw new Error(r.error);
  return r;
};
const home = (city: CityState, tier: string, tempest: number, planted = false) =>
  apply(city, {
    type: 'sendHome',
    result: {
      graft: planted ? graft(tempest) : null,
      earned: 40,
      spent: planted ? 35 : 0,
      tier,
      tempest,
    },
  });
const rulesAt = (tempest: number, twist: string | null = null) =>
  effectiveContent(content, {
    tunings: [],
    charters: [],
    options: { expedition: { twist, tempest } },
  });

describe('Tempest levels', () => {
  it('are ten, each one lasting hardship', () => {
    expect(LEVELS).toBe(10);
    for (const l of content.tempest.levels) expect(l.modifiers.length, l.id).toBeGreaterThan(0);
  });

  it('stack: level N plays with the hardships of levels 1 to N', () => {
    const base = rulesAt(0);
    const four = rulesAt(4);
    expect(four.byId.cottage!.demand!.heat.night[3]).toBe(
      base.byId.cottage!.demand!.heat.night[3]! + 1,
    );
    expect(four.rules.draftCards).toBe(base.rules.draftCards - 1);
    expect(four.rules.citizensPerScrap).toBe(base.rules.citizensPerScrap - 1);
    expect(four.rules.compostPerTileStep).toBe(base.rules.compostPerTileStep + 2);
    // Level 5's hardship is not in level 4.
    expect(four.rules.population.growAt).toBe(base.rules.population.growAt);
    expect(rulesAt(5).rules.population.growAt).toBe(base.rules.population.growAt + 10);
    expect(rulesAt(8).rules.wellbeing.allNeedsMet).toBe(0);
    expect(rulesAt(10).byId.cottage!.housing).toBe(base.byId.cottage!.housing - 1);
    expect(rulesAt(10).rules.expectations!.base).toBe(base.rules.expectations!.base - 10);
  });

  it('every level works with every region, twist, era, perk, charter and tuning', () => {
    const tiers = content.rules.score.tiers.map((t) => t.id);
    for (const region of [null, ...content.regions.map((r) => r.id)])
      for (const twist of content.twists)
        for (const era of [1, 2, 3, 4]) {
          const sources = {
            tunings: content.tunings.map((t) => t.id),
            charters: content.charters.map((c) => c.id),
            era,
            options: {
              city: {
                districts: Object.fromEntries(content.districts.map((d) => [d.id, tiers.at(-1)!])),
                landmarks: content.landmarks.map((l) => l.id),
              },
              expedition: { twist: twist.id, region, tempest: LEVELS },
            },
          };
          expect(
            () => effectiveContent(content, sources),
            `${region} ${twist.id} ${era}`,
          ).not.toThrow();
        }
    // And a run starts at the highest level, in every region with every twist.
    for (const region of content.regions)
      for (const twist of content.twists)
        expect(() =>
          createRun(content, {
            seed: `t-${region.id}-${twist.id}`,
            expedition: { twist: twist.id, request: null, region: region.id, tempest: LEVELS },
          }),
        ).not.toThrow();
  });

  it('earn more Seeds, level by level', () => {
    const ended = (tempest: number): RunState => {
      const s = scenario(['^ . C , ~ , . . ^'], {
        run: { expedition: { twist: null, request: null, tempest } },
      });
      return { ...s, status: 'complete', turn: 48 };
    };
    const plain = seedsForRun(content, ended(0));
    const three = seedsForRun(content, ended(3));
    expect(three.lines.at(-1)).toEqual({
      reason: 'Tempest 3',
      points: 3 * content.tempest.seedsPerLevel,
    });
    expect(three.total - plain.total).toBe(3 * content.tempest.seedsPerLevel);
  });
});

describe('Tempest in Root City', () => {
  it('a Heartwood Graft unlocks the next level, one at a time, up to the last', () => {
    let city = createCity(content, 'tempest');
    expect(city.tempestUnlocked).toBeUndefined();
    // Not a Heartwood Graft: nothing opens.
    city = home(city, 'sapling', 0).city;
    expect(city.tempestUnlocked).toBeUndefined();
    const first = home(city, top, 0);
    expect(first.city.tempestUnlocked).toBe(1);
    expect(first.events).toContainEqual({ kind: 'tempest', level: 1 });
    // A Heartwood Graft below the highest level opens nothing new.
    city = home({ ...first.city, tempestUnlocked: 5 }, top, 2).city;
    expect(city.tempestUnlocked).toBe(5);
    city = home(city, top, 5).city;
    expect(city.tempestUnlocked).toBe(6);
    city = home({ ...city, tempestUnlocked: LEVELS }, top, LEVELS).city;
    expect(city.tempestUnlocked).toBe(LEVELS);
  });

  it('the level is chosen up to the highest unlocked, and the next run plays it', () => {
    let city: CityState = { ...createCity(content, 'tempest'), tempestUnlocked: 3 };
    const r = applyCityCommand(content, city, { type: 'setTempest', level: 4 });
    expect(r.ok ? '' : r.error).toBe('Tempest 4 is not unlocked yet');
    city = apply(city, { type: 'setTempest', level: 3 }).city;
    expect(nextRunOptions(content, city).expedition?.tempest).toBe(3);
    city = apply(city, { type: 'setTempest', level: 0 }).city;
    expect(city.tempest).toBeUndefined();
    expect(nextRunOptions(content, city).expedition?.tempest).toBeUndefined();
  });

  it('the Graft carries the Tempest mark to its district', () => {
    let city = createCity(content, 'mark');
    city = home(city, top, 4, true).city;
    city = apply(city, { type: 'place', slot: 0 }).city;
    expect(city.districts[0]!.tempest).toBe(4);
    city = home(city, top, 0, true).city;
    city = apply(city, { type: 'place', slot: 1 }).city;
    expect(city.districts[1]!.tempest).toBeUndefined();
  });

  it('a city saved before Tempest reads as having none', () => {
    const old = createCity(content, 'old');
    const save = JSON.parse(JSON.stringify(makeCitySave(old, 'then')));
    const read = readCity(content, save, 'x');
    expect(read.ok && read.city.tempestUnlocked).toBeUndefined();
    expect(read.ok && nextRunOptions(content, read.city).expedition?.tempest).toBeUndefined();
  });
});
