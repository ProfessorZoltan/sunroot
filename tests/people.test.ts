import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim';
import { act, at, content, endSeason, place, scenario, tileTypeAt, uidAt } from './helpers';

// Dry land: no floodplain, so spring floods touch nothing.
const DRY = [
  '^ ^ , . ~ . , m ^ ^',
  ' ^ . , , ~ , . m W ^',
  '^ . C , ~ , . . . ^',
  ' ^ . , , ~ , . . . ^',
];

describe('population', () => {
  it('grows by 1 at wellbeing 60+ with free housing and 2 spare food', () => {
    let s = scenario(DRY, { season: 'autumn', stores: { food: 30 } });
    s = place(s, 'cottage', 3, 1);
    s = place(s, 'fishPond', 3, 2);
    s = place(s, 'fishPond', 5, 2);
    s = place(s, 'fishPond', 5, 1);
    s = place(s, 'fishPond', 5, 3);
    s = endSeason(s); // 4 ponds x 2 = 8 food, 6 eaten: 2 spare
    expect(s.lastReport!.food.produced).toBe(8);
    expect(s.citizens).toBe(7);
  });

  it('does not grow without 2 spare food, free housing or wellbeing 60', () => {
    const base = () => {
      let s = scenario(DRY, { season: 'autumn', stores: { food: 30 } });
      s = place(s, 'fishPond', 3, 2);
      s = place(s, 'fishPond', 5, 2);
      s = place(s, 'fishPond', 5, 1);
      s = place(s, 'fishPond', 5, 3);
      return s;
    };
    expect(endSeason(base()).citizens).toBe(6); // no free housing
    let lowSpare = scenario(DRY, { season: 'autumn', stores: { food: 30 } });
    lowSpare = place(lowSpare, 'cottage', 3, 1);
    expect(endSeason(lowSpare).citizens).toBe(6); // no food produced
    let unhappy = place(base(), 'cottage', 3, 1);
    unhappy.wellbeing = 59;
    expect(endSeason(unhappy).citizens).toBe(6);
    unhappy = place(base(), 'cottage', 3, 1);
    unhappy.wellbeing = 60;
    expect(endSeason(unhappy).citizens).toBe(7);
  });

  it('grows by 2 at wellbeing 80+, limited by housing', () => {
    let s = scenario(DRY, { season: 'autumn', stores: { food: 30 }, wellbeing: 80 });
    for (const [c, r] of [
      [3, 2],
      [5, 2],
      [5, 1],
      [5, 3],
    ] as const) {
      s = place(s, 'fishPond', c, r);
    }
    s = place(s, 'cottage', 3, 1);
    expect(endSeason(s).citizens).toBe(8);
    s = place(s, 'cottage', 3, 3);
    s.citizens = 8; // 12 beds, but 8 citizens eat all 8 food: nothing spare
    expect(endSeason(s).lastReport!.population.change).toBe(0);
  });

  it('loses a citizen each season below wellbeing 20', () => {
    const s = scenario(DRY, { wellbeing: 19 });
    expect(endSeason(s).citizens).toBe(5);
  });
});

describe('wellbeing', () => {
  it('+1 when every need is met', () => {
    const s = endSeason(scenario(DRY));
    expect(s.lastReport!.wellbeing.lines).toEqual([{ reason: 'every need met', amount: 1 }]);
    expect(s.wellbeing).toBe(61);
  });

  it('-3 per unfed citizen', () => {
    const s = endSeason(scenario(DRY, { stores: { food: 2 } }));
    expect(s.lastReport!.food.unfed).toBe(4);
    expect(s.lastReport!.wellbeing.lines).toEqual([{ reason: '4 unfed citizens', amount: -12 }]);
    expect(s.wellbeing).toBe(48);
  });

  it('-1 per 5 clutter', () => {
    const s = endSeason(scenario(DRY, { stores: { clutter: 11 } }));
    expect(s.lastReport!.wellbeing.lines).toContainEqual({ reason: '11 clutter', amount: -2 });
  });

  it('+1 per cottage next to meadow or woodland', () => {
    let s = scenario(DRY);
    s = place(s, 'cottage', 8, 2); // touches the woodland at (8,1)
    s = place(s, 'cottage', 2, 3); // bare ground
    s = endSeason(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      reason: 'Cottage next to meadow or woodland',
      amount: 1,
    });
    expect(s.wellbeing).toBe(62);
  });

  it('is capped at 100 and a run collapses at 0', () => {
    let s = scenario(DRY, { wellbeing: 100 });
    expect(endSeason(s).wellbeing).toBe(100);
    s = scenario(DRY, { wellbeing: 5, stores: { food: 0 } });
    s = endSeason(s);
    expect(s.wellbeing).toBe(0);
    expect(s.status).toBe('collapsed');
    const next = applyCommand(content, s, { type: 'endSeason' });
    expect(next.ok).toBe(false);
  });
});

