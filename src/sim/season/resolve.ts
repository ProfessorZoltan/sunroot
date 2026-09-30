/**
 * Ending a season runs steps 3 to 10 of the season order (docs/DESIGN.md):
 *
 *  3. The season's event.        7. Demand, discharge, blackouts.
 *  4. Production.                8. Food, population, wellbeing.
 *  5. Flexible consumers.        9. Scraps and clutter, then Harmony.
 *  6. Storage charging.         10. Combo discovery check.
 *
 * Steps 1 (draft) and 2 (build) are player commands during the season.
 */
import type { Content } from '../content/load';
import { SEASONS } from '../content/schema';
import { dealOffer } from '../draft';
import {
  computeHarmony,
  defOf,
  eraOf,
  improveTile,
  seasonIndex,
  tileAt,
  byPriority,
} from '../queries';
import type { RunState, SeasonSummary } from '../types';
import { emptyReport, type SeasonContext } from './context';
import { resolveEnergy } from './energy';
import { applyEvent } from './events';
import { feedAndGrow, scrapsAndHarmony } from './people';
import { generate, produce, producePowered, staff } from './production';
import { snapshot } from '../snapshot';

export function resolveSeason(content: Content, input: RunState): RunState {
  const { seasonStart: _start, seasonCommands: _commands, ...rest } = input;
  const state: RunState = { ...structuredClone(rest), seasonStart: null, seasonCommands: [] };
  state.harmony = computeHarmony(content, state);
  const ctx: SeasonContext = {
    content,
    state,
    report: emptyReport(state),
    si: seasonIndex(state.season),
    active: new Set(),
    powered: new Set(),
    lowRiver: false,
    foodProduced: 0,
    bonusGiven: new Set(),
  };

  applyEvent(ctx); // 3
  staff(ctx);
  generate(ctx); // 4
  produce(ctx);
  resolveEnergy(ctx); // 5, 6, 7
  producePowered(ctx);
  feedAndGrow(ctx); // 8
  scrapsAndHarmony(ctx); // 9
  // 10: combo discovery arrives with Milestone 6.

  return advance(content, ctx);
}

function advance(content: Content, ctx: SeasonContext): RunState {
  const { state, report } = ctx;

  const bySource: Record<string, number> = {};
  for (const slot of ['day', 'night'] as const) {
    for (const [source, amount] of Object.entries(report.energy[slot].bySource)) {
      bySource[source] = (bySource[source] ?? 0) + amount;
    }
  }
  state.energyHistory = [...state.energyHistory, bySource].slice(-4);

  const summary: SeasonSummary = {
    turn: state.turn,
    year: state.year,
    season: state.season,
    materials: state.stores.materials,
    food: state.stores.food,
    citizens: state.citizens,
    wellbeing: state.wellbeing,
    harmony: state.harmony,
    shortfall: report.energy.day.shortfall + report.energy.night.shortfall,
    blackouts: report.blackouts.length,
  };
  state.history = [...state.history, summary];
  state.lastReport = report;

  // Storage: same-season stores empty, heat leaks.
  for (const b of Object.values(state.buildings)) {
    const s = defOf(content, b).storage;
    if (!s) continue;
    if (!s.carriesOver) b.stored = 0;
    else b.stored = Math.max(0, (b.stored ?? 0) - s.decayPerSeason);
  }
  // Storm damage lasts one season.
  for (const b of Object.values(state.buildings)) {
    if (b.damage?.cause === 'storm') delete b.damage;
  }

  state.turn += 1;
  state.notices = [];
  if (state.wellbeing <= content.rules.wellbeing.min) {
    state.status = 'collapsed';
  } else if (state.turn >= content.rules.yearsPerRun * SEASONS.length) {
    state.status = 'complete';
  }
  state.year = Math.floor(state.turn / SEASONS.length) + 1;
  state.season = SEASONS[state.turn % SEASONS.length]!;
  state.era = eraOf(content, state.turn);

  if (state.status === 'active') startSeason(content, state);
  state.harmony = computeHarmony(content, state);
  state.seasonStart = snapshot(state);
  return state;
}

/** Start-of-season upkeep: orchards mature, flood damage is repaired, the forecast and draft update. */
function startSeason(content: Content, state: RunState): void {
  for (const b of byPriority(state)) {
    const def = defOf(content, b);
    if (def.matureTileBecomes && state.turn - b.builtTurn === def.maturesAfterSeasons) {
      if (
        improveTile(
          content,
          tileAt(state, b.at)!,
          content.rules.landHealth.length,
          def.matureTileBecomes,
        )
      ) {
        state.notices.push(`${def.name} matured and turned its tile to ${def.matureTileBecomes}`);
      }
    }
    if (b.damage?.cause === 'flood') {
      const cost = content.events.flood.repairCost;
      if (state.stores.materials >= cost) {
        state.stores.materials -= cost;
        delete b.damage;
        state.notices.push(`Repaired ${def.name} after the flood for ${cost} materials`);
      } else {
        state.notices.push(`${def.name} is still flood-damaged: repairs need ${cost} materials`);
      }
    }
  }
  const si = seasonIndex(state.season);
  state.forecast = { event: content.calendar[si]!, next: content.calendar[(si + 1) % 4]! };
  state.draft = { offer: dealOffer(content, state), picked: null, extraBought: false };
}
