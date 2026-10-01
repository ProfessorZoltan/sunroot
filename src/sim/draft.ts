/** The draft: each season, pick 1 of 3 cards (blueprints and tunings); charters at some eras. */
import type { Content } from './content/load';
import { seasonIndex } from './queries';
import { shuffled } from './rng';
import type { RunState } from './types';

/**
 * Cards a Root City district adds to future drafts are offered only in runs
 * whose city has that district.
 */
export function cardAllowed(content: Content, state: RunState, card: string): boolean {
  const from = content.districts.filter((d) => d.adds === card);
  if (from.length === 0) return true;
  const districts = state.options.city?.districts ?? {};
  return from.some((d) => districts[d.id] !== undefined);
}

/** Blueprints that could still be offered this era. */
export function blueprintPool(content: Content, state: RunState, exclude: string[] = []): string[] {
  return content.buildings
    .filter(
      (b) =>
        b.draftable &&
        !b.starter &&
        b.minEra <= state.era &&
        !state.unlocked.includes(b.id) &&
        !exclude.includes(b.id) &&
        cardAllowed(content, state, b.id),
    )
    .map((b) => b.id);
}

/** Tunings not taken yet. They share the draft with blueprints, once the run has tunings. */
export function tuningPool(content: Content, state: RunState, exclude: string[] = []): string[] {
  if (state.options.tunings === false) return [];
  return content.tunings
    .map((t) => t.id)
    .filter(
      (id) =>
        !state.tunings.includes(id) && !exclude.includes(id) && cardAllowed(content, state, id),
    );
}

export function isTuning(content: Content, card: string): boolean {
  return content.tuningById[card] !== undefined;
}

/** Charters on offer at the start of an era: some not yet chosen, at random. */
export function dealCharters(content: Content, state: RunState): string[] {
  if (state.options.charters === false) return [];
  const pool = content.charters
    .map((c) => c.id)
    .filter((id) => !state.charters.includes(id) && cardAllowed(content, state, id));
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
