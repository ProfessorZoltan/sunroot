/**
 * Content schema. Every building, event, card and number lives in a JSON data
 * file validated here at load, so balance changes never touch code. Behaviour
 * that a number cannot express is a named module (for example `weir` or
 * `storage`) whose parameters still live in the data.
 */
import { z } from 'zod';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const SLOTS = ['day', 'night'] as const;
export type Slot = (typeof SLOTS)[number];

export const TILE_TYPES = [
  'river',
  'reservoir',
  'floodplain',
  'hill',
  'ruin',
  'barren',
  'scrub',
  'meadow',
  'woodland',
] as const;
export const TileTypeSchema = z.enum(TILE_TYPES);
export type TileType = z.infer<typeof TileTypeSchema>;

export const RESOURCES = [
  'materials',
  'food',
  'biomass',
  'salvage',
  'compost',
  'knowledge',
  'scraps',
  'clutter',
] as const;
export const ResourceSchema = z.enum(RESOURCES);
export type Resource = z.infer<typeof ResourceSchema>;

const int = z.number().int();
const nonNeg = int.min(0);
/** One value per season: spring, summer, autumn, winter. */
const PerSeason = z.tuple([nonNeg, nonNeg, nonNeg, nonNeg]);
const PerSeasonFlags = z.tuple([z.boolean(), z.boolean(), z.boolean(), z.boolean()]);
const zero4: [number, number, number, number] = [0, 0, 0, 0];
const SlotSeason = z.object({
  day: PerSeason.default(zero4),
  night: PerSeason.default(zero4),
});
export type SlotSeasonValues = z.infer<typeof SlotSeason>;
const Ratio = z.object({ numerator: int.min(1), denominator: int.min(1) });

export const BUILDING_KINDS = [
  'food',
  'industry',
  'energy',
  'storage',
  'home',
  'civic',
  'nature',
  'water',
] as const;

const RecipeSchema = z.object({
  id: z.string(),
  inputs: z.partialRecord(ResourceSchema, nonNeg).default({}),
  outputs: z.partialRecord(ResourceSchema, nonNeg).default({}),
  /** Heat delivered free to a neighbouring heat well per run (kiln). */
  heatToNeighborStorage: nonNeg.default(0),
});

