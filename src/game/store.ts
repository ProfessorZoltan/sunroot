/**
 * The client's game state: the run, what the player is pointing at, the tool
 * in hand and the building being inspected. It changes the run only by
 * sending commands to the simulation, and tells subscribers when anything
 * changes. Derived numbers for the interface are cached per run state.
 */
import {
  applyCommand,
  axialToOffset,
  canPlace,
  canPlantGraft,
  effectiveContent,
  graftOffer,
  hexDistance,
  scoreRun,
  seedsForRun,
  hexKey,
  hexNeighbors,
  offsetToAxial,
  parseHexKey,
  previewPlacement,
  resolveAsIs,
  SEASONS,
  type ComboHit,
  type Command,
  type Content,
  type Hex,
  type PlacementPreview,
  type RunState,
  type SeasonReport,
  type WaterReport,
  type CommuteReport,
  type HeatLink,
} from '../sim';
import { walkLines, type WalkLine } from './commuteInfo';
import { heatLines, type HeatLine } from './heatInfo';
import { EMPTY_ALMANAC, entryView, recordRun, type Almanac } from './almanac';
import type { Graft, RunResult } from '../sim';
import { coppiceCombo, coppiceProblem } from '../sim/combos';
import { edgeKey, hedgeProblem } from '../sim/edges';
import { computeInsight, type Insight } from './insight';
import { mapMarks, type Mark } from './marks';
import type { PhaseName } from './timeline';

/** A building to place, spreading compost on a tile, or coppicing woodland (Coppice Wood). */
export type Tool =
  | { kind: 'build'; building: string }
  | { kind: 'compost' }
  | { kind: 'coppice' }
  /** Planting hedges along tile edges (the Hedgerow): the side of the tile in hand is `hedgeSide`. */
  | { kind: 'hedge' };

export interface Placement {
  building: string;
  at: Hex;
  preview: PlacementPreview;
}

export const COMPOST_TOOL = 'compost';

/** A card shown after a season plays out: a combo new to the Almanac, a new era, a vision met. */
export type Reveal =
  | { kind: 'combo'; id: string }
  | { kind: 'era'; era: number }
  | { kind: 'eraGoal'; era: number }
  | { kind: 'vision'; id: string }
  /** The expedition's city request met. */
  | { kind: 'request'; id: string }
  /** A project finished. */
  | { kind: 'project'; id: string }
  /** A run begun from Root City: what it brings, and the systems that join this run. */
  | { kind: 'start'; run: number; joining: string[] };

/** A season being played out on the map (Milestone 5). */
export interface Resolution {
  id: number;
  report: SeasonReport;
  /** What the interface showed before the season ended; the year strip fills from it. */
  before: Insight;
  phase: PhaseName;
  paused: boolean;
}

export class GameStore {
  tool: Tool | null = null;
  hover: Hex | null = null;
  /** Building uid shown in the inspector. */
  inspected: string | null = null;
  placement: Placement | null = null;
  message: string | null = null;
  resolution: Resolution | null = null;
  /** Cards waiting to be shown once the season has played out. */
  reveals: Reveal[] = [];
  almanac: Almanac;
  /** How this run was sent home, once it has been. */
  result: RunResult | null = null;
  /** Seeds banked in Root City before this run's. */
  readonly bankedSeeds: number;
  private resolutions = 0;
  private listeners = new Set<() => void>();
  private cache: { state: RunState; asIs: RunState; insight: Insight | null } | null = null;

