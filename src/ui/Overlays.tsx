/** The footer, the map's forecast pill and building tooltip, keyboard help and the end-of-run screen. */
import { useEffect, useRef } from 'preact/hooks';
import type { GameStore } from '../game/store';
import type { MapView } from '../render/mapView';
import { hexKey, provisionalScore } from '../sim';
import { Arrow, Sun, Undo, Wind } from './icons';
import { SEASON_NAMES } from './TopBar';

export function Footer({ store, onHelp }: { store: GameStore; onHelp: () => void }) {
  const { content, state } = store;
  const event = content.events[state.forecast.event];
  const next = content.events[state.forecast.next];
  const ended = state.status !== 'active';
  const needsPick = state.draft.offer.length > 0 && !state.draft.picked;
  return (
    <footer class="bottom">
      <div class="forecast">
        <Wind size={26} />
        <div>
          <div class="strong">
            This season ends with: {event.name.toLowerCase()} · then {next.name.toLowerCase()}
          </div>
          <div class="quiet small">{event.description}</div>
        </div>
      </div>
      <div class="message" role="status" aria-live="polite">
        {store.message ?? (needsPick && !ended ? 'Choose a draft card to end the season.' : '')}
      </div>
      <div class="actions">
        <button type="button" class="button" onClick={onHelp} aria-keyshortcuts="?">
          Keys
        </button>
        <button
          type="button"
          class="button"
          disabled={!store.canUndo}
          onClick={() => store.dispatch({ type: 'undo' })}
          aria-keyshortcuts="Z"
        >
          <Undo size={16} /> Undo
        </button>
        <button
          type="button"
          class="button primary"
          disabled={ended || needsPick}
          onClick={() => store.dispatch({ type: 'endSeason' })}
          aria-keyshortcuts="E"
        >
          End {SEASON_NAMES[state.season].toLowerCase()} <Arrow />
        </button>
      </div>
    </footer>
  );
}

export function ForecastPill({ store }: { store: GameStore }) {
  const { content, state } = store;
  const event = content.events[state.forecast.event];
  return (
    <div class="pill" aria-hidden="true">
      <Sun size={16} />
      <span>
        <strong>{SEASON_NAMES[state.season]}</strong> · {event.name}: {event.summary}
      </span>
    </div>
  );
}

/** A small tooltip over the hovered building, with this season's math. */
export function MapTip({ store, view }: { store: GameStore; view: MapView | null }) {
  const { content, state } = store;
  if (!view || store.tool || !store.hover) return null;
  const b = Object.values(state.buildings).find((x) => hexKey(x.at) === hexKey(store.hover!));
  const tile = state.map.tiles[hexKey(store.hover)];
  if (!tile) return null;
  const at = view.screenOf(store.hover);
  const math = b ? (store.insight.now.math[b.uid] ?? []) : [];
  const title = b
    ? content.byId[b.type]!.name
    : tile.type.charAt(0).toUpperCase() + tile.type.slice(1);
  return (
    <div
      class="map-tip"
      style={{ left: `${at.x + 26}px`, top: `${at.y - 20}px` }}
      aria-hidden="true"
    >
      <div class="strong">{title}</div>
      {b && <div class="quiet small">on {tile.type} · click for details</div>}
      {tile.salvage !== undefined && <div class="small">{tile.salvage} salvage left</div>}
      {math.slice(0, 6).map((l) => (
        <div class="small">{l}</div>
      ))}
    </div>
  );
}

export function Help({ onClose }: { onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const keys: [string, string][] = [
    ['1 – 4', 'Pick a draft card'],
    ['R / X', 'Reroll the draft / buy a 4th card (knowledge)'],
    ['Letters on the palette', 'Pick a building to place'],
    ['K', 'Spread compost'],
    ['Arrow keys', 'Aim at a tile while placing (pan the map otherwise)'],
    ['N / Shift+N', 'Next / previous legal site'],
    ['Enter', 'Place at the aimed tile'],
    ['Esc', 'Stop placing, close panels'],
    ['Z or Ctrl+Z', 'Undo (free until the season ends)'],
    ['E', 'End the season'],
    ['+ / − / 0', 'Zoom in / out / fit the valley'],
    ['Tab', 'Move between buttons; tooltips show on focus'],
  ];
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Keyboard</h2>
        <table class="keys">
          {keys.map(([k, v]) => (
            <tr>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </table>
        <button type="button" class="button" ref={close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

export function EndScreen({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const { content, state } = store;
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => first.current?.focus(), []);
  const score = provisionalScore(content, state);
  const complete = state.status === 'complete';
  const newRun = () => {
    const url = new URL(location.href);
    url.searchParams.delete('seed');
    location.href = url.toString();
  };
  return (
    <div class="modal-backdrop">
      <div class="modal glass" role="dialog" aria-modal="true" aria-label="The run has ended">
        <span class="card-kind">{complete ? 'Sprout complete' : 'Sprout ended'}</span>
        <h2 class="glass-title">
          {complete ? 'The valley is breathing again' : 'The settlement has scattered'}
        </h2>
        <p>
          {complete
            ? `Twelve years in ${content.name}: ${state.citizens} citizens, Harmony ${state.harmony}.`
            : `Wellbeing reached 0 in year ${state.year}. Every run still teaches the valley something.`}
        </p>
        <table class="keys">
          {score.lines.map((l) => (
            <tr>
              <th>{l.reason}</th>
              <td>{l.points}</td>
            </tr>
          ))}
          <tr class="total">
            <th>Score (provisional)</th>
            <td>{score.total}</td>
          </tr>
        </table>
        <div class="row">
          <button type="button" class="button primary" ref={first} onClick={newRun}>
            Start a new run
          </button>
          <button type="button" class="button" onClick={onClose}>
            Look at the valley
          </button>
        </div>
      </div>
    </div>
  );
}
