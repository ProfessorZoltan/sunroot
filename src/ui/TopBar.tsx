/** The top bar: the year strip of 8 energy slots, and Harmony, wellbeing and citizens. */
import type { GameStore } from '../game/store';
import { POPULATION_REASONS, type SeasonView, type SlotView } from '../game/insight';
import { FULL_DURATIONS, type PhaseName } from '../game/timeline';
import { harmonyMultiplier, type Content, type Season, type SeasonReport, type Slot } from '../sim';
import { Heart, Leaf, Moon, People, Sun } from './icons';
import { TipTable, useTip, type Row } from './tips';

export const SEASON_NAMES = {
  spring: 'Spring',
  summer: 'Summer',
  autumn: 'Autumn',
  winter: 'Winter',
} as const;

export function TopBar({
  store,
  onReport,
  onEnergyMix,
}: {
  store: GameStore;
  /** Opens the season report on the last report of a season. */
  onReport?: (season: Season) => void;
  /** Opens the year's energy mix chart. */
  onEnergyMix?: () => void;
}) {
  const { content, state } = store;
  const insight = store.insight;
  // While a season resolves, the strip shows the year as it was and fills that season's slots.
  const r = store.resolution;
  const year = r ? r.before.year : insight.year;
  return (
    <header class="top">
      <div class="brand">
        <div class="title">Sunroot</div>
        <div class="quiet small">
          {content.name} · year {state.year} of {content.rules.yearsPerRun} · era {state.era}:{' '}
          {content.rules.eras[state.era - 1]}
        </div>
      </div>
      <div class="year-strip" aria-label={`Energy this year`}>
        {year.map((sv) => (
          <SeasonBox
            content={content}
            onReport={
              onReport && !r && state.recentReports.some((x) => x.season === sv.season)
                ? () => onReport(sv.season)
                : undefined
            }
            sv={r && sv.status === 'now' ? actual(sv, r.report) : sv}
            filling={r && sv.status === 'now' ? r.phase : null}
          />
        ))}
        {onEnergyMix && (
          <button
            type="button"
            class="mix-open"
            title="Energy mix this year"
            aria-label="Energy mix this year"
            onClick={onEnergyMix}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
              <path d="M3 20 L3 13 L9 9 L15 12 L21 6 L21 20 Z" fill="#2a78d6" opacity="0.85" />
              <path d="M3 20 L3 16 L9 13 L15 15 L21 11 L21 20 Z" fill="#eb6834" />
            </svg>
            <span class="small">Mix</span>
          </button>
        )}
      </div>
      <div class="stats">
        <HarmonyStat store={store} />
        <WellbeingStat store={store} />
        <CitizensStat store={store} />
      </div>
    </header>
  );
}

/** The season as it actually went (the forecast didn't know the storm's target). */
function actual(sv: SeasonView, report: SeasonReport): SeasonView {
  const slot = (s: Slot): SlotView => ({
    supply: report.energy[s].supply + report.energy[s].storageDischarged,
    demand: report.energy[s].demand,
    shortfall: report.energy[s].shortfall,
    bySource: report.energy[s].bySource,
    discharged: report.energy[s].storageDischarged,
    report,
  });
  return { ...sv, day: slot('day'), night: slot('night') };
}

const REVEALED: Record<Slot, PhaseName[]> = {
  day: ['day', 'night', 'settle'],
  night: ['night', 'settle'],
};

function SeasonBox({
  content,
  sv,
  filling = null,
  onReport,
}: {
  content: Content;
  sv: SeasonView;
  filling?: PhaseName | null;
  /** Opens the report for the last season of this kind, if there is one. */
  onReport?: () => void;
}) {
  const short = sv.day.shortfall + sv.night.shortfall;
  const label = filling
    ? 'resolving'
    : sv.status === 'done'
      ? 'done'
      : short > 0
        ? `${short} short`
        : sv.status === 'now'
          ? 'now'
          : '';
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
        {onReport && (
          <button
            type="button"
            class="season-report-link"
            aria-label={`Report for the last ${SEASON_NAMES[sv.season].toLowerCase()}`}
            title={`Report for the last ${SEASON_NAMES[sv.season].toLowerCase()}`}
            onClick={onReport}
          >
            ▤
          </button>
        )}
      </div>
      <div class="slot-grid">
        <span class="slot-kind">energy</span>
        <SlotMeter content={content} sv={sv} slot="day" view={sv.day} filling={filling} />
        <SlotMeter content={content} sv={sv} slot="night" view={sv.night} filling={filling} />
        <span class="slot-kind">heat</span>
        <HeatCell sv={sv} slot="day" view={sv.day} filling={filling} />
        <HeatCell sv={sv} slot="night" view={sv.night} filling={filling} />
      </div>
    </div>
  );
}

