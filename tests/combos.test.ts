/**
 * Milestone 6: "every combo in the design doc triggers in a unit test".
 * Each combo from docs/DESIGN.md "Choices and combos" is built on a small
 * hand-drawn map and must show up in the season report (and be discovered);
 * then its effect is checked. Tunings and charters follow.
 */
import { describe, expect, it } from 'vitest';
import { axialToOffset, harmonyLines, hexDistance, hexKey, hexNeighbors } from '../src/sim';
import type { RunState } from '../src/sim';
import { act, at, content, endSeason, place, rejects, scenario, uidAt } from './helpers';

// Dry land around a river in column 4, hills at the edges, two floodplain tiles.
const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , f ~ f , , , ^',
  '^ , , , ~ , , m , ^',
];

const hits = (s: RunState, combo: string) => s.lastReport!.combos.filter((h) => h.combo === combo);
const found = (s: RunState, combo: string) => {
  expect(hits(s, combo).length, `${combo} at work`).toBeGreaterThan(0);
  expect(s.lastReport!.discoveries, `${combo} discovered`).toContain(combo);
  expect(s.discoveries).toContain(combo);
};
const math = (s: RunState, col: number, row: number) =>
  (s.lastReport!.math[uidAt(s, col, row)] ?? []).join(' | ');
/** The six neighbours of a tile, as (col, row). */
const ring = (col: number, row: number) =>
  hexNeighbors(at(col, row)).map((h) => {
    const { col: c, row: r } = axialToOffset(h);
    return [c, r] as const;
  });

describe('combo data', () => {
  it('has every combo from the design doc, in its layer', () => {
    const byLayer = (layer: string) =>
      content.combos.filter((c) => c.layer === layer).map((c) => c.name);
    expect(byLayer('adjacency')).toEqual([
      'Busy Bees',
      'Quiet Spire',
      'Kiln Warmth',
      'Green Doorstep',
    ]);
    expect(byLayer('chain')).toEqual([
      'Kitchen Loop',
      'Gas Loop',
      'River Loop',
      // Willow Reach v2 (EXPANSION.md, E3), with water; the Heat Cascade is DECISIONS.md Q18 (b).
      'Bath Loop',
      'Rice-Fish Loop',
      'Mushroom Loop',
      'Heat Cascade',
    ]);
    expect(byLayer('formation')).toEqual([
      'Village Green',
      'Sun Terrace',
      'Mill Race',
      'Wildway',
      'Keyhole Garden',
      'Water Ladder',
      'Windbreak',
      'Hearth Square',
    ]);
    expect(byLayer('evolution')).toEqual([
      'Winter Garden',
      'Agrivoltaic Field',
      'Rewilded Ruin',
      'Treehouse Commons',
      // Willow Reach v2 (EXPANSION.md, E3), with water.
      'Food Forest',
      'Aquaponics Hall',
      'Canal-top Solar',
      'Beaver Dam',
      'Singing Spire',
      'Old World Archive',
      'Coppice Wood',
    ]);
    expect(content.tunings.filter((t) => !t.refinement).map((t) => t.name)).toEqual([
      'Deep Roots',
      'Mirror Film',
      'Night Shift',
      'Silt Traps',
      'Hive Mind',
      // Added to drafts by Root City districts (Milestone 8).
      'Spillway',
      'Kiln Loop',
    ]);
    expect(content.charters.map((c) => c.name)).toEqual([
      'Repair Culture',
      'River Keepers',
      'Night Market',
      'Seed Savers',
      'Slow Power',
      'Rewilders', // added to drafts by the Mended Commons (Milestone 8)
    ]);
  });
});

