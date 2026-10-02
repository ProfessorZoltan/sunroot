/**
 * The in-run controls that sit over the map (asked for in playtesting: more
 * room for the map, less on screen at once). The forecast is a banner along
 * the top; End season, Undo and Fast-forward stay at hand in the dock, and
 * everything else is in the menu; the run's goals and history open from the
 * Overview.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { AudioEngine } from '../audio/engine';
import { reachSummary } from '../game/marks';
import type { GameStore } from '../game/store';
import { LoopsPanel } from './Combos';
import { WildlifeStatus } from './Festivals';
import { Arrow, Undo, Wind } from './icons';
import { LastSeason, CivicStatus } from './LeftPanel';
import { EraGoalStatus, ExpeditionStatus, VisionStatus } from './RunUi';
import { SEASON_NAMES } from './TopBar';

/** This season's event and the next, along the top of the map. */
export function ForecastBanner({ store }: { store: GameStore }) {
  const { content, state } = store;
  const event = content.events[state.forecast.event];
  const next = content.events[state.forecast.next];
  const reach = reachSummary(store.marks);
  return (
    <div class="forecast-banner" role="note" aria-label="Forecast" title={event.description}>
      <Wind size={18} />
      <span class="forecast-text">
        <strong>
          {SEASON_NAMES[state.season]} ends with: {event.name.toLowerCase()}
        </strong>{' '}
        · {event.summary}
        {reach ? <span class="quiet"> · {reach}</span> : null}
        <span class="quiet"> · then {next.name.toLowerCase()}</span>
      </span>
    </div>
  );
}

/** Why the season can't end yet, if it can't. */
export function blockingMessage(store: GameStore): string {
  const { state } = store;
  if (store.message) return store.message;
  if (state.status !== 'active') return '';
  if (store.fastForwardTo !== null)
    return `Fast-forwarding to spring, year ${store.fastForwardTo / 4 + 1}. ${store.fastForwardWaiting ?? ''}`;
  if (state.visionOffer.length > 0) return 'Choose a vision to end the season.';
  if (state.evolutionOffer.length > 0) return 'Choose what the building becomes to end the season.';
  if (state.charterOffer.length > 0) return 'Choose a charter to end the season.';
  if (state.draft.offer.length > 0 && !state.draft.picked)
    return 'Choose a draft card to end the season.';
  return '';
}

export interface MenuActions {
  onReport: () => void;
  onOverview: () => void;
  onPriorities: () => void;
  onAlmanac: () => void;
  onHelp: () => void;
  onNewRun: () => void;
  onNote?: () => void;
  onCity?: () => void;
  audio?: AudioEngine;
}

/** The dock at the foot of the map: the menu, Undo, Fast-forward and End season. */
export function ActionDock({ store, menu }: { store: GameStore; menu: MenuActions }) {
  const { state } = store;
  const ended = state.status !== 'active';
  const message = blockingMessage(store);
  const blocked =
    ended ||
    (state.draft.offer.length > 0 && !state.draft.picked) ||
    state.charterOffer.length > 0 ||
    state.visionOffer.length > 0 ||
    state.evolutionOffer.length > 0;
  return (
    <div class="dock" role="group" aria-label="Season controls">
      {message && (
        <div class="dock-message" role="status" aria-live="polite">
          {message}
        </div>
      )}
      <div class="dock-buttons">
        <GameMenu store={store} {...menu} />
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
            disabled={blocked}
            onClick={() => store.dispatch({ type: 'endSeason' })}
            aria-keyshortcuts="E"
          >
            End {SEASON_NAMES[state.season].toLowerCase()} <Arrow />
          </button>
        )}
      </div>
    </div>
  );
}

/** Whether the page is in fullscreen. */
function useFullscreen(): [boolean, () => void] {
  const [on, setOn] = useState(typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const update = () => setOn(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen?.().catch(() => undefined);
  };
  return [on, toggle];
}

/** The menu: everything that isn't needed every season. */
function GameMenu({
  store,
  onReport,
  onOverview,
  onPriorities,
  onAlmanac,
  onHelp,
  onNewRun,
  onNote,
  onCity,
  audio,
}: { store: GameStore } & MenuActions) {
  const [open, setOpen] = useState(false);
  const [fullscreen, toggleFullscreen] = useFullscreen();
  const [soundOn, setSoundOn] = useState(audio?.settings.on ?? false);
  const root = useRef<HTMLDivElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('.menu-item:not(:disabled)')?.focus();
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [open]);
  const item = (label: string, act: () => void, extra: Record<string, unknown> = {}) => (
    <button
      type="button"
      role="menuitem"
      class="menu-item"
      onClick={() => {
        setOpen(false);
        act();
      }}
      {...extra}
    >
      {label}
    </button>
  );
  return (
    <div
      class="menu-root"
      ref={root}
      onKeyDown={(e) => {
        if (open && e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <button
        type="button"
        class="button"
        ref={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        ☰ Menu
      </button>
      {open && (
        <div class="menu" role="menu" aria-label="Menu">
          <button
            type="button"
            role="menuitem"
            class="menu-item"
            disabled={store.state.recentReports.length === 0}
            onClick={() => {
              setOpen(false);
              onReport();
            }}
          >
            Season report
          </button>
          {item('Run overview', onOverview)}
          {item('Prioritize buildings', onPriorities)}
          {item('Almanac', onAlmanac, { 'aria-keyshortcuts': 'A' })}
          {onNote && item('Playtest note', onNote)}
          {item('Keys, sound and playtest log', onHelp, { 'aria-keyshortcuts': '?' })}
          {audio &&
            item(soundOn ? 'Sound off' : 'Sound on', () => {
              audio.unlock();
              audio.update({ on: !soundOn });
              setSoundOn(!soundOn);
            })}
          {item(fullscreen ? 'Leave fullscreen' : 'Fullscreen', toggleFullscreen)}
          {onCity && item('Root City', onCity)}
          {item('New run', onNewRun)}
        </div>
      )}
    </div>
  );
}

/** The run's goals and history, out of the way until asked for. */
export function RunOverview({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal overview"
        role="dialog"
        aria-modal="true"
        aria-label="Run overview"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div class="panel-head">
          <h2>Run overview</h2>
          <button type="button" class="button small-button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
        <div class="overview-grid">
          <VisionStatus store={store} />
          <EraGoalStatus store={store} />
          <ExpeditionStatus store={store} />
          <CivicStatus store={store} />
          <LastSeason store={store} />
          <LoopsPanel store={store} />
          <WildlifeStatus store={store} />
        </div>
      </div>
    </div>
  );
}
