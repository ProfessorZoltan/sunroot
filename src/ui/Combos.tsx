/**
 * Combos in the interface (Milestone 6): the Almanac, the stained-glass card
 * that reveals a discovery, the charter choice, and the loops and charters
 * on the left.
 */
import { useEffect, useRef } from 'preact/hooks';
import { entryView, LAYER_NAMES } from '../game/almanac';
import type { GameStore } from '../game/store';
import { COMBO_LAYERS, eraGoal, type Combo, type ComboLayer } from '../sim';

/** Jewel colour per layer, from the stained-glass palette. */
export const LAYER_JEWEL: Record<ComboLayer, string> = {
  adjacency: '#2E8B6A',
  chain: '#E0A33B',
  formation: '#3A6EA5',
  evolution: '#B85C6E',
};

const LAYER_TEXT: Record<ComboLayer, string> = {
  adjacency: 'Neighbours that help each other. The placement preview shows them.',
  chain: 'Close a loop and each building in it makes +1 for as long as it stands.',
  formation: 'Hidden shapes. Their effect lasts while the shape stands.',
  evolution: 'A building becomes something new because of its neighbours.',
};

/** A hexagonal jewel with the layer's glyph, or a dark silhouette. */
function Jewel({ layer, dark = false }: { layer: ComboLayer; dark?: boolean }) {
  const glyph = { adjacency: '⬡', chain: '∞', formation: '✦', evolution: '❦' }[layer];
  return (
    <span
      class={`combo-jewel${dark ? ' dark' : ''}`}
      style={{ background: dark ? undefined : LAYER_JEWEL[layer] }}
      aria-hidden="true"
    >
      {dark ? '?' : glyph}
    </span>
  );
}

