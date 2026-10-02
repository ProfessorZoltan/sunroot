/**
 * Wildlife and festivals (EXPANSION.md, E4). Animals arrive at the start of a
 * season once Harmony is at their threshold and their habitat is on the map,
 * and leave when either is gone; their effects match the tables in
 * EXPANSION.md. Both join with the water system, so these tests turn it on.
 */
import { describe, expect, it } from 'vitest';
import willowReach from '../src/content/willow-reach.json';
import {
  computeHarmony,
  loadContent,
  festivalThisSeason,
  habitatOf,
  hexDistance,
  hexKey,
  welcomes,
  type RunState,
  type Season,
} from '../src/sim';
import { act, at, content, endSeason, place, rejects, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });
const animal = (id: string) => W.wildlife.find((a) => a.id === id)!;

/**
 * River down the left, floodplain beside it, meadows, and a wood of 32 tiles
 * (Harmony 88 before clutter). One woodland tile touches the river at row 6.
 */
const VALLEY = [
  '~ f m m m W W W W',
  '~ f m m m W W W W',
  '~ f m m m W W W W',
  '~ f m m m W W W W',
  '~ f m m m W W W W',
  '~ f m m m W W W W',
  '~ W m m m W W W W',
  '~ f m m m W W W W',
  '~ f m m m , , , C',
];

const start = (season: Season = 'spring', rows = VALLEY): RunState =>
  // Two citizens make no scraps, so clutter (and Harmony) holds still.
  scenario(rows, { content: W, season, citizens: 2, stores: { food: 500, knowledge: 0 } });
const end = (s: RunState) => endSeason(s, W);

/** Brings Harmony down to `target` with clutter (1 Harmony each). */
function harmonyAt(s: RunState, target: number): RunState {
  const clutter = computeHarmony(W, { ...s, stores: { ...s.stores, clutter: 0 } }) - target;
  expect(clutter).toBeGreaterThanOrEqual(0);
  s.stores.clutter = clutter;
  s.harmony = computeHarmony(W, s);
  expect(s.harmony).toBe(target);
  return s;
}

/** Puts a building straight onto the map (a reed bed without laying its channel). */
function put(s: RunState, type: string, col: number, row: number): RunState {
  const uid = `b${s.nextUid++}`;
  s.buildings[uid] = { uid, type, at: at(col, row), builtTurn: s.turn };
  s.priority.push(uid);
  return s;
}

/**
 * Every animal's habitat: a reed bed by the river, and (for the beavers) a weir
 * by the woodland. The weir is left out otherwise: at Harmony 50 it becomes a
 * Beaver Dam, whose own Harmony would move the thresholds under test.
 */
const withHabitats = (weir = true) => {
  const s = put(start(), 'reedBed', 1, 1);
  return weir ? place(s, 'weir', 0, 6, W) : s;
};

describe('animals arrive at their Harmony thresholds (EXPANSION.md, Wildlife)', () => {
  it.each([
    ['wildBees', 20],
    ['otters', 40],
    ['beavers', 50],
    ['deer', 70],
  ])('%s at Harmony %i, not one below', (id, threshold) => {
    const a = animal(id);
    expect(a.harmony).toBe(threshold);
    expect(habitatOf(withHabitats(), a).tiles.length).toBeGreaterThan(0);
    expect(welcomes(harmonyAt(withHabitats(), threshold - 1), a)).toBe(false);
    expect(welcomes(harmonyAt(withHabitats(), threshold), a)).toBe(true);

    // As the next season starts, they come, with a notice; not one Harmony short.
    const after = (h: number) => {
      const s = harmonyAt(withHabitats(id === 'beavers'), h);
      s.wildlife = [];
      return end(s);
    };
    const came = after(threshold);
    expect(came.wildlife).toContain(id);
    expect(came.notices).toContain(`${a.name} have come to the valley`);
    expect(after(threshold - 1).wildlife).not.toContain(id);
  });

  it('no habitat, no animals, however high Harmony is', () => {
    // No reed bed, no weir, no woodland: only the bees' meadows.
    const s = start('spring', ['~ f m m m m', '~ f m m m m', '~ f m m m C']);
    s.stores.clutter = 0;
    for (const id of ['otters', 'beavers', 'deer'])
      expect(habitatOf(s, animal(id)).tiles).toEqual([]);
    expect(end(s).wildlife).toEqual([]);
  });

  it('they leave when Harmony falls below their threshold', () => {
    let s = harmonyAt(withHabitats(), 20);
    s = end(s);
    expect(s.wildlife).toContain('wildBees');
    s.stores.clutter += 1;
    s = end(s);
    expect(s.wildlife).not.toContain('wildBees');
    expect(s.notices).toContain('Wild bees have left: Harmony fell below 20');
  });

  it('they leave when their habitat is gone', () => {
    let s = harmonyAt(withHabitats(), 45);
    s = end(s);
    expect(s.wildlife).toContain('otters');
    s = act(s, { type: 'demolish', uid: uidAt(s, 1, 1) }, W);
    s = end(s);
    expect(s.wildlife).not.toContain('otters');
    expect(s.notices).toContain('Otters have left: their habitat is gone');
  });

  it('none without the water system', () => {
    let s = scenario(VALLEY, { citizens: 2, stores: { food: 500 } });
    s = endSeason(s);
    expect(s.wildlife).toEqual([]);
    expect(s.lastReport!.wildlife).toBeNull();
  });
});

