/**
 * Tunings and charters are data modifiers: for the rest of a run they change
 * numbers in the content (Deep Roots sets an orchard's maturing time to 1).
 * The simulation reads the run's effective content, built here once per
 * combination of cards and cached.
 */
import type { Content } from './load';
import { loadContent } from './load';
import type { Modifier } from './schema';

type Json = Record<string, unknown>;

const cache = new WeakMap<Content, Map<string, Content>>();

/** The content with the run's tunings and charters applied (the content itself when none). */
export function effectiveContent(
  content: Content,
  state: { tunings: string[]; charters: string[] },
): Content {
  if (state.tunings.length === 0 && state.charters.length === 0) return content;
  const key = `${state.tunings.join(',')}|${state.charters.join(',')}`;
  let byKey = cache.get(content);
  if (!byKey) cache.set(content, (byKey = new Map()));
  let out = byKey.get(key);
  if (!out) {
    const modifiers = [
      ...state.tunings.flatMap((id) => content.tuningById[id]?.modifiers ?? []),
      ...state.charters.flatMap((id) => content.charterById[id]?.modifiers ?? []),
    ];
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
