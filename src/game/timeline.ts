/**
 * The season's resolution as a timeline (Milestone 5): the event, the sun
 * crossing the valley, night, and a moment to settle. Built from the season
 * report, so every pop and every flow of light is something the rules did.
 * Pure data; src/render/resolution.ts plays it.
 */
import { lanternTiles } from './keepsakes';
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
import { heatDemand } from '../sim/queries';
import { gridCooling } from './coolInfo';

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

/** Something the season's event did to a tile or building, shown during the event. */
export type EventFxKind =
  | 'flooded'
  | 'silted'
  | 'sheltered'
  | 'dried'
  | 'slowed'
  | 'struck'
  | 'exposed'
  | 'calm'
  | 'chilled'
  /** The Sun Desert: a home cooled for free (a wind tower, a chiller), or one hot or grid-cooled. */
  | 'cooled'
  | 'hot'
  /** Dust on a solar canopy's or a mirror's glass in a dust storm. */
  | 'dusted';

export interface EventFx {
  kind: EventFxKind;
  at: Hex;
  /** When it shows, within the event phase. */
  t: number;
}

export interface Timeline {
  season: Season;
  event: EventId;
  /** The biome's land (the desert's dust storm is dust, not rain; its cold nights bring no snow). */
  land: string;
  duration: number;
  phases: Phase[];
  pops: Pop[];
  flows: Flow[];
  /** Flooded tiles, each with the moment the water reaches it. */
  flood: { t: number; key: string }[];
  /** Homes lit at night (and what each is); blacked-out buildings go dark. */
  lit: Hex[];
  litTypes: string[];
  /** Channel lanterns (a keepsake), lit at night. */
  lanterns: Hex[];
  dark: Hex[];
  damaged: Hex[];
  /** Everything tall enough to cast a shadow: tall buildings and woodland. */
  casters: Hex[];
  /** Solar the shade rule dimmed this season, and the tiles that shaded it. */
  shade: { at: Hex; by: Hex[] }[];
  /** Loops at work this season: each glows along its buildings. */
  glow: Hex[][];
  /** What the event did, tile by tile; and the river's tiles (low river, freeze). */
  eventFx: EventFx[];
  river: Hex[];
  /** Ground the tide covers and uncovers (the coast's mudflat): it rises by night, falls by day. */
  tide: Hex[];
}

/**
 * About 7.5 seconds in full (the design's 5 felt rushed in playtesting: day and
 * night are slower, so each building's numbers can be read); a short fade when
 * the player prefers reduced motion.
 */
