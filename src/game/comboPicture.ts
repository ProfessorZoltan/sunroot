/**
 * A combo as a picture (asked for in playtesting: so players can match what a card describes to
 * what they have built): the buildings and tiles it is made of, in the order it reads, with
 * what joins them. The interface draws each piece with the map's own art.
 */
import { TILE_TYPES, type Combo, type Content, type TileType } from '../sim';
import type { NextToRule } from '../sim/content/schema';

export interface Piece {
  kind: 'building' | 'tile';
  /** A building id, or a tile type. */
  id: string;
  name: string;
}

/** One place in the picture: any one of these pieces (most often just one), `count` of them. */
export interface Slot {
  pieces: Piece[];
  count: number;
}

/**
 * How two slots meet: `next` (beside it), `then` (the chain's next link, beside the last),
 * `line` (next in a straight line), `becomes` (an evolution), `placed` (built over it).
 */
export type Join = 'next' | 'then' | 'line' | 'becomes' | 'placed';

export interface ComboPicture {
  slots: Slot[];
  /** joins[i] stands between slots[i] and slots[i + 1]. */
  joins: Join[];
  /** A chain: the last link leads back to the first. */
  loop: boolean;
  /** A ring: slots[1] stands all around slots[0]. */
  ring: boolean;
  /** What the pictures can't show (where it stands, how long a run must be), in words. */
  note?: string;
}

const TILES = new Set<string>(TILE_TYPES);

/** A building or tile by id (a building of another biome is still named). */
export function piece(content: Content, id: string): Piece {
  const def = content.byId[id];
  if (def) return { kind: 'building', id, name: def.name };
  if (TILES.has(id)) return { kind: 'tile', id, name: tileName(id as TileType) };
  return { kind: 'building', id, name: id };
}

/** A tile type in words: `saltFlat` → "salt flat". */
export function tileName(t: TileType): string {
  return t.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
}

const one = (content: Content, id: string, count = 1): Slot => ({
  pieces: [piece(content, id)],
  count,
});

/** The neighbours a rule asks for: one slot of any of them, or one slot each. */
function neighbours(content: Content, rule: NextToRule): Slot[] {
  const ids = [...(rule.buildings ?? []), ...(rule.tiles ?? [])];
  if (rule.each) return ids.map((id) => one(content, id));
  return [{ pieces: ids.map((id) => piece(content, id)), count: rule.count }];
}

/** Slots joined, each to the next, by the same join. */
function joined(slots: Slot[], join: Join) {
  return { slots, joins: slots.slice(1).map(() => join) };
}

export function comboPicture(content: Content, combo: Combo): ComboPicture {
  const base = { loop: false, ring: false };
  switch (combo.layer) {
    case 'adjacency': {
      const around = neighbours(content, combo.nextTo);
      return {
        ...base,
        slots: [one(content, combo.building), ...around],
        joins: around.map(() => 'next' as const),
      };
    }
    case 'chain':
      return {
        ...base,
        ...joined(
          combo.links.map((l) => ({
            pieces: l.buildings.map((id) => piece(content, id)),
            count: 1,
          })),
          'then',
        ),
        loop: true,
      };
    case 'formation': {
      const s = combo.shape;
      switch (s.kind) {
        case 'ring':
          return {
            ...base,
            slots: [
              one(content, s.center),
              s.of
                ? { pieces: s.of.map((id) => piece(content, id)), count: s.size }
                : { pieces: [], count: s.size },
            ],
            joins: ['next'],
            ring: true,
            note:
              s.minTypes > 1
                ? `${s.size} around it, of ${s.minTypes} kinds or more`
                : `${s.size} around it`,
          };
        case 'openRing':
          return {
            ...base,
            slots: [
              one(content, s.tile),
              { pieces: s.of.map((id) => piece(content, id)), count: s.size },
            ],
            joins: ['next'],
            ring: true,
            note: `${s.size} around an open tile, with nothing built on it`,
          };
        case 'cluster':
          return {
            ...base,
            ...joined(
              s.buildings.map((id) => one(content, id)),
              'next',
            ),
          };
        case 'hedgeRun': {
          // The land's edge building: the Reach's hedgerow, the Highland's snow fence...
          const edge = content.buildings.find((b) => b.edge)?.id ?? 'hedgerow';
          return {
            ...base,
            slots: [one(content, edge, s.length)],
            joins: [],
            note: 'joined end to end, along the edges between tiles',
          };
        }
        case 'channelRun': {
          const beside = s.beside.length > 0 ? [one(content, s.beside[0]!)] : [];
          const slots = [one(content, s.building, s.length), ...beside];
          return {
            ...base,
            slots:
              s.beside.length > 1
                ? [slots[0]!, { ...slots[1]!, pieces: s.beside.map((id) => piece(content, id)) }]
                : slots,
            joins: beside.map(() => 'next' as const),
            note: 'joined end to end',
          };
        }
        case 'line': {
          const words = [
            s.tiles ? `on ${s.tiles.map(tileName).join(' or ')}` : '',
            s.minHeight ? `at height ${s.minHeight} or above` : '',
            s.rising ? 'each a step higher' : '',
          ].filter(Boolean);
          return {
            ...base,
            ...joined(
              s.sequence.map((id) => one(content, id)),
              'line',
            ),
            note: ['in a straight line', ...words].join(', '),
          };
        }
        case 'strip':
          return {
            ...base,
            slots: [{ pieces: s.tiles.map((t) => piece(content, t)), count: 1 }],
            joins: [],
            note: 'an unbroken strip from the river to the side of the valley',
          };
      }
      break;
    }
    case 'evolution': {
      const w = combo.when;
      const from = one(content, combo.from);
      const into = one(content, combo.into);
      switch (w.kind) {
        case 'nextTo':
        case 'coppiced': {
          const around = [
            ...neighbours(content, w.nextTo),
            ...('also' in w && w.also ? neighbours(content, w.also) : []),
          ];
          return {
            ...base,
            slots: [from, ...around, into],
            joins: [...around.map(() => 'next' as const), 'becomes'],
            note:
              'minHarmony' in w && w.minHarmony
                ? `while Harmony is ${w.minHarmony} or more`
                : undefined,
          };
        }
        case 'ruinExhausted': {
          const around = w.nextTo ? neighbours(content, w.nextTo) : [];
          return {
            ...base,
            slots: [from, ...around, into],
            joins: [...around.map(() => 'next' as const), 'becomes'],
            note: 'once its ruin has no salvage left',
          };
        }
        case 'placed':
          return {
            ...base,
            slots: [from, one(content, w.building), into],
            joins: ['placed', 'becomes'],
          };
      }
    }
  }
  return { ...base, slots: [], joins: [] };
}

/** Every building and tile a picture shows, for drawing their icons once. */
export function picturePieces(p: ComboPicture): Piece[] {
  return p.slots.flatMap((s) => s.pieces);
}

/** Whether a combo's picture shows this building (or tile) type. */
export function shows(content: Content, combo: Combo, id: string): boolean {
  return picturePieces(comboPicture(content, combo)).some((p) => p.id === id);
}
