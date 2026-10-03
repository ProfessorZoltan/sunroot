/**
 * The grid's energy mix through the year: for each of the 8 slots (each season
 * by day and by night), the energy made by each family of source, stacked,
 * with what the settlement needed. Pure, for the Energy mix chart.
 *
 * Families, not buildings: the mix reads the same in every biome. Their order
 * is the stack's, bottom to top, and their colours were checked as a set for
 * colour-blind separation between neighbours (DECISIONS.md, The energy mix).
 */
import type { Content, Season, Slot } from '../sim';
import { MIXED_GRID_SOURCE } from '../sim/season/events';
import type { SeasonStatus, SeasonView } from './insight';

export interface MixFamily {
  id: string;
  name: string;
  color: string;
}

/** Bottom to top. The order is part of the colours' check: keep it with them. */
export const FAMILIES: readonly MixFamily[] = [
  { id: 'camp', name: "Founders' Camp", color: '#eb6834' },
  { id: 'water', name: 'Water', color: '#2a78d6' },
  { id: 'tide', name: 'Tide', color: '#1baf7a' },
  { id: 'sun', name: 'Sun', color: '#eda100' },
  { id: 'storage', name: 'From storage', color: '#e87ba4' },
  { id: 'biogas', name: 'Biogas and kilns', color: '#008300' },
  { id: 'wind', name: 'Wind', color: '#4a3aa7' },
  { id: 'other', name: 'Other', color: '#e34948' },
];

const WATER = ['riverWheel', 'hillTurbine', 'cascade', 'pumpedReservoir', 'weir'];
const TIDE = ['tideTurbine', 'waveBuoy', 'tideMill', 'estuaryTurbine', 'tidalLagoon'];
const WIND = ['windSpire', 'singingSpire'];

/** The family a source of energy belongs to (a building type, or the Mixed Grid's bonus). */
export function familyOf(content: Content, source: string): string {
  if (source === content.campBuilding) return 'camp';
  if (source === MIXED_GRID_SOURCE) return 'other';
  const def = content.byId[source];
  if (WATER.includes(source)) return 'water';
  if (TIDE.includes(source)) return 'tide';
  if (WIND.includes(source)) return 'wind';
  if (source === 'solarCanopy' || def?.sourceType === 'solarCanopy') return 'sun';
  if (def?.digester) return 'biogas';
  return 'other';
}

export interface MixPoint {
  season: Season;
  slot: Slot;
  status: SeasonStatus;
  /** Energy by family id. */
  values: Record<string, number>;
  total: number;
  demand: number;
  shortfall: number;
}

/** The year's 8 slots, in order, and the families that made any energy in them. */
export function energyMix(
  content: Content,
  year: readonly SeasonView[],
): { points: MixPoint[]; families: MixFamily[] } {
  const points: MixPoint[] = year.flatMap((sv) =>
    (['day', 'night'] as const).map((slot) => {
      const v = sv[slot];
      const values: Record<string, number> = Object.fromEntries(FAMILIES.map((f) => [f.id, 0]));
      for (const [source, amount] of Object.entries(v.bySource))
        values[familyOf(content, source)]! += amount;
      values.storage! += v.discharged;
      const total = Object.values(values).reduce((a, b) => a + b, 0);
      return {
        season: sv.season,
        slot,
        status: sv.status,
        values,
        total,
        demand: v.demand,
        shortfall: v.shortfall,
      };
    }),
  );
  const families = FAMILIES.filter((f) => points.some((p) => p.values[f.id]! > 0));
  return { points, families };
}
