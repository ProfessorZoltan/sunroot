/**
 * Wildlife and festivals (EXPANSION.md, E4).
 *
 * An animal arrives at the start of a season once Harmony is at its threshold
 * and its habitat is on the map, and leaves when either is gone. What it does
 * depends only on its habitat, found afresh each season; the animals moving on
 * screen are for show. Festivals are a cheap, optional choice, once a year
 * each, held in their season: the cost is paid when chosen, the reward comes as
 * the season ends.
 */
import type { Content } from './content/load';
import type { Festival, Wildlife } from './content/schema';
import { hexDistance, hexKey, hexNeighbors } from './hex';
import { defOf, grownLayers, occupancy, tileAt } from './queries';
import type { BuildingState } from './types';
import { addYield, explain, type SeasonContext } from './season/context';
import type { RunState, WellbeingLine, WildlifeReport } from './types';
import { waterOn } from './water';
import { edgeTiles, hedgeRuns } from './edges';

/** The animals this content has (they come with the water system). */
export function animals(content: Content): Wildlife[] {
  return content.wildlife.filter((a) => !a.requiresWater || waterOn(content));
}

/** The festivals this content has. */
export function festivals(content: Content): Festival[] {
  return content.festivals.filter((f) => !f.requiresWater || waterOn(content));
}

/**
 * A layer added to `b` and grown in its own seasons (an animal's habitat asks this; no animal's
 * hastening counts here). Without the content, a layer added at all.
 */
function grownByItself(
  content: Content | undefined,
  state: RunState,
  b: BuildingState,
  id: string,
): boolean {
  const l = b.layers?.find((x) => x.id === id);
  if (!l) return false;
  const grows = content?.byId[b.type]?.layers?.find((d) => d.id === id)?.grows ?? 0;
  return state.turn - l.turn >= grows;
}

/** An animal's habitat on the map now: its tiles, and its herds (groups big enough). */
export function habitatOf(
  state: RunState,
  animal: Wildlife,
  occ = occupancy(state),
  content?: Content,
): { tiles: string[]; herds: number } {
  const h = animal.habitat;
  if (h.kind === 'edges') {
    const runs = hedgeRuns(state)
      .map((run) =>
        run.filter((e) =>
          edgeTiles(e).some((t) => h.nextToTiles.includes(tileAt(state, t)?.type as never)),
        ),
      )
      .filter((run) => run.length > 0);
    const tiles = [...new Set(runs.flat().flatMap((e) => edgeTiles(e).map(hexKey)))].sort();
    return { tiles, herds: runs.length };
  }
  if (h.kind === 'building') {
    const tiles = Object.values(state.buildings)
      .filter(
        (b) =>
          h.buildings.includes(b.type) &&
          (!h.withLayer || grownByItself(content, state, b, h.withLayer)) &&
          (!h.nextToTiles ||
            hexNeighbors(b.at).some((n) =>
              h.nextToTiles!.includes(tileAt(state, n)?.type as never),
            )),
      )
      .map((b) => hexKey(b.at))
      .sort();
    return { tiles, herds: tiles.length };
  }
  if (h.cleanLake && (state.lake?.grey ?? 0) > 0) return { tiles: [], herds: 0 };
  const fits = new Set(
    Object.keys(state.map.tiles).filter((key) => {
      const t = state.map.tiles[key]!;
      if (!h.tiles.includes(t.type)) return false;
      if ((t.height ?? 0) < h.minHeight) return false;
      if (h.wild && occ.has(key)) return false;
      const near = h.nextToBuildings;
      return !near || hexNeighbors(t).some((n) => near.includes(occ.get(hexKey(n))?.type ?? ''));
    }),
  );
  if (h.minGroup <= 1) return { tiles: [...fits].sort(), herds: fits.size > 0 ? 1 : 0 };
  // Connected groups of habitat; each big enough is a herd's.
  const seen = new Set<string>();
  const tiles: string[] = [];
  let herds = 0;
  for (const start of [...fits].sort()) {
    if (seen.has(start)) continue;
    const group = [start];
    seen.add(start);
    for (let i = 0; i < group.length; i++) {
      for (const n of hexNeighbors(state.map.tiles[group[i]!]!)) {
        const k = hexKey(n);
        if (fits.has(k) && !seen.has(k)) {
          seen.add(k);
          group.push(k);
        }
      }
    }
    if (group.length >= h.minGroup) {
      herds += 1;
      tiles.push(...group);
    }
  }
  return { tiles: tiles.sort(), herds };
}

/** Whether an animal could live in the valley now: Harmony at its threshold, habitat on the map. */
export function welcomes(
  state: RunState,
  animal: Wildlife,
  occ = occupancy(state),
  content?: Content,
): boolean {
  return state.harmony >= animal.harmony && habitatOf(state, animal, occ, content).tiles.length > 0;
}

