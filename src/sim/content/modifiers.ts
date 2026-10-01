/**
 * Tunings, charters, Root City's perks and landmarks, and expedition twists are
 * data modifiers: for a run they change numbers in the content (Deep Roots sets
 * an orchard's maturing time to 1).
 * The simulation reads the run's effective content, built here once per
 * combination of cards and cached.
 */
import type { Content } from './load';
import { loadContent } from './load';
import type { Modifier } from './schema';

type Json = Record<string, unknown>;

const cache = new WeakMap<Content, Map<string, Content>>();

/** What a run carries from Root City and its expedition (see RunOptions). */
export interface RunModifierSources {
  tunings: string[];
  charters: string[];
  /** Harsher seasons hold from their era on. */
  era?: number;
  /** Finished projects' modifiers hold too. */
  projects?: { id: string; done: number | null }[];
  options?: {
    city?: { districts: Record<string, string>; landmarks: string[] };
    expedition?: { twist: string | null; region?: string | null };
  };
}

/**
 * The modifiers a run plays under, in order: the expedition's region, the
 * era's harsher seasons, Root City's district perks and landmarks, the
 * expedition's twist, finished projects, then the run's tunings and charters.
 */
export function runModifiers(content: Content, state: RunModifierSources): Modifier[] {
  const city = state.options?.city;
  const tiers = content.rules.score.tiers.map((t) => t.id);
  const perks = Object.entries(city?.districts ?? {}).flatMap(([id, tier]) => {
    const perks = content.districts.find((d) => d.id === id)?.perks ?? [];
    return perks[Math.min(Math.max(0, tiers.indexOf(tier)), perks.length - 1)]?.modifiers ?? [];
  });
  const landmarks = (city?.landmarks ?? []).flatMap(
    (id) => content.landmarks.find((l) => l.id === id)?.modifiers ?? [],
  );
  const twist = state.options?.expedition?.twist;
  const region = state.options?.expedition?.region;
  const harsher = content.rules.eraModifiers
    .filter((m) => m.era <= (state.era ?? 1))
    .flatMap((m) => m.modifiers);
  return [
    ...(content.regions.find((r) => r.id === region)?.modifiers ?? []),
    ...harsher,
    ...perks,
    ...landmarks,
    ...(content.twists.find((t) => t.id === twist)?.modifiers ?? []),
    ...(state.projects ?? [])
      .filter((p) => p.done !== null)
      .flatMap((p) => content.projects.find((x) => x.id === p.id)?.effect.modifiers ?? []),
    ...state.tunings.flatMap((id) => content.tuningById[id]?.modifiers ?? []),
    ...state.charters.flatMap((id) => content.charterById[id]?.modifiers ?? []),
  ];
}

/** The content as the run plays it: Root City, the twist, tunings and charters applied. */
export function effectiveContent(content: Content, state: RunModifierSources): Content {
  const modifiers = runModifiers(content, state);
  if (modifiers.length === 0) return content;
  const key = JSON.stringify(modifiers);
  let byKey = cache.get(content);
  if (!byKey) cache.set(content, (byKey = new Map()));
  let out = byKey.get(key);
  if (!out) {
    out = applyModifiers(content, modifiers);
    byKey.set(key, out);
  }
  return out;
}

/** A new, validated content with the modifiers applied in order. Throws on a bad path. */
export function applyModifiers(content: Content, modifiers: Modifier[]): Content {
  const { byId: _b, comboById: _c, tuningById: _t, charterById: _h, ...data } = content;
  const copy = structuredClone(data) as unknown as Json;
  for (const m of modifiers) applyModifier(copy, m);
  return loadContent(copy, { checkModifiers: false });
}

function applyModifier(data: Json, m: Modifier): void {
  let root: unknown;
  if (m.target === 'rules') root = data.rules;
  else if (m.target === 'event') root = (data.events as Json)[m.id ?? ''];
  else if (m.target === 'map') root = data.map;
  else if (m.target === 'combo') root = (data.combos as Json[]).find((c) => c.id === m.id);
  else root = (data.buildings as Json[]).find((b) => b.id === m.id);
  if (root === undefined) throw new Error(`no ${m.target} ${m.id ?? ''}`);
  const parts = m.path.split('.');
  const last = parts.pop()!;
  let parent = root as Json;
  for (const part of parts) {
    const next = parent[part];
    if (next === null || typeof next !== 'object') throw new Error(`no ${m.path} to modify`);
    parent = next as Json;
  }
  if (!(last in parent)) throw new Error(`no ${m.path} to modify`);
  const op = (v: unknown): unknown => {
    if (m.set !== undefined) return m.set;
    if (typeof v !== 'number') throw new Error(`${m.path} is not a number`);
    return m.add !== undefined ? v + m.add : v * m.multiply!;
  };
  const value = parent[last];
  parent[last] = Array.isArray(value) && m.set === undefined ? value.map(op) : op(value);
}
