/**
 * The Great Water Garden (EXPANSION.md, Biome wonder; milestone E5): a 7-hex
 * flower built over 4 seasons, which needs a closed Bath Loop and 3 reed
 * beds. Finished, it adds a large score bonus and raises the Graft one tier;
 * it can also meet the Bloom era's goal. It comes with the water system.
 */
import { describe, expect, it } from 'vitest';
import { buildingAt, eraGoal, eraGoalMet, eraGoalOr, scoreRun, type RunState } from '../src/sim';
import { wonderStage } from '../src/sim/wonder';
import { act, at, content, endSeason, place, rejects, scenario, uidAt, withWater } from './helpers';

const W = withWater({ campChannel: 0 });
const GARDEN = 'greatWaterGarden';

// The river in the first column; a channel along row 2; meadows below for the garden.
const VALLEY = [
  '~ f . . . . . . .',
  '~ f m m m m m m m',
  '~ f m m m m m m m',
  '~ f m m m m m m m',
  '~ f m m m m m m m',
  '~ f m m m m m m m',
  '~ f m m m m m m m',
  '~ f , , C , , , ,',
];
const start = (year = 7, rows = VALLEY) =>
  scenario(rows, {
    content: W,
    year,
    citizens: 30,
    stores: { food: 500, biomass: 100, materials: 300 },
  });
const build = (s: RunState, id: string, cells: [number, number][]) =>
  cells.reduce((acc, [col, row]) => place(acc, id, col, row, W), s);
/** Ends the season with the larder topped up: these tests are about the garden, not food. */
const end = (s: RunState) => endSeason({ ...s, stores: { ...s.stores, food: 40 } }, W);

/** A closed Bath Loop (kiln → bathhouse → reed bed) and 3 reed beds, one season on. */
function ready(year = 7, reedBeds = 3): RunState {
  let s = start(year);
  s = build(s, 'irrigationChannel', [
    [1, 2],
    [2, 2],
    [3, 2],
    [4, 2],
  ]);
  s = build(s, 'bathhouse', [[2, 1]]);
  s = build(s, 'kiln', [[2, 0]]);
  s = build(s, 'solarCanopy', [
    [5, 0],
    [6, 0],
  ]);
  s = build(
    s,
    'reedBed',
    (
      [
        [3, 1],
        [4, 1],
        [1, 1],
      ] as [number, number][]
    ).slice(0, reedBeds),
  );
  s = end(s);
  expect(s.loops.map((l) => l.combo)).toContain('bathLoop');
  return s;
}
/** The garden centred on (3,4): meadows, its top petals touching the channel. */
const startGarden = (s: RunState) => place(s, GARDEN, 3, 4, W);

describe('starting the Great Water Garden', () => {
  it('needs a closed Bath Loop and 3 reed beds', () => {
    expect(rejects(start(), { type: 'place', building: GARDEN, at: at(3, 4) }, W)).toBe(
      'the Great Water Garden needs a closed Bath Loop and 3 reed beds (0 now)',
    );
    expect(rejects(ready(7, 2), { type: 'place', building: GARDEN, at: at(3, 4) }, W)).toBe(
      'the Great Water Garden needs 3 reed beds (2 now)',
    );
    expect(startGarden(ready()).buildings).toBeDefined();
  });

  it('from era 3, joining the palette as era 3 begins', () => {
    expect(rejects(ready(4), { type: 'place', building: GARDEN, at: at(3, 4) }, W)).toBe(
      'the Great Water Garden can be started from era 3',
    );
    // The last season of era 2: the next is era 3's first, which brings it.
    const s = scenario(VALLEY, { content: W, year: 6, unlockAll: false });
    const winter = { ...s, season: 'winter' as const, turn: 23 };
    expect(winter.unlocked).not.toContain(GARDEN);
    const next = end(winter);
    expect(next.era).toBe(3);
    expect(next.unlocked).toContain(GARDEN);
    expect(
      next.notices.some((n) => n.startsWith('The Great Water Garden can be built from now')),
    ).toBe(true);
  });

  it('on 7 free land tiles, one of them touching the river, a reservoir or a channel', () => {
    const s = ready();
    const why = (col: number, row: number) =>
      rejects(s, { type: 'place', building: GARDEN, at: at(col, row) }, W);
    // Over the river, over a building, half outside the valley, far from water.
    expect(why(1, 4)).toBe("the Great Water Garden can't be built over river");
    expect(why(3, 2)).toBe('the Great Water Garden needs 7 free tiles');
    expect(why(8, 4)).toBe('the Great Water Garden needs all 7 of its tiles inside the valley');
    expect(why(6, 5)).toBe('the Great Water Garden must touch the river, a reservoir or a channel');
  });

  it('costs 60 materials and 30 biomass, once a run, and covers its 7 tiles', () => {
    const before = ready();
    const s = startGarden(before);
    expect(before.stores.materials - s.stores.materials).toBe(60);
    expect(before.stores.biomass - s.stores.biomass).toBe(30);
    const garden = s.buildings[uidAt(s, 3, 4)]!;
    expect(garden.footprint).toBe(1);
    // Its petals are its own: nothing else can go there, and they are the garden.
    expect(buildingAt(s, at(2, 5))).toBe(garden);
    expect(rejects(s, { type: 'place', building: 'pollinatorMeadow', at: at(2, 5) }, W)).toBe(
      'tile already has a building',
    );
    expect(rejects(s, { type: 'place', building: GARDEN, at: at(6, 5) }, W)).toBe(
      'the Great Water Garden is already started',
    );
    expect(rejects(s, { type: 'demolish', uid: garden.uid }, W)).toBe(
      "the Great Water Garden can't be demolished",
    );
  });
});

