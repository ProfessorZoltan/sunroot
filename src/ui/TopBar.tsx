/** The top bar: the year strip of 8 energy slots, and Harmony, wellbeing and citizens. */
import type { GameStore } from '../game/store';
import { POPULATION_REASONS, type SeasonView, type SlotView } from '../game/insight';
import { harmonyMultiplier, type Content, type Slot } from '../sim';
import { Heart, Leaf, Moon, People, Sun } from './icons';
import { TipTable, useTip, type Row } from './tips';

export const SEASON_NAMES = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
} as const;

export function TopBar({ store }: { store: GameStore }) {
  const { content, state } = store;
  const insight = store.insight;
  return (
    <header class="top">
      <div class="brand">
        <div class="title">Sunroot</div>
        <div class="quiet small">
          {content.name} · year {state.year} of {content.rules.yearsPerRun}
        </div>
      </div>
      <div class="year-strip" aria-label={`Energy this year`}>
        {insight.year.map((sv) => (
          <SeasonBox content={content} sv={sv} />
        ))}
      </div>
      <div class="stats">
        <HarmonyStat store={store} />
        <WellbeingStat store={store} />
        <CitizensStat store={store} />
      </div>
    </header>
  );
}

function SeasonBox({ content, sv }: { content: Content; sv: SeasonView }) {
  const short = sv.day.shortfall + sv.night.shortfall;
  const label =
    sv.status === 'done'
      ? 'done'
      : short > 0
        ? `${short} short`
        : sv.status === 'now'
          ? 'now'
          : 'forecast';
  return (
    <div
      class={`season ${sv.status}`}
      aria-label={`${SEASON_NAMES[sv.season]}, ${sv.status === 'now' ? 'the current season' : sv.status}${short > 0 ? `, ${short} short` : ''}`}
    >
      <div class="season-head">
        <span class="season-name">{SEASON_NAMES[sv.season]}</span>
        <span class={`season-state ${short > 0 ? 'bad' : sv.status === 'now' ? 'gold' : 'quiet'}`}>
          {label}
        </span>
      </div>
      <div class="slots">
        <SlotMeter content={content} sv={sv} slot="day" view={sv.day} />
        <SlotMeter content={content} sv={sv} slot="night" view={sv.night} />
      </div>
    </div>
  );
}

function SlotMeter({
  content,
  sv,
  slot,
  view,
}: {
  content: Content;
  sv: SeasonView;
  slot: Slot;
  view: SlotView;
}) {
  const tip = useTip(() => <EnergyTip content={content} sv={sv} slot={slot} view={view} />);
  const short = view.shortfall > 0;
  const fill =
    view.supply === 0
      ? view.demand > 0
        ? 100
        : 0
      : Math.min(100, (view.demand / view.supply) * 100);
  const name = `${SEASON_NAMES[sv.season]} ${slot}`;
  return (
    <div
      class={`slot ${short ? 'short' : ''}`}
      tabIndex={0}
      aria-label={`${name}: supply ${view.supply}, demand ${view.demand}${short ? `, short by ${view.shortfall}` : ''}`}
      {...tip}
    >
      <div class="slot-numbers">
        {slot === 'day' ? (
          <Sun size={14} color={short ? '#A3401F' : undefined} />
        ) : (
          <Moon size={14} color={short ? '#A3401F' : undefined} />
        )}
        <span>
          {view.supply} / {view.demand}
        </span>
      </div>
      <div class={`bar ${slot}`}>
        {short ? <div class="bar-short" /> : <div class="bar-fill" style={{ width: `${fill}%` }} />}
      </div>
    </div>
  );
}

