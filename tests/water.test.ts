/**
 * The water system (EXPANSION.md, Water system; milestone E1): one test per
 * flow rule, the water qualities, storage, the river wheels, and a check that
 * every unit of water is accounted for. The game keeps water off until it can
 * be seen (E2), so these tests turn it on.
 *
 * Maps put the river in the first column, so its position is the row. A tile
 * in the second column touches the river; tiles further right don't.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  canPlace,
  channels,
  createRun,
  hexKey,
  forecastSeason,
  harmonyLines,
  resolveAsIs,
  type Content,
  type RunState,
  type WaterReport,
} from '../src/sim';
import { createRng, nextInt } from '../src/sim/rng';
import { at, content, endSeason, place, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });

// Barren top row and scrub bottom row keep Harmony under 20, so yields aren't multiplied.
const VALLEY = [
  '~ f . . . . .',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f m m m m m',
  '~ f , , C , ,',
];

// Plenty of people and food, so nothing is short of workers and no one leaves.
const start = (
  season: 'spring' | 'summer' | 'autumn' | 'winter' = 'spring',
  c: Content = W,
  rows = VALLEY,
) => scenario(rows, { content: c, season, citizens: 30, stores: { food: 500 } });
const build = (s: RunState, id: string, cells: [number, number][], c: Content = W) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, c), s);
/** A channel along the middle row, from the river's edge. */
const channel = (s: RunState, length: number, c: Content = W) =>
  build(
    s,
    'irrigationChannel',
    Array.from({ length }, (_, i) => [1 + i, 2] as [number, number]),
    c,
  );
const water = (s: RunState): WaterReport => s.lastReport!.water!;
const use = (s: RunState, col: number, row: number) => water(s).uses[uidAt(s, col, row)]!;
const food = (s: RunState, col: number, row: number) =>
  s.lastReport!.yields[uidAt(s, col, row)]?.food ?? 0;
const sum = (r: Record<string, number>) => Object.values(r).reduce((a, b) => a + b, 0);

describe('the river', () => {
  it('flows in at the top each season: 12, 4, 8 and 6', () => {
    let s = scenario(VALLEY, { content: W, stores: { food: 500 } });
    const flows: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s, W);
      flows.push(water(s).riverFlow);
      expect(water(s).flowAt.at(-1)).toBe(water(s).riverFlow);
    }
    expect(flows).toEqual([12, 4, 8, 6]);
  });

  it('serves buildings beside it upstream first, ties by priority', () => {
    // Summer brings 4. Build order is priority: the farm at row 4 outranks the one at row 3.
    let s = build(start('summer'), 'floodplainFarm', [
      [1, 4],
      [1, 3],
      [1, 2],
      [1, 1],
      [1, 0],
    ]);
    s = endSeason(s, W);
    // Rows 0, 1 and 2 draw at river positions 0, 1 and 1; rows 3 and 4 both at position 3.
    expect(water(s).flowAt).toEqual([3, 1, 1, 0, 0]);
    expect(use(s, 1, 0).from).toBe('river');
    expect(use(s, 1, 4).short).toBe(false);
    expect(use(s, 1, 3)).toMatchObject({ short: true, got: { clean: 0 } });
    // Short of water: half its yield, rounded down.
    expect(food(s, 1, 4)).toBe(4);
    expect(food(s, 1, 3)).toBe(2);
  });

  it('replaces the low river\'s "far from water" rule', () => {
    let s = channel(start('summer'), 3);
    s = build(s, 'floodplainFarm', [[3, 1]]);
    s = endSeason(s, W);
    // 3 tiles from the river, watered by the channel: a meadow farm's full summer 4 − 1.
    expect(use(s, 3, 1)).toMatchObject({ from: 'channel', short: false });
    expect(food(s, 3, 1)).toBe(3);
    expect(s.lastReport!.dried).toEqual([]);
  });
});

