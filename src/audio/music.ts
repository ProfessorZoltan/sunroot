/**
 * Sunroot's music as data (Milestone 9): which note each building plays,
 * which chord each kind of combo plays, and the soundtrack's layers. Pure
 * functions, so what plays when is testable without a sound card; the engine
 * (engine.ts) only turns these events into sound.
 *
 * Everything is in D major. Buildings play notes of the D major pentatonic
 * scale, so any run of placements sounds like a tune. The soundtrack loops
 * D – Bm – G – A and adds an instrument at each Harmony tier.
 */
import type { BuildingKind, ComboLayer, Content } from '../sim';
import { createRng, nextFloat, nextInt } from '../sim/rng';

/** How a note is voiced: each is synthesized in engine.ts. */
export type Voice = 'marimba' | 'bell' | 'pluck' | 'flute' | 'chime' | 'pad';

export interface NoteEvent {
  /** Beats from the start of the bar (or the cue). */
  at: number;
  midi: number;
  voice: Voice;
  /** In beats. */
  length: number;
  gain: number;
}

export const BEATS_PER_BAR = 4;
export const TEMPO = 72;
export const SECONDS_PER_BEAT = 60 / TEMPO;

const D4 = 62;
/** D major pentatonic: D E F♯ A B. */
const PENTATONIC = [0, 2, 4, 7, 9];

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Each kind of building has its own instrument and register. */
const KIND_VOICE: Record<BuildingKind, { voice: Voice; octave: number }> = {
  food: { voice: 'marimba', octave: 0 },
  industry: { voice: 'pluck', octave: -1 },
  energy: { voice: 'bell', octave: 1 },
  storage: { voice: 'pluck', octave: 0 },
  home: { voice: 'flute', octave: 0 },
  civic: { voice: 'flute', octave: 1 },
  nature: { voice: 'chime', octave: 1 },
  water: { voice: 'chime', octave: 0 },
};

/** The note a building plays when placed: its kind's instrument, a step of the scale by its place in the content. */
export function buildingNote(content: Content, building: string): NoteEvent {
  const def = content.byId[building];
  const kind = def?.kind ?? 'civic';
  const { voice, octave } = KIND_VOICE[kind];
  const sameKind = content.buildings.filter((b) => b.kind === kind).map((b) => b.id);
  const i = Math.max(0, sameKind.indexOf(building));
  const step = PENTATONIC[i % PENTATONIC.length]! + 12 * Math.floor(i / PENTATONIC.length);
  return { at: 0, midi: D4 + 12 * octave + step, voice, length: 1.5, gain: 0.45 };
}

/** A chord for each layer of combos, all in D major, played as a quick upward strum. */
const LAYER_CHORDS: Record<ComboLayer, number[]> = {
  adjacency: [0, 4, 7, 12], // D major
  chain: [-7, -3, 0, 7], // G add9 (G B D A): loops
  formation: [0, 4, 7, 11], // D major 7: shapes
  evolution: [-3, 0, 4, 9], // B minor 7 rising into F♯: something becomes something else
};

export function comboChord(layer: ComboLayer): NoteEvent[] {
  return LAYER_CHORDS[layer].map((step, i) => ({
    at: i * 0.12,
    midi: D4 + step,
    voice: 'bell' as const,
    length: 3,
    gain: 0.32,
  }));
}

/** The discovery chime: a high, bright arpeggio. */
export function chime(): NoteEvent[] {
  return [0, 4, 7, 12, 16].map((step, i) => ({
    at: i * 0.18,
    midi: D4 + 24 + step,
    voice: 'chime' as const,
    length: 2.5,
    gain: 0.3,
  }));
}

/** A run's end: a rising cadence for a completed run, a gentle falling one otherwise. */
export function cadence(complete: boolean): NoteEvent[] {
  const steps = complete ? [7, 9, 11, 12, 16, 19] : [12, 9, 7, 4, 2, 0];
  return steps.map((step, i) => ({
    at: i * 0.35,
    midi: D4 + step,
    voice: complete ? ('bell' as const) : ('flute' as const),
    length: i === steps.length - 1 ? 4 : 1,
    gain: 0.4,
  }));
}

/** The Sun Tree: every layer's chord at once, then the chime. */
export function fanfare(): NoteEvent[] {
  return [
    ...comboChord('adjacency').map((n) => ({ ...n, at: n.at })),
    ...comboChord('formation').map((n) => ({ ...n, at: n.at + 1.5, midi: n.midi + 12 })),
    ...chime().map((n) => ({ ...n, at: n.at + 3 })),
  ];
}

/** The soundtrack's chords, one per bar: D, Bm, G, A (as offsets from D4). */
const PROGRESSION = [
  [0, 4, 7],
  [-3, 0, 4],
  [-7, -3, 0],
  [-5, -1, 2],
];

/** How many layers play at this Harmony: one more at each Harmony tier. */
export function musicLayers(content: Content, harmony: number): number {
  return Math.max(1, content.rules.harmony.tiers.filter((t) => harmony >= t.min).length);
}

export const MAX_LAYERS = 4;

/**
 * The soundtrack's notes for one bar, by layer: 0 a soft pad (always),
 * 1 a plucked arpeggio, 2 a soft, low bell melody, 3 a high flute with birdlike trills.
 * The melody is seeded by the bar, so the music varies but replays the same.
 */
export function barNotes(bar: number, layer: number, seed = 'sunroot'): NoteEvent[] {
  const chord = PROGRESSION[bar % PROGRESSION.length]!;
  const root = D4 - 12 + chord[0]!;
  switch (layer) {
    case 0:
      return [root, root + 7, D4 + chord[1]!].map((midi) => ({
        at: 0,
        midi,
        voice: 'pad' as const,
        length: BEATS_PER_BAR,
        gain: 0.16,
      }));
    case 1: {
      const tones = [...chord, chord[0]! + 12, ...chord.slice().reverse()].map((s) => D4 + s);
      return Array.from({ length: 8 }, (_, i) => ({
        at: i / 2,
        midi: tones[i % tones.length]!,
        voice: 'pluck' as const,
        length: 0.5,
        gain: i % 2 === 0 ? 0.16 : 0.1,
      }));
    }
    case 2: {
      const rng = createRng(`${seed}:melody:${bar}`);
      const notes: NoteEvent[] = [];
      for (let beat = 0; beat < BEATS_PER_BAR; beat += 2) {
        if (beat > 0 && nextFloat(rng) < 0.3) continue;
        const step = PENTATONIC[nextInt(rng, PENTATONIC.length)]!;
        // Softened after playtesting: 60% quieter and an octave lower than at first.
        notes.push({ at: beat, midi: D4 + step, voice: 'bell', length: 2, gain: 0.048 });
      }
      return notes;
    }
    case 3: {
      const rng = createRng(`${seed}:birds:${bar}`);
      if (nextFloat(rng) < 0.4) return [];
      const start = 1 + nextInt(rng, 2);
      // A trill between two neighbouring notes of the scale.
      const i = nextInt(rng, PENTATONIC.length - 1);
      const [low, high] = [D4 + 24 + PENTATONIC[i]!, D4 + 24 + PENTATONIC[i + 1]!];
      return [0, 0.25, 0.5, 1].map((t, j) => ({
        at: start + t,
        midi: j % 2 === 0 ? low : high,
        voice: 'flute' as const,
        length: j === 3 ? 1 : 0.25,
        gain: 0.07,
      }));
    }
    default:
      return [];
  }
}