describe('what the animals do (EXPANSION.md, Wildlife)', () => {
  /** The season's food from one building, with and without the animal. */
  const foodOf = (s: RunState, col: number, row: number) =>
    s.lastReport!.yields[uidAt(s, col, row)]?.food ?? 0;

  it('wild bees: a farm next to 2+ meadow tiles makes 1 more food in summer', () => {
    const farms = (season: Season, bees: boolean) => {
      let s = start(season);
      // (1,3) touches 3 meadow tiles; (1,2) only 1.
      s = place(s, 'floodplainFarm', 1, 3, W);
      s = place(s, 'floodplainFarm', 1, 2, W);
      s.wildlife = bees ? ['wildBees'] : [];
      return end(s);
    };
    const withBees = farms('summer', true);
    const without = farms('summer', false);
    expect(foodOf(withBees, 1, 3) - foodOf(without, 1, 3)).toBe(1);
    expect(foodOf(withBees, 1, 2)).toBe(foodOf(without, 1, 2));
    expect(withBees.lastReport!.flows.food!.made['Wild bees']).toEqual({ amount: 1, count: 1 });
    expect(withBees.lastReport!.wildlife!.food[uidAt(withBees, 1, 3)]).toEqual([
      { animal: 'wildBees', amount: 1 },
    ]);
    // Not in spring.
    expect(foodOf(farms('spring', true), 1, 3)).toBe(foodOf(farms('spring', false), 1, 3));
  });

  it('otters: fish ponds within 2 tiles of them make 1 more food', () => {
    const ponds = (otters: boolean) => {
      let s = put(start('summer'), 'reedBed', 1, 1);
      s = place(s, 'fishPond', 1, 2, W);
      s = place(s, 'fishPond', 1, 5, W);
      s.wildlife = otters ? ['otters'] : [];
      return end(s);
    };
    const s = ponds(true);
    // The otters live on the river beside the reed bed.
    expect(s.lastReport!.wildlife!.habitat.otters!.tiles).toEqual([hexKey(at(0, 1))]);
    expect(hexDistance(at(0, 1), at(1, 2))).toBeLessThanOrEqual(2);
    expect(hexDistance(at(0, 1), at(1, 5))).toBeGreaterThan(2);
    const without = ponds(false);
    expect(foodOf(without, 1, 2)).toBeGreaterThan(0);
    expect(foodOf(s, 1, 2) - foodOf(without, 1, 2)).toBe(1);
    expect(foodOf(s, 1, 5)).toBe(foodOf(without, 1, 5));
  });

  it('beavers: they are what the Beaver Dam evolution waits for', () => {
    const a = animal('beavers');
    expect(a.effect).toEqual({ kind: 'evolution', combo: 'beaverDam' });
    const dam = W.combos.find((c) => c.id === 'beaverDam')!;
    expect(dam.layer === 'evolution' && dam.when.kind === 'nextTo' && dam.when.minHarmony).toBe(
      a.harmony,
    );
    // At Harmony 50 the weir by the woodland becomes the dam, and the beavers live there.
    let s = harmonyAt(withHabitats(), 50);
    s = end(s);
    expect(s.buildings[uidAt(s, 0, 6)]!.type).toBe('beaverDam');
    expect(s.wildlife).toContain('beavers');
    // One below, neither.
    let t = harmonyAt(withHabitats(), 49);
    t = end(t);
    expect(t.buildings[uidAt(t, 0, 6)]!.type).toBe('weir');
    expect(t.wildlife).not.toContain('beavers');
  });

  it('content whose beavers and Beaver Dam disagree on Harmony is rejected at load', () => {
    const raw = structuredClone(willowReach) as { wildlife: { id: string; harmony: number }[] };
    raw.wildlife.find((a) => a.id === 'beavers')!.harmony = 45;
    expect(() => loadContent(raw)).toThrow(/beavers arrives at Harmony 45 but beaverDam needs 50/);
  });

  it('deer: +1 wellbeing per season for each herd (each wood of 4+ tiles)', () => {
    let s = start();
    expect(s.wildlife).toContain('deer');
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '1 herd of deer',
      amount: 1,
    });
    // Two woods of 4+; a wood of 3 is no herd's.
    const WOODS = ['W W , W W , W W', 'W W , W W , W ,', ', , , , , , , C'];
    const t = scenario(WOODS, { content: W });
    expect(habitatOf(t, animal('deer')).herds).toBe(2);
    expect(habitatOf(t, animal('deer')).tiles).toHaveLength(8);
    // A building in the wood is no herd's: the wood is no longer wild.
    const u = place(t, 'pollinatorMeadow', 0, 0, W);
    expect(habitatOf(u, animal('deer')).herds).toBe(1);
  });

  it('two herds give 2', () => {
    // Two woods of 6, apart, and Harmony from meadows.
    const rows = [
      'W W W m W W W',
      'W W W m W W W',
      'm m m m m m m',
      'm m m m m m m',
      'm m m m m m m',
      'm m m m m m m',
      'm m m m m m m',
      'm m m m m m m',
      'm m m m m m C',
    ];
    let s = scenario(rows, { content: W, citizens: 2, stores: { food: 500 } });
    expect(s.harmony).toBeGreaterThanOrEqual(70);
    s = end(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'wildlife',
      reason: '2 herds of deer',
      amount: 2,
    });
  });
});

