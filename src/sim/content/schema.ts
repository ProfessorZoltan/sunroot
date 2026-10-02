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

/** Water qualities (EXPANSION.md, Water system): each unit of water carries one. */
export const WATER_QUALITIES = ['clean', 'nutrient', 'grey'] as const;
export const WaterQualitySchema = z.enum(WATER_QUALITIES);
export type WaterQuality = z.infer<typeof WaterQualitySchema>;

/**
 * How a building takes part in the water system (EXPANSION.md). Only read
 * while `rules.water.enabled` is on.
 */
const BuildingWaterSchema = z
  .object({
    /** Units of water needed each season (only while it works and is mature). */
    needs: PerSeason.default(zero4),
    /** Qualities it accepts, most wanted first. */
    accepts: z.array(WaterQualitySchema).min(1).default(['nutrient', 'clean']),
    /** Flat extra yield in a season it is fed at least 1 nutrient-rich unit. */
    nutrientBonus: z.partialRecord(ResourceSchema, nonNeg).default({}),
    /** Water it puts back into its channel at its position, in a season it gets all it needs. */
    returns: z
      .object({ quality: WaterQualitySchema, amount: int.min(1) })
      .strict()
      .optional(),
    /** Turns up to this much grey water from its channel clean, in place (the Reed Bed). */
    cleans: nonNeg.default(0),
    /** A tile of Irrigation Channel. */
    channel: z.boolean().default(false),
    /**
     * Stores this much water (the Cistern), beside a channel, the river or a lake: it fills
     * from what is spare in the seasons of `fills` and releases it to buildings at or below
     * it that run short.
     */
    stores: nonNeg.default(0),
    fills: PerSeasonFlags.default([true, true, true, true]),
    /** Fed by the river beside it: puts this water into a neighbouring channel each season (Fish Pond). */
    feeds: z
      .object({ quality: WaterQualitySchema, amount: int.min(1) })
      .strict()
      .optional(),
    /** Holds back river water in one season and releases it below itself in another (the Weir). */
    holdsBack: z
      .object({ amount: int.min(1), fill: z.enum(SEASONS), release: z.enum(SEASONS) })
      .strict()
      .optional(),
    /** A channel with a tile of this loses no water to summer evaporation (Canal-top Solar). */
    noEvaporation: z.boolean().default(false),
    /**
     * Takes a neighbouring fish pond's water instead of a channel's (the Aquaponics Hall):
     * the pond feeds it instead of its channel.
     */
    fromPond: z.boolean().default(false),
    /** Turned by the river: energy per slot follows the flow at its tile (the River Wheel). */
    wheel: z.boolean().default(false),
  })
  .strict();
export type BuildingWater = z.infer<typeof BuildingWaterSchema>;

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
export type BuildingKind = (typeof BUILDING_KINDS)[number];

/**
 * A building with several recipes can be set to Auto: each run uses the first
 * recipe, in the order listed (salvage, then clutter), whose inputs are in
 * store and whose `autoAtLeast` stores are met.
 */
export const AUTO_RECIPE = 'auto';