describe('1. adjacency', () => {
  it('Busy Bees: an apiary next to a farm, spring to autumn', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'apiary', 6, 3);
    s = endSeason(s);
    found(s, 'busyBees');
    expect(hits(s, 'busyBees')[0]!.members).toEqual([uidAt(s, 6, 3), uidAt(s, 5, 3)]);
    expect(math(s, 5, 3)).toMatch(/\+1 food from a neighbouring Apiary/);

    let w = scenario(LAND, { season: 'winter' });
    w = place(w, 'floodplainFarm', 5, 3);
    w = place(w, 'apiary', 6, 3);
    expect(hits(endSeason(w), 'busyBees')).toEqual([]);
  });

  it('Quiet Spire: a pollinator meadow next to a wind spire cancels its Harmony penalty', () => {
    let s = scenario(LAND);
    s = place(s, 'windSpire', 9, 3);
    expect(harmonyLines(content, s)).toContainEqual({ label: '1 Wind Spire', amount: -2 });
    s = place(s, 'pollinatorMeadow', 8, 3);
    expect(harmonyLines(content, s).map((l) => l.label)).not.toContain('1 Wind Spire');
    s = endSeason(s);
    found(s, 'quietSpire');
  });

  it('Kiln Warmth: a kiln next to a heat well', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'kiln', 6, 3);
    s = place(s, 'heatWell', 7, 3);
    s = endSeason(s);
    found(s, 'kilnWarmth');
  });

  it('Green Doorstep: a cottage next to meadow or woodland', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'cottage', 8, 4);
    s = endSeason(s);
    found(s, 'greenDoorstep');
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'greenery',
      reason: 'Cottage next to meadow or woodland',
      amount: 1,
    });
  });
});

describe('2. chains', () => {
  it('Kitchen Loop: closes when it runs, then each member makes +1 while it stands', () => {
    let s = scenario(LAND, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'composter', 6, 3);
    s = endSeason(s);
    found(s, 'kitchenLoop');
    expect(s.loops).toEqual([
      {
        combo: 'kitchenLoop',
        anchor: uidAt(s, 6, 3),
        members: [uidAt(s, 6, 3), uidAt(s, 5, 3)],
        turn: 1,
      },
    ]);
    // The bonus starts the season after it closes.
    expect(math(s, 5, 3)).not.toMatch(/Kitchen Loop/);
    const summerCompost = s.lastReport!.yields[uidAt(s, 6, 3)]!.compost!;
    s = endSeason(s);
    expect(math(s, 5, 3)).toMatch(/\+1 food from the Kitchen Loop/);
    expect(math(s, 6, 3)).toMatch(/\+1 compost from the Kitchen Loop/);
    expect(s.lastReport!.yields[uidAt(s, 6, 3)]!.compost).toBeGreaterThan(0);
    expect(summerCompost).toBeGreaterThan(0);
    // Discovered once per run.
    expect(s.lastReport!.discoveries).not.toContain('kitchenLoop');
    expect(hits(s, 'kitchenLoop')).toHaveLength(1);
  });

  it('Gas Loop: a digester feeding the night among working farms', () => {
    const build = () => {
      let s = scenario(LAND, { season: 'summer', stores: { biomass: 4 } });
      s = place(s, 'floodplainFarm', 5, 3);
      return place(s, 'biogasDigester', 6, 3);
    };
    const s = endSeason(build());
    found(s, 'gasLoop');
    // A digester feeding the day doesn't close it.
    let day = build();
    day = act(day, { type: 'setDigesterSlot', uid: uidAt(day, 6, 3), slot: 'day' });
    expect(hits(endSeason(day), 'gasLoop')).toEqual([]);
  });

  it('River Loop: fish pond, greenhouse and digester in a chain of neighbours', () => {
    let s = scenario(LAND, { season: 'summer', stores: { biomass: 4 } });
    s = place(s, 'fishPond', 5, 1);
    s = place(s, 'greenhouse', 6, 1);
    s = place(s, 'biogasDigester', 7, 1);
    s = endSeason(s);
    found(s, 'riverLoop');
    expect(hits(s, 'riverLoop')[0]!.members).toEqual([
      uidAt(s, 5, 1),
      uidAt(s, 6, 1),
      uidAt(s, 7, 1),
    ]);
    s = endSeason(s);
    expect(math(s, 5, 1)).toMatch(/\+1 food from the River Loop/);
    expect(math(s, 6, 1)).toMatch(/\+1 food from the River Loop/);
  });
});

