/**
 * Milestone 3 interface: enough to play on the map. Milestone 4 replaces the
 * panels with the full HUD (year strip, stained-glass draft cards, tooltips
 * with all the math).
 */
import { useEffect, useReducer } from 'preact/hooks';
import type { GameStore } from '../game/store';
import type { MapView } from '../render/mapView';
import { harmonyMultiplier } from '../sim';
import { describeBuilding } from './describe';

const SEASON_NAMES = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };

export function App({ store, view }: { store: GameStore; view: () => MapView | null }) {
  const [, rerender] = useReducer((n: number, _: undefined) => n + 1, 0);
  useEffect(() => store.subscribe(() => rerender(undefined)), [store]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map = view();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        store.dispatch({ type: 'undo' });
      } else if (e.key === 'Escape') store.select(null);
      else if (!map) return;
      else if (e.key === 'ArrowLeft') map.pan(60, 0);
      else if (e.key === 'ArrowRight') map.pan(-60, 0);
      else if (e.key === 'ArrowUp') map.pan(0, 60);
      else if (e.key === 'ArrowDown') map.pan(0, -60);
      else if (e.key === '+' || e.key === '=') map.zoomBy(1.2);
      else if (e.key === '-') map.zoomBy(1 / 1.2);
      else if (e.key === '0') map.fit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, view]);

  const { state, content } = store;
  const housing = Object.values(state.buildings).reduce(
    (n, b) => n + content.byId[b.type]!.housing,
    0,
  );
  const storage = Object.values(state.buildings).reduce(
    (n, b) => n + content.byId[b.type]!.foodStorage,
    0,
  );
  const event = content.events[state.forecast.event];
  const next = content.events[state.forecast.next];
  const ended = state.status !== 'active';

  return (
    <div class="screen">
      <header class="top">
        <div class="brand">
          <div class="title">Sunroot</div>
          <div class="quiet">
            {content.name} · year {state.year} of {content.rules.yearsPerRun} ·{' '}
            {SEASON_NAMES[state.season]}
          </div>
        </div>
        <div class="stats">
          <Stat label="Materials" value={state.stores.materials} />
          <Stat label="Food" value={`${state.stores.food} / ${storage}`} />
          <Stat label="Citizens" value={`${state.citizens} / ${housing}`} />
          <Stat
            label={`Harmony · ×${harmonyMultiplier(content, state.harmony)}`}
            value={state.harmony}
          />
          <Stat label="Wellbeing" value={state.wellbeing} />
        </div>
      </header>

      <div class="middle">
        <main id="map-host" class="map" aria-label="Map of the valley" />

        <aside class="side">
          {state.draft.offer.length > 0 && !state.draft.picked && (
            <section>
              <h2>Choose one</h2>
              <div class="quiet small">{SEASON_NAMES[state.season]} draft</div>
              <div class="cards">
                {state.draft.offer.map((id) => {
                  const def = content.byId[id]!;
                  return (
                    <button
                      type="button"
                      class="card"
                      key={id}
                      onClick={() => store.dispatch({ type: 'pickCard', card: id })}
                    >
                      <span class="card-kind">Blueprint</span>
                      <span class="card-name">{def.name}</span>
                      <span class="card-text">
                        {describeBuilding(content, def).slice(1, 3).join(' ')}
                      </span>
                      <span class="card-cost">{def.cost} materials</span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section>
            <h2>Build</h2>
            <div class="palette">
              {state.unlocked.map((id) => {
                const def = content.byId[id]!;
                if (!def.draftable && !def.starter) return null;
                const afford = state.stores.materials >= def.cost;
                return (
                  <button
                    type="button"
                    key={id}
                    class={`tool${store.selected === id ? ' selected' : ''}`}
                    aria-pressed={store.selected === id}
                    disabled={!afford || ended}
                    title={describeBuilding(content, def).join('\n')}
                    onClick={() => store.select(store.selected === id ? null : id)}
                  >
                    <span>{def.name}</span>
                    <span class="cost">{def.cost}</span>
                  </button>
                );
              })}
            </div>
            <div class="quiet small">
              Right-click or Esc stops placing. Drag to pan, scroll to zoom.
            </div>
          </section>

          <PlacementPanel store={store} />
        </aside>
      </div>

      <footer class="bottom">
        <div class="forecast">
          <strong>
            This season: {event.name}. Next: {next.name.toLowerCase()}.
          </strong>
          <span class="quiet small">{event.description}</span>
        </div>
        {store.message && (
          <div class="message" role="status">
            {store.message}
          </div>
        )}
        {ended && (
          <div class="message" role="status">
            The run has {state.status === 'complete' ? 'ended: all 12 years done' : 'collapsed'}.
          </div>
        )}
        <div class="actions">
          <button
            type="button"
            class="button"
            disabled={!store.canUndo}
            onClick={() => store.dispatch({ type: 'undo' })}
          >
            Undo
          </button>
          <button
            type="button"
            class="button primary"
            disabled={ended}
            onClick={() => store.dispatch({ type: 'endSeason' })}
          >
            End {SEASON_NAMES[state.season].toLowerCase()}
          </button>
        </div>
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div class="stat">
      <span class="stat-value">{value}</span>
      <span class="quiet small">{label}</span>
    </div>
  );
}

function PlacementPanel({ store }: { store: GameStore }) {
  const { content, state } = store;
  const p = store.placement;
  if (!p) {
    if (!store.hover) return null;
    const tile = state.map.tiles[`${store.hover.q},${store.hover.r}`];
    const b = Object.values(state.buildings).find(
      (x) => x.at.q === store.hover!.q && x.at.r === store.hover!.r,
    );
    return (
      <section class="panel">
        <h3>{b ? content.byId[b.type]!.name : cap(tile?.type ?? '')}</h3>
        {b && <div class="quiet small">on {tile?.type}</div>}
        {tile?.salvage !== undefined && <div class="small">{tile.salvage} salvage left</div>}
        {b && state.lastReport?.math[b.uid]?.map((line) => <div class="small">{line}</div>)}
      </section>
    );
  }
  const def = content.byId[p.building]!;
  if (!p.preview.ok) {
    return (
      <section class="panel invalid">
        <h3>{def.name}</h3>
        <div class="small">{p.preview.reason}</div>
      </section>
    );
  }
  const t = p.preview.totals;
  const lines = [
    { n: t.food, label: 'food this season', good: t.food > 0 },
    { n: t.harmony, label: 'Harmony', good: t.harmony > 0 },
    { n: t.wellbeing, label: 'wellbeing by the end of the season', good: t.wellbeing > 0 },
    { n: t.shortfall.night, label: 'night energy short', good: t.shortfall.night < 0 },
    { n: t.shortfall.day, label: 'day energy short', good: t.shortfall.day < 0 },
  ].filter((l) => l.n !== 0);
  return (
    <section class="panel">
      <div class="panel-head">
        <h3>{def.name}</h3>
        <span class="quiet small">{def.cost} materials</span>
      </div>
      {lines.map((l) => (
        <div class="delta">
          <span class={l.good ? 'good' : 'bad'}>{l.n > 0 ? `+${l.n}` : `−${-l.n}`}</span>
          <span>{l.label}</span>
        </div>
      ))}
      {p.preview.warnings.map((w) => (
        <div class="warning small">{w}</div>
      ))}
      {p.preview.math.map((line) => (
        <div class="quiet small">{line}</div>
      ))}
      <div class="quiet small">Undo is free until you end the season.</div>
    </section>
  );
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
