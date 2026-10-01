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
  graftOffer,
  hexDistance,
  scoreRun,
  seedsForRun,
  hexKey,
  offsetToAxial,
  parseHexKey,
  previewPlacement,
  resolveAsIs,
  type ComboHit,
  type Command,
  type Content,
  type Hex,
  type PlacementPreview,
  type RunState,
  type SeasonReport,
} from '../sim';
import { EMPTY_ALMANAC, entryView, recordRun, type Almanac } from './almanac';
import type { Graft } from './city';
import { computeInsight, type Insight } from './insight';
import type { PhaseName } from './timeline';

/** A building to place, or spreading compost on a tile. */
export type Tool = { kind: 'build'; building: string } | { kind: 'compost' };

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
  | { kind: 'vision'; id: string };

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
  /** The Graft this run sent home, once chosen. */
  graft: Graft | null = null;
  private resolutions = 0;
  private listeners = new Set<() => void>();
  private cache: { state: RunState; asIs: RunState; insight: Insight | null } | null = null;

  constructor(
    readonly content: Content,
    public state: RunState,
    options: {
      almanac?: Almanac;
      onAlmanac?: (almanac: Almanac) => void;
      onGraft?: (graft: Graft) => void;
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
    this.onGraft = options.onGraft ?? (() => {});
    this.onCommand = options.onCommand ?? (() => {});
    this.onResolution = options.onResolution ?? (() => {});
    this.now = options.now ?? (() => new Date().toISOString());
  }

  private readonly onAlmanac: (almanac: Almanac) => void;
  private readonly onGraft: (graft: Graft) => void;
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
          ...(this.state.era > era && this.state.status === 'active'
            ? [{ kind: 'era' as const, era: this.state.era }]
            : []),
        ];
      }
    } else {
      this.message = result.error;
    }
    this.emit();
    return result.ok;
  }

  /** Ends the resolution being played (when it finishes, or the player skips it). */
  finishResolution(id?: number): void {
    if (!this.resolution || (id !== undefined && this.resolution.id !== id)) return;
    // Called with the id when it plays to the end; without one when the player skips.
    this.resolution = null;
    this.onResolution(false, id === undefined, this.state);
    this.emit();
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
  }

  /** Sends the run's Graft home: one of the districts offered at the end of the run. */
  chooseGraft(district: string): boolean {
    if (this.state.status === 'active' || this.graft) return false;
    const offer = graftOffer(this.content, this.state);
    if (!offer.options.some((o) => o.district.id === district)) return false;
    const score = scoreRun(this.content, this.state);
    this.graft = {
      district,
      tier: offer.tier.id,
      score: score.total,
      seeds: seedsForRun(this.content, this.state).total,
      seed: this.state.options.seed,
      vision: this.state.vision,
      visionAchieved: this.state.visionAchieved !== null,
      sentAt: this.now(),
    };
    this.onGraft(this.graft);
    this.emit();
    return true;
  }

  togglePause(): void {
    if (!this.resolution) return;
    this.resolution = { ...this.resolution, paused: !this.resolution.paused };
    this.emit();
  }

  selectBuilding(building: string | null): void {
    this.setTool(building ? { kind: 'build', building } : null);
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

  hoverAt(hex: Hex | null): void {
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
