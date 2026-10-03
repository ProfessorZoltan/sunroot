/**
 * Test helpers: hand-drawn maps, scenario setup and terse commands.
 *
 * Maps are drawn as rows of tokens in odd-r offset layout (odd rows are
 * shifted half a hex right), one token per tile:
 *   ~ river   o reservoir   f floodplain   ^ hill   R ruin
 *   . barren  , scrub       m meadow       W woodland   C camp (on scrub)
 *   L lake (a reservoir off the river: still water, no river position)
 *   The Windswept Coast: = sea   _ mudflat   " saltmarsh   : dune
 */
import { expect } from 'vitest';
import {
  applyCommand,
  axialToOffset,
  computeHarmony,
  createRun,
  hexDistance,
  hexKey,
  offsetToAxial,
  SEASONS,
  type Command,
  type Content,
  type Hex,
  type MapState,
  type RunOptions,
  type RunState,
  type Season,
  type Tile,
  type TileType,
} from '../src/sim';
import willowReach from '../src/content/willow-reach.json';
import { loadBiome } from '../src/content';
import { available } from '../src/sim/water';
import { contentFor } from '../src/sim/content/modifiers';

export const content: Content = loadBiome(willowReach);

/**
 * Willow Reach with the water system on (EXPANSION.md), which the game keeps
 * off until water can be seen (E2). `campChannel` 0 starts the camp dry, so
 * a test lays every channel itself.
 */
export function withWater(
  changes: {
    campChannel?: number;
    /** Buildings beside the river or a lake draw straight from it (the alternative rule). */
    beside?: boolean;
    edit?: (raw: typeof willowReach) => void;
  } = {},
): Content {
  const raw = structuredClone(willowReach);
  raw.rules.water.enabled = true;
  if (changes.beside !== undefined) raw.rules.water.drawBesideRiver = changes.beside;
  if (changes.campChannel !== undefined) raw.rules.water.campChannel = changes.campChannel;
  changes.edit?.(raw);
  return loadBiome(raw);
}

const TOKENS: Record<string, TileType> = {
  '~': 'river',
  o: 'reservoir',
  f: 'floodplain',
  '^': 'hill',
  R: 'ruin',
  '.': 'barren',
  ',': 'scrub',
  m: 'meadow',
  W: 'woodland',
  C: 'scrub',
  L: 'reservoir',
  '=': 'sea',
  _: 'mudflat',
  '"': 'saltmarsh',
  ':': 'dune',
};

export function mapFromAscii(rows: string[]): { map: MapState; camp: Hex } {
  const tiles: Record<string, Tile> = {};
  let camp: Hex | undefined;
  const lakes = new Set<string>();
  rows.forEach((line, row) => {
    line
      .trim()
      .split(/\s+/)
      .forEach((token, col) => {
        const type = TOKENS[token];
        if (!type) throw new Error(`unknown map token ${token}`);
        const h = offsetToAxial(col, row);
        tiles[hexKey(h)] = { ...h, type, ...(type === 'ruin' ? { salvage: 24 } : {}) };
        if (token === 'C') camp = h;
        if (token === 'L') lakes.add(hexKey(h));
      });
  });
  if (!camp) throw new Error('map needs a C for the camp');
  const water = Object.values(tiles).filter(
    (t) => (t.type === 'river' || t.type === 'reservoir') && !lakes.has(hexKey(t)),
  );
  water.sort((a, b) => a.r - b.r || a.q - b.q);
  water.forEach((t, i) => (t.riverIndex = i));
  const riverDistance = (t: Tile) => Math.min(...water.map((w) => hexDistance(w, t)));
  // The Reach's flood reaches the floodplain; the coast's king tide the mudflat and saltmarsh.
  const floodOrder = Object.values(tiles)
    .filter((t) => t.type === 'floodplain' || t.type === 'mudflat' || t.type === 'saltmarsh')
    .sort((a, b) => riverDistance(a) - riverDistance(b) || a.r - b.r || a.q - b.q)
    .map(hexKey);
  const width = Math.max(...rows.map((r) => r.trim().split(/\s+/).length));
  return {
    map: { width, height: rows.length, tiles, river: water.map(hexKey), floodOrder },
    camp,
  };
}