  constructor(
    readonly content: Content,
    public state: RunState,
    options: {
      almanac?: Almanac;
      onAlmanac?: (almanac: Almanac) => void;
      /** Seeds already banked in Root City. */
      bankedSeeds?: number;
      /** Cards to show before play begins (a new run's start card). */
      intro?: Reveal[];
      /** Runs fast-forward's next step soon (a short pause, so each season shows). */
      defer?: (step: () => void) => void;
      /** The run was sent home: its Graft planted, or its Seeds banked. */
      onRunEnd?: (result: RunResult) => void;
      /** Every command sent, for the playtest log. */
      onCommand?: (command: Command, ok: boolean, before: RunState, after: RunState) => void;
      /** A season's resolution started, or ended (played out or skipped). */
      onResolution?: (playing: boolean, skipped: boolean, state: RunState) => void;
      /** The time, for the Graft's record (the simulation has no clock). */
      now?: () => string;
    } = {},
  ) {
    this.almanac = options.almanac ?? EMPTY_ALMANAC;
    this.onAlmanac = options.onAlmanac ?? (() => {});
    this.bankedSeeds = options.bankedSeeds ?? 0;
    this.reveals = options.intro ?? [];
    this.defer = options.defer ?? ((step) => setTimeout(step, 160));
    this.onRunEnd = options.onRunEnd ?? (() => {});
    this.onCommand = options.onCommand ?? (() => {});
    this.onResolution = options.onResolution ?? (() => {});
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private readonly defer: (step: () => void) => void;
  private readonly onAlmanac: (almanac: Almanac) => void;
  private readonly onRunEnd: (result: RunResult) => void;
  private readonly onCommand: (
    command: Command,
    ok: boolean,
    before: RunState,
    after: RunState,
  ) => void;
  private readonly onResolution: (playing: boolean, skipped: boolean, state: RunState) => void;
  private readonly now: () => string;

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }

  private asIs(): RunState {
    if (this.cache?.state !== this.state) {
      this.cache = {
        state: this.state,
        // What a player can foresee: the storm's target is a risk, not a result.
        asIs: resolveAsIs(this.content, this.state, { forecast: true }),
        insight: null,
      };
    }
    return this.cache.asIs;
  }

  /** The content as this run plays it (Root City's perks, the twist, tunings, charters). */
  get rules(): Content {
    return effectiveContent(this.content, this.state);
  }

  /** This season's walks to work as they stand (a forecast), or null without commuting. */
  get commuteForecast(): CommuteReport | null {
    return this.asIs().lastReport?.commute ?? null;
  }

  /** The building the map shows links for: the one inspected, or under the cursor with no tool. */
  private get focus(): string | null {
    return (
      this.inspected ??
      (this.tool || !this.hover
        ? null
        : (Object.values(this.state.buildings).find((b) => hexKey(b.at) === hexKey(this.hover!))
            ?.uid ?? null))
    );
  }

  /** The walks to draw, for the building in focus. */
  get walkLines(): WalkLine[] {
    const report = this.resolution ? null : this.commuteForecast;
    return report ? walkLines(this.rules, this.state, report, this.focus) : [];
  }

  /** Whether this run can coppice woodland (Willow Reach v2, with water). */
  get canCoppice(): boolean {
    return coppiceCombo(this.rules) !== undefined;
  }

  /** Why the tile can't be coppiced, or null. */
  coppiceProblem(at: Hex): string | null {
    return coppiceProblem(this.rules, this.state, at);
  }

  /** Is this building a coppice the player can stop? */
  isCoppice(uid: string): boolean {
    return coppiceCombo(this.rules)?.into === this.state.buildings[uid]?.type;
  }

  /** This season's heat as it stands (who warms whom), or null unless heat is local. */
  /** Buildings going cold this season as it stands (the heat layer). */
  get coldForecast(): string[] {
    return this.asIs().lastReport?.cold ?? [];
  }

  get heatForecast(): HeatLink[] | null {
    return this.asIs().lastReport?.heat ?? null;
  }

  /** The heat to draw, for the building in focus. */
  get heatLines(): HeatLine[] {
    return this.resolution ? [] : heatLines(this.state, this.heatForecast, this.focus);
  }

  /** This season's water as it stands (a forecast), or null when the run has no water. */
  get waterForecast(): WaterReport | null {
    return this.asIs().lastReport?.water ?? null;
  }

  /** Everything the panels show, for the current state. */
  get insight(): Insight {
    const asIs = this.asIs();
    this.cache!.insight ??= computeInsight(this.content, this.state, asIs);
    return this.cache!.insight;
  }

