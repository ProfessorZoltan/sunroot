/**
 * Seeded map generation for a river-valley biome: a river runs north to south
 * with floodplain on both banks (broken by a few dry, hilly bluffs), hills at
 * the edges, ruins to salvage and a little surviving green land. Green land is
 * placed so the valley starts at exactly the biome's starting Harmony.
 */
import type { Content } from './content/load';
import type {
  CoastMapGen,
  DesertMapGen,
  ForestMapGen,
  HighlandMapGen,
  MapGen,
  LakeMapGen,
  TileType,
  ValleyMapGen,
} from './content/schema';
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
  if (gen.kind === 'desert') return generateDesert(content, gen, seed);
  if (gen.kind === 'lake') return generateLake(content, gen, seed);
  if (gen.kind === 'forest') return generateForest(content, gen, seed);
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

  // Mountain tarns (the Corrie Lochs): 2 tiles of lake each, at height 2, away from the stream.
  let tarnsLeft = gen.tarns;
  if (tarnsLeft > 0)
    for (const key of shuffled(rng, order)) {
      if (tarnsLeft === 0) break;
      const t = tiles[key]!;
      const fits = (x: Tile | undefined): x is Tile =>
        x !== undefined &&
        plain(x) &&
        heightOf(x) === 2 &&
        hexKey(x) !== campKey &&
        !hexNeighbors(x).some((n) => ['river', 'reservoir'].includes(tile(n)?.type ?? ''));
      if (!fits(t)) continue;
      const other = hexNeighbors(t).map(tile).find(fits);
      if (!other) continue;
      t.type = 'reservoir';
      other.type = 'reservoir';
      tarnsLeft--;
    }

  // The snowmelt reaches the glen floor beside the stream (further, with a Föhn wind), highest
  // up the stream first.
  const floodOrder = order
    .filter((k) => {
      const t = tiles[k]!;
      return (
        k !== campKey &&
        t.type !== 'river' &&
        t.type !== 'reservoir' &&
        heightOf(t) < gen.meltReach &&
        hexDistance(nearest(t), t) <= gen.meltReach
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

/**
 * The Sun Desert (proposals/sun-desert.md): a thin river from the top edge down the map, wadi
 * banks (floodplain) beside it; dunes along the far side; rock at the edges; an oasis ringed
 * with scrub and palm groves; a salt flat; the old array's ruins; gravel plain (reg) and scrub
 * elsewhere. The camp stands a short walk from the oasis; the flash flood covers the banks.
 */
function generateDesert(content: Content, gen: DesertMapGen, seed: string): GeneratedMap {
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  const at = (col: number, row: number) => tiles[hexKey(offsetToAxial(col, row))];
  const colOf = (t: Tile) => t.q + Math.floor(t.r / 2);
  for (let row = 0; row < gen.height; row++)
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      tiles[hexKey(h)] = { ...h, type: 'reg' };
      order.push(hexKey(h));
    }
  const tile = (h: Hex) => tiles[hexKey(h)];
  const type = (h: Hex) => tile(h)?.type;

  // The river, from the top edge down, wandering a column now and then; its banks beside it.
  const [minCol, maxCol] = gen.riverColumns;
  let col = minCol + nextInt(rng, maxCol - minCol + 1);
  const river: string[] = [];
  for (let row = 0; row < gen.height; row++) {
    if (row > 0 && chance(rng, 0.3))
      col = Math.max(1, Math.min(gen.width - 2, col + (chance(rng, 0.5) ? 1 : -1)));
    const t = at(col, row)!;
    t.type = 'river';
    t.riverIndex = river.length;
    river.push(hexKey(t));
  }
  const stream = river.map((k) => tiles[k]!);
  const riverDistance = (t: Hex) => Math.min(...stream.map((s) => hexDistance(s, t)));
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'reg' && riverDistance(t) === 1 && chance(rng, gen.bankChance))
      t.type = 'floodplain';
  }

  // Dunes along the side farther from the river.
  const riverLeft = colOf(stream[Math.floor(stream.length / 2)]!) < gen.width / 2;
  const inErg = (t: Tile) =>
    riverLeft ? colOf(t) >= gen.width - gen.ergColumns : colOf(t) < gen.ergColumns;
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'reg' && inErg(t) && riverDistance(t) > 2) t.type = 'erg';
  }
  // Rock at the edges, outside the dunes.
  for (const key of order) {
    const t = tiles[key]!;
    const edge =
      t.r === 0 || t.r === gen.height - 1 || colOf(t) === 0 || colOf(t) === gen.width - 1;
    if (t.type === 'reg' && edge && chance(rng, gen.rockChance)) t.type = 'rock';
  }

  /** Open reg at least `d` tiles from the river, not at the edge. */
  const open = (t: Tile, d: number) =>
    t.type === 'reg' &&
    riverDistance(t) >= d &&
    t.r > 0 &&
    t.r < gen.height - 1 &&
    colOf(t) > 0 &&
    colOf(t) < gen.width - 1;
  /** A connected patch of `size` tiles grown from a seed that `fits`. */
  const patch = (size: number, fits: (t: Tile) => boolean): Tile[] => {
    for (const key of shuffled(rng, order)) {
      const start = tiles[key]!;
      if (!fits(start)) continue;
      const group = [start];
      while (group.length < size) {
        const next = group
          .flatMap((g) => hexNeighbors(g).map(tile))
          .filter((n): n is Tile => n !== undefined && fits(n) && !group.includes(n))
          .sort((a, b) => hexKey(a).localeCompare(hexKey(b)));
        if (next.length === 0) break;
        group.push(next[nextInt(rng, next.length)]!);
      }
      if (group.length === size) return group;
    }
    return [];
  };

  // The oasis, ringed with scrub.
  const oasis = patch(gen.oasisTiles, (t) => open(t, 3));
  if (oasis.length === 0) throw new Error('map has no room for the oasis');
  for (const t of oasis) t.type = 'oasis';
  for (const t of oasis)
    for (const n of hexNeighbors(t).map(tile))
      if (n && (n.type === 'reg' || n.type === 'erg')) n.type = 'scrub';
  const oasisDistance = (t: Hex) => Math.min(...oasis.map((o) => hexDistance(o, t)));

  // The salt flat, away from the river and the oasis.
  if (gen.saltFlat > 0)
    for (const t of patch(gen.saltFlat, (x) => open(x, 3) && oasisDistance(x) >= 3))
      t.type = 'saltFlat';

  // The old array's ruins on the reg, never touching each other or water.
  let ruinsLeft = gen.ruins;
  for (const key of shuffled(rng, order)) {
    if (ruinsLeft === 0) break;
    const t = tiles[key]!;
    if (!open(t, 2) || oasisDistance(t) < 2) continue;
    if (hexNeighbors(t).some((n) => type(n) === 'ruin')) continue;
    t.type = 'ruin';
    t.salvage = gen.ruinSalvage;
    ruinsLeft--;
  }

  // Away from the water, reg or scrub.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'reg' && !chance(rng, gen.regChance)) t.type = 'scrub';
  }

  // The camp: plain land a short walk from the oasis, not on the wadi banks.
  const [nearestCamp, farthestCamp] = gen.campOasisDistance;
  const campOptions = order.filter((key) => {
    const t = tiles[key]!;
    const d = oasisDistance(t);
    return (t.type === 'reg' || t.type === 'scrub') && d >= nearestCamp && d <= farthestCamp;
  });
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  tiles[campKey]!.type = 'scrub';

  // Palm groves beside the oasis, and meadow near them, summing to the starting Harmony.
  const perTile = content.rules.harmony.perTile;
  const woodValue = perTile.woodland ?? 0;
  const meadowValue = perTile.meadow ?? 0;
  let remaining = gen.startingHarmony;
  const ring = () =>
    order.filter(
      (k) => k !== campKey && tiles[k]!.type === 'scrub' && oasisDistance(tiles[k]!) === 1,
    );
  for (let i = 0; i < gen.woodlands && remaining >= woodValue && woodValue > 0; i++) {
    const options = ring();
    if (options.length === 0) break;
    tiles[options[nextInt(rng, options.length)]!]!.type = 'woodland';
    remaining -= woodValue;
  }
  if (meadowValue <= 0 || remaining % meadowValue !== 0)
    throw new Error('starting Harmony cannot be reached with meadow tiles');
  for (let m = remaining / meadowValue; m > 0; m--) {
    const options = order
      .filter((k) => k !== campKey && ['scrub', 'reg'].includes(tiles[k]!.type))
      .sort((a, b) => oasisDistance(tiles[a]!) - oasisDistance(tiles[b]!));
    if (options.length === 0) throw new Error('not enough land for starting meadows');
    // Near the oasis: among the closest few.
    const pool = options.slice(0, Math.min(options.length, 6));
    tiles[pool[nextInt(rng, pool.length)]!]!.type = 'meadow';
  }

  // The flash flood covers the wadi banks, upstream first.
  const floodOrder = order
    .filter((k) => tiles[k]!.type === 'floodplain')
    .sort(
      (a, b) =>
        Math.min(...stream.map((s) => (hexDistance(s, tiles[a]!) === 1 ? s.riverIndex! : 99))) -
          Math.min(...stream.map((s) => (hexDistance(s, tiles[b]!) === 1 ? s.riverIndex! : 99))) ||
        order.indexOf(a) - order.indexOf(b),
    );

  return {
    map: { width: gen.width, height: gen.height, tiles, river, floodOrder },
    camp: { q: tiles[campKey]!.q, r: tiles[campKey]!.r },
  };
}

