/**
 * Combos (Milestone 6), the five layers of docs/DESIGN.md "Choices and combos":
 *
 * 1. Adjacency: the rules live on the buildings (apiary, composter, kiln,
 *    cottage); this module only notices when one is at work.
 * 2. Chains: a path of adjacent buildings that all worked this season closes
 *    a loop. From the next season on, each member makes +1 while it stands.
 * 3. Formations: hidden shapes (a ring, a line, a strip of land) whose effect
 *    lasts while the shape stands.
 * 4. Evolutions: a building becomes another because of its neighbours, at
 *    the end of the season (or, for a canopy over a farm, when it is built).
 * 5. Tunings and charters change the content itself (content/modifiers.ts).
 *
 * Step 10 of the season records every combo at work and the ones discovered
 * for the first time this run. Everything a combo needs is in the data.
 */
import type { Content } from './content/load';
import type { Combo } from './content/schema';
import {
  HEX_DIRECTIONS,
  axialToOffset,
  hexAdd,
  hexDistance,
  hexKey,
  hexNeighbors,
  type Hex,
} from './hex';
import { defOf, heightAt, neighborBuildings, neighborTiles, occupancy, tileAt } from './queries';
import { addYield, explain, type FormationEffect, type SeasonContext } from './season/context';
import type { BuildingState, ComboHit, RunState } from './types';
import { available, waterOn } from './water';
import { edgeTiles, hedgeRuns } from './edges';

type ComboOf<L extends Combo['layer']> = Extract<Combo, { layer: L }>;

/** The combos of a layer in play this run (Willow Reach v2's need water). */
const combosOf = <L extends Combo['layer']>(content: Content, layer: L): ComboOf<L>[] =>
  content.combos.filter(
    (c): c is ComboOf<L> => c.layer === layer && (!c.requiresWater || waterOn(content)),
  );

/** Does `b` touch enough of the given buildings or tiles? */
function touches(
  state: RunState,
  b: BuildingState,
  nextTo: { buildings?: string[]; tiles?: string[]; count: number },
  occ = occupancy(state),
): boolean {
  let n = 0;
  if (nextTo.buildings) {
    n += neighborBuildings(state, b, occ).filter((x) => nextTo.buildings!.includes(x.type)).length;
  }
  if (nextTo.tiles) {
    n += neighborTiles(state, b.at).filter((t) => nextTo.tiles!.includes(t.type)).length;
  }
  return n >= nextTo.count;
}

// ------------------------------------------------------------------ formations

