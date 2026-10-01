import { describe, expect, it } from 'vitest';
import { applyCommand, hexDistance, loadContent, waterDistance } from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { act, at, content, endSeason, place, scenario, tileTypeAt, uidAt } from './helpers';

// Floodplain along both banks of a river in column 4.
const RIVER = [
  '^ . , f ~ f , . ^ ^',
  ' ^ . , f ~ f , . . ^',
  '^ . C f ~ f f . R ^',
  ' ^ . m m ~ f , . . ^',
  '^ . . , ~ f , . m ^',
  ' ^ . . , ~ f , . . ^',
];

// A wide floodplain for neighbour bonuses.
const FIELDS = [
  '^ . f f ~ f f f ^ ^',
  ' ^ . f f ~ f f f . ^',
  '^ . C f ~ f f f . ^',
  ' ^ . , , ~ , , . . ^',
];

const food = (s: ReturnType<typeof scenario>, col: number, row: number) =>
  s.lastReport!.yields[uidAt(s, col, row)]?.food ?? 0;

describe('farms', () => {
  it('floodplain farms make 2 / 4 / 5 / 0 food and 1 biomass except winter; on meadow 1 less food', () => {
    let s = scenario(RIVER, { citizens: 2 });
    s = place(s, 'floodplainFarm', 3, 3); // meadow
    s = place(s, 'levee', 3, 0); // keep silt off the floodplain farm for this test
    s = place(s, 'floodplainFarm', 3, 1);
    expect(hexDistance(at(3, 0), at(3, 1))).toBeLessThanOrEqual(2);
    const meadow: number[] = [];
    const flood: number[] = [];
    const biomass: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s);
      meadow.push(food(s, 3, 3));
      flood.push(food(s, 3, 1));
      biomass.push(s.lastReport!.yields[uidAt(s, 3, 1)]?.biomass ?? 0);
    }
    expect(flood).toEqual([2, 4, 5, 0]);
    expect(meadow).toEqual([1, 3, 4, 0]);
    expect(biomass).toEqual([1, 1, 1, 0]);
  });

  it('the flood leaves silt: +50% food in summer and autumn, rounded down', () => {
    let s = scenario(RIVER, { citizens: 2 });
    s = place(s, 'floodplainFarm', 5, 3);
    s = endSeason(s);
    expect(s.lastReport!.silted).toEqual([uidAt(s, 5, 3)]);
    expect(s.buildings[uidAt(s, 5, 3)]!.siltYear).toBe(1);
    s = endSeason(s);
    expect(food(s, 5, 3)).toBe(6);
    s = endSeason(s);
    expect(food(s, 5, 3)).toBe(7);
  });

  it('farms more than 2 tiles from water lose half their summer yield in low river', () => {
    let s = scenario(RIVER, { season: 'summer' });
    s = place(s, 'floodplainFarm', 8, 4); // meadow, far from the river
    s = place(s, 'floodplainFarm', 3, 3); // meadow, next to the river
    expect(waterDistance(content, s, at(8, 4))).toBeGreaterThan(2);
    s = endSeason(s);
    expect(food(s, 8, 4)).toBe(1); // (4 - 1) x 0.5
    expect(food(s, 3, 3)).toBe(3);
  });

  it('fish ponds count as water', () => {
    let s = scenario(RIVER);
    expect(waterDistance(content, s, at(7, 4))).toBe(3);
    s = place(s, 'fishPond', 5, 4);
    expect(waterDistance(content, s, at(7, 4))).toBe(2);
  });
});