/** Seasons sooner `b`'s layer grows: animals spreading its seed near it (the fruit bats). */
export function hastened(
  content: Content,
  state: RunState,
  b: BuildingState,
  layer: string,
): number {
  let sooner = 0;
  for (const a of animals(content)) {
    const e = a.effect;
    if (e.kind !== 'layersGrow' || !e.layers.includes(layer) || !state.wildlife.includes(a.id))
      continue;
    const tiles = habitatOf(state, a, occupancy(state), content).tiles;
    if (tiles.some((k) => hexDistance(state.map.tiles[k]!, b.at) <= e.range)) sooner += e.seasons;
  }
  return sooner;
}

/**
 * At the start of a season: animals arrive where Harmony and their habitat
 * welcome them, and leave where they no longer do.
 */
export function updateWildlife(content: Content, state: RunState, notices = true): void {
  const occ = occupancy(state);
  const present: string[] = [];
  for (const a of animals(content)) {
    const was = state.wildlife.includes(a.id);
    const here = welcomes(state, a, occ, content);
    if (here) present.push(a.id);
    if (!notices || was === here) continue;
    if (here) state.notices.push(`${a.name} have come to the ${content.land}`);
    else if (state.harmony < a.harmony)
      state.notices.push(`${a.name} have left: Harmony fell below ${a.harmony}`);
    else state.notices.push(`${a.name} have left: their habitat is gone`);
  }
  // Those already here first, in the order they came.
  state.wildlife = [
    ...state.wildlife.filter((id) => present.includes(id)),
    ...present.filter((id) => !state.wildlife.includes(id)),
  ];
}

/** The season's wildlife report, and the food the animals bring (after production). */
export function wildlifeYields(ctx: SeasonContext): void {
  const { content, state } = ctx;
  const list = animals(content);
  if (list.length === 0) return;
  const occ = occupancy(state);
  const report: WildlifeReport = { present: [...state.wildlife], habitat: {}, food: {} };
  ctx.report.wildlife = report;
  const season = state.season;
  for (const a of list) {
    if (!state.wildlife.includes(a.id)) continue;
    const habitat = habitatOf(state, a, occ, content);
    report.habitat[a.id] = habitat;
    const e = a.effect;
    if (e.kind !== 'nextToTiles' && e.kind !== 'nearHabitat') continue;
    if (e.kind === 'nextToTiles' && !e.seasons.includes(season)) continue;
    if (e.kind === 'nearHabitat' && e.seasons && !e.seasons.includes(season)) continue;
    const near = habitat.tiles.map((k) => state.map.tiles[k]!);
    for (const uid of state.priority) {
      const b = state.buildings[uid]!;
      if (!e.buildings.includes(b.type) || !ctx.active.has(uid)) continue;
      let why: string;
      if (e.kind === 'nextToTiles') {
        const n = hexNeighbors(b.at).filter((h) =>
          e.tiles.includes(tileAt(state, h)?.type as never),
        ).length;
        if (n < e.count) continue;
        why = `next to ${n} ${e.tiles.join(' or ')} tiles`;
      } else {
        // Otters fish where there is food to fish: only a pond that made food.
        if ((ctx.report.yields[uid]?.food ?? 0) <= 0) continue;
        if (!near.some((t) => hexDistance(t, b.at) <= e.range)) continue;
        why = `within ${e.range} tiles of them`;
      }
      addYield(ctx, b, 'food', e.food, a.name);
      (report.food[uid] ??= []).push({ animal: a.id, amount: e.food });
      explain(ctx, b, `+${e.food} food from ${a.name.toLowerCase()} (${why})`);
    }
  }
}

/**
 * As its season ends, once a year: each open tile of the animals' healing kinds beside their
 * habitat heals a step up the land-health ladder (the hornbills, dropping the forest's seed).
 */
export function wildlifeHeals(ctx: SeasonContext): void {
  const { content, state } = ctx;
  const ladder = content.rules.landHealth;
  const occ = occupancy(state);
  for (const a of animals(content)) {
    const e = a.effect;
    if (e.kind !== 'heals' || e.season !== state.season || !state.wildlife.includes(a.id)) continue;
    const habitat = new Set(habitatOf(state, a, occ, content).tiles);
    const edge = Object.keys(state.map.tiles)
      .filter((key) => {
        const t = state.map.tiles[key]!;
        if (!e.tiles.includes(t.type) || occ.has(key) || habitat.has(key)) return false;
        return hexNeighbors(t).some((n) => habitat.has(hexKey(n)));
      })
      .sort();
    for (const key of edge) {
      const t = state.map.tiles[key]!;
      const at = ladder.indexOf(t.type);
      if (at < 0 || at >= ladder.length - 1) continue;
      t.type = ladder[at + 1]!;
      // Healed land takes its own fertility (Rainforest Gardens), not what it had as scrub.
      delete t.fertility;
      if (ctx.report.wildlife) (ctx.report.wildlife.healed ??= []).push(key);
    }
  }
}

