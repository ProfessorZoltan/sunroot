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
import { HEX_DIRECTIONS, axialToOffset, hexAdd, hexKey, hexNeighbors, type Hex } from './hex';
import { defOf, neighborBuildings, neighborTiles, occupancy, tileAt } from './queries';
import { addYield, explain, type FormationEffect, type SeasonContext } from './season/context';
import type { BuildingState, ComboHit, RunState } from './types';

type ComboOf<L extends Combo['layer']> = Extract<Combo, { layer: L }>;

const combosOf = <L extends Combo['layer']>(content: Content, layer: L): ComboOf<L>[] =>
  content.combos.filter((c): c is ComboOf<L> => c.layer === layer);

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
          .filter((x): x is BuildingState => x !== undefined);
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
    } else {
      const strip = findStrip(state, shape.tiles);
      if (strip) hits.push({ combo: combo.id, members: [], tiles: strip });
    }
  }
  return hits;
}

/**
 * An unbroken strip of the given tiles from a tile touching the river to a
 * side edge of the valley (the first or last tile of a row). Returns the
 * strip's tile keys, shortest first, or null.
 */
function findStrip(state: RunState, types: readonly string[]): string[] | null {
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
  const fits = (key: string) => types.includes(tiles[key]?.type ?? '');
  const byRiver = (h: Hex) =>
    hexNeighbors(h).some((n) => ['river', 'reservoir'].includes(tiles[hexKey(n)]?.type ?? ''));
  const from = new Map<string, string | null>();
  const queue: string[] = [];
  for (const [key, t] of Object.entries(tiles)) {
    if (fits(key) && byRiver(t)) {
      from.set(key, null);
      queue.push(key);
    }
  }
  while (queue.length > 0) {
    const key = queue.shift()!;
    const t = tiles[key]!;
    if (isEdge(t)) {
      const path: string[] = [];
      for (let k: string | null = key; k !== null; k = from.get(k)!) path.unshift(k);
      return path;
    }
    for (const n of hexNeighbors(t)) {
      const nk = hexKey(n);
      if (fits(nk) && !from.has(nk)) {
        from.set(nk, key);
        queue.push(nk);
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
    if (!e.generation && !e.ignoresShade && !e.freeRuns) continue;
    for (const uid of hit.members) {
      if (e.appliesTo && state.buildings[uid]?.type !== e.appliesTo) continue;
      const cur = effects.get(uid) ?? { generation: 0, ignoresShade: false, freeRuns: false };
      effects.set(uid, {
        // A building in two terraces still gets the bonus once.
        generation: Math.max(cur.generation, e.generation),
        ignoresShade: cur.ignoresShade || e.ignoresShade,
        freeRuns: cur.freeRuns || e.freeRuns,
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
    .filter((c) => c.effect.wellbeing !== 0)
    .map((c) => ({ reason: c.name, amount: c.effect.wellbeing }));
}

// ---------------------------------------------------------------------- chains

/** Did this building do its work this season? */
function worked(ctx: SeasonContext, b: BuildingState): boolean {
  if (!ctx.active.has(b.uid)) return false;
  const y = ctx.report.yields[b.uid];
  if (y && Object.values(y).some((n) => (n ?? 0) > 0)) return true;
  if ((ctx.report.runs[b.uid]?.runs ?? 0) > 0) return true;
  const g = ctx.report.generated[b.uid];
  return g !== undefined && g.energy.day + g.energy.night > 0;
}

/** Loops that ran this season: every complete path through the chain's links. */
function runningLoops(ctx: SeasonContext): ComboHit[] {
  const { state } = ctx;
  const occ = occupancy(state);
  const hits: ComboHit[] = [];
  for (const combo of combosOf(ctx.content, 'chain')) {
    const fits = (b: BuildingState, i: number) => {
      const link = combo.links[i]!;
      if (!link.buildings.includes(b.type)) return false;
      if (link.slot && (b.slot ?? defOf(ctx.content, b).digester?.defaultSlot) !== link.slot)
        return false;
      return worked(ctx, b);
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
          if (!path.includes(n.uid) && fits(n, i + 1)) walk(n, i + 1, [...path, n.uid]);
        }
      };
      walk(anchor, 0, [anchor.uid]);
      if (members.size > 0) hits.push({ combo: combo.id, members: [...members] });
    }
  }
  return hits;
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
      addYield(ctx, b, res, combo.bonus);
      explain(ctx, b, `+${combo.bonus} ${res} from the ${combo.name}`);
    }
  }
}

// ------------------------------------------------------------------ evolutions

/** The evolution a building would undergo if `building` were placed on it (a canopy over a farm). */
export function placementEvolution(
  content: Content,
  building: string,
  target: BuildingState | undefined,
): ComboOf<'evolution'> | undefined {
  if (!target) return undefined;
  return combosOf(content, 'evolution').find(
    (c) => c.when.kind === 'placed' && c.when.building === building && c.from === target.type,
  );
}

/** Turns a building into its evolved form, keeping its place in every list. */
export function evolve(state: RunState, b: BuildingState, into: string): void {
  b.evolvedFrom = b.type;
  b.evolvedTurn = state.turn;
  b.type = into;
  delete b.recipe;
  delete b.slot;
}

function evolveAtSeasonEnd(ctx: SeasonContext): void {
  const { content, state, report } = ctx;
  const occ = occupancy(state);
  for (const combo of combosOf(content, 'evolution')) {
    const when = combo.when;
    if (when.kind === 'placed') continue;
    for (const b of Object.values(state.buildings)) {
      if (b.type !== combo.from) continue;
      const ready =
        when.kind === 'nextTo'
          ? touches(state, b, when.nextTo, occ)
          : (tileAt(state, b.at)?.salvage ?? 1) <= 0;
      if (!ready) continue;
      evolve(state, b, combo.into);
      report.evolved.push({ uid: b.uid, from: combo.from, into: combo.into });
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
