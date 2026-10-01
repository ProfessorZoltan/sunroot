/**
 * The web client. It builds a run, draws it with Pixi and lays the
 * interface over it, or shows Root City between runs. Only src/sim changes
 * the run and the city, through commands.
 *
 * The run in progress and Root City are saved as you play and resumed on the
 * next visit. A new player goes straight into their first run; after that,
 * each run is sent home to Root City, where the next expedition is chosen.
 *
 * URL options: ?city (Root City; read-only while a run is in progress),
 * ?new (the city's next run), ?seed=<text> (a run with this seed, outside
 * the city's teaching and expeditions), ?guided=0 (with ?seed: skip the
 * guided first year), ?visions=0 (with ?seed: no vision choice), ?sandbox
 * (everything unlocked, 999 materials; never saved).
 */
import { Application } from 'pixi.js';
import { render } from 'preact';
import willowReach from './content/willow-reach.json';
import { connectAudio } from './audio/director';
import { AudioEngine } from './audio/engine';
import { loadAlmanac, saveAlmanac } from './game/almanac';
import { loadCity, saveCity } from './game/city';
import { PlayLog } from './game/playlog';
import { indexedDbSlot, throttled } from './game/saves';
import { GameStore, type Reveal } from './game/store';
import { buildTimeline } from './game/timeline';
import { renderBuildingIcons } from './render/icons';
import { artLoaded, iconUrl, loadArt } from './render/sprites';
import { MapView } from './render/mapView';
import { COLORS } from './render/palette';
import {
  applyCityCommand,
  canPlace,
  createCity,
  createRun,
  loadContent,
  makeSave,
  needsExpedition,
  nextRunOptions,
  readSave,
  runCity,
  teaching,
  type CityState,
  type RunState,
} from './sim';
import { App } from './ui/App';
import { CityScreen } from './ui/City';

const randomSeed = (prefix: string) => `${prefix}-${Math.floor(Math.random() * 1e9).toString(36)}`;