function EnergyTip({
  content,
  sv,
  slot,
  view,
}: {
  content: Content;
  sv: SeasonView;
  slot: Slot;
  view: SlotView;
}) {
  const title = `${SEASON_NAMES[sv.season]} ${slot}${sv.status === 'forecast' ? ' (forecast with what you have now)' : sv.status === 'now' ? ' (if the season ended now)' : ''}`;
  const r = view.report?.energy[slot];
  if (!r) {
    return (
      <TipTable
        title={title}
        rows={[
          { label: 'Supply', amount: view.supply },
          { label: 'Demand', amount: -view.demand },
        ]}
        total={{ label: 'Short', amount: view.shortfall, tone: view.shortfall ? 'bad' : 'quiet' }}
      />
    );
  }
  const name = (id: string) => content.byId[id]?.name ?? id;
  const supply: Row[] = Object.entries(r.bySource).map(([id, n]) => ({
    label: name(id),
    amount: n,
  }));
  if (r.storageDischarged) supply.push({ label: 'From storage', amount: r.storageDischarged });
  const demand: Row[] = Object.entries(r.demandBy).map(([id, n]) => ({
    label: name(id),
    amount: -n,
  }));
  if (r.heat.free)
    demand.push({ label: 'Heat paid by solar thermal', amount: r.heat.free, tone: 'good' });
  if (r.heat.pumped) {
    demand.push({
      label: 'Saved by heat pumps',
      amount: r.heat.pumped - r.heat.pumpEnergy,
      tone: 'good',
    });
  }
  const other: Row[] = [];
  if (r.reserved) other.push({ label: 'Set aside for the night', amount: -r.reserved });
  if (r.sponges) other.push({ label: 'Workshop and kiln runs', amount: -r.sponges });
  if (r.storageCharged - r.reserved > 0)
    other.push({ label: 'Charged into storage', amount: -(r.storageCharged - r.reserved) });
  if (r.unused) other.push({ label: 'Spare, unused', amount: r.unused, tone: 'quiet' });
  const blackouts = view.report!.blackouts.length;
  return (
    <div>
      <TipTable
        title={title}
        rows={supply}
        total={{ label: 'Supply', amount: r.supply + r.storageDischarged }}
      />
      <TipTable rows={demand} total={{ label: 'Demand', amount: -r.demand }} />
      {other.length > 0 && <TipTable rows={other} />}
      {r.shortfall > 0 && (
        <div class="tip-row total bad">
          <span>
            Short: blackouts shut off {blackouts} building{blackouts === 1 ? '' : 's'}
          </span>
          <span>{r.shortfall}</span>
        </div>
      )}
    </div>
  );
}

function HarmonyStat({ store }: { store: GameStore }) {
  const { content, state } = store;
  const tip = useTip(() => (
    <div>
      <TipTable
        title="Harmony"
        rows={store.insight.harmony.map((l) => ({ label: l.label, amount: l.amount }))}
        total={{ label: 'Harmony', amount: state.harmony }}
      />
      <div class="tip-note">
        Yields multiply by{' '}
        {content.rules.harmony.tiers.map((t) => `×${t.multiplier} from ${t.min}`).join(', ')}. Food,
        biomass and knowledge, per building, rounded down.
      </div>
    </div>
  ));
  return (
    <div class="stat" tabIndex={0} {...tip}>
      <Leaf size={22} />
      <div>
        <div class="stat-value">{state.harmony}</div>
        <div class="quiet small">Harmony · ×{harmonyMultiplier(content, state.harmony)}</div>
      </div>
    </div>
  );
}

function WellbeingStat({ store }: { store: GameStore }) {
  const { state } = store;
  const now = store.insight.now;
  const tip = useTip(() => (
    <TipTable
      title="Wellbeing by the end of this season"
      rows={now.wellbeing.lines.map((l) => ({
        label: l.reason,
        amount: l.amount,
        tone: l.amount < 0 ? 'bad' : 'good',
      }))}
      total={{
        label: `${now.wellbeing.before} → ${now.wellbeing.after}`,
        amount: now.wellbeing.after - now.wellbeing.before,
      }}
    />
  ));
  return (
    <div class="stat" tabIndex={0} {...tip}>
      <Heart size={22} />
      <div>
        <div class="stat-value">{state.wellbeing}</div>
        <div class="quiet small">Wellbeing</div>
      </div>
    </div>
  );
}

function CitizensStat({ store }: { store: GameStore }) {
  const { state } = store;
  const insight = store.insight;
  const pop = insight.now.population;
  const tip = useTip(() => (
    <div>
      <TipTable
        title="Citizens"
        rows={[
          { label: 'Housing', amount: `${state.citizens} of ${insight.housing}` },
          { label: 'Working', amount: `${insight.workers.busy} of ${insight.workers.total}` },
          { label: 'This season', amount: pop.change },
        ]}
      />
      <div class="tip-note">{POPULATION_REASONS[pop.reason]}</div>
    </div>
  ));
  return (
    <div class="stat" tabIndex={0} {...tip}>
      <People size={22} />
      <div>
        <div class="stat-value">
          {state.citizens} / {insight.housing}
        </div>
        <div class="quiet small">Citizens</div>
      </div>
    </div>
  );
}