export const FULL_DURATIONS: Record<PhaseName, number> = {
  event: 1300,
  day: 3400,
  night: 1900,
  settle: 900,
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
  options: {
    reducedMotion?: boolean;
    /** Buildings besides homes that light their windows at night (those with art for it). */
    lights?: (type: string) => boolean;
  } = {},
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
  // The grid's energy spent cooling homes (the Sun Desert) flows to them too.
  const coolEnergy = gridCooling(content, report.cool ?? null);
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
        (def ? heatDemand(content, after, b, slot, si) : 0) +
        (report.runs[b.uid]?.energy[slot] ?? 0) +
        (coolEnergy.get(b.uid)?.[slot] ?? 0);
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
          duration: Math.min(1400, (window.end - start) * 0.9),
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

  // The event, tile by tile: it reaches each in the order the flood would, or across the valley.
  const ev = phase('event');
  const across = (h: Hex) => {
    const x = (axialToOffset(h).col - minCol) / span;
    return ev.start + (0.15 + x * 0.55) * (ev.end - ev.start);
  };
  const eventFx: EventFx[] = [];
  const fx = (
    kind: EventFxKind,
    h: Hex | undefined,
    t: number,
    pop?: Pop['text'],
    tone?: Pop['tone'],
  ) => {
    if (!h) return;
    eventFx.push({ kind, at: h, t });
    if (pop) pops.push({ t: t + 120, at: h, text: pop, tone: tone ?? 'neutral' });
  };
  const floodT = new Map(flood.map((f) => [f.key, f.t]));
  for (const uid of report.damaged) {
    const h = at(uid);
    const t =
      floodT.get(h ? `${h.q},${h.r}` : '') ??
      (h ? across(h) : ev.start + (ev.end - ev.start) * 0.4);
    fx(
      report.event === 'flood' ? 'flooded' : 'struck',
      h,
      t,
      report.event === 'flood' ? 'flooded' : 'storm damage',
      'bad',
    );
  }
  for (const uid of report.silted) {
    const h = at(uid);
    fx('silted', h, (h && floodT.get(`${h.q},${h.r}`)) ?? ev.start + 300, 'silt', 'good');
  }
  for (const key of report.sheltered) fx('sheltered', parseHexKey(key), ev.start + 250);
  for (const uid of report.dried)
    fx('dried', at(uid), across(at(uid) ?? { q: 0, r: 0 }), 'dry: −food', 'bad');
  if (report.event === 'lowRiver') {
    for (const b of Object.values(after.buildings))
      if (b.type === 'riverWheel') fx('slowed', b.at, across(b.at), 'slow', 'neutral');
  }
  if (report.event === 'storm') {
    const struck = new Set(report.damaged);
    const sheltered = report.mixedGrid && content.events.storm?.mixedGridShelters;
    for (const uid of report.exposed) {
      if (struck.has(uid)) continue;
      fx(sheltered ? 'calm' : 'exposed', at(uid), across(at(uid) ?? { q: 0, r: 0 }));
    }
    if (sheltered && camp) fx('calm', camp, ev.start + 200, 'Mixed Grid: no damage', 'good');
  }
  // Hot days (the Sun Desert): homes cooled for free, or bought cooling from the grid, or hot.
  if (report.cool) {
    const free = new Set(report.cool.filter((l) => l.from !== 'grid').map((l) => l.to));
    const grid = new Set(report.cool.filter((l) => l.from === 'grid').map((l) => l.to));
    for (const uid of new Set([...free, ...grid])) {
      const h = at(uid);
      if (grid.has(uid)) fx('hot', h, across(h ?? { q: 0, r: 0 }));
      else fx('cooled', h, across(h ?? { q: 0, r: 0 }));
    }
  }
  for (const uid of report.hot ?? [])
    fx('hot', at(uid), across(at(uid) ?? { q: 0, r: 0 }), 'too hot', 'bad');
  // Dust on the glass: canopies and mirrors make less in a dust storm.
  if (report.event === 'storm' && (content.events.storm?.solarPenalty ?? 0) > 0) {
    const dimmed = Object.values(after.buildings).filter(
      (b) => content.byId[b.type]?.fogged && report.generated[b.uid],
    );
    for (const b of dimmed)
      fx('dusted', b.at, across(b.at), `dust −${content.events.storm!.solarPenalty}`, 'bad');
  }
  if (report.event === 'freeze') {
    for (const b of Object.values(after.buildings)) {
      const heat = content.byId[b.type] ? heatDemand(content, after, b, 'night', si) : 0;
      if (heat > 0) fx('chilled', b.at, across(b.at));
    }
  }

  const litHomes = Object.values(after.buildings).filter(
    (b) =>
      ((content.byId[b.type]?.housing ?? 0) > 0 || (options.lights?.(b.type) ?? false)) &&
      !report.blackouts.includes(b.uid) &&
      !b.damage,
  );
  const lit = litHomes.map((b) => b.at);

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
    land: content.land,
    duration: t,
    phases,
    pops: pops.sort((a, b) => a.t - b.t),
    flows,
    flood,
    lit,
    litTypes: litHomes.map((b) => b.type),
    lanterns: lanternTiles(content, after),
    dark,
    damaged: report.damaged.map(at).filter((h): h is Hex => h !== undefined),
    casters,
    shade,
    glow: report.combos
      .filter((hit) => content.comboById[hit.combo]?.layer === 'chain')
      .map((hit) => hit.members.map(at).filter((h): h is Hex => h !== undefined)),
    eventFx,
    river: after.map.river.map(parseHexKey),
    tide: Object.values(after.map.tiles)
      .filter((tile) => TIDAL.includes(tile.type))
      .map((tile) => ({ q: tile.q, r: tile.r })),
  };
}

/** Tile types the daily tide covers and uncovers. */
export const TIDAL: readonly string[] = ['mudflat'];

function dist(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

export function phaseAt(timeline: Timeline, t: number): PhaseName {
  return (timeline.phases.find((p) => t < p.end) ?? timeline.phases.at(-1)!).name;
}
