/**
 * Rearranging the priority list (ui/Priorities.tsx): several buildings at once, and presets that
 * sort it by kind of building (asked for in playtesting). Each returns a new order; the Founders'
 * Camp stays first. Pure, so the list's rules are tested without a screen.
 */
import type { BuildingKind } from '../sim/content/schema';

/** The kinds as the list names them, in the order the selection chips show them. */
export const KIND_NAMES: Record<BuildingKind, string> = {
  food: 'Food',
  water: 'Water',
  energy: 'Energy',
  home: 'Homes',
  civic: 'Civic',
  industry: 'Industry',
  storage: 'Storage',
  nature: 'Nature',
};

export interface PriorityPreset {
  id: string;
  name: string;
  /** What it is for, for the button's tooltip. */
  text: string;
  /** Kinds from first to last; within a kind, buildings keep their order. */
  kinds: BuildingKind[];
}

export const PRESETS: PriorityPreset[] = [
  {
    id: 'food',
    name: 'Food first',
    text: 'Farms and kitchens are staffed first, then water and homes.',
    kinds: ['food', 'water', 'home', 'energy', 'storage', 'civic', 'industry', 'nature'],
  },
  {
    id: 'energy',
    name: 'Energy first',
    text: 'Energy and its storage are staffed first and shut off last.',
    kinds: ['energy', 'storage', 'water', 'food', 'home', 'civic', 'industry', 'nature'],
  },
  {
    id: 'water',
    name: 'Water first',
    text: 'Water buildings are staffed first and take water first, then food.',
    kinds: ['water', 'food', 'energy', 'home', 'storage', 'civic', 'industry', 'nature'],
  },
  {
    id: 'homes',
    name: 'Homes first',
    text: 'Homes and civic buildings keep their power and warmth longest in a blackout.',
    kinds: ['home', 'civic', 'food', 'water', 'energy', 'storage', 'industry', 'nature'],
  },
  {
    id: 'industry',
    name: 'Industry first',
    text: 'Workshops and the like are staffed first, with the energy they need.',
    kinds: ['industry', 'energy', 'storage', 'food', 'water', 'home', 'civic', 'nature'],
  },
];

/** The order sorted by a preset's kinds; buildings of one kind keep their order. */
export function applyPreset(
  order: string[],
  kindOf: (uid: string) => BuildingKind | undefined,
  preset: PriorityPreset,
): string[] {
  const rank = (uid: string) => {
    const i = preset.kinds.indexOf(kindOf(uid)!);
    return i < 0 ? preset.kinds.length : i;
  };
  const [camp, ...rest] = order;
  const sorted = rest
    .map((uid, i) => ({ uid, i }))
    .sort((a, b) => rank(a.uid) - rank(b.uid) || a.i - b.i);
  return camp === undefined ? [] : [camp, ...sorted.map((x) => x.uid)];
}

/**
 * The chosen buildings moved together, in their order, to where row `to` is: just before it when
 * moving up, just after it when moving down (as a single building dragged onto a row).
 */
export function moveGroup(order: string[], chosen: ReadonlySet<string>, to: number): string[] {
  const picked = order.filter((uid, i) => i > 0 && chosen.has(uid));
  if (picked.length === 0) return order;
  const target = order[Math.max(1, Math.min(order.length - 1, to))]!;
  const rest = order.filter((uid) => !picked.includes(uid));
  if (chosen.has(target)) return order;
  const first = order.indexOf(picked[0]!);
  const at = rest.indexOf(target) + (order.indexOf(target) > first ? 1 : 0);
  return [...rest.slice(0, at), ...picked, ...rest.slice(at)];
}

/** The chosen buildings each one place up (-1) or down (+1), past the ones not chosen. */
export function nudge(order: string[], chosen: ReadonlySet<string>, dir: -1 | 1): string[] {
  const next = [...order];
  const idx = order.map((_, i) => i).filter((i) => i > 0);
  for (const i of dir < 0 ? idx : idx.reverse()) {
    const j = i + dir;
    if (j < 1 || j >= next.length) continue;
    if (chosen.has(next[i]!) && !chosen.has(next[j]!)) [next[i], next[j]] = [next[j]!, next[i]!];
  }
  return next;
}

/** The chosen buildings to the top (just after the camp) or to the bottom, in their order. */
export function toEnd(
  order: string[],
  chosen: ReadonlySet<string>,
  end: 'top' | 'bottom',
): string[] {
  const [camp, ...rest] = order;
  if (camp === undefined) return order;
  const picked = rest.filter((uid) => chosen.has(uid));
  const others = rest.filter((uid) => !chosen.has(uid));
  return [camp, ...(end === 'top' ? [...picked, ...others] : [...others, ...picked])];
}