describe('3. formations', () => {
  it('Village Green: a Commons Plaza ringed by 6 buildings of 3 kinds, +2 wellbeing', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'commonsPlaza', 7, 2);
    const kinds = ['cottage', 'cottage', 'solarCanopy', 'solarCanopy', 'pollinatorMeadow'];
    const around = ring(7, 2);
    kinds.forEach((id, i) => (s = place(s, id, ...around[i]!)));
    expect(endSeason(s).lastReport!.combos.map((h) => h.combo)).not.toContain('villageGreen');
    s = place(s, 'pollinatorMeadow', ...around[5]!);
    s = endSeason(s);
    found(s, 'villageGreen');
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'formation',
      reason: 'Village Green',
      amount: 2,
    });
  });

  it('Sun Terrace: 3 canopies in a row on hills, +1 day energy each, every season', () => {
    const TERRACE = ['^ ^ ^ W ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'];
    let s = scenario(TERRACE);
    s = place(s, 'solarCanopy', 1, 0);
    s = place(s, 'solarCanopy', 2, 0); // next to the woodland: shaded
    const two = endSeason(s).lastReport!;
    expect(two.combos.map((h) => h.combo)).not.toContain('sunTerrace');
    expect(two.energy.day.bySource.solarCanopy).toBe(3 + 2);
    s = place(s, 'solarCanopy', 0, 0);
    s = endSeason(s);
    found(s, 'sunTerrace');
    // Spring: 3 each, +1 in the terrace; the woodland still shades its neighbour.
    expect(s.lastReport!.energy.day.bySource.solarCanopy).toBe(4 + 4 + 3);
    s = endSeason(endSeason(s)); // winter: 1 each, +1
    expect(s.lastReport!.energy.day.bySource.solarCanopy).toBe(2 + 2 + 1);
  });

  it('Mill Race: weir, river wheel and workshop in a row; the workshop runs without energy', () => {
    let s = scenario(LAND, { season: 'summer', stores: { salvage: 4 } });
    s = place(s, 'weir', 4, 2);
    s = place(s, 'riverWheel', 5, 2);
    s = place(s, 'workshop', 6, 2);
    s = endSeason(s);
    found(s, 'millRace');
    const runs = s.lastReport!.runs[uidAt(s, 6, 2)]!;
    expect(runs.runs).toBe(2);
    expect(runs.energy).toEqual({ day: 0, night: 0 });
  });

  it('Wildway: meadow and woodland from the river to the valley edge, +10 Harmony', () => {
    const WILD = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', 'm W m m ~ , C , , ^'];
    let s = scenario(WILD);
    expect(harmonyLines(content, s)).toContainEqual({ label: 'Wildway', amount: 10 });
    s = endSeason(s);
    found(s, 'wildway');
    expect(hits(s, 'wildway')[0]!.tiles).toEqual([3, 2, 1, 0].map((c) => hexKey(at(c, 2))));
    const broken = scenario(['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , , , ^ ^', 'm . m m ~ , C , , ^']);
    expect(harmonyLines(content, broken).map((l) => l.label)).not.toContain('Wildway');
  });
});

