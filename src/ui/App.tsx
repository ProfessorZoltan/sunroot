/**
 * The interface (Milestone 4), laid out like the Willow Reach mockup: the year
 * strip and stats on top, stores on the left, the map in the middle, the draft
 * and palette on the right, the forecast, undo and End season at the bottom.
 * Everything works with the keyboard as well as the mouse.
 */
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { GameStore } from '../game/store';
import type { MapView } from '../render/mapView';
import { paletteHotkeys, GLOBAL_KEYS } from './hotkeys';
import { AlmanacModal, RevealCard } from './Combos';
import { LeftPanel } from './LeftPanel';
import { Footer, ForecastPill, Help, MapTip, ResolutionBanner } from './Overlays';
import { EndScreen, NewRunDialog, NoteDialog } from './RunUi';
import type { PlayLog } from '../game/playlog';
import type { AudioEngine } from '../audio/engine';
import { RightPanel, paletteOrder, type Ui } from './RightPanel';
import { TipProvider } from './tips';
import { TopBar } from './TopBar';

export function App({
  store,
  view,
  icons,
  newRun,
  viewCity,
  log,
  audio,
}: {
  store: GameStore;
  view: () => MapView | null;
  icons: () => Record<string, string>;
  /** Abandons this run (and its save), or after a run ends: on to Root City or the next run. */
  newRun: () => void;
  /** Looks at Root City; the run stays saved. */
  viewCity?: () => void;
  /** The playtest log, for notes and the CSV download. */
  log?: PlayLog;
  /** Sound (Milestone 9): its controls in the footer and the keys panel. */
  audio?: AudioEngine;
}) {
  const [, rerender] = useReducer((n: number, _: undefined) => n + 1, 0);
  const [help, setHelpState] = useState(false);
  // Keys read the ref: a key can arrive before the handler from the last render is replaced.
  const helpOpen = useRef(false);
  const setHelp = (open: boolean) => {
    helpOpen.current = open;
    setHelpState(open);
  };
  const [almanac, setAlmanacState] = useState(false);
  const almanacOpen = useRef(false);
  const setAlmanac = (open: boolean) => {
    almanacOpen.current = open;
    setAlmanacState(open);
  };
  const [endSeen, setEndSeen] = useState(false);
  const [askNewRun, setAskNewRun] = useState(false);
  const [noting, setNotingState] = useState(false);
  const notingOpen = useRef(false);
  const setNoting = (open: boolean) => {
    notingOpen.current = open;
    setNotingState(open);
  };
  useEffect(() => store.subscribe(() => rerender(undefined)), [store]);

  const { content, state } = store;
  const order = paletteOrder(content, state.unlocked);
  const hotkeys = paletteHotkeys(order.map((id) => ({ id, name: content.byId[id]!.name })));
  const ui: Ui = { icons: icons(), hotkeys };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return;
      const map = view();
      const key = e.key;
      const lower = key.toLowerCase();
      const onButton = target?.tagName === 'BUTTON';
      const handled = () => e.preventDefault();

      if ((e.ctrlKey || e.metaKey) && lower === 'z')
        return (handled(), void store.dispatch({ type: 'undo' }));
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (notingOpen.current) return; // typing a note
      const help = helpOpen.current;
      if (key === '?') return (handled(), setHelp(!help));
      if (store.resolution && !help) {
        // Space, Esc or E skip the season's resolution; P pauses it.
        if (key === ' ' || key === 'Escape' || lower === GLOBAL_KEYS.endSeason) {
          handled();
          return store.finishResolution();
        }
        if (lower === 'p') return (handled(), store.togglePause());
      }
      // A discovery card waits for Continue (Enter or Space on its button, or Esc).
      const revealing = store.reveals.length > 0 && !store.resolution;
      if (revealing && !help) {
        if (key === 'Escape') return (handled(), store.dismissReveal());
        return;
      }
      if (almanacOpen.current && !help) {
        if (key === 'Escape' || lower === GLOBAL_KEYS.almanac)
          return (handled(), setAlmanac(false));
        return;
      }
      if (key === 'Escape') {
        if (help) return setHelp(false);
        if (store.tool) return store.setTool(null);
        return store.inspect(null);
      }
      if (help) return;
      if (lower === GLOBAL_KEYS.almanac) return (handled(), setAlmanac(true));
      if (/^[1-4]$/.test(key)) {
        const { draft, charterOffer, visionOffer } = store.state;
        const vision = visionOffer[Number(key) - 1];
        if (visionOffer.length > 0) {
          if (vision) store.dispatch({ type: 'pickVision', vision });
          return handled();
        }
        const charter = charterOffer[Number(key) - 1];
        if (charterOffer.length > 0) {
          if (charter) store.dispatch({ type: 'pickCharter', charter });
          return handled();
        }
        const card = draft.offer[Number(key) - 1];
        if (card && !draft.picked) store.dispatch({ type: 'pickCard', card });
        return handled();
      }
      if (key === 'Enter' && store.tool && !onButton) return (handled(), store.confirm());
      if (key.startsWith('Arrow')) {
        handled();
        const dx = key === 'ArrowLeft' ? -1 : key === 'ArrowRight' ? 1 : 0;
        const dy = key === 'ArrowUp' ? -1 : key === 'ArrowDown' ? 1 : 0;
        if (store.tool) {
          store.moveCursor(dx, dy);
          if (store.hover) map?.ensureVisible(store.hover);
        } else {
          map?.pan(-dx * 60, -dy * 60);
        }
        return;
      }
      if (key === '+' || key === '=') return map?.zoomBy(1.2);
      if (key === '-') return map?.zoomBy(1 / 1.2);
      if (key === '0') return map?.fit();
      if (lower === GLOBAL_KEYS.nextSite) {
        store.nextSite(e.shiftKey ? -1 : 1);
        if (store.hover) map?.ensureVisible(store.hover);
        return handled();
      }
      if (lower === GLOBAL_KEYS.endSeason)
        return (handled(), void store.dispatch({ type: 'endSeason' }));
      if (lower === GLOBAL_KEYS.undo) return (handled(), void store.dispatch({ type: 'undo' }));
      if (lower === GLOBAL_KEYS.reroll)
        return (handled(), void store.dispatch({ type: 'rerollDraft' }));
      if (lower === GLOBAL_KEYS.extraCard)
        return (handled(), void store.dispatch({ type: 'buyExtraCard' }));
      if (lower === GLOBAL_KEYS.compost) {
        if (store.state.stores.compost >= content.rules.compostPerTileStep)
          store.setTool({ kind: 'compost' });
        return handled();
      }
      // Read the live state: a key can arrive before the interface has re-rendered.
      const live = store.state;
      const liveKeys = paletteHotkeys(
        paletteOrder(content, live.unlocked).map((id) => ({ id, name: content.byId[id]!.name })),
      );
      const building = Object.entries(liveKeys).find(([, k]) => k === lower)?.[0];
      if (
        building &&
        live.stores.materials >= store.rules.byId[building]!.cost &&
        live.status === 'active'
      ) {
        handled();
        store.selectBuilding(store.selectedBuilding === building ? null : building);
        // Aim at a legal site if the cursor isn't on one.
        if (store.tool && !store.placement?.preview.ok) store.nextSite(1);
        if (store.hover) map?.ensureVisible(store.hover);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const ended = state.status !== 'active';
  return (
    <TipProvider>
      <div class="screen">
        <TopBar store={store} />
        <div class="middle">
          <LeftPanel store={store} />
          <main class="map-wrap" aria-label="Map of the valley">
            <div id="map-host" class="map" />
            {store.resolution ? <ResolutionBanner store={store} /> : <ForecastPill store={store} />}
            <MapTip store={store} view={view()} />
          </main>
          <RightPanel store={store} ui={ui} />
        </div>
        <Footer
          store={store}
          onHelp={() => setHelp(true)}
          onAlmanac={() => setAlmanac(true)}
          onNote={log ? () => setNoting(true) : undefined}
          onNewRun={() => (store.state.status === 'active' ? setAskNewRun(true) : newRun())}
          onCity={viewCity}
          audio={audio}
        />
        {help && <Help onClose={() => setHelp(false)} log={log} audio={audio} />}
        {noting && log && (
          <NoteDialog
            season={`${store.state.season}, year ${store.state.year}`}
            onSave={(text) => {
              log.note(store.state, text);
              setNoting(false);
            }}
            onClose={() => setNoting(false)}
          />
        )}
        {askNewRun && <NewRunDialog onConfirm={newRun} onClose={() => setAskNewRun(false)} />}
        {almanac && <AlmanacModal store={store} onClose={() => setAlmanac(false)} />}
        {store.reveals.length > 0 && !store.resolution && <RevealCard store={store} />}
        {ended && !endSeen && !store.resolution && store.reveals.length === 0 && (
          <EndScreen store={store} onClose={() => setEndSeen(true)} onNewRun={newRun} />
        )}
      </div>
    </TipProvider>
  );
}
