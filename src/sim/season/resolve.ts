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
  plantTile,
  seasonIndex,
  tileAt,
  byPriority,
  occupancy,
  repairCost,
} from '../queries';
import { hexDistance, hexKey, hexNeighbors } from '../hex';
import type { BuildingState, RunState, SeasonSummary } from '../types';
import { emptyReport, flow, type SeasonContext } from './context';
import { resolveEnergy } from './energy';
import { applyEvent, mixedGridBonus } from './events';
import { feedAndGrow, scrapsAndHarmony } from './people';
import { generate, produce, producePowered, staff } from './production';
import { resolveWater } from './water';
import { resolveLake } from './lake';
import { resolveForest, washFields } from './forest';
import { assignCommutes } from './commute';
import { snapshot } from '../snapshot';
import {
  applyFormationYields,
  applyLoopBonuses,
  checkCombos,
  findFormations,
  formationEffects,
} from '../combos';
import { effectiveContent } from '../content/modifiers';
import { dealCharters } from '../draft';
import { cityRequest, eraGoal, eraGoalMet, goalMet, visionMet } from '../score';
import { unlockWonders, wonderBrief } from '../wonder';
import { finishProjects } from '../projects';
import { festivalThisSeason, updateWildlife, wildlifeHeals, wildlifeYields } from '../wildlife';

export interface ResolveOptions {
  /**
   * Forecast what a player can know: the season resolves without drawing
   * chance outcomes (the storm's target), which are reported as risks instead.
   */
  forecast?: boolean;
}

