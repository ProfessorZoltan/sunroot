/**
 * Rainforest Gardens for the interface (FG4): a field's fertility and what the monsoon will do to
 * it, dark earth, a forest garden's layers (grown, growing, or to add), a midden's way to dark
 * earth, where the dry season's fire could catch, and what the season did to the forest. Pure
 * functions of the run and its forecast (`insight.now`), so every line can be tested.
 */
import { covered, fertilityOf, layerProblem, layersOf } from '../sim/forest';
import { fireStopped } from '../sim/combos';
import { hexKey, type Hex } from '../sim/hex';
import type { Content } from '../sim/content/load';
import type { ForestReport, RunState, SeasonReport } from '../sim/types';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Lines about the forest for the tile at `at` (and the building on it). */
export function forestAt(
  content: Content,
  state: RunState,
  now: SeasonReport | null,
  at: Hex,
): string[] {
  const rules = content.rules.forest;
  if (!rules) return [];
  const key = hexKey(at);
  const tile = state.map.tiles[key];
  if (!tile) return [];
  const lines: string[] = [];
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === key);
  const def = b ? content.byId[b.type] : undefined;
  if (tile.type === 'darkEarth')
    lines.push(
      `Dark earth: it keeps its fertility for good, and a farm on it makes ${rules.darkEarthFood} more food.`,
    );
  // A field's fertility, and what the rain will do to it.
  if (b && def?.farmland) {
    const f = fertilityOf(content, tile)!;
    const keeps = rules.keeps.includes(tile.type);
    lines.push(
      f === 0
        ? `No fertility left: it makes ×${rules.bareFactor} food, and each monsoon wears its land a step down.`
        : `Fertility ${f} of ${rules.maxFertility}${def.fertilityFood > 0 ? `: +${f * def.fertilityFood} food` : ''}.`,
    );
    if (!keeps && covered(content, state, b))
      lines.push('Covered by its trees: the monsoon washes none of it out.');
    if (now?.forest?.leached.includes(key))
      lines.push('The monsoon will wash 1 fertility out of it this season. Compost puts it back.');
    if (now?.forest?.wornOut.includes(key))
      lines.push('This monsoon wears its land a step down: it has no fertility left.');
  }
  if (now?.fireRisk?.includes(key))
    lines.push(
      'Fire may catch here this dry season, from the cleared ground beside it. A living fence along that edge keeps it out.',
    );
  if (!b || !def) return lines;
  // A forest garden's layers.
  const layers = layersOf(content, state, b);
  for (const l of layers)
    lines.push(
      l.grown ? `${l.def.name}: grown.` : `${l.def.name}: growing, ${l.age} of ${l.grows} seasons.`,
    );
  // A midden on its way to dark earth.
  const m = def.midden;
  if (m) {
    const fed = now?.forest?.middens[b.uid];
    lines.push(
      fed !== undefined
        ? `Dark earth: ${fed} of ${m.seasons} seasons, fed this season.`
        : `Dark earth: ${b.darkening ?? 0} of ${m.seasons} seasons; not fed this season (it needs ${m.scraps} scraps and a char hearth burning within ${m.range}).`,
    );
  }
  return lines;
}

export interface LayerChoice {
  id: string;
  name: string;
  cost: number;
  /** Added already: grown, or how far it has grown. */
  added: boolean;
  grown: boolean;
  /** Why it can't be added now (null if it can, or if it is added already). */
  problem: string | null;
}

/** The layers a building takes, for the inspector: each added, growing, or to add. */
export function layerChoices(content: Content, state: RunState, uid: string): LayerChoice[] {
  const b = state.buildings[uid];
  const defs = b ? content.byId[b.type]?.layers : undefined;
  if (!b || !defs) return [];
  const had = layersOf(content, state, b);
  return defs.map((d) => {
    const l = had.find((x) => x.def.id === d.id);
    return {
      id: d.id,
      name: d.name,
      cost: d.cost,
      added: l !== undefined,
      grown: l?.grown ?? false,
      problem: l ? null : layerProblem(content, state, uid, d.id),
    };
  });
}

export interface ForestOutlook {
  /** Farmed fields, those with no fertility left, and those the monsoon will wash this season. */
  fields: number;
  bare: number;
  washing: number;
  darkEarth: number;
  /** Tiles the dry season's fire could catch this season (0 outside it); whether none can. */
  fireRisk: number;
  fireStopped: boolean;
}

/** The forest as it stands and as this season will leave it, for the left panel. */
export function forestOutlook(
  content: Content,
  state: RunState,
  now: SeasonReport | null,
): ForestOutlook | null {
  if (!content.rules.forest) return null;
  const fields = Object.values(state.buildings)
    .filter((b) => content.byId[b.type]?.farmland)
    .map((b) => state.map.tiles[hexKey(b.at)]!);
  return {
    fields: fields.length,
    bare: fields.filter((t) => fertilityOf(content, t) === 0).length,
    washing: now?.forest?.leached.length ?? 0,
    darkEarth: Object.values(state.map.tiles).filter((t) => t.type === 'darkEarth').length,
    fireRisk: now?.fireRisk?.length ?? 0,
    fireStopped: fireStopped(content, state),
  };
}

/** A few words for the forecast banner: the monsoon's washing, or the dry season's fire. */
export function forestSummary(o: ForestOutlook | null, event: string): string {
  if (!o) return '';
  if (event === 'fire')
    return o.fireStopped
      ? 'the Living Mosaic: no fire can start'
      : o.fireRisk > 0
        ? `fire could catch on ${plural(o.fireRisk, 'tile')}`
        : 'no forest beside a field: no fire';
  if (o.washing > 0) return `${plural(o.washing, 'field')} will lose fertility`;
  return '';
}

/** The season's forest in a few sentences, for the season report. */
export function forestNotes(
  r: ForestReport,
  burned: string[] = [],
  felled: string[] = [],
  healed: string[] = [],
): string[] {
  const lines: string[] = [];
  if (r.leached.length > 0)
    lines.push(`The rain washed 1 fertility out of ${plural(r.leached.length, 'field')}.`);
  if (r.wornOut.length > 0)
    lines.push(
      `${plural(r.wornOut.length, 'field')} with no fertility left wore a step down the land.`,
    );
  const fed = Object.keys(r.middens).length;
  if (fed > 0) lines.push(`${plural(fed, 'kitchen midden')} fed, on the way to dark earth.`);
  if (r.darkened.length > 0)
    lines.push(`${plural(r.darkened.length, 'tile')} turned to dark earth, for good.`);
  if (burned.length > 0)
    lines.push(`Fire burned ${plural(burned.length, 'tile')} of rainforest to scrub.`);
  if (felled.length > 0)
    lines.push(`The cyclone felled the canopy of ${plural(felled.length, 'forest garden')}.`);
  if (healed.length > 0)
    lines.push(
      `The hornbills dropped seed at the forest's edge: ${plural(healed.length, 'tile')} healed a step.`,
    );
  return lines;
}