  /** Sends a command; on failure the reason is shown instead. */
  dispatch(command: Command): boolean {
    // Acting during a resolution skips the rest of it.
    this.skipResolution();
    const before = command.type === 'endSeason' ? this.insight : null;
    const era = this.state.era;
    const previous = this.state;
    const result = applyCommand(this.content, this.state, command);
    this.onCommand(command, result.ok, previous, result.ok ? result.state : previous);
    if (result.ok) {
      this.state = result.state;
      if (before) {
        this.onResolution(true, false, this.state);
        this.resolution = {
          id: ++this.resolutions,
          report: this.state.lastReport!,
          before,
          phase: 'event',
          paused: false,
        };
      }
      this.message = null;
      const tool = this.tool;
      if (tool?.kind === 'build' && !this.state.unlocked.includes(tool.building)) this.tool = null;
      if (this.inspected && !this.state.buildings[this.inspected]) this.inspected = null;
      if (this.state.status !== 'active') this.tool = null;
      this.refreshPlacement();
      // The Almanac keeps what a season found once the season has ended (hints bought
      // this season can still be undone until then; the Almanac view shows them already).
      const { almanac, fresh } =
        command.type === 'endSeason'
          ? recordRun(this.almanac, this.state)
          : { almanac: this.almanac, fresh: [] };
      if (almanac !== this.almanac) {
        this.almanac = almanac;
        this.onAlmanac(almanac);
      }
      if (command.type === 'endSeason') {
        const r = this.state.lastReport!;
        this.reveals = [
          ...this.reveals,
          ...fresh.map((id) => ({ kind: 'combo' as const, id })),
          ...(r.eraGoalMet !== null ? [{ kind: 'eraGoal' as const, era: r.eraGoalMet }] : []),
          ...(r.visionAchieved && this.state.vision
            ? [{ kind: 'vision' as const, id: this.state.vision }]
            : []),
          ...r.projectsDone.map((id) => ({ kind: 'project' as const, id })),
          ...(r.requestMet && this.state.options.expedition?.request
            ? [{ kind: 'request' as const, id: this.state.options.expedition.request }]
            : []),
          ...(this.state.era > era && this.state.status === 'active'
            ? [{ kind: 'era' as const, era: this.state.era }]
            : []),
        ];
      }
    } else {
      this.message = result.error;
    }
    this.emit();
    // A choice fast-forward was waiting for has been made: carry on.
    if (result.ok && command.type !== 'endSeason') this.keepGoing();
    return result.ok;
  }

  /** Ends the resolution being played (when it finishes, or the player skips it). */
  finishResolution(id?: number): void {
    if (!this.resolution || (id !== undefined && this.resolution.id !== id)) return;
    // Called with the id when it plays to the end; without one when the player skips.
    this.resolution = null;
    this.onResolution(false, id === undefined, this.state);
    this.emit();
    this.keepGoing();
  }

  // ------------------------------------------------------------------ fast-forward

  /** While fast-forwarding: the turn it runs up to (the next spring). */
  fastForwardTo: number | null = null;

  /**
   * Ends seasons one after another, skipping their playback, until next spring.
   * It waits for choices (a card, a charter, a vision) and cards being read,
   * then carries on; it stops if the season would end short of energy or with
   * citizens unfed, and when the run ends.
   */
  fastForward(): void {
    if (this.state.status !== 'active') return;
    const seasons = SEASONS.length;
    this.fastForwardTo = (Math.floor(this.state.turn / seasons) + 1) * seasons;
    this.message = null;
    this.emit();
    this.keepGoing();
  }

  stopFastForward(message: string | null = null): void {
    if (this.fastForwardTo === null) return;
    this.fastForwardTo = null;
    this.message = message;
    this.emit();
  }

  /** What fast-forward is waiting for, or null when it can end the season. */
  get fastForwardWaiting(): string | null {
    const s = this.state;
    if (s.visionOffer.length > 0) return 'Choose a vision to carry on.';
    if (s.charterOffer.length > 0) return 'Choose a charter to carry on.';
    if (s.evolutionOffer.length > 0) return 'Choose what the building becomes to carry on.';
    if (s.draft.offer.length > 0 && !s.draft.picked) return 'Pick a card to carry on.';
    return null;
  }

  private keepGoing(): void {
    if (this.fastForwardTo === null) return;
    this.defer(() => this.step());
  }

