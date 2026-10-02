/**
 * Saves (Milestone 7): a save is the serialized run state in a small,
 * versioned envelope. Reading one checks the envelope, the content it was made
 * with, and that the state has every field a run needs, so an old or damaged
 * save is refused with a reason instead of breaking the game.
 */
import type { Content } from './content/load';
import { createRun } from './run';
import type { RunState } from './types';

export const SAVE_FORMAT = 'sunroot-save';
export const SAVE_VERSION = 1;

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  version: typeof SAVE_VERSION;
  contentId: string;
  /** When it was saved (ISO time), supplied by the caller: the simulation has no clock. */
  savedAt: string;
  /** A short description for a "continue" button. */
  summary: { year: number; season: string; turn: number; status: string };
  state: RunState;
}

export function makeSave(state: RunState, savedAt: string): SaveFile {
  return {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    contentId: state.contentId,
    savedAt,
    summary: { year: state.year, season: state.season, turn: state.turn, status: state.status },
    state,
  };
}

/** Fields added to the run state after saves began, and their value for an older save. */
const ADDED_FIELDS: Partial<RunState> = {
  eraGoalsMet: [],
  requestMet: null,
  spent: {},
  recentReports: [],
  projects: [],
  evolutionOffer: [],
};

export type ReadSave = { ok: true; save: SaveFile } | { ok: false; error: string };

/** Checks a save (parsed JSON) before it is used. */
export function readSave(content: Content, data: unknown): ReadSave {
  const fail = (error: string): ReadSave => ({ ok: false, error });
  if (!data || typeof data !== 'object') return fail('not a save');
  const save = data as Partial<SaveFile>;
  if (save.format !== SAVE_FORMAT) return fail('not a Sunroot save');
  if (save.version !== SAVE_VERSION) return fail(`save version ${save.version} is not supported`);
  if (save.contentId !== content.id) return fail(`the save is for ${save.contentId}`);
  const state = save.state as Partial<RunState> | undefined;
  if (!state || typeof state !== 'object') return fail('the save has no run');
  const fresh = createRun(content, { seed: 'shape' });
  if (state.version !== fresh.version) return fail(`run version ${state.version} is not supported`);
  // Fields added since run version 2 began, with the value a run had before them.
  for (const [key, value] of Object.entries(ADDED_FIELDS)) {
    if (!(key in state)) (state as Record<string, unknown>)[key] = structuredClone(value);
  }
  // Options added since, with their value before them (Root City's arrived in Milestone 8).
  if (state.options)
    state.options = { ...fresh.options, ...state.options, seed: state.options.seed };
  const missing = Object.keys(fresh).filter((k) => !(k in state));
  if (missing.length > 0) return fail(`the run is missing ${missing.join(', ')}`);
  if (state.contentId !== content.id) return fail(`the run is for ${state.contentId}`);
  for (const b of Object.values(state.buildings ?? {})) {
    if (!content.byId[b.type]) return fail(`unknown building ${b.type}`);
  }
  return { ok: true, save: save as SaveFile };
}
