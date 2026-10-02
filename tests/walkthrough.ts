/**
 * The Year 1 walkthrough from docs/DESIGN.md, played up to winter's build.
 * Shared by the golden test and by tests that compare other winter choices.
 */
import { expect } from 'vitest';
import {
  applyCommand,
  canPlace,
  createRun,
  hexDistance,
  hexKey,
  hexNeighbors,
  loadContent,
  type Command,
  type Content,
  type Hex,
  type RunState,
} from '../src/sim';
import willowReach from '../src/content/willow-reach.json';

export const content: Content = loadContent(willowReach);
export const GOLDEN_SEED = 'willow-reach-golden';

export function act(state: RunState, command: Command, c: Content = content): RunState {
  const result = applyCommand(c, state, command);
  if (!result.ok) throw new Error(`${command.type} failed: ${result.error}`);
  return result.state;
}

export function place(state: RunState, building: string, at: Hex, c: Content = content): RunState {
  return act(state, { type: 'place', building, at }, c);
}

export function buildingAt(state: RunState, at: Hex) {
  const found = Object.values(state.buildings).find((b) => hexKey(b.at) === hexKey(at));
  if (!found) throw new Error(`no building at ${hexKey(at)}`);
  return found;
}

export interface Sites {
  ruin: Hex;
  farm1: Hex;
  farm2: Hex;
  composter: Hex;
  workshop: Hex;
  solar: Hex;
  cottage: Hex;
  orchard: Hex;
  wheel: Hex;
  cellBank: Hex;
}

/** Choose tiles the way a sensible first-time player would. */
export function findSites(state: RunState, c: Content = content): Sites {
  const tiles = Object.values(state.map.tiles);
  const used = new Set<string>();
  const occupied = new Set(Object.values(state.buildings).map((b) => hexKey(b.at)));
  const typeAt = (h: Hex) => state.map.tiles[hexKey(h)]?.type;
  const free = (h: Hex) => !used.has(hexKey(h)) && !occupied.has(hexKey(h));
  const take = (h: Hex | undefined, what: string): Hex => {
    if (!h) throw new Error(`golden map has no site for ${what}`);
    used.add(hexKey(h));
    return h;
  };
  const dry = (h: Hex) => typeAt(h) !== 'floodplain';
  const ok = (building: string, h: Hex) => free(h) && canPlace(c, state, building, h).ok;

  const ruin = take(
    tiles.find((t) => ok('salvageYard', t)),
    'salvage yard',
  );

  // A dry composter site with two free floodplain neighbours for the farms.
  let farm1: Hex | undefined;
  let farm2: Hex | undefined;
  const composter = take(
    tiles.find((t) => {
      if (!dry(t) || !ok('composter', t)) return false;
      const fields = hexNeighbors(t).filter(
        (n) => typeAt(n) === 'floodplain' && ok('floodplainFarm', n),
      );
      if (fields.length < 2) return false;
      [farm1, farm2] = fields;
      return true;
    }),
    'composter',
  );
  take(farm1, 'farm 1');
  take(farm2, 'farm 2');

  const shaded = (h: Hex) =>
    hexNeighbors(h).some((n) => state.map.tiles[hexKey(n)]?.type === 'woodland');
  const solar = take(
    tiles.find((t) => dry(t) && ok('solarCanopy', t) && !shaded(t)),
    'solar canopy',
  );
  const workshop = take(
    tiles.find((t) => dry(t) && ok('workshop', t)),
    'workshop',
  );
  const cottage = take(
    tiles.find((t) => dry(t) && ok('cottage', t)),
    'cottage',
  );
  const orchard = take(
    tiles.find((t) => ok('orchard', t) && hexDistance(t, composter) > 1),
    'orchard',
  );
  const wheel = take(
    tiles.find((t) => dry(t) && ok('riverWheel', t)),
    'river wheel',
  );
  const cellBank = take(
    tiles.find((t) => dry(t) && ok('cellBank', t)),
    'cell bank',
  );
  return {
    ruin,
    farm1: farm1!,
    farm2: farm2!,
    composter,
    workshop,
    solar,
    cottage,
    orchard,
    wheel,
    cellBank,
  };
}

export function totals(state: RunState) {
  return {
    materials: state.stores.materials,
    food: state.stores.food,
    citizens: state.citizens,
  };
}

/** Plays spring to autumn of the walkthrough and returns the state before winter's build. */
export function playToWinter() {
  let state = createRun(content, { seed: GOLDEN_SEED, guided: true });
  const sites = findSites(state);

  // Starting state from the design doc.
  expect(totals(state)).toEqual({ materials: 20, food: 12, citizens: 6 });
  expect(state.harmony).toBe(18);
  expect(state.forecast.event).toBe('flood');

  // --- Spring ---
  expect(state.draft.offer).toContain('orchard');
  state = act(state, { type: 'pickCard', card: 'orchard' });
  state = place(state, 'floodplainFarm', sites.farm1);
  state = place(state, 'salvageYard', sites.ruin);
  state = place(state, 'workshop', sites.workshop);
  state = place(state, 'solarCanopy', sites.solar);
  state = act(state, { type: 'endSeason' });
  const spring = state.lastReport!;
  expect(totals(state)).toEqual({ materials: 11, food: 8, citizens: 6 });
  // Solar powers the first workshop run (on Auto, salvage comes first); the flood leaves silt.
  const workshop = buildingAt(state, sites.workshop);
  expect(spring.runs[workshop.uid]).toEqual({
    recipe: 'auto',
    runs: 1,
    energy: { day: 2, night: 0 },
    byRecipe: { salvage: 1 },
  });
  expect(spring.energy.day.bySource.solarCanopy).toBe(3);
  expect(buildingAt(state, sites.farm1).siltYear).toBe(1);

  // --- Summer ---
  state = act(state, { type: 'pickCard', card: state.draft.offer[0]! });
  state = place(state, 'floodplainFarm', sites.farm2);
  state = place(state, 'cottage', sites.cottage);
  state = act(state, { type: 'endSeason' });
  const summer = state.lastReport!;
  expect(totals(state)).toEqual({ materials: 12, food: 12, citizens: 7 });
  // The silt-boosted farm makes 6 food; 2 clutter appears from scraps.
  expect(summer.yields[buildingAt(state, sites.farm1).uid]?.food).toBe(6);
  expect(summer.clutter.fromScraps).toBe(2);
  expect(state.stores.clutter).toBe(2);

  // --- Autumn ---
  state = act(state, { type: 'pickCard', card: state.draft.offer[0]! });
  state = place(state, 'composter', sites.composter);
  state = place(state, 'orchard', sites.orchard);
  state = act(state, { type: 'endSeason' });
  const autumn = state.lastReport!;
  expect(totals(state)).toEqual({ materials: 10, food: 19, citizens: 8 });
  // The kitchen loop closes: +2 food, clutter stops growing.
  expect(autumn.bonuses.compost).toBe(2);
  expect(autumn.clutter.fromScraps).toBe(0);
  expect(state.stores.clutter).toBe(2);

  expect(state.forecast.event).toBe('freeze');
  expect(state.draft.offer).toEqual(expect.arrayContaining(['riverWheel', 'cellBank']));
  return { state, sites };
}
