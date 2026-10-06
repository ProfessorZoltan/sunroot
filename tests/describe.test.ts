/**
 * Building descriptions (ui/describe.ts), asked for in playtesting: every rule a building
 * carries is said in its tooltip. A guard makes a new field choose: described, or not shown.
 */
import { describe, expect, it } from 'vitest';
import { BIOMES, biomeContent } from '../src/content';
import type { Content } from '../src/sim';
import { describeBuilding } from '../src/ui/describe';

/** A land with water and walks to water on, as later runs have them. */
const full = (id: keyof typeof BIOMES): Content => {
  const c = biomeContent(id);
  return {
    ...c,
    rules: {
      ...c.rules,
      water: { ...c.rules.water, enabled: true },
      commute: { ...c.rules.commute, enabled: true },
    },
  };
};
const say = (id: keyof typeof BIOMES, building: string) => {
  const c = full(id);
  return describeBuilding(c, c.byId[building]!).join('\n');
};

describe('what a building does, in its tooltip', () => {
  it('the smokehouse: its store, and no food rots while it runs', () => {
    const text = say('windsweptCoast', 'smokehouse');
    expect(text).toMatch(/Adds 10 to the food the settlement can store/);
    expect(text).toMatch(/no food rots/);
    expect(text).toMatch(/Heat by night 1 \/ 1 \/ 1 \/ 1/);
  });

  it('the cistern: how much it holds, when it fills and who it serves', () => {
    const text = say('willowReach', 'cistern');
    expect(text).toMatch(/Holds up to 6 water/);
    expect(text).toMatch(/spring, autumn and winter/);
    expect(text).toMatch(/run short/);
    expect(text).toMatch(/Drinking water for homes/);
  });

  it('the well: drinking water for homes only', () => {
    const text = say('willowReach', 'well');
    expect(text).toMatch(/Drinking water for homes/);
    expect(text).toMatch(/Only for homes: it waters no farms or gardens/);
  });

  it('what it uses, and the land’s own words (tiles, the flood)', () => {
    expect(say('willowReach', 'workshop')).toMatch(/Uses energy by day: 1 \/ 1 \/ 1 \/ 1/);
    expect(say('sunDesert', 'saltWorks')).toMatch(/Built on salt flat/);
    expect(say('windsweptCoast', 'seaWall')).toMatch(/Keeps the king tide off/);
  });
});

/** Fields a tooltip says something about. */
const DESCRIBED = new Set([
  'placement',
  'yields',
  'forage',
  'tileFoodModifier',
  'nextToTilesFood',
  'farmland',
  'matureTileBecomes',
  'maturesAfterSeasons',
  'setsTile',
  'drawsFromRuin',
  'strandline',
  'chars',
  'generation',
  'weirBonus',
  'generationOnTiles',
  'generationAtHeight',
  'idleAtHeight',
  'shading',
  'spacing',
  'fogged',
  'heatDimmed',
  'heatGeneration',
  'heatFuel',
  'heatPump',
  'housing',
  'foodStorage',
  'stopsRot',
  'wellbeing',
  'recipes',
  'composter',
  'digester',
  'neighborFoodBonus',
  'cider',
  'demand',
  'heatFromNeighbors',
  'heatAtHeight',
  'coolingFreeNextTo',
  'requiresPower',
  'cooling',
  'chiller',
  'ice',
  'dredges',
  'eatsGrey',
  'fishesLake',
  'layers',
  'covers',
  'burns',
  'fertilityFood',
  'midden',
  'charcoal',
  'shades',
  'water',
  'pump',
  'waterBody',
  'drinkingWater',
  'requiresWalks',
  'storage',
  'harmony',
  'harmonyPenalty',
  'harmonyAsTile',
  'spawns',
  'revertsAfterSeasons',
  'improvesNeighborSteps',
  'sheltersNeighbors',
  'shelters',
  'stormProof',
  'tall',
  'weir',
  'levee',
  'floodTolerant',
  'saltProof',
  'restsIn',
  'workers',
  'edge',
  'wonder',
  'cost',
]);
/** Fields it leaves out: names and bookkeeping, or shown elsewhere (the palette, the Almanac). */
const NOT_SHOWN = new Set([
  'id',
  'name',
  'kind',
  'starter',
  'draftable',
  'placeable',
  'minEra',
  'sourceType',
  'requiresWater',
  'requiresHeatLayer',
  'ignoresLowRiver',
]);

it('every field a building carries is described, or knowingly not shown', () => {
  const unknown = new Set<string>();
  for (const raw of Object.values(BIOMES))
    for (const b of (raw as { buildings: Record<string, unknown>[] }).buildings)
      for (const k of Object.keys(b)) if (!DESCRIBED.has(k) && !NOT_SHOWN.has(k)) unknown.add(k);
  expect([...unknown]).toEqual([]);
});