/** Every formation standing in the state, with its member buildings (or tiles). */
export function findFormations(
  content: Content,
  state: RunState,
  only: ComboOf<'formation'>[] = combosOf(content, 'formation'),
): ComboHit[] {
  const hits: ComboHit[] = [];
  const occ = occupancy(state);
  for (const combo of only) {
    const shape = combo.shape;
    if (shape.kind === 'ring') {
      for (const b of Object.values(state.buildings)) {
        if (b.type !== shape.center || b.damage) continue;
        const ring = hexNeighbors(b.at)
          .map((h) => occ.get(hexKey(h)))
          .filter((x): x is BuildingState => x !== undefined)
          .filter((x) => !shape.of || shape.of.includes(x.type));
        if (ring.length >= shape.size && new Set(ring.map((x) => x.type)).size >= shape.minTypes) {
          hits.push({ combo: combo.id, members: [b.uid, ...ring.map((x) => x.uid)] });
        }
      }
    } else if (shape.kind === 'line') {
      const seen = new Set<string>();
      for (const b of Object.values(state.buildings)) {
        if (b.type !== shape.sequence[0]) continue;
        for (const dir of HEX_DIRECTIONS) {
          const members: BuildingState[] = [];
          let at: Hex = b.at;
          for (const type of shape.sequence) {
            const x = occ.get(hexKey(at));
            if (!x || x.type !== type) break;
            if (shape.tiles && !shape.tiles.includes(tileAt(state, at)!.type)) break;
            const h = heightAt(state, at);
            if (shape.minHeight !== undefined && h < shape.minHeight) break;
            const prev = members.at(-1);
            if (shape.rising && prev && h !== heightAt(state, prev.at) + 1) break;
            members.push(x);
            at = hexAdd(at, dir);
          }
          if (members.length !== shape.sequence.length) continue;
          const key = members
            .map((m) => m.uid)
            .sort()
            .join(',');
          if (seen.has(key)) continue; // the same line found from its other end
          seen.add(key);
          hits.push({ combo: combo.id, members: members.map((m) => m.uid) });
        }
      }
    } else if (shape.kind === 'cluster') {
      // One of each type, every one touching every other, found from each of the first type.
      const seen = new Set<string>();
      for (const b of Object.values(state.buildings)) {
        if (b.type !== shape.buildings[0]) continue;
        const pick = (chosen: BuildingState[]): BuildingState[] | null => {
          if (chosen.length === shape.buildings.length) return chosen;
          const type = shape.buildings[chosen.length]!;
          const options = neighborBuildings(state, chosen[0]!, occ).filter(
            (x) =>
              x.type === type &&
              !chosen.includes(x) &&
              chosen.every((c) => hexNeighbors(c.at).some((h) => hexKey(h) === hexKey(x.at))),
          );
          for (const x of options) {
            const found = pick([...chosen, x]);
            if (found) return found;
          }
          return null;
        };
        const members = pick([b]);
        if (!members) continue;
        const key = members
          .map((m) => m.uid)
          .sort()
          .join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        hits.push({ combo: combo.id, members: members.map((m) => m.uid) });
      }
    } else if (shape.kind === 'hedgeRun') {
      for (const run of hedgeRuns(state))
        if (run.length >= shape.length) hits.push({ combo: combo.id, members: [], edges: run });
    } else {
      const strip = findStrip(state, shape.tiles, shape.gaps);
      if (strip) hits.push({ combo: combo.id, members: [], tiles: strip });
    }
  }
  return hits;
}

/**
 * An unbroken strip of the given tiles from a tile touching the river to a
 * side edge of the valley (the first or last tile of a row), crossing at most
 * `gaps` land tiles of other kinds. Returns the strip's tile keys, the fewest
 * gaps first and then the shortest, or null.
 */
function findStrip(state: RunState, types: readonly string[], gaps = 0): string[] | null {
  const tiles = state.map.tiles;
  const rows = new Map<number, { min: number; max: number }>();
  for (const t of Object.values(tiles)) {
    const { col, row } = axialToOffset(t);
    const r = rows.get(row) ?? { min: col, max: col };
    rows.set(row, { min: Math.min(r.min, col), max: Math.max(r.max, col) });
  }
  const isEdge = (h: Hex) => {
    const { col, row } = axialToOffset(h);
    const r = rows.get(row)!;
    return col === r.min || col === r.max;
  };
  const WATER = ['river', 'reservoir', 'oasis'];
  /** 0 for a strip tile, 1 for a gap (other land), null if it can't be crossed. */
  const step = (key: string): number | null => {
    const type = tiles[key]?.type;
    if (type === undefined || WATER.includes(type)) return null;
    return types.includes(type) ? 0 : 1;
  };
  const byRiver = (h: Hex) =>
    hexNeighbors(h).some((n) => WATER.includes(tiles[hexKey(n)]?.type ?? ''));
  // Breadth-first over (tile, gaps used), finishing each count of gaps before the next.
  const id = (key: string, used: number) => `${key}|${used}`;
  const from = new Map<string, string | null>();
  const layers: string[][] = Array.from({ length: gaps + 1 }, () => []);
  for (const [key, t] of Object.entries(tiles)) {
    const cost = step(key);
    if (cost === null || cost > gaps || !byRiver(t)) continue;
    from.set(id(key, cost), null);
    layers[cost]!.push(key);
  }
  for (let used = 0; used <= gaps; used++) {
    const queue = layers[used]!;
    for (let i = 0; i < queue.length; i++) {
      const key = queue[i]!;
      if (isEdge(tiles[key]!)) {
        const path: string[] = [];
        for (let k: string | null = id(key, used); k !== null; k = from.get(k)!)
          path.unshift(k.split('|')[0]!);
        return path;
      }
      for (const n of hexNeighbors(tiles[key]!)) {
        const nk = hexKey(n);
        const cost = step(nk);
        if (cost === null || used + cost > gaps || from.has(id(nk, used + cost))) continue;
        from.set(id(nk, used + cost), id(key, used));
        layers[used + cost]!.push(nk);
      }
    }
  }
  return null;
}