const RecipeSchema = z.object({
  id: z.string(),
  inputs: z.partialRecord(ResourceSchema, nonNeg).default({}),
  outputs: z.partialRecord(ResourceSchema, nonNeg).default({}),
  /** Heat delivered free to a neighbouring heat well per run (kiln). */
  heatToNeighborStorage: nonNeg.default(0),
  /** On Auto, this recipe runs only while these stores are at least this high. */
  autoAtLeast: z.partialRecord(ResourceSchema, nonNeg).default({}),
  /**
   * Extra outputs per run while the building touches one of these tiles or a
   * tall building (the Mushroom Cellar, shaded by woodland or a kiln).
   */
  bonusNextTo: z
    .object({
      tiles: z.array(TileTypeSchema).default([]),
      tall: z.boolean().default(false),
      outputs: z.partialRecord(ResourceSchema, nonNeg),
    })
    .strict()
    .optional(),
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
    /** Storms can't damage it (earthworks, such as a channel). */
    stormProof: z.boolean().default(false),
    /** Counts as this source type for the Mixed Grid (an Agrivoltaic Field is solar). */
    sourceType: z.string().optional(),
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
    /**
     * Takes its heat from a neighbouring building of these types before any other source
     * (the Bathhouse): a staffed one that runs recipes (a kiln) warms it for free; a heat
     * store pays from what it holds.
     */
    heatFromNeighbors: z.array(z.string()).optional(),
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
        /** The slots its regular runs may draw spare energy from (Night Shift's runs are night only). */
        runSlots: z
          .array(z.enum(['day', 'night']))
          .min(1)
          .default(['day', 'night']),
        /** Extra runs in the run's first year (the Foundry District's perk). */
        firstYearExtraRuns: nonNeg.default(0),
        /** 0 for a recipe that needs no energy (the Mushroom Cellar). */
        energyPerRun: nonNeg,
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
        /** Wellbeing each season it stands undamaged (the Singing Spire). */
        always: int.default(0),
        nextToTiles: z.object({ tiles: z.array(TileTypeSchema), amount: int }).optional(),
      })
      .optional(),
    harmony: int.default(0),
    /** Its tile counts as this type for Harmony, though it isn't (the Hedgerow on scrub). */
    harmonyAsTile: TileTypeSchema.optional(),
    /** Storms can't damage the buildings next to it (the Hedgerow). */
    sheltersNeighbors: z.boolean().default(false),
    /**
     * Runs along the edges between tiles instead of standing on one (the Hedgerow): planted
     * between two tiles of `placement.tiles`, it shelters both from storms, and every
     * `harmonyPer` segments give 1 Harmony.
     */
    edge: z
      .object({ harmonyPer: int.min(1) })
      .strict()
      .optional(),
    /** Gone after this many seasons, leaving its tile as it was (a coppice regrowing). */
    revertsAfterSeasons: int.min(1).optional(),
    /**
     * Each spring, this building appears on a free tile next to the reservoir, up to `max`
     * in all (the Beaver Dam's reed beds).
     */
    spawns: z
      .object({ building: z.string(), max: int.min(1) })
      .strict()
      .optional(),
    /**
     * Turns spare food from neighbouring producing buildings into wellbeing
     * (the Cider Press): for each of up to `max` neighbours of these types that
     * yielded food this season, `foodEach` food from the stores (after eating)
     * becomes `wellbeingEach` wellbeing.
     */
    cider: z
      .object({
        nextTo: z.array(z.string()).min(1),
        foodEach: int.min(1),
        wellbeingEach: int.min(1),
        max: int.min(1),
      })
      .optional(),
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
        downstreamFoodPenalty: z.object({ targets: z.array(z.string()), amount: nonNeg }),
      })
      .optional(),
    levee: z
      .object({
        radius: int.min(1),
        /** Share of the silt boost protected farms still get (the Silt Traps tuning). */
        siltShare: z.number().min(0).max(1).default(0),
      })
      .optional(),
    /** Exists only while the water system is on: the water buildings, and Willow Reach v2 (E3). */
    requiresWater: z.boolean().default(false),
    /** Exists only with the heat layer, when energy can't pay heat (the Air-source Heat Pump). */
    requiresHeatLayer: z.boolean().default(false),
    /** Exists only with walks to water (the Well). */
    requiresWalks: z.boolean().default(false),
    /** Homes can fetch drinking water here (walks to water): channels, cisterns, wells. */
    drinkingWater: z.boolean().default(false),
    water: BuildingWaterSchema.optional(),
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
    storm: EventBase.extend({
      disableCount: nonNeg,
      /** The tiles whose buildings the storm can damage (unless next to woodland). */
      exposedOn: z.array(TileTypeSchema).min(1).default(['hill']),
      /** Whether a Mixed Grid keeps the storm from damaging anything. */
      mixedGridShelters: z.boolean().default(true),
      /** 0: storm damage lasts the season. More: it lasts until repaired, for these materials. */
      repairCost: nonNeg.default(0),
    }),
    freeze: EventBase,
  })
  .strict();
export type EventId = keyof z.infer<typeof EventsSchema>;

export const ModifierSchema = z
  .object({
    target: z.enum(['building', 'rules', 'event', 'combo', 'map']),
    /** Building, event or combo id (not for rules or the map generator). */
    id: z.string().optional(),
    path: z.string().min(1),
    set: z.union([z.number(), z.boolean(), z.string(), z.array(z.string())]).optional(),
    add: z.number().optional(),
    multiply: z.number().optional(),
  })
  .strict()
  .refine((m) => [m.set, m.add, m.multiply].filter((x) => x !== undefined).length === 1, {
    message: 'a modifier needs exactly one of set, add or multiply',
  });