describe('the spring flood', () => {
  it('disables buildings that are not flood-tolerant; repairs cost 2 materials next season', () => {
    let s = scenario(RIVER, { stores: { materials: 20, salvage: 10 } });
    s = place(s, 'workshop', 5, 5);
    s = place(s, 'fishPond', 5, 4);
    const materials = s.stores.materials;
    s = endSeason(s);
    const workshop = uidAt(s, 5, 5);
    expect(s.lastReport!.damaged).toEqual([workshop]);
    expect(s.lastReport!.runs[workshop]).toBeUndefined();
    expect(s.lastReport!.yields[uidAt(s, 5, 4)]?.food).toBe(2);
    // Repaired at the start of summer.
    expect(s.buildings[workshop]!.damage).toBeUndefined();
    expect(s.stores.materials).toBe(materials + 2 - 2);
    expect(s.notices[0]).toMatch(/Repaired Workshop/);
  });

  it('stays damaged until materials allow the repair', () => {
    let s = scenario(RIVER);
    s = place(s, 'workshop', 5, 5);
    s = place(s, 'workshop', 5, 4);
    s.stores.materials = 0;
    s = endSeason(s); // the camp forages 2: enough for one repair
    expect(s.buildings[uidAt(s, 5, 5)]!.damage).toBeUndefined();
    expect(s.buildings[uidAt(s, 5, 4)]!.damage?.cause).toBe('flood');
    expect(s.notices[1]).toMatch(/still flood-damaged/);
  });

  it('levees protect floodplain within 2 tiles from damage and from silt', () => {
    let s = scenario(RIVER);
    s = place(s, 'levee', 5, 1);
    s = place(s, 'floodplainFarm', 5, 2);
    s = place(s, 'workshop', 6, 2);
    s = place(s, 'workshop', 5, 5);
    s = endSeason(s);
    const r = s.lastReport!;
    expect(r.silted).toEqual([]);
    expect(r.damaged).toEqual([uidAt(s, 5, 5)]);
    expect(r.flooded).not.toContain(`${at(5, 2).q},${at(5, 2).r}`);
  });

  it('a weir halves the flooded area, keeping the lowest ground flooded', () => {
    let s = scenario(RIVER);
    const floodplain = s.map.floodOrder.length;
    s = place(s, 'weir', 4, 5);
    s = endSeason(s);
    expect(s.lastReport!.flooded).toHaveLength(Math.floor(floodplain / 2));
    expect(s.lastReport!.flooded).toEqual(s.map.floodOrder.slice(0, Math.floor(floodplain / 2)));
  });

  it('a weir turns 3 upstream river tiles into reservoir and costs downstream fish ponds 1 food', () => {
    let s = scenario(RIVER, { season: 'summer' });
    s = place(s, 'fishPond', 3, 1); // upstream of the weir
    s = place(s, 'fishPond', 5, 5); // downstream
    s = place(s, 'weir', 4, 4);
    expect([0, 1, 2, 3, 4, 5].map((row) => tileTypeAt(s, 4, row))).toEqual([
      'river',
      'reservoir',
      'reservoir',
      'reservoir',
      'river',
      'river',
    ]);
    s = endSeason(s);
    expect(food(s, 3, 1)).toBe(1);
    expect(food(s, 5, 5)).toBe(0);
  });
});