/** What the standing formations do to their member buildings. */
export function formationEffects(
  content: Content,
  state: RunState,
  hits: ComboHit[],
): Map<string, FormationEffect> {
  const effects = new Map<string, FormationEffect>();
  for (const hit of hits) {
    const combo = content.comboById[hit.combo] as ComboOf<'formation'>;
    const e = combo.effect;
    if (!e.generation && !e.ignoresShade && !e.freeRuns && e.outputMultiplier === 1) continue;
    for (const uid of hit.members) {
      if (e.appliesTo && state.buildings[uid]?.type !== e.appliesTo) continue;
      const cur = effects.get(uid) ?? {
        generation: 0,
        ignoresShade: false,
        freeRuns: false,
        outputMultiplier: 1,
      };
      effects.set(uid, {
        // A building in two terraces still gets the bonus once.
        generation: Math.max(cur.generation, e.generation),
        ignoresShade: cur.ignoresShade || e.ignoresShade,
        freeRuns: cur.freeRuns || e.freeRuns,
        outputMultiplier: Math.max(cur.outputMultiplier, e.outputMultiplier),
      });
    }
  }
  return effects;
}

/** Harmony from standing formations (the Wildway), for the Harmony breakdown. */
export function formationHarmony(
  content: Content,
  state: RunState,
): { label: string; amount: number }[] {
  const harmonic = combosOf(content, 'formation').filter((c) => c.effect.harmony !== 0);
  if (harmonic.length === 0) return [];
  const hits = findFormations(content, state, harmonic);
  return harmonic
    .filter((c) => hits.some((h) => h.combo === c.id))
    .map((c) => ({ label: c.name, amount: c.effect.harmony }));
}

/** Wellbeing from standing formations (the Village Green), one line each. */
export function formationWellbeing(ctx: SeasonContext): { reason: string; amount: number }[] {
  return ctx.formations
    .map((h) => ctx.content.comboById[h.combo] as ComboOf<'formation'>)
    .filter((c) => c.effect.wellbeing !== 0 && c.effect.seasons[ctx.si])
    .map((c) => ({ reason: c.name, amount: c.effect.wellbeing }));
}

/** Flat extra yields from standing formations (the Water Ladder's food), once per member. */
export function applyFormationYields(ctx: SeasonContext): void {
  const given = new Set<string>();
  for (const hit of ctx.formations) {
    const combo = ctx.content.comboById[hit.combo] as ComboOf<'formation'>;
    const e = combo.effect;
    for (const uid of hit.members) {
      const b = ctx.state.buildings[uid];
      if (!b || (e.appliesTo && b.type !== e.appliesTo)) continue;
      for (const [res, n] of Object.entries(e.yields) as [keyof typeof e.yields, number][]) {
        const key = `${uid}:${combo.id}:${res}`;
        if (given.has(key) || (ctx.report.yields[uid]?.[res] ?? 0) <= 0) continue;
        given.add(key);
        addYield(ctx, b, res, n, combo.name);
        explain(ctx, b, `+${n} ${res} from the ${combo.name}`);
      }
    }
  }
}

/** Buildings whose Harmony penalty a standing formation cancels (the Ridge Spires). */
export function quietedByFormations(content: Content, state: RunState): Set<string> {
  const quiet = combosOf(content, 'formation').filter((c) => c.effect.quiet);
  if (quiet.length === 0) return new Set();
  return new Set(findFormations(content, state, quiet).flatMap((h) => h.members));
}