export type Modifier = z.infer<typeof ModifierSchema>;

const WaterRulesSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Units entering the river at the top of the map each season. */
    riverFlow: PerSeason,
    /**
     * Whether buildings beside the river or a lake draw straight from it. Off, every
     * building draws through a channel (EXPANSION.md as written).
     */
    drawBesideRiver: z.boolean().default(true),
    /** Most water a channel takes from its source in a season, evaporation included. */
    channelCapacity: int.min(1),
    /** A channel loses 1 unit for every `tilesPerUnit` tiles (rounded down) in these seasons. */
    evaporation: z.object({ tilesPerUnit: int.min(1), seasons: PerSeasonFlags }).strict(),
    /** A building that gets less water than it needs yields this share, rounded down. */
    shortfallFactor: z.number().min(0).max(1),
    /** Harmony lost for each unit of grey water that reaches the river, until next season. */
    greyHarmonyPerUnit: nonNeg,
    /** Water each lake tile (still water off the river) holds; the spring flood fills it. */
    lakePerTile: nonNeg,
    /** River wheels make 1 energy per slot for every this many units of flow, rounded up. */
    wheelFlowPerEnergy: int.min(1),
    /** Tiles of channel the Founders' Camp starts with. */
    campChannel: nonNeg,
    /** The building that is a tile of channel, dug for the camp. */
    channelBuilding: z.string(),
  })
  .strict();
export type WaterRules = z.infer<typeof WaterRulesSchema>;

/**
 * Commuting (asked for by the playtester; DECISIONS.md, Teaching by layers):
 * workers walk from their home to their work, and long walks cost wellbeing.
 */
const CommuteRulesSchema = z
  .object({
    enabled: z.boolean().default(false),
    /** Tiles a worker walks for nothing. */
    freeDistance: nonNeg,
    /** Every this many tiles walked beyond the free distance, summed over workers, cost 1 wellbeing. */
    tilesPerWellbeing: int.min(1),
    /**
     * Walks to water (DECISIONS.md, Walks to water): with water on too, each lived-in home
     * walks to the nearest drinking water; tiles beyond `freeDistance`, summed over homes,
     * cost 1 wellbeing for every `tilesPerWellbeing`.
     */
    toWater: z
      .object({ freeDistance: nonNeg, tilesPerWellbeing: int.min(1) })
      .strict()
      .optional(),
  })
  .strict();
export type CommuteRules = z.infer<typeof CommuteRulesSchema>;

/**
 * Local heat (DECISIONS.md, Teaching by layers): heat sources (free heat,
 * heat pumps, heat wells) reach only buildings within `range` tiles; heat
 * paid with energy from the grid still reaches anywhere.
 */
