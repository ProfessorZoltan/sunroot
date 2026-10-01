/**
 * Milestone 7: visions, the run's ledger, the score and its Graft tier, the
 * Graft offer, and saves that resume exactly.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  canPlantGraft,
  createRun,
  eraGoal,
  goalProgress,
  graftOffer,
  makeSave,
  readSave,
  scoreRun,
  seedsForRun,
  SEASONS,
  visionMet,
  visionProgress,
  type RunState,
} from '../src/sim';
import { act, content, endSeason, place, rejects, scenario } from './helpers';

const DRY = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , m , ^',
];
const vision = (id: string) => content.visions.find((v) => v.id === id)!;
const withVision = (s: RunState, id: string): RunState => ({ ...s, vision: id });

describe('visions', () => {
  it('are off unless asked for, and never change the run itself', () => {
    const plain = createRun(content, { seed: 'v' });
    expect(plain.visionOffer).toEqual([]);
    const offered = createRun(content, { seed: 'v', visions: true });
    expect(offered.visionOffer).toHaveLength(2);
    expect(createRun(content, { seed: 'v', visions: true }).visionOffer).toEqual(
      offered.visionOffer,
    );
    // Same draft, same random stream.
    expect(offered.draft).toEqual(plain.draft);
    expect(offered.rng).toEqual(plain.rng);
  });

  it('one must be chosen before the first season ends', () => {
    let s = createRun(content, { seed: 'v', visions: true });
    s = act(s, { type: 'pickCard', card: s.draft.offer[0]! });
    expect(rejects(s, { type: 'endSeason' })).toMatch(/choose a vision/);
    const missing = content.visions.find((v) => !s.visionOffer.includes(v.id))!.id;
    expect(rejects(s, { type: 'pickVision', vision: missing })).toMatch(/not on offer/);
    s = act(s, { type: 'pickVision', vision: s.visionOffer[1]! });
    expect(s.vision).toBe(createRun(content, { seed: 'v', visions: true }).visionOffer[1]);
    expect(s.visionOffer).toEqual([]);
    expect(act(s, { type: 'endSeason' }).turn).toBe(1);
  });

  it('Restore the Reach: 60% of the healable land meadow or woodland', () => {
    let s = withVision(scenario(DRY, { stores: { compost: 100 } }), 'restoreTheReach');
    const land = Object.values(s.map.tiles).filter((t) =>
      content.rules.landHealth.includes(t.type),
    );
    const need = Math.ceil(land.length * 0.6);
    expect(visionProgress(content, s, vision('restoreTheReach')).text).toBe(
      `1 of ${need} healable tiles are meadow or woodland`,
    );
    const scrub = land.filter((t) => t.type === 'scrub');
    for (const t of scrub.slice(0, need - 2)) s = act(s, { type: 'spreadCompost', at: t });
    s = endSeason(s);
    expect(s.visionAchieved).toBeNull();
    s = act(s, { type: 'spreadCompost', at: scrub[need - 2]! });
    s = endSeason(s);
    expect(s.lastReport!.visionAchieved).toBe(true);
    expect(s.visionAchieved).toBe(1);
  });

  it('Lantern of the Valley: a full year, spring to winter, with 30 citizens and no shortfall', () => {
    // A year of seasons, as the run's history records them.
    const year = (citizens: number[], shortfalls: number[]) => {
      const s = withVision(scenario(DRY), 'lanternOfTheValley');
      const history = SEASONS.map((season, i) => ({
        ...structuredClone(endSeason(s).history[0]!),
        turn: i,
        season,
        citizens: citizens[i]!,
        shortfall: shortfalls[i]!,
      }));
      return { ...s, history };
    };
    const lit = year([30, 31, 32, 33], [0, 0, 0, 0]);
    expect(visionMet(content, lit)).toBe(true);
    expect(visionMet(content, year([30, 29, 32, 33], [0, 0, 0, 0]))).toBe(false);
    expect(visionMet(content, year([30, 31, 32, 33], [0, 0, 2, 0]))).toBe(false);
    expect(visionMet(content, { ...lit, history: lit.history.slice(0, 3) })).toBe(false);
    expect(
      visionProgress(
        content,
        { ...lit, history: lit.history.slice(0, 3) },
        vision('lanternOfTheValley'),
      ),
    ).toEqual({
      share: 0.75,
      text: '3 of 4 seasons this year without a shortfall with 30 or more citizens',
    });

    // In play: a small settlement's quiet year doesn't count.
    let small = withVision(scenario(DRY), 'lanternOfTheValley');
    for (let i = 0; i < 4; i++) small = endSeason(small);
    expect(small.history.every((h) => h.shortfall === 0)).toBe(true);
    expect(small.visionAchieved).toBeNull();
  });

  it('Thriving Commons: 50 citizens at wellbeing 70 or more', () => {
    const run = (citizens: number, wellbeing: number) =>
      endSeason(
        withVision(
          scenario(DRY, { citizens, wellbeing, stores: { food: 300 } }),
          'thrivingCommons',
        ),
      );
    expect(run(50, 80).visionAchieved).toBe(0);
    expect(run(50, 50).visionAchieved).toBeNull();
    expect(run(45, 80).visionAchieved).toBeNull();
  });
});

describe('era goals', () => {
  it('are met by the end of any season in their era, once, for 3 knowledge', () => {
    let s = scenario(DRY, { citizens: 10, stores: { food: 100 } });
    s = endSeason(s);
    expect(s.lastReport!.eraGoalMet).toBe(1);
    expect(s.eraGoalsMet).toEqual([1]);
    expect(s.stores.knowledge).toBe(3);
    s = endSeason(s);
    expect(s.lastReport!.eraGoalMet).toBeNull();
    expect(s.stores.knowledge).toBe(3);
  });

  it('each era checks only its own goal', () => {
    // 10 citizens in era 2: Settle's goal is past, and Mend asks for 2 loops.
    const mend = endSeason(scenario(DRY, { year: 4, citizens: 10, stores: { food: 100 } }));
    expect(mend.eraGoalsMet).toEqual([]);
    const loops = endSeason({
      ...scenario(DRY, { year: 4 }),
      loops: [
        { combo: 'kitchenLoop', anchor: 'b0', members: ['b0'], turn: 0 },
        { combo: 'gasLoop', anchor: 'b0', members: ['b0'], turn: 0 },
      ],
    });
    expect(loops.eraGoalsMet).toEqual([2]);
    const flourish = { ...scenario(DRY, { year: 7, stores: { compost: 100 } }) };
    expect(goalProgress(content, flourish, eraGoal(content, 3)!.goal).text).toMatch(
      /^Harmony \d+ of 40$/,
    );
  });

  it('Bloom: a full year with no shortfall', () => {
    let s = scenario(DRY, { year: 10 });
    for (let i = 0; i < 3; i++) s = endSeason(s);
    expect(s.eraGoalsMet).toEqual([]);
    s = endSeason(s);
    expect(s.eraGoalsMet).toEqual([4]);
  });

  it('an older save without them still loads', () => {
    const save = JSON.parse(JSON.stringify(makeSave(createRun(content, { seed: 'old' }), 'then')));
    delete save.state.eraGoalsMet;
    const read = readSave(content, save);
    expect(read.ok && read.save.state.eraGoalsMet).toEqual([]);
  });
});

describe('the ledger, the score and the Graft', () => {
  it('the ledger adds up the run: energy by source, food, people and industry', () => {
    let s = scenario(DRY, { season: 'summer', stores: { salvage: 4 } });
    s = place(s, 'solarCanopy', 6, 2);
    s = place(s, 'workshop', 7, 2);
    s = endSeason(s);
    s = endSeason(s);
    expect(s.ledger.energy).toEqual({ foundersCamp: 8, solarCanopy: 6 });
    expect(s.ledger.citizenSeasons).toBe(s.history.reduce((n, h) => n + h.citizens, 0));
    expect(s.ledger.industry).toBe(6); // two salvage runs, 3 materials each
  });

  it('scores people, Harmony, wellbeing, loops, discoveries, the vision and finishing', () => {
    let s = scenario(DRY, { year: 12, season: 'winter' });
    s = { ...s, vision: 'thrivingCommons', visionAchieved: 40, discoveries: ['busyBees'] };
    s = endSeason(s);
    const score = scoreRun(content, s);
    const reasons = score.lines.map((l) => l.reason);
    expect(reasons).toContain('vision: Thriving Commons');
    expect(reasons).toContain('run completed');
    expect(reasons).toContain('1 combo discovered');
    expect(score.total).toBe(score.lines.reduce((n, l) => n + l.points, 0));
    expect(score.tier.id).toBe(
      [...content.rules.score.tiers].reverse().find((t) => score.total >= t.min)!.id,
    );
  });

  it('a short run is a Seedling, and the next tier says how far it is', () => {
    const s = scenario(DRY);
    const score = scoreRun(content, s);
    expect(score.tier.id).toBe('seedling');
    expect(score.next?.tier.id).toBe('sapling');
    expect(score.next!.points).toBe(content.rules.score.tiers[1]!.min - score.total);
  });

  it('offers the 2 districts the run leans towards most', () => {
    let s = scenario(DRY, { season: 'autumn' });
    s = place(s, 'riverWheel', 5, 2);
    s = place(s, 'riverWheel', 5, 1);
    for (let i = 0; i < 4; i++) s = endSeason(s);
    const offer = graftOffer(content, s);
    expect(offer.options).toHaveLength(2);
    expect(offer.options[0]!.district.id).toBe('millraceQuarter');
    expect(offer.signature.energyShare.riverWheel).toBe(1);
    expect(offer.options[0]!.lean).toBeGreaterThan(offer.options[1]!.lean);
    expect(offer.tier).toEqual(scoreRun(content, s).tier);
  });
});

describe('Seeds', () => {
  it('a run earns 10 plus 1 for every 14 points of its score, ended early or not', () => {
    const done = endSeason(scenario(DRY, { year: 12, season: 'winter' }));
    const score = scoreRun(content, done).total;
    expect(seedsForRun(content, done).total).toBe(10 + Math.floor(score / 14));
    const ended = { ...scenario(DRY), turn: 9, status: 'collapsed' as const };
    expect(seedsForRun(content, ended).total).toBe(
      10 + Math.floor(scoreRun(content, ended).total / 14),
    );
    expect(seedsForRun(content, scenario(DRY)).total).toBe(0); // still playing
  });

  it('only a top-quarter score earns a Graft by itself', () => {
    const graftCost = content.progression!.graftCost;
    // The score that earns exactly a Graft's Seeds sits above the Sapling band.
    const needed = (graftCost - content.progression!.seeds.base) * 14;
    const sapling = content.rules.score.tiers.find((t) => t.id === 'sapling')!.min;
    expect(needed).toBeGreaterThan(sapling);
    expect(canPlantGraft(content, graftCost - 1)).toBe(false);
    expect(canPlantGraft(content, graftCost)).toBe(true);
  });
});

describe('saves', () => {
  const play = (s: RunState, seasons: number) => {
    let x = s;
    for (let i = 0; i < seasons; i++) x = endSeason(x);
    return x;
  };

  it('round-trip through JSON and resume exactly where they left off', () => {
    let s = createRun(content, { seed: 'save', visions: true });
    s.stores.food = 300; // nothing is farmed in this test
    s = act(s, { type: 'pickVision', vision: s.visionOffer[0]! });
    s = play(s, 5);
    s = place(s, 'cottage', ...emptySite(s));
    const text = JSON.stringify(makeSave(s, '2026-10-01T00:00:00Z'));
    const read = readSave(content, JSON.parse(text));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.save.summary).toEqual({ year: 2, season: 'summer', turn: 5, status: 'active' });
    const resumed = read.save.state;
    expect(resumed).toEqual(s);
    // Undo still works after loading, and both runs go on identically.
    expect(applyCommand(content, resumed, { type: 'undo' }).ok).toBe(true);
    expect(JSON.stringify(play(resumed, 6))).toBe(JSON.stringify(play(s, 6)));
  });

  it('refuse anything that is not a usable save, with a reason', () => {
    const good = JSON.parse(JSON.stringify(makeSave(createRun(content, { seed: 'x' }), 'now')));
    const bad = (change: (x: Record<string, unknown>) => void) => {
      const copy = structuredClone(good);
      change(copy);
      const r = readSave(content, copy);
      return r.ok ? 'ok' : r.error;
    };
    expect(readSave(content, null)).toEqual({ ok: false, error: 'not a save' });
    expect(bad((x) => (x.format = 'other'))).toMatch(/not a Sunroot save/);
    expect(bad((x) => (x.version = 99))).toMatch(/save version 99/);
    expect(bad((x) => (x.contentId = 'windsweptCoast'))).toMatch(/for windsweptCoast/);
    expect(bad((x) => ((x.state as RunState).version = 1 as 2))).toMatch(/run version 1/);
    expect(bad((x) => delete (x.state as Partial<RunState>).ledger)).toMatch(/missing ledger/);
    expect(bad((x) => ((x.state as RunState).buildings.b0!.type = 'castle'))).toMatch(
      /unknown building castle/,
    );
  });
});

/** An empty scrub tile next to the camp, as (col, row) for `place`. */
function emptySite(s: RunState): [number, number] {
  const camp = s.buildings.b0!.at;
  const taken = new Set(Object.values(s.buildings).map((b) => `${b.at.q},${b.at.r}`));
  for (const [dq, dr] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, -1],
    [-1, 1],
  ] as const) {
    const h = { q: camp.q + dq, r: camp.r + dr };
    const t = s.map.tiles[`${h.q},${h.r}`];
    if (t && !taken.has(`${h.q},${h.r}`) && t.type !== 'river' && t.type !== 'floodplain') {
      const r = h.r;
      return [h.q + (r - (r & 1)) / 2, r];
    }
  }
  throw new Error('no free site');
}
