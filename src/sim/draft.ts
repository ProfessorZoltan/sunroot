/** The draft: each season, pick 1 of 3 blueprint cards. */
import type { Content } from './content/load';
import { seasonIndex } from './queries';
import { shuffled } from './rng';
import type { RunState } from './types';

/** Blueprints that could still be offered this era. */
export function blueprintPool(content: Content, state: RunState, exclude: string[] = []): string[] {
  return content.buildings
    .filter(
      (b) =>
        b.draftable &&
        !b.starter &&
        b.minEra <= state.era &&
        !state.unlocked.includes(b.id) &&
        !exclude.includes(b.id),
    )
    .map((b) => b.id);
}

export function drawCards(
  content: Content,
  state: RunState,
  count: number,
  exclude: string[] = [],
) {
  return shuffled(state.rng, blueprintPool(content, state, exclude)).slice(0, count);
}

/** Deals the season's offer: fixed cards in the guided first year, otherwise random. */
export function dealOffer(content: Content, state: RunState): string[] {
  if (state.options.guided && state.year === 1) {
    return content.guidedYear[seasonIndex(state.season)]!.filter(
      (id) => !state.unlocked.includes(id),
    );
  }
  return drawCards(content, state, content.rules.draftCards);
}
