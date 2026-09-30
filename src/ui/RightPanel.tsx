/** Right column: the draft, the building palette, and the placement preview or building inspector. */
import type { GameStore } from '../game/store';
import type { BuildingDef, Content } from '../sim';
import { describeBuilding } from './describe';
import { Reroll } from './icons';
import { SEASON_NAMES } from './TopBar';
import { signed } from './tips';

/** Stained-glass jewel colour for a card, by building kind. */
const JEWEL: Record<BuildingDef['kind'], string> = {
  food: '#E0A33B',
  home: '#E0A33B',
  energy: '#3A6EA5',
  water: '#3A6EA5',
  storage: '#B85C6E',
  civic: '#B85C6E',
  industry: '#2E8B6A',
  nature: '#2E8B6A',
};

export interface Ui {
  icons: Record<string, string>;
  hotkeys: Record<string, string>;
}

export function RightPanel({ store, ui }: { store: GameStore; ui: Ui }) {
  return (
    <aside class="side" aria-label="Draft and building">
      <DraftPanel store={store} ui={ui} />
      <BuildPanel store={store} ui={ui} />
      {store.inspected ? <Inspector store={store} ui={ui} /> : <PlacementPanel store={store} />}
    </aside>
  );
}

function DraftPanel({ store, ui }: { store: GameStore; ui: Ui }) {
  const { content, state } = store;
  const { offer, picked } = state.draft;
  const k = content.rules.knowledge;
  if (offer.length === 0) {
    return (
      <section>
        <h2>Draft</h2>
        <div class="quiet small">Every blueprint is unlocked: nothing left to draft.</div>
      </section>
    );
  }
  if (picked) {
    const def = content.byId[picked]!;
    return (
      <section>
        <h2>Drafted</h2>
        <div class="picked">
          <img src={ui.icons[picked]} alt="" width={32} height={32} />
          <span>
            <strong>{def.name}</strong> is on your palette this season.
          </span>
        </div>
      </section>
    );
  }
  return (
    <section>
      <div class="draft-head">
        <div>
          <h2>Choose one</h2>
          <div class="quiet small">
            {SEASON_NAMES[state.season]} draft · press 1 to {offer.length}
          </div>
        </div>
        <div class="draft-buttons">
          <button
            type="button"
            class="button small-button"
            disabled={state.stores.knowledge < k.reroll}
            onClick={() => store.dispatch({ type: 'rerollDraft' })}
            aria-keyshortcuts="R"
          >
            <Reroll size={16} /> Reroll · {k.reroll} knowledge
          </button>
          {!state.draft.extraBought && (
            <button
              type="button"
              class="button small-button"
              disabled={state.stores.knowledge < k.extraCard}
              onClick={() => store.dispatch({ type: 'buyExtraCard' })}
              aria-keyshortcuts="X"
            >
              4th card · {k.extraCard} knowledge
            </button>
          )}
        </div>
      </div>
      <div class="cards">
        {offer.map((id, i) => (
          <DraftCard
            content={content}
            def={content.byId[id]!}
            icon={ui.icons[id]}
            index={i}
            store={store}
          />
        ))}
      </div>
    </section>
  );
}

function DraftCard({
  content,
  def,
  icon,
  index,
  store,
}: {
  content: Content;
  def: BuildingDef;
  icon: string | undefined;
  index: number;
  store: GameStore;
}) {
  const lines = describeBuilding(content, def);
  return (
    <button
      type="button"
      class="card"
      aria-keyshortcuts={String(index + 1)}
      onClick={() => store.dispatch({ type: 'pickCard', card: def.id })}
    >
      <span class="jewel" style={{ background: JEWEL[def.kind] }}>
        {icon && <img src={icon} alt="" width={40} height={40} />}
      </span>
      <span class="card-body">
        <span class="card-kind">Blueprint</span>
        <span class="card-name">{def.name}</span>
        <span class="card-text">{lines.slice(1, 3).join(' ')}</span>
        <span class="card-cost">{def.cost} materials</span>
      </span>
      <span class="keycap" aria-hidden="true">
        {index + 1}
      </span>
    </button>
  );
}

