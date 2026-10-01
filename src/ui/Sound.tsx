/** Sound controls (Milestone 9): on or off, and the music and effects volumes. */
import { useEffect, useReducer } from 'preact/hooks';
import type { AudioEngine } from '../audio/engine';

function useEngine(engine: AudioEngine) {
  const [, rerender] = useReducer((n: number, _: undefined) => n + 1, 0);
  useEffect(() => engine.subscribe(() => rerender(undefined)), [engine]);
}

export function SoundButton({ engine }: { engine: AudioEngine }) {
  useEngine(engine);
  const on = engine.settings.on;
  return (
    <button
      type="button"
      class="button"
      aria-pressed={on}
      title={on ? 'Sound is on' : 'Sound is off'}
      onClick={() => {
        engine.unlock();
        engine.update({ on: !on });
      }}
    >
      {on ? 'Sound on' : 'Sound off'}
    </button>
  );
}

export function SoundSettings({ engine }: { engine: AudioEngine }) {
  useEngine(engine);
  const slider = (key: 'music' | 'effects', label: string) => (
    <label class="sound-slider">
      <span>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(engine.settings[key] * 100)}
        aria-label={`${label} volume`}
        onInput={(e) => {
          engine.unlock();
          engine.update({ [key]: Number((e.target as HTMLInputElement).value) / 100 });
        }}
      />
      <span class="quiet small">{Math.round(engine.settings[key] * 100)}%</span>
    </label>
  );
  return (
    <section class="sound-settings" aria-label="Sound">
      <h3>Sound</h3>
      <label class="sound-slider">
        <input
          type="checkbox"
          checked={engine.settings.on}
          onChange={(e) => {
            engine.unlock();
            engine.update({ on: (e.target as HTMLInputElement).checked });
          }}
        />
        <span>Sound on</span>
      </label>
      {slider('music', 'Music')}
      {slider('effects', 'Effects')}
      <p class="quiet small">
        The music gains an instrument at each Harmony tier. Buildings play a note when placed, and
        combos a chord.
      </p>
    </section>
  );
}
