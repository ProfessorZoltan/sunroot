/**
 * Seeded map generation for a river-valley biome: a river runs north to south
 * with floodplain on both banks (broken by a few dry, hilly bluffs), hills at
 * the edges, ruins to salvage and a little surviving green land. Green land is
 * placed so the valley starts at exactly the biome's starting Harmony.
 */
import type { Content } from './content/load';
import type { TileType } from './content/schema';
import { hexDistance, hexKey, hexNeighbors, offsetToAxial, type Hex } from './hex';
import { chance, createRng, nextInt, shuffled, type RngState } from './rng';
import type { MapState, Tile } from './types';

export interface GeneratedMap {
  map: MapState;
  camp: Hex;
}

export function generateMap(content: Content, seed: string): GeneratedMap {
  const gen = content.map;
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  for (let row = 0; row < gen.height; row++) {
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      const key = hexKey(h);
      tiles[key] = { ...h, type: 'barren' };
      order.push(key);
    }
  }
  const tile = (h: Hex) => tiles[hexKey(h)];
  const colOf = (key: string) => order.indexOf(key) % gen.width;

  // River: one tile per row, stepping to a lower neighbour each row.
  const [minCol, maxCol] = gen.riverColumns;
  let col = minCol + nextInt(rng, maxCol - minCol + 1);
  const river: string[] = [];
  const riverCol: number[] = [];
  for (let row = 0; row < gen.height; row++) {
    const h = offsetToAxial(col, row);
    const t = tiles[hexKey(h)]!;
    t.type = 'river';
    t.riverIndex = row;
    river.push(hexKey(h));
    riverCol.push(col);
    // In odd-r offset, the tiles below (col, row) are col-1/col on even rows and col/col+1 on odd rows.
    const down = row % 2 === 0 ? [col - 1, col] : [col, col + 1];
    const options = down.filter((c) => c >= minCol && c <= maxCol);
    col = options.length > 0 ? options[nextInt(rng, options.length)]! : col;
  }
  const riverHexes = river.map((k) => tiles[k]!);
  const riverDistance = (h: Hex) => Math.min(...riverHexes.map((r) => hexDistance(h, r)));

  // Bluffs: short stretches of one bank that stand above the flood.
  const bluff = new Set<string>();
  for (let i = 0; i < gen.bluffs; i++) {
    const startRow = nextInt(rng, Math.max(1, gen.height - gen.bluffLength + 1));
    const east = chance(rng, 0.5);
    for (let row = startRow; row < startRow + gen.bluffLength && row < gen.height; row++) {
      bluff.add(`${row}:${east ? 'e' : 'w'}`);
    }
  }
  const bankSide = (key: string): string => {
    const t = tiles[key]!;
    return `${t.r}:${colOf(key) > riverCol[t.r]! ? 'e' : 'w'}`;
  };

  const width = gen.floodplainWidth;
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'river') continue;
    const d = riverDistance(t);
    // Bluffs are steep, dry banks: hills right on the river (where a pumped reservoir can go).
    if (d === 1) t.type = bluff.has(bankSide(key)) ? 'hill' : 'floodplain';
    else if (d <= width && !bluff.has(bankSide(key))) t.type = 'floodplain';
  }
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type !== 'barren' || riverDistance(t) !== width + 1 || bluff.has(bankSide(key))) continue;
    const touchesFloodplain = hexNeighbors(t).some((n) => tile(n)?.type === 'floodplain');
    if (touchesFloodplain && chance(rng, gen.farFloodplainChance)) t.type = 'floodplain';
  }

  // Oxbow lakes: still water a little way from the river, ringed with floodplain.
  for (let i = 0; i < gen.lakes; i++) {
    const nearLake = (h: Hex) =>
      order.some((k) => tiles[k]!.type === 'reservoir' && hexDistance(h, tiles[k]!) <= 3);
    const sites = order.filter((key) => {
      const t = tiles[key]!;
      const d = riverDistance(t);
      return (
        t.type === 'barren' && d >= 2 && d <= 3 && t.r >= 1 && t.r < gen.height - 1 && !nearLake(t)
      );
    });
    if (sites.length === 0) break;
    const lake = [tiles[sites[nextInt(rng, sites.length)]!]!];
    while (lake.length < gen.lakeSize) {
      const grow = lake
        .flatMap((h) => hexNeighbors(h))
        .map((n) => tile(n))
        .filter(
          (n): n is Tile =>
            n !== undefined &&
            (n.type === 'barren' || n.type === 'floodplain') &&
            riverDistance(n) >= 2 &&
            !lake.includes(n),
        );
      if (grow.length === 0) break;
      lake.push(grow[nextInt(rng, grow.length)]!);
    }
    for (const t of lake) t.type = 'reservoir';
    for (const t of lake)
      for (const n of hexNeighbors(t)) {
        const nt = tile(n);
        if (nt?.type === 'barren') nt.type = 'floodplain';
      }
  }

  // Hills at the valley edges.
  for (const key of order) {
    const t = tiles[key]!;
    const c = colOf(key);
    const edge = c < gen.hillColumns || c >= gen.width - gen.hillColumns;
    if (t.type === 'barren' && edge && riverDistance(t) >= 3 && chance(rng, gen.hillChance)) {
      t.type = 'hill';
    }
  }

  // Damaged land: barren or scrub.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'barren' && !chance(rng, gen.barrenChance)) t.type = 'scrub';
  }

  const isPlainLand = (t: Tile) => t.type === 'barren' || t.type === 'scrub';

  // Ruins, never touching each other or the river.
  let ruinsLeft = gen.ruins;
  for (const key of shuffled(rng, order)) {
    if (ruinsLeft === 0) break;
    const t = tiles[key]!;
    if (!isPlainLand(t) || riverDistance(t) < 2) continue;
    if (hexNeighbors(t).some((n) => tile(n)?.type === 'ruin')) continue;
    t.type = 'ruin';
    t.salvage = gen.ruinSalvage;
    ruinsLeft--;
  }

  // The Founders' Camp: plain land a short walk from the river, mid-valley.
  const [nearest, farthest] = gen.campRiverDistance;
  const midRows = (r: number) => r >= gen.height / 4 && r < (gen.height * 3) / 4;
  const campOptions = order.filter((key) => {
    const t = tiles[key]!;
    const d = riverDistance(t);
    return isPlainLand(t) && d >= nearest && d <= farthest && midRows(t.r);
  });
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  const camp = tiles[campKey]!;
  camp.type = 'scrub';

  placeGreenLand(content, rng, tiles, order, campKey);

  const floodOrder = order
    .filter((k) => tiles[k]!.type === 'floodplain')
    .map((k) => ({ k, d: riverDistance(tiles[k]!) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.k);

  return {
    map: { width: gen.width, height: gen.height, tiles, river, floodOrder },
    camp: { q: camp.q, r: camp.r },
  };
}

/** Surviving woodland groves with meadow around them, summing to the starting Harmony. */
function placeGreenLand(
  content: Content,
  rng: RngState,
  tiles: Record<string, Tile>,
  order: string[],
  campKey: string,
): void {
  const gen = content.map;
  const perTile = content.rules.harmony.perTile;
  const woodValue = perTile.woodland ?? 0;
  const meadowValue = perTile.meadow ?? 0;
  const candidates = () =>
    order.filter((k) => {
      const t = tiles[k]!;
      return k !== campKey && (t.type === 'barren' || t.type === 'scrub');
    });

  let remaining = gen.startingHarmony;
  const groves: string[] = [];
  for (let i = 0; i < gen.woodlands && remaining >= woodValue && woodValue > 0; i++) {
    const options = candidates();
    if (options.length === 0) break;
    const key = options[nextInt(rng, options.length)]!;
    tiles[key]!.type = 'woodland';
    groves.push(key);
    remaining -= woodValue;
  }
  if (meadowValue <= 0 || remaining % meadowValue !== 0) {
    throw new Error('starting Harmony cannot be reached with meadow tiles');
  }
  let meadows = remaining / meadowValue;
  const groveHexes = groves.map((k) => tiles[k]!);
  const nearGrove = (t: Tile) => groveHexes.some((g) => hexDistance(g, t) <= 2);
  while (meadows > 0) {
    const options = candidates();
    if (options.length === 0) throw new Error('not enough land for starting meadows');
    const preferred = options.filter((k) => nearGrove(tiles[k]!));
    const pool = preferred.length > 0 ? preferred : options;
    const key = pool[nextInt(rng, pool.length)]!;
    tiles[key]!.type = 'meadow' satisfies TileType;
    meadows--;
  }
}
