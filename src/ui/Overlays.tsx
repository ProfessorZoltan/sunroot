/** The footer, the map's forecast pill and building tooltip, keyboard help and the end-of-run screen. */
import { useEffect, useRef, useState } from 'preact/hooks';
import { waterAt } from '../game/waterInfo';
import type { AudioEngine } from '../audio/engine';
import { reachSummary } from '../game/marks';
import { logToCsv, type PlayLog } from '../game/playlog';
import type { GameStore } from '../game/store';
import type { MapView } from '../render/mapView';
import { hexKey } from '../sim';
import { Arrow, Sun, Undo, Wind } from './icons';
import { SEASON_NAMES } from './TopBar';
import { SoundButton, SoundSettings } from './Sound';

export function Footer({
  store,
  onHelp,
  onAlmanac,
  onNewRun,
  onNote,
  onCity,
  audio,
  onReport,
}: {
  store: GameStore;
  onHelp: () => void;
  onAlmanac: () => void;
  onNewRun: () => void;
  /** Looks at Root City (the run stays saved). */
  onCity?: () => void;
  audio?: AudioEngine;
  /** Opens a playtest note for this season. */
  onNote?: () => void;
  /** Opens the season report. */
  onReport?: () => void;
}) {
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
          <div class="quiet small clamp" title={event.description}>
            {event.description}
          </div>
        </div>
      </div>
      <div class="message" role="status" aria-live="polite">
        {store.message ??
          (ended
            ? ''
            : store.fastForwardTo !== null
              ? `Fast-forwarding to spring, year ${store.fastForwardTo / 4 + 1}. ${store.fastForwardWaiting ?? ''}`
              : state.visionOffer.length > 0
                ? 'Choose a vision to end the season.'
                : state.charterOffer.length > 0
                  ? 'Choose a charter to end the season.'
                  : needsPick
                    ? 'Choose a draft card to end the season.'
                    : '')}
      </div>
      <div class="actions">
        {onReport && (
          <button
            type="button"
            class="button"
            disabled={state.recentReports.length === 0}
            onClick={onReport}
            aria-label="Season report"
            title="What each resource was made and used by, season by season"
          >
            Report
          </button>
        )}
        {audio && <SoundButton engine={audio} />}
        {onCity && (
          <button type="button" class="button" onClick={onCity} aria-label="Root City">
            City
          </button>
        )}
        <button type="button" class="button" onClick={onNewRun}>
          New run
        </button>
        {onNote && (
          <button
            type="button"
            class="button"
            onClick={onNote}
            title="A playtest note for this season"
          >
            Note
          </button>
        )}
        <button type="button" class="button" onClick={onHelp} aria-keyshortcuts="?">
          Keys
        </button>
        <button type="button" class="button" onClick={onAlmanac} aria-keyshortcuts="A">
          Almanac
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
        {store.fastForwardTo !== null ? (
          <button
            type="button"
            class="button"
            onClick={() => store.stopFastForward()}
            aria-keyshortcuts="Escape"
          >
            Stop
          </button>
        ) : (
          <button
            type="button"
            class="button"
            disabled={ended}
            onClick={() => store.fastForward()}
            aria-keyshortcuts="Shift+E"
            title="End seasons until next spring, pausing for choices and stopping before a shortfall or hunger (Shift+E)"
          >
            Fast-forward
          </button>
        )}
        {store.resolution ? (
          <button
            type="button"
            class="button primary"
            onClick={() => store.finishResolution()}
            aria-keyshortcuts="Space"
          >
            Skip <Arrow />
          </button>
        ) : (
          <button
            type="button"
            class="button primary"
            disabled={
              ended || needsPick || state.charterOffer.length > 0 || state.visionOffer.length > 0
            }
            onClick={() => store.dispatch({ type: 'endSeason' })}
            aria-keyshortcuts="E"
          >
            End {SEASON_NAMES[state.season].toLowerCase()} <Arrow />
          </button>
        )}
      </div>
    </footer>
  );
}

