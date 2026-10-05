/**
 * The Windswept Coast (Milestone 11, proposals/windswept-coast.md): its map and
 * content. Its own rules (the king tide's salt, fog, gales) are tested with them.
 */
import { describe, expect, it } from 'vitest';
import { biomeContent } from '../src/content';
import { createRun, hexKey, hexNeighbors, scoreRun, type RunState } from '../src/sim';
import { act, at, endSeason, place, rejects, scenario, uidAt } from './helpers';

const COAST = biomeContent('windsweptCoast');
const seeds = ['a', 'b', 'coast-1', 'coast-2', 'coast-3'];

describe('the coast map', () => {
  it.each(seeds)('seed %s: sea to the east, a stream to it, the shore, the camp inland', (seed) => {
    const s = createRun(COAST, { seed, water: true });
    const tiles = Object.values(s.map.tiles);
    const count = (type: string) => tiles.filter((t) => t.type === type).length;
    // The sea fills the east columns, and touches the east edge on every row.
    expect(count('sea')).toBeGreaterThanOrEqual(2 * s.map.height);
    for (let r = 0; r < s.map.height; r++) {
      const row = tiles.filter((t) => t.r === r).sort((a, b) => a.q - b.q);
      expect(row.at(-1)!.type).toBe('sea');
    }
    // A stream from the west edge that reaches the sea (or its estuary).
    expect(s.map.river.length).toBeGreaterThan(5);
    const mouth = s.map.tiles[s.map.river.at(-1)!]!;
    expect(
      hexNeighbors(mouth).some((n) =>
        ['sea', 'mudflat'].includes(s.map.tiles[hexKey(n)]?.type ?? ''),
      ),
    ).toBe(true);
    // The shore: mudflat or dune beside the sea; the king tide reaches mudflat and saltmarsh only.
    expect(count('mudflat') + count('dune')).toBeGreaterThan(3);
    for (const k of s.map.floodOrder)
      expect(['mudflat', 'saltmarsh']).toContain(s.map.tiles[k]!.type);
    // Starts at the coast's Harmony, like the Reach.
    expect(s.harmony).toBe(COAST.map.startingHarmony);
  });

  it('the same seed always makes the same coast', () => {
    const a = createRun(COAST, { seed: 'same' });
    const b = createRun(COAST, { seed: 'same' });
    expect(a.map).toEqual(b.map);
  });
});

describe('the coast content', () => {
  it("has the proposal's starters: croft, tide turbine, beachcombing yard, cottage", () => {
    const starters = COAST.buildings.filter((b) => b.starter).map((b) => b.id);
    for (const id of ['croft', 'tideTurbine', 'beachcombingYard', 'cottage', 'workshop'])
      expect(starters).toContain(id);
    // Not the Reach's own.
    for (const id of ['floodplainFarm', 'weir', 'levee', 'orchard', 'greatWaterGarden'])
      expect(COAST.byId[id]).toBeUndefined();
    expect(COAST.calendar).toEqual(['flood', 'fog', 'storm', 'freeze']);
    expect(COAST.events.flood!.name).toBe('King tide');
  });

  it('a whole year plays', () => {
    let s: RunState = createRun(COAST, { seed: 'year', water: true });
    for (let i = 0; i < 4; i++) s = endSeason(s, COAST);
    expect(s.status).toBe('active');
    expect(s.year).toBe(2);
  });

  it('every combo has its Almanac entry: a name, what it does and a hint', () => {
    const coastOwn = COAST.combos.filter((c) => !biomeContent('willowReach').comboById[c.id]);
    expect(coastOwn.map((c) => c.id)).toEqual(
      expect.arrayContaining(['shellfishBeds', 'kelpLoop', 'duneLine', 'rockPool']),
    );
    for (const c of COAST.combos) {
      expect(c.name, c.id).not.toBe('');
      expect(c.text, c.id).not.toBe('');
      expect(c.hint, c.id).not.toBe('');
    }
  });
});

describe('the coast in a full run (B3)', () => {
  it('every coast run scores "a wild coast to weather"; the Reach has no such line', () => {
    const line = { reason: 'a wild coast to weather', points: 25 };
    expect(scoreRun(COAST, createRun(COAST, { seed: 'line' })).lines).toContainEqual(line);
    const reach = biomeContent('willowReach');
    expect(
      scoreRun(reach, createRun(reach, { seed: 'line' })).lines.map((l) => l.reason),
    ).not.toContain(line.reason);
  });

  it("Restore the Shore asks for 60% of the coast's healable land, dunes left out", () => {
    const vision = COAST.visions.find((v) => v.name === 'Restore the Shore')!;
    expect(vision.goal).toEqual({ kind: 'greenLand', share: 0.6 });
    expect(COAST.rules.landHealth).not.toContain('dune');
  });

  it('the balanced bot plays a whole coast run to the end, salvaging the strandline', async () => {
    const { BOTS } = await import('../src/balance/bots');
    const { playRun } = await import('../src/balance/runner');
    let last: RunState | null = null;
    playRun(COAST, BOTS.balanced!, 'coast-run', {
      onSeason: (s) => (last = s),
      run: { water: true },
    });
    const s = last as unknown as RunState;
    expect(s.status).toBe('complete');
    const types = Object.values(s.buildings).map((b) => b.type);
    expect(types).toContain('beachcombingYard');
    expect(types).toContain('croft');
    expect(scoreRun(COAST, s).total).toBeGreaterThan(COAST.rules.score.tiers[1]!.min);
  }, 60_000);
});