describe('scraps and clutter', () => {
  it('every 3 citizens make 1 scrap; unprocessed scraps become clutter a season later', () => {
    let s = scenario(DRY);
    s = endSeason(s);
    expect(s.stores.scraps).toBe(2);
    expect(s.stores.clutter).toBe(0);
    s = endSeason(s);
    expect(s.lastReport!.clutter.fromScraps).toBe(2);
    expect(s.stores.clutter).toBe(2);
    expect(s.harmony).toBe(scenario(DRY).harmony - 2);
  });
});

describe('workers', () => {
  it('each citizen staffs one building, in priority order', () => {
    let s = scenario(DRY, { citizens: 2, season: 'autumn' });
    s = place(s, 'fishPond', 3, 2);
    s = place(s, 'fishPond', 5, 2);
    s = place(s, 'fishPond', 5, 1);
    s = endSeason(s);
    expect(s.lastReport!.unstaffed).toEqual([uidAt(s, 5, 1)]);
    expect(s.lastReport!.food.produced).toBe(4);
  });
});

describe('run length', () => {
  it('ends complete after 12 years (48 seasons)', () => {
    let s = scenario(DRY, { year: 12, season: 'winter' });
    s = endSeason(s);
    expect(s.turn).toBe(48);
    expect(s.status).toBe('complete');
  });
});

describe('land', () => {
  it('a tree nursery improves its least healthy neighbour one step each season', () => {
    let s = scenario(DRY);
    s = place(s, 'treeNursery', 6, 2);
    // Neighbours of (6,2): (5,2) scrub, (7,2) barren, (5,1) scrub, (6,1) barren, (5,3) scrub, (6,3) barren.
    s = endSeason(s);
    expect(tileTypeAt(s, 7, 2)).toBe('scrub');
    s = endSeason(s);
    expect(tileTypeAt(s, 6, 1)).toBe('scrub');
  });

  it('2 compost improves a tile one step', () => {
    let s = scenario(DRY, { stores: { compost: 5 } });
    const spot = at(3, 0);
    const h = s.harmony;
    s = act(s, { type: 'spreadCompost', at: spot });
    expect(tileTypeAt(s, 3, 0)).toBe('scrub');
    expect(s.stores.compost).toBe(3);
    s = act(s, { type: 'spreadCompost', at: spot });
    expect(tileTypeAt(s, 3, 0)).toBe('meadow');
    expect(s.harmony).toBe(h + 1);
    expect(() => act(s, { type: 'spreadCompost', at: spot })).toThrow(/needs 2 compost/);
    s.stores.compost = 4;
    s = act(s, { type: 'spreadCompost', at: spot });
    expect(tileTypeAt(s, 3, 0)).toBe('woodland');
    expect(() => act(s, { type: 'spreadCompost', at: spot })).toThrow(/can't improve woodland/);
  });

  it('a pollinator meadow turns its tile to meadow and adds 1 Harmony', () => {
    let s = scenario(DRY);
    const h = s.harmony;
    s = place(s, 'pollinatorMeadow', 6, 2);
    expect(tileTypeAt(s, 6, 2)).toBe('meadow');
    expect(s.harmony).toBe(h + 2);
  });

  it('Harmony = meadow + 2 x woodland + pollinator meadows - clutter', () => {
    let s = scenario(DRY, { stores: { clutter: 1 } });
    // Meadows at (7,0) and (7,1), woodland at (8,1).
    expect(s.harmony).toBe(2 + 2 - 1);
    s = place(s, 'pollinatorMeadow', 7, 0);
    expect(s.harmony).toBe(2 + 2 + 1 - 1);
  });
});
