/**
 * The season's resolution as a timeline (Milestone 5): the event, the sun
 * crossing the valley, night, and a moment to settle. Built from the season
 * report, so every pop and every flow of light is something the rules did.
 * Pure data; src/render/resolution.ts plays it.
 */
import {
  SEASONS,
  type Content,
  type EventId,
  type Hex,
  type Season,
  type RunState,
  type SeasonReport,
  type Slot,
} from '../sim';
import { axialToOffset, parseHexKey } from '../sim/hex';

export type PhaseName = 'event' | 'day' | 'night' | 'settle';

export interface Phase {
  name: PhaseName;
  start: number;
  end: number;
}

export interface Pop {
  t: number;
  at: Hex;
  text: string;
  tone: 'good' | 'bad' | 'neutral';
}

export interface Flow {
  t: number;
  duration: number;
  from: Hex;
  to: Hex;
  slot: Slot;
  /** Particles to send (a few per unit of energy, capped). */
  particles: number;
}

export interface Timeline {
  season: Season;
  event: EventId;
  duration: number;
  phases: Phase[];
  pops: Pop[];
  flows: Flow[];
  /** Flooded tiles, each with the moment the water reaches it. */
  flood: { t: number; key: string }[];
  /** Homes lit at night; blacked-out buildings go dark. */
  lit: Hex[];
  dark: Hex[];
  damaged: Hex[];
  /** Everything tall enough to cast a shadow: tall buildings and woodland. */
  casters: Hex[];
  /** Solar the shade rule dimmed this season, and the tiles that shaded it. */
  shade: { at: Hex; by: Hex[] }[];
  /** Loops that glow this season (Milestone 6 fills this in). */
  glow: Hex[][];
}

/** About 5 seconds in full; a short fade when the player prefers reduced motion. */
export const FULL_DURATIONS: Record<PhaseName, number> = {
  event: 800,
  day: 2400,
  night: 1200,
  settle: 600,
};
export const REDUCED_DURATIONS: Record<PhaseName, number> = {
  event: 200,
  day: 400,
  night: 300,
  settle: 300,
};

const RESOURCE_LABELS: Record<string, string> = {
  food: 'food',
  biomass: 'biomass',
  salvage: 'salvage',
  compost: 'compost',
  knowledge: 'knowledge',
  materials: 'materials',
};

