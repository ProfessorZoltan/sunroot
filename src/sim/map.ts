/**
 * Seeded map generation for a river-valley biome: a river runs north to south
 * with floodplain on both banks (broken by a few dry, hilly bluffs), hills at
 * the edges, ruins to salvage and a little surviving green land. Green land is
 * placed so the valley starts at exactly the biome's starting Harmony.
 */
import type { Content } from './content/load';
import type { CoastMapGen, HighlandMapGen, TileType, ValleyMapGen } from './content/schema';
import { hexDistance, hexKey, hexNeighbors, offsetToAxial, type Hex } from './hex';
import { chance, createRng, nextInt, shuffled, type RngState } from './rng';
import type { MapState, Tile } from './types';

export interface GeneratedMap {
  map: MapState;
  camp: Hex;
}

export function generateMap(content: Content, seed: string): GeneratedMap {
  const gen = content.map;
  if (gen.kind === 'coast') return generateCoast(content, gen, seed);
  if (gen.kind === 'highland') return generateHighland(content, gen, seed);
  return generateValley(content, gen, seed);
}

/**
 * A glen (the Highland): a stream from the top edge down the map, falling from
 * `streamTopHeight` to 0; the land rises a step for every `slopeWidth` tiles
 * out from it, to crags on the tops; bogs on the shoulders, old mine workings
 * on the slopes, the camp low by the stream, and green land summing to the
 * starting Harmony. The snowmelt reaches the glen floor beside the stream.
 */
function generateHighland(content: Content, gen: HighlandMapGen, seed: string): GeneratedMap {
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  const at = (col: number, row: number) => tiles[hexKey(offsetToAxial(col, row))];
  for (let row = 0; row < gen.height; row++)
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      tiles[hexKey(h)] = { ...h, type: 'barren' };
      order.push(hexKey(h));
    }
  const tile = (h: Hex) => tiles[hexKey(h)];

  // The stream, from the top edge down, wandering a column now and then; it falls as it goes.
  const [minCol, maxCol] = gen.streamColumns;
  let col = minCol + nextInt(rng, maxCol - minCol + 1);
  const river: string[] = [];
  const fall = (row: number) =>
    Math.max(0, gen.streamTopHeight - Math.floor((row * (gen.streamTopHeight + 1)) / gen.height));
  for (let row = 0; row < gen.height; row++) {
    if (row > 0 && chance(rng, 0.35))
      col = Math.max(1, Math.min(gen.width - 2, col + (chance(rng, 0.5) ? 1 : -1)));
    const t = at(col, row)!;
    t.type = 'river';
    t.riverIndex = river.length;
    t.height = fall(row);
    river.push(hexKey(t));
  }
  const stream = river.map((k) => tiles[k]!);
  const nearest = (t: Tile) =>
    stream.reduce((best, s) => (hexDistance(s, t) < hexDistance(best, t) ? s : best), stream[0]!);

  // The land rises a step for every `slopeWidth` tiles out from the stream.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'river') continue;
    const s = nearest(t);
    const d = hexDistance(s, t);
    const height = Math.min(3, (s.height ?? 0) + Math.floor((d - 1) / gen.slopeWidth));
    if (height > 0) t.height = height;
    if (height === 3 && chance(rng, gen.cragChance)) t.type = 'crag';
    else if (!chance(rng, gen.barrenChance)) t.type = 'scrub';
  }
  const heightOf = (t: Tile) => t.height ?? 0;
  const plain = (t: Tile) => t.type === 'barren' || t.type === 'scrub';

  // Bogs on the shoulders (heights 1 and 2), away from the stream.
  let bogsLeft = gen.bogs;
  for (const key of shuffled(rng, order)) {
    if (bogsLeft === 0) break;
    const t = tiles[key]!;
    if (!plain(t) || heightOf(t) < 1 || heightOf(t) > 2) continue;
    if (hexNeighbors(t).some((n) => tile(n)?.type === 'river' || tile(n)?.type === 'bog')) continue;
    t.type = 'bog';
    bogsLeft--;
  }

  // Old mine workings on the slopes, never touching each other.
  let ruinsLeft = gen.ruins;
  for (const key of shuffled(rng, order)) {
    if (ruinsLeft === 0) break;
    const t = tiles[key]!;
    if (!plain(t) || heightOf(t) < 1 || heightOf(t) > 2) continue;
    if (hexNeighbors(t).some((n) => tile(n)?.type === 'ruin' || tile(n)?.type === 'river'))
      continue;
    t.type = 'ruin';
    t.salvage = gen.ruinSalvage;
    ruinsLeft--;
  }

  // The camp: plain land low in the glen, a short walk from the stream, mid-way down.
  const [nearestCamp, farthestCamp] = gen.campStreamDistance;
  const midRows = (r: number) => r >= gen.height / 4 && r < (gen.height * 3) / 4;
  const campOptions = order.filter((key) => {
    const t = tiles[key]!;
    const d = hexDistance(nearest(t), t);
    return plain(t) && heightOf(t) <= 1 && d >= nearestCamp && d <= farthestCamp && midRows(t.r);
  });
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  const camp = tiles[campKey]!;
  camp.type = 'scrub';

  placeGreenLand(content, rng, tiles, order, campKey);

  // The snowmelt reaches the glen floor beside the stream, highest up the stream first.
  const floodOrder = order
    .filter((k) => {
      const t = tiles[k]!;
      return (
        k !== campKey &&
        t.type !== 'river' &&
        heightOf(t) === 0 &&
        hexNeighbors(t).some((n) => tile(n)?.type === 'river')
      );
    })
    .sort(
      (a, b) =>
        (nearest(tiles[a]!).riverIndex ?? 0) - (nearest(tiles[b]!).riverIndex ?? 0) ||
        order.indexOf(a) - order.indexOf(b),
    );

  return {
    map: { width: gen.width, height: gen.height, tiles, river, floodOrder },
    camp: { q: camp.q, r: camp.r },
  };
}

