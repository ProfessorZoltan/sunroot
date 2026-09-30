/** Public API of the simulation core. The renderer and tools import only from here. */
export { loadContent, type Content } from './content/load';
export {
  SEASONS,
  SLOTS,
  RESOURCES,
  TILE_TYPES,
  type BuildingDef,
  type EventId,
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
export { provisionalScore, type ScoreLine } from './score';
export {
  computeHarmony,
  harmonyLines,
  harmonyMultiplier,
  waterDistance,
  type HarmonyLine,
} from './queries';
export { projectSeason } from './projection';
export type * from './types';
