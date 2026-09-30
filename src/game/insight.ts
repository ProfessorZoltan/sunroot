/**
 * What the interface shows, derived from the run: the year strip, how each
 * store will change this season and why, and the settlement's capacity. Pure
 * functions of the state, so every number on screen can be tested.
 */
import {
  RESOURCES,
  SEASONS,
  harmonyLines,
  projectSeason,
  type Content,
  type HarmonyLine,
  type Resource,
  type RunState,
  type Season,
  type SeasonReport,
  type Slot,
} from '../sim';

export type SeasonStatus = 'done' | 'now' | 'forecast';

export interface SlotView {
  supply: number;
  demand: number;
  shortfall: number;
  /** The full report for this slot, when there is one (now and forecast). */
  report: SeasonReport | null;
}

export interface SeasonView {
  season: Season;
  status: SeasonStatus;
  day: SlotView;
  night: SlotView;
}

export interface Contribution {
  label: string;
  amount: number;
}

export interface Insight {
  /** This season if it ended now. */
  now: SeasonReport;
  year: SeasonView[];
  /** Change in each store by the end of this season. */
  delta: Record<Resource, number>;
  /** What makes each store grow this season, by building type. */
  sources: Record<Resource, Contribution[]>;
  harmony: HarmonyLine[];
  workers: { busy: number; total: number };
  housing: number;
  foodStorage: number;
}

export function computeInsight(content: Content, state: RunState, asIs: RunState): Insight {
  const now = asIs.lastReport!;
  const current = SEASONS.indexOf(state.season);
  const year: SeasonView[] = SEASONS.map((season, i) => {
    if (i < current) {
      const past = state.history.find((h) => h.year === state.year && h.season === season);
      const slot = (s: Slot): SlotView => ({
        supply: past?.energy[s].supply ?? 0,
        demand: past?.energy[s].demand ?? 0,
        shortfall: past?.energy[s].shortfall ?? 0,
        report: null,
      });
      return { season, status: 'done', day: slot('day'), night: slot('night') };
    }
    const report = i === current ? now : projectSeason(content, state, season);
    const slot = (s: Slot): SlotView => ({
      supply: report.energy[s].supply + report.energy[s].storageDischarged,
      demand: report.energy[s].demand,
      shortfall: report.energy[s].shortfall,
      report,
    });
    return {
      season,
      status: i === current ? 'now' : 'forecast',
      day: slot('day'),
      night: slot('night'),
    };
  });

  const delta = {} as Record<Resource, number>;
  const sources = {} as Record<Resource, Contribution[]>;
  for (const res of RESOURCES) {
    delta[res] = asIs.stores[res] - state.stores[res];
    const byType = new Map<string, number>();
    for (const [uid, yields] of Object.entries(now.yields)) {
      const amount = yields[res];
      if (!amount) continue;
      const name = content.byId[state.buildings[uid]?.type ?? '']?.name ?? uid;
      byType.set(name, (byType.get(name) ?? 0) + amount);
    }
    sources[res] = [...byType].map(([label, amount]) => ({ label, amount }));
  }
  if (now.forage > 0) sources.materials.unshift({ label: 'Foraging', amount: now.forage });
  if (now.scraps.total > 0) {
    sources.scraps.push({ label: 'People', amount: now.scraps.fromCitizens });
  }
  if (now.clutter.fromScraps > 0) {
    sources.clutter.push({ label: 'Scraps left over', amount: now.clutter.fromScraps });
  }

  let busy = 0;
  let housing = 0;
  let foodStorage = 0;
  for (const b of Object.values(state.buildings)) {
    const def = content.byId[b.type]!;
    busy += def.workers;
    housing += def.housing;
    foodStorage += def.foodStorage;
  }
  return {
    now,
    year,
    delta,
    sources,
    harmony: harmonyLines(content, state),
    workers: { busy, total: state.citizens },
    housing,
    foodStorage,
  };
}

export const POPULATION_REASONS = {
  grew: 'People are arriving.',
  boom: 'Wellbeing is high: people are arriving quickly.',
  noHousing: 'No free housing: build a cottage.',
  lowSpareFood: 'Needs at least 2 spare food this season to grow.',
  lowWellbeing: 'Wellbeing is below 60: nobody new is coming.',
  leaving: 'Wellbeing is below 20: people are leaving.',
} as const;