describe('neighbour bonuses', () => {
  it('an apiary gives +1 food to up to 3 neighbouring farms, spring to autumn', () => {
    let s = scenario(FIELDS, { season: 'autumn' });
    for (const [c, r] of [
      [5, 1],
      [7, 1],
      [6, 0],
      [7, 0],
      [6, 2],
    ] as const) {
      s = place(s, 'floodplainFarm', c, r);
    }
    s = place(s, 'apiary', 6, 1);
    s = endSeason(s);
    expect(s.lastReport!.bonuses.apiary).toBe(3);
    expect(s.lastReport!.food.produced).toBe(5 * 5 + 3);
  });

  it('an apiary next to a wind spire does nothing', () => {
    let s = scenario(FIELDS, { season: 'autumn' });
    s = place(s, 'floodplainFarm', 7, 1);
    s = place(s, 'apiary', 8, 1);
    s = place(s, 'windSpire', 9, 1);
    s = endSeason(s);
    expect(s.lastReport!.bonuses.apiary).toBe(0);
    expect(food(s, 7, 1)).toBe(5);
  });

  it('a composter turns scraps (first) and biomass into compost, which feeds neighbouring food buildings', () => {
    let s = scenario(FIELDS, { season: 'autumn', stores: { scraps: 2 } });
    s = place(s, 'floodplainFarm', 5, 1);
    s = place(s, 'floodplainFarm', 7, 1);
    s = place(s, 'floodplainFarm', 6, 0);
    s = place(s, 'composter', 6, 1);
    s = endSeason(s);
    const r = s.lastReport!;
    // 2 scraps + 1 of the farms' 3 biomass -> 2 compost; only 2 of 3 farms get +1.
    expect(r.yields[uidAt(s, 6, 1)]?.compost).toBe(2);
    expect(r.bonuses.compost).toBe(2);
    expect(s.stores.compost).toBe(0);
    expect(s.stores.biomass).toBe(2);
    expect(r.clutter.fromScraps).toBe(0);
    expect([food(s, 5, 1), food(s, 7, 1), food(s, 6, 0)].sort()).toEqual([5, 6, 6]);
  });

  it('bonuses only reach buildings that are producing food that season', () => {
    let s = scenario(FIELDS, { season: 'winter', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 1);
    s = place(s, 'composter', 6, 1);
    s = endSeason(s);
    expect(s.lastReport!.bonuses.compost).toBe(0);
    expect(s.stores.compost).toBe(2);
  });
});

describe('other food buildings', () => {
  it('orchards produce after 2 seasons and turn their tile to meadow', () => {
    let s = scenario(RIVER, { citizens: 2 });
    expect(() => place(s, 'orchard', 5, 3)).toThrow(/can't be built on floodplain/);
    s = place(s, 'orchard', 7, 4);
    const harmony = s.harmony;
    const foods: number[] = [];
    for (let i = 0; i < 7; i++) {
      s = endSeason(s);
      foods.push(food(s, 7, 4));
      if (i === 1) {
        expect(tileTypeAt(s, 7, 4)).toBe('meadow');
        expect(s.harmony).toBe(harmony + 1);
      }
    }
    expect(foods).toEqual([0, 0, 4, 0, 1, 2, 4]);
  });

  it('fish ponds make 2 / 1 / 2 / 1', () => {
    let s = scenario(RIVER, { citizens: 1 });
    s = place(s, 'fishPond', 3, 1);
    const foods: number[] = [];
    for (let i = 0; i < 4; i++) {
      s = endSeason(s);
      foods.push(food(s, 3, 1));
    }
    expect(foods).toEqual([2, 1, 2, 1]);
  });

  it('Harmony multiplies food per building, rounding down (x1.2 at 40)', () => {
    // All this woodland also forms a Wildway (+10).
    const woods = [
      'W W W W W ~ . . . W',
      ' W W W W f ~ W W W W',
      'W W W C f ~ W W W W',
      ' W W W W f ~ W W W W',
    ];
    let s = scenario(woods, { season: 'autumn' });
    expect(s.harmony).toBeGreaterThanOrEqual(40);
    expect(s.harmony).toBeLessThan(70);
    s = place(s, 'floodplainFarm', 4, 1);
    s = endSeason(s);
    expect(food(s, 4, 1)).toBe(6); // 5 x 1.2
    expect(s.lastReport!.harmony.multiplier).toBe(1.2);
  });

  it('food beyond storage rots into biomass, which never becomes clutter', () => {
    let s = scenario(RIVER, { stores: { food: 50 } });
    s = endSeason(s);
    // 50 - 6 eaten = 44, storage 40: 4 rot. Scraps come only from the 6 citizens.
    expect(s.stores.food).toBe(40);
    expect(s.lastReport!.food.rotted).toBe(4);
    expect(s.stores.biomass).toBe(4);
    expect(s.stores.scraps).toBe(2);
  });

  it("with rotsInto set to scraps, rot follows the design's original rule", () => {
    const original = loadContent({
      ...willowReach,
      rules: { ...willowReach.rules, rotsInto: 'scraps' },
    });
    const s = scenario(RIVER, { stores: { food: 50 } });
    const result = applyCommand(original, s, { type: 'endSeason' });
    if (!result.ok) throw new Error(result.error);
    expect(result.state.stores.scraps).toBe(2 + 4);
    expect(result.state.stores.biomass).toBe(0);
  });

  it('a workshop set to recycle turns 2 energy and 2 clutter into 1 material', () => {
    let s = scenario(RIVER, { season: 'summer', stores: { clutter: 5, salvage: 10 } });
    s = place(s, 'workshop', 7, 3);
    s = act(s, { type: 'setRecipe', uid: uidAt(s, 7, 3), recipe: 'clutter' });
    s = endSeason(s);
    expect(s.lastReport!.runs[uidAt(s, 7, 3)]?.runs).toBe(2);
    expect(s.lastReport!.clutter.recycled).toBe(4);
    expect(s.lastReport!.yields[uidAt(s, 7, 3)]?.materials).toBe(2);
    expect(s.stores.salvage).toBe(10);
  });
});