/**
 * A lake (Lake Gardens): the lake grows from the middle of the map, a little ragged, until it
 * covers `lakeShare` of it. Lake tiles `deepFrom` steps or more from the shore are deep water, the
 * rest shallows; small islands rise out of it, ringed by shallows. A stream runs in from the top
 * edge to the shore; reed fringe lines the shore; the higher shore along one side has hills and
 * the woodland; the drowned town's ruins stand at the water's edge; the camp stands a short walk
 * from the shallows. High water floods the reed fringe.
 */
function generateLake(content: Content, gen: LakeMapGen, seed: string): GeneratedMap {
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  const at = (col: number, row: number) => tiles[hexKey(offsetToAxial(col, row))];
  const colOf = (t: Hex) => t.q + Math.floor(t.r / 2);
  for (let row = 0; row < gen.height; row++)
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      tiles[hexKey(h)] = { ...h, type: 'scrub' };
      order.push(hexKey(h));
    }
  const tile = (h: Hex) => tiles[hexKey(h)];
  const edge = (t: Tile) =>
    t.r === 0 || t.r === gen.height - 1 || colOf(t) === 0 || colOf(t) === gen.width - 1;

  // The higher shore: the side the lake leaves alone.
  const shoreLeft = chance(rng, 0.5);
  const onShore = (t: Tile) =>
    shoreLeft ? colOf(t) < gen.shoreColumns : colOf(t) >= gen.width - gen.shoreColumns;

  // The lake grows from the middle (a little towards the low side), taking the nearest tiles
  // first with some noise, never the high shore, the map's edge or the top row.
  const centre = at(
    Math.floor(gen.width / 2) + (shoreLeft ? 1 : -1),
    Math.floor((gen.height + gen.streamRows) / 2),
  )!;
  const size = Math.round(gen.width * gen.height * gen.lakeShare);
  const noise = new Map(order.map((k) => [k, nextInt(rng, 1000) / 1000]));
  const lake = new Set<string>([hexKey(centre)]);
  while (lake.size < size) {
    const options = [...lake]
      .flatMap((k) => hexNeighbors(tiles[k]!))
      .map(tile)
      .filter(
        (t): t is Tile =>
          t !== undefined &&
          !lake.has(hexKey(t)) &&
          !edge(t) &&
          !onShore(t) &&
          t.r >= gen.streamRows,
      )
      .map(hexKey);
    if (options.length === 0) break;
    const score = (k: string) => hexDistance(tiles[k]!, centre) + noise.get(k)! * 1.6;
    const next = [...new Set(options)].sort(
      (a, b) => score(a) - score(b) || a.localeCompare(b),
    )[0]!;
    lake.add(next);
  }
  if (lake.size < size / 2) throw new Error('map has no room for the lake');
  /** Steps from a lake tile to the nearest land. */
  const land = order.filter((k) => !lake.has(k)).map((k) => tiles[k]!);
  const fromShore = (t: Hex) => Math.min(...land.map((l) => hexDistance(l, t)));
  for (const k of lake) tiles[k]!.type = fromShore(tiles[k]!) >= gen.deepFrom ? 'deep' : 'shallows';

  // Islands: a tile (or two) of land out in the lake, ringed by shallows.
  for (let i = 0; i < gen.islands; i++) {
    const options = [...lake].filter((k) => {
      const t = tiles[k]!;
      return t.type === 'deep' && hexNeighbors(t).every((n) => tile(n)?.type === 'deep');
    });
    if (options.length === 0) break;
    const isle = tiles[options[nextInt(rng, options.length)]!]!;
    const isles = [isle];
    const second = hexNeighbors(isle)
      .map(tile)
      .filter((n): n is Tile => n?.type === 'deep');
    if (second.length > 0 && chance(rng, 0.5)) isles.push(second[nextInt(rng, second.length)]!);
    for (const t of isles) {
      t.type = chance(rng, 0.5) ? 'scrub' : 'barren';
      lake.delete(hexKey(t));
    }
    for (const t of isles)
      for (const n of hexNeighbors(t).map(tile)) if (n?.type === 'deep') n.type = 'shallows';
  }
  const lakeTilesNow = () => [...lake].map((k) => tiles[k]!);
  const lakeDistance = (t: Hex) => Math.min(...lakeTilesNow().map((l) => hexDistance(l, t)));

  // The stream: from the top edge down to the shore, wandering a column now and then.
  const [minCol, maxCol] = gen.streamColumns;
  let col = minCol + nextInt(rng, maxCol - minCol + 1);
  const river: string[] = [];
  for (let row = 0; row < gen.height; row++) {
    if (row > 0 && chance(rng, 0.3))
      col = Math.max(1, Math.min(gen.width - 2, col + (chance(rng, 0.5) ? 1 : -1)));
    const t = at(col, row)!;
    if (lake.has(hexKey(t))) break;
    t.type = 'river';
    t.riverIndex = river.length;
    river.push(hexKey(t));
    if (lakeDistance(t) <= 1) break;
  }
  const isLand = (t: Tile) => !lake.has(hexKey(t)) && t.type !== 'river';

  // The higher shore: hills, and the rest barren or scrub.
  for (const k of order) {
    const t = tiles[k]!;
    if (!isLand(t)) continue;
    if (onShore(t) && chance(rng, gen.hillChance)) t.type = 'hill';
    else t.type = chance(rng, gen.barrenChance) ? 'barren' : 'scrub';
  }
  // Reed fringe on the shore.
  for (const k of order) {
    const t = tiles[k]!;
    if (
      isLand(t) &&
      t.type !== 'hill' &&
      lakeDistance(t) <= gen.fringeDepth &&
      chance(rng, gen.fringeChance)
    )
      t.type = 'floodplain';
  }

  // The drowned town: ruins at the water's edge, never touching each other.
  let ruinsLeft = gen.ruins;
  for (const k of shuffled(rng, order)) {
    if (ruinsLeft === 0) break;
    const t = tiles[k]!;
    if (!isLand(t) || t.type === 'hill' || lakeDistance(t) !== 1 || edge(t)) continue;
    if (hexNeighbors(t).some((n) => tile(n)?.type === 'ruin' || tile(n)?.type === 'river'))
      continue;
    t.type = 'ruin';
    t.salvage = gen.ruinSalvage;
    ruinsLeft--;
  }

  // The camp: plain land on the mainland (not an island) a short walk from the shallows.
  const mainland = new Set(order.filter((k) => !lake.has(k) && edge(tiles[k]!)));
  for (const queue = [...mainland]; queue.length > 0;) {
    for (const n of hexNeighbors(tiles[queue.shift()!]!)) {
      const k = hexKey(n);
      if (tiles[k] && !lake.has(k) && !mainland.has(k)) {
        mainland.add(k);
        queue.push(k);
      }
    }
  }
  const shallows = lakeTilesNow().filter((t) => t.type === 'shallows');
  const shallowsDistance = (t: Hex) => Math.min(...shallows.map((l) => hexDistance(l, t)));
  const [nearestCamp, farthestCamp] = gen.campLakeDistance;
  const campOptions = order.filter((k) => {
    const t = tiles[k]!;
    const d = shallowsDistance(t);
    return (
      ['barren', 'scrub'].includes(t.type) &&
      mainland.has(k) &&
      !edge(t) &&
      d >= nearestCamp &&
      d <= farthestCamp
    );
  });
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  tiles[campKey]!.type = 'scrub';

  // The willows on the higher shore first, then meadow near the camp, to the starting Harmony.
  const perTile = content.rules.harmony.perTile;
  const woodValue = perTile.woodland ?? 0;
  const meadowValue = perTile.meadow ?? 0;
  let remaining = gen.startingHarmony;
  const plain = (k: string) => k !== campKey && ['barren', 'scrub'].includes(tiles[k]!.type);
  for (let i = 0; i < gen.woodlands && remaining >= woodValue && woodValue > 0; i++) {
    const options = order.filter((k) => plain(k) && onShore(tiles[k]!));
    const pool = options.length > 0 ? options : order.filter(plain);
    if (pool.length === 0) break;
    tiles[pool[nextInt(rng, pool.length)]!]!.type = 'woodland';
    remaining -= woodValue;
  }
  if (meadowValue <= 0 || remaining % meadowValue !== 0)
    throw new Error('starting Harmony cannot be reached with meadow tiles');
  const camp = tiles[campKey]!;
  for (let m = remaining / meadowValue; m > 0; m--) {
    const options = order
      .filter(plain)
      .sort((a, b) => hexDistance(tiles[a]!, camp) - hexDistance(tiles[b]!, camp));
    if (options.length === 0) throw new Error('not enough land for starting meadows');
    const pool = options.slice(0, Math.min(options.length, 8));
    tiles[pool[nextInt(rng, pool.length)]!]!.type = 'meadow';
  }

  // High water covers the reed fringe, in reading order.
  const floodOrder = order.filter((k) => tiles[k]!.type === 'floodplain');
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
 * A rainforest (Rainforest Gardens): rainforest over most of the map, a river winding down it
 * with a seasonal floodplain beside it, hills along one side, an old plantation (barren ground
 * round the ruins of the estate) on the other, a few clearings of scrub and meadow, and the camp
 * between the river and the plantation with the forest beside it. The forest is wild land: what
 * its tiles give beyond the starting Harmony is `wild`, so Harmony starts where the others do.
 */