const LocalHeatRulesSchema = z
  .object({
    enabled: z.boolean().default(false),
    range: int.min(1),
    /** Energy each heat costs when paid from the grid (resistive heating), while it is on. */
    gridHeatCost: int.min(1).default(1),
    /**
     * Whether energy can pay heat directly at all. Off (the heat layer, run 4, and a Long
     * Winter), heat comes only from buildings, and a building nothing heats is cold.
     */
    gridHeat: z.boolean().default(true),
    /** A cold home costs this much more wellbeing for each bed in it (its people are cold). */
    coldPerBed: nonNeg.default(0),
  })
  .strict();

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
      /** Flat Harmony from Root City (the Mended Commons perk). */
      bonus: int.default(0),
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
    /** Tunings and refinements a run can take in all; past this, drafts deal blueprints only. */
    maxTunings: int.min(0).default(12),
    /** Salvage gained per unit drawn from a ruin (Repair Culture doubles it). */
    ruinSalvageFactor: z.number().min(0).default(1),
    /** Multiplies what flexible consumers (workshops, kilns) make, rounded down (Slow Power). */
    flexibleOutputFactor: z.number().min(0).default(1),
    /** Eras whose first season offers a charter, and how many to choose from. */
    charterEras: z.array(int.min(1)).default([]),
    charterChoices: int.min(1).default(3),
    /**
     * The end-of-run score and the Graft tier bands (Milestone 7). The design
     * leaves both open; see DECISIONS.md for how these were chosen.
     */
    score: z.object({
      perSeasonSurvived: int,
      perCitizen: int,
      perHarmony: int,
      wellbeingStep: int.min(1),
      perWellbeingStep: int,
      completeBonus: int,
      /** Per loop standing at the end, and per combo discovered this run. */
      perLoop: int,
      perDiscovery: int,
      visionBonus: int,
      /**
       * Points for each layer of the teaching ladder the run plays with (DECISIONS.md,
       * Teaching by layers), so a run with more to manage scores as well as one without.
       */
      layers: z
        .object({
          water: nonNeg.default(0),
          commute: nonNeg.default(0),
          localHeat: nonNeg.default(0),
        })
        .strict()
        .default({ water: 0, commute: 0, localHeat: 0 }),
      /** Graft tiers from lowest; a run reaches the highest tier whose `min` its score meets. */
      tiers: z.array(z.object({ id: z.string(), name: z.string(), min: int.min(0) })).min(1),
    }),
    /**
     * Demolishing a building: the energy the work takes in this season's slot,
     * the rubble it leaves (a share of the building's cost, at least 1), which
     * becomes salvage instead of clutter while one of `salvagedBy` stands, and
     * what the tile becomes (tiles of the `keeps` types stay as they are).
     */
    demolition: z
      .object({
        energy: nonNeg,
        slot: z.enum(['day', 'night']),
        rubbleShare: z.number().min(0),
        salvagedBy: z.array(z.string()).default([]),
        tileBecomes: TileTypeSchema,
        keeps: z.array(TileTypeSchema).default([]),
      })
      .strict()
      .default({
        energy: 2,
        slot: 'day',
        rubbleShare: 0.5,
        salvagedBy: [],
        tileBecomes: 'barren',
        keeps: [],
      }),
    /**
     * Rising expectations (asked for in playtesting): from `fromEra`, citizens
     * expect civic life. It serves `base` citizens, plus more for each working
     * civic building; every `perUnserved` citizens beyond that (rounded up)
     * cost 1 wellbeing a season.
     */
    expectations: z
      .object({
        fromEra: int.min(1),
        base: nonNeg,
        perBuilding: z.record(z.string(), nonNeg),
        perUnserved: int.min(1),
      })
      .strict()
      .optional(),
    /** Seasons grow harsher: modifiers that hold from each era on (before twists and cards). */
    eraModifiers: z
      .array(
        z
          .object({ era: int.min(1), text: z.string(), modifiers: z.array(ModifierSchema) })
          .strict(),
      )
      .default([]),
    /** How many visions are offered at the start of a run (when visions are on). */
    visionChoices: int.min(1).default(2),
    /** The water system (EXPANSION.md, Water system). Off unless `enabled`. */
    water: WaterRulesSchema,
    commute: CommuteRulesSchema.default({ enabled: false, freeDistance: 3, tilesPerWellbeing: 4 }),
    localHeat: LocalHeatRulesSchema.default({
      enabled: false,
      range: 2,
      gridHeatCost: 1,
      gridHeat: true,
      coldPerBed: 0,
    }),
    mixedGrid: z.object({
      minSourceTypes: int.min(1),
      minShare: z.number().min(0).max(1),
      /** Sources that don't count towards the mix (the Founders' Camp). */
      excludeSources: z.array(z.string()).default([]),
      /** Extra energy in every slot while the Mixed Grid holds (a balance setting). */
      bonusPerSlot: int.min(0).default(0),
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
    /** Tiles from the river that are floodplain (the next ring may be, by farFloodplainChance). */
    floodplainWidth: int.min(1).default(1),
    /** Oxbow lakes: still water beside the river, ringed with floodplain. */
    lakes: nonNeg.default(0),
    lakeSize: int.min(1).default(3),
  })
  .strict();
export type MapGen = z.infer<typeof MapGenSchema>;

/**
 * A data modifier: tunings and charters change numbers in the content for the
 * rest of a run. `path` is a dot path into a building, the rules or an event
 * (array indexes allowed, e.g. `generation.day.3`). `add` and `multiply` apply
 * to every number of an array.
 */