export function resolveSeason(
  base: Content,
  input: RunState,
  options: ResolveOptions = {},
): RunState {
  // Tunings and charters change the content for the rest of the run.
  const content = effectiveContent(base, input);
  const state: RunState = { ...snapshot(input), seasonStart: null, seasonCommands: [] };
  state.harmony = computeHarmony(content, state);
  const ctx: SeasonContext = {
    content,
    state,
    report: emptyReport(state),
    si: seasonIndex(state.season),
    active: new Set(),
    powered: new Set(),
    lowRiver: false,
    fog: false,
    wheelFlow: new Map(),
    foodProduced: 0,
    bonusGiven: new Set(),
    forecast: options.forecast ?? false,
    formations: [],
    effects: new Map(),
    demolitions: input.seasonCommands.filter((c) => c.type === 'demolish').length,
  };

  applyEvent(ctx); // 3
  ctx.formations = findFormations(content, state);
  ctx.effects = formationEffects(content, state, ctx.formations);
  staff(ctx);
  assignCommutes(ctx);
  resolveWater(ctx);
  resolveLake(ctx);
  resolveForest(ctx);
  generate(ctx); // 4
  mixedGridBonus(ctx);
  produce(ctx);
  resolveEnergy(ctx); // 5, 6, 7
  producePowered(ctx);
  applyLoopBonuses(ctx);
  applyFormationYields(ctx);
  wildlifeYields(ctx);
  washFields(ctx);
  wildlifeHeals(ctx);
  feedAndGrow(ctx); // 8
  scrapsAndHarmony(ctx); // 9
  checkCombos(ctx); // 10

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

  // The run's ledger, for the score and the Graft offer.
  const energy = { ...state.ledger.energy };
  for (const [source, amount] of Object.entries(bySource))
    energy[source] = (energy[source] ?? 0) + amount;
  const food = { ...(state.ledger.food ?? {}) };
  for (const [uid, y] of Object.entries(report.yields)) {
    const type = state.buildings[uid]?.type;
    if (type && (y.food ?? 0) > 0) food[type] = (food[type] ?? 0) + y.food!;
  }
  let industry = 0;
  for (const uid of Object.keys(report.runs)) industry += report.yields[uid]?.materials ?? 0;
  let heatLocal = 0;
  let heatTotal = 0;
  for (const slot of ['day', 'night'] as const) {
    const h = report.energy[slot].heat;
    heatLocal += h.free + h.neighbor;
    heatTotal += h.demand;
  }
  state.ledger = {
    energy,
    foodMade: state.ledger.foodMade + report.food.produced,
    food,
    foodEaten: state.ledger.foodEaten + report.food.eaten,
    citizenSeasons: state.ledger.citizenSeasons + state.citizens,
    industry: state.ledger.industry + industry,
    heatLocal: (state.ledger.heatLocal ?? 0) + heatLocal,
    heatTotal: (state.ledger.heatTotal ?? 0) + heatTotal,
  };

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
    energy: {
      day: {
        supply: report.energy.day.supply,
        demand: report.energy.day.demand,
        shortfall: report.energy.day.shortfall,
        bySource: { ...report.energy.day.bySource },
        discharged: report.energy.day.storageDischarged,
      },
      night: {
        supply: report.energy.night.supply,
        demand: report.energy.night.demand,
        shortfall: report.energy.night.shortfall,
        bySource: { ...report.energy.night.bySource },
        discharged: report.energy.night.storageDischarged,
      },
    },
  };
  state.history = [...state.history, summary];
  // Heat kept close is earned by homes that are never cold (the heat layer's score line).
  for (const uid of report.cold)
    if (!state.everCold.includes(uid)) state.everCold = [...state.everCold, uid];
  state.lastReport = report;
  // The last 4 seasons' reports: the last of each season, for the season report.
  state.recentReports = [...state.recentReports, report].slice(-4);
  state.spent = {};
  // The Harvest Festival's free reroll waits for a later draft.
  state.freeRerolls += festivalThisSeason(content, state)?.freeRerolls ?? 0;
  if (state.vision && state.visionAchieved === null && visionMet(content, state)) {
    state.visionAchieved = state.turn;
    report.visionAchieved = true;
  }
  // Projects whose last season this was are finished; their effect holds from next season.
  report.projectsDone = finishProjects(content, state);
  // Wonders whose last season of building this was are finished.
  for (const b of Object.values(state.buildings)) {
    const w = content.byId[b.type]?.wonder;
    if (w && b.finished === undefined && state.turn + 1 - b.builtTurn >= w.seasons) {
      b.finished = state.turn;
      report.wondersDone.push(b.type);
    }
  }
  // The expedition's city request, once met, stays met.
  const request = cityRequest(content, state);
  if (request && state.requestMet === null && goalMet(content, state, request.goal)) {
    state.requestMet = state.turn;
    report.requestMet = true;
  }
  // The era's goal, met by the end of any season in the era.
  const goal = eraGoal(content, state.era);
  if (goal && !state.eraGoalsMet.includes(state.era) && eraGoalMet(content, state, goal)) {
    state.eraGoalsMet = [...state.eraGoalsMet, state.era];
    state.stores.knowledge += goal.reward.knowledge;
    flow(report.flows, 'knowledge', 'made', 'Era goal met', goal.reward.knowledge);
    report.eraGoalMet = state.era;
  }

  // Storage: same-season stores empty, heat leaks.
  for (const b of Object.values(state.buildings)) {
    const s = defOf(content, b).storage;
    if (!s) continue;
    if (!s.carriesOver) b.stored = 0;
    else b.stored = Math.max(0, (b.stored ?? 0) - s.decayPerSeason);
  }
  // Storm damage lasts one season, unless storms need repairs (Wild Storms).
  if ((content.events.storm?.repairCost ?? 0) === 0) {
    for (const b of Object.values(state.buildings)) {
      if (b.damage?.cause === 'storm') delete b.damage;
    }
  }

  state.turn += 1;
  state.notices = [];
  for (const id of report.wondersDone) {
    const def = content.byId[id]!;
    const lift = def.wonder!.graftTiers;
    state.notices.push(
      `The ${def.name} is finished: +${def.wonder!.score} to the score${lift > 0 ? `, and the Graft ${lift > 1 ? `${lift} tiers` : 'a tier'} higher` : ''}`,
    );
  }
  const festival = report.festival && content.festivals.find((f) => f.id === report.festival!.id);
  if (festival && !report.festival!.lit)
    state.notices.push(
      `The lanterns went dark: a night ran short of energy, so ${festival.name} gave no wellbeing`,
    );
  if (state.wellbeing <= content.rules.wellbeing.min) {
    state.status = 'collapsed';
  } else if (state.turn >= content.rules.yearsPerRun * SEASONS.length) {
    state.status = 'complete';
  }
  state.year = Math.floor(state.turn / SEASONS.length) + 1;
  state.season = SEASONS[state.turn % SEASONS.length]!;
  state.era = eraOf(content, state.turn);

  const si = seasonIndex(state.season);
  state.forecast = { event: content.calendar[si]!, next: content.calendar[(si + 1) % 4]! };
  if (state.status === 'active') startSeason(content, state);
  else state.draft = { offer: [], picked: null, extraBought: false };
  state.harmony = computeHarmony(content, state);
  // Animals come, or leave, as the season starts.
  if (state.status === 'active') updateWildlife(content, state);
  state.seasonStart = snapshot(state);
  return state;
}