function BuildPanel({ store, ui }: { store: GameStore; ui: Ui }) {
  const { content, state } = store;
  const ended = state.status !== 'active';
  const compostCost = content.rules.compostPerTileStep;
  return (
    <section>
      <h2>Build</h2>
      <div class="palette" role="group" aria-label="Buildings">
        {paletteOrder(content, state.unlocked).map((id) => {
          const def = content.byId[id]!;
          const afford = state.stores.materials >= def.cost;
          const selected = store.selectedBuilding === id;
          const key = ui.hotkeys[id];
          return (
            <button
              type="button"
              class={`tool${selected ? ' selected' : ''}`}
              aria-pressed={selected}
              aria-keyshortcuts={key?.toUpperCase()}
              disabled={!afford || ended}
              title={describeBuilding(content, def).join('\n')}
              onClick={() => store.selectBuilding(selected ? null : id)}
            >
              {ui.icons[id] && <img src={ui.icons[id]} alt="" width={28} height={28} />}
              <span class="tool-text">
                <span class="tool-name">{def.name}</span>
                <span class="tool-meta">
                  <span class="cost">{def.cost} materials</span>
                  {key && (
                    <span class="keycap" aria-hidden="true">
                      {key.toUpperCase()}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
        <button
          type="button"
          class={`tool${store.tool?.kind === 'compost' ? ' selected' : ''}`}
          aria-pressed={store.tool?.kind === 'compost'}
          aria-keyshortcuts="K"
          disabled={state.stores.compost < compostCost || ended}
          title={`Spend ${compostCost} compost to improve a tile one step (barren → scrub → meadow → woodland).`}
          onClick={() => store.setTool(store.tool?.kind === 'compost' ? null : { kind: 'compost' })}
        >
          <span class="tool-text">
            <span class="tool-name">Spread compost</span>
            <span class="tool-meta">
              <span class="cost">{compostCost} compost</span>
              <span class="keycap" aria-hidden="true">
                K
              </span>
            </span>
          </span>
        </button>
      </div>
      <div class="quiet small">
        Hover or use the arrow keys to aim, N for the next legal site, Enter or click to place. Esc
        stops.
      </div>
    </section>
  );
}

/** Starters first, then blueprints in the order they were unlocked. */
export function paletteOrder(content: Content, unlocked: string[]): string[] {
  return unlocked.filter((id) => {
    const def = content.byId[id]!;
    return def.starter || def.draftable;
  });
}

function PlacementPanel({ store }: { store: GameStore }) {
  const { content } = store;
  const p = store.placement;
  if (store.tool?.kind === 'compost') {
    return (
      <section class="panel">
        <h3>Spread compost</h3>
        <div class="small">
          Improves a barren, scrub or meadow tile one step. Healthier land raises Harmony, which
          multiplies yields.
        </div>
      </section>
    );
  }
  if (!p) return null;
  const def = content.byId[p.building]!;
  if (!p.preview.ok) {
    return (
      <section class="panel invalid" role="status">
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
    <section class="panel" role="status">
      <div class="panel-head">
        <h3>{def.name}</h3>
        <span class="quiet small">{def.cost} materials</span>
      </div>
      {lines.map((l) => (
        <div class="delta">
          <span class={l.good ? 'good' : 'bad'}>{signed(l.n)}</span>
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

function Inspector({ store, ui }: { store: GameStore; ui: Ui }) {
  const { content, state } = store;
  const b = state.buildings[store.inspected!];
  if (!b) return null;
  const def = content.byId[b.type]!;
  const now = store.insight.now;
  const status: string[] = [];
  if (b.damage) {
    status.push(
      b.damage.cause === 'flood'
        ? 'Flood-damaged: repaired next season for 2 materials.'
        : 'Storm-damaged this season.',
    );
  }
  if (now.unstaffed.includes(b.uid)) status.push('No worker: it will not run this season.');
  if (now.blackouts.includes(b.uid)) status.push('Will be shut off in a blackout this season.');
  const rank = state.priority.indexOf(b.uid);
  const move = (by: number) => {
    const order = [...state.priority];
    const to = Math.max(0, Math.min(order.length - 1, rank + by));
    order.splice(rank, 1);
    order.splice(to, 0, b.uid);
    store.dispatch({ type: 'setPriority', order });
  };
  return (
    <section class="panel" aria-label={`${def.name} details`}>
      <div class="panel-head">
        <span class="inspect-title">
          {ui.icons[b.type] && <img src={ui.icons[b.type]} alt="" width={28} height={28} />}
          <h3>{def.name}</h3>
        </span>
        <button type="button" class="link" onClick={() => store.inspect(null)}>
          Close
        </button>
      </div>
      {status.map((s) => (
        <div class="warning small">{s}</div>
      ))}
      <div class="quiet small">This season, if it ended now:</div>
      {(now.math[b.uid] ?? ['Nothing to report.']).map((line) => (
        <div class="small">{line}</div>
      ))}
      {def.recipes && def.recipes.options.length > 1 && (
        <label class="small control">
          Recipe{' '}
          <select
            value={b.recipe ?? def.recipes.defaultRecipe}
            onChange={(e) =>
              store.dispatch({ type: 'setRecipe', uid: b.uid, recipe: e.currentTarget.value })
            }
          >
            {def.recipes.options.map((o) => (
              <option value={o.id}>
                {o.id === 'salvage'
                  ? 'Salvage into materials'
                  : o.id === 'clutter'
                    ? 'Recycle clutter'
                    : o.id}
              </option>
            ))}
          </select>
        </label>
      )}
      {def.digester && (
        <label class="small control">
          Feeds the{' '}
          <select
            value={b.slot ?? def.digester.defaultSlot}
            onChange={(e) =>
              store.dispatch({
                type: 'setDigesterSlot',
                uid: b.uid,
                slot: e.currentTarget.value as 'day' | 'night',
              })
            }
          >
            <option value="day">day</option>
            <option value="night">night</option>
          </select>{' '}
          slot
        </label>
      )}
      {b.uid !== 'b0' && (
        <div class="small control">
          Priority {rank + 1} of {state.priority.length}: staffed in order, shut off last-first in a
          blackout.
          <div class="row">
            <button
              type="button"
              class="button small-button"
              disabled={rank <= 1}
              onClick={() => move(-1)}
            >
              Raise
            </button>
            <button
              type="button"
              class="button small-button"
              disabled={rank >= state.priority.length - 1}
              onClick={() => move(1)}
            >
              Lower
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