describe('4. evolutions', () => {
  it('Winter Garden: a greenhouse next to a heat well needs no winter heat', () => {
    let s = scenario(LAND, { season: 'autumn' });
    s = place(s, 'greenhouse', 6, 2);
    s = place(s, 'heatWell', 7, 2);
    s = endSeason(s);
    found(s, 'winterGarden');
    expect(s.buildings[uidAt(s, 6, 2)]!.type).toBe('winterGarden');
    expect(s.lastReport!.evolved).toEqual([
      { uid: uidAt(s, 6, 2), from: 'greenhouse', into: 'winterGarden' },
    ]);
    s = endSeason(s); // winter
    expect(s.lastReport!.energy.day.demandBy.winterGarden).toBe(2); // energy only, no heat
    expect(s.lastReport!.yields[uidAt(s, 6, 2)]!.food).toBe(4); // 4 in winter, not 3
  });

  it('Agrivoltaic Field: a solar canopy built over a farm merges with it', () => {
    let s = scenario(LAND, { season: 'summer' });
    s = place(s, 'floodplainFarm', 5, 3);
    const farm = uidAt(s, 5, 3);
    const materials = s.stores.materials;
    s = place(s, 'solarCanopy', 5, 3);
    expect(s.buildings[farm]!.type).toBe('agrivoltaicField');
    expect(s.stores.materials).toBe(materials - 4);
    expect(content.byId.agrivoltaicField!.workers).toBe(1);
    s = endSeason(s);
    found(s, 'agrivoltaicField');
    expect(s.lastReport!.yields[farm]!.food).toBe(3); // 4 in summer, -1
    expect(s.lastReport!.energy.day.bySource.agrivoltaicField).toBe(4); // the canopy's summer energy
    // Only over a farm.
    expect(rejects(s, { type: 'place', building: 'solarCanopy', at: at(2, 2) })).toMatch(
      /already has a building/,
    );
  });

  it("Agrivoltaic Field: the canopy's energy, the farm's food minus 1 with silt after, no low-river loss", () => {
    // Built in spring: the flood silts it; summer's food is (4 - 1) x 1.5, rounded down.
    let s = scenario(LAND);
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'solarCanopy', 5, 3);
    s = endSeason(s);
    expect(s.lastReport!.yields[uidAt(s, 5, 3)]!.food).toBe(1); // spring 2 - 1
    expect(s.lastReport!.energy.day.bySource.agrivoltaicField).toBe(3);
    s = endSeason(s);
    expect(s.lastReport!.yields[uidAt(s, 5, 3)]!.food).toBe(4);
    expect(s.lastReport!.energy.day.bySource.agrivoltaicField).toBe(4);

    // Far from water in a low river: a farm on meadow loses half, the field loses nothing.
    const far = (canopy: boolean) => {
      let x = scenario(LAND, { season: 'summer' });
      x = place(x, 'floodplainFarm', 7, 4); // meadow, 3 tiles from the river
      if (canopy) x = place(x, 'solarCanopy', 7, 4);
      return endSeason(x).lastReport!.yields[uidAt(x, 7, 4)]!.food;
    };
    expect(far(false)).toBe(1); // (4 - 1 on meadow) x 0.5
    expect(far(true)).toBe(2); // 4 - 1 on meadow - 1
  });

  it('Rewilded Ruin: a salvage yard whose ruin runs out, +2 Harmony', () => {
    let s = scenario(['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , R , ^ ^', '^ , C , ~ , , , , ^']);
    s.map.tiles[hexKey(at(6, 1))]!.salvage = 3;
    s = place(s, 'salvageYard', 6, 1);
    s = endSeason(s);
    found(s, 'rewildedRuin');
    expect(s.buildings[uidAt(s, 6, 1)]!.type).toBe('rewildedRuin');
    expect(harmonyLines(content, s)).toContainEqual({ label: '1 Rewilded Ruin', amount: 2 });
  });

  it('Treehouse Commons: a cottage next to 2 woodland tiles, +2 wellbeing', () => {
    const TREES = ['^ ^ ^ , ~ , W W ^ ^', ' ^ ^ , , ~ , , , ^ ^', '^ , C , ~ , , , , ^'];
    let s = scenario(TREES, { season: 'summer' });
    const site = Object.values(s.map.tiles).find(
      (t) => t.type === 'scrub' && hexDistance(t, at(6, 0)) === 1 && hexDistance(t, at(7, 0)) === 1,
    )!;
    const { col, row } = axialToOffset(site);
    s = place(s, 'cottage', col, row);
    s = endSeason(s);
    found(s, 'treehouseCommons');
    s = endSeason(s);
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'greenery',
      reason: 'Treehouse Commons next to meadow or woodland',
      amount: 2,
    });
  });
});