/**
 * Start-of-season upkeep: orchards mature, flood (and storm) damage is repaired, coppices
 * grow back, a beaver dam's reed beds spread, the draft is dealt.
 */
function startSeason(content: Content, state: RunState): void {
  for (const b of byPriority(state)) {
    const def = defOf(content, b);
    if (def.revertsAfterSeasons && state.turn - b.builtTurn >= def.revertsAfterSeasons) {
      delete state.buildings[b.uid];
      state.priority = state.priority.filter((id) => id !== b.uid);
      state.notices.push(
        `The ${def.name.toLowerCase()} has grown back into ${tileAt(state, b.at)!.type}`,
      );
      continue;
    }
    if (def.spawns && state.season === 'spring') spawn(content, state, b, def.spawns);
    if (def.matureTileBecomes && state.turn - b.builtTurn === def.maturesAfterSeasons) {
      if (plantTile(content, tileAt(state, b.at)!, def.matureTileBecomes)) {
        state.notices.push(`${def.name} matured and turned its tile to ${def.matureTileBecomes}`);
      }
    }
    const cost = repairCost(content, b);
    if (cost !== null && b.damage) {
      // Flood damage, and storm damage when storms need repairs: repaired once it can be paid
      // for, in priority order, unless the player put this building's repairs on hold.
      const event = b.damage.cause;
      if (b.holdRepairs) {
        state.notices.push(`${def.name} is ${event}-damaged: repairs are on hold`);
      } else if (state.stores.materials >= cost) {
        state.stores.materials -= cost;
        if (state.lastReport)
          flow(
            state.lastReport.flows,
            'materials',
            'used',
            event === 'flood' ? 'Flood repairs' : 'Storm repairs',
            cost,
            b.uid,
          );
        delete b.damage;
        state.notices.push(`Repaired ${def.name} after the ${event} for ${cost} materials`);
      } else {
        state.notices.push(`${def.name} is still ${event}-damaged: repairs need ${cost} materials`);
      }
    }
  }
  state.draft = { offer: dealOffer(content, state), picked: null, extraBought: false };
  // The first season of some eras offers a charter.
  const startsEra = state.turn % (content.rules.yearsPerEra * SEASONS.length) === 0;
  if (startsEra && content.rules.charterEras.includes(state.era)) {
    state.charterOffer = dealCharters(content, state);
  }
  // A wonder comes into reach at the start of its era.
  for (const id of unlockWonders(content, state)) {
    const def = content.byId[id]!;
    state.notices.push(`The ${def.name} can be built from now: ${wonderBrief(content, id)}`);
  }
}

/**
 * A building appears on a free tile next to the reservoir, nearest the one that brings it
 * first (the Beaver Dam's reed beds), up to its maximum.
 */
function spawn(
  content: Content,
  state: RunState,
  from: BuildingState,
  spawns: { building: string; max: number },
): void {
  if ((from.spawned ?? 0) >= spawns.max) return;
  const def = content.byId[spawns.building]!;
  const occ = occupancy(state);
  const site = Object.values(state.map.tiles)
    .filter(
      (t) =>
        def.placement.tiles.includes(t.type) &&
        !occ.has(hexKey(t)) &&
        hexNeighbors(t).some((n) => tileAt(state, n)?.type === 'reservoir'),
    )
    .sort((a, b) => hexDistance(a, from.at) - hexDistance(b, from.at) || a.r - b.r || a.q - b.q)[0];
  if (!site) return;
  const uid = `b${state.nextUid++}`;
  state.buildings[uid] = { uid, type: def.id, at: { q: site.q, r: site.r }, builtTurn: state.turn };
  state.priority.push(uid);
  from.spawned = (from.spawned ?? 0) + 1;
  state.notices.push(`A ${def.name.toLowerCase()} grew by the ${defOf(content, from).name}`);
}
