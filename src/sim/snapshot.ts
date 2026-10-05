import { copyFlows } from './season/context';
import type { BuildingState, MapState, RunState, SeasonSnapshot } from './types';

/**
 * Copying states. Commands never mutate their input, so every command works on
 * a copy. This is a hand-written deep copy (much faster than structuredClone
 * for many small objects); it lists every field, so TypeScript rejects it if a
 * field is added to the state and not copied here.
 *
 * Parts that are written once and then only replaced, never changed in place,
 * are shared between copies: `lastReport`, `recentReports`, `history`, `energyHistory`, `loops`, `ledger`, the
 * season-start snapshot, past commands, `options`, and the map's `river` and
 * `floodOrder` lists. Code must never mutate those in place.
 */
export function snapshot(state: SeasonSnapshot): SeasonSnapshot {
  const copy: SeasonSnapshot = {
    version: state.version,
    contentId: state.contentId,
    options: state.options,
    rng: { ...state.rng },
    turn: state.turn,
    year: state.year,
    season: state.season,
    era: state.era,
    status: state.status,
    map: copyMap(state.map),
    buildings: copyBuildings(state.buildings),
    nextUid: state.nextUid,
    unlocked: [...state.unlocked],
    stores: { ...state.stores },
    citizens: state.citizens,
    wellbeing: state.wellbeing,
    harmony: state.harmony,
    draft: { ...state.draft, offer: [...state.draft.offer] },
    forecast: { ...state.forecast },
    priority: [...state.priority],
    energyHistory: state.energyHistory,
    discoveries: [...state.discoveries],
    loops: state.loops,
    tunings: [...state.tunings],
    charters: [...state.charters],
    charterOffer: [...state.charterOffer],
    evolutionOffer: state.evolutionOffer.map((o) => ({ ...o, options: [...o.options] })),
    hedges: [...state.hedges],
    everCold: [...state.everCold],
    hints: [...state.hints],
    wildlife: [...state.wildlife],
    ...(state.lake ? { lake: { ...state.lake } } : {}),
    ...(state.heldOver !== undefined ? { heldOver: state.heldOver } : {}),
    festivals: { ...state.festivals },
    freeRerolls: state.freeRerolls,
    visionOffer: [...state.visionOffer],
    vision: state.vision,
    visionAchieved: state.visionAchieved,
    eraGoalsMet: [...state.eraGoalsMet],
    requestMet: state.requestMet,
    spent: copyFlows(state.spent),
    projects: state.projects.map((p) => ({ ...p })),
    recentReports: state.recentReports,
    ledger: state.ledger,
    notices: [...state.notices],
    lastReport: state.lastReport,
    history: state.history,
  };
  return copy;
}

function copyMap(map: MapState): MapState {
  const tiles: MapState['tiles'] = {};
  for (const key in map.tiles) tiles[key] = { ...map.tiles[key]! };
  return { ...map, tiles };
}

function copyBuildings(buildings: Record<string, BuildingState>): Record<string, BuildingState> {
  const out: Record<string, BuildingState> = {};
  for (const uid in buildings) {
    const b = buildings[uid]!;
    const c: BuildingState = { ...b, at: { ...b.at } };
    if (b.damage) c.damage = { ...b.damage };
    if (b.layers) c.layers = b.layers.map((l) => ({ ...l }));
    out[uid] = c;
  }
  return out;
}

/** A copy of a state that the caller may mutate (except the shared parts). */
export function cloneState(state: RunState): RunState {
  return {
    ...snapshot(state),
    seasonStart: state.seasonStart,
    seasonCommands: [...state.seasonCommands],
  };
}
