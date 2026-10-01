import type { Content } from './content/load';
import { RESOURCES, SEASONS } from './content/schema';
import { dealOffer } from './draft';
import { generateMap } from './map';
import { computeHarmony } from './queries';
import { createRng, shuffled } from './rng';
import { snapshot } from './snapshot';
import type { MapState, RunOptions, RunState, Stores } from './types';
import type { Hex } from './hex';

export interface CreateRunOverrides {
  /** Use this map instead of generating one (tests and hand-made scenarios). */
  map?: MapState;
  camp?: Hex;
}

/** Starts a Sprout: the map, the Founders' Camp, the starting stores and the first draft. */
export function createRun(
  content: Content,
  options: RunOptions,
  overrides: CreateRunOverrides = {},
): RunState {
  const opts: Required<RunOptions> = {
    seed: options.seed,
    guided: options.guided ?? false,
    sandbox: options.sandbox ?? false,
    visions: options.visions ?? false,
  };
  const generated = overrides.map ? null : generateMap(content, opts.seed);
  const map = overrides.map ?? generated!.map;
  const camp = overrides.camp ?? generated?.camp;
  if (!camp) throw new Error('a custom map needs a camp position');

  const stores = Object.fromEntries(RESOURCES.map((r) => [r, 0])) as Stores;
  stores.materials = content.rules.start.materials;
  stores.food = content.rules.start.food;

  const state: RunState = {
    version: 2,
    contentId: content.id,
    options: opts,
    rng: createRng(`${opts.seed}:run`),
    turn: 0,
    year: 1,
    season: SEASONS[0],
    era: 1,
    status: 'active',
    map: structuredClone(map),
    buildings: {
      b0: { uid: 'b0', type: content.campBuilding, at: { q: camp.q, r: camp.r }, builtTurn: 0 },
    },
    nextUid: 1,
    unlocked: content.buildings.filter((b) => b.starter).map((b) => b.id),
    stores,
    citizens: content.rules.start.citizens,
    wellbeing: content.rules.start.wellbeing,
    harmony: 0,
    draft: { offer: [], picked: null, extraBought: false },
    forecast: { event: content.calendar[0], next: content.calendar[1] },
    priority: ['b0'],
    energyHistory: [],
    discoveries: [],
    loops: [],
    tunings: [],
    charters: [],
    charterOffer: [],
    hints: [],
    // Visions draw from their own stream, so turning them on never changes the run itself.
    visionOffer: opts.visions
      ? shuffled(
          createRng(`${opts.seed}:visions`),
          content.visions.map((v) => v.id),
        ).slice(0, content.rules.visionChoices)
      : [],
    vision: null,
    visionAchieved: null,
    eraGoalsMet: [],
    ledger: { energy: {}, foodMade: 0, foodEaten: 0, citizenSeasons: 0, industry: 0 },
    notices: [],
    lastReport: null,
    history: [],
    seasonStart: null,
    seasonCommands: [],
  };
  if (opts.sandbox) {
    state.unlocked = content.buildings.filter((b) => b.placeable).map((b) => b.id);
    state.stores.materials = 999;
  }
  state.harmony = computeHarmony(content, state);
  state.draft.offer = dealOffer(content, state);
  state.seasonStart = snapshot(state);
  return state;
}
