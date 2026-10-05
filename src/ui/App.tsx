/**
 * The interface (Milestone 4, reworked after playtesting for more map and
 * less at once): the year strip and stats on top, stores on the left, the map
 * in the middle with the forecast along its top and the season controls at its
 * foot, the draft and palette on the right. Building details, the run overview
 * and the priority list open over the map. Everything works with the keyboard
 * as well as the mouse.
 */
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import type { GameStore } from '../game/store';
import type { MapView } from '../render/mapView';
import { paletteHotkeys, GLOBAL_KEYS } from './hotkeys';
import { AlmanacModal, RevealCard } from './Combos';
import { LeftPanel } from './LeftPanel';
import { Help, MapTip, ResolutionBanner } from './Overlays';
import { ActionDock, ForecastBanner, RunOverview } from './Hud';
import { ShortfallPicker, TerrainPicker } from './MapControls';
import { PrioritiesPanel } from './Priorities';
import { EnergyMixDialog } from './EnergyMix';
import { EndScreen, NewRunDialog, NoteDialog } from './RunUi';
import type { PlayLog } from '../game/playlog';
import type { AudioEngine } from '../audio/engine';
import { Inspector, RightPanel, paletteOrder, type Ui } from './RightPanel';
import { SeasonReportDialog } from './SeasonReport';
import type { Season } from '../sim';
import { TipProvider } from './tips';
import { IconsContext } from './pictures';
import { TopBar } from './TopBar';