/** Offset (col, row) to a hex, matching how maps are drawn. */
export function at(col: number, row: number): Hex {
  return offsetToAxial(col, row);
}

export interface ScenarioOptions {
  season?: Season;
  year?: number;
  unlockAll?: boolean;
  stores?: Partial<RunState['stores']>;
  citizens?: number;
  wellbeing?: number;
  seed?: string;
  /** Run options beyond the seed (Root City, the expedition, teaching). */
  run?: Omit<RunOptions, 'seed'>;
  /** Other content (the water system on, say); the commands below take it too. */
  content?: Content;
}

/** A run on a hand-drawn map, optionally moved to another season with everything unlocked. */
export function scenario(rows: string[], options: ScenarioOptions = {}): RunState {
  const { map, camp } = mapFromAscii(rows);
  const c = options.content ?? content;
  const state = createRun(c, { ...options.run, seed: options.seed ?? 'test' }, { map, camp });
  const year = options.year ?? 1;
  const season = options.season ?? 'spring';
  const si = SEASONS.indexOf(season);
  state.year = year;
  state.season = season;
  state.turn = (year - 1) * 4 + si;
  state.era = Math.min(4, Math.floor((year - 1) / 3) + 1);
  state.forecast = { event: c.calendar[si]!, next: c.calendar[(si + 1) % 4]! };
  if (options.unlockAll ?? true)
    state.unlocked = c.buildings
      .filter((b) => b.placeable && available(contentFor(c, state), b))
      .map((b) => b.id);
  state.draft = { offer: [], picked: null, extraBought: false };
  Object.assign(state.stores, { materials: 200 }, options.stores);
  if (options.citizens !== undefined) state.citizens = options.citizens;
  if (options.wellbeing !== undefined) state.wellbeing = options.wellbeing;
  state.harmony = computeHarmony(c, state);
  const { seasonStart: _s, seasonCommands: _c, ...rest } = state;
  state.seasonStart = structuredClone(rest);
  return state;
}

export function act(state: RunState, command: Command, c: Content = content): RunState {
  const result = applyCommand(c, state, command);
  if (!result.ok) throw new Error(`${command.type} failed: ${result.error}`);
  return result.state;
}

export function rejects(state: RunState, command: Command, c: Content = content): string {
  const result = applyCommand(c, state, command);
  expect(result.ok).toBe(false);
  return result.ok ? '' : result.error;
}

export function place(
  state: RunState,
  building: string,
  col: number,
  row: number,
  c: Content = content,
): RunState {
  return act(state, { type: 'place', building, at: at(col, row) }, c);
}

/**
 * Ends the season, picking the first blueprint on offer if needed. Tunings
 * and charters change rules, so rule tests never take one by accident: an
 * offer of only tunings, and any charter offer, are set aside.
 */
export function endSeason(state: RunState, c: Content = content): RunState {
  let s = state;
  if (s.draft.offer.length > 0 && s.draft.picked === null) {
    const blueprint = s.draft.offer.find((card) => c.byId[card]);
    if (blueprint) s = act(s, { type: 'pickCard', card: blueprint }, c);
    else s = { ...s, draft: { ...s.draft, offer: [] } };
  }
  if (s.charterOffer.length > 0) s = { ...s, charterOffer: [] };
  // A branching evolution takes its first choice; tests of branching choose for themselves.
  for (const o of s.evolutionOffer)
    s = act(s, { type: 'chooseEvolution', uid: o.uid, combo: o.options[0]! }, c);
  return act(s, { type: 'endSeason' }, c);
}

export function uidAt(state: RunState, col: number, row: number): string {
  const h = at(col, row);
  const b = Object.values(state.buildings).find((x) => x.at.q === h.q && x.at.r === h.r);
  if (!b) throw new Error(`no building at ${col},${row}`);
  return b.uid;
}

export function tileTypeAt(state: RunState, col: number, row: number): TileType | undefined {
  return state.map.tiles[hexKey(at(col, row))]?.type;
}

export { axialToOffset };
