/** Public API of the simulation core. The renderer and tools import only from here. */
export { loadContent, type Content } from './content/load';
export {
  SEASONS,
  SLOTS,
  RESOURCES,
  TILE_TYPES,
  COMBO_LAYERS,
  type BuildingDef,
  type Charter,
  type Combo,
  type ComboLayer,
  type District,
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
export {
  previewPlacement,
  resolveAsIs,
  type PlacementPreview,
  type PreviewItem,
  type PreviewKey,
} from './preview';
export { generateMap } from './map';
export { blueprintPool } from './draft';
export {
  graftOffer,
  leanOf,
  provisionalScore,
  runSignature,
  scoreRun,
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
  waterDistance,
  type HarmonyLine,
} from './queries';
export { projectSeason } from './projection';
export { effectiveContent } from './content/modifiers';
export { findFormations, placementEvolution } from './combos';
export { isTuning } from './draft';
export type * from './types';