export function ForecastPill({ store }: { store: GameStore }) {
  const { content, state } = store;
  const event = content.events[state.forecast.event];
  const reach = reachSummary(store.marks);
  return (
    <div class="pill" aria-hidden="true">
      <Sun size={16} />
      <span>
        <strong>{SEASON_NAMES[state.season]}</strong> · {event.name}: {event.summary}
        {reach ? <span class="quiet"> · {reach}</span> : null}
      </span>
    </div>
  );
}

const PHASE_TEXT = {
  event: (event: string) => event,
  day: () => 'Day: the sun crosses the valley',
  night: () => 'Night: stores and wind carry the valley',
  settle: () => 'The season settles',
} as const;

/** Shown over the map while a season plays out, with Pause and Skip. */
export function ResolutionBanner({ store }: { store: GameStore }) {
  const r = store.resolution!;
  const event = store.content.events[r.report.event];
  return (
    <div class="pill resolution" role="status" aria-label="The season is resolving">
      <Sun size={16} />
      <span>
        <strong>{SEASON_NAMES[r.report.season]}</strong> · {PHASE_TEXT[r.phase](event.name)}
        {r.paused ? ' (paused)' : ''}
      </span>
      <button
        type="button"
        class="button small-button"
        onClick={() => store.togglePause()}
        aria-keyshortcuts="P"
      >
        {r.paused ? 'Resume' : 'Pause'}
      </button>
      <button
        type="button"
        class="button small-button"
        onClick={() => store.finishResolution()}
        aria-keyshortcuts="Space"
      >
        Skip
      </button>
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
  // Water as this season stands (when the run has water); its lines replace the math's.
  const water = waterAt(store.rules, state, store.waterForecast, store.hover);
  const math = (b ? (store.insight.now.math[b.uid] ?? []) : []).filter(
    (l) => water.length === 0 || !l.startsWith('water:'),
  );
  const marks = store.marks.filter((m) => hexKey(m.at) === hexKey(store.hover!));
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
      {marks.map((m) => (
        <div class={`small mark-line${m.coming ? ' coming' : ''}`}>{m.text}</div>
      ))}
      {water.map((l) => (
        <div class="small water-line">{l}</div>
      ))}
      {math.slice(0, 6).map((l) => (
        <div class="small">{l}</div>
      ))}
    </div>
  );
}

export function Help({
  onClose,
  log,
  audio,
}: {
  onClose: () => void;
  log?: PlayLog;
  audio?: AudioEngine;
}) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const keys: [string, string][] = [
    ['1 – 4', 'Pick a draft card (or a vision or charter, when one is offered)'],
    ['A', 'Open the Almanac'],
    ['R / X', 'Reroll the draft / buy a 4th card (knowledge)'],
    ['Letters on the palette', 'Pick a building to place'],
    ['K', 'Spread compost'],
    ['Arrow keys', 'Aim at a tile while placing (pan the map otherwise)'],
    ['N / Shift+N', 'Next / previous legal site'],
    ['Enter', 'Place at the aimed tile'],
    ['Esc', 'Stop placing, close panels'],
    ['Z or Ctrl+Z', 'Undo (free until the season ends)'],
    ['Delete', 'Demolish the building in the inspector'],
    ['E', 'End the season'],
    ['Shift+E', 'Fast-forward to next spring (pauses for choices; Esc stops)'],
    ['Space / Esc', 'Skip the season playing out'],
    ['P', 'Pause or resume the season playing out'],
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
        {audio && <SoundSettings engine={audio} />}
        {log && <LogTools log={log} />}
        <button type="button" class="button" ref={close} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

/** The playtest log: how many seasons it holds, a CSV download, and a reset. */
function LogTools({ log }: { log: PlayLog }) {
  const [rows, setRows] = useState(log.rows.length);
  const download = () => {
    const blob = new Blob([logToCsv(log.rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sunroot-playtest-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div class="log-tools small">
      <strong>Playtest log:</strong> {rows} season{rows === 1 ? '' : 's'} recorded, with time spent,
      undos, cards and your notes (the Note button).
      <div class="row">
        <button type="button" class="button small-button" disabled={rows === 0} onClick={download}>
          Download CSV
        </button>
        <button
          type="button"
          class="button small-button"
          disabled={rows === 0}
          onClick={() => {
            log.clear();
            setRows(0);
          }}
        >
          Clear log
        </button>
      </div>
    </div>
  );
}
