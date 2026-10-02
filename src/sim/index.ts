/** Public API of the simulation core. The renderer and tools import only from here. */
export { loadContent, type Content } from './content/load';
export {
  SEASONS,
  SLOTS,
  RESOURCES,
  TILE_TYPES,
  COMBO_LAYERS,
  AUTO_RECIPE,
  type BuildingDef,
  type BuildingKind,
  type Charter,
  type Combo,
  type ComboLayer,
  type District,
  type EraGoal,
  type Goal,
  type Project,
  type Vision,
  type EventId,
  type Tuning,
  type Resource,
  type Season,
  type Slot,
  type TileType,
} from './content/schema';
export * from './hex';
export { createRun, type CreateRunOverrides } from './run';
export { applyCommand } from './commands';
export { canPlace, type PlacementCheck } from './placement';
export type { ResolveOptions } from './season/resolve';
export {
  forecastSeason,
  previewPlacement,
  resolveAsIs,
  type PlacementPreview,
  type PreviewItem,
  type PreviewKey,
} from './preview';
export { generateMap } from './map';
export { blueprintPool, cardAllowed, refinementPool, timesTaken, tuningsFull } from './draft';
export {
  cityRequest,
  eraGoal,
  eraGoalMet,
  eraGoalOr,
  goalMet,
  goalProgress,
  graftOffer,
  leanOf,
  provisionalScore,
  runSignature,
  scoreRun,
  seedsForRun,
  warmCitizens,
  canPlantGraft,
  visionMet,
  visionProgress,
  type GraftOffer,
  type GraftOption,
  type RunScore,
  type ScoreLine,
  type Signature,
  type Tier,
  type VisionProgress,
} from './score';
export { makeSave, readSave, SAVE_VERSION, type ReadSave, type SaveFile } from './save';
export {
  computeHarmony,
  harmonyLines,
  harmonyMultiplier,
  repairCost,
  standsOn,
  waterDistance,
  type HarmonyLine,
} from './queries';
export { projectSeason } from './projection';
export { effectiveContent, runModifiers } from './content/modifiers';
export { findFormations, placementEvolution } from './combos';
export { isTuning } from './draft';
export { channels, waterOn, type Channel } from './water';
export type * from './types';
export {
  applyCityCommand,
  bestTiers,
  createCity,
  districtAt,
  expeditionOffer,
  isFull,
  makeCitySave,
  needsExpedition,
  neighborSlots,
  nextRunOptions,
  readCity,
  runCity,
  slotCount,
  slotHexes,
  standingLandmarks,
  sunTreeGrown,
  sunTreeProgress,
  teaching,
  type CityCommand,
  type CityDistrict,
  type CityEvent,
  type CityResult,
  type CitySave,
  type CityState,
  type Expedition,
  type Graft,
  type ReadCity,
  type RunResult,
  type Teaching,
} from './city';
export { demolishCheck, type DemolishCheck } from './demolish';
export { energyLedger, SHORT, type EnergyLedger } from './energyLedger';
export { finishedProjects, projectBlocked } from './projects';
export { buildingAt } from './queries';
export {
  finishedWonders,
  flower,
  wonderBrief,
  wonderNeeds,
  wonderOf,
  wonderProgress,
  wonders,
  wonderStage,
} from './wonder';
export {
  animals,
  festivalProblem,
  festivals,
  festivalThisSeason,
  habitatOf,
  welcomes,
} from './wildlife';
