/**
 * A bot's view of one season: it applies commands through the public API
 * (exactly as a player would), finds sites, and can peek at how the season
 * would end, since ending a season is a pure function of the state.
 */
import {
  applyCommand,
  forecastSeason,
  canPlace,
  hexDistance,
  hexKey,
  hexNeighbors,
  type Command,
  type Content,
  type Hex,
  type BuildingState,
  type RunState,
  type SeasonReport,
  type Tile,
} from '../sim';
import { nextFloat, type RngState } from '../sim/rng';
import { contentFor } from '../sim/content/modifiers';

export type Sight = 'forecast' | 'outcome';
export const SIGHTS: readonly Sight[] = ['forecast', 'outcome'];

export class Turn {
  /** Build-phase actions taken this season (not counting the draft pick). */
  actions = 0;
  private peeked: { state: RunState; report: SeasonReport } | null = null;

  constructor(
    readonly content: Content,
    public state: RunState,
    readonly rng: RngState,
    /**
     * What the bot can see ahead: `forecast` is what a player sees (chance
     * outcomes such as the storm's target stay unknown); `outcome` is the
     * season exactly as it will resolve.
     */
    readonly sight: Sight = 'forecast',
  ) {}

  apply(command: Command): boolean {
    const result = applyCommand(this.content, this.state, command);
    if (!result.ok) return false;
    this.state = result.state;
    this.peeked = null;
    if (command.type !== 'pickCard') this.actions++;
    return true;
  }

  save(): { state: RunState; actions: number } {
    return { state: this.state, actions: this.actions };
  }

  restore(saved: { state: RunState; actions: number }): void {
    this.state = saved.state;
    this.actions = saved.actions;
    this.peeked = null;
  }

  /** How the season would end if nothing else were done. Requires the draft pick first. */
  peek(): { state: RunState; report: SeasonReport } | null {
    if (this.peeked) return this.peeked;
    const result = applyCommand(this.content, this.state, { type: 'endSeason' });
    if (!result.ok) return null;
    const state =
      this.sight === 'forecast' ? forecastSeason(this.content, this.state) : result.state;
    this.peeked = { state, report: state.lastReport! };
    return this.peeked;
  }

  count(id: string): number {
    return Object.values(this.state.buildings).filter((b) => b.type === id).length;
  }

  has(id: string): boolean {
    return this.count(id) > 0;
  }

  unlocked(id: string): boolean {
    return this.state.unlocked.includes(id);
  }

  freeWorkers(): number {
    const used = Object.values(this.state.buildings).reduce(
      (sum, b) => sum + this.content.byId[b.type]!.workers,
      0,
    );
    return this.state.citizens - used;
  }

  foodStorage(): number {
    return Object.values(this.state.buildings).reduce(
      (sum, b) => sum + this.content.byId[b.type]!.foodStorage,
      0,
    );
  }

  housing(): number {
    return Object.values(this.state.buildings).reduce(
      (sum, b) => sum + this.content.byId[b.type]!.housing,
      0,
    );
  }

  /** Whether `id` could be built now, keeping `reserve` materials back. */
  canBuild(id: string, reserve = 0): boolean {
    const def = this.content.byId[id];
    if (!def || !this.unlocked(id)) return false;
    if (this.state.stores.materials < def.cost + reserve) return false;
    return def.workers <= this.freeWorkers();
  }

  /** Empty legal sites (bots don't build canopies over farms). */
  sites(id: string): Tile[] {
    const taken = occupancyOf(this.state);
    return Object.values(this.state.map.tiles).filter(
      (t) => !taken.has(hexKey(t)) && canPlace(this.content, this.state, id, t).ok,
    );
  }

  /** The run's own rules: the water system, its twist, Root City's perks and its cards. */
  get rules(): Content {
    return contentFor(this.content, this.state);
  }

  /** Whether the water system is on for this run (EXPANSION.md). */
  get waterOn(): boolean {
    return this.rules.rules.water.enabled;
  }

  /** Whether a building here could draw water: beside the river, a lake or a channel. */
  watered(h: Hex, occ: Map<string, BuildingState> = occupancyOf(this.state)): boolean {
    return hexNeighbors(h).some((n) => {
      const key = hexKey(n);
      const tile = this.state.map.tiles[key];
      if (tile && (tile.type === 'river' || tile.type === 'reservoir'))
        return this.rules.rules.water.drawBesideRiver;
      const b = occ.get(key);
      return b !== undefined && (this.content.byId[b.type]!.water?.channel ?? false);
    });
  }

  /** The best-scoring legal site for a building, or undefined. */
  bestSite(id: string): Hex | undefined {
    let best: Tile | undefined;
    let bestScore = -Infinity;
    const occ = occupancyOf(this.state);
    for (const t of this.sites(id)) {
      const score = siteScore(this, id, t, occ) + nextFloat(this.rng) * 0.1;
      if (score > bestScore) {
        best = t;
        bestScore = score;
      }
    }
    return best && bestScore > -50 ? { q: best.q, r: best.r } : undefined;
  }

