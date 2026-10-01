/**
 * Projections for the interface: how a season would go with the settlement as
 * it stands. Used for the current season (what ending it now would do) and for
 * the rest of the year on the year strip ("these buildings, in winter").
 */
import type { Content } from './content/load';
import { SEASONS, type Season } from './content/schema';
import { eraOf, seasonIndex } from './queries';
import { resolveSeason, type ResolveOptions } from './season/resolve';
import { snapshot } from './snapshot';
import type { RunState, SeasonReport } from './types';

export function projectSeason(
  content: Content,
  state: RunState,
  season: Season,
  options: ResolveOptions = {},
): SeasonReport {
  const ahead =
    (SEASONS.indexOf(season) - seasonIndex(state.season) + SEASONS.length) % SEASONS.length;
  const turn = state.turn + ahead;
  const si = SEASONS.indexOf(season);
  const s: RunState = {
    ...snapshot(state),
    turn,
    year: Math.floor(turn / SEASONS.length) + 1,
    season,
    era: eraOf(content, turn),
    forecast: { event: content.calendar[si]!, next: content.calendar[(si + 1) % SEASONS.length]! },
    seasonStart: null,
    seasonCommands: [],
  };
  return resolveSeason(content, s, options).lastReport!;
}
