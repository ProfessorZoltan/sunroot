/**
 * Keepsakes on screen (proposals/seed-uses.md): which a run carries, how each animal's young
 * ones look beside it, and where the settlement's ornaments go. Only for drawing: nothing in
 * the season reads them.
 */
import type { Content } from '../sim/content/load';
import { hexKey, hexNeighbors, type Hex } from '../sim/hex';
import { defOf, isHome } from '../sim/queries';
import type { RunState } from '../sim/types';

/** The keepsakes this run carries from Root City. */
export function keepsakesIn(state: RunState): Set<string> {
  return new Set(state.options?.city?.keepsakes ?? []);
}

/**
 * An animal's young ones (or rare look): extra figures beside its own, drawn from its frames
 * until their art comes (`id.variant.frame.png`, e.g. `deer.white.walk.1.png`): smaller, or
 * whitened, and some keep still (chicks on a ledge, a pup hauled out).
 */
export interface Young {
  keepsake: string;
  animal: string;
  /** The art's name for it, after the animal's: `otter.cub`, `deer.white`. */
  variant: string;
  count: number;
  /** Its size beside the animal's figure, drawn from the animal's own frames. */
  scale: number;
  look?: 'white' | 'grey';
  /** Stays where it is, in its resting frame, rather than following. */
  rests?: boolean;
}

export const YOUNG: readonly Young[] = [
  { keepsake: 'bumblebees', animal: 'wildBees', variant: 'bumble', count: 1, scale: 1.8 },
  { keepsake: 'otterCubs', animal: 'otters', variant: 'cub', count: 2, scale: 0.55 },
  { keepsake: 'beaverKit', animal: 'beavers', variant: 'kit', count: 1, scale: 0.55 },
  { keepsake: 'whiteHart', animal: 'deer', variant: 'white', count: 1, scale: 1.05, look: 'white' },
  { keepsake: 'ternChicks', animal: 'terns', variant: 'chick', count: 2, scale: 0.5, rests: true },
  {
    keepsake: 'sealPup',
    animal: 'seals',
    variant: 'pup',
    count: 1,
    scale: 0.55,
    look: 'white',
    rests: true,
  },
  { keepsake: 'puffinFish', animal: 'puffins', variant: 'fish', count: 1, scale: 1 },
  { keepsake: 'dolphinCalf', animal: 'dolphins', variant: 'calf', count: 1, scale: 0.55 },
  { keepsake: 'leverets', animal: 'hares', variant: 'young', count: 2, scale: 0.55 },
  {
    keepsake: 'dipperFledgling',
    animal: 'dippers',
    variant: 'young',
    count: 1,
    scale: 0.8,
    look: 'grey',
  },
  { keepsake: 'eaglePair', animal: 'eagles', variant: 'pair', count: 1, scale: 1 },
  { keepsake: 'martenKits', animal: 'martens', variant: 'kit', count: 2, scale: 0.55 },
  { keepsake: 'fennecCubs', animal: 'fennecs', variant: 'cub', count: 2, scale: 0.55 },
  { keepsake: 'sandgrouseChicks', animal: 'sandgrouse', variant: 'chick', count: 2, scale: 0.5 },
  {
    keepsake: 'falconChicks',
    animal: 'falcons',
    variant: 'chick',
    count: 2,
    scale: 0.5,
    look: 'white',
    rests: true,
  },
  { keepsake: 'oryxCalf', animal: 'oryx', variant: 'calf', count: 1, scale: 0.6 },
];

/** The art's frame for a young one: the variant after the animal's name (`deer.walk.2` → `deer.white.walk.2`). */
export function youngFrame(frame: string, variant: string): string {
  return frame.replace(/^([^.]+)/, `$1.${variant}`);
}

/** The tiles of channel that carry lanterns (the Channel Lanterns keepsake), up to 16. */
export function lanternTiles(content: Content, state: RunState): Hex[] {
  if (!keepsakesIn(state).has('channelLanterns')) return [];
  return Object.values(state.buildings)
    .filter((b) => defOf(content, b).water?.channel)
    .map((b) => b.at)
    .sort((a, b) => hexKey(a).localeCompare(hexKey(b)))
    .slice(0, 16);
}

/** Homes, for window boxes (spring to autumn) and kites. */
export function homesOf(content: Content, state: RunState): Hex[] {
  return state.priority
    .map((uid) => state.buildings[uid])
    .filter((b) => b !== undefined && isHome(defOf(content, b)))
    .map((b) => b!.at);
}

/** Woodland beside the homes, for bird boxes, up to 6. */
export function birdBoxTiles(content: Content, state: RunState): Hex[] {
  const taken = new Set(Object.values(state.buildings).map((b) => hexKey(b.at)));
  const out = new Map<string, Hex>();
  for (const h of homesOf(content, state))
    for (const n of hexNeighbors(h)) {
      const k = hexKey(n);
      if (state.map.tiles[k]?.type === 'woodland' && !taken.has(k)) out.set(k, n);
    }
  return [...out.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 6)
    .map(([, h]) => h);
}