describe('5. tunings', () => {
  const take = (s: RunState, tuning: string) => {
    s.draft = { offer: [tuning], picked: null, extraBought: false };
    const next = act(s, { type: 'pickCard', card: tuning });
    expect(next.tunings).toEqual([tuning]);
    expect(next.unlocked).not.toContain(tuning);
    return next;
  };

  it('join the draft once the blueprints run out, and can be drafted', () => {
    const s = endSeason(scenario(LAND));
    expect(s.draft.offer).toHaveLength(3);
    expect(s.draft.offer.every((id) => content.tuningById[id])).toBe(true);
  });

  it('Deep Roots: orchards produce after 1 season', () => {
    const orchardFood = (tuned: boolean) => {
      let s = scenario(LAND, { season: 'summer' });
      if (tuned) s = take(s, 'deepRoots');
      s = place(s, 'orchard', 6, 2);
      s = endSeason(s);
      return endSeason(s).lastReport!.yields[uidAt(s, 6, 2)]?.food ?? 0;
    };
    expect(orchardFood(false)).toBe(0);
    expect(orchardFood(true)).toBe(4);
  });

  it('Mirror Film: solar canopies +1 in winter', () => {
    let s = scenario(LAND, { season: 'winter' });
    s = take(s, 'mirrorFilm');
    s = place(s, 'solarCanopy', 6, 2);
    expect(endSeason(s).lastReport!.energy.day.bySource.solarCanopy).toBe(2);
  });

  it('Night Shift: workshops get a 3rd run, on night energy only', () => {
    const runs = (tuned: boolean) => {
      let s = scenario(LAND, { season: 'autumn', stores: { salvage: 6 } });
      if (tuned) s = take(s, 'nightShift');
      s = place(s, 'solarCanopy', 7, 2);
      s = place(s, 'riverWheel', 5, 2);
      s = place(s, 'workshop', 6, 2);
      return endSeason(s).lastReport!.runs[uidAt(s, 6, 2)]!;
    };
    expect(runs(false)).toMatchObject({ runs: 2, energy: { day: 4, night: 0 } });
    expect(runs(true)).toMatchObject({ runs: 3, energy: { day: 4, night: 2 } });
  });

  it('Silt Traps: levees let half the silt boost through', () => {
    const summerFood = (tuned: boolean) => {
      let s = scenario(LAND);
      if (tuned) s = take(s, 'siltTraps');
      s = place(s, 'levee', 5, 2);
      s = place(s, 'floodplainFarm', 5, 3);
      s = endSeason(s);
      return endSeason(s).lastReport!.yields[uidAt(s, 5, 3)]!.food;
    };
    expect(summerFood(false)).toBe(4);
    expect(summerFood(true)).toBe(5); // 4 x 1.25
  });

  it('Hive Mind: apiaries reach 2 tiles', () => {
    const bonus = (tuned: boolean) => {
      let s = scenario(LAND, { season: 'summer' });
      if (tuned) s = take(s, 'hiveMind');
      s = place(s, 'floodplainFarm', 5, 3);
      s = place(s, 'apiary', 7, 3);
      return endSeason(s).lastReport!.bonuses.apiary;
    };
    expect(bonus(false)).toBe(0);
    expect(bonus(true)).toBe(1);
  });
});

