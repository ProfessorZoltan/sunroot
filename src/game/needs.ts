/**
 * The map's needs labels (asked for in playtesting): above each working building with a need this
 * season, what it gets of each out of what it needs (X/Y): water, energy by day and by night,
 * heat and cooling. Buildings that run on spare energy (workshops, kilns, silk houses) say what
 * they use instead, with no "out of": it is not a need they can go short of. Read from the
 * season's preview, so they change as the player builds.
 */
import type { Content, Hex, NeedKind, NeedMet, RunState, SeasonReport, Slot } from '../sim';

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

/** Spare energy a flexible building's runs use in a slot. */
export interface SpareLine {
  slot: Slot;
  used: number;
}

export interface NeedLabel {
  uid: string;
  at: Hex;
  lines: NeedLine[];
  /** What its runs use of spare energy, shown apart from the needs. */
  spare: SpareLine[];
}

/**
 * What a flexible building's runs use of spare energy, by slot: the slots it used any in, or, when
 * its runs cost energy and it used none (no spare, or nothing to work), its first slot at 0.
 */
function spareOf(
  content: Content,
  state: RunState,
  report: SeasonReport,
  uid: string,
): SpareLine[] {
  const run = report.runs[uid];
  const recipes = content.byId[state.buildings[uid]?.type ?? '']?.recipes;
  if (!run || !recipes) return [];
  const used = (['day', 'night'] as const)
    .filter((slot) => run.energy[slot] > 0)
    .map((slot) => ({ slot, used: run.energy[slot] }));
  if (used.length > 0 || recipes.energyPerRun <= 0) return used;
  return [{ slot: recipes.runSlots[0] ?? 'day', used: 0 }];
}

/** One label per building with a need or a use of spare energy this season, in priority order. */
export function needLabels(content: Content, state: RunState, report: SeasonReport): NeedLabel[] {
  const out: NeedLabel[] = [];
  for (const uid of state.priority) {
    const b = state.buildings[uid];
    if (!b) continue;
    const needs = report.needs[uid] ?? {};
    const lines = NEED_KINDS.flatMap((kind) => {
      const n = needs[kind];
      return n && n.need > 0 ? [{ kind, ...n, short: n.got < n.need }] : [];
    });
    const spare = spareOf(content, state, report, uid);
    if (lines.length + spare.length > 0) out.push({ uid, at: b.at, lines, spare });
  }
  return out;
}

/** A line as the map writes it: `day 2/3`. */
export function needText(line: NeedLine): string {
  return `${NEED_NAMES[line.kind]} ${line.got}/${line.need}`;
}

/** A use of spare energy as the map writes it: `uses 2 day`. */
export function spareText(line: SpareLine): string {
  return `uses ${line.used} ${line.slot}`;
}
