/**
 * The map's needs labels (asked for in playtesting): above each working building with a need this
 * season, what it gets of each out of what it needs (X/Y): water, energy by day and by night,
 * heat and cooling. Read from the season's preview, so they change as the player builds.
 */
import type { Hex, NeedKind, NeedMet, RunState, SeasonReport } from '../sim';

/** The order the needs are listed in, top to bottom. */
export const NEED_KINDS: NeedKind[] = ['water', 'dayEnergy', 'nightEnergy', 'heat', 'cooling'];

/** Each need's short name on the map. */
export const NEED_NAMES: Record<NeedKind, string> = {
  water: 'water',
  dayEnergy: 'day',
  nightEnergy: 'night',
  heat: 'heat',
  cooling: 'cool',
};

export interface NeedLine extends NeedMet {
  kind: NeedKind;
  /** Got less than it needs. */
  short: boolean;
}

export interface NeedLabel {
  uid: string;
  at: Hex;
  lines: NeedLine[];
}

/** One label per building with at least one need this season, in priority order. */
export function needLabels(state: RunState, report: SeasonReport): NeedLabel[] {
  const out: NeedLabel[] = [];
  for (const uid of state.priority) {
    const b = state.buildings[uid];
    const needs = report.needs[uid];
    if (!b || !needs) continue;
    const lines = NEED_KINDS.flatMap((kind) => {
      const n = needs[kind];
      return n && n.need > 0 ? [{ kind, ...n, short: n.got < n.need }] : [];
    });
    if (lines.length > 0) out.push({ uid, at: b.at, lines });
  }
  return out;
}

/** A line as the map writes it: `day 2/3`. */
export function needText(line: NeedLine): string {
  return `${NEED_NAMES[line.kind]} ${line.got}/${line.need}`;
}
