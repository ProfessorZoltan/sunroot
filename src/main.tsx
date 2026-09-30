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
import { GameStore } from './game/store';
import { MapView } from './render/mapView';
import { COLORS } from './render/palette';
import { canPlace, createRun, loadContent } from './sim';
import { App } from './ui/App';

async function start() {
  const params = new URLSearchParams(location.search);
  const seed = params.get('seed') ?? `run-${Math.floor(Math.random() * 1e9).toString(36)}`;
  const content = loadContent(willowReach);
  const store = new GameStore(
    content,
    createRun(content, {
      seed,
      guided: params.get('guided') !== '0',
      sandbox: params.has('sandbox'),
    }),
  );

  let view: MapView | null = null;
  const root = document.getElementById('app')!;
  render(<App store={store} view={() => view} />, root);

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
    onCancel: () => store.select(null),
  });
  const draw = () => {
    view!.setState(store.state);
    view!.setOverlay(store.hover, store.placement);
  };
  store.subscribe(draw);
  draw();
  // Expose the store for debugging and end-to-end checks.
  (window as unknown as { sunroot: unknown }).sunroot = { store, view, seed, canPlace, content };
}

void start();
