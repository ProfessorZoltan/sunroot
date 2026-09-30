import type { RunState, SeasonSnapshot } from './types';

/** A deep copy of the state without the undo bookkeeping. */
export function snapshot(state: RunState): SeasonSnapshot {
  const { seasonStart: _start, seasonCommands: _commands, ...rest } = state;
  return structuredClone(rest);
}

/** A deep copy of a state that the caller may mutate. The season-start snapshot is shared, never mutated. */
export function cloneState(state: RunState): RunState {
  const { seasonStart, seasonCommands, ...rest } = state;
  return { ...structuredClone(rest), seasonStart, seasonCommands: [...seasonCommands] };
}
