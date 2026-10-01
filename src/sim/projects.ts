/**
 * Projects (asked for in playtesting, for the quiet end of a run): works for
 * the whole settlement, started from a given era. Starting one pays its cost
 * from the stores at once; it finishes at the end of its last season, and its
 * effect holds from the next season to the end of the run.
 */
import type { Content } from './content/load';
import type { Project, Resource } from './content/schema';
import { hexKey } from './hex';
import { improveTile } from './queries';
import type { RunState } from './types';

/** Projects finished in this state, in the order they were started. */
export function finishedProjects(content: Content, state: RunState): Project[] {
  return (state.projects ?? [])
    .filter((p) => p.done !== null)
    .map((p) => content.projects.find((x) => x.id === p.id))
    .filter((p): p is Project => p !== undefined);
}

/** Why a project can't be started now, or null. */
export function projectBlocked(content: Content, state: RunState, id: string): string | null {
  const p = content.projects.find((x) => x.id === id);
  if (!p) return `unknown project ${id}`;
  if (state.era < p.era) return `${p.name} can be started from era ${p.era}`;
  if (state.projects.some((x) => x.id === id)) return `${p.name} is already started`;
  for (const [res, n] of Object.entries(p.cost) as [Resource, number][]) {
    if (state.stores[res] < n) return `${p.name} needs ${n} ${res}`;
  }
  return null;
}

/** Finishes projects whose last season was the one just resolved; returns their ids. */
export function finishProjects(content: Content, state: RunState): string[] {
  const done: string[] = [];
  for (const p of state.projects) {
    const def = content.projects.find((x) => x.id === p.id);
    if (!def || p.done !== null || state.turn < p.started + def.seasons - 1) continue;
    p.done = state.turn;
    done.push(p.id);
    if (def.effect.heal > 0) heal(content, state, def.effect.heal);
  }
  return done;
}

/** Improves the least healthy healable tiles one step each. */
function heal(content: Content, state: RunState, count: number): void {
  const ladder = content.rules.landHealth;
  const tiles = Object.values(state.map.tiles)
    .filter((t) => ladder.includes(t.type) && ladder.indexOf(t.type) < ladder.length - 1)
    .sort(
      (a, b) =>
        ladder.indexOf(a.type) - ladder.indexOf(b.type) || hexKey(a).localeCompare(hexKey(b)),
    );
  for (const t of tiles.slice(0, count)) improveTile(content, t, 1);
}
