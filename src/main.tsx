/**
 * The web client. It builds a run, draws it with Pixi and lays the
 * interface over it. Only src/sim changes the run, through commands.
 *
 * The run in progress is saved as you play and resumed on the next visit.
 *
 * URL options: ?seed=<text> (a new run with this seed), ?new (a new run),
 * ?guided=0 (skip the guided first year), ?visions=0 (no vision choice),
 * ?sandbox (everything unlocked, 999 materials; never saved).
 */
import { Application } from 'pixi.js';
import { render } from 'preact';
import willowReach from './content/willow-reach.json';
import { loadAlmanac, saveAlmanac } from './game/almanac';
import { loadCity, saveCity } from './game/city';
import { PlayLog } from './game/playlog';
import { indexedDbSlot, throttled } from './game/saves';
import { GameStore } from './game/store';
import { buildTimeline } from './game/timeline';
import { renderBuildingIcons } from './render/icons';
import { MapView } from './render/mapView';
import { COLORS } from './render/palette';
import { canPlace, createRun, loadContent, makeSave, readSave, type RunState } from './sim';
import { App } from './ui/App';

async function start() {
  const params = new URLSearchParams(location.search);
  const content = loadContent(willowReach);
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Blocked storage: the Almanac and Grafts last for this visit only.
  }
  const sandbox = params.has('sandbox');
  const slot = indexedDbSlot();

  // Resume the saved run, unless a new one was asked for.
  let state: RunState | null = null;
  let resumeNote: string | null = null;
  if (!params.has('seed') && !params.has('new') && !sandbox) {
    const data = await slot.load();
    if (data !== undefined) {
      const read = readSave(content, data);
      if (read.ok) {
        state = read.save.state;
        const { year, season } = read.save.summary;
        resumeNote = `Welcome back: your run continues in ${season}, year ${year}.`;
      } else {
        resumeNote = `Your saved run couldn't be loaded (${read.error}), so a new one has begun.`;
      }
    }
  }
  state ??= createRun(content, {
    seed: params.get('seed') ?? `run-${Math.floor(Math.random() * 1e9).toString(36)}`,
    guided: params.get('guided') !== '0',
    sandbox,
    visions: params.get('visions') !== '0',
  });
  const seed = state.options.seed;
  // A reload should resume this run, not start yet another.
  if (params.has('new')) history.replaceState(null, '', location.pathname);

  // The playtest log: a row per season, kept in the browser (not for sandbox runs).
  const log = new PlayLog(content, sandbox ? null : storage);
  const store = new GameStore(content, state, {
    onCommand: (command, ok, before, after) => log.command(command, ok, before, after),
    onResolution: (playing, skipped, s) => log.resolution(playing, skipped, s),
    almanac: loadAlmanac(content, storage),
    onAlmanac: (almanac) => saveAlmanac(content, storage, almanac),
    // The Graft goes to Root City; the finished run's save is no longer needed.
    onGraft: (graft) => {
      const city = loadCity(storage);
      saveCity(storage, {
        ...city,
        grafts: [...city.grafts, graft],
        seeds: city.seeds + graft.seeds,
      });
      void slot.clear();
    },
  });
  store.message = resumeNote;
  log.begin(store.state);

  // Save as you play (not sandbox runs, which are for trying things out): at once after a
  // change, then at most every 300 ms, and again when the page is hidden or closed.
  const status = { turn: -1, savedAt: '' };
  const save = () => {
    if (sandbox || store.graft) return;
    const savedAt = new Date().toISOString();
    const turn = store.state.turn;
    void slot.save(makeSave(store.state, savedAt)).then(() => {
      status.turn = turn;
      status.savedAt = savedAt;
    });
  };
  const autosave = throttled(save, 300);
  let saved = store.state;
  store.subscribe(() => {
    if (store.state === saved) return;
    saved = store.state;
    autosave();
  });
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  save();
  const newRun = () => {
    void slot.clear().then(() => {
      location.href = `${location.pathname}?new`;
    });
  };

  let view: MapView | null = null;
  let icons: Record<string, string> = {};
  const root = document.getElementById('app')!;
  const draw = () =>
    render(
      <App store={store} view={() => view} icons={() => icons} newRun={newRun} log={log} />,
      root,
    );
  draw();

  const host = document.getElementById('map-host')!;
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: COLORS.paper,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  host.appendChild(app.canvas);
  view = new MapView(app, content, {
    onHover: (hex) => store.hoverAt(hex),
    onClick: (hex) => store.clickAt(hex),
    onCancel: () => store.setTool(null),
  });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  view.reducedMotion = motion.matches;
  motion.addEventListener('change', () => (view!.reducedMotion = motion.matches));
  // Each season plays out on the map; the store ends it when it finishes or is skipped.
  let playing: number | null = null;
  const drawMap = () => {
    const r = store.resolution;
    view!.setState(store.state);
    if (r && r.id !== playing) {
      playing = r.id;
      const timeline = buildTimeline(content, store.state, r.report, {
        reducedMotion: motion.matches,
      });
      view!.playResolution(timeline, {
        onPhase: (phase) => store.setResolutionPhase(r.id, phase),
        onDone: () => store.finishResolution(r.id),
      });
    } else if (!r && playing !== null) {
      playing = null;
      view!.stopResolution();
    }
    view!.setResolutionPaused(r?.paused ?? false);
    view!.setOverlay(
      store.hover,
      store.placement,
      store.tool?.kind === 'compost' ? 'compost' : 'hover',
      store.vines,
    );
  };
  store.subscribe(drawMap);
  drawMap();
  // Exposed for debugging and the browser tests.
  (window as unknown as { sunroot: unknown }).sunroot = {
    store,
    view,
    seed,
    canPlace,
    content,
    /** The last save written: the turn and when (for the browser tests). */
    saved: status,
  };
  icons = await renderBuildingIcons(app);
  draw();
}

void start();
