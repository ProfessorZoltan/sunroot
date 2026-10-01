/**
 * The web client. It builds a run, draws it with Pixi and lays the
 * interface over it. Only src/sim changes the run, through commands.
 *
 * URL options: ?seed=<text> (a fixed run), ?guided=0 (skip the guided
 * first year), ?sandbox (everything unlocked, 999 materials).
 */
import { Application } from 'pixi.js';
import { render } from 'preact';
import willowReach from './content/willow-reach.json';
import { loadAlmanac, saveAlmanac } from './game/almanac';
import { GameStore } from './game/store';
import { buildTimeline } from './game/timeline';
import { renderBuildingIcons } from './render/icons';
import { MapView } from './render/mapView';
import { COLORS } from './render/palette';
import { canPlace, createRun, loadContent } from './sim';
import { App } from './ui/App';

async function start() {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? `run-${Math.floor(Math.random() * 1e9).toString(36)}`;
  const content = loadContent(willowReach);
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Blocked storage: the Almanac lasts for this visit only.
  }
  const store = new GameStore(
    content,
    createRun(content, {
      seed,
      guided: params.get('guided') !== '0',
      sandbox: params.has('sandbox'),
    }),
    {
      almanac: loadAlmanac(content, storage),
      onAlmanac: (almanac) => saveAlmanac(content, storage, almanac),
    },
  );

  let view: MapView | null = null;
  let icons: Record<string, string> = {};
  const root = document.getElementById('app')!;
  const draw = () => render(<App store={store} view={() => view} icons={() => icons} />, root);
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
  (window as unknown as { sunroot: unknown }).sunroot = { store, view, seed, canPlace, content };
  icons = await renderBuildingIcons(app);
  draw();
}

void start();