export function AlmanacModal({ store, onClose }: { store: GameStore; onClose: () => void }) {
  const { content, state, almanac } = store;
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const cost = content.rules.knowledge.hint;
  const known = content.combos.filter((c) => entryView(almanac, state, c) === 'known').length;
  const canBuy = state.status === 'active' && state.stores.knowledge >= cost;
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal almanac"
        role="dialog"
        aria-modal="true"
        aria-label="Almanac"
        onClick={(e) => e.stopPropagation()}
      >
        <div class="panel-head">
          <div>
            <h2 class="glass-title">The Almanac · {content.name}</h2>
            <div class="small">
              {known} of {content.combos.length} discovered. Discoveries are kept across runs.
            </div>
          </div>
          <button type="button" class="button small-button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
        {COMBO_LAYERS.map((layer) => (
          <section class="almanac-layer" aria-label={LAYER_NAMES[layer]}>
            <h3>
              {LAYER_NAMES[layer]} <span class="small">{LAYER_TEXT[layer]}</span>
            </h3>
            <div class="almanac-grid">
              {content.combos
                .filter((c) => c.layer === layer)
                .map((c) => (
                  <AlmanacEntry store={store} combo={c} canBuy={canBuy} cost={cost} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function AlmanacEntry({
  store,
  combo,
  canBuy,
  cost,
}: {
  store: GameStore;
  combo: Combo;
  canBuy: boolean;
  cost: number;
}) {
  const view = entryView(store.almanac, store.state, combo);
  if (view === 'known') {
    const now = store.state.discoveries.includes(combo.id);
    return (
      <article class="almanac-entry known" aria-label={combo.name}>
        <Jewel layer={combo.layer} />
        <div>
          <div class="strong">
            {combo.name}
            {now && <span class="found-now"> · found this run</span>}
          </div>
          <div class="small">{combo.text}</div>
        </div>
      </article>
    );
  }
  return (
    <article class="almanac-entry silhouette" aria-label="Undiscovered">
      <Jewel layer={combo.layer} dark />
      <div>
        <div class="strong">Undiscovered</div>
        {view === 'hinted' ? (
          <div class="small hint">Hint: {combo.hint}</div>
        ) : (
          <button
            type="button"
            class="button small-button"
            disabled={!canBuy}
            onClick={() => store.dispatch({ type: 'buyHint', combo: combo.id })}
          >
            Buy a hint · {cost} knowledge
          </button>
        )}
      </div>
    </article>
  );
}

/**
 * The stained-glass card that unfolds after a season plays out: a combo new to
 * the Almanac, the start of an era, or the run's vision achieved.
 */
export function RevealCard({ store }: { store: GameStore }) {
  const reveal = store.reveals[0]!;
  const { content } = store;
  const button = useRef<HTMLButtonElement>(null);
  const key =
    reveal.kind === 'era' || reveal.kind === 'eraGoal'
      ? `${reveal.kind}-${reveal.era}`
      : reveal.kind === 'start'
        ? `start-${reveal.run}`
        : `${reveal.kind}-${reveal.id}`;
  useEffect(() => button.current?.focus(), [key]);
  const more = store.reveals.length - 1;
  let label: string;
  let body;
  if (reveal.kind === 'combo') {
    const combo = content.comboById[reveal.id]!;
    label = `Discovered: ${combo.name}`;
    body = (
      <>
        <Jewel layer={combo.layer} />
        <span class="card-kind">Discovered · {LAYER_NAMES[combo.layer]}</span>
        <h2 class="glass-title">{combo.name}</h2>
        <p>{combo.text}</p>
        <div class="small">Filed in the Almanac.</div>
      </>
    );
  } else if (reveal.kind === 'era') {
    const name = content.rules.eras[reveal.era - 1] ?? `Era ${reveal.era}`;
    const blueprints = content.buildings
      .filter((b) => b.draftable && b.minEra === reveal.era)
      .map((b) => b.name);
    const charter = content.rules.charterEras.includes(reveal.era);
    const goal = eraGoal(content, reveal.era);
    label = `Era ${reveal.era}: ${name}`;
    body = (
      <>
        <span class="combo-jewel" style={{ background: '#E0A33B' }} aria-hidden="true">
          {reveal.era}
        </span>
        <span class="card-kind">A new era</span>
        <h2 class="glass-title">{name}</h2>
        <p>
          Era {reveal.era} of {content.rules.eras.length}: years{' '}
          {(reveal.era - 1) * content.rules.yearsPerEra + 1} to{' '}
          {reveal.era * content.rules.yearsPerEra}.
          {goal
            ? ` This era's goal: ${goal.text.charAt(0).toLowerCase()}${goal.text.slice(1)}`
            : ''}
          {charter ? ' A charter awaits: choose one before the season ends.' : ''}
          {blueprints.length > 0 ? ` New blueprints can be drafted: ${blueprints.join(', ')}.` : ''}
        </p>
      </>
    );
  } else if (reveal.kind === 'eraGoal') {
    const goal = eraGoal(content, reveal.era)!;
    const name = content.rules.eras[reveal.era - 1] ?? `Era ${reveal.era}`;
    label = `Era goal met: ${goal.text}`;
    body = (
      <>
        <span class="combo-jewel" style={{ background: '#E0A33B' }} aria-hidden="true">
          ✓
        </span>
        <span class="card-kind">Era goal · {name}</span>
        <h2 class="glass-title">{goal.text}</h2>
        {goal.reward.knowledge > 0 && <p>+{goal.reward.knowledge} knowledge.</p>}
      </>
    );
  } else if (reveal.kind === 'request') {
    const request = content.requests.find((r) => r.id === reveal.id)!;
    label = `City request met: ${request.text}`;
    body = (
      <>
        <span class="combo-jewel" style={{ background: '#3A6EA5' }} aria-hidden="true">
          ✓
        </span>
        <span class="card-kind">City request met</span>
        <h2 class="glass-title">{request.text}</h2>
        <div class="small">
          +{content.progression?.seeds.cityRequest ?? 0} Seeds when the run is sent home.
        </div>
      </>
    );
  } else if (reveal.kind === 'start') {
    const start = runStart(store, reveal.joining);
    label = start.title;
    body = (
      <>
        <span class="combo-jewel" style={{ background: '#2E8B6A' }} aria-hidden="true">
          {reveal.run}
        </span>
        <span class="card-kind">Run {reveal.run}</span>
        <h2 class="glass-title">{start.title}</h2>
        {start.lines.map((l) => (
          <p class="small">{l}</p>
        ))}
      </>
    );
  } else {
    const vision = content.visions.find((v) => v.id === reveal.id)!;
    label = `Vision achieved: ${vision.name}`;
    body = (
      <>
        <span class="combo-jewel" style={{ background: '#2E8B6A' }} aria-hidden="true">
          ✓
        </span>
        <span class="card-kind">Vision achieved</span>
        <h2 class="glass-title">{vision.name}</h2>
        <p>{vision.text}</p>
        <div class="small">+{content.rules.score.visionBonus} to this run's score.</div>
      </>
    );
  }
  return (
    <div class="modal-backdrop">
      <div
        class="modal glass discovery"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        key={key}
      >
        {body}
        <button
          type="button"
          class="button primary"
          ref={button}
          onClick={() => store.dismissReveal()}
        >
          {more > 0 ? `Next (${more} more)` : 'Continue'}
        </button>
      </div>
    </div>
  );
}

const JOINING: Record<string, string> = {
  tunings:
    'New this run: tunings join the draft. A tuning changes a building’s numbers for the rest of the run.',
  charters:
    'New this run: charters. At the start of eras 2, 3 and 4, choose one of 3 rules for the rest of the run.',
  visions: 'New this run: visions. Choose a goal for the run at the start, worth extra score.',
};

/** What a run begun from Root City brings: its twist, request, the city's gifts, what's new. */
export function runStart(store: GameStore, joining: string[]): { title: string; lines: string[] } {
  const { content, state } = store;
  const twist = content.twists.find((t) => t.id === state.options.expedition?.twist);
  const request = content.requests.find((r) => r.id === state.options.expedition?.request);
  const tiers = content.rules.score.tiers;
  const lines: string[] = [];
  if (twist) lines.push(`${twist.name}: ${twist.text}`);
  if (request) {
    lines.push(
      `City request: ${request.text} (+${content.progression?.seeds.cityRequest ?? 0} Seeds if met)`,
    );
  }
  const gifts = Object.entries(state.options.city?.districts ?? {}).map(([id, tier]) => {
    const d = content.districts.find((x) => x.id === id)!;
    const i = Math.max(
      0,
      tiers.findIndex((t) => t.id === tier),
    );
    return `${d.name} (${tiers[i]!.name}): ${d.perks[Math.min(i, d.perks.length - 1)]!.text}`;
  });
  if (gifts.length > 0) lines.push(`From Root City: ${gifts.join('; ')}.`);
  for (const id of state.options.city?.landmarks ?? []) {
    const l = content.landmarks.find((x) => x.id === id);
    if (l) lines.push(`${l.name}: ${l.text}`);
  }
  for (const j of joining) if (JOINING[j]) lines.push(JOINING[j]);
  return { title: twist ? `Expedition: ${twist.name}` : 'A new Sprout', lines };
}

/** At the start of eras 2, 3 and 4: choose one charter (keys 1 to 3). */
export function CharterPanel({ store }: { store: GameStore }) {
  const { content, state } = store;
  return (
    <section aria-label="Charter">
      <h2>Choose a charter</h2>
      <div class="quiet small">
        Era {state.era}: {content.rules.eras[state.era - 1]}. A charter lasts the rest of the run.
        Press 1 to {state.charterOffer.length}.
      </div>
      <div class="cards">
        {state.charterOffer.map((id, i) => {
          const charter = content.charterById[id]!;
          return (
            <button
              type="button"
              class="card charter"
              aria-keyshortcuts={String(i + 1)}
              onClick={() => store.dispatch({ type: 'pickCharter', charter: id })}
            >
              <span class="jewel" style={{ background: '#1E4744' }}>
                <span class="charter-glyph" aria-hidden="true">
                  ❧
                </span>
              </span>
              <span class="card-body">
                <span class="card-kind">Charter</span>
                <span class="card-name">{charter.name}</span>
                <span class="card-text">{charter.text}</span>
              </span>
              <span class="keycap" aria-hidden="true">
                {i + 1}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/** Left column: closed loops, the run's charters and tunings. */
export function LoopsPanel({ store }: { store: GameStore }) {
  const { content, state } = store;
  const loops = state.loops.map((l) => ({ loop: l, combo: content.comboById[l.combo]! }));
  const empty = loops.length === 0 && state.charters.length === 0 && state.tunings.length === 0;
  return (
    <section aria-label="Loops and charters">
      <h2>Loops</h2>
      {loops.length === 0 && (
        <div class="quiet small">
          No loop closed yet. A composter among working farms closes the Kitchen Loop.
        </div>
      )}
      {loops.map(({ loop, combo }) => (
        <div class="loop-row small">
          <span class="loop-mark" aria-hidden="true">
            ∞
          </span>
          <span>
            <strong>{combo.name}</strong> · {loop.members.length} buildings, +1 each
            {loop.turn === state.turn - 1 ? ' from this season' : ''}
          </span>
        </div>
      ))}
      {(state.charters.length > 0 || state.tunings.length > 0) && <div class="divider" />}
      {state.charters.map((id) => (
        <div class="small" title={content.charterById[id]!.text}>
          <strong>Charter:</strong> {content.charterById[id]!.name}
        </div>
      ))}
      {state.tunings.map((id) => (
        <div class="small" title={content.tuningById[id]!.text}>
          <strong>Tuning:</strong> {content.tuningById[id]!.name}
        </div>
      ))}
      {empty && <div class="quiet small">Charters come at the start of eras 2, 3 and 4.</div>}
    </section>
  );
}