describe('channels', () => {
  it('start next to the river and grow from their end, not on hills, never branching or joining', () => {
    let s = scenario(['~ f ^ . .', '~ f . . .', '~ f . . .', '~ f . . .', '~ f , C ,'], {
      content: W,
    });
    const why = (col: number, row: number) => {
      const r = canPlace(W, s, 'irrigationChannel', at(col, row));
      return r.ok ? 'ok' : r.reason;
    };
    expect(why(2, 0)).toMatch(/can't be built on hill/);
    expect(why(2, 2)).toBe('a new channel must start next to the river or a reservoir');
    // A path (1,1) → (2,1) → (3,2) → (3,3).
    s = build(s, 'irrigationChannel', [
      [1, 1],
      [2, 1],
      [3, 2],
      [3, 3],
    ]);
    expect(why(3, 0)).toBe('a channel can only be extended from its end');
    expect(why(2, 0)).toMatch(/hill/);
    expect(why(2, 2)).toBe('channels can only be extended from one end, not joined');
    expect(why(4, 4)).toBe('ok');
    const [ch] = channels(W, s);
    expect(ch!.intake).toEqual({ river: 1 });
    expect(ch!.keys).toEqual([at(1, 1), at(2, 1), at(3, 2), at(3, 3)].map(hexKey));
  });

  it('carry at most 4 a season, serving buildings in order of distance from the intake', () => {
    let s = channel(start(), 5);
    // The farm at the far end is built first, so it outranks the rest, but it is furthest down.
    s = build(s, 'floodplainFarm', [
      [5, 1],
      [2, 1],
      [2, 3],
      [3, 1],
      [3, 3],
    ]);
    s = endSeason(s, W);
    expect(water(s).channels[0]).toMatchObject({ intake: { river: 1 }, drawn: 4 });
    expect(water(s).flowAt[1]).toBe(12 - 4);
    for (const [col, row] of [
      [2, 1],
      [2, 3],
      [3, 1],
      [3, 3],
    ] as const)
      expect(use(s, col, row).short).toBe(false);
    expect(use(s, 5, 1).short).toBe(true);
    // A meadow farm makes 2 − 1 in spring; short, half of 1 rounds down to 0.
    expect(food(s, 2, 1)).toBe(1);
    expect(food(s, 5, 1)).toBe(0);
  });

  it('break ties at the same distance by priority', () => {
    const narrow = withWater({
      campChannel: 0,
      edit: (raw) => (raw.rules.water.channelCapacity = 1),
    });
    let s = channel(start('spring', narrow), 3, narrow);
    s = build(
      s,
      'floodplainFarm',
      [
        [2, 3],
        [2, 1],
      ],
      narrow,
    );
    s = endSeason(s, narrow);
    expect(use(s, 2, 3).short).toBe(false);
    expect(use(s, 2, 1).short).toBe(true);
  });

  it('lose 1 water in summer for every 4 tiles, rounded down', () => {
    let s = channel(start('summer'), 4);
    s = build(s, 'floodplainFarm', [[4, 1]]);
    s = endSeason(s, W);
    expect(water(s).channels[0]).toMatchObject({ drawn: 2, evaporated: 1 });
    expect(water(s).flowAt[1]).toBe(4 - 2);
    // 3 tiles evaporate nothing.
    let t = channel(start('summer'), 3);
    t = build(t, 'floodplainFarm', [[3, 1]]);
    t = endSeason(t, W);
    expect(water(t).channels[0]).toMatchObject({ drawn: 1, evaporated: 0 });
    // Not in spring.
    let u = channel(start('spring'), 4);
    u = build(u, 'floodplainFarm', [[4, 1]]);
    u = endSeason(u, W);
    expect(water(u).channels[0]).toMatchObject({ drawn: 1, evaporated: 0 });
  });

  it('return what is left to the river when their end touches it again, and lose it otherwise', () => {
    // A U-shaped channel from river position 0 back to position 3, fed by a fish pond.
    const u: [number, number][] = [
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
      [1, 3],
    ];
    let s = build(start(), 'irrigationChannel', u);
    s = build(s, 'fishPond', [[1, 1]]);
    s = endSeason(s, W);
    expect(water(s).channels[0]).toMatchObject({
      intake: { river: 0 },
      rejoinsAt: 3,
      drawn: 0,
      fed: 1,
      rejoined: { nutrient: 1 },
    });
    expect(water(s).flowAt).toEqual([12, 12, 12, 13, 13]);
    // Without the last two tiles the channel ends inland: the water soaks away.
    let t = build(start(), 'irrigationChannel', u.slice(0, 3));
    t = build(t, 'fishPond', [[1, 1]]);
    t = endSeason(t, W);
    expect(water(t).channels[0]).toMatchObject({ rejoinsAt: null, lost: { nutrient: 1 } });
    expect(water(t).out['lost at channel ends']).toBe(1);
  });

  it('a damaged tile breaks the channel below it', () => {
    let s = channel(start('summer'), 3);
    s = build(s, 'floodplainFarm', [[3, 1]]);
    s.buildings[uidAt(s, 2, 2)]!.damage = { cause: 'storm', turn: s.turn };
    s = endSeason(s, W);
    // The tiles below the break are a channel of their own, touching no water.
    expect(water(s).channels.map((c) => c.intake)).toEqual([{ river: 1 }, null]);
    expect(use(s, 3, 1).short).toBe(true);
  });
});

describe('water qualities', () => {
  // A bathhouse and a reed bed stand in for E3's buildings, to test the rules alone.
  const Q = withWater({
    campChannel: 0,
    edit: (raw) => {
      const base = {
        cost: 1,
        workers: 0,
        kind: 'civic',
        placement: { tiles: ['floodplain', 'barren', 'scrub', 'meadow', 'woodland'] },
      };
      raw.buildings.push(
        {
          ...base,
          id: 'testBath',
          name: 'Test Bath',
          water: {
            needs: [1, 1, 1, 1],
            accepts: ['clean'],
            returns: { quality: 'grey', amount: 1 },
          },
        } as never,
        { ...base, id: 'testReeds', name: 'Test Reeds', water: { cleans: 3 } } as never,
      );
    },
  });
  const valley = () => start('spring', Q);

  it('nutrient-rich water from a fish pond gives a farm downstream +1 food', () => {
    let s = channel(valley(), 4, Q);
    s = build(s, 'fishPond', [[1, 1]], Q);
    s = build(s, 'floodplainFarm', [[3, 1]], Q);
    s = endSeason(s, Q);
    expect(use(s, 3, 1).got).toEqual({ clean: 0, nutrient: 1, grey: 0 });
    expect(water(s).channels[0]!.drawn).toBe(0);
    // A meadow farm's spring 2 − 1, then +1.
    expect(food(s, 3, 1)).toBe(2);
  });

  it('grey water is used only by what accepts it, and soaks away at a dead end', () => {
    let s = channel(valley(), 4, Q);
    s = build(s, 'testBath', [[2, 1]], Q);
    s = build(s, 'floodplainFarm', [[4, 1]], Q);
    s = endSeason(s, Q);
    // The bath's grey water passes the farm, which draws fresh water instead.
    expect(use(s, 4, 1).got).toEqual({ clean: 1, nutrient: 0, grey: 0 });
    expect(water(s).channels[0]).toMatchObject({ drawn: 2, lost: { grey: 1 } });
    expect(water(s).greyToRiver).toBe(0);
  });

  it('a reed bed cleans grey water for the buildings below it', () => {
    let s = channel(valley(), 4, Q);
    s = build(s, 'testBath', [[2, 1]], Q);
    s = build(s, 'testReeds', [[3, 3]], Q);
    s = build(s, 'floodplainFarm', [[4, 1]], Q);
    s = endSeason(s, Q);
    expect(use(s, 4, 1).got.clean).toBe(1);
    expect(water(s).channels[0]!.drawn).toBe(1);
  });

  it('grey water reaching the river costs 1 Harmony a unit, until next season', () => {
    // Beside the river with no channel, the bath drinks from the river and drains into it.
    let s = build(start('summer', Q), 'testBath', [[1, 1]], Q);
    s = endSeason(s, Q);
    expect(water(s).greyToRiver).toBe(1);
    const grey = (x: RunState) => harmonyLines(Q, x).find((l) => /grey water/.test(l.label));
    expect(grey(s)).toEqual({ label: '1 grey water in the river', amount: -1 });
    // Demolished, the bath sends no more: the Harmony comes back once the next season resolves.
    const r = applyCommand(Q, s, { type: 'demolish', uid: uidAt(s, 1, 1) });
    if (!r.ok) throw new Error(r.error);
    s = endSeason(r.state, Q);
    expect(water(s).greyToRiver).toBe(0);
    expect(grey(s)).toBeUndefined();
  });
});

describe('storage', () => {
  it("a cistern fills from its channel's spare capacity", () => {
    let s = channel(start(), 4);
    s = build(s, 'cistern', [[2, 1]]);
    s = build(s, 'floodplainFarm', [[4, 1]]);
    s = endSeason(s, W);
    // 1 for the farm, then the 3 the channel can still carry.
    expect(water(s).channels[0]).toMatchObject({ drawn: 4, stored: 3 });
    expect(s.buildings[uidAt(s, 2, 1)]!.stored).toBe(3);
  });

  it("a cistern covers what its channel can't, for buildings at or below it", () => {
    let s = channel(start('summer'), 4);
    s = build(s, 'cistern', [[2, 1]]);
    s.buildings[uidAt(s, 2, 1)]!.stored = 6;
    s = build(s, 'floodplainFarm', [
      [2, 3],
      [3, 1],
      [3, 3],
      [4, 1],
      [4, 3],
    ]);
    s = endSeason(s, W);
    // Summer's 4 into the channel: 1 evaporates, 3 serve farms, the cistern gives 2.
    for (const [col, row] of [
      [2, 3],
      [3, 1],
      [3, 3],
      [4, 1],
      [4, 3],
    ] as const)
      expect(use(s, col, row).short).toBe(false);
    expect(water(s).channels[0]).toMatchObject({ drawn: 4, evaporated: 1, released: 2 });
    expect(s.buildings[uidAt(s, 2, 1)]!.stored).toBe(4);
  });

  it('the spring flood fills a cistern on the floodplain', () => {
    let s = channel(start(), 2);
    s = build(s, 'cistern', [[1, 1]]);
    s = endSeason(s, W);
    expect(s.lastReport!.flooded).toContain(hexKey(at(1, 1)));
    expect(s.buildings[uidAt(s, 1, 1)]!.stored).toBe(6);
    expect(water(s).in.flood).toBe(6);
    expect(water(s).channels[0]!.drawn).toBe(0);
  });

  it("a weir holds back 4 of spring's water and releases it in summer", () => {
    let s = build(start(), 'weir', [[0, 2]]);
    s = endSeason(s, W);
    const weir = uidAt(s, 0, 2);
    expect(water(s).flowAt).toEqual([12, 12, 8, 8, 8]);
    expect(s.buildings[weir]!.stored).toBe(4);
    s = endSeason(s, W);
    expect(water(s).flowAt).toEqual([4, 4, 8, 8, 8]);
    expect(s.buildings[weir]!.stored).toBe(0);
  });

  it('a lake is filled by the spring flood and serves the buildings beside it', () => {
    const lakeValley = ['~ f . L L .', '~ f m m m m', '~ f , , C ,'];
    let s = scenario(lakeValley, { content: W, citizens: 10 });
    s = build(s, 'floodplainFarm', [[3, 1]]);
    s = endSeason(s, W);
    expect(use(s, 3, 1)).toMatchObject({ from: 'lake', short: false });
    const lake = [at(3, 0), at(4, 0)].map((h) => s.map.tiles[hexKey(h)]!.water ?? 0);
    expect(lake[0]! + lake[1]!).toBe(2 * 2 - 1);
    expect(water(s).in.flood).toBe(4);
  });
});

describe('river wheels', () => {
  // Scrub beside the river at the bottom, so the spring flood doesn't damage the wheel.
  const DRY_FOOT = [...VALLEY.slice(0, 4), '~ , , , C , ,'];
  const start = () => scenario(DRY_FOOT, { content: W, stores: { food: 500 } });
  it('make ⌈flow ÷ 4⌉ a slot: the old 3 / 1 / 2 / 2 when no water is drawn', () => {
    let s = build(start(), 'riverWheel', [[1, 4]]);
    const made: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s, W);
      made.push(s.lastReport!.generated[uidAt(s, 1, 4)]!.energy.day);
    }
    expect(made).toEqual([3, 1, 2, 2]);
  });

  it('lose power to water drawn upstream', () => {
    let s = build(start(), 'riverWheel', [[1, 4]]);
    s = build(s, 'floodplainFarm', [
      [1, 0],
      [1, 1],
      [1, 2],
      [1, 3],
    ]);
    s = endSeason(s, W);
    // 12 − 4 = 8 passes the wheel: 2 a slot instead of 3.
    expect(s.lastReport!.generated[uidAt(s, 1, 4)]!.energy).toEqual({ day: 2, night: 2 });
  });
});

