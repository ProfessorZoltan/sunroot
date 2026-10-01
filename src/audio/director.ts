/**
 * What plays when (Milestone 9): game events into cues. The cue functions are
 * pure, so tests check them without audio; `connectAudio` wires them to the
 * game store and the engine.
 *
 * A building plays its note when placed (and a drafted blueprint when picked).
 * A placement that puts a combo to work plays that kind of combo's chord after
 * the note; so do loops that close and buildings that evolve when a season
 * ends. A discovery card unfolds with the chime and its chord. The soundtrack
 * gains a layer at each Harmony tier.
 */
import type { GameStore, Reveal } from '../game/store';
import type { Command, ComboLayer, Content, RunState } from '../sim';
import type { AudioEngine } from './engine';
import {
  buildingNote,
  cadence,
  chime,
  comboChord,
  fanfare,
  musicLayers,
  type NoteEvent,
} from './music';

export interface Cue {
  cue: string;
  notes: NoteEvent[];
}

const after = (beats: number, notes: NoteEvent[]) => notes.map((n) => ({ ...n, at: n.at + beats }));

function layersOf(content: Content, combos: string[]): ComboLayer[] {
  const layers = combos.map((id) => content.comboById[id]?.layer).filter((l) => l !== undefined);
  return [...new Set(layers)];
}

/** The cues for a command the game just carried out. */
export function commandCues(
  content: Content,
  command: Command,
  before: RunState,
  next: RunState,
  /** For a placement: the combos it puts to work that the player can see. */
  visible: string[] = [],
): Cue[] {
  const cues: Cue[] = [];
  if (command.type === 'place') {
    cues.push({
      cue: `place:${command.building}`,
      notes: [buildingNote(content, command.building)],
    });
    // Only combos the player can see: a sound must not give away a hidden formation.
    for (const layer of layersOf(content, visible))
      cues.push({ cue: `combo:${layer}`, notes: after(0.75, comboChord(layer)) });
  } else if (command.type === 'pickCard' && content.byId[command.card]) {
    const note = buildingNote(content, command.card);
    cues.push({ cue: `pick:${command.card}`, notes: [{ ...note, gain: note.gain * 0.6 }] });
  } else if (command.type === 'endSeason' && next.lastReport) {
    const report = next.lastReport;
    const closed = next.loops.filter((l) => !before.loops.some((b) => b.anchor === l.anchor));
    if (closed.length > 0) cues.push({ cue: 'combo:chain', notes: comboChord('chain') });
    if (report.evolved.length > 0)
      cues.push({ cue: 'combo:evolution', notes: after(1, comboChord('evolution')) });
    if (next.status !== 'active')
      cues.push({
        cue: `end:${next.status}`,
        notes: after(2, cadence(next.status === 'complete')),
      });
  }
  return cues;
}

/** The cue for a card as it is shown. */
export function revealCue(content: Content, reveal: Reveal): Cue {
  if (reveal.kind === 'combo') {
    const layer = content.comboById[reveal.id]?.layer ?? 'adjacency';
    return { cue: `discovery:${reveal.id}`, notes: [...chime(), ...after(1, comboChord(layer))] };
  }
  if (reveal.kind === 'start') return { cue: 'start', notes: after(0.2, chime().slice(0, 3)) };
  return { cue: reveal.kind, notes: chime() };
}

/** City events: a district's note when placed, a landmark's chord, the Sun Tree's fanfare. */
export function cityCue(kind: 'place' | 'upgrade' | 'landmark' | 'sunTree', midi = 62): Cue {
  if (kind === 'landmark')
    return { cue: 'landmark', notes: [...chime(), ...after(1, comboChord('formation'))] };
  if (kind === 'sunTree') return { cue: 'sunTree', notes: fanfare() };
  const voice = kind === 'upgrade' ? ('bell' as const) : ('marimba' as const);
  return { cue: kind, notes: [{ at: 0, midi, voice, length: 1.5, gain: 0.5 }] };
}

/**
 * Plays the game: notes for commands (call `command` from the store's
 * onCommand), a cue when each card is shown, and soundtrack layers that follow
 * Harmony. Returns a function that disconnects it.
 */
export function connectAudio(
  engine: AudioEngine,
  store: GameStore,
): {
  command: (command: Command, ok: boolean, before: RunState, after: RunState) => void;
  disconnect: () => void;
} {
  let shown: Reveal | null = null;
  const sync = () => {
    engine.setLayers(musicLayers(store.rules, store.state.harmony));
    const card = !store.resolution ? (store.reveals[0] ?? null) : null;
    if (card && card !== shown) {
      const cue = revealCue(store.content, card);
      engine.play(cue.cue, cue.notes);
    }
    shown = card;
  };
  const off = store.subscribe(sync);
  sync();
  return {
    command: (command, ok, before, next) => {
      if (!ok) return;
      // The placement's preview, worked out before the command, names the combos it forms.
      const p = store.placement;
      const visible =
        command.type === 'place' &&
        p?.preview.ok &&
        p.building === command.building &&
        p.at.q === command.at.q &&
        p.at.r === command.at.r
          ? store.visibleCombos(p.preview.combos).map((h) => h.combo)
          : [];
      for (const cue of commandCues(store.content, command, before, next, visible))
        engine.play(cue.cue, cue.notes);
    },
    disconnect: off,
  };
}
