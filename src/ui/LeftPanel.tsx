/** Left column: stores with this season's change, workers, and what happened last season. */
import type { GameStore } from '../game/store';
import { POPULATION_REASONS } from '../game/insight';
import type { Resource } from '../sim';
import { LoopsPanel } from './Combos';
import { VisionStatus } from './RunUi';
import { Person, ResourceIcon } from './icons';
import { TipTable, signed, useTip } from './tips';

const STORES: { res: Resource; label: string }[] = [
  { res: 'materials', label: 'Materials' },
  { res: 'food', label: 'Food' },
  { res: 'salvage', label: 'Salvage' },
  { res: 'biomass', label: 'Biomass' },
  { res: 'compost', label: 'Compost' },
  { res: 'knowledge', label: 'Knowledge' },
  { res: 'scraps', label: 'Scraps' },
  { res: 'clutter', label: 'Clutter' },
];

export function LeftPanel({ store }: { store: GameStore }) {
  return (
    <aside class="left" aria-label="Stores">
      <section>
        <h2>Stores</h2>
        {STORES.map(({ res, label }) => (
          <StoreRow store={store} res={res} label={label} />
        ))}
        <div class="divider" />
        <WorkersRow store={store} />
        <div class="quiet small">Numbers on the right: the change by the end of this season.</div>
      </section>
      <VisionStatus store={store} />
      <LastSeason store={store} />
      <LoopsPanel store={store} />
    </aside>
  );
}

function StoreRow({ store, res, label }: { store: GameStore; res: Resource; label: string }) {
  const { state } = store;
  const insight = store.insight;
  const delta = insight.delta[res];
  const made = insight.sources[res];
  const madeTotal = made.reduce((n, c) => n + c.amount, 0);
  const used = delta - madeTotal;
  const value =
    res === 'food' ? `${state.stores.food} / ${insight.foodStorage}` : state.stores[res];
  const tip = useTip(() => (
    <TipTable
      title={`${label} this season`}
      rows={[
        ...made.map((c) => ({ label: c.label, amount: c.amount, tone: 'good' as const })),
        ...(used !== 0
          ? [
              {
                label: res === 'food' ? 'Eaten, and lost to rot' : used < 0 ? 'Used' : 'Other',
                amount: used,
                tone: used < 0 ? ('bad' as const) : undefined,
              },
            ]
          : []),
      ]}
      total={{ label: 'By the end of the season', amount: delta }}
    />
  ));
  return (
    <div
      class="store-row"
      tabIndex={0}
      aria-label={`${label} ${value}, ${signed(delta)} this season`}
      {...tip}
    >
      <ResourceIcon resource={res} />
      <span class="grow">{label}</span>
      <span class="strong">{value}</span>
      <span
        class={`delta-num ${delta > 0 ? (res === 'clutter' || res === 'scraps' ? 'bad' : 'good') : delta < 0 ? (res === 'clutter' ? 'good' : 'bad') : 'quiet'}`}
      >
        {delta === 0 ? '±0' : signed(delta)}
      </span>
    </div>
  );
}

function WorkersRow({ store }: { store: GameStore }) {
  const { busy, total } = store.insight.workers;
  const unstaffed = store.insight.now.unstaffed.length;
  const tip = useTip(() => (
    <TipTable
      title="Workers"
      rows={[
        { label: 'Citizens', amount: total },
        { label: 'Jobs', amount: busy },
        ...(unstaffed
          ? [{ label: 'Buildings without a worker', amount: unstaffed, tone: 'bad' as const }]
          : []),
      ]}
    />
  ));
  return (
    <div class="store-row" tabIndex={0} {...tip}>
      <Person />
      <span class="grow">Jobs filled</span>
      <span class={`strong ${busy > total ? 'bad' : ''}`}>
        {Math.min(busy, total)} / {busy}
      </span>
      <span class="delta-num" />
    </div>
  );
}

function LastSeason({ store }: { store: GameStore }) {
  const { content, state } = store;
  const r = state.lastReport;
  if (!r) return null;
  const name = (uid: string) =>
    content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'a building';
  const lines: string[] = [];
  const event = content.events[r.event];
  if (r.flooded.length) lines.push(`${event.name}: ${r.flooded.length} tiles flooded.`);
  if (r.silted.length)
    lines.push(`Silt on ${r.silted.length} farm${r.silted.length > 1 ? 's' : ''}.`);
  if (r.damaged.length) lines.push(`Damaged: ${r.damaged.map(name).join(', ')}.`);
  if (r.mixedGrid) lines.push('Mixed Grid: storms did no damage.');
  if (r.blackouts.length) lines.push(`Blackouts: ${r.blackouts.map(name).join(', ')}.`);
  if (r.population.change > 0)
    lines.push(`${r.population.change} new citizen${r.population.change > 1 ? 's' : ''}.`);
  if (r.population.change < 0) lines.push(`${-r.population.change} citizen left.`);
  if (r.population.change === 0 && r.population.reason !== 'grew') {
    lines.push(POPULATION_REASONS[r.population.reason]);
  }
  if (r.food.unfed) lines.push(`${r.food.unfed} went hungry.`);
  if (r.food.rotted) lines.push(`${r.food.rotted} food rotted (storage full).`);
  if (r.clutter.fromScraps) lines.push(`${r.clutter.fromScraps} scraps became clutter.`);
  for (const n of state.notices) lines.push(n);
  const wb = r.wellbeing.after - r.wellbeing.before;
  return (
    <section>
      <h2>Last season</h2>
      <div class="quiet small">
        {r.season.charAt(0).toUpperCase() + r.season.slice(1)}, year {r.year} · wellbeing{' '}
        {signed(wb)}
      </div>
      <ul class="events">
        {lines.length === 0 ? <li>A quiet season.</li> : lines.map((l) => <li>{l}</li>)}
      </ul>
    </section>
  );
}