const CardText = { id: z.string().regex(/^[a-z][A-Za-z]*$/), name: z.string(), text: z.string() };

export const TuningSchema = z.object({
  ...CardText,
  modifiers: z.array(ModifierSchema).min(1),
  /**
   * A refinement: a late-run tuning that fills the draft once blueprints and
   * tunings can't make a full offer. It refines `building` (offered only once
   * that is unlocked) and can be taken up to `max` times, its effects stacking.
   */
  refinement: z.boolean().default(false),
  building: z.string().optional(),
  max: int.min(1).default(1),
});
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
  /** Willow Reach v2 (E3): in play only while the run has water. */
  requiresWater: z.boolean().default(false),
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
        .array(
          z
            .object({
              buildings: z.array(z.string()).min(1),
              slot: z.enum(SLOTS).optional(),
              /** It took heat from the previous link's building (a bathhouse from a kiln). */
              heatFrom: z.boolean().default(false),
              /** It cleaned grey water this season (a reed bed). */
              cleaned: z.boolean().default(false),
              /** It got water of this quality this season (a farm below a paddy). */
              gotWater: WaterQualitySchema.optional(),
            })
            .strict(),
        )
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
          /** Only neighbours of these types count (the Keyhole Garden's farms). */
          of: z.array(z.string()).optional(),
        }),
        /** One building of each of these types, every one touching every other. */
        z.object({ kind: z.literal('cluster'), buildings: z.array(z.string()).min(2).max(3) }),
        /** An unbroken run of at least `length` hedges along tile edges, joined end to end. */
        z.object({ kind: z.literal('hedgeRun'), length: int.min(2) }),
        /** Buildings in a straight line, in this order (either direction), on these tiles. */
        z.object({
          kind: z.literal('line'),
          sequence: z.array(z.string()).min(2),
          tiles: z.array(TileTypeSchema).optional(),
        }),
        /** An unbroken strip of these tiles from the river to a side edge of the valley. */
        z.object({
          kind: z.literal('strip'),
          tiles: z.array(TileTypeSchema).min(1),
          /** Land tiles of another kind the strip may cross (the Heartwood Grove landmark). */
          gaps: nonNeg.default(0),
        }),
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
          /** Multiplies what members of `appliesTo` convert (a composter's compost). */
          outputMultiplier: int.min(1).default(1),
          /** Flat extra yield for each member of `appliesTo` that made some this season. */
          yields: z.partialRecord(ResourceSchema, int.min(1)).default({}),
          /** Storms can't damage buildings within this many tiles of a member (the Windbreak). */
          shelterRadius: nonNeg.default(0),
          /** Seasons the wellbeing applies in (the Hearth Square: winter). */
          seasons: PerSeasonFlags.default([true, true, true, true]),
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
        z.object({
          kind: z.literal('nextTo'),
          nextTo: NextTo,
          /** A second neighbour it needs as well (the Food Forest: an apiary and 2 meadows). */
          also: NextTo.optional(),
          /** Only while Harmony is at least this (the Beaver Dam). */
          minHarmony: int.min(1).optional(),
        }),
        /** Its ruin has no salvage left (and, optionally, it has these neighbours). */
        z.object({ kind: z.literal('ruinExhausted'), nextTo: NextTo.optional() }),
        /** Placing this building on it (a solar canopy on a farm, or on a channel). */
        z.object({ kind: z.literal('placed'), building: z.string() }),
        /**
         * A player action, not an evolution of a building: the player coppices a tile of
         * `from` (a tile type) with these neighbours, and it becomes `into` (Coppice Wood).
         */
        z.object({
          kind: z.literal('coppiced'),
          nextTo: NextTo,
          /** What a stopped coppice becomes until it is woodland again. */
          regrowth: z.string(),
        }),
      ]),
    })
    .strict(),
]);
export type Combo = z.infer<typeof ComboSchema>;
export type ComboLayer = Combo['layer'];
export const COMBO_LAYERS = ['adjacency', 'chain', 'formation', 'evolution'] as const;

