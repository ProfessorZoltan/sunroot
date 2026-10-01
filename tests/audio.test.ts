/** Milestone 9: what plays when. The music is data, so it is tested without a sound card. */
import { describe, expect, it } from 'vitest';
import { commandCues, revealCue } from '../src/audio/director';
import { AudioEngine, loadAudioSettings } from '../src/audio/engine';
import {
  barNotes,
  buildingNote,
  comboChord,
  MAX_LAYERS,
  midiToHz,
  musicLayers,
} from '../src/audio/music';
import { COMBO_LAYERS } from '../src/sim';
import { act, content, endSeason, place, scenario } from './helpers';

const LAND = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ , , , ^ ^',
  '^ , C , ~ , , , , ^',
  ' ^ , , , ~ , , , , ^',
];
const FLOOD = [
  '^ ^ ^ , ~ , , , ^ ^',
  ' ^ ^ , , ~ f f f ^ ^',
  '^ , C , ~ f f f , ^',
  ' ^ , , , ~ f f f , ^',
];
/** D major: D E F♯ G A B C♯. */
const D_MAJOR = new Set([2, 4, 6, 7, 9, 11, 1]);
const inKey = (midi: number) => D_MAJOR.has(((midi % 12) + 12) % 12);

describe('building notes', () => {
  it('every building plays a note in key, voiced by its kind', () => {
    for (const b of content.buildings) {
      const n = buildingNote(content, b.id);
      expect(inKey(n.midi), b.id).toBe(true);
    }
    expect(buildingNote(content, 'solarCanopy').voice).toBe('bell');
    expect(buildingNote(content, 'floodplainFarm').voice).toBe('marimba');
    expect(buildingNote(content, 'cottage').voice).toBe('flute');
  });

  it('buildings of the same kind play different notes', () => {
    const food = content.buildings.filter((b) => b.kind === 'food').map((b) => b.id);
    const notes = food.map((id) => buildingNote(content, id).midi);
    expect(new Set(notes).size).toBe(food.length);
  });

  it('notes are tuned to A 440', () => {
    expect(midiToHz(69)).toBe(440);
    expect(midiToHz(81)).toBe(880);
  });
});

describe('combo chords and the soundtrack', () => {
  it('each layer of combos has its own chord, in key', () => {
    const chords = COMBO_LAYERS.map((l) =>
      comboChord(l)
        .map((n) => n.midi)
        .join(','),
    );
    expect(new Set(chords).size).toBe(COMBO_LAYERS.length);
    for (const l of COMBO_LAYERS) for (const n of comboChord(l)) expect(inKey(n.midi)).toBe(true);
  });

  it('adds a layer at each Harmony tier: 1 below 20, 2 from 20, 3 from 40, 4 from 70', () => {
    expect([0, 19, 20, 39, 40, 69, 70, 120].map((h) => musicLayers(content, h))).toEqual([
      1, 1, 2, 2, 3, 3, 4, 4,
    ]);
  });

  it('every layer plays in key, and the same bar always plays the same', () => {
    for (let layer = 0; layer < MAX_LAYERS; layer++) {
      for (let bar = 0; bar < 16; bar++) {
        for (const n of barNotes(bar, layer)) expect(inKey(n.midi)).toBe(true);
        expect(barNotes(bar, layer)).toEqual(barNotes(bar, layer));
      }
    }
    expect(barNotes(0, 0).length).toBeGreaterThan(0);
    expect(barNotes(0, 1)).toHaveLength(8);
  });
});

describe('cues', () => {
  it('placing a building plays its note; a visible combo adds its chord', () => {
    const s = scenario(LAND);
    const placed = place(s, 'cottage', 5, 2);
    const cmd = { type: 'place' as const, building: 'cottage', at: { q: 0, r: 0 } };
    expect(commandCues(content, cmd, s, placed).map((c) => c.cue)).toEqual(['place:cottage']);
    const withCombo = commandCues(content, cmd, s, placed, ['greenDoorstep']);
    expect(withCombo.map((c) => c.cue)).toEqual(['place:cottage', 'combo:adjacency']);
    // The chord comes after the note.
    expect(withCombo[1]!.notes[0]!.at).toBeGreaterThan(0);
  });

  it('picking a blueprint plays its note softly; a tuning plays nothing', () => {
    const s = scenario(LAND);
    const cue = commandCues(content, { type: 'pickCard', card: 'orchard' }, s, s)[0]!;
    expect(cue.notes[0]!.gain).toBeLessThan(buildingNote(content, 'orchard').gain);
    expect(commandCues(content, { type: 'pickCard', card: 'deepRoots' }, s, s)).toEqual([]);
  });

  it("a run's end plays a cadence: rising when complete", () => {
    const last = scenario(LAND, { year: 12, season: 'winter', stores: { food: 100 } });
    const done = endSeason(last);
    const cues = commandCues(content, { type: 'endSeason' }, last, done);
    expect(cues.map((c) => c.cue)).toContain('end:complete');
  });

  it('a closed loop plays the chain chord when the season ends, once', () => {
    // The Kitchen Loop, as in the combo tests: a farm and a composter on floodplain.
    let s = scenario(FLOOD, { season: 'summer', stores: { scraps: 3 } });
    s = place(s, 'floodplainFarm', 5, 3);
    s = place(s, 'composter', 6, 3);
    const closed = endSeason(s);
    expect(closed.loops).toHaveLength(1);
    const cue = (a: typeof s, b: typeof s) =>
      commandCues(content, { type: 'endSeason' }, a, b).map((c) => c.cue);
    expect(cue(s, closed)).toContain('combo:chain');
    expect(cue(closed, endSeason(closed))).not.toContain('combo:chain');
  });

  it('a discovery card plays the chime and its chord; other cards the chime', () => {
    const d = revealCue(content, { kind: 'combo', id: 'villageGreen' });
    expect(d.cue).toBe('discovery:villageGreen');
    expect(d.notes.length).toBeGreaterThan(comboChord('formation').length);
    expect(revealCue(content, { kind: 'era', era: 2 }).cue).toBe('era');
  });

  it('commands that fail or change nothing audible play nothing', () => {
    const s = act(scenario(LAND), { type: 'setPriority', order: ['b0'] });
    expect(commandCues(content, { type: 'setPriority', order: ['b0'] }, s, s)).toEqual([]);
  });
});

describe('the engine without Web Audio', () => {
  it('keeps settings and logs cues, silently', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    } as unknown as Storage;
    const engine = new AudioEngine(storage);
    engine.unlock(); // no AudioContext in Node: nothing happens
    expect(engine.unlocked).toBe(false);
    engine.update({ on: false, music: 0.2 });
    expect(loadAudioSettings(storage)).toEqual({ on: false, music: 0.2, effects: 0.7 });
    engine.play('place:cottage', [buildingNote(content, 'cottage')]);
    expect(engine.log.map((e) => e.cue)).toEqual(['place:cottage']);
    engine.setLayers(9);
    expect(engine.currentLayers).toBe(MAX_LAYERS);
  });
});
