/**
 * How full a store of energy or heat is (cell banks, pumped reservoirs, heat
 * wells): now, and as it would stand when the season ends as things are.
 */
import type { Content } from '../sim/content/load';
import type { RunState } from '../sim/types';

export interface StorageGauge {
  holds: 'energy' | 'heat' | 'ice';
  capacity: number;
  now: number;
  /** After this season, if it ended as things stand (the season's losses included). */
  after: number;
  /** Whether what it holds is kept into the next season. */
  carriesOver: boolean;
  /** This season, as things stand: what it would charge and give. */
  charged: number;
  given: number;
}

export function storageGauge(
  content: Content,
  state: RunState,
  asIs: RunState,
  uid: string,
): StorageGauge | null {
  const b = state.buildings[uid];
  const def = b ? content.byId[b.type] : undefined;
  // An ice house keeps its ice as a store keeps energy (the Sun Desert).
  const storage =
    def?.storage ??
    (def?.ice
      ? { holds: 'ice' as const, capacity: def.ice.capacity, carriesOver: true }
      : undefined);
  if (!b || !storage) return null;
  const trace = asIs.lastReport?.storage?.[uid];
  return {
    holds: storage.holds,
    capacity: storage.capacity,
    now: b.stored ?? 0,
    after: asIs.buildings[uid]?.stored ?? 0,
    carriesOver: storage.carriesOver,
    charged: trace?.charged ?? 0,
    given: trace?.given ?? 0,
  };
}

/** Lines for a tooltip or the details panel. */
export function gaugeLines(g: StorageGauge): string[] {
  const season =
    g.charged === 0 && g.given === 0
      ? 'This season it would charge and give nothing'
      : `This season it would charge ${g.charged} and give ${g.given}`;
  return [
    `Holds ${g.now} of ${g.capacity} ${g.holds} now.`,
    g.carriesOver
      ? `${season}, holding ${g.after} when the season ends.`
      : `${season}; it empties when the season ends.`,
  ];
}
