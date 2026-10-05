/**
 * Rainforest Gardens' soil and layers (proposals/rainforest-gardens.md, The new rules), the parts
 * commands and the interface need as well as the season: a tile's fertility, a building's grown
 * layers, whether one can be added, and compost feeding a field. Off without `rules.forest`.
 */
import type { Content } from './content/load';
import type { LayerDef, TileType } from './content/schema';
import { hexKey } from './hex';
import { defOf } from './queries';
import type { BuildingState, RunState, Tile } from './types';

/** The tile's fertility, or null outside the forest rules. */
export function fertilityOf(content: Content, tile: Tile): number | null {
  const rules = content.rules.forest;
  if (!rules) return null;
  return tile.fertility ?? rules.fertility[tile.type] ?? 0;
}

/** The layers added to `b`, each with its definition and whether it has grown. */
export function layersOf(
  content: Content,
  state: RunState,
  b: BuildingState,
): { def: LayerDef; turn: number; grown: boolean; age: number }[] {
  const defs = defOf(content, b).layers ?? [];
  return (b.layers ?? []).flatMap((l) => {
    const def = defs.find((d) => d.id === l.id);
    if (!def) return [];
    const age = state.turn - l.turn;
    return [{ def, turn: l.turn, grown: age >= def.grows, age }];
  });
}

/** True if a grown layer covers the building's tile (a canopy): the monsoon leaves it be. */
export function covered(content: Content, state: RunState, b: BuildingState): boolean {
  return layersOf(content, state, b).some((l) => l.grown && l.def.covers);
}

/** Why the layer can't be added to the building now, or null if it can. */
export function layerProblem(
  content: Content,
  state: RunState,
  uid: string,
  layer: string,
): string | null {
  const b = state.buildings[uid];
  if (!b) return 'no such building';
  const def = defOf(content, b);
  if (!def.layers) return `the ${def.name} takes no layers`;
  const l = def.layers.find((x) => x.id === layer);
  if (!l) return `the ${def.name} has no ${layer} layer`;
  const name = l.name.toLowerCase();
  if (b.layers?.some((x) => x.id === layer)) return `the ${def.name} has its ${name} already`;
  if (b.builtTurn === state.turn || b.layers?.some((x) => x.turn === state.turn))
    return `the ${def.name} takes one layer a season: add its ${name} next season`;
  if (state.stores.materials < l.cost) return `the ${name} costs ${l.cost} materials`;
  return null;
}

/** The building on the tile, if it is farmland. */
function farmOn(content: Content, state: RunState, tile: Tile): BuildingState | undefined {
  const key = hexKey(tile);
  return Object.values(state.buildings).find(
    (b) => hexKey(b.at) === key && defOf(content, b).farmland,
  );
}

/**
 * Compost spread on a farmed tile feeds its soil: 1 more fertility, up to the most. Returns true
 * if it did (outside the forest rules, never).
 */
export function feedSoil(content: Content, state: RunState, tile: Tile): boolean {
  const rules = content.rules.forest;
  if (!rules || rules.keeps.includes(tile.type) || !farmOn(content, state, tile)) return false;
  const f = fertilityOf(content, tile)!;
  if (f >= rules.maxFertility) return false;
  tile.fertility = f + 1;
  return true;
}

/** A building that burns its tile clear (a milpa on rainforest): the field and its ash. */
export function burnClear(content: Content, tile: Tile, burns: { from: TileType[]; to: TileType }) {
  const rules = content.rules.forest;
  if (!rules || !burns.from.includes(tile.type)) return false;
  tile.type = burns.to;
  tile.fertility = rules.ash;
  return true;
}