/** Run goals: one is chosen at the start of a run. */
/** A goal a run can meet: the target of a vision or of an era. */
export const GoalSchema = z.discriminatedUnion('kind', [
  /** This share of the healable land (the land-health ladder) is meadow or woodland. */
  z.object({ kind: z.literal('greenLand'), share: z.number().min(0).max(1) }),
  /**
   * A full calendar year, spring to winter, without a shortfall in any slot,
   * with at least `minCitizens` citizens at the end of every season of it.
   */
  z.object({ kind: z.literal('noShortfallYear'), minCitizens: int.min(0).default(0) }),
  /** At least this many citizens, at this wellbeing or more. */
  z.object({ kind: z.literal('citizens'), citizens: int.min(1), wellbeing: int.min(0).default(0) }),
  /** At least this many loops closed. */
  z.object({ kind: z.literal('loops'), count: int.min(1) }),
  /** Harmony at least this high. */
  z.object({ kind: z.literal('harmony'), harmony: int.min(1) }),
]);
export type Goal = z.infer<typeof GoalSchema>;

export const VisionSchema = z.object({ ...CardText, goal: GoalSchema }).strict();
export type Vision = z.infer<typeof VisionSchema>;

/**
 * Era goals: a small goal for each era, met by the end of any season in it.
 * The design's risk table asks for them without defining them (Q9); these are
 * the designer's defaults until playtesting.
 */
export const EraGoalSchema = z
  .object({
    era: int.min(1),
    text: z.string(),
    goal: GoalSchema,
    reward: z.object({ knowledge: nonNeg.default(0) }),
  })
  .strict();
export type EraGoal = z.infer<typeof EraGoalSchema>;

/** What a run's signature is measured by, for the Graft offer. */
export const SIGNATURE_METRICS = ['energyShare', 'foodPerCitizen', 'harmony', 'industry'] as const;

/** A Root City district a run can send home as its Graft. */
export const DistrictSchema = z
  .object({
    id: z.string().regex(/^[a-z][A-Za-z]*$/),
    name: z.string(),
    /** "Earned by", as in the design's table. */
    earnedBy: z.string(),
    /** The run's lean towards this district is `metric / full` (1 = fully this kind of run). */
    signature: z.object({
      metric: z.enum(SIGNATURE_METRICS),
      full: z.number().positive(),
      /** For `energyShare`: the source types whose share of built energy counts. */
      sources: z.array(z.string()).default([]),
    }),
    /** The perk at each Graft tier, lowest first: what it says and what it changes in a run. */
    perks: z
      .array(z.object({ text: z.string(), modifiers: z.array(ModifierSchema) }).strict())
      .min(1),
    /** The card (blueprint, tuning or charter) it adds to future drafts; no run offers it otherwise. */
    adds: z.string(),
    /** Counts as green for landmarks such as Heartwood Grove. */
    green: z.boolean().default(false),
  })
  .strict();
export type District = z.infer<typeof DistrictSchema>;

/** A hidden combo between neighbouring districts in Root City. */
export const LandmarkSchema = z
  .object({
    ...CardText,
    hint: z.string(),
    /** This district, next to at least `count` districts of these ids (or green ones). */
    district: z.string(),
    nextTo: z
      .object({
        districts: z.array(z.string()).default([]),
        green: z.boolean().default(false),
        count: int.min(1).default(1),
      })
      .strict(),
    /** What it changes in every run while it stands. */
    modifiers: z.array(ModifierSchema).min(1),
  })
  .strict();
export type Landmark = z.infer<typeof LandmarkSchema>;

/**
 * A project (proposed in playtesting for the quiet end of a run): a
 * settlement-wide work started from a given era. It costs a lump of stores
 * at once, takes some seasons, and then pays off for the rest of the run.
 */
export const ProjectSchema = z
  .object({
    ...CardText,
    era: int.min(1),
    cost: z.partialRecord(ResourceSchema, nonNeg),
    seasons: int.min(1),
    effect: z
      .object({
        /** Added to the run's score. */
        score: int.default(0),
        /** Flat Harmony from then on. */
        harmony: int.default(0),
        /** Wellbeing every season from then on. */
        wellbeing: int.default(0),
        /** On completion, this many of the least healthy healable tiles improve one step. */
        heal: nonNeg.default(0),
        /** Extra Seeds when the run is sent home. */
        seeds: nonNeg.default(0),
        modifiers: z.array(ModifierSchema).default([]),
      })
      .strict(),
  })
  .strict();
