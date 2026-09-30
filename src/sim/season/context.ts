import type { Content } from '../content/load';
import type { Resource, Slot } from '../content/schema';
import type { BuildingState, RunState, SeasonReport, SlotReport } from '../types';

/** Working data for one season's resolution. `state` is a private clone and may be mutated. */
export interface SeasonContext {
  content: Content;
  state: RunState;
  report: SeasonReport;
  /** Season index, 0 = spring. */
  si: number;
  /** Buildings operating this season: undamaged and staffed. */
  active: Set<string>;
  /** Active buildings whose every demand was met (set after the energy step). */
  powered: Set<string>;
  lowRiver: boolean;
  /** Food yielded this season, for the spare-food growth rule. */
  foodProduced: number;
  /** `${targetUid}:${giverType}` pairs, so each kind of neighbour bonus applies once. */
  bonusGiven: Set<string>;
}

function emptySlot(): SlotReport {
  return {
    bySource: {},
    supply: 0,
    demand: 0,
    heat: { demand: 0, bySource: {}, free: 0, pumped: 0, pumpEnergy: 0, direct: 0, stored: 0 },
    reserved: 0,
    sponges: 0,
    storageCharged: 0,
    storageDischarged: 0,
    shortfall: 0,
    unused: 0,
  };
}

export function emptyReport(state: RunState): SeasonReport {
  return {
    turn: state.turn,
    year: state.year,
    season: state.season,
    event: state.forecast.event,
    mixedGrid: false,
    flooded: [],
    silted: [],
    damaged: [],
    repaired: [],
    unstaffed: [],
    energy: { day: emptySlot(), night: emptySlot() },
    runs: {},
    yields: {},
    math: {},
    bonuses: { apiary: 0, compost: 0 },
    forage: 0,
    improvedTiles: [],
    blackouts: [],
    food: { produced: 0, eaten: 0, unfed: 0, rotted: 0, storage: 0 },
    population: { before: state.citizens, change: 0, after: state.citizens },
    wellbeing: { before: state.wellbeing, after: state.wellbeing, lines: [] },
    clutter: { fromScraps: 0, recycled: 0, total: state.stores.clutter },
    scraps: { fromCitizens: 0, fromRot: 0, total: state.stores.scraps },
    harmony: { value: state.harmony, multiplier: 1 },
    discoveries: [],
  };
}

export function addYield(ctx: SeasonContext, b: BuildingState, res: Resource, amount: number) {
  if (amount === 0) return;
  const y = (ctx.report.yields[b.uid] ??= {});
  y[res] = (y[res] ?? 0) + amount;
  ctx.state.stores[res] += amount;
  if (res === 'food') ctx.foodProduced += amount;
}

export function explain(ctx: SeasonContext, b: BuildingState, line: string) {
  (ctx.report.math[b.uid] ??= []).push(line);
}

export function addHeat(ctx: SeasonContext, slot: Slot, source: string, amount: number) {
  if (amount <= 0) return;
  const h = ctx.report.energy[slot].heat;
  h.bySource[source] = (h.bySource[source] ?? 0) + amount;
}

export function addSupply(ctx: SeasonContext, slot: Slot, source: string, amount: number) {
  if (amount <= 0) return;
  const r = ctx.report.energy[slot];
  r.bySource[source] = (r.bySource[source] ?? 0) + amount;
  r.supply += amount;
}