/** Is the building within a sheltering formation's reach (the Windbreak)? */
export function shelteredByFormation(content: Content, state: RunState, b: BuildingState): boolean {
  const shelters = combosOf(content, 'formation').filter((c) => c.effect.shelterRadius > 0);
  if (shelters.length === 0) return false;
  for (const hit of findFormations(content, state, shelters)) {
    const radius = (content.comboById[hit.combo] as ComboOf<'formation'>).effect.shelterRadius;
    // Its buildings, or for a run of hedges the tiles along it.
    const at = [
      ...hit.members.map((uid) => state.buildings[uid]!.at),
      ...(hit.edges ?? []).flatMap(edgeTiles),
    ];
    if (at.some((h) => hexDistance(h, b.at) <= radius)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------- chains

/** Did this building do its work this season? */
function worked(ctx: SeasonContext, b: BuildingState): boolean {
  if (!ctx.active.has(b.uid)) return false;
  const y = ctx.report.yields[b.uid];
  if (y && Object.values(y).some((n) => (n ?? 0) > 0)) return true;
  if ((ctx.report.runs[b.uid]?.runs ?? 0) > 0) return true;
  const g = ctx.report.generated[b.uid];
  if (g !== undefined && g.energy.day + g.energy.night > 0) return true;
  // A kiln or heat well that warmed a neighbour (the Bath Loop) did its work too.
  return ctx.report.neighborHeat.some((l) => l.from === b.uid);
}

/** Loops that ran this season: every complete path through the chain's links. */
function runningLoops(ctx: SeasonContext): ComboHit[] {
  const { state } = ctx;
  const occ = occupancy(state);
  const hits: ComboHit[] = [];
  for (const combo of combosOf(ctx.content, 'chain')) {
    const fits = (b: BuildingState, i: number, prev?: BuildingState) => {
      const link = combo.links[i]!;
      if (!link.buildings.includes(b.type)) return false;
      if (link.slot && (b.slot ?? defOf(ctx.content, b).digester?.defaultSlot) !== link.slot)
        return false;
      if (
        link.heatFrom &&
        !ctx.report.neighborHeat.some((l) => l.to === b.uid && l.from === prev?.uid)
      )
        return false;
      if (link.cleaned && (ctx.report.water?.cleaned[b.uid] ?? 0) <= 0) return false;
      if (link.gotWater && (ctx.report.water?.uses[b.uid]?.got[link.gotWater] ?? 0) <= 0)
        return false;
      if (link.powered && !ctx.powered.has(b.uid)) return false;
      if (link.standing && !ctx.active.has(b.uid)) return false;
      // A bathhouse, reed bed or desalinator makes nothing a chain counts; its condition is its work.
      return worked(ctx, b) || link.heatFrom || link.cleaned || link.powered || link.standing;
    };
    for (const anchor of Object.values(state.buildings)) {
      if (!fits(anchor, 0)) continue;
      const members = new Set<string>();
      const walk = (b: BuildingState, i: number, path: string[]) => {
        if (i === combo.links.length - 1) {
          path.forEach((uid) => members.add(uid));
          return;
        }
        for (const n of neighborBuildings(state, b, occ)) {
          if (!path.includes(n.uid) && fits(n, i + 1, b)) walk(n, i + 1, [...path, n.uid]);
        }
      };
      walk(anchor, 0, [anchor.uid]);
      if (members.size > 0) hits.push({ combo: combo.id, members: [...members] });
    }
  }
  return hits;
}

/** Closed loops whose members all still stand as types of the chain. */
function standingLoops(content: Content, state: RunState) {
  return state.loops.filter((loop) => {
    const combo = content.comboById[loop.combo] as ComboOf<'chain'> | undefined;
    if (!combo) return false;
    const types = new Set(combo.links.flatMap((l) => l.buildings));
    return loop.members.every((uid) => types.has(state.buildings[uid]?.type ?? ''));
  });
}

/** Harmony from closed loops still standing (the Meltwater Loop), once per chain. */
export function loopHarmony(
  content: Content,
  state: RunState,
): { label: string; amount: number }[] {
  const ids = new Set(standingLoops(content, state).map((l) => l.combo));
  return [...ids]
    .map((id) => content.comboById[id] as ComboOf<'chain'>)
    .filter((c) => c.harmony !== 0)
    .map((c) => ({ label: c.name, amount: c.harmony }));
}

/** How much more a pump station lifts in a closed loop (the Meltwater Loop). */
export function loopLift(content: Content, state: RunState, uid: string): number {
  let lift = 0;
  for (const loop of standingLoops(content, state)) {
    if (!loop.members.includes(uid)) continue;
    lift = Math.max(lift, (content.comboById[loop.combo] as ComboOf<'chain'>).liftBonus);
  }
  return lift;
}

/**
 * Closed loops pay their bonus: +bonus to the first resource in the chain's
 * order that each member made this season. Only for loops closed in an
 * earlier season, and only while every member still has a type in the chain.
 */
export function applyLoopBonuses(ctx: SeasonContext): void {
  const { content, state } = ctx;
  for (const loop of state.loops) {
    if (loop.turn >= state.turn) continue;
    const combo = content.comboById[loop.combo] as ComboOf<'chain'> | undefined;
    if (!combo) continue;
    const types = new Set(combo.links.flatMap((l) => l.buildings));
    const standing = loop.members.every((uid) => types.has(state.buildings[uid]?.type ?? ''));
    if (!standing) continue;
    for (const uid of loop.members) {
      const b = state.buildings[uid]!;
      const made = ctx.report.yields[uid] ?? {};
      const res = combo.bonusOrder.find((r) => (made[r] ?? 0) > 0);
      if (!res) continue;
      addYield(ctx, b, res, combo.bonus, `${combo.name} bonus`);
      explain(ctx, b, `+${combo.bonus} ${res} from the ${combo.name}`);
    }
  }
}

// ------------------------------------------------------------------ evolutions

/** Is the building an evolution leads to in this run (Willow Reach v2's forms need water)? */
const reachable = (content: Content, combo: ComboOf<'evolution'>) =>
  available(content, content.byId[combo.into]!);

/** The evolution a building would undergo if `building` were placed on it (a canopy over a farm). */
export function placementEvolution(
  content: Content,
  building: string,
  target: BuildingState | undefined,
): ComboOf<'evolution'> | undefined {
  if (!target) return undefined;
  return combosOf(content, 'evolution').find(
    (c) =>
      c.when.kind === 'placed' &&
      c.when.building === building &&
      c.from === target.type &&
      reachable(content, c),
  );
}

/** The evolutions a building meets at the end of this season; two or more make a choice. */
export function evolutionsReady(
  content: Content,
  state: RunState,
  b: BuildingState,
  occ = occupancy(state),
): ComboOf<'evolution'>[] {
  return combosOf(content, 'evolution').filter((combo) => {
    const when = combo.when;
    if (combo.from !== b.type || !reachable(content, combo)) return false;
    if (when.kind === 'nextTo') {
      return (
        touches(state, b, when.nextTo, occ) &&
        (!when.also || touches(state, b, when.also, occ)) &&
        (when.minHarmony === undefined || state.harmony >= when.minHarmony)
      );
    }
    if (when.kind === 'ruinExhausted') {
      return (
        (tileAt(state, b.at)?.salvage ?? 1) <= 0 &&
        (!when.nextTo || touches(state, b, when.nextTo, occ))
      );
    }
    return false;
  });
}

/** The coppice action (Coppice Wood), if this run has it. */
export function coppiceCombo(content: Content): ComboOf<'evolution'> | undefined {
  return combosOf(content, 'evolution').find(
    (c) => c.when.kind === 'coppiced' && reachable(content, c),
  );
}

/** Why this tile can't be coppiced, or null if it can. */
export function coppiceProblem(content: Content, state: RunState, at: Hex): string | null {
  const combo = coppiceCombo(content);
  if (!combo || combo.when.kind !== 'coppiced') return 'coppicing needs the water system';
  const tile = tileAt(state, at);
  if (!tile) return 'outside the valley';
  if (tile.type !== combo.from) return `only ${combo.from} can be coppiced`;
  if (occupancy(state).has(hexKey(at))) return 'tile already has a building';
  const nextTo = combo.when.nextTo;
  if (!touches(state, { uid: '', type: '', at, builtTurn: 0 }, nextTo)) {
    const names = (nextTo.buildings ?? []).map((id) => content.byId[id]?.name ?? id);
    return `coppicing needs a ${names.join(' or ')} next to it`;
  }
  return null;
}

/** Turns a building into its evolved form, keeping its place in every list. */
export function evolve(state: RunState, b: BuildingState, into: string): void {
  b.evolvedFrom = b.type;
  b.evolvedTurn = state.turn;
  b.type = into;
  delete b.recipe;
  delete b.slot;
}

/**
 * Each building that meets one evolution takes it. One that meets two (a branch) waits on
 * the evolution offer until the player picks; there is no declining (DECISIONS.md).
 */
function evolveAtSeasonEnd(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const occ = occupancy(state);
  for (const b of Object.values(state.buildings)) {
    if (state.evolutionOffer.some((o) => o.uid === b.uid)) continue;
    const ready = evolutionsReady(content, state, b, occ);
    if (ready.length === 1) {
      const combo = ready[0]!;
      evolve(state, b, combo.into);
      report.evolved.push({ uid: b.uid, from: combo.from, into: combo.into });
    } else if (ready.length > 1) {
      state.evolutionOffer = [
        ...state.evolutionOffer,
        { uid: b.uid, options: ready.map((c) => c.id) },
      ];
    }
  }
}

// --------------------------------------------------------------------- step 10

/**
 * Step 10: evolutions happen, then every combo at work this season is
 * recorded, loops that ran are closed, and first discoveries are noted.
 */
export function checkCombos(ctx: SeasonContext): void {
  const { content, state, report, si } = ctx;
  evolveAtSeasonEnd(ctx);
  const occ = occupancy(state);
  const hits: ComboHit[] = [];

  for (const combo of combosOf(content, 'adjacency')) {
    if (!combo.seasons[si]) continue;
    for (const b of Object.values(state.buildings)) {
      if (b.type !== combo.building || !ctx.active.has(b.uid)) continue;
      if (!touches(state, b, combo.nextTo, occ)) continue;
      const neighbors = neighborBuildings(state, b, occ);
      if (neighbors.some((n) => combo.notNextTo.includes(n.type))) continue;
      const partners = neighbors.filter((n) => combo.nextTo.buildings?.includes(n.type));
      hits.push({ combo: combo.id, members: [b.uid, ...partners.map((n) => n.uid)] });
    }
  }

  const loops = runningLoops(ctx);
  hits.push(...loops);
  let recorded = state.loops;
  for (const hit of loops) {
    const anchor = hit.members[0]!;
    const known = recorded.find((l) => l.combo === hit.combo && l.anchor === anchor);
    if (!known) {
      recorded = [
        ...recorded,
        { combo: hit.combo, anchor, members: hit.members, turn: state.turn },
      ];
    } else if (hit.members.some((m) => !known.members.includes(m))) {
      // New members join a loop that is already closed; their bonus starts next season.
      const members = [...known.members, ...hit.members.filter((m) => !known.members.includes(m))];
      recorded = recorded.map((l) => (l === known ? { ...l, members } : l));
    }
  }
  state.loops = recorded;

  hits.push(...ctx.formations);
  for (const combo of combosOf(content, 'evolution')) {
    for (const b of Object.values(state.buildings)) {
      if (b.type === combo.into && b.evolvedTurn === state.turn && b.evolvedFrom === combo.from) {
        hits.push({ combo: combo.id, members: [b.uid] });
      }
    }
  }

  report.combos = hits;
  for (const hit of hits) {
    if (state.discoveries.includes(hit.combo) || report.discoveries.includes(hit.combo)) continue;
    report.discoveries.push(hit.combo);
  }
  state.discoveries = [...state.discoveries, ...report.discoveries];
}

/** Can a hint be bought for this combo? Adjacency and chain hints are free; hidden layers cost knowledge. */
export function hintable(content: Content, state: RunState, comboId: string): string | null {
  const combo = content.comboById[comboId];
  if (!combo) return `unknown combo ${comboId}`;
  if (combo.layer !== 'formation' && combo.layer !== 'evolution') {
    return `${combo.layer} hints are free in the Almanac`;
  }
  if (state.discoveries.includes(comboId)) return 'already discovered';
  if (state.hints.includes(comboId)) return 'already hinted';
  return null;
}