describe('the camp and the switch', () => {
  it("the Founders' Camp starts with a 3-tile channel from the river towards it", () => {
    const full = withWater();
    for (const seed of ['camp-a', 'camp-b', 'camp-c']) {
      const s = createRun(full, { seed });
      const dug = Object.values(s.buildings).filter((b) => b.type === 'irrigationChannel');
      expect(dug, seed).toHaveLength(3);
      const [ch] = channels(full, s);
      expect(ch!.intake, seed).toMatchObject({ river: expect.any(Number) });
      expect(ch!.uids).toHaveLength(3);
      expect(s.unlocked).toContain('irrigationChannel');
    }
  });

  it('is off in the game: no water buildings, and the old rules hold', () => {
    expect(content.rules.water.enabled).toBe(false);
    const s = createRun(content, { seed: 'off' });
    expect(s.unlocked).not.toContain('irrigationChannel');
    expect(Object.values(s.buildings).some((b) => b.type === 'irrigationChannel')).toBe(false);
    const sandbox = createRun(content, { seed: 'off', sandbox: true });
    expect(sandbox.unlocked).not.toContain('cistern');
    const r = canPlace(content, sandbox, 'irrigationChannel', at(1, 1));
    expect(r.ok ? '' : r.reason).toBe('Irrigation Channel needs the water system');
    expect(resolveAsIs(content, s).lastReport!.water).toBeNull();
  });

  it('every water building has a legal site on generated maps', () => {
    const full = withWater();
    for (const seed of ['site-a', 'site-b']) {
      let s = createRun(full, { seed, sandbox: true });
      for (const id of ['irrigationChannel', 'cistern']) {
        const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
        const site = Object.values(s.map.tiles).find(
          (t) => !taken.has(hexKey(t)) && canPlace(full, s, id, t).ok,
        );
        expect(site, `${id} on ${seed}`).toBeDefined();
        const r = applyCommand(full, s, { type: 'place', building: id, at: site! });
        expect(r.ok).toBe(true);
        if (r.ok) s = r.state;
      }
    }
  });
});