export const BuildingSchema = z
  .object({
    id: z.string().regex(/^[a-z][A-Za-z]*$/),
    name: z.string(),
    cost: nonNeg,
    workers: nonNeg,
    kind: z.enum(BUILDING_KINDS),
    /** Unlocked at the start of every run (the design's ★ buildings). */
    starter: z.boolean().default(false),
    /** Can appear as a blueprint in the draft. */
    draftable: z.boolean().default(true),
    /** First era in which the blueprint can be drafted. */
    minEra: int.min(1).default(1),
    floodTolerant: z.boolean().default(false),
    /** Tall buildings shade neighbouring solar canopies. */
    tall: z.boolean().default(false),
    placement: z.object({
      tiles: z.array(TileTypeSchema).min(1),
      /** Must touch at least one tile of these types (or a building from adjacentToBuildings). */
      adjacentTo: z.array(TileTypeSchema).optional(),
      /** Buildings that also satisfy adjacentTo (a Fish Pond counts as water for a Heat Pump). */
      adjacentToBuildings: z.array(z.string()).optional(),
    }),
    housing: nonNeg.default(0),
    foodStorage: nonNeg.default(0),
    /** Flat materials per season (the Founders' Camp forages). */
    forage: nonNeg.default(0),
    yields: z.partialRecord(ResourceSchema, PerSeason).default({}),
    /** Flat food change on a given tile type (a farm on meadow makes 1 less). */
    tileFoodModifier: z.partialRecord(TileTypeSchema, int).default({}),
    /** Seasons after placement before yields start. */
    maturesAfterSeasons: nonNeg.default(0),
    /** Tile type the building's tile improves to when it matures (never downgrades). */
    matureTileBecomes: TileTypeSchema.optional(),
    /** Yields only when every demand of the building was met this season. */
    requiresPower: z.boolean().default(false),
    /** Gains silt from the spring flood and suffers far from water in low river. */
    farmland: z.boolean().default(false),
    /** Counts as a pond for the low-river rule. */
    waterBody: z.boolean().default(false),
    generation: SlotSeason.optional(),
    /** Free heat made in each slot (Solar Thermal Collector); it can only pay heat or charge heat storage. */
    heatGeneration: SlotSeason.optional(),
    /** Pays heat demand at `heatPerEnergy` heat per energy, up to `maxHeatPerSlot` in each slot. */
    heatPump: z.object({ heatPerEnergy: int.min(2), maxHeatPerSlot: int.min(1) }).optional(),
    demand: z
      .object({
        energy: SlotSeason.default({ day: zero4, night: zero4 }),
        heat: SlotSeason.default({ day: zero4, night: zero4 }),
      })
      .optional(),
    recipes: z
      .object({
        maxRuns: int.min(1),
        energyPerRun: int.min(1),
        defaultRecipe: z.string(),
        options: z.array(RecipeSchema).min(1),
      })
      .optional(),
    composter: z
      .object({
        inputs: z.array(ResourceSchema).min(1),
        maxInput: int.min(1),
        output: ResourceSchema,
        outputPerFullRun: int.min(1),
      })
      .optional(),
    digester: z
      .object({
        inputs: z.array(ResourceSchema).min(1),
        inputPerRun: int.min(1),
        maxRuns: int.min(1),
        energyPerRun: int.min(1),
        compostPerRun: nonNeg,
        defaultSlot: z.enum(SLOTS),
      })
      .optional(),
    neighborFoodBonus: z
      .object({
        amount: int.min(1),
        /** Building ids that benefit; omitted means every food-kind building. */
        targets: z.array(z.string()).optional(),
        maxTargets: int.min(1).optional(),
        seasons: PerSeasonFlags.default([true, true, true, true]),
        /** Resource spent per bonus granted ("while compost lasts"). */
        costs: z.object({ resource: ResourceSchema, amount: int.min(1) }).optional(),
        /** The bonus stops when the building touches any of these. */
        disabledNextTo: z.array(z.string()).default([]),
      })
      .optional(),
    wellbeing: z
      .object({
        whenPowered: int.default(0),
        nextToTiles: z.object({ tiles: z.array(TileTypeSchema), amount: int }).optional(),
      })
      .optional(),
    harmony: int.default(0),
    /** On placement the tile improves to this type (never downgrades). */
    setsTile: TileTypeSchema.optional(),
    /** Each season, improve one neighbouring tile this many steps. */
    improvesNeighborSteps: nonNeg.default(0),
    /** Draws its salvage yield from the ruin it stands on. */
    drawsFromRuin: z.boolean().default(false),
    shading: z.object({ penaltyPerSlot: int.min(1) }).optional(),
    weirBonus: z.object({ perSlot: int.min(1) }).optional(),
    spacing: z.object({ radius: int.min(1), penaltyPerSlot: int.min(1) }).optional(),
    harmonyPenalty: z
      .object({ amount: int.min(1), cancelledByNeighbor: z.array(z.string()) })
      .optional(),
    weir: z
      .object({
        reservoirTiles: int.min(0),
        floodAreaFactor: z.number().min(0).max(1),
        downstreamFoodPenalty: z.object({ targets: z.array(z.string()), amount: int.min(1) }),
      })
      .optional(),
    levee: z.object({ radius: int.min(1) }).optional(),
    storage: z
      .object({
        holds: z.enum(['energy', 'heat']),
        capacity: int.min(1),
        /** Energy returned per energy stored. Heat wells store 1 energy as 1 heat. */
        returns: Ratio.default({ numerator: 1, denominator: 1 }),
        /** Which slots it can charge from. */
        chargesFrom: z.array(z.enum(SLOTS)).min(1),
        /** Lost at the end of each season. */
        decayPerSeason: nonNeg.default(0),
        /** Keeps its charge between seasons; otherwise empties at season end. */
        carriesOver: z.boolean(),
      })
      .optional(),
  })
  .strict();
