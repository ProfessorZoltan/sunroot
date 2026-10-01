/**
 * The season report: the last spring, summer, autumn and winter as they were
 * played, to read at leisure after the resolution has gone by. Each resource
 * made and used and by what (the simulation's ledger, which balances), the
 * energy by source and use, the combos, loops and other bonuses at work, and
 * wellbeing and population.
 */
import { useEffect, useRef, useState } from 'preact/hooks';
import type { GameStore } from '../game/store';
import {
  RESOURCES,
  type Content,
  type FlowLines,
  type Resource,
  type Season,
  type SeasonReport,
  type Slot,
} from '../sim';
import { LAYER_NAMES } from '../game/almanac';
import { SankeyDiagram } from './Sankey';
import { SEASON_NAMES } from './TopBar';

const RESOURCE_NAMES: Record<Resource, string> = {
  materials: 'Materials',
  food: 'Food',
  salvage: 'Salvage',
  biomass: 'Biomass',
  compost: 'Compost',
  knowledge: 'Knowledge',
  scraps: 'Scraps',
  clutter: 'Clutter',
};

function Lines({ lines, sign }: { lines: FlowLines | undefined; sign: '+' | '−' }) {
  const entries = Object.entries(lines ?? {}).sort((a, b) => b[1].amount - a[1].amount);
  if (entries.length === 0) return <span class="quiet">—</span>;
  return (
    <ul class="plain flow">
      {entries.map(([label, l]) => (
        <li>
          <span>
            {label}
            {l.count > 1 ? ` ×${l.count}` : ''}
          </span>
          <strong>
            {sign}
            {l.amount}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function sum(lines: FlowLines | undefined): number {
  return Object.values(lines ?? {}).reduce((n, l) => n + l.amount, 0);
}

function Resources({ report }: { report: SeasonReport }) {
  const rows = RESOURCES.filter((r) => report.flows[r]);
  return (
    <table class="report-table">
      <thead>
        <tr>
          <th>Resource</th>
          <th>Made, by what</th>
          <th>Used, by what</th>
          <th>Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((res) => {
          const f = report.flows[res]!;
          const change = sum(f.made) - sum(f.used);
          return (
            <tr>
              <th>{RESOURCE_NAMES[res]}</th>
              <td>
                <Lines lines={f.made} sign="+" />
              </td>
              <td>
                <Lines lines={f.used} sign="−" />
              </td>
              <td class={change < 0 ? 'bad' : change > 0 ? 'good' : 'quiet'}>
                {change > 0 ? `+${change}` : change < 0 ? `−${-change}` : '±0'}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Energy({ content, report }: { content: Content; report: SeasonReport }) {
  const name = (id: string) =>
    id === 'mixedGrid'
      ? 'Mixed Grid'
      : id === 'demolition'
        ? 'Demolition work'
        : (content.byId[id]?.name ?? id);
  const column = (slot: Slot) => {
    const e = report.energy[slot];
    const made = Object.entries(e.bySource).map(([id, n]) => [name(id), n] as const);
    const demand = Object.entries(e.demandBy).map(([id, n]) => [name(id), n] as const);
    return (
      <td>
        <div class="small strong">Made {e.supply}</div>
        <ul class="plain flow">
          {made.map(([n, v]) => (
            <li>
              <span>{n}</span>
              <strong>+{v}</strong>
            </li>
          ))}
          {e.storageDischarged > 0 && (
            <li>
              <span>From storage</span>
              <strong>+{e.storageDischarged}</strong>
            </li>
          )}
        </ul>
        <div class="small strong">Used {e.demand + e.sponges + e.storageCharged}</div>
        <ul class="plain flow">
          {demand.map(([n, v]) => (
            <li>
              <span>{n}</span>
              <strong>−{v}</strong>
            </li>
          ))}
          {e.sponges > 0 && (
            <li>
              <span>Workshop and kiln runs</span>
              <strong>−{e.sponges}</strong>
            </li>
          )}
          {e.storageCharged > 0 && (
            <li>
              <span>Into storage</span>
              <strong>−{e.storageCharged}</strong>
            </li>
          )}
          {e.heat.free > 0 && (
            <li class="quiet">
              <span>Heat paid by free heat</span>
              <strong>{e.heat.free}</strong>
            </li>
          )}
          {e.heat.pumped > 0 && (
            <li class="quiet">
              <span>Heat from heat pumps (for {e.heat.pumpEnergy} energy)</span>
              <strong>{e.heat.pumped}</strong>
            </li>
          )}
        </ul>
        <div class={`small strong ${e.shortfall > 0 ? 'bad' : 'quiet'}`}>
          {e.shortfall > 0 ? `Short by ${e.shortfall}` : `${e.unused} unused`}
        </div>
      </td>
    );
  };
  return (
    <table class="report-table energy">
      <thead>
        <tr>
          <th>Day</th>
          <th>Night</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          {column('day')}
          {column('night')}
        </tr>
      </tbody>
    </table>
  );
}

function Bonuses({ store, report }: { store: GameStore; report: SeasonReport }) {
  const { content, state } = store;
  const combos = new Map<string, number>();
  for (const hit of report.combos) combos.set(hit.combo, (combos.get(hit.combo) ?? 0) + 1);
  const bonusLines = RESOURCES.flatMap((res) =>
    Object.entries(report.flows[res]?.made ?? {})
      .filter(([label]) => label.endsWith(' bonus'))
      .map(
        ([label, l]) =>
          `${label}: +${l.amount} ${res}${l.count > 1 ? ` (${l.count} buildings)` : ''}`,
      ),
  );
  const runs = Object.entries(report.runs).filter(([, r]) => r.runs > 0);
  const lines: string[] = [];
  if (report.harmony.multiplier !== 1)
    lines.push(
      `Harmony ${report.harmony.value}: food, biomass and knowledge × ${report.harmony.multiplier}.`,
    );
  if (report.silted.length > 0) lines.push(`Silt on ${report.silted.length} farms.`);
  if (report.mixedGrid) lines.push('Mixed Grid: extra energy in every slot, no storm damage.');
  const tunings = state.tunings.map((id) => content.tuningById[id]?.name ?? id);
  const charters = state.charters.map((id) => content.charterById[id]?.name ?? id);
  return (
    <div class="report-bonuses">
      <div>
        <h3>Combos at work</h3>
        {combos.size === 0 ? (
          <p class="quiet small">None.</p>
        ) : (
          <ul class="plain small">
            {[...combos].map(([id, n]) => {
              const combo = content.comboById[id];
              return (
                <li>
                  <strong>{combo?.name ?? id}</strong>
                  {n > 1 ? ` ×${n}` : ''}{' '}
                  <span class="quiet">({combo ? LAYER_NAMES[combo.layer] : ''})</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <h3>Bonuses</h3>
        <ul class="plain small">
          {[...bonusLines, ...lines].map((l) => (
            <li>{l}</li>
          ))}
          {bonusLines.length + lines.length === 0 && <li class="quiet">None.</li>}
        </ul>
        {(tunings.length > 0 || charters.length > 0) && (
          <p class="small">
            {tunings.length > 0 && <>Tunings: {tunings.join(', ')}. </>}
            {charters.length > 0 && <>Charters: {charters.join(', ')}.</>}
          </p>
        )}
      </div>
      <div>
        <h3>Workshops and kilns</h3>
        {runs.length === 0 ? (
          <p class="quiet small">No runs.</p>
        ) : (
          <ul class="plain small">
            {runs.map(([uid, r]) => (
              <li>
                {content.byId[state.buildings[uid]?.type ?? '']?.name ?? 'A building since removed'}
                :{' '}
                {Object.entries(r.byRecipe ?? { [r.recipe]: r.runs })
                  .map(([id, n]) => `${n} ${id}`)
                  .join(', ')}{' '}
                runs, {r.energy.day + r.energy.night} energy
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3>People</h3>
        <p class="small">
          Wellbeing {report.wellbeing.before} → {report.wellbeing.after}; citizens{' '}
          {report.population.before} → {report.population.after}.
        </p>
        <ul class="plain flow small">
          {report.wellbeing.lines.map((l) => (
            <li>
              <span>{l.reason}</span>
              <strong class={l.amount < 0 ? 'bad' : 'good'}>
                {l.amount > 0 ? `+${l.amount}` : `−${-l.amount}`}
              </strong>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SeasonReportDialog({
  store,
  season,
  onClose,
}: {
  store: GameStore;
  /** Open on the last report of this season (the latest when not given). */
  season?: Season;
  onClose: () => void;
}) {
  const reports = store.state.recentReports;
  const initial = season
    ? Math.max(
        0,
        reports.findLastIndex((r) => r.season === season),
      )
    : reports.length - 1;
  const [index, setIndex] = useState(initial);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => close.current?.focus(), []);
  const report = reports[index];
  const { content } = store;
  return (
    <div class="modal-backdrop" onClick={onClose}>
      <div
        class="modal season-report"
        role="dialog"
        aria-modal="true"
        aria-label="Season report"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && onClose()}
      >
        <div class="panel-head">
          <h2>Season report</h2>
          <button type="button" class="button" ref={close} onClick={onClose}>
            Close
          </button>
        </div>
        {reports.length === 0 ? (
          <p class="small">No season has ended yet.</p>
        ) : (
          <>
            <div class="row" role="tablist" aria-label="Seasons">
              {reports.map((r, i) => (
                <button
                  type="button"
                  role="tab"
                  class={`button tab${i === index ? ' primary' : ''}`}
                  aria-selected={i === index}
                  onClick={() => setIndex(i)}
                >
                  {SEASON_NAMES[r.season]}, year {r.year}
                </button>
              ))}
            </div>
            {report && (
              <div
                role="tabpanel"
                aria-label={`${SEASON_NAMES[report.season]}, year ${report.year}`}
              >
                <p class="small quiet">
                  {content.events[report.event].name}. Harmony {report.harmony.value}.{' '}
                  {report.population.change !== 0
                    ? `${report.population.change > 0 ? '+' : ''}${report.population.change} citizens.`
                    : ''}
                </p>
                <h3>Resources</h3>
                <SankeyDiagram flows={report.flows} />
                <Resources report={report} />
                <h3>Energy</h3>
                <Energy content={content} report={report} />
                <Bonuses store={store} report={report} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
