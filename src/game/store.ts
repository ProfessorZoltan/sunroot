/**
 * The client's game state: the run, what the player is pointing at, and the
 * building they are placing. It changes the run only by sending commands to
 * the simulation, and tells subscribers when anything changes.
 */
import {
  applyCommand,
  hexKey,
  previewPlacement,
  resolveAsIs,
  type Command,
  type Content,
  type Hex,
  type PlacementPreview,
  type RunState,
} from '../sim';

export interface Placement {
  building: string;
  at: Hex;
  preview: PlacementPreview;
}

export class GameStore {
  selected: string | null = null;
  hover: Hex | null = null;
  placement: Placement | null = null;
  message: string | null = null;
  private listeners = new Set<() => void>();
  private asIs: { state: RunState; resolved: RunState } | null = null;

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

  /** Sends a command; on failure the reason is shown instead. */
  dispatch(command: Command): boolean {
    const result = applyCommand(this.content, this.state, command);
    if (result.ok) {
      this.state = result.state;
      this.message = null;
      if (this.selected && !this.state.unlocked.includes(this.selected)) this.selected = null;
      this.refreshPlacement();
    } else {
      this.message = result.error;
    }
    this.emit();
    return result.ok;
  }

  select(building: string | null): void {
    this.selected = building;
    this.message = null;
    this.refreshPlacement();
    this.emit();
  }

  hoverAt(hex: Hex | null): void {
    if (hex === this.hover || (hex && this.hover && hexKey(hex) === hexKey(this.hover))) return;
    this.hover = hex;
    this.refreshPlacement();
    this.emit();
  }

  /** A click places the selected building; the selection stays for placing another. */
  clickAt(hex: Hex): void {
    if (!this.selected) return;
    this.dispatch({ type: 'place', building: this.selected, at: hex });
  }

  get canUndo(): boolean {
    return this.state.seasonCommands.length > 0;
  }

  private refreshPlacement(): void {
    if (!this.selected || !this.hover) {
      this.placement = null;
      return;
    }
    if (this.asIs?.state !== this.state) {
      this.asIs = { state: this.state, resolved: resolveAsIs(this.content, this.state) };
    }
    this.placement = {
      building: this.selected,
      at: this.hover,
      preview: previewPlacement(
        this.content,
        this.state,
        this.selected,
        this.hover,
        this.asIs.resolved,
      ),
    };
  }
}