function SlotMeter({
  content,
  sv,
  slot,
  view,
  filling,
}: {
  content: Content;
  sv: SeasonView;
  slot: Slot;
  view: SlotView;
  filling: PhaseName | null;
}) {
  const tip = useTip(() => <EnergyTip content={content} sv={sv} slot={slot} view={view} />);
  const shown = filling === null || REVEALED[slot].includes(filling);
  const short = view.shortfall > 0 && shown;
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
      aria-label={`${name} energy: made ${view.supply}, used ${view.demand}${short ? `, short by ${view.shortfall}` : ''}`}
      {...tip}
    >
      <div class="slot-numbers">
        {slot === 'day' ? (
          <Sun size={12} color={short ? '#A3401F' : undefined} />
        ) : (
          <Moon size={12} color={short ? '#A3401F' : undefined} />
        )}
        <span class="slot-value">{shown ? `${view.supply}/${view.demand}` : '…'}</span>
      </div>
      <div class={`bar ${slot}`}>
        {short ? (
          <div class="bar-short" />
        ) : (
          <div
            class={`bar-fill ${filling ? 'filling' : ''}`}
            style={{
              width: `${shown ? fill : 0}%`,
              '--fill-ms': `${FULL_DURATIONS[slot] * 0.9}ms`,
            }}
          />
        )}
      </div>
    </div>
  );
}

/** Heat needed in a slot, and how much of it a source paid (the rest goes cold). */
function HeatCell({
  sv,
  slot,
  view,
  filling,
}: {
  sv: SeasonView;
  slot: Slot;
  view: SlotView;
  filling: PhaseName | null;
}) {
  const heat = view.report?.energy[slot].heat;
  const needed = heat?.demand ?? 0;
  const met = heat ? heat.demand - (heat.cold ?? 0) : 0;
  const shown = filling === null || REVEALED[slot].includes(filling);
  const cold = shown && met < needed;
  // Runs 1 to 3: energy may pay heat directly; the card says how much of it did.
  const fromEnergy = shown ? (heat?.direct ?? 0) : 0;
  return (
    <div
      class={`slot-heat${cold ? ' bad' : ''}`}
      aria-label={`${SEASON_NAMES[sv.season]} ${slot} heat: ${needed > 0 ? `needed ${needed}, met ${met}${fromEnergy ? `, ${fromEnergy} of it with energy` : ''}` : 'none needed'}`}
      title={`Heat met / needed, ${slot === 'day' ? 'by day' : 'by night'}${fromEnergy ? `; ${fromEnergy} of it paid with energy, 1 for 1` : ''}`}
    >
      {slot === 'day' ? <Sun size={12} /> : <Moon size={12} />}
      <span class="slot-value">{!shown ? '…' : needed > 0 ? `${met}/${needed}` : '—'}</span>
      {fromEnergy > 0 && <span class="slot-kind from-energy">⚡{fromEnergy}</span>}
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
  const title = `${SEASON_NAMES[sv.season]} ${slot}: energy made / used, heat met / needed${sv.status === 'forecast' ? ' (forecast with what you have now)' : sv.status === 'now' ? ' (if the season ended now)' : ''}`;
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
  const name = (id: string) =>
    id === 'mixedGrid'
      ? 'Mixed Grid bonus'
      : id === 'demolition'
        ? 'Demolition work'
        : (content.byId[id]?.name ?? id);
  const supply: Row[] = Object.entries(r.bySource).map(([id, n]) => ({
    label: name(id),
    amount: n,
  }));
  if (r.storageDischarged) supply.push({ label: 'From storage', amount: r.storageDischarged });
  // Energy use, by what uses it; heat is apart below, except the energy turned into heat.
  const demand: Row[] = Object.entries(r.demandBy).map(([id, n]) => ({
    label: name(id),
    amount: -n,
  }));
  const intoHeat = r.heat.direct + (r.heat.gridLoss ?? 0);
  if (intoHeat) demand.push({ label: 'Turned into heat, 1 for 1', amount: -intoHeat });
  if (r.heat.pumpEnergy) demand.push({ label: 'Heat pumps', amount: -r.heat.pumpEnergy });
  const heat = heatRows(r, name);
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
      {heat && <TipTable title="Heat" rows={heat.rows} total={heat.total} />}
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

/** Heat needed in a slot, by building type, and what paid it: kept apart from energy. */
function heatRows(
  r: SeasonReport['energy'][Slot],
  name: (id: string) => string,
): { rows: Row[]; total: Row } | null {
  const h = r.heat;
  if (h.demand === 0) return null;
  const rows: Row[] = Object.entries(r.heatBy ?? {}).map(([id, n]) => ({
    label: `${name(id)} needs`,
    amount: n,
  }));
  const neighbor = h.neighbor ?? 0;
  const cold = h.cold ?? 0;
  const wells = Math.max(0, h.demand - h.free - neighbor - h.pumped - h.direct - cold);
  const paid: [string, number][] = [
    ['Solar thermal', h.free],
    ['A warm neighbour', neighbor],
    ['Heat wells', wells],
    ['Heat pumps', h.pumped],
    ['Energy, turned into heat', h.direct],
  ];
  for (const [label, n] of paid)
    if (n > 0) rows.push({ label: `Paid by ${label.toLowerCase()}`, amount: -n, tone: 'good' });
  if (cold > 0) rows.push({ label: 'Nothing paid it: cold', amount: -cold, tone: 'bad' });
  return { rows, total: { label: 'Heat needed', amount: h.demand } };
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