  private step(): void {
    if (this.fastForwardTo === null) return;
    if (this.state.status !== 'active') return this.stopFastForward();
    if (this.state.turn >= this.fastForwardTo) return this.stopFastForward('A year went by.');
    if (this.resolution) return this.finishResolution();
    if (this.reveals.length > 0 || this.fastForwardWaiting) return; // carries on when done
    // Never coast into trouble: stop if this season would end short or hungry.
    const now = this.insight.now;
    const short = now.energy.day.shortfall + now.energy.night.shortfall;
    if (short > 0)
      return this.stopFastForward(
        `Fast-forward stopped: this season would end ${short} energy short.`,
      );
    if (now.food.unfed > 0)
      return this.stopFastForward(
        `Fast-forward stopped: ${now.food.unfed} citizens would go hungry this season.`,
      );
    if (!this.dispatch({ type: 'endSeason' })) return this.stopFastForward(this.message);
    this.finishResolution();
  }

  /** Any action during a resolution skips the rest of it. */
  private skipResolution(): void {
    if (!this.resolution) return;
    this.resolution = null;
    this.onResolution(false, true, this.state);
  }

  setResolutionPhase(id: number, phase: PhaseName): void {
    if (this.resolution?.id !== id || this.resolution.phase === phase) return;
    this.resolution = { ...this.resolution, phase };
    this.emit();
  }

  /** Closes the card on top. */
  dismissReveal(): void {
    if (this.reveals.length === 0) return;
    this.reveals = this.reveals.slice(1);
    this.emit();
    this.keepGoing();
  }

  /** The run's Tempest level (0 for none). */
  get tempest(): number {
    return this.state.options.expedition?.tempest ?? 0;
  }

  /** Seeds this run earned (once it has ended). */
  get seedsEarned(): number {
    return seedsForRun(this.content, this.state).total;
  }

  /** Seeds in hand at the end of the run: banked ones plus this run's. */
  get seedsInHand(): number {
    return this.bankedSeeds + this.seedsEarned;
  }

  /** Whether the Seeds in hand pay for planting this run's Graft. */
  get canPlant(): boolean {
    return this.state.status !== 'active' && canPlantGraft(this.content, this.seedsInHand);
  }

  /** Plants one of the districts offered at the end of the run, paying its Seeds. */
  chooseGraft(district: string): boolean {
    if (this.state.status === 'active' || this.result || !this.canPlant) return false;
    const offer = graftOffer(this.content, this.state);
    if (!offer.options.some((o) => o.district.id === district)) return false;
    const graft: Graft = {
      district,
      tier: offer.tier.id,
      score: scoreRun(this.content, this.state).total,
      seeds: this.seedsEarned,
      seed: this.state.options.seed,
      vision: this.state.vision,
      visionAchieved: this.state.visionAchieved !== null,
      sentAt: this.now(),
      ...(this.tempest > 0 ? { tempest: this.tempest } : {}),
    };
    return this.sendHome({
      graft,
      earned: this.seedsEarned,
      spent: this.content.progression?.graftCost ?? 0,
      tier: offer.tier.id,
      tempest: this.tempest,
    });
  }

  /** Banks the run's Seeds without planting a Graft (when they can't pay for one). */
  bankSeeds(): boolean {
    if (this.state.status === 'active' || this.result) return false;
    return this.sendHome({
      graft: null,
      earned: this.seedsEarned,
      spent: 0,
      tier: graftOffer(this.content, this.state).tier.id,
      tempest: this.tempest,
    });
  }

  private sendHome(result: RunResult): boolean {
    this.result = result;
    this.onRunEnd(result);
    this.emit();
    return true;
  }

  togglePause(): void {
    if (!this.resolution) return;
    this.resolution = { ...this.resolution, paused: !this.resolution.paused };
    this.emit();
  }

  selectBuilding(building: string | null): void {
    // A hedgerow is planted along edges, with its own tool.
    if (building && this.rules.byId[building]?.edge) return this.setTool({ kind: 'hedge' });
    this.setTool(building ? { kind: 'build', building } : null);
  }

  /** Which side of the tile under the cursor the hedge tool aims at (HEX_DIRECTIONS order). */
  hedgeSide = 0;

