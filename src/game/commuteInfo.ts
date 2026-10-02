/**
 * Walks to work for the interface (C2): what a home or a workplace's walks
 * are this season, the lines the map draws for the building in focus, and
 * the season report's notes, from the season's commute report.
 */
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import type { CommuteReport, RunState } from '../sim/types';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function nameOf(content: Content, state: RunState, uid: string): string {
  return content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'a building since removed';
}

/** Lines about the walks of the building on this tile (empty when there are none). */
export function commuteAt(
  content: Content,
  state: RunState,
  report: CommuteReport | null,
  at: Hex,
): string[] {
  if (!report) return [];
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === hexKey(at));
  if (!b) return [];
  const free = content.rules.commute.freeDistance;
  const lines: string[] = [];
  const walks = report.walks[b.uid];
  if (walks && walks.length > 0) {
    const from = new Map<string, number[]>();
    for (const w of walks) from.set(w.home, [...(from.get(w.home) ?? []), w.distance]);
    const parts = [...from].map(
      ([home, ds]) =>
        `${ds.length > 1 ? `${ds.length} from ` : ''}the ${nameOf(content, state, home)} (${plural(ds[0]!, 'tile')})`,
    );
    lines.push(
      `Walks to work: ${walks.length > 1 ? 'workers' : 'its worker'} come${walks.length > 1 ? '' : 's'} from ${parts.join(', ')}.`,
    );
    const beyond = walks.reduce((s, w) => s + Math.max(0, w.distance - free), 0);
    if (beyond > 0)
      lines.push(
        `${plural(beyond, 'tile')} beyond the free ${free}: a home nearer would spare that walk.`,
      );
  }
  const residents = report.residents[b.uid];
  if (residents !== undefined) {
    const working = Object.values(report.walks)
      .flat()
      .filter((w) => w.home === b.uid).length;
    const housing = content.byId[b.type]?.housing ?? 0;
    lines.push(
      `Home to ${plural(residents, 'citizen')}${housing > 0 && residents > housing ? ` (${residents - housing} without a bed)` : ''}: ${working} walk to work from here.`,
    );
  }
  const water = report.toWater?.homes[b.uid];
  if (water) {
    const freeWater = content.rules.commute.toWater?.freeDistance ?? 0;
    lines.push(
      `Walks to water: ${plural(water.distance, 'tile')} to the ${sourceName(content, water.source)}${water.distance > freeWater ? `, ${water.distance - freeWater} beyond the free ${freeWater}: a well nearer would spare it` : ''}.`,
    );
  }
  return lines;
}

/** What a home fetches its water from: a tile type or a building. */
export function sourceName(content: Content, source: string): string {
  return content.byId[source]?.name ?? source;
}

/** A walk the map draws: from a home to a workplace, for the building in focus. */
export interface WalkLine {
  from: Hex;
  to: Hex;
  /** Workers walking it. */
  count: number;
  distance: number;
  /** Longer than the free distance: it costs wellbeing. */
  long: boolean;
}

/** The walks to and from the building `uid` (a workplace's workers, or a home's). */
export function walkLines(
  content: Content,
  state: RunState,
  report: CommuteReport | null,
  uid: string | null,
): WalkLine[] {
  if (!report || !uid || !state.buildings[uid]) return [];
  const free = content.rules.commute.freeDistance;
  const lines = new Map<string, WalkLine>();
  for (const [work, walks] of Object.entries(report.walks)) {
    for (const w of walks) {
      if (work !== uid && w.home !== uid) continue;
      const home = state.buildings[w.home];
      const job = state.buildings[work];
      if (!home || !job) continue;
      const key = `${w.home}>${work}`;
      const line = lines.get(key);
      if (line) line.count++;
      else
        lines.set(key, {
          from: home.at,
          to: job.at,
          count: 1,
          distance: w.distance,
          long: w.distance > free,
        });
    }
  }
  return [...lines.values()];
}

/** The season report's lines on walks to work. */
export function commuteNotes(content: Content, state: RunState, report: CommuteReport): string[] {
  const free = content.rules.commute.freeDistance;
  const walks = Object.entries(report.walks).flatMap(([work, ws]) =>
    ws.map((w) => ({ work, ...w })),
  );
  const long = walks.filter((w) => w.distance > free).sort((a, b) => b.distance - a.distance);
  const lines = [
    `${plural(walks.length, 'worker')} walked to work; ${long.length} walked further than the free ${free} tiles.`,
  ];
  if (report.excess > 0)
    lines.push(
      `${plural(report.excess, 'tile')} walked beyond the free distance: ${report.wellbeing} wellbeing (1 for every ${content.rules.commute.tilesPerWellbeing}).`,
    );
  for (const w of long.slice(0, 5))
    lines.push(
      `The ${nameOf(content, state, w.work)} from the ${nameOf(content, state, w.home)}: ${plural(w.distance, 'tile')}.`,
    );
  if (long.length > 5) lines.push(`…and ${long.length - 5} more long walks.`);
  const crowded = Object.entries(report.residents)
    .map(([uid, n]) => ({
      uid,
      over: n - (content.byId[state.buildings[uid]?.type ?? '']?.housing ?? n),
    }))
    .filter((r) => r.over > 0);
  for (const c of crowded)
    lines.push(
      `${plural(c.over, 'citizen')} without a bed, living at the ${nameOf(content, state, c.uid)}.`,
    );
  return lines;
}

/** The season report's lines on walks to water. */
export function waterWalkNotes(content: Content, state: RunState, report: CommuteReport): string[] {
  const w = report.toWater;
  const rules = content.rules.commute.toWater;
  if (!w || !rules) return [];
  const homes = Object.entries(w.homes);
  const long = homes
    .filter(([, h]) => h.distance > rules.freeDistance)
    .sort((a, b) => b[1].distance - a[1].distance);
  const lines = [
    `${plural(homes.length, 'home')} fetched water; ${long.length} walked further than the free ${rules.freeDistance} tiles.`,
  ];
  if (w.excess > 0)
    lines.push(
      `${plural(w.excess, 'tile')} beyond the free distance: ${w.wellbeing} wellbeing (1 for every ${rules.tilesPerWellbeing}).`,
    );
  for (const [uid, h] of long.slice(0, 5))
    lines.push(
      `The ${nameOf(content, state, uid)} to the ${sourceName(content, h.source)}: ${plural(h.distance, 'tile')}.`,
    );
  if (long.length > 5) lines.push(`…and ${long.length - 5} more long walks.`);
  return lines;
}