  /** Builds `id` at its best site if it can; returns whether it did. */
  build(id: string, reserve = 0): boolean {
    if (!this.canBuild(id, reserve)) return false;
    const at = this.bestSite(id);
    return at ? this.apply({ type: 'place', building: id, at }) : false;
  }

  /** Picks the first offered card in preference order (or the first card). */
  pick(preferences: readonly string[]): void {
    const offer = this.state.draft.offer;
    if (offer.length === 0 || this.state.draft.picked) return;
    const ranked = [...offer].sort((a, b) => rank(preferences, a) - rank(preferences, b));
    this.apply({ type: 'pickCard', card: ranked[0]! });
  }
}

function occupancyOf(state: RunState): Map<string, BuildingState> {
  return new Map(Object.values(state.buildings).map((b) => [hexKey(b.at), b]));
}

function rank(preferences: readonly string[], id: string): number {
  const i = preferences.indexOf(id);
  return i < 0 ? preferences.length : i;
}

/** How good a tile is for a building, by simple local rules a player would use. */
export function siteScore(
  turn: Turn,
  id: string,
  tile: Tile,
  occ: Map<string, BuildingState> = occupancyOf(turn.state),
): number {
  const { content, state } = turn;
  const def = content.byId[id]!;
  const neighbors = hexNeighbors(tile)
    .map((h) => occ.get(hexKey(h)))
    .filter((b) => b !== undefined);
  const neighborTiles = hexNeighbors(tile)
    .map((h) => state.map.tiles[hexKey(h)])
    .filter((t) => t !== undefined);
  const touching = (...types: string[]) => neighbors.filter((b) => types.includes(b.type)).length;
  let score = 0;

  // Keep the floodplain for things that survive the flood (and farm it).
  if (tile.type === 'floodplain') score += def.floodTolerant ? -1 : -100;
  // With the water system on, buildings that need water go where they can draw it.
  if (turn.waterOn && def.water?.needs.some((n) => n > 0) && turn.watered(tile, occ)) score += 4;
  if (tile.type === 'meadow' || tile.type === 'woodland') score -= 1;

  switch (id) {
    case 'floodplainFarm':
      score += tile.type === 'floodplain' ? 10 : 0;
      score += 2 * touching('composter', 'apiary');
      break;
    case 'orchard':
      score += 2 * touching('composter', 'apiary') + (tile.type === 'barren' ? 1 : 0);
      break;
    case 'composter':
      score += 3 * touching('floodplainFarm', 'orchard', 'fishPond', 'greenhouse');
      break;
    case 'apiary':
      score += 3 * touching('floodplainFarm', 'orchard');
      if (touching('windSpire') > 0) score -= 100;
      break;
    case 'solarCanopy':
    case 'solarThermalCollector': {
      const shaded =
        neighbors.some((b) => content.byId[b.type]!.tall) ||
        neighborTiles.some((t) => t.type === 'woodland');
      if (shaded) score -= 5;
      break;
    }
    case 'windSpire': {
      const crowd = Object.values(state.buildings).filter(
        (b) => b.type === 'windSpire' && hexDistance(b.at, tile) <= 2,
      ).length;
      score -= 5 * crowd;
      if (touching('apiary') > 0) score -= 3;
      break;
    }
    case 'cottage':
      if (neighborTiles.some((t) => t.type === 'meadow' || t.type === 'woodland')) score += 2;
      break;
    case 'heatWell':
      score += 3 * touching('kiln');
      break;
    case 'kiln':
      score += 3 * touching('heatWell');
      break;
    case 'riverWheel':
      score += 3 * touching('weir');
      break;
    case 'treeNursery':
      score += neighborTiles.filter((t) => ['barren', 'scrub', 'meadow'].includes(t.type)).length;
      break;
    case 'pollinatorMeadow':
      score +=
        5 * touching('windSpire') + (tile.type === 'barren' ? 2 : tile.type === 'scrub' ? 1 : 0);
      break;
    case 'salvageYard':
      score += (tile.salvage ?? 0) / 10;
      break;
    case 'cistern': {
      // On the floodplain the spring flood fills it; upstream, it serves more of the river.
      score += tile.type === 'floodplain' ? 5 : 0;
      const near = hexNeighbors(tile)
        .map((h) => state.map.tiles[hexKey(h)]?.riverIndex)
        .filter((i): i is number => i !== undefined);
      if (near.length > 0) score += 3 * (1 - Math.min(...near) / state.map.river.length);
      break;
    }
    case 'levee':
      score += neighborTiles.filter((t) => t.type === 'floodplain').length;
      break;
  }
  return score;
}
