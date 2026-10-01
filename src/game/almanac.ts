/**
 * The Almanac: every combo per biome, kept across runs (docs/DESIGN.md "The
 * Almanac"). Discoveries and bought hints are stored in the browser; the
 * simulation only reports what each run found.
 */
import type { Combo, Content, RunState } from '../sim';

export interface Almanac {
  version: 1;
  /** Combo ids discovered in any run. */
  discovered: string[];
  /** Combo ids whose hint was bought in any run. */
  hints: string[];
}

export const EMPTY_ALMANAC: Almanac = { version: 1, discovered: [], hints: [] };

const KEY = (content: Content) => `sunroot:almanac:${content.id}`;

export function loadAlmanac(content: Content, storage: Storage | null): Almanac {
  try {
    const raw = storage?.getItem(KEY(content));
    if (!raw) return EMPTY_ALMANAC;
    const data = JSON.parse(raw) as Partial<Almanac>;
    const known = (ids: unknown) =>
      Array.isArray(ids) ? ids.filter((id) => typeof id === 'string' && content.comboById[id]) : [];
    return { version: 1, discovered: known(data.discovered), hints: known(data.hints) };
  } catch {
    return EMPTY_ALMANAC;
  }
}

export function saveAlmanac(content: Content, storage: Storage | null, almanac: Almanac): void {
  try {
    storage?.setItem(KEY(content), JSON.stringify(almanac));
  } catch {
    // Storage can be full or blocked; the Almanac then lasts for this visit only.
  }
}

/** Adds a run's discoveries and hints. `fresh` lists combos new to the Almanac, in order. */
export function recordRun(
  almanac: Almanac,
  state: RunState,
): { almanac: Almanac; fresh: string[] } {
  const fresh = state.discoveries.filter((id) => !almanac.discovered.includes(id));
  const hints = state.hints.filter((id) => !almanac.hints.includes(id));
  if (fresh.length === 0 && hints.length === 0) return { almanac, fresh };
  return {
    almanac: {
      version: 1,
      discovered: [...almanac.discovered, ...fresh],
      hints: [...almanac.hints, ...hints],
    },
    fresh,
  };
}

export const LAYER_NAMES: Record<Combo['layer'], string> = {
  adjacency: 'Adjacency',
  chain: 'Chain',
  formation: 'Formation',
  evolution: 'Evolution',
};

/** What an Almanac entry shows: the full entry, a hint, or only a silhouette. */
export function entryView(
  almanac: Almanac,
  state: RunState,
  combo: Combo,
): 'known' | 'hinted' | 'silhouette' {
  if (almanac.discovered.includes(combo.id) || state.discoveries.includes(combo.id)) return 'known';
  const free = combo.layer === 'adjacency' || combo.layer === 'chain';
  if (free || almanac.hints.includes(combo.id) || state.hints.includes(combo.id)) return 'hinted';
  return 'silhouette';
}