async function start() {
  const params = new URLSearchParams(location.search);
  const content = loadContent(willowReach);
  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
  } catch {
    // Blocked storage: the Almanac and the playtest log last for this visit only.
  }
  const sandbox = params.has('sandbox');
  const slot = indexedDbSlot('current');
  const citySlot = indexedDbSlot('city');
  const root = document.getElementById('app')!;

  // Sound starts with the first click or key press (browsers require one) and pauses while hidden.
  const audio = new AudioEngine(storage);
  addEventListener('pointerdown', () => audio.unlock());
  addEventListener('keydown', () => audio.unlock());
  document.addEventListener('visibilitychange', () =>
    document.visibilityState === 'hidden' ? audio.pause() : audio.unlock(),
  );

  // Root City, saved in its own slot (sandbox runs never touch it).
  const loaded = sandbox
    ? { city: createCity(content, 'sandbox'), problem: null }
    : await loadCity(content, citySlot, storage, randomSeed('city'));
  let city: CityState = loaded.city;
  let citySaving: Promise<void> = Promise.resolve();
  const cityStatus = { runs: -1, savedAt: '' };
  const keepCity = (next: CityState) => {
    city = next;
    if (sandbox) return;
    const savedAt = new Date().toISOString();
    citySaving = citySaving
      .then(() => saveCity(citySlot, next, savedAt))
      .then(() => {
        cityStatus.runs = next.runs;
        cityStatus.savedAt = savedAt;
      });
  };
  keepCity(city);
  /** Root City when it has something to do before a run, otherwise the city's next run. */
  const nextUrl = () =>
    needsExpedition(content, city) || city.pending.length > 0 ? '?city' : '?new';
  const go = (url: string) =>
    void citySaving.then(() => (location.href = `${location.pathname}${url}`));

  // Resume the saved run, unless a new one was asked for.
  let state: RunState | null = null;
  let resumeNote: string | null = loaded.problem
    ? `Root City couldn't be loaded (${loaded.problem}), so it begins again.`
    : null;
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

  // Root City: asked for, or there is a Graft to place or an expedition to choose.
  const cityFirst =
    !state && !params.has('seed') && !sandbox && nextUrl() === '?city' && !params.has('new');
  if (params.has('city') || cityFirst || (params.has('new') && nextUrl() === '?city')) {
    if (params.has('new') || params.has('city')) history.replaceState(null, '', location.pathname);
    const readOnly = state !== null;
    render(
      <CityScreen
        content={content}
        initial={city}
        readOnly={readOnly}
        onSave={keepCity}
        onSetOut={() => go('?new')}
        onBack={() => go('')}
        audio={audio}
      />,
      root,
    );
    (window as unknown as { sunroot: unknown }).sunroot = {
      city: () => city,
      content,
      savedCity: cityStatus,
      audio,
    };
    return;
  }

  let intro: Reveal[] = [];
  if (!state && (params.has('seed') || sandbox)) {
    state = createRun(content, {
      seed: params.get('seed') ?? randomSeed('run'),
      guided: params.get('guided') !== '0',
      sandbox,
      visions: params.get('visions') !== '0',
      city: sandbox ? undefined : runCity(content, city),
    });
  } else if (!state) {
    // The city's next run: what it teaches, the city's gifts, and the chosen expedition.
    const run = city.runs + 1;
    state = createRun(content, nextRunOptions(content, city));
    const embarked = applyCityCommand(content, city, { type: 'embark' });
    if (embarked.ok) keepCity(embarked.city);
    if (run > 1) intro = [{ kind: 'start', run, joining: teaching(content, run).joining }];
  }
  const seed = state.options.seed;
  // A reload should resume this run, not start yet another.
  if (params.has('new')) history.replaceState(null, '', location.pathname);

  // The playtest log: a row per season, kept in the browser (not for sandbox runs).
  const log = new PlayLog(content, sandbox ? null : storage);
  // Notes for what the player does, chords for combos, music that follows Harmony.
  let sound: ReturnType<typeof connectAudio> | null = null;
  const store = new GameStore(content, state, {
    onCommand: (command, ok, before, after) => {
      log.command(command, ok, before, after);
      sound?.command(command, ok, before, after);
    },
    onResolution: (playing, skipped, s) => log.resolution(playing, skipped, s),
    almanac: loadAlmanac(content, storage),
    onAlmanac: (almanac) => saveAlmanac(content, storage, almanac),
    // Sent home: the Graft is planted or the Seeds banked; the finished run's save is done with.
    bankedSeeds: sandbox ? 0 : city.seeds,
    onRunEnd: (result) => {
      if (sandbox) return;
      const home = applyCityCommand(content, city, { type: 'sendHome', result });
      if (home.ok) keepCity(home.city);
      void slot.clear();
    },
    intro,
  });
  sound = connectAudio(audio, store);
  store.message = resumeNote;
  log.begin(store.state);

  // Save as you play (not sandbox runs, which are for trying things out): at once after a
  // change, then at most every 300 ms, and again when the page is hidden or closed.
  const status = { turn: -1, savedAt: '' };
  const save = () => {
    if (sandbox || store.result) return;
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
  // Abandoning a run, or after sending one home: Root City, or straight on to the next run.
  const newRun = () => void slot.clear().then(() => go(nextUrl()));
  const viewCity = () => go('?city');

  let view: MapView | null = null;
  let icons: Record<string, string> = {};
  const draw = () =>
    render(
      <App
        store={store}
        view={() => view}
        icons={() => icons}
        newRun={newRun}
        viewCity={sandbox ? undefined : viewCity}
        log={log}
        audio={audio}
      />,
      root,
    );
  draw();
  // For the browser tests: in place before the map is set up (the map view joins when ready).
  (window as unknown as { sunroot: unknown }).sunroot = {
    store,
    get view() {
      return view;
    },
    seed,
    canPlace,
    content,
    /** The last save written: the turn and when (for the browser tests). */
    saved: status,
    /** Textures of hand-made art loaded (for the browser tests). */
    get art() {
      return artLoaded();
    },
    city: () => city,
    savedCity: cityStatus,
    audio,
  };
  const host = document.getElementById('map-host')!;
  const app = new Application();
  await app.init({
    resizeTo: host,
    background: COLORS.paper,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
  });
  // Hand-made art (src/art), where there is any; the rest is drawn in code. Loaded before the
  // canvas is shown, so the map appears drawn.
  await loadArt();
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
      const timeline = buildTimeline(store.rules, store.state, r.report, {
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
    view!.setMarks(store.marks);
    view!.setOverlay(
      store.hover,
      store.placement,
      store.tool?.kind === 'compost' ? 'compost' : 'hover',
      store.vines,
      store.legalSites,
    );
  };
  store.subscribe(drawMap);
  drawMap();
  icons = await renderBuildingIcons(app);
  for (const id of Object.keys(icons)) icons[id] = iconUrl(id) ?? icons[id]!;
  draw();
}

void start();