function generateValley(content: Content, gen: ValleyMapGen, seed: string): GeneratedMap {
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

/**
 * A coast (the Windswept Coast): the sea along the east edge with a wandering
 * shore, headlands reaching out into it, mudflat or dunes on the shore with
 * saltmarsh behind the mudflat, a stream from the west edge down to the sea
 * (its mouth an estuary of mudflat), damaged land inland with a few ruins of
 * an old harbour, and green land summing to the starting Harmony.
 */
function generateCoast(content: Content, gen: CoastMapGen, seed: string): GeneratedMap {
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  const at = (col: number, row: number) => tiles[hexKey(offsetToAxial(col, row))];
  for (let row = 0; row < gen.height; row++) {
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      tiles[hexKey(h)] = { ...h, type: 'barren' };
      order.push(hexKey(h));
    }
  }
  const tile = (h: Hex) => tiles[hexKey(h)];

  // The sea: the east columns, the shore wandering a column either way from row to row.
  const base = gen.width - gen.seaColumns;
  let shore = base;
  const shoreCol: number[] = [];
  for (let row = 0; row < gen.height; row++) {
    shoreCol.push(shore);
    for (let col = shore; col < gen.width; col++) at(col, row)!.type = 'sea';
    const step = nextInt(rng, 3) - 1;
    shore = Math.max(base - 1, Math.min(base + 1, shore + step));
  }

  // Headlands: a rocky spur from the shore out into the sea.
  const rows = shuffled(
    rng,
    Array.from({ length: Math.max(0, gen.height - 4) }, (_, i) => i + 2),
  ).filter((r, i, all) => all.slice(0, i).every((o) => Math.abs(o - r) >= gen.headlandSpacing));
  for (const row of rows.slice(0, gen.headlands)) {
    const from = shoreCol[row]! - 1;
    for (let col = from; col < Math.min(gen.width - 1, from + 1 + gen.headlandLength); col++)
      at(col, row)!.type = 'hill';
  }

  // The stream: from the west edge, east to the sea, wandering a row now and then.
  const [minRow, maxRow] = gen.streamRows;
  let row = minRow + nextInt(rng, maxRow - minRow + 1);
  const river: string[] = [];
  for (let col = 0; col < gen.width; col++) {
    const t = at(col, row)!;
    if (t.type === 'sea') break;
    if (t.type === 'hill') {
      // Round a headland's root.
      row = Math.min(gen.height - 2, row + 1);
      continue;
    }
    t.type = 'river';
    t.riverIndex = river.length;
    river.push(hexKey(t));
    if (col > 1 && chance(rng, 0.3)) {
      const next = Math.max(1, Math.min(gen.height - 2, row + (chance(rng, 0.5) ? 1 : -1)));
      if (next !== row && at(col, next)!.type === 'barren') {
        row = next;
        const s = at(col, row)!;
        s.type = 'river';
        s.riverIndex = river.length;
        river.push(hexKey(s));
      }
    }
  }

  // Distance to the sea, over the map.
  const seaDistance = new Map<string, number>();
  const queue = order.filter((k) => tiles[k]!.type === 'sea');
  for (const k of queue) seaDistance.set(k, 0);
  for (let i = 0; i < queue.length; i++) {
    const t = tiles[queue[i]!]!;
    for (const n of hexNeighbors(t)) {
      const k = hexKey(n);
      if (!tiles[k] || seaDistance.has(k)) continue;
      seaDistance.set(k, seaDistance.get(queue[i]!)! + 1);
      queue.push(k);
    }
  }
  const fromSea = (t: Tile) => seaDistance.get(hexKey(t)) ?? Infinity;

  // The shore: mudflat or dune; the stream's mouth is an estuary of mudflat.
  const mouth = river.length > 0 ? tiles[river.at(-1)!]! : undefined;
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type !== 'barren' || fromSea(t) !== 1) continue;
    const rocky = hexNeighbors(t).some((n) => tile(n)?.type === 'hill');
    const estuary = mouth !== undefined && hexDistance(t, mouth) <= 1;
    t.type = estuary || (!rocky && chance(rng, gen.mudflatChance)) ? 'mudflat' : 'dune';
  }
  // Behind the shore: saltmarsh behind mudflat, dunes behind dunes.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type !== 'barren' || fromSea(t) !== 2) continue;
    const behind = hexNeighbors(t).map((n) => tile(n)?.type);
    if (behind.includes('mudflat') && chance(rng, gen.saltmarshChance)) t.type = 'saltmarsh';
    else if (behind.includes('dune') && chance(rng, gen.duneChance)) t.type = 'dune';
  }

  // Damaged land inland: barren or scrub.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'barren' && !chance(rng, gen.barrenChance)) t.type = 'scrub';
  }
  const isPlainLand = (t: Tile) => t.type === 'barren' || t.type === 'scrub';

  // The old harbour's ruins, a little way back from the sea, never touching each other.
  let ruinsLeft = gen.ruins;
  for (const key of shuffled(rng, order)) {
    if (ruinsLeft === 0) break;
    const t = tiles[key]!;
    if (!isPlainLand(t) || fromSea(t) < 2 || fromSea(t) > 4) continue;
    if (hexNeighbors(t).some((n) => tile(n)?.type === 'ruin' || tile(n)?.type === 'river'))
      continue;
    t.type = 'ruin';
    t.salvage = gen.ruinSalvage;
    ruinsLeft--;
  }

  // The Founders' Camp: plain land a short walk from the sea, mid-coast.
  const [nearest, farthest] = gen.campSeaDistance;
  const midRows = (r: number) => r >= gen.height / 4 && r < (gen.height * 3) / 4;
  const campOptions = order.filter((key) => {
    const t = tiles[key]!;
    const d = fromSea(t);
    return isPlainLand(t) && d >= nearest && d <= farthest && midRows(t.r);
  });
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  const camp = tiles[campKey]!;
  camp.type = 'scrub';

  placeGreenLand(content, rng, tiles, order, campKey);

  // The king tide reaches the mudflat, then the saltmarsh beside it, nearest the sea first; with
  // a longer reach (Big Tides), the low land a ring or more further, never the camp.
  const mudflats = order.filter((k) => tiles[k]!.type === 'mudflat').map((k) => tiles[k]!);
  const fromMudflat = (t: Tile) => Math.min(...mudflats.map((m) => hexDistance(m, t)));
  const low = ['saltmarsh', 'dune', 'scrub', 'barren', 'meadow'];
  const floodOrder = order
    .filter((k) => {
      const t = tiles[k]!;
      if (t.type === 'mudflat') return true;
      if (k === campKey) return false;
      const d = fromMudflat(t);
      if (gen.kingTideReach === 1) return d === 1 && t.type === 'saltmarsh';
      return d <= gen.kingTideReach && low.includes(t.type);
    })
    .sort((a, b) => fromSea(tiles[a]!) - fromSea(tiles[b]!) || order.indexOf(a) - order.indexOf(b));

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