  /** The edge the hedge tool aims at: the cursor's tile and its neighbour on `hedgeSide`. */
  get hoverEdge(): {
    a: Hex;
    b: Hex;
    key: string;
    planted: boolean;
    problem: string | null;
  } | null {
    if (this.tool?.kind !== 'hedge' || !this.hover) return null;
    const a = this.hover;
    const b = hexNeighbors(a)[this.hedgeSide]!;
    const key = edgeKey(a, b);
    const planted = this.state.hedges.includes(key);
    return {
      a,
      b,
      key,
      planted,
      problem: planted ? null : hedgeProblem(this.rules, this.state, a, b),
    };
  }

  /** `[` and `]`: turn the hedge tool to the tile's next side. */
  turnHedge(step: 1 | -1): void {
    this.hedgeSide = (this.hedgeSide + step + 6) % 6;
    this.emit();
  }

  setTool(tool: Tool | null): void {
    if (tool) this.skipResolution();
    this.tool = tool;
    this.message = null;
    if (tool) this.inspected = null;
    this.refreshPlacement();
    this.emit();
  }

  get selectedBuilding(): string | null {
    return this.tool?.kind === 'build' ? this.tool.building : null;
  }

  /** The pointer is over this tile; `side`, if given, is the side it is nearest (for hedges). */
  hoverAt(hex: Hex | null, side?: number): void {
    if (side !== undefined && this.tool?.kind === 'hedge' && side !== this.hedgeSide) {
      this.hedgeSide = side;
      if (hex && this.hover && hexKey(hex) === hexKey(this.hover)) return this.emit();
    }
    if (hex === this.hover || (hex && this.hover && hexKey(hex) === hexKey(this.hover))) return;
    this.hover = hex;
    this.refreshPlacement();
    this.emit();
  }

  /** A click uses the tool in hand (which stays in hand), or inspects a building. */
  clickAt(hex: Hex): void {
    this.skipResolution();
    if (this.tool?.kind === 'build') {
      this.dispatch({ type: 'place', building: this.tool.building, at: hex });
    } else if (this.tool?.kind === 'compost') {
      this.dispatch({ type: 'spreadCompost', at: hex });
    } else if (this.tool?.kind === 'hedge') {
      // A click plants a hedge on the edge in aim, or clears the one there.
      const e = this.hover && hexKey(hex) === hexKey(this.hover) ? this.hoverEdge : null;
      const b = e?.b ?? hexNeighbors(hex)[this.hedgeSide]!;
      const planted = this.state.hedges.includes(edgeKey(hex, b));
      this.dispatch({ type: planted ? 'removeHedge' : 'plantHedge', a: hex, b });
    } else if (this.tool?.kind === 'coppice') {
      this.dispatch({ type: 'coppice', at: hex });
    } else {
      const b = Object.values(this.state.buildings).find((x) => hexKey(x.at) === hexKey(hex));
      this.inspected = b ? b.uid : null;
      this.emit();
    }
  }

  /** Enter: use the tool at the cursor. */
  confirm(): void {
    if (this.hover) this.clickAt(this.hover);
  }

  /** Arrow keys: move the cursor one tile (up and down keep to the same column). */
  moveCursor(dx: number, dy: number): void {
    const start = this.hover ?? this.state.buildings.b0?.at ?? { q: 0, r: 0 };
    const { col, row } = axialToOffset(start);
    const next = offsetToAxial(col + dx, row + dy);
    if (this.state.map.tiles[hexKey(next)]) this.hoverAt(next);
  }

  /**
   * N / Shift+N: step through the tiles where the tool can be used. Sensible
   * sites come first (for buildings the flood would damage, dry land first),
   * nearest the Founders' Camp first; every legal site is still in the cycle.
   */
  nextSite(step: 1 | -1 = 1): void {
    const sites = this.siteCycle();
    if (sites.length === 0) return;
    const at = this.hover ? sites.findIndex((t) => hexKey(t) === hexKey(this.hover!)) : -1;
    const next =
      at < 0 ? (step === 1 ? 0 : sites.length - 1) : (at + step + sites.length) % sites.length;
    this.hoverAt(sites[next]!);
    // The hedge tool turns to the first side of that tile it can plant on.
    if (this.tool?.kind === 'hedge') {
      const h = sites[next]!;
      const side = hexNeighbors(h).findIndex(
        (n) => hedgeProblem(this.rules, this.state, h, n) === null,
      );
      if (side >= 0) this.hedgeSide = side;
      this.emit();
    }
  }