describe('festivals (EXPANSION.md, Festivals)', () => {
  const hold = (s: RunState, festival: string) => act(s, { type: 'holdFestival', festival }, W);
  const line = (s: RunState, reason: string) =>
    s.lastReport!.wellbeing.lines.find((l) => l.kind === 'festival' && l.reason === reason);

  it('the Flood Fair: spring, 5 materials, +3 wellbeing, silt one ring beyond the flood', () => {
    const fair = (held: boolean) => {
      // A farm on the meadow beside the floodplain: dry, one ring beyond the flood.
      let s = place(start('spring'), 'floodplainFarm', 2, 3, W);
      if (held) {
        const before = s.stores.materials;
        s = hold(s, 'floodFair');
        expect(before - s.stores.materials).toBe(5);
      }
      return end(s);
    };
    const s = fair(true);
    expect(s.lastReport!.flooded).toContain(hexKey(at(1, 3)));
    expect(s.lastReport!.flooded).not.toContain(hexKey(at(2, 3)));
    expect(line(s, 'Flood Fair')!.amount).toBe(3);
    expect(s.lastReport!.silted).toContain(uidAt(s, 2, 3));
    expect(s.buildings[uidAt(s, 2, 3)]!.siltYear).toBe(1);
    const t = fair(false);
    expect(t.lastReport!.silted).not.toContain(uidAt(t, 2, 3));
    expect(line(t, 'Flood Fair')).toBeUndefined();
  });

  it('the Harvest Festival: autumn, 10 food, +5 wellbeing and one free reroll', () => {
    let s = start('autumn');
    s = hold(s, 'harvestFestival');
    expect(s.stores.food).toBe(490);
    expect(s.spent.food!.used['Festival: Harvest Festival']!.amount).toBe(10);
    s = end(s);
    expect(line(s, 'Harvest Festival')!.amount).toBe(5);
    expect(s.freeRerolls).toBe(1);
    // No knowledge, but the reroll is free; the next one isn't.
    expect(s.stores.knowledge).toBe(0);
    expect(s.draft.offer.length).toBeGreaterThan(0);
    s = act(s, { type: 'rerollDraft' }, W);
    expect(s.freeRerolls).toBe(0);
    expect(rejects(s, { type: 'rerollDraft' }, W)).toMatch(/knowledge/);
  });

  it('Lantern Night: winter, 5 materials, +3 wellbeing only if every night is powered', () => {
    let s = hold(start('winter'), 'lanternNight');
    s = end(s);
    expect(s.lastReport!.energy.night.shortfall).toBe(0);
    expect(s.lastReport!.festival).toEqual({ id: 'lanternNight', lit: true });
    expect(line(s, 'Lantern Night')!.amount).toBe(3);
    expect(W.festivals.find((f) => f.id === 'lanternNight')!.showsWildlife).toBe(true);

    // Homes beyond what the camp can power at night: the lanterns go dark.
    let t = start('winter');
    t.citizens = 20;
    for (const [c, r] of [
      [5, 8],
      [6, 8],
      [7, 8],
    ] as const)
      t = place(t, 'cottage', c, r, W);
    t = hold(t, 'lanternNight');
    t = end(t);
    expect(t.lastReport!.energy.night.shortfall).toBeGreaterThan(0);
    expect(t.lastReport!.festival).toEqual({ id: 'lanternNight', lit: false });
    expect(line(t, 'Lantern Night')).toBeUndefined();
    expect(t.notices).toContain(
      'The lanterns went dark: a night ran short of energy, so Lantern Night gave no wellbeing',
    );
  });

  it('only in its season, once a year, and only when it can be paid for', () => {
    expect(rejects(start('summer'), { type: 'holdFestival', festival: 'floodFair' }, W)).toMatch(
      /spring/,
    );
    let s = hold(start('spring'), 'floodFair');
    expect(festivalThisSeason(W, s)!.id).toBe('floodFair');
    expect(rejects(s, { type: 'holdFestival', festival: 'floodFair' }, W)).toMatch(/already/);
    // Next spring it can be held again.
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.season).toBe('spring');
    expect(festivalThisSeason(W, s)).toBeUndefined();
    s = hold(s, 'floodFair');
    expect(s.festivals.floodFair).toBe(2);

    const poor = start('autumn');
    poor.stores.food = 9;
    expect(rejects(poor, { type: 'holdFestival', festival: 'harvestFestival' }, W)).toMatch(
      /10 food/,
    );
  });

  it('can be called off, or undone, for its cost back', () => {
    const s = start('spring');
    const held = hold(s, 'floodFair');
    const off = act(held, { type: 'cancelFestival', festival: 'floodFair' }, W);
    expect(off.stores.materials).toBe(s.stores.materials);
    expect(off.spent.materials?.used['Festival: Flood Fair']).toBeUndefined();
    expect(festivalThisSeason(W, off)).toBeUndefined();
    const undone = act(held, { type: 'undo' }, W);
    expect(undone.stores.materials).toBe(s.stores.materials);
    expect(undone.festivals).toEqual({});
  });

  it('none without the water system', () => {
    const s = scenario(VALLEY, { season: 'spring' });
    expect(rejects(s, { type: 'holdFestival', festival: 'floodFair' }, content)).toMatch(
      /no festival/,
    );
  });
});