describe('charters', () => {
  it('are offered at the start of eras 2, 3 and 4, and one must be chosen', () => {
    let s = scenario(LAND, { year: 3, season: 'winter' });
    s = act(s, { type: 'endSeason' });
    expect(s.era).toBe(2);
    expect(s.charterOffer).toHaveLength(3);
    s = { ...s, draft: { ...s.draft, offer: [] } };
    expect(rejects(s, { type: 'endSeason' })).toMatch(/choose a charter/);
    const missing = content.charters.find((c) => !s.charterOffer.includes(c.id))!.id;
    expect(rejects(s, { type: 'pickCharter', charter: missing })).toMatch(/not on offer/);
    const chosen = s.charterOffer[0]!;
    s = act(s, { type: 'pickCharter', charter: chosen });
    expect(s.charters).toEqual([chosen]);
    expect(s.charterOffer).toEqual([]);
    // Nothing more until the next era.
    s = act(s, { type: 'endSeason' });
    expect(s.charterOffer).toEqual([]);
  });

  const withCharter = (charter: string, s: RunState) => ({ ...s, charters: [charter] });

  it('Repair Culture: salvage x2 from the same ruin, and 2 clutter makes 2 materials', () => {
    const map = ['^ ^ ^ , ~ , , , ^ ^', ' ^ ^ , , ~ , R , ^ ^', '^ , C , ~ , , , , ^'];
    let s = withCharter('repairCulture', scenario(map, { season: 'summer' }));
    s = place(s, 'salvageYard', 6, 1);
    s = endSeason(s);
    expect(s.lastReport!.yields[uidAt(s, 6, 1)]!.salvage).toBe(6);
    expect(s.map.tiles[hexKey(at(6, 1))]!.salvage).toBe(21); // 24 lasts 8 seasons: 48 in all

    const recycled = (charter: boolean) => {
      let x = scenario(map, { season: 'summer', stores: { clutter: 4 } });
      if (charter) x = withCharter('repairCulture', x);
      x = place(x, 'workshop', 7, 2);
      x = place(x, 'solarCanopy', 8, 2); // day energy for 2 runs
      x = act(x, { type: 'setRecipe', uid: uidAt(x, 7, 2), recipe: 'clutter' });
      return endSeason(x).lastReport!.yields[uidAt(x, 7, 2)]!.materials;
    };
    expect(recycled(false)).toBe(2); // 2 runs x 1
    expect(recycled(true)).toBe(4); // 2 runs x 2
  });

  it('River Keepers: floods do no damage and fish ponds make +1', () => {
    let s = withCharter('riverKeepers', scenario(LAND));
    s = place(s, 'cottage', 3, 3); // on the floodplain
    s = place(s, 'fishPond', 5, 1);
    s = endSeason(s);
    expect(s.lastReport!.damaged).toEqual([]);
    expect(s.lastReport!.yields[uidAt(s, 5, 1)]!.food).toBe(3);
  });

  it('Night Market: +2 wellbeing when the night slot is fully powered', () => {
    const s = endSeason(withCharter('nightMarket', scenario(LAND, { season: 'summer' })));
    expect(s.lastReport!.wellbeing.lines).toContainEqual({
      kind: 'charter',
      reason: 'the night market',
      amount: 2,
    });
  });

  it('Seed Savers: 4 draft cards instead of 3', () => {
    const s = endSeason(withCharter('seedSavers', scenario(LAND)));
    expect(s.draft.offer).toHaveLength(4);
  });

  it('Slow Power: workshops and kilns make 50% more', () => {
    let s = withCharter('slowPower', scenario(LAND, { season: 'autumn', stores: { salvage: 4 } }));
    s = place(s, 'solarCanopy', 7, 2);
    s = place(s, 'solarCanopy', 8, 2); // autumn: 2 each, for the workshop's 1 and 2 runs
    s = place(s, 'workshop', 6, 2);
    s = endSeason(s);
    expect(s.lastReport!.yields[uidAt(s, 6, 2)]!.materials).toBe(9); // 2 runs x 3, x 1.5
  });
});

describe('Almanac hints', () => {
  it('cost 5 knowledge, for formations and evolutions not yet discovered', () => {
    let s = scenario(LAND, { stores: { knowledge: 12 } });
    s = act(s, { type: 'buyHint', combo: 'wildway' });
    expect(s.hints).toEqual(['wildway']);
    expect(s.stores.knowledge).toBe(7);
    expect(rejects(s, { type: 'buyHint', combo: 'wildway' })).toMatch(/already hinted/);
    expect(rejects(s, { type: 'buyHint', combo: 'kitchenLoop' })).toMatch(/free/);
    expect(rejects(s, { type: 'buyHint', combo: 'nothing' })).toMatch(/unknown combo/);
    s = act(s, { type: 'buyHint', combo: 'sunTerrace' });
    expect(rejects(s, { type: 'buyHint', combo: 'millRace' })).toMatch(/needs 5 knowledge/);
  });
});