  private marksCache: { state: RunState; marks: Mark[] } | null = null;

  /** What the map marks for the season: lasting effects and the coming event's reach. */
  get marks(): Mark[] {
    if (this.marksCache?.state !== this.state)
      this.marksCache = {
        state: this.state,
        marks: mapMarks(this.rules, this.state, this.insight.now),
      };
    return this.marksCache.marks;
  }

  private sitesCache: { state: RunState; tool: Tool; sites: { at: Hex; risky: boolean }[] } | null =
    null;

  /**
   * Every legal tile for the building (or compost) being placed, for the map
   * to highlight; `risky` marks floodplain a flood would damage it on.
   */
  get legalSites(): { at: Hex; risky: boolean }[] {
    const tool = this.tool;
    if (!tool) return [];
    if (this.sitesCache?.state === this.state && this.sitesCache.tool === tool)
      return this.sitesCache.sites;
    const def = tool.kind === 'build' ? this.content.byId[tool.building] : undefined;
    const sites = this.siteCycle().map((at) => ({
      at,
      risky:
        def !== undefined &&
        !def.floodTolerant &&
        this.state.map.tiles[hexKey(at)]?.type === 'floodplain',
    }));
    this.sitesCache = { state: this.state, tool, sites };
    return sites;
  }

  private siteCycle(): Hex[] {
    const tool = this.tool;
    if (!tool) return [];
    const camp = this.state.buildings.b0?.at ?? { q: 0, r: 0 };
    const ladder = this.content.rules.landHealth;
    const def = tool.kind === 'build' ? this.content.byId[tool.building] : undefined;
    const legal = Object.values(this.state.map.tiles).filter((t) =>
      tool.kind === 'build'
        ? canPlace(this.content, this.state, tool.building, t).ok
        : tool.kind === 'hedge'
          ? hexNeighbors(t).some((n) => hedgeProblem(this.rules, this.state, t, n) === null)
          : tool.kind === 'coppice'
            ? coppiceProblem(this.rules, this.state, t) === null
            : ladder.indexOf(t.type) >= 0 && ladder.indexOf(t.type) < ladder.length - 1,
    );
    const risky = (t: { type: string }) =>
      def !== undefined && !def.floodTolerant && t.type === 'floodplain';
    return legal
      .map((t) => ({ t, rank: (risky(t) ? 1000 : 0) + hexDistance(t, camp) }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ t }) => ({ q: t.q, r: t.r }));
  }

  /**
   * Combos a placement would put to work that the player may see: adjacency
   * and chains always (the obvious layers), hidden ones once in the Almanac.
   */
  visibleCombos(hits: ComboHit[]): ComboHit[] {
    return hits.filter((h) => {
      const combo = this.content.comboById[h.combo];
      if (!combo) return false;
      if (combo.layer === 'adjacency' || combo.layer === 'chain') return true;
      return entryView(this.almanac, this.state, combo) === 'known';
    });
  }

  /** Vines between the tiles of each visible combo the placement would form. */
  get vines(): Hex[][] {
    const p = this.placement;
    if (!p?.preview.ok) return [];
    const where = (uid: string) => this.state.buildings[uid]?.at ?? p.at;
    return this.visibleCombos(p.preview.combos).map((h) =>
      h.tiles ? h.tiles.map(parseHexKey) : h.members.map(where),
    );
  }

  inspect(uid: string | null): void {
    this.inspected = uid;
    this.emit();
  }

  get canUndo(): boolean {
    return this.state.seasonCommands.length > 0;
  }

  private refreshPlacement(): void {
    const building = this.selectedBuilding;
    if (!building || !this.hover) {
      this.placement = null;
      return;
    }
    this.placement = {
      building,
      at: this.hover,
      preview: previewPlacement(this.content, this.state, building, this.hover, this.asIs(), {
        forecast: true,
      }),
    };
  }
}
