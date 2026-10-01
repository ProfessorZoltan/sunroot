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
    /** Can be placed. Evolved buildings (Milestone 6) only come from evolutions. */
    placeable: z.boolean().default(true),
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
    /** Farmland that keeps its yield far from water in low river (the Agrivoltaic Field). */
    ignoresLowRiver: z.boolean().default(false),
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
        /** Extra runs allowed on night energy only (the Night Shift tuning). */
        nightOnlyRuns: nonNeg.default(0),
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
        /** How far the bonus reaches, in tiles (the Hive Mind tuning makes it 2). */
        radius: int.min(1).default(1),
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
    levee: z
      .object({
        radius: int.min(1),
        /** Share of the silt boost protected farms still get (the Silt Traps tuning). */
        siltShare: z.number().min(0).max(1).default(0),
      })
      .optional(),
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

const EventBase = z.object({
  name: z.string(),
  /** One line for the map's forecast pill. */
  summary: z.string(),
  description: z.string(),
});
export const EventsSchema = z
  .object({
    flood: EventBase.extend({
      siltBonus: z.number().min(0),
      siltSeasons: z.array(z.enum(SEASONS)),
      repairCost: nonNeg,
      /** Whether the flood damages buildings that aren't flood-tolerant (River Keepers: no). */
      damages: z.boolean().default(true),
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
    /** What food beyond storage turns into: scraps (can become clutter) or biomass (can't). */
    rotsInto: z.enum(['scraps', 'biomass']),
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
      /** Wellbeing each season the night slot has no shortfall (the Night Market charter). */
      nightPowered: int.default(0),
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
    /** Salvage gained per unit drawn from a ruin (Repair Culture doubles it). */
    ruinSalvageFactor: z.number().min(0).default(1),
    /** Multiplies what flexible consumers (workshops, kilns) make, rounded down (Slow Power). */
    flexibleOutputFactor: z.number().min(0).default(1),
    /** Eras whose first season offers a charter, and how many to choose from. */
    charterEras: z.array(int.min(1)).default([]),
    charterChoices: int.min(1).default(3),
    /**
     * Provisional end-of-run score for the balance simulator. The real formula
     * and the Graft tier bands are an open design question (Milestone 7).
     */
    provisionalScore: z.object({
      perSeasonSurvived: int,
      perCitizen: int,
      perHarmony: int,
      wellbeingStep: int.min(1),
      perWellbeingStep: int,
      completeBonus: int,
    }),
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

/**
 * A data modifier: tunings and charters change numbers in the content for the
 * rest of a run. `path` is a dot path into a building, the rules or an event
 * (array indexes allowed, e.g. `generation.day.3`). `add` and `multiply` apply
 * to every number of an array.
 */
export const ModifierSchema = z
  .object({
    target: z.enum(['building', 'rules', 'event']),
    /** Building or event id (not for rules). */
    id: z.string().optional(),
    path: z.string().min(1),
    set: z.union([z.number(), z.boolean(), z.string()]).optional(),
    add: z.number().optional(),
    multiply: z.number().optional(),
  })
  .strict()
  .refine((m) => [m.set, m.add, m.multiply].filter((x) => x !== undefined).length === 1, {
    message: 'a modifier needs exactly one of set, add or multiply',
  });
export type Modifier = z.infer<typeof ModifierSchema>;

const CardText = { id: z.string().regex(/^[a-z][A-Za-z]*$/), name: z.string(), text: z.string() };

export const TuningSchema = z.object({ ...CardText, modifiers: z.array(ModifierSchema).min(1) });
export type Tuning = z.infer<typeof TuningSchema>;
export const CharterSchema = z.object({ ...CardText, modifiers: z.array(ModifierSchema).min(1) });
export type Charter = z.infer<typeof CharterSchema>;

/** Next to at least `count` buildings of these types, or tiles of these types. */
const NextTo = z
  .object({
    buildings: z.array(z.string()).optional(),
    tiles: z.array(TileTypeSchema).optional(),
    count: int.min(1).default(1),
  })
  .strict();

const ComboBase = {
  id: z.string().regex(/^[a-z][A-Za-z]*$/),
  name: z.string(),
  /** What it is and does, shown once discovered. */
  text: z.string(),
  /** A nudge towards it, shown on the silhouette (free for adjacency and chains). */
  hint: z.string(),
};

export const ComboSchema = z.discriminatedUnion('layer', [
  /** 1. Adjacency: a building next to the right neighbours (the rule itself lives on the buildings). */
  z
    .object({
      ...ComboBase,
      layer: z.literal('adjacency'),
      building: z.string(),
      nextTo: NextTo,
      notNextTo: z.array(z.string()).default([]),
      seasons: PerSeasonFlags.default([true, true, true, true]),
    })
    .strict(),
  /**
   * 2. Chains: a path of adjacent buildings, one from each link, that all
   * worked this season. Once closed, each member gets +bonus to the first
   * resource in `bonusOrder` it makes, every season from the next one on.
   */
  z
    .object({
      ...ComboBase,
      layer: z.literal('chain'),
      links: z
        .array(z.object({ buildings: z.array(z.string()).min(1), slot: z.enum(SLOTS).optional() }))
        .min(2),
      bonus: int.min(1),
      bonusOrder: z.array(ResourceSchema).min(1),
    })
    .strict(),
  /** 3. Formations: hidden shapes. Their effect lasts while the shape stands. */
  z
    .object({
      ...ComboBase,
      layer: z.literal('formation'),
      shape: z.discriminatedUnion('kind', [
        /** A building ringed by `size` buildings of at least `minTypes` types. */
        z.object({
          kind: z.literal('ring'),
          center: z.string(),
          size: int.min(1).max(6),
          minTypes: int.min(1),
        }),
        /** Buildings in a straight line, in this order (either direction), on these tiles. */
        z.object({
          kind: z.literal('line'),
          sequence: z.array(z.string()).min(2),
          tiles: z.array(TileTypeSchema).optional(),
        }),
        /** An unbroken strip of these tiles from the river to a side edge of the valley. */
        z.object({ kind: z.literal('strip'), tiles: z.array(TileTypeSchema).min(1) }),
      ]),
      effect: z
        .object({
          wellbeing: int.default(0),
          harmony: int.default(0),
          /** Extra energy per slot for members of `appliesTo`, in slots where they produce. */
          generation: int.default(0),
          ignoresShade: z.boolean().default(false),
          /** Members of `appliesTo` run without energy. */
          freeRuns: z.boolean().default(false),
          appliesTo: z.string().optional(),
        })
        .strict(),
    })
    .strict(),
  /** 4. Evolutions: a building becomes another because of its neighbours. */
  z
    .object({
      ...ComboBase,
      layer: z.literal('evolution'),
      from: z.string(),
      into: z.string(),
      when: z.discriminatedUnion('kind', [
        z.object({ kind: z.literal('nextTo'), nextTo: NextTo }),
        /** Its ruin has no salvage left. */
        z.object({ kind: z.literal('ruinExhausted') }),
        /** Placing this building on it (a solar canopy on a farm). */
        z.object({ kind: z.literal('placed'), building: z.string() }),
      ]),
    })
    .strict(),
]);
export type Combo = z.infer<typeof ComboSchema>;
export type ComboLayer = Combo['layer'];
export const COMBO_LAYERS = ['adjacency', 'chain', 'formation', 'evolution'] as const;

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
    combos: z.array(ComboSchema).default([]),
    tunings: z.array(TuningSchema).default([]),
    charters: z.array(CharterSchema).default([]),
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