describe('the coast rules', () => {
  // The shore on the east: saltmarsh, mudflat, then sea; dunes and a headland in the middle.
  const SHORE = [
    '. , m " _ = = =',
    '. , m " _ = = =',
    '. C , : : = = =',
    '. , , ^ ^ = = =',
    '. , m " _ = = =',
    '. , , : : = = =',
  ];
  type Season = 'spring' | 'summer' | 'autumn' | 'winter';
  const start = (season: Season = 'spring', water = false) =>
    scenario(SHORE, {
      content: COAST,
      season,
      citizens: 10,
      stores: { food: 40 },
      run: water ? { water: true } : {},
    });
  const build = (s: RunState, id: string, cells: [number, number][]) =>
    cells.reduce((acc, [col, row]) => place(acc, id, col, row, COAST), s);
  /** Ends the season with the larder topped up: these tests are about the coast, not food. */
  const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 40 } }, COAST);
  const foodOf = (s: RunState, col: number, row: number) =>
    s.lastReport!.yields[uidAt(s, col, row)]?.food ?? 0;

  it('the king tide salts crofts it reaches: half food for 2 seasons, then +1 on saltmarsh until the next', () => {
    // Croft A on open saltmarsh; croft B on saltmarsh behind a sea wall.
    let s = build(start(), 'croft', [
      [3, 0],
      [3, 4],
    ]);
    s = build(s, 'seaWall', [[4, 4]]);
    s = end(s); // the king tide
    expect(s.lastReport!.salted).toEqual([uidAt(s, 3, 0)]);
    expect(s.lastReport!.silted).toEqual([]);
    const seasons: [number, number][] = [];
    for (let i = 0; i < 4; i++) {
      s = end(s);
      seasons.push([foodOf(s, 3, 0), foodOf(s, 3, 4)]);
    }
    const [summer, autumn, winter, spring] = seasons;
    // Summer and autumn: half (rounded down) of what the sheltered croft makes.
    expect(summer![0]).toBe(Math.floor(summer![1] / 2));
    expect(autumn![0]).toBe(Math.floor(autumn![1] / 2));
    // Winter, when crofts rest: the salted one, its salt gone, makes 1; the sheltered none.
    expect(winter).toEqual([1, 0]);
    // And next spring, before the next king tide: +1.
    expect(spring![0]).toBe(spring![1] + 1);
  });

  it('buildings that are not salt-tolerant are damaged; a sea wall keeps it off tiles within 2', () => {
    let s = build(start(), 'cottage', [[3, 1]]);
    s = build(s, 'seaWall', [[4, 4]]);
    s = build(s, 'cottage', [[3, 4]]);
    s = end(s);
    expect(s.lastReport!.damaged).toContain(uidAt(s, 3, 1));
    expect(s.lastReport!.damaged).not.toContain(uidAt(s, 3, 4));
    expect(s.lastReport!.sheltered).toContain(hexKey(at(3, 4)));
  });

  it('sea fog: solar makes 1 less each day of summer', () => {
    let s = build(start('summer'), 'solarCanopy', [[1, 0]]);
    s = end(s);
    expect(s.lastReport!.event).toBe('fog');
    expect(s.lastReport!.generated[uidAt(s, 1, 0)]!.energy.day).toBe(
      COAST.byId.solarCanopy!.generation!.day[1]! - 1,
    );
    expect(s.lastReport!.math[uidAt(s, 1, 0)]!.join(' ')).toMatch(/sea fog -1/);
  });

  it('sea fog: cisterns catch 1 water', () => {
    // A cistern put straight onto the map (it needs a stream or channel to be built).
    const s = start('summer', true);
    const uid = `b${s.nextUid++}`;
    s.buildings[uid] = { uid, type: 'cistern', at: at(1, 0), builtTurn: 0, stored: 0 };
    s.priority.push(uid);
    const next = end(s);
    expect(next.lastReport!.event).toBe('fog');
    expect(next.buildings[uid]!.stored).toBe(COAST.events.fog!.cisternCatch);
  });

  it('gales: two exposed buildings are damaged, offshore ones too; a tide turbine never', () => {
    let s = build(start('autumn'), 'kelpFarm', [
      [5, 0],
      [5, 1],
      [5, 4],
    ]);
    s = build(s, 'tideTurbine', [[5, 3]]);
    s = end(s);
    expect(s.lastReport!.event).toBe('storm');
    const turbine = uidAt(s, 5, 3);
    expect(s.lastReport!.exposed).not.toContain(turbine);
    for (const [c, r] of [
      [5, 0],
      [5, 1],
      [5, 4],
    ] as const)
      expect(s.lastReport!.exposed).toContain(uidAt(s, c, r));
    expect(s.lastReport!.damaged).toHaveLength(2);
  });

  it('a lighthouse shelters what stands within 2 tiles of it', () => {
    let s = build(start('autumn'), 'kelpFarm', [
      [5, 0],
      [5, 4],
    ]);
    s = build(s, 'lighthouse', [[4, 3]]);
    s = end(s);
    expect(s.lastReport!.exposed).toContain(uidAt(s, 5, 0));
    expect(s.lastReport!.exposed).not.toContain(uidAt(s, 5, 4));
  });

  it('the strandline: a beachcombing yard gets 3 salvage after a gale', () => {
    let s = build(start('autumn'), 'beachcombingYard', [[4, 2]]);
    s = end(s);
    expect(s.lastReport!.flows.salvage!.made['Strandline after the storm']!.amount).toBe(3);
  });

  it('a wind spire on a headland makes 1 more in each slot', () => {
    let s = build(start('summer'), 'windSpire', [[3, 3]]);
    s = end(s);
    const gen = s.lastReport!.generated[uidAt(s, 3, 3)]!.energy;
    const base = COAST.byId.windSpire!.generation!;
    expect(gen.day).toBe(base.day[1]! > 0 ? base.day[1]! + 1 : 0);
    expect(gen.night).toBe(base.night[1]! > 0 ? base.night[1]! + 1 : 0);
  });

  it('placement: wave buoys in deep sea, tide turbines by mudflat or a headland, kelp by land', () => {
    const s = start();
    const why = (id: string, c: number, r: number) =>
      rejects(s, { type: 'place', building: id, at: at(c, r) }, COAST);
    expect(why('waveBuoy', 5, 2)).toMatch(/must be away from/);
    expect(() => place(s, 'waveBuoy', 7, 2, COAST)).not.toThrow();
    expect(why('tideTurbine', 7, 2)).toMatch(/must be next to/);
    expect(why('kelpFarm', 7, 2)).toMatch(/must be next to/);
    expect(why('croft', 3, 2)).toMatch(/can't be built on dune/);
  });

  it('a powered smokehouse keeps food beyond storage from rotting', () => {
    const rotted = (smokehouse: boolean) => {
      let s = start('summer');
      if (smokehouse) s = build(s, 'smokehouse', [[1, 5]]);
      s = endSeason({ ...s, stores: { ...s.stores, food: 300 } }, COAST);
      return s.lastReport!.food.rotted;
    };
    expect(rotted(false)).toBeGreaterThan(0);
    expect(rotted(true)).toBe(0);
  });

  it('dune grass turns its dune to scrub after 2 seasons', () => {
    let s = build(start(), 'duneGrass', [[3, 2]]);
    expect(s.map.tiles[hexKey(at(3, 2))]!.type).toBe('dune');
    s = end(end(s));
    expect(s.map.tiles[hexKey(at(3, 2))]!.type).toBe('scrub');
  });

  // Dunes are off the soil ladder, like mudflats: the terns, dune grass and the lagoon need them.
  it("compost can't improve a dune; barren ground beside it still greens", () => {
    const s = { ...start(), stores: { ...start().stores, compost: 20 } };
    expect(rejects(s, { type: 'spreadCompost', at: at(3, 2) }, COAST)).toBe(
      "compost can't improve dune",
    );
    const spread = act(s, { type: 'spreadCompost', at: at(0, 0) }, COAST);
    expect(spread.map.tiles[hexKey(at(0, 0))]!.type).toBe('scrub');
  });

  it('Green Terraces heal the worst land and leave the dunes', () => {
    const rich = { materials: 100, compost: 100, food: 100 };
    let s = scenario(SHORE, { content: COAST, year: 7, citizens: 10, stores: rich });
    const count = (x: RunState, type: string) =>
      Object.values(x.map.tiles).filter((t) => t.type === type).length;
    const dunes = count(s, 'dune');
    s = act(s, { type: 'startProject', project: 'greenTerraces' }, COAST);
    s = end(end(s));
    expect(s.projects.find((p) => p.id === 'greenTerraces')?.done).not.toBeNull();
    expect(count(s, 'dune')).toBe(dunes);
    expect(count(s, 'barren')).toBe(0);
  });

  it('a pollinator meadow planted on a dune still makes it meadow', () => {
    const s = build(start(), 'pollinatorMeadow', [[3, 2]]);
    expect(s.map.tiles[hexKey(at(3, 2))]!.type).toBe('meadow');
  });
});
