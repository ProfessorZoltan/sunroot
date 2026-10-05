/** The papercraft palette from the design doc and the Willow Reach mockup. */
import type { TileType } from '../sim/content/schema';

export interface TileColors {
  top: number;
  side: number;
  detail: number;
}

export const TILE_COLORS: Record<TileType, TileColors> = {
  river: { top: 0x8fc3d1, side: 0x6c9fae, detail: 0xcfe7ee },
  reservoir: { top: 0x74acc0, side: 0x548899, detail: 0xcfe7ee },
  // The Sun Desert's spring-fed pool: clearer than a lake, palms at its rim.
  oasis: { top: 0x5fb6b2, side: 0x3f8a86, detail: 0x5e8a55 },
  floodplain: { top: 0xc9da8c, side: 0x9fb066, detail: 0xf2d46b },
  hill: { top: 0xc8bf96, side: 0xa0976e, detail: 0xa59c72 },
  ruin: { top: 0xd2c4aa, side: 0xa99a7e, detail: 0x9e9280 },
  barren: { top: 0xdccba6, side: 0xb9a57e, detail: 0xbba57c },
  scrub: { top: 0xcdd196, side: 0xa6aa6c, detail: 0xa7b06e },
  meadow: { top: 0xb3cd8f, side: 0x88a56a, detail: 0x86a866 },
  woodland: { top: 0x94b780, side: 0x6c8e5c, detail: 0x4a6e43 },
  // The Windswept Coast: deeper water, grey-brown mud, salt-green marsh, pale sand.
  sea: { top: 0x6fa5bb, side: 0x4f8196, detail: 0xd6ecf2 },
  mudflat: { top: 0xb5a98e, side: 0x8f846b, detail: 0x9fb6b8 },
  saltmarsh: { top: 0xa9c08f, side: 0x7f9868, detail: 0xc9b98a },
  dune: { top: 0xe8dab2, side: 0xc4b38a, detail: 0xb7c48a },
  // The Highland: grey rock on the tops, dark peat on the shoulders.
  crag: { top: 0xa9a59a, side: 0x7f7b70, detail: 0x6f6c63 },
  bog: { top: 0x8c8a5a, side: 0x6a6842, detail: 0x6f8f7a },
  // The Sun Desert: gravel plain, dunes, rock outcrops, a crusted salt flat.
  reg: { top: 0xd9b98a, side: 0xb48f5e, detail: 0x9c7a4f },
  erg: { top: 0xeccb8a, side: 0xc9a160, detail: 0xd9a95c },
  rock: { top: 0xb08566, side: 0x86604a, detail: 0x7a5640 },
  saltFlat: { top: 0xf1ece0, side: 0xcfc6b3, detail: 0xd8d0bd },
  // Lake Gardens: knee-deep green water, the deep lake, and the raised beds made from it.
  shallows: { top: 0x8fc0b0, side: 0x6a9a8a, detail: 0xb8d8b0 },
  deep: { top: 0x5d93a8, side: 0x426f80, detail: 0xcfe7ee },
  bed: { top: 0x9fc27a, side: 0x6f8a52, detail: 0x5e7a3e },
};

export const COLORS = {
  paper: 0xf4ebd6,
  panel: 0xfbf5e6,
  gap: 0xfff9ea,
  fog: 0xefe6cf,
  fogEdge: 0xf8f1df,
  ink: 0x2f3b2e,
  quiet: 0x5e6b58,
  sunGold: 0xf2c14e,
  leadingGold: 0xd9a441,
  terracotta: 0xd98c5f,
  solarTeal: 0x2f5e63,
  treeDark: 0x4a6e43,
  treeLight: 0x5e8a55,
  fruit: 0xd9543c,
  flowerPink: 0xe58fa8,
  wall: 0xf3dfbd,
  wood: 0xa0643f,
  stone: 0x9e9280,
  water: 0x9ccfc9,
  field: 0xe6cf73,
  furrow: 0xb89b3e,
  good: 0x3f7a3a,
  bad: 0xa3401f,
  shadow: 0x2f3b2e,
} as const;