export function App({
  store,
  view,
  icons,
  tiles = () => ({}),
  newRun,
  viewCity,
  log,
  audio,
}: {
  store: GameStore;
  view: () => MapView | null;
  icons: () => Record<string, string>;
  /** Tile icons, by tile type (for the pictures on combo cards). */
  tiles?: () => Record<string, string>;
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
  // The season report: open on the last report of a season, or the latest.
  const [report, setReportState] = useState<Season | 'latest' | null>(null);
  const reportOpen = useRef(false);
  const setReport = (open: Season | 'latest' | null) => {
    reportOpen.current = open !== null;
    setReportState(open);
  };
  const [askNewRun, setAskNewRun] = useState(false);
  const [overview, setOverviewState] = useState(false);
  const overviewOpen = useRef(false);
  const setOverview = (open: boolean) => {
    overviewOpen.current = open;
    setOverviewState(open);
  };
  const [energyMix, setEnergyMixState] = useState(false);
  const energyMixOpen = useRef(false);
  const setEnergyMix = (open: boolean) => {
    energyMixOpen.current = open;
    setEnergyMixState(open);
  };
  const [priorities, setPrioritiesState] = useState(false);
  const prioritiesOpen = useRef(false);
  const setPriorities = (open: boolean) => {
    prioritiesOpen.current = open;
    setPrioritiesState(open);
  };
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
  const ui: Ui = { icons: icons(), tiles: tiles(), hotkeys };

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
      if (reportOpen.current) {
        if (key === 'Escape') return (handled(), setReport(null));
        return;
      }
      if (overviewOpen.current) {
        if (key === 'Escape') return (handled(), setOverview(false));
        return;
      }
      if (energyMixOpen.current) {
        if (key === 'Escape') return (handled(), setEnergyMix(false));
        return;
      }
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
      // Esc stops fast-forward.
      if (store.fastForwardTo !== null && key === 'Escape' && !help) {
        handled();
        return store.stopFastForward();
      }
      if (almanacOpen.current && !help) {
        if (key === 'Escape' || lower === GLOBAL_KEYS.almanac)
          return (handled(), setAlmanac(false));
        return;
      }
      if (key === 'Escape') {
        if (help) return setHelp(false);
        if (store.tool) return store.setTool(null);
        if (store.inspected) return store.inspect(null);
        if (prioritiesOpen.current) return setPriorities(false);
        return;
      }
      if (help) return;
      if (lower === GLOBAL_KEYS.almanac) return (handled(), setAlmanac(true));
      if (/^[1-4]$/.test(key)) {
        const { draft, charterOffer, visionOffer, evolutionOffer } = store.state;
        const branch = evolutionOffer[0];
        if (branch) {
          const combo = branch.options[Number(key) - 1];
          if (combo) store.dispatch({ type: 'chooseEvolution', uid: branch.uid, combo });
          return handled();
        }
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
      // Delete (or Backspace) demolishes the building in the inspector.
      if ((key === 'Delete' || key === 'Backspace') && store.inspected && !store.tool) {
        handled();
        const uid = store.inspected;
        if (store.dispatch({ type: 'demolish', uid })) store.inspect(null);
        return;
      }
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
      // The hedge tool turns between a tile's sides.
      if ((key === '[' || key === ']') && store.tool?.kind === 'hedge')
        return (handled(), store.turnHedge(key === ']' ? 1 : -1));
      if (key === '+' || key === '=') return map?.zoomBy(1.2);
      if (key === '-') return map?.zoomBy(1 / 1.2);
      if (key === '0') return map?.fit();
      if (lower === GLOBAL_KEYS.nextSite) {
        store.nextSite(e.shiftKey ? -1 : 1);
        if (store.hover) map?.ensureVisible(store.hover);
        return handled();
      }
      if (lower === GLOBAL_KEYS.endSeason && e.shiftKey) return (handled(), store.fastForward());
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
  const menu = {
    onReport: () => setReport('latest'),
    onOverview: () => setOverview(true),
    onPriorities: () => setPriorities(true),
    onAlmanac: () => setAlmanac(true),
    onHelp: () => setHelp(true),
    onNewRun: () => (store.state.status === 'active' ? setAskNewRun(true) : newRun()),
    onNote: log ? () => setNoting(true) : undefined,
    onCity: viewCity,
    audio,
  };
  return (
    <TipProvider>
      <IconsContext.Provider value={{ buildings: ui.icons, tiles: ui.tiles }}>
        <div class="screen">
          <TopBar
            store={store}
            onReport={(season) => setReport(season)}
            onEnergyMix={() => setEnergyMix(true)}
          />
          <div class="middle">
            <LeftPanel store={store} onOverview={() => setOverview(true)} />
            <main class="map-wrap" aria-label="Map of the valley">
              <div id="map-host" class="map" />
              {store.resolution ? (
                <ResolutionBanner store={store} />
              ) : (
                <ForecastBanner store={store} />
              )}
              <MapTip store={store} view={view()} />
              <div class="map-controls">
                <TerrainPicker store={store} />
                <ShortfallPicker store={store} />
              </div>
              {store.inspected && !priorities && !store.tool && (
                <div class="inspector-overlay">
                  <Inspector store={store} ui={ui} />
                </div>
              )}
              <ActionDock store={store} menu={menu} />
            </main>
            {priorities ? (
              <PrioritiesPanel
                store={store}
                ui={ui}
                view={view}
                onClose={() => setPriorities(false)}
              />
            ) : (
              <RightPanel store={store} ui={ui} />
            )}
          </div>
          {help && <Help onClose={() => setHelp(false)} log={log} audio={audio} />}
          {overview && <RunOverview store={store} onClose={() => setOverview(false)} />}
          {energyMix && <EnergyMixDialog store={store} onClose={() => setEnergyMix(false)} />}
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
          {report && (
            <SeasonReportDialog
              store={store}
              season={report === 'latest' ? undefined : report}
              onClose={() => setReport(null)}
            />
          )}
          {askNewRun && <NewRunDialog onConfirm={newRun} onClose={() => setAskNewRun(false)} />}
          {almanac && <AlmanacModal store={store} onClose={() => setAlmanac(false)} />}
          {store.reveals.length > 0 && !store.resolution && <RevealCard store={store} />}
          {ended && !endSeen && !store.resolution && store.reveals.length === 0 && (
            <EndScreen store={store} onClose={() => setEndSeen(true)} onNewRun={newRun} />
          )}
        </div>
      </IconsContext.Provider>
    </TipProvider>
  );
}
