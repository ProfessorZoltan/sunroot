/** Left column: stores with this season's change, workers, and what happened last season. */
import type { GameStore } from '../game/store';
import { POPULATION_REASONS } from '../game/insight';
import type { Resource } from '../sim';
import { LoopsPanel } from './Combos';
import { EraGoalStatus, ExpeditionStatus, VisionStatus } from './RunUi';
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
        <WaterRow store={store} />
        <div class="quiet small">Numbers on the right: the change by the end of this season.</div>
      </section>
      <VisionStatus store={store} />
      <EraGoalStatus store={store} />
      <ExpeditionStatus store={store} />
      <CivicStatus store={store} />
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

/** Water this season, as it stands: what the river brings and who would go short. */
function WaterRow({ store }: { store: GameStore }) {
  const w = store.waterForecast;
  if (!w) return null;
  const uses = Object.values(w.uses);
  const short = uses.filter((u) => u.short).length;
  // The first seasons of a guided year with water: how water works, in a line or two.
  const teach = store.state.options.guided && store.state.turn < 2;
  return (
    <>
      <div
        class="store-row water-row"
        title="Water this season, if it ended now. Hover a channel or a building for its water."
      >
        <Drop />
        <span class="grow">
          Water <span class="quiet small">· river {w.riverFlow}</span>
        </span>
        <span class={`strong ${short > 0 ? 'bad' : ''}`}>
          {short > 0 ? `${short} short` : uses.length > 0 ? 'all watered' : '—'}
        </span>
        <span class="delta-num" />
      </div>
      {teach && (
        <div class="small water-hint">
          Farms, orchards and greenhouses drink from channels: build them beside the camp&rsquo;s
          channel. To dig more, choose Irrigation Channel and click from a channel&rsquo;s end, or
          beside the river. Hover a channel to see its water.
        </div>
      )}
    </>
  );
}

function Drop() {
  return (
    <svg class="icon" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 1.5 C8 1.5 3 7 3 10 a5 5 0 0 0 10 0 C13 7 8 1.5 8 1.5 Z" fill="#58a7cf" />
    </svg>
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
  if (r.mixedGrid)
    lines.push(
      store.rules.events.storm.mixedGridShelters
        ? 'Mixed Grid: no storm damage, and extra energy in every slot.'
        : 'Mixed Grid: extra energy in every slot (it gives no shelter from these storms).',
    );
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

/** From era 3: how many citizens the settlement's civic life serves (rising expectations). */
function CivicStatus({ store }: { store: GameStore }) {
  const { state } = store;
  const ex = store.rules.rules.expectations;
  if (!ex || state.era < ex.fromEra || state.status !== 'active') return null;
  const now = store.insight.now;
  const line = now.wellbeing.lines.find((l) => l.kind === 'expectations');
  const idle = new Set(now.unstaffed);
  let served = ex.base;
  for (const b of Object.values(state.buildings))
    if (!idle.has(b.uid) && !b.damage) served += ex.perBuilding[b.type] ?? 0;
  const names = Object.entries(ex.perBuilding)
    .map(([id, n]) => `${store.content.byId[id]?.name ?? id} +${n}`)
    .join(', ');
  return (
    <section aria-label="Civic life">
      <h2>Civic life</h2>
      <div class="small">
        Serves up to <strong>{served}</strong> citizens; {state.citizens} live here
        {line ? <span class="bad"> · {line.amount} wellbeing a season</span> : '.'}
      </div>
      <div class="quiet small">
        Citizens expect civic life now: it serves {ex.base}, and each working {names}. Every{' '}
        {ex.perUnserved} citizens beyond that cost 1 wellbeing a season.
      </div>
    </section>
  );
}
