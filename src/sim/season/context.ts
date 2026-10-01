import type { Content } from '../content/load';
import type { Resource, Slot } from '../content/schema';
import { defOf } from '../queries';
import type {
  BuildingState,
  ComboHit,
  FlowLines,
  Flows,
  RunState,
  SeasonReport,
  SlotReport,
} from '../types';

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
  /** A forecast: chance outcomes (the storm's target) are not drawn, only reported as risks. */
  forecast: boolean;
  /** Formations standing this season, found before production. */
  formations: ComboHit[];
  /** What standing formations do to each member building. */
  effects: Map<string, FormationEffect>;
  /** Buildings demolished this season: their work is energy demand. */
  demolitions: number;
}

export interface FormationEffect {
  generation: number;
  ignoresShade: boolean;
  freeRuns: boolean;
}

function emptySlot(): SlotReport {
  return {
    bySource: {},
    supply: 0,
    demandBy: {},
    demand: 0,
    heat: {
      demand: 0,
      bySource: {},
      free: 0,
      pumped: 0,
      pumpEnergy: 0,
      direct: 0,
      stored: 0,
      unused: 0,
    },
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
    // The season starts with what its commands already spent (building, rerolls...).
    flows: copyFlows(state.spent),
    turn: state.turn,
    year: state.year,
    season: state.season,
    event: state.forecast.event,
    mixedGrid: false,
    flooded: [],
    sheltered: [],
    dried: [],
    exposed: [],
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
    population: { before: state.citizens, change: 0, after: state.citizens, reason: 'grew' },
    wellbeing: { before: state.wellbeing, after: state.wellbeing, lines: [] },
    clutter: { fromScraps: 0, recycled: 0, total: state.stores.clutter },
    scraps: { fromCitizens: 0, fromRot: 0, total: state.stores.scraps },
    harmony: { value: state.harmony, multiplier: 1 },
    generated: {},
    shaded: {},
    combos: [],
    discoveries: [],
    evolved: [],
    atRisk: [],
    visionAchieved: false,
    requestMet: false,
    projectsDone: [],
    eraGoalMet: null,
  };
}

/**
 * A building yields a resource. `label` says what it counts as in the season
 * report: the building's own name by default, or a bonus ("Apiary bonus").
 */
export function addYield(
  ctx: SeasonContext,
  b: BuildingState,
  res: Resource,
  amount: number,
  label?: string,
) {
  if (amount === 0) return;
  const y = (ctx.report.yields[b.uid] ??= {});
  y[res] = (y[res] ?? 0) + amount;
  ctx.state.stores[res] += amount;
  if (res === 'food') ctx.foodProduced += amount;
  flow(ctx.report.flows, res, 'made', label ?? defOf(ctx.content, b).name, amount, b.uid);
}

/** Records a resource made or used, by what. `who` counts each building once per line. */
export function flow(
  flows: Flows,
  res: Resource,
  dir: 'made' | 'used',
  label: string,
  amount: number,
  who?: string,
) {
  if (amount === 0) return;
  const f = (flows[res] ??= { made: {}, used: {} });
  const line = (f[dir][label] ??= { amount: 0, count: 0 });
  line.amount += amount;
  const seen = `${res}:${dir}:${label}`;
  if (!who) line.count += 1;
  else if (!counted.get(flows)?.has(`${seen}:${who}`)) {
    let set = counted.get(flows);
    if (!set) counted.set(flows, (set = new Set()));
    set.add(`${seen}:${who}`);
    line.count += 1;
  }
}

export function copyFlows(flows: Flows): Flows {
  const out: Flows = {};
  for (const [res, f] of Object.entries(flows) as [
    Resource,
    { made: FlowLines; used: FlowLines },
  ][]) {
    const copy = (lines: FlowLines) =>
      Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, { ...v }]));
    out[res] = { made: copy(f.made), used: copy(f.used) };
  }
  return out;
}

/** Buildings already counted on each line, per report (kept out of the report itself). */
const counted = new WeakMap<Flows, Set<string>>();

export function explain(ctx: SeasonContext, b: BuildingState, line: string) {
  (ctx.report.math[b.uid] ??= []).push(line);
}

function generatedBy(ctx: SeasonContext, b: BuildingState) {
  return (ctx.report.generated[b.uid] ??= {
    energy: { day: 0, night: 0 },
    heat: { day: 0, night: 0 },
  });
}

export function addHeat(ctx: SeasonContext, slot: Slot, b: BuildingState, amount: number) {
  if (amount <= 0) return;
  generatedBy(ctx, b).heat[slot] += amount;
  const source = b.type;
  const h = ctx.report.energy[slot].heat;
  h.bySource[source] = (h.bySource[source] ?? 0) + amount;
}

export function addSupply(ctx: SeasonContext, slot: Slot, b: BuildingState, amount: number) {
  if (amount <= 0) return;
  generatedBy(ctx, b).energy[slot] += amount;
  const source = b.type;
  const r = ctx.report.energy[slot];
  r.bySource[source] = (r.bySource[source] ?? 0) + amount;
  r.supply += amount;
}
