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
  type BuildingDef,
  type BuildingState,
  type RunState,
  type SeasonReport,
  type Tile,
} from '../sim';
import { nextFloat, type RngState } from '../sim/rng';
import { contentFor } from '../sim/content/modifiers';
import { drinkingSources } from '../sim/season/commute';
import { walksToWater } from '../sim/water';
import { occupancy } from '../sim/queries';

export type Sight = 'forecast' | 'outcome';
export const SIGHTS: readonly Sight[] = ['forecast', 'outcome'];

export class Turn {
  /** Build-phase actions taken this season (not counting the draft pick). */
  actions = 0;
  /** Tiles kept free for something to come (the wonder's flower), by key. */
  reserved = new Set<string>();
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
    // Only the wonder itself goes on its kept tiles.
    const kept = this.content.byId[id]?.wonder ? new Set<string>() : this.reserved;
    return Object.values(this.state.map.tiles).filter(
      (t) =>
        !taken.has(hexKey(t)) &&
        !kept.has(hexKey(t)) &&
        canPlace(this.content, this.state, id, t).ok,
    );
  }

  /** The run's own rules: the water system, its twist, Root City's perks and its cards. */
  get rules(): Content {
    return contentFor(this.content, this.state);
  }

  /** Whether commuting is on for this run (DECISIONS.md, Teaching by layers). */
  get commuteOn(): boolean {
    return this.rules.rules.commute.enabled;
  }

  /** Whether the bot minds walks to work when it places things (off for the gate's comparison). */
  commuteAware = true;

  /** Whether local heat is on for this run (DECISIONS.md, Teaching by layers). */
  get localHeatOn(): boolean {
    return this.rules.rules.localHeat.enabled;
  }

  /** Whether the bot keeps heat sources near what they heat (off for the gate's comparison). */
  heatAware = true;

  /** Whether the water system is on for this run (EXPANSION.md). */
  get waterOn(): boolean {
    return this.rules.rules.water.enabled;
  }

  /** Whether a building here could draw water: beside the river, a lake or a channel. */
  watered(h: Hex, occ: Map<string, BuildingState> = occupancyOf(this.state), id?: string): boolean {
    const besideRiver =
      this.rules.rules.water.drawBesideRiver ||
      (id !== undefined && (this.content.byId[id]?.water?.besideRiver ?? false));
    // Water runs only downhill (the Highland): a channel below the tile can't feed it.
    const height = this.state.map.tiles[hexKey(h)]?.height ?? 0;
    return hexNeighbors(h).some((n) => {
      const key = hexKey(n);
      const tile = this.state.map.tiles[key];
      if (tile && (tile.type === 'river' || tile.type === 'reservoir' || tile.type === 'oasis'))
        return besideRiver;
      const b = occ.get(key);
      return (
        b !== undefined &&
        (this.content.byId[b.type]!.water?.channel ?? false) &&
        (tile?.height ?? 0) >= height
      );
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
  // A copy: the sim's own (a wonder covers 7 tiles) is cached and shared.
  return new Map(occupancy(state));
}

function rank(preferences: readonly string[], id: string): number {
  const i = preferences.indexOf(id);
  return i < 0 ? preferences.length : i;
}

/** Walks: work near homes, and homes near work that is far from any home. */
function commuteScore(turn: Turn, def: BuildingDef, tile: Hex): number {
  const { content, state } = turn;
  const free = turn.rules.rules.commute.freeDistance;
  const buildings = Object.values(state.buildings);
  const homes = buildings.filter((b) => content.byId[b.type]!.housing > 0);
  const nearestHome = (h: Hex) => Math.min(...homes.map((x) => hexDistance(x.at, h)));
  let score = 0;
  if (def.workers > 0 && homes.length > 0)
    score -= 1.5 * def.workers * Math.max(0, nearestHome(tile) - free);
  // Walks to water: homes near drinking water, and wells by the homes far from it.
  const water = turn.rules.rules.commute.toWater;
  if (water && walksToWater(turn.rules)) {
    const sources = drinkingSources(turn.rules, state);
    const toWater = (h: Hex) => Math.min(...sources.map((x) => hexDistance(x.at, h)));
    if (def.housing > 0) score -= 1.5 * Math.max(0, toWater(tile) - water.freeDistance);
    if (def.drinkingWater)
      for (const h of homes) {
        const now = toWater(h.at);
        const then = Math.min(now, hexDistance(h.at, tile));
        score +=
          2 * (Math.max(0, now - water.freeDistance) - Math.max(0, then - water.freeDistance));
      }
  }
  if (def.housing > 0) {
    for (const w of buildings) {
      const workers = content.byId[w.type]!.workers;
      if (workers > 0 && hexDistance(w.at, tile) <= free && nearestHome(w.at) > free)
        score += 2 * workers * (nearestHome(w.at) - free);
    }
  }
  return score;
}

/** Local heat: heat sources near buildings that need heat, and those near a source. */
function heatScore(turn: Turn, def: BuildingDef, tile: Hex): number {
  const { content, state } = turn;
  const range = turn.rules.rules.localHeat.range;
  const isSource = (d: BuildingDef) =>
    d.heatPump !== undefined || d.heatGeneration !== undefined || d.storage?.holds === 'heat';
  const needsHeat = (d: BuildingDef) =>
    (d.demand?.heat.day.some((n) => n > 0) ?? false) ||
    (d.demand?.heat.night.some((n) => n > 0) ?? false);
  const within = (pick: (d: BuildingDef) => boolean) =>
    Object.values(state.buildings).filter(
      (b) => pick(content.byId[b.type]!) && hexDistance(b.at, tile) <= range,
    ).length;
  let score = 0;
  if (isSource(def)) score += 3 * within(needsHeat);
  if (needsHeat(def)) score += 2 * Math.min(1, within(isSource));
  return score;
}

/** Ground the year's flood reaches: the Reach's floodplain, the coast's mudflat and saltmarsh. */
export const lowGround = (tile: Tile) =>
  tile.type === 'floodplain' || tile.type === 'mudflat' || tile.type === 'saltmarsh';

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

  // Keep the ground the flood reaches for things that survive it (and farm it).
  if (lowGround(tile)) score += def.floodTolerant ? -1 : -100;
  // With commuting on, work goes near homes and homes near work that is far from any.
  if (turn.commuteOn && turn.commuteAware) score += commuteScore(turn, def, tile);
  // With local heat on, heat sources go near what needs heat, and the reverse.
  if (turn.localHeatOn && turn.heatAware) score += heatScore(turn, def, tile);
  // With the water system on, buildings that need water go where they can draw it.
  if (turn.waterOn && def.water?.needs.some((n) => n > 0) && turn.watered(tile, occ, id))
    score += 4;
  if (tile.type === 'meadow' || tile.type === 'woodland') score -= 1;

  switch (id) {
    case 'floodplainFarm':
      score += tile.type === 'floodplain' ? 10 : 0;
      score += 2 * touching('composter', 'apiary');
      break;
    case 'orchard':
      score += 2 * touching('composter', 'apiary') + (tile.type === 'barren' ? 1 : 0);
      break;
    // The coast's crofts: on the meadow, out of the king tide's reach, by a composter.
    case 'croft':
      score +=
        (tile.type === 'meadow' ? 6 : tile.type === 'scrub' ? 3 : 0) +
        2 * touching('composter', 'apiary');
      // The mudflat is for oyster reefs.
      if (tile.type === 'mudflat') score -= 4;
      break;
    case 'oysterReef':
    case 'kelpFarm':
      score += 2 * touching('oysterReef', 'kelpFarm', 'kelpForest');
      break;
    case 'duneGrass':
      score += 2 * neighbors.filter((b) => content.byId[b.type]!.workers > 0).length;
      break;
    case 'composter':
      score += 3 * touching('floodplainFarm', 'orchard', 'fishPond', 'greenhouse', 'croft');
      score += 3 * touching('riceFishPaddy', 'mushroomCellar');
      break;
    // Willow Reach v2 (E3): next to what feeds them or what they feed.
    case 'greenhouse':
      score += 2 * touching('bathhouse');
      break;
    case 'bathhouse':
      score += 4 * Math.min(1, touching('kiln', 'heatWell'));
      score += 2 * touching('greenhouse', 'reedBed', 'commonsPlaza', 'cottage');
      break;
    case 'reedBed':
      score += 3 * touching('bathhouse');
      break;
    case 'riceFishPaddy':
      score += 2 * touching('composter', 'riceFishPaddy');
      break;
    case 'mushroomCellar': {
      score += 3 * touching('floodplainFarm', 'agrivoltaicField');
      const shaded =
        neighbors.some((b) => content.byId[b.type]!.tall) ||
        neighborTiles.some((t) => t.type === 'woodland');
      if (shaded) score += 2;
      break;
    }
    case 'apiary':
      score += 3 * touching('floodplainFarm', 'orchard', 'croft');
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