function generateForest(content: Content, gen: ForestMapGen, seed: string): GeneratedMap {
  const rng = createRng(`${seed}:map`);
  const tiles: Record<string, Tile> = {};
  const order: string[] = [];
  for (let row = 0; row < gen.height; row++) {
    for (let col = 0; col < gen.width; col++) {
      const h = offsetToAxial(col, row);
      const key = hexKey(h);
      tiles[key] = { ...h, type: 'woodland' };
      order.push(key);
    }
  }
  const tile = (h: Hex) => tiles[hexKey(h)];
  const colOf = (key: string) => order.indexOf(key) % gen.width;

  // The river: one tile a row, wandering a column either way, as the Reach's.
  const [minCol, maxCol] = gen.riverColumns;
  let col = minCol + nextInt(rng, maxCol - minCol + 1);
  const river: string[] = [];
  for (let row = 0; row < gen.height; row++) {
    const h = offsetToAxial(col, row);
    const t = tiles[hexKey(h)]!;
    t.type = 'river';
    t.riverIndex = row;
    river.push(hexKey(h));
    const down = row % 2 === 0 ? [col - 1, col] : [col, col + 1];
    const options = down.filter((c) => c >= minCol && c <= maxCol);
    col = options.length > 0 ? options[nextInt(rng, options.length)]! : col;
  }
  const riverHexes = river.map((k) => tiles[k]!);
  const riverDistance = (h: Hex) => Math.min(...riverHexes.map((r) => hexDistance(h, r)));
  const riverMid = colOf(river[Math.floor(river.length / 2)]!);

  // The seasonal floodplain: the monsoon's várzea.
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'woodland' && riverDistance(t) === 1 && chance(rng, gen.floodplainChance))
      t.type = 'floodplain';
  }

  // The plantation on the wider side of the river, the hills on the other.
  const east = gen.width - 1 - riverMid >= riverMid;
  const hillSide = (c: number) => (east ? c < gen.hillColumns : c >= gen.width - gen.hillColumns);
  for (const key of order) {
    const t = tiles[key]!;
    if (t.type === 'woodland' && hillSide(colOf(key)) && riverDistance(t) >= 2)
      if (chance(rng, gen.hillChance)) t.type = 'hill';
  }
  const farSide = (key: string) => (east ? colOf(key) > riverMid : colOf(key) < riverMid);
  const seeds = order.filter((k) => {
    const t = tiles[k]!;
    return t.type === 'woodland' && farSide(k) && riverDistance(t) >= 3;
  });
  const fallback = order.filter(
    (k) => tiles[k]!.type === 'woodland' && riverDistance(tiles[k]!) >= 2,
  );
  const pool = seeds.length > 0 ? seeds : fallback;
  const estate: Tile[] = [tiles[pool[nextInt(rng, pool.length)]!]!];
  while (estate.length < gen.plantation) {
    const grow = [
      ...new Set(
        estate
          .flatMap((h) => hexNeighbors(h))
          .map((n) => tile(n))
          .filter(
            (n): n is Tile =>
              n !== undefined &&
              n.type === 'woodland' &&
              riverDistance(n) >= 2 &&
              !estate.includes(n),
          ),
      ),
    ];
    if (grow.length === 0) break;
    estate.push(grow[nextInt(rng, grow.length)]!);
  }
  for (const t of estate) t.type = 'barren';
  // The estate's ruins, apart where the estate has room, side by side where it hasn't.
  let ruinsLeft = gen.ruins;
  const sites = shuffled(rng, estate);
  for (const apart of [true, false])
    for (const t of sites) {
      if (ruinsLeft === 0 || t.type === 'ruin') continue;
      if (apart && hexNeighbors(t).some((n) => tile(n)?.type === 'ruin')) continue;
      t.type = 'ruin';
      t.salvage = gen.ruinSalvage;
      ruinsLeft--;
    }
  const estateHexes = estate.map((t) => ({ q: t.q, r: t.r }));
  const estateDistance = (h: Hex) => Math.min(...estateHexes.map((e) => hexDistance(h, e)));

  // The Founders' Camp: a clearing between the river and the estate, the forest beside it.
  const [nearest, farthest] = gen.campRiverDistance;
  const midRows = (r: number) => r >= gen.height / 4 && r < (gen.height * 3) / 4;
  const site = (t: Tile, rows: boolean) => {
    const d = riverDistance(t);
    return (
      t.type === 'woodland' &&
      d >= nearest &&
      d <= farthest &&
      estateDistance(t) <= gen.campPlantationDistance &&
      (!rows || midRows(t.r)) &&
      hexNeighbors(t).some((n) => tile(n)?.type === 'woodland')
    );
  };
  let campOptions = order.filter((k) => site(tiles[k]!, true));
  if (campOptions.length === 0) campOptions = order.filter((k) => site(tiles[k]!, false));
  if (campOptions.length === 0) throw new Error('map has no site for the Founders Camp');
  const campKey = campOptions[nextInt(rng, campOptions.length)]!;
  const camp = tiles[campKey]!;
  camp.type = 'scrub';

  // Natural clearings in the forest: scrub, with meadow round it.
  for (let i = 0; i < gen.clearings; i++) {
    const options = order.filter((k) => {
      const t = tiles[k]!;
      return (
        t.type === 'woodland' &&
        riverDistance(t) >= 2 &&
        estateDistance(t) >= 2 &&
        hexDistance(t, camp) >= 2 &&
        hexNeighbors(t).every((n) => tile(n)?.type !== 'scrub' && tile(n)?.type !== 'meadow')
      );
    });
    if (options.length === 0) break;
    const first = tiles[options[nextInt(rng, options.length)]!]!;
    first.type = 'scrub';
    const glade = [first];
    while (glade.length < gen.clearingSize) {
      const grow = glade
        .flatMap((h) => hexNeighbors(h))
        .map((n) => tile(n))
        .filter((n): n is Tile => n !== undefined && n.type === 'woodland' && n !== camp);
      if (grow.length === 0) break;
      const t = grow[nextInt(rng, grow.length)]!;
      t.type = 'meadow';
      glade.push(t);
    }
  }

  // The forest as it stands is where Harmony starts from.
  const perTile = content.rules.harmony.perTile;
  const given = order.reduce((sum, k) => sum + (perTile[tiles[k]!.type] ?? 0), 0);
  const wild = Math.max(0, given - gen.startingHarmony);

  const floodOrder = order
    .filter((k) => tiles[k]!.type === 'floodplain')
    .map((k) => ({ k, d: riverDistance(tiles[k]!) }))
    .sort((a, b) => a.d - b.d)
    .map((x) => x.k);

  return {
    map: { width: gen.width, height: gen.height, tiles, river, floodOrder, wild },
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
  const gen = content.map as Exclude<MapGen, ForestMapGen>;
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
