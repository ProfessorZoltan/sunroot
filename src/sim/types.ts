import type { Hex } from './hex';
import type { RngState } from './rng';
import type { EventId, Resource, Season, Slot, TileType } from './content/schema';

export interface Tile extends Hex {
  type: TileType;
  /** Salvage left in a ruin. */
  salvage?: number;
  /** Position along the river, 0 at the upstream edge (river and reservoir tiles). */
  riverIndex?: number;
}

export interface MapState {
  width: number;
  height: number;
  /** Keyed by hexKey, in row-major order. */
  tiles: Record<string, Tile>;
  /** River tile keys from upstream to downstream. */
  river: string[];
  /** Floodplain tile keys, lowest ground first; a weir floods only the first part. */
  floodOrder: string[];
}

export type Stores = Record<Resource, number>;

export interface BuildingState {
  uid: string;
  type: string;
  at: Hex;
  /** Turn (0-based season count) the building was placed. */
  builtTurn: number;
  /** Year whose flood left silt on this farm. */
  siltYear?: number;
  /** Disabled by an event. Flood damage needs a repair; storm damage clears next season. */
  damage?: { cause: 'flood' | 'storm'; turn: number };
  /** Selected recipe for workshops and kilns. */
  recipe?: string;
  /** Energy slot a digester feeds. */
  slot?: Slot;
  /** Stored energy or heat. */
  stored?: number;
}

export interface RunOptions {
  seed: string;
  /** The guided first year: fixed draft offers in year 1. */
  guided?: boolean;
  /** For testing and designers: every blueprint unlocked and 999 materials. */
  sandbox?: boolean;
}

export interface DraftState {
  offer: string[];
  picked: string | null;
  /** A fourth card was bought this season. */
  extraBought: boolean;
}

export type RunStatus = 'active' | 'complete' | 'collapsed';

export interface RunState {
  version: 1;
  contentId: string;
  options: Required<RunOptions>;
  rng: RngState;
  /** Seasons completed so far (0 to 48). */
  turn: number;
  year: number;
  season: Season;
  era: number;
  status: RunStatus;
  map: MapState;
  buildings: Record<string, BuildingState>;
  nextUid: number;
  /** Building types the player can place. */
  unlocked: string[];
  stores: Stores;
  citizens: number;
  wellbeing: number;
  harmony: number;
  draft: DraftState;
  /** This season's event (announced last season) and the next one. */
  forecast: { event: EventId; next: EventId };
  /** Building uids, highest priority first: staffed first, shut off last. */
  priority: string[];
  /** Energy supplied by source type in recent seasons (for the Mixed Grid bonus). */
  energyHistory: Record<string, number>[];
  /** Combos discovered this run (Milestone 6). */
  discoveries: string[];
  /** Messages for the player about things that happened between seasons. */
  notices: string[];
  lastReport: SeasonReport | null;
  history: SeasonSummary[];
  /** Undo support: the state at the start of the season and the commands since. */
  seasonStart: SeasonSnapshot | null;
  seasonCommands: Command[];
}

export type SeasonSnapshot = Omit<RunState, 'seasonStart' | 'seasonCommands'>;

export type Command =
  | { type: 'pickCard'; card: string }
  | { type: 'rerollDraft' }
  | { type: 'buyExtraCard' }
  | { type: 'place'; building: string; at: Hex }
  | { type: 'spreadCompost'; at: Hex }
  | { type: 'setRecipe'; uid: string; recipe: string }
  | { type: 'setDigesterSlot'; uid: string; slot: Slot }
  | { type: 'setPriority'; order: string[] }
  | { type: 'undo' }
  | { type: 'endSeason' };

export type CommandResult = { ok: true; state: RunState } | { ok: false; error: string };

export interface HeatReport {
  /** Heat demanded by active buildings in this slot. */
  demand: number;
  /** Free heat generated (Solar Thermal Collectors), by source building type. */
  bySource: Record<string, number>;
  /** Free heat that paid heat demand directly. */
  free: number;
  /** Heat paid by heat pumps, and the energy they drew to do it. */
  pumped: number;
  pumpEnergy: number;
  /** Heat left to pay directly with energy, 1 for 1. */
  direct: number;
  /** Free heat put into Heat Wells. */
  stored: number;
}

export interface SlotReport {
  /** Energy generated, by source building type. */
  bySource: Record<string, number>;
  supply: number;
  /**
   * Energy the slot's buildings need: their energy demand, plus heat paid
   * directly, plus the energy drawn by heat pumps.
   */
  demand: number;
  heat: HeatReport;
  /** Day energy set aside to charge storage that will cover a known shortfall. */
  reserved: number;
  /** Energy used by flexible consumers (workshop and kiln runs). */
  sponges: number;
  /** Energy put into storage from what was still spare (after sponges). */
  storageCharged: number;
  /** Energy or heat released from storage into this slot's shortfall. */
  storageDischarged: number;
  /** Demand still unmet after storage; blackouts close this gap. */
  shortfall: number;
  /** Spare energy nothing used. */
  unused: number;
}

export interface RunReport {
  recipe: string;
  runs: number;
  energy: Record<Slot, number>;
}

export type WellbeingKind = 'needsMet' | 'hunger' | 'unpowered' | 'clutter' | 'greenery' | 'civic';

export interface WellbeingLine {
  kind: WellbeingKind;
  reason: string;
  amount: number;
}

export interface SeasonReport {
  turn: number;
  year: number;
  season: Season;
  event: EventId;
  mixedGrid: boolean;
  flooded: string[];
  silted: string[];
  damaged: string[];
  repaired: string[];
  unstaffed: string[];
  energy: Record<Slot, SlotReport>;
  runs: Record<string, RunReport>;
  /** Final yields per building uid. */
  yields: Record<string, Partial<Record<Resource, number>>>;
  /** Human-readable math per building uid, for tooltips. */
  math: Record<string, string[]>;
  bonuses: { apiary: number; compost: number };
  forage: number;
  improvedTiles: string[];
  blackouts: string[];
  food: { produced: number; eaten: number; unfed: number; rotted: number; storage: number };
  population: { before: number; change: number; after: number };
  wellbeing: { before: number; after: number; lines: WellbeingLine[] };
  clutter: { fromScraps: number; recycled: number; total: number };
  scraps: { fromCitizens: number; fromRot: number; total: number };
  harmony: { value: number; multiplier: number };
  /** Energy and free heat generated per building uid, by slot. */
  generated: Record<string, { energy: Record<Slot, number>; heat: Record<Slot, number> }>;
  discoveries: string[];
}

export interface SeasonSummary {
  turn: number;
  year: number;
  season: Season;
  materials: number;
  food: number;
  citizens: number;
  wellbeing: number;
  harmony: number;
  shortfall: number;
  blackouts: number;
}