const plural = (word: string) => (word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`);

/** Wellbeing from the animals: each herd of deer. */
export function wildlifeWellbeing(ctx: SeasonContext): WellbeingLine[] {
  const lines: WellbeingLine[] = [];
  const occ = occupancy(ctx.state);
  for (const a of animals(ctx.content)) {
    if (a.effect.kind !== 'wellbeing' || !ctx.state.wildlife.includes(a.id)) continue;
    const herds =
      ctx.report.wildlife?.habitat[a.id]?.herds ?? habitatOf(ctx.state, a, occ, ctx.content).herds;
    if (herds === 0) continue;
    lines.push({
      kind: 'wildlife',
      reason: `${herds} ${herds > 1 ? plural(a.effect.group) : a.effect.group} of ${a.name.toLowerCase()}`,
      amount: herds * a.effect.perHerd,
    });
  }
  return lines;
}

/** Water the animals carry to the stores near them this season (the sandgrouse). */
export function wildlifeWater(
  content: Content,
  state: RunState,
): { uid: string; animal: string; amount: number }[] {
  const out: { uid: string; animal: string; amount: number }[] = [];
  const occ = occupancy(state);
  for (const a of animals(content)) {
    const e = a.effect;
    if (e.kind !== 'waters' || !state.wildlife.includes(a.id)) continue;
    const near = habitatOf(state, a, occ, content).tiles.map((k) => state.map.tiles[k]!);
    for (const uid of state.priority) {
      const b = state.buildings[uid]!;
      if (!e.buildings.includes(b.type) || b.damage) continue;
      if (!near.some((t) => hexDistance(t, b.at) <= e.range)) continue;
      out.push({ uid, animal: a.name, amount: e.water });
    }
  }
  return out;
}

/** The festival held this season, if one is. */
export function festivalThisSeason(content: Content, state: RunState): Festival | undefined {
  return festivals(content).find(
    (f) => f.season === state.season && state.festivals[f.id] === state.year,
  );
}

/**
 * The festival's boost for `b` this season, if it gets one: a building it names, with the layer
 * grown it asks (Harvest of the Canopy) and beside what it asks (Odalan's Water Temple).
 */
export function festivalBoost(
  content: Content,
  state: RunState,
  b: BuildingState,
): NonNullable<Festival['boosts']> | undefined {
  const boost = festivalThisSeason(content, state)?.boosts;
  if (!boost || !boost.buildings.includes(b.type)) return undefined;
  if (boost.newOnly && b.builtTurn !== state.turn) return undefined;
  if (boost.layer && !grownLayers(content, state, b).some((l) => l.id === boost.layer))
    return undefined;
  const near = boost.nextTo;
  if (near) {
    const occ = occupancy(state);
    if (!hexNeighbors(b.at).some((n) => near.includes(occ.get(hexKey(n))?.type ?? '')))
      return undefined;
  }
  return boost;
}

/** Why this festival can't be held now, or null if it can. */
export function festivalProblem(content: Content, state: RunState, id: string): string | null {
  const f = festivals(content).find((x) => x.id === id);
  if (!f) return `there is no festival ${id}`;
  if (f.season !== state.season) return `the ${f.name} is held in ${f.season}`;
  if (state.festivals[f.id] === state.year) return `the ${f.name} was already held this year`;
  for (const [res, n] of Object.entries(f.cost) as [keyof RunState['stores'], number][]) {
    if (state.stores[res] < n) return `the ${f.name} needs ${n} ${res}`;
  }
  return null;
}

/** The festival's wellbeing, as the season ends; Lantern Night's only on fully powered nights. */
export function festivalWellbeing(ctx: SeasonContext): WellbeingLine[] {
  const f = festivalThisSeason(ctx.content, ctx.state);
  if (!f) return [];
  const lit = !f.needsNightPowered || ctx.report.energy.night.shortfall === 0;
  ctx.report.festival = { id: f.id, lit };
  if (!lit) return [];
  return [{ kind: 'festival', reason: f.name, amount: f.wellbeing }];
}

/** Farms near the flood that the Flood Fair's silt reaches: `rings` tiles beyond it. */
export function siltBeyond(
  content: Content,
  state: RunState,
  flooded: string[],
  rings: number,
): string[] {
  if (rings <= 0 || flooded.length === 0) return [];
  const wet = new Set(flooded);
  const tiles = flooded.map((k) => state.map.tiles[k]!);
  const out: string[] = [];
  for (const b of Object.values(state.buildings)) {
    const key = hexKey(b.at);
    if (wet.has(key) || !defOf(content, b).farmland) continue;
    if (tiles.some((t) => hexDistance(t, b.at) <= rings)) out.push(b.uid);
  }
  return out.sort();
}
