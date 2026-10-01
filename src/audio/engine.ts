/**
 * The sound engine (Milestone 9): Web Audio, every sound synthesized in code
 * (there are no recorded files, as there is no drawn art). It plays the cue
 * events music.ts describes and loops the soundtrack, with one gain per
 * layer so layers fade in and out as Harmony changes.
 *
 * Browsers start audio only after a click or key press, so the engine waits
 * for `unlock()`. Without Web Audio it does nothing. Settings (on or off and
 * the two volumes) are kept in localStorage.
 */
import {
  barNotes,
  BEATS_PER_BAR,
  MAX_LAYERS,
  midiToHz,
  SECONDS_PER_BEAT,
  type NoteEvent,
  type Voice,
} from './music';

export interface AudioSettings {
  on: boolean;
  /** 0 to 1. */
  music: number;
  effects: number;
}

export const DEFAULT_SETTINGS: AudioSettings = { on: true, music: 0.5, effects: 0.7 };

/** What was played, newest last (for the browser tests and debugging). */
export interface AudioLogEntry {
  cue: string;
  notes: number;
  at: number;
}

const KEY = 'sunroot:audio';
const LOOKAHEAD = 0.4;
const FADE = 2.5;

export function loadAudioSettings(storage: Storage | null): AudioSettings {
  try {
    const data = JSON.parse(storage?.getItem(KEY) ?? 'null') as Partial<AudioSettings> | null;
    return { ...DEFAULT_SETTINGS, ...(data ?? {}) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class AudioEngine {
  settings: AudioSettings;
  readonly log: AudioLogEntry[] = [];
  /** Bars of the soundtrack scheduled so far. */
  bars = 0;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private effectsBus: GainNode | null = null;
  private layerGains: GainNode[] = [];
  private layers = 1;
  private nextBar = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<() => void>();

  constructor(private readonly storage: Storage | null = null) {
    this.settings = loadAudioSettings(storage);
  }

  get unlocked(): boolean {
    return this.ctx !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Starts audio on the first click or key press (browsers require one). */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume().catch(() => undefined);
      return;
    }
    const Ctx =
      typeof window !== 'undefined'
        ? (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
        : undefined;
    if (!Ctx) return;
    try {
      this.ctx = new Ctx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    // A gentle limiter, so chords at full volume never clip.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    this.master.connect(limiter).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.effectsBus = ctx.createGain();
    this.effectsBus.connect(this.master);
    // A soft room: a short feedback delay, filtered, under everything.
    const delay = ctx.createDelay(1);
    delay.delayTime.value = SECONDS_PER_BEAT * 0.75;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.28;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2200;
    const wet = ctx.createGain();
    wet.gain.value = 0.22;
    for (const bus of [this.musicBus, this.effectsBus]) bus.connect(delay);
    delay.connect(tone).connect(feedback).connect(delay);
    tone.connect(wet).connect(this.master);
    this.layerGains = Array.from({ length: MAX_LAYERS }, (_, i) => {
      const g = ctx.createGain();
      g.gain.value = i < this.layers ? 1 : 0;
      g.connect(this.musicBus!);
      return g;
    });
    this.applySettings();
    this.nextBar = ctx.currentTime + 0.2;
    this.timer = setInterval(() => this.schedule(), 100);
    this.emit();
  }

  /** The soundtrack's layers: one per Harmony tier reached, fading over a few seconds. */
  setLayers(n: number): void {
    const layers = Math.max(1, Math.min(MAX_LAYERS, n));
    if (layers === this.layers) return;
    this.layers = layers;
    const ctx = this.ctx;
    if (!ctx) return;
    this.layerGains.forEach((g, i) => {
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(i < layers ? 1 : 0, ctx.currentTime + FADE);
    });
  }

  get currentLayers(): number {
    return this.layers;
  }

  update(settings: Partial<AudioSettings>): void {
    this.settings = { ...this.settings, ...settings };
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.settings));
    } catch {
      // Storage blocked: the settings last for this visit.
    }
    this.applySettings();
    this.emit();
  }

  /** Plays a cue now: a building's note, a combo's chord, a chime. */
  play(cue: string, notes: NoteEvent[]): void {
    this.log.push({ cue, notes: notes.length, at: this.ctx?.currentTime ?? 0 });
    if (this.log.length > 100) this.log.shift();
    const ctx = this.ctx;
    if (!ctx || !this.settings.on || !this.effectsBus) return;
    const start = ctx.currentTime + 0.02;
    for (const n of notes) this.voice(n, start + n.at * SECONDS_PER_BEAT, this.effectsBus);
  }

  private applySettings(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(this.settings.on ? 1 : 0, t, 0.05);
    this.musicBus!.gain.setTargetAtTime(this.settings.music * 0.8, t, 0.1);
    this.effectsBus!.gain.setTargetAtTime(this.settings.effects, t, 0.05);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const barLength = BEATS_PER_BAR * SECONDS_PER_BEAT;
    // After a long pause (a hidden tab) start again from now rather than catch up.
    if (this.nextBar < ctx.currentTime - barLength) this.nextBar = ctx.currentTime + 0.1;
    while (this.nextBar < ctx.currentTime + LOOKAHEAD) {
      if (this.settings.on && this.settings.music > 0) {
        for (let layer = 0; layer < MAX_LAYERS; layer++) {
          // Only the layers playing, or fading out, need notes.
          if (layer >= this.layers && this.layerGains[layer]!.gain.value < 0.01) continue;
          for (const n of barNotes(this.bars, layer)) {
            this.voice(n, this.nextBar + n.at * SECONDS_PER_BEAT, this.layerGains[layer]!);
          }
        }
      }
      this.bars += 1;
      this.nextBar += barLength;
    }
  }

  /** Synthesizes one note: each voice is a few oscillators and an envelope. */
  private voice(n: NoteEvent, when: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const hz = midiToHz(n.midi);
    const length = n.length * SECONDS_PER_BEAT;
    const env = ctx.createGain();
    env.connect(out);
    const g = env.gain;
    const osc = (type: OscillatorType, freq: number, level: number, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const lv = ctx.createGain();
      lv.gain.value = level;
      o.connect(lv).connect(env);
      o.start(when);
      o.stop(when + length + 1.5);
      return o;
    };
    const pluck = (attack: number, decay: number) => {
      g.setValueAtTime(0, when);
      g.linearRampToValueAtTime(n.gain, when + attack);
      g.exponentialRampToValueAtTime(0.0008, when + attack + decay);
    };
    switch (n.voice as Voice) {
      case 'marimba':
        osc('sine', hz, 1);
        osc('sine', hz * 4, 0.12);
        pluck(0.005, Math.min(1.2, length));
        break;
      case 'bell':
        osc('sine', hz, 1);
        osc('sine', hz * 2.76, 0.25);
        osc('sine', hz * 5.4, 0.08);
        pluck(0.004, Math.max(1.2, length));
        break;
      case 'pluck': {
        const o = osc('triangle', hz, 1);
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.setValueAtTime(hz * 6, when);
        f.frequency.exponentialRampToValueAtTime(hz * 1.5, when + 0.3);
        o.disconnect();
        o.connect(f).connect(env);
        pluck(0.004, Math.min(0.9, length + 0.3));
        break;
      }
      case 'flute': {
        const tone = osc('sine', hz, 1);
        osc('triangle', hz * 2, 0.06);
        // A gentle vibrato.
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 5;
        const depth = ctx.createGain();
        depth.gain.value = hz * 0.006;
        lfo.connect(depth).connect(tone.frequency);
        lfo.start(when);
        lfo.stop(when + length + 0.5);
        g.setValueAtTime(0, when);
        g.linearRampToValueAtTime(n.gain, when + 0.06);
        g.setValueAtTime(n.gain, when + Math.max(0.06, length - 0.1));
        g.exponentialRampToValueAtTime(0.0008, when + length + 0.4);
        break;
      }
      case 'chime':
        osc('sine', hz, 1);
        osc('sine', hz * 3.01, 0.2);
        pluck(0.002, Math.max(1.5, length));
        break;
      case 'pad':
        osc('triangle', hz, 0.6, -6);
        osc('sine', hz, 0.6, 6);
        g.setValueAtTime(0, when);
        g.linearRampToValueAtTime(n.gain, when + length * 0.4);
        g.linearRampToValueAtTime(0, when + length + 0.6);
        break;
    }
  }

  /** Pauses everything (a hidden tab); `unlock()` resumes. */
  pause(): void {
    void this.ctx?.suspend().catch(() => undefined);
  }

  /** Stops scheduling and closes the audio context. */
  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private emit(): void {
    for (const l of this.listeners) l();
  }
}