describe('every unit of water is accounted for', () => {
  const Q = withWater({
    edit: (raw) =>
      raw.buildings.push(
        {
          id: 'testBath',
          name: 'Test Bath',
          cost: 1,
          workers: 0,
          kind: 'civic',
          placement: { tiles: ['floodplain', 'barren', 'scrub', 'meadow', 'woodland'] },
          water: {
            needs: [1, 1, 1, 1],
            accepts: ['clean'],
            returns: { quality: 'grey', amount: 1 },
          },
        } as never,
        {
          id: 'testReeds',
          name: 'Test Reeds',
          cost: 1,
          workers: 0,
          kind: 'nature',
          placement: { tiles: ['floodplain', 'barren', 'scrub', 'meadow', 'woodland'] },
          water: { cleans: 3 },
        } as never,
      ),
  });
  const MIX = [
    'irrigationChannel',
    'irrigationChannel',
    'irrigationChannel',
    'floodplainFarm',
    'orchard',
    'greenhouse',
    'fishPond',
    'cistern',
    'weir',
    'riverWheel',
    'testBath',
    'testReeds',
  ];

  it('in random valleys over 3 years: what comes in equals what goes out, every season', () => {
    for (const seed of ['mix-a', 'mix-b', 'mix-c', 'mix-d', 'mix-e', 'mix-f']) {
      for (const region of [null, 'oxbowLakes', 'broadWash']) {
        let s = createRun(Q, {
          seed,
          sandbox: true,
          expedition: { twist: null, request: null, region },
        });
        s.citizens = 40;
        const rng = createRng(`${seed}:${region}`);
        for (let season = 0; season < 12; season++) {
          for (let k = 0; k < 6; k++) {
            const id = MIX[nextInt(rng, MIX.length)]!;
            const taken = new Set(Object.values(s.buildings).map((b) => hexKey(b.at)));
            const sites = Object.values(s.map.tiles).filter(
              (t) => !taken.has(hexKey(t)) && canPlace(Q, s, id, t).ok,
            );
            if (sites.length === 0) continue;
            const r = applyCommand(Q, s, {
              type: 'place',
              building: id,
              at: sites[nextInt(rng, sites.length)]!,
            });
            if (r.ok) s = r.state;
          }
          // Keep everyone fed and content: this test is about water, not survival.
          const ready = {
            ...s,
            draft: { ...s.draft, offer: [] },
            charterOffer: [],
            visionOffer: [],
          };
          ready.stores = { ...s.stores, food: 500 };
          ready.wellbeing = 80;
          const r = applyCommand(Q, ready, { type: 'endSeason' });
          if (!r.ok) throw new Error(r.error);
          s = r.state;
          const w = water(s);
          const where = `${seed} ${region} season ${season}`;
          expect(sum(w.in), where).toBe(sum(w.out));
          for (const [uid, u] of Object.entries(w.uses)) {
            const got = u.got.clean + u.got.nutrient + u.got.grey;
            expect(got, `${where} ${uid}`).toBeLessThanOrEqual(u.need);
            expect(u.short, `${where} ${uid}`).toBe(got < u.need);
          }
          for (const ch of w.channels)
            expect(ch.drawn, where).toBeLessThanOrEqual(Q.rules.water.channelCapacity);
          for (const f of w.flowAt) if (f !== undefined) expect(f, where).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('a forecast sees the same water as the season itself (water has no chance in it)', () => {
    let s = channel(start('summer'), 4);
    s = build(s, 'floodplainFarm', [
      [2, 1],
      [3, 1],
    ]);
    const forecast = forecastSeason(W, s).lastReport!.water;
    const outcome = resolveAsIs(W, s).lastReport!.water;
    expect(forecast).toEqual(outcome);
  });
});
