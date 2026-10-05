/**
 * Lake Gardens' lake for the interface (LG4): the grey water it holds and whether it will bloom,
 * the mud on each shallows tile, silted tiles, the Floating Garden's open pool, where water comes
 * into the lake, and what the season did to it. Pure functions of the run and its forecast
 * (`insight.now`), so every line can be tested.
 */
import { keptOpen } from '../sim/combos';
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import { SEASONS } from '../sim/content/schema';
import type { LakeReport, RunState, SeasonReport, WaterUnits } from '../sim/types';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "2 grey and 1 nutrient water", leaving out what is 0. */
function waterParts(u: WaterUnits): string {
  const parts = (['clean', 'grey', 'nutrient'] as const)
    .filter((q) => u[q] > 0)
    .map((q) => `${u[q]} ${q}`);
  if (parts.length === 0) return 'no water';
  const last = parts.pop()!;
  return `${parts.length ? `${parts.join(', ')} and ` : ''}${last} water`;
}

/** Lines about the lake for the tile at `at` (and the building on it). */
export function lakeAt(
  content: Content,
  state: RunState,
  now: SeasonReport | null,
  at: Hex,
): string[] {
  const rules = content.rules.lake;
  if (!rules || !state.lake) return [];
  const key = hexKey(at);
  const tile = state.map.tiles[key];
  if (!tile) return [];
  const lines: string[] = [];
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === key);
  if (tile.type === 'shallows') {
    const mud = tile.mud ?? 0;
    if (keptOpen(content, state).has(key))
      lines.push("The Floating Garden's open pool: no mud settles here, and it never silts.");
    if (tile.silted)
      lines.push(
        `Silted up with ${mud} mud: nothing can be built here and it is no water until a mud boat beside it lifts the mud.`,
      );
    else if (mud > 0)
      lines.push(
        rules.silts
          ? `Mud: ${mud} of ${rules.siltAt} (it silts up at ${rules.siltAt}). A mud boat beside it lifts it as compost.`
          : `Mud: ${mud}; the shallows silt up no more. A mud boat beside it lifts it as compost.`,
      );
  }
  if (tile.type === 'bed' && !b) lines.push('A raised bed, land made from the lake: as meadow.');
  const into = now?.water?.lakeIn?.[key];
  if (into) {
    const settles = now?.lake?.settled[key] ?? 0;
    lines.push(
      `${waterParts(into)} comes into the lake here this season${settles > 0 ? `, leaving ${settles} mud` : ''}.`,
    );
  }
  if (!b) return lines;
  const def = content.byId[b.type];
  const si = SEASONS.indexOf(state.season);
  if (def?.dredges && (def.dredges[si] ?? 0) > 0 && now?.lake && !now.lake.dredged[b.uid])
    lines.push('Nothing to lift: no mud on the shallows beside it this season.');
  if (def?.eatsGrey && now?.lake && !(now.math[b.uid] ?? []).some((l) => l.startsWith('lake: ate')))
    lines.push('No grey water left in the lake for it to eat this season.');
  return lines;
}

export interface LakeOutlook {
  /** Grey water the lake holds now, and at the season's end as things stand. */
  grey: number;
  after: number;
  /** It blooms above this, in the bloom seasons. */
  above: number;
  /** True if it will bloom this season, false if it won't, null if it can't this season. */
  blooms: boolean | null;
  /** Shallows tiles silted up, and the mud lying on the shallows. */
  silted: number;
  mud: number;
}

/** The lake as it stands and as this season will leave it, for the left panel. */
export function lakeOutlook(
  content: Content,
  state: RunState,
  now: SeasonReport | null,
): LakeOutlook | null {
  const rules = content.rules.lake;
  if (!rules || !state.lake) return null;
  const tiles = Object.values(state.map.tiles).filter((t) => t.type === 'shallows');
  const si = SEASONS.indexOf(state.season);
  return {
    grey: state.lake.grey,
    after: now?.lake?.grey ?? state.lake.grey,
    above: rules.bloom.above,
    blooms: rules.bloom.seasons[si] && now?.lake ? now.lake.bloom : null,
    silted: tiles.filter((t) => t.silted).length,
    mud: tiles.reduce((s, t) => s + (t.mud ?? 0), 0),
  };
}

/** A few words for the forecast banner: whether the lake will bloom. */
export function bloomSummary(o: LakeOutlook | null): string {
  if (!o || o.blooms === null) return '';
  return o.blooms
    ? `the lake will hold ${o.after} grey water: it will bloom`
    : `the lake will hold ${o.after}: it stays clear`;
}

/** The season's lake in a few sentences, for the season report. */
export function lakeNotes(content: Content, r: LakeReport): string[] {
  const rules = content.rules.lake;
  const lines: string[] = [];
  const parts = [`fisheries ate ${r.eaten}`, `it cleaned ${r.cleaned} itself`];
  lines.push(`${r.greyIn} grey water reached the lake; ${parts.join(', ')}; ${r.grey} left in it.`);
  if (r.bloom && rules)
    lines.push(
      `It bloomed: lake fisheries made ${rules.bloom.foodLoss} less food, and its grey water costs ${rules.bloom.harmonyFactor} times the Harmony.`,
    );
  const settled = Object.values(r.settled);
  if (settled.length > 0)
    lines.push(
      `Mud settled on ${plural(settled.length, 'shallows tile')}: ${settled.reduce((a, b) => a + b, 0)} in all.`,
    );
  const lifted = Object.values(r.dredged);
  if (lifted.length > 0)
    lines.push(
      `${lifted.length === 1 ? 'A mud boat' : `${lifted.length} mud boats`} lifted ${lifted.reduce((a, b) => a + b, 0)} mud onto the land as compost.`,
    );
  return lines;
}
