/** The draft: each season, pick 1 of 3 cards (blueprints and tunings); charters at some eras. */
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

/** Tunings not taken yet. They share the draft with blueprints. */
export function tuningPool(content: Content, state: RunState, exclude: string[] = []): string[] {
  return content.tunings
    .map((t) => t.id)
    .filter((id) => !state.tunings.includes(id) && !exclude.includes(id));
}

export function isTuning(content: Content, card: string): boolean {
  return content.tuningById[card] !== undefined;
}

/** Charters on offer at the start of an era: some not yet chosen, at random. */
export function dealCharters(content: Content, state: RunState): string[] {
  const pool = content.charters.map((c) => c.id).filter((id) => !state.charters.includes(id));
  return shuffled(state.rng, pool).slice(0, content.rules.charterChoices);
}

export function drawCards(
  content: Content,
  state: RunState,
  count: number,
  exclude: string[] = [],
) {
  const pool = [...blueprintPool(content, state, exclude), ...tuningPool(content, state, exclude)];
  return shuffled(state.rng, pool).slice(0, count);
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