describe('building it and what it gives', () => {
  it('takes 4 seasons, then adds 60 to the score and raises the Graft a tier', () => {
    let s = startGarden(ready());
    const uid = uidAt(s, 3, 4);
    const stages: (number | null)[] = [];
    for (let i = 0; i < 4; i++) {
      stages.push(wonderStage(W, s, s.buildings[uid]!));
      expect(scoreRun(W, s).lines.some((l) => l.reason === 'Great Water Garden')).toBe(false);
      s = end(s);
    }
    // Dug and staked; pools filling; planted but bare (twice); then finished.
    expect(stages).toEqual([1, 2, 3, 3]);
    expect(wonderStage(W, s, s.buildings[uid]!)).toBeNull();
    expect(s.lastReport!.wondersDone).toEqual([GARDEN]);
    expect(s.notices).toContain(
      'The Great Water Garden is finished: +60 to the score, and the Graft a tier higher',
    );
    const score = scoreRun(W, s);
    expect(score.lines).toContainEqual({ reason: 'Great Water Garden', points: 60 });
    expect(score.lift).toEqual({ tiers: 1, by: 'the Great Water Garden' });
    // A tier above what the points alone reach.
    const tiers = W.rules.score.tiers;
    const byPoints = tiers.filter((t) => score.total >= t.min).length - 1;
    expect(tiers.indexOf(score.tier)).toBe(Math.min(tiers.length - 1, byPoints + 1));
  });

  it('a finished garden meets the Bloom era goal', () => {
    const bloom = eraGoal(W, 4)!;
    expect(eraGoalOr(W, bloom)!.text).toBe('Or finish the Great Water Garden.');
    let s = startGarden(ready(9));
    for (let i = 0; i < 4; i++) s = end(s);
    expect(s.era).toBe(4);
    expect(eraGoalMet(W, s, bloom)).toBe(true);
    // The first season of era 4 finished it, so the goal's reward came with it.
    expect(s.eraGoalsMet).toContain(4);
    // Without water there is no garden, so no other way.
    expect(eraGoalOr(content, eraGoal(content, 4)!)).toBeNull();
  });

  it('none without the water system', () => {
    const s = scenario(VALLEY, { year: 7 });
    expect(s.unlocked).not.toContain(GARDEN);
    // Not on the palette, and not placeable even if it were.
    expect(
      rejects(
        { ...s, unlocked: [...s.unlocked, GARDEN] },
        { type: 'place', building: GARDEN, at: at(3, 4) },
      ),
    ).toBe('Great Water Garden needs the water system');
  });

  it('a building beside it sees the garden once, and the garden is not its own neighbour', async () => {
    const { neighborBuildings } = await import('../src/sim/queries');
    let s = startGarden(ready());
    // (4,6) touches two petals, (3,5) and (4,5).
    s = act(s, { type: 'place', building: 'pollinatorMeadow', at: at(4, 6) }, W);
    const meadow = s.buildings[uidAt(s, 4, 6)]!;
    const garden = s.buildings[uidAt(s, 3, 4)]!;
    expect(neighborBuildings(s, meadow).filter((b) => b === garden)).toHaveLength(1);
    expect(neighborBuildings(s, garden)).not.toContain(garden);
    expect(neighborBuildings(s, garden)).toContain(meadow);
  });
});

describe('in a full run (E5: done when)', () => {
  it('the balanced bot finishes the garden, and its score and Graft lift apply', async () => {
    const { BOTS } = await import('../src/balance/bots');
    const { playRun } = await import('../src/balance/runner');
    let last: RunState | null = null;
    playRun(W, BOTS.balanced!, 'garden-9', { onSeason: (s) => (last = s) });
    const s = last as unknown as RunState;
    expect(s.status).toBe('complete');
    const garden = Object.values(s.buildings).find((b) => b.type === GARDEN)!;
    expect(garden.finished).toBeDefined();
    const score = scoreRun(W, s);
    expect(score.lines).toContainEqual({ reason: 'Great Water Garden', points: 60 });
    // A tier above what its points reach, up to the top (this run's points already reach it).
    const tiers = W.rules.score.tiers;
    const byPoints = tiers.filter((t) => score.total >= t.min).length - 1;
    expect(tiers.indexOf(score.tier)).toBe(Math.min(tiers.length - 1, byPoints + 1));
  }, 60_000);
});