export type Project = z.infer<typeof ProjectSchema>;

/** An expedition's twist: a lasting change to the run, and how it lifts the Graft. */
export const TwistSchema = z
  .object({
    ...CardText,
    modifiers: z.array(ModifierSchema).default([]),
    /** Tiers the Graft rises (up to the highest). */
    graftTierBonus: nonNeg.default(0),
  })
  .strict();
export type Twist = z.infer<typeof TwistSchema>;

/**
 * An expedition's region: a variation of the biome's valley, as modifiers
 * (usually of the map generator, `target: 'map'`). Applied before everything
 * else, so twists and cards build on it.
 */
export const RegionSchema = z
  .object({
    ...CardText,
    modifiers: z.array(ModifierSchema).default([]),
    /** Tiers the Graft rises for a harder valley (with a twist's, up to the highest). */
    graftTierBonus: nonNeg.default(0),
  })
  .strict();
export type Region = z.infer<typeof RegionSchema>;

/**
 * Tempest levels (DESIGN.md, Root City and progression): unlocked one at a
 * time after a Heartwood Graft at the level below. Level N plays with the
 * hardships of levels 1 to N, and the run earns `seedsPerLevel` more Seeds
 * for each.
 */
export const TempestSchema = z
  .object({
    seedsPerLevel: nonNeg,
    levels: z.array(z.object({ ...CardText, modifiers: z.array(ModifierSchema).min(1) }).strict()),
  })
  .strict();
export type Tempest = z.infer<typeof TempestSchema>;

/** An expedition's optional city request, worth bonus Seeds if met. */
export const RequestSchema = z
  .object({ id: z.string().regex(/^[a-z][A-Za-z]*$/), text: z.string(), goal: GoalSchema })
  .strict();
export type CityRequest = z.infer<typeof RequestSchema>;

/**
 * Seeds and Root City (the designer's numbers, ahead of Milestone 8). Every
 * run earns Seeds; Seeds raise districts' tiers; the ending is a full city
 * with enough Heartwood districts.
 */
export const ProgressionSchema = z
  .object({
    seeds: z.object({
      /** Seeds = base + the run's score ÷ pointsPerSeed, rounded down: better runs earn more. */
      base: nonNeg,
      pointsPerSeed: int.min(1),
      /** An expedition's city request met (Milestone 8). */
      cityRequest: nonNeg,
    }),
    /**
     * Seeds to plant a run's Graft in Root City. Only a run in about the top
     * quarter earns this much by itself; otherwise Seeds are banked for later.
     */
    graftCost: nonNeg,
    /** Seeds to raise a district to this tier id from the one below. */
    upgradeCost: z.record(z.string(), nonNeg),
    ending: z.object({ slots: int.min(1), heartwoodDistricts: int.min(0) }),
    /** A replaced district composts into this share of the Seeds spent upgrading it. */
    compostShare: z.number().min(0).max(1),
    /** Expeditions offered between runs. */
    expeditionChoices: int.min(1).default(3),
    /**
     * Teaching across runs: the run (1 = the first) from which each system
     * joins. The guided first year is for runs before `guidedUntil`.
     */
    teaching: z
      .object({
        guidedUntil: int.min(1),
        tunings: int.min(1),
        charters: int.min(1),
        visions: int.min(1),
        /** The water system joins at this run, with a guided first year of its own. */
        water: int.min(1).default(2),
        /** Commuting joins at this run (missing: not yet in the game). */
        commute: int.min(1).optional(),
        /** Local heat joins at this run (missing: not yet in the game). */
        localHeat: int.min(1).optional(),
      })
      .strict(),
  })
  .strict();
export type Progression = z.infer<typeof ProgressionSchema>;

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
    visions: z.array(VisionSchema).default([]),
    eraGoals: z.array(EraGoalSchema).default([]),
    districts: z.array(DistrictSchema).default([]),
    landmarks: z.array(LandmarkSchema).default([]),
    projects: z.array(ProjectSchema).default([]),
    twists: z.array(TwistSchema).default([]),
    regions: z.array(RegionSchema).default([]),
    tempest: TempestSchema.default({ seedsPerLevel: 0, levels: [] }),
    requests: z.array(RequestSchema).default([]),
    progression: ProgressionSchema.optional(),
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