describe('on screen (for show)', () => {
  it('each animal living in the valley moves between its habitat tiles', async () => {
    const { wildlifeActors, poseAt, festivalProps } = await import('../src/render/wildlifeArt');
    const s = harmonyAt(withHabitats(), 88);
    s.wildlife = ['wildBees', 'otters', 'beavers', 'deer'];
    const actors = wildlifeActors(W, s);
    const kinds = actors.map((a) => a.kind);
    expect(new Set(kinds)).toEqual(new Set(['wildBees', 'otter', 'beaver', 'deer']));
    // A deer walks on one leg of its round and grazes at each stop.
    const deer = actors.find((a) => a.kind === 'deer')!;
    expect(deer.path.length).toBeGreaterThan(1);
    const frames = new Set(
      Array.from({ length: 200 }, (_, i) => poseAt(deer, i * 500, false).frame.split('.')[1]),
    );
    expect(frames).toEqual(new Set(['walk', 'graze']));
    // Reduced motion: it stands still on its first tile.
    expect(poseAt(deer, 12345, true)).toMatchObject({ x: deer.path[0]!.x });
    // No animals until they live here; bees keep in over winter.
    s.wildlife = [];
    expect(wildlifeActors(W, s)).toEqual([]);
    const winter = { ...s, season: 'winter' as const, wildlife: ['wildBees'] };
    expect(wildlifeActors(W, winter)).toEqual([]);
    // Lantern Night brings them out, and hangs lanterns at the homes.
    const lanterns = act(
      place(winter, 'cottage', 6, 8, W),
      { type: 'holdFestival', festival: 'lanternNight' },
      W,
    );
    expect(wildlifeActors(W, lanterns).map((a) => a.kind)).toContain('wildBees');
    // The camp and the cottage.
    expect(festivalProps(W, lanterns).filter((p) => p.kind === 'lantern')).toHaveLength(2);
  });
});