export type BuildingDef = z.infer<typeof BuildingSchema>;

const EventBase = z.object({ name: z.string(), description: z.string() });
export const EventsSchema = z
  .object({
    flood: EventBase.extend({
      siltBonus: z.number().min(0),
      siltSeasons: z.array(z.enum(SEASONS)),
      repairCost: nonNeg,
    }),
    lowRiver: EventBase.extend({
      farFromWaterDistance: int.min(0),
      farYieldFactor: z.number().min(0).max(1),
    }),
    storm: EventBase.extend({ disableCount: nonNeg }),
    freeze: EventBase,
  })
  .strict();
export type EventId = keyof z.infer<typeof EventsSchema>;

export const RulesSchema = z
  .object({
    yearsPerRun: int.min(1),
    yearsPerEra: int.min(1),
    eras: z.array(z.string()).min(1),
    start: z.object({
      materials: nonNeg,
      food: nonNeg,
      citizens: nonNeg,
      wellbeing: nonNeg,
    }),
    foodPerCitizen: nonNeg,
    citizensPerScrap: int.min(1),
    landHealth: z.array(TileTypeSchema).min(2),
    harmony: z.object({
      perTile: z.partialRecord(TileTypeSchema, int),
      perClutter: int,
      tiers: z.array(z.object({ min: int, multiplier: z.number().min(0) })).min(1),
      multiplies: z.array(ResourceSchema),
    }),
    wellbeing: z.object({
      min: int,
      max: int,
      allNeedsMet: int,
      perUnfedCitizen: int,
      perUnpoweredHome: int,
      clutterStep: int.min(1),
      perClutterStep: int,
    }),
    population: z.object({
      growAt: int,
      boomAt: int,
      growth: nonNeg,
      boomGrowth: nonNeg,
      minSpareFood: int,
      leaveBelow: int,
      leaving: nonNeg,
    }),
    compostPerTileStep: int.min(1),
    knowledge: z.object({ reroll: nonNeg, extraCard: nonNeg, hint: nonNeg }),
    draftCards: int.min(1),
    mixedGrid: z.object({
      minSourceTypes: int.min(1),
      minShare: z.number().min(0).max(1),
      /** Sources that don't count towards the mix (the Founders' Camp). */
      excludeSources: z.array(z.string()).default([]),
    }),
  })
  .strict();
export type Rules = z.infer<typeof RulesSchema>;

export const MapGenSchema = z
  .object({
    width: int.min(6),
    height: int.min(4),
    riverColumns: z.tuple([nonNeg, nonNeg]),
    bluffs: nonNeg,
    bluffLength: int.min(1),
    farFloodplainChance: z.number().min(0).max(1),
    hillColumns: nonNeg,
    hillChance: z.number().min(0).max(1),
    ruins: nonNeg,
    ruinSalvage: int.min(1),
    barrenChance: z.number().min(0).max(1),
    woodlands: nonNeg,
    startingHarmony: nonNeg,
    campRiverDistance: z.tuple([int.min(1), int.min(1)]),
  })
  .strict();
export type MapGen = z.infer<typeof MapGenSchema>;

export const ContentSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    rules: RulesSchema,
    map: MapGenSchema,
    /** The event at the end of each season, spring to winter. */
    calendar: z.tuple([
      z.enum(['flood', 'lowRiver', 'storm', 'freeze']),
      z.enum(['flood', 'lowRiver', 'storm', 'freeze']),
      z.enum(['flood', 'lowRiver', 'storm', 'freeze']),
      z.enum(['flood', 'lowRiver', 'storm', 'freeze']),
    ]),
    events: EventsSchema,
    campBuilding: z.string(),
    buildings: z.array(BuildingSchema).min(1),
    /** Fixed draft offers for the guided first year, spring to winter. */
    guidedYear: z.tuple([
      z.array(z.string()),
      z.array(z.string()),
      z.array(z.string()),
      z.array(z.string()),
    ]),
  })
  .strict();
export type ContentData = z.infer<typeof ContentSchema>;
