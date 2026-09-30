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
  hexDistance,
  hexKey,
  offsetToAxial,
  previewPlacement,
  resolveAsIs,
  type Command,
  type Content,
  type Hex,
  type PlacementPreview,
  type RunState,
} from '../sim';
import { computeInsight, type Insight } from './insight';

/** A building to place, or spreading compost on a tile. */
export type Tool = { kind: 'build'; building: string } | { kind: 'compost' };

export interface Placement {
  building: string;
  at: Hex;
  preview: PlacementPreview;
}

export const COMPOST_TOOL = 'compost';

export class GameStore {
  tool: Tool | null = null;
  hover: Hex | null = null;
  /** Building uid shown in the inspector. */
  inspected: string | null = null;
  placement: Placement | null = null;
  message: string | null = null;
  private listeners = new Set<() => void>();
  private cache: { state: RunState; asIs: RunState; insight: Insight | null } | null = null;

  constructor(
    readonly content: Content,
    public state: RunState,
  ) {}

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
        asIs: resolveAsIs(this.content, this.state),
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
    const result = applyCommand(this.content, this.state, command);
    if (result.ok) {
      this.state = result.state;
      this.message = null;
      const tool = this.tool;
      if (tool?.kind === 'build' && !this.state.unlocked.includes(tool.building)) this.tool = null;
      if (this.inspected && !this.state.buildings[this.inspected]) this.inspected = null;
      if (this.state.status !== 'active') this.tool = null;
      this.refreshPlacement();
    } else {
      this.message = result.error;
    }
    this.emit();
    return result.ok;
  }

  selectBuilding(building: string | null): void {
    this.setTool(building ? { kind: 'build', building } : null);
  }

  setTool(tool: Tool | null): void {
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
      preview: previewPlacement(this.content, this.state, building, this.hover, this.asIs()),
    };
  }
}