export function buildTimeline(
  content: Content,
  after: RunState,
  report: SeasonReport,
  options: { reducedMotion?: boolean } = {},
): Timeline {
  const d = options.reducedMotion ? REDUCED_DURATIONS : FULL_DURATIONS;
  const phases: Phase[] = [];
  let t = 0;
  for (const name of ['event', 'day', 'night', 'settle'] as const) {
    phases.push({ name, start: t, end: t + d[name] });
    t += d[name];
  }
  const phase = (n: PhaseName) => phases.find((p) => p.name === n)!;
  const at = (uid: string): Hex | undefined => after.buildings[uid]?.at;
  const si = SEASONS.indexOf(report.season);

  // The sun rises in the east (right) and sets in the west (left): pops follow it.
  const cols = Object.values(after.map.tiles).map((h) => axialToOffset(h).col);
  const minCol = Math.min(...cols);
  const span = Math.max(1, Math.max(...cols) - minCol);
  const underSun = (h: Hex) => {
    const x = (axialToOffset(h).col - minCol) / span;
    const day = phase('day');
    return day.start + (1 - x) * (day.end - day.start) * 0.85;
  };

  const pops: Pop[] = [];
  for (const [uid, yields] of Object.entries(report.yields)) {
    const h = at(uid);
    if (!h) continue;
    const parts = Object.entries(yields)
      .filter(([res, n]) => RESOURCE_LABELS[res] && n)
      .map(([res, n]) => `${n! > 0 ? '+' : '−'}${Math.abs(n!)} ${RESOURCE_LABELS[res]}`);
    if (parts.length) pops.push({ t: underSun(h), at: h, text: parts.join('  '), tone: 'good' });
  }

  const camp = after.buildings.b0?.at;
  const settle = phase('settle');
  if (camp) {
    const pop = report.population.change;
    if (pop) {
      pops.push({
        t: settle.start,
        at: camp,
        text: `${pop > 0 ? '+' : '−'}${Math.abs(pop)} citizen${Math.abs(pop) > 1 ? 's' : ''}`,
        tone: pop > 0 ? 'good' : 'bad',
      });
    }
    const wb = report.wellbeing.after - report.wellbeing.before;
    if (wb) {
      pops.push({
        t: settle.start + 150,
        at: camp,
        text: `${wb > 0 ? '+' : '−'}${Math.abs(wb)} wellbeing`,
        tone: wb > 0 ? 'good' : 'bad',
      });
    }
  }

  // Blackouts at night.
  const dark = report.blackouts.map(at).filter((h): h is Hex => h !== undefined);
  const night = phase('night');
  for (const h of dark) pops.push({ t: night.start + 200, at: h, text: 'blackout', tone: 'bad' });

  // Energy flows: each consumer draws from the nearest sources with energy left.
  const flows: Flow[] = [];
  for (const slot of ['day', 'night'] as const) {
    const window = slot === 'day' ? phase('day') : night;
    const sources = Object.entries(report.generated)
      .map(([uid, g]) => ({ at: at(uid), left: g.energy[slot] }))
      .filter((s): s is { at: Hex; left: number } => s.at !== undefined && s.left > 0);
    const sinks: { at: Hex; need: number }[] = [];
    for (const b of Object.values(after.buildings)) {
      if (report.blackouts.includes(b.uid) || report.unstaffed.includes(b.uid)) continue;
      const def = content.byId[b.type];
      const need =
        (def?.demand?.energy[slot][si] ?? 0) +
        (def?.demand?.heat[slot][si] ?? 0) +
        (report.runs[b.uid]?.energy[slot] ?? 0);
      if (need > 0) sinks.push({ at: b.at, need });
    }
    sinks.forEach((sink, i) => {
      let need = sink.need;
      const nearest = [...sources].sort((a, b) => dist(a.at, sink.at) - dist(b.at, sink.at));
      for (const source of nearest) {
        if (need <= 0) break;
        const take = Math.min(need, source.left);
        if (take <= 0) continue;
        source.left -= take;
        need -= take;
        const start = window.start + ((i % 6) / 6) * (window.end - window.start) * 0.5;
        flows.push({
          t: start,
          duration: Math.min(900, (window.end - start) * 0.9),
          from: source.at,
          to: sink.at,
          slot,
          particles: Math.min(6, take * 2),
        });
      }
    });
  }

  const flood = report.flooded.map((key) => {
    const i = after.map.floodOrder.indexOf(key);
    const share = after.map.floodOrder.length ? i / after.map.floodOrder.length : 0;
    return {
      t: phase('event').start + share * (phase('event').end - phase('event').start) * 0.8,
      key,
    };
  });

  const lit = Object.values(after.buildings)
    .filter(
      (b) =>
        (content.byId[b.type]?.housing ?? 0) > 0 && !report.blackouts.includes(b.uid) && !b.damage,
    )
    .map((b) => b.at);

  const shade = Object.entries(report.shaded)
    .map(([uid, keys]) => ({ at: at(uid), by: keys.map(parseHexKey) }))
    .filter((s): s is { at: Hex; by: Hex[] } => s.at !== undefined);
  for (const s of shade) {
    pops.push({ t: phase('day').start + 300, at: s.at, text: 'in shade', tone: 'bad' });
  }
  const casters = [
    ...Object.values(after.buildings)
      .filter((b) => content.byId[b.type]?.tall)
      .map((b) => b.at),
    ...Object.values(after.map.tiles)
      .filter((tile) => tile.type === 'woodland')
      .map((tile) => ({ q: tile.q, r: tile.r })),
  ];

  return {
    season: report.season,
    event: report.event,
    duration: t,
    phases,
    pops: pops.sort((a, b) => a.t - b.t),
    flows,
    flood,
    lit,
    dark,
    damaged: report.damaged.map(at).filter((h): h is Hex => h !== undefined),
    casters,
    shade,
    glow: [],
  };
}

function dist(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function phaseAt(timeline: Timeline, t: number): PhaseName {
  return (timeline.phases.find((p) => t < p.end) ?? timeline.phases.at(-1)!).name;
}
