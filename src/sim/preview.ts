/**
 * Placement preview: what a building would do if placed now, worked out by
 * resolving this season with and without it. Every number the preview shows
 * is exactly what the rules will do, neighbour effects included.
 */
import { applyCommand } from './commands';
import type { Content } from './content/load';
import { RESOURCES, SLOTS, type Resource, type Slot } from './content/schema';
import type { Hex } from './hex';
import { canPlace } from './placement';
import { resolveSeason, type ResolveOptions } from './season/resolve';
import { placementEvolution } from './combos';
import { buildingAt } from './queries';
import type { ComboHit, RunState } from './types';

export type PreviewKey = Resource | `${Slot}Energy` | `${Slot}Heat`;

export interface PreviewItem {
  uid: string;
  at: Hex;
  key: PreviewKey;
  amount: number;
}

export type PlacementPreview =
  | { ok: false; reason: string }
  | {
      ok: true;
      building: string;
      cost: number;
      /** Per-building changes this season, for floating +/- numbers. */
      items: PreviewItem[];
      /** Settlement-wide changes: Harmony now, the rest by the end of this season. */
      totals: {
        harmony: number;
        wellbeing: number;
        food: number;
        materials: number;
        shortfall: Record<Slot, number>;
      };
      /** Things the player should know before placing. */
      warnings: string[];
      /** The new building's own math for this season. */
      math: string[];
      /** Combos this placement would put to work this season (new or grown). */
      combos: ComboHit[];
      /** Built over another building, it evolves that building instead (a canopy over a farm). */
      evolves: { uid: string; into: string } | null;
    };

/** Resolving the unchanged season can be cached by the caller and passed in. */
export function previewPlacement(
  content: Content,
  state: RunState,
  building: string,
  at: Hex,
  before?: RunState,
  options: ResolveOptions = {},
): PlacementPreview {
  before ??= resolveSeason(content, state, options);
  const def = content.byId[building];
  if (!def) return { ok: false, reason: `unknown building ${building}` };
  const site = canPlace(content, state, building, at);
  if (!site.ok) return site;
  const placed = applyCommand(content, state, { type: 'place', building, at });
  if (!placed.ok) return { ok: false, reason: placed.error };
  const after = resolveSeason(content, placed.state, options);
  const target = buildingAt(state, at);
  const evolution = placementEvolution(content, building, target);
  const uid = target && evolution ? target.uid : `b${state.nextUid}`;
  const b = before.lastReport!;
  const a = after.lastReport!;

  const items: PreviewItem[] = [];
  for (const [id, building] of Object.entries(placed.state.buildings)) {
    const push = (key: PreviewKey, amount: number) => {
      if (amount !== 0) items.push({ uid: id, at: building.at, key, amount });
    };
    for (const res of RESOURCES) {
      push(res, (a.yields[id]?.[res] ?? 0) - (b.yields[id]?.[res] ?? 0));
    }
    for (const slot of SLOTS) {
      const ga = a.generated[id];
      const gb = b.generated[id];
      push(`${slot}Energy`, (ga?.energy[slot] ?? 0) - (gb?.energy[slot] ?? 0));
      push(`${slot}Heat`, (ga?.heat[slot] ?? 0) - (gb?.heat[slot] ?? 0));
    }
  }

  const warnings: string[] = [];
  const event = content.events[a.event];
  if (a.damaged.includes(uid))
    warnings.push(`The ${event.name.toLowerCase()} will disable it this season.`);
  if (a.atRisk.includes(uid))
    warnings.push('The storms may disable it: it stands on a hill with no woodland beside it.');
  if (a.unstaffed.includes(uid)) warnings.push('No free worker: it will not run.');
  if (a.blackouts.includes(uid)) warnings.push('Not enough energy: it will be shut off.');
  const newlyDark = a.blackouts.filter((id) => id !== uid && !b.blackouts.includes(id));
  if (newlyDark.length > 0) {
    const names = newlyDark.map((id) => content.byId[placed.state.buildings[id]!.type]!.name);
    warnings.push(`Causes a blackout: ${names.join(', ')} shut off.`);
  }
  const newlyUnstaffed = a.unstaffed.filter((id) => id !== uid && !b.unstaffed.includes(id));
  if (newlyUnstaffed.length > 0) {
    const names = newlyUnstaffed.map((id) => content.byId[placed.state.buildings[id]!.type]!.name);
    warnings.push(`Takes a worker from: ${names.join(', ')}.`);
  }

  return {
    ok: true,
    building,
    cost: def.cost,
    items,
    totals: {
      harmony: placed.state.harmony - state.harmony,
      wellbeing: after.wellbeing - before.wellbeing,
      food: a.food.produced - b.food.produced,
      materials: after.stores.materials - before.stores.materials,
      shortfall: {
        day: a.energy.day.shortfall - b.energy.day.shortfall,
        night: a.energy.night.shortfall - b.energy.night.shortfall,
      },
    },
    warnings,
    math: a.math[uid] ?? [],
    combos: a.combos.filter((hit) => !b.combos.some((x) => sameHit(x, hit))),
    evolves: target && evolution ? { uid: target.uid, into: evolution.into } : null,
  };
}

const hitKey = (h: ComboHit) =>
  `${h.combo}:${[...h.members].sort().join(',')}:${(h.tiles ?? []).join(',')}`;
function sameHit(a: ComboHit, b: ComboHit): boolean {
  return hitKey(a) === hitKey(b);
}

/** The season resolved as things stand, for callers that preview many placements. */
export function resolveAsIs(
  content: Content,
  state: RunState,
  options: ResolveOptions = {},
): RunState {
  return resolveSeason(content, state, options);
}

/** The season as a player can foresee it: chance outcomes are risks, not results. */
export function forecastSeason(content: Content, state: RunState): RunState {
  return resolveSeason(content, state, { forecast: true });
}
