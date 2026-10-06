/**
 * The season report: the last spring, summer, autumn and winter as they were
 * played, to read at leisure after the resolution has gone by. Each resource
 * made and used and by what (the simulation's ledger, which balances), the
 * energy by source and use, the combos, loops and other bonuses at work, and
 * wellbeing and population.
 */
import { ComboPicture } from './pictures';
import { eventOf } from '../sim';
import { useEffect, useRef, useState } from 'preact/hooks';
import { waterLedger, waterNotes } from '../game/waterInfo';
import { commuteNotes, waterWalkNotes } from '../game/commuteInfo';
import { heatNotes } from '../game/heatInfo';
import { energyDischarged } from '../game/insight';
import { coolNotes } from '../game/coolInfo';
import { lakeNotes } from '../game/lakeInfo';
import { forestNotes } from '../game/forestInfo';
import type { GameStore } from '../game/store';
import {
  energyLedger,
  RESOURCES,
  type Content,
  type FlowLines,
  type Resource,
  type Season,
  type SeasonReport,
  type WaterReport,
  type Slot,
} from '../sim';
import { LAYER_NAMES } from '../game/almanac';
import { SankeyDiagram } from './Sankey';
import { resourceGroups, type SankeyGroup } from './sankey';
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

/** Energy and heat count 1 for 1: one Sankey group for each slot. */
function energyGroups(content: Content, report: SeasonReport): SankeyGroup[] {
  const ledger = energyLedger(content, report);
  return [
    { key: 'day', label: 'Day', color: '#eda100', ...ledger.day },
    { key: 'night', label: 'Night', color: '#4a3aa7', ...ledger.night },
  ];
}

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
          {energyDischarged(report, slot) > 0 && (
            <li>
              <span>From storage</span>
              <strong>+{energyDischarged(report, slot)}</strong>
            </li>
          )}
        </ul>
        <div class="small strong">
          Used{' '}
          {e.demand +
            e.sponges +
            e.storageCharged +
            (e.heat.wellsReserved ?? 0) +
            (e.heat.wellsCharged ?? 0)}
        </div>
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
          {e.heat.direct + (e.heat.gridLoss ?? 0) > 0 && (
            <li>
              <span>Turned into heat, 1 for 1</span>
              <strong>−{e.heat.direct + (e.heat.gridLoss ?? 0)}</strong>
            </li>
          )}
          {e.heat.pumpEnergy > 0 && (
            <li>
              <span>Heat pumps</span>
              <strong>−{e.heat.pumpEnergy}</strong>
            </li>
          )}
        </ul>
        <div class={`small strong ${e.shortfall > 0 ? 'bad' : 'quiet'}`}>
          {e.shortfall > 0 ? `Short by ${e.shortfall}` : `${e.unused} unused`}
        </div>
        {e.heat.demand > 0 && <HeatColumn e={e} name={name} />}
        {(e.cool?.demand ?? 0) > 0 && <CoolColumn e={e} name={name} />}
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

/** Cooling (the Sun Desert): what needed it and what paid it. */
function CoolColumn({
  e,
  name,
}: {
  e: SeasonReport['energy']['day'];
  name: (id: string) => string;
}) {
  const c = e.cool!;
  const chilled = c.bySource.absorptionChiller ?? 0;
  const paid: [string, number][] = [
    ...Object.entries(c.bySource).map(([id, n]): [string, number] => [
      id === 'absorptionChiller' ? `${name(id)} (from ${c.fromHeat ?? chilled} heat)` : name(id),
      n,
    ]),
    [`The grid (for ${c.gridEnergy} energy)`, c.grid],
  ];
  return (
    <div class="heat-column cool-column">
      <div class="small strong">Cooling needed {c.demand}</div>
      <div class="small strong">Paid by</div>
      <ul class="plain flow">
        {paid
          .filter(([, n]) => n > 0)
          .map(([label, n]) => (
            <li>
              <span>{label}</span>
              <strong>{n}</strong>
            </li>
          ))}
        {c.hot > 0 && (
          <li class="bad">
            <span>Nothing: hot</span>
            <strong>{c.hot}</strong>
          </li>
        )}
      </ul>
    </div>
  );
}

/** Heat, apart from energy: what needed it and what paid it. */
function HeatColumn({
  e,
  name,
}: {
  e: SeasonReport['energy']['day'];
  name: (id: string) => string;
}) {
  const h = e.heat;
  const neighbor = h.neighbor ?? 0;
  const cold = h.cold ?? 0;
  const wells = Math.max(0, h.demand - h.free - neighbor - h.pumped - h.direct - cold);
  const paid: [string, number][] = [
    ['Solar thermal', h.free],
    ['A warm neighbour', neighbor],
    ['Heat wells', wells],
    [`Heat pumps (for ${h.pumpEnergy} energy)`, h.pumped],
    ['Energy, turned into heat', h.direct],
  ];
  return (
    <div class="heat-column">
      <div class="small strong">Heat needed {h.demand}</div>
      <ul class="plain flow">
        {Object.entries(e.heatBy ?? {}).map(([id, n]) => (
          <li>
            <span>{name(id)}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ul>
      <div class="small strong">Paid by</div>
      <ul class="plain flow">
        {paid
          .filter(([, n]) => n > 0)
          .map(([label, n]) => (
            <li>
              <span>{label}</span>
              <strong>{n}</strong>
            </li>
          ))}
        {cold > 0 && (
          <li class="bad">
            <span>Nothing: cold</span>
            <strong>{cold}</strong>
          </li>
        )}
      </ul>
    </div>
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
  if (report.salted.length > 0)
    lines.push(`Salt on ${report.salted.length} farms: half their food for a while.`);
  if (report.mixedGrid)
    lines.push(
      store.rules.events.storm?.mixedGridShelters
        ? 'Mixed Grid: extra energy in every slot, no storm damage.'
        : 'Mixed Grid: extra energy in every slot (no shelter from these storms).',
    );
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
                  {combo && <ComboPicture content={store.rules} combo={combo} />}
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

/** Where every unit of water came from and went this season (EXPANSION.md, E2). */
function Water({ store, report }: { store: GameStore; report: WaterReport }) {
  const ledger = waterLedger(store.rules, store.state, report);
  return (
    <>
      <h3>Water</h3>
      <SankeyDiagram
        groups={[{ key: 'water', label: 'Water', color: '#2f7fa8', ...ledger }]}
        label="Where the season's water came from and went. The list below has every value."
        unit="in and out"
      />
      <ul class="plain small water-notes">
        {waterNotes(store.rules, store.state, report).map((l) => (
          <li>{l}</li>
        ))}
      </ul>
    </>
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
                  {eventOf(content, report.event).name}. Harmony {report.harmony.value}.{' '}
                  {report.population.change !== 0
                    ? `${report.population.change > 0 ? '+' : ''}${report.population.change} citizens.`
                    : ''}
                </p>
                <h3>Resources</h3>
                <SankeyDiagram
                  groups={resourceGroups(report.flows)}
                  label="Where each resource came from and went this season. The table below has every value."
                  unit="made and used"
                />
                <Resources report={report} />
                <h3>Energy and heat</h3>
                <SankeyDiagram
                  groups={energyGroups(content, report)}
                  label="Where the day's and the night's energy and heat came from and went. The table below has every value."
                  unit="supplied and used"
                />
                <Energy content={content} report={report} />
                {report.water && <Water store={store} report={report.water} />}
                {report.heat && (
                  <>
                    <h3>Heat kept close</h3>
                    <ul class="plain small heat-notes">
                      {heatNotes(store.rules, store.state, report.heat, report.cold ?? []).map(
                        (l) => (
                          <li>{l}</li>
                        ),
                      )}
                    </ul>
                  </>
                )}
                {report.forest &&
                  forestNotes(report.forest, report.burned, report.felled, report.wildlife?.healed)
                    .length > 0 && (
                    <>
                      <h3>The forest</h3>
                      <ul class="plain small forest-notes">
                        {forestNotes(
                          report.forest,
                          report.burned,
                          report.felled,
                          report.wildlife?.healed,
                        ).map((l) => (
                          <li>{l}</li>
                        ))}
                      </ul>
                    </>
                  )}
                {report.lake && (
                  <>
                    <h3>The lake</h3>
                    <ul class="plain small lake-notes">
                      {lakeNotes(store.rules, report.lake).map((l) => (
                        <li>{l}</li>
                      ))}
                    </ul>
                  </>
                )}
                {report.cool && (
                  <>
                    <h3>Kept cool</h3>
                    <ul class="plain small heat-notes">
                      {coolNotes(store.rules, store.state, report.cool, report.hot ?? []).map(
                        (l) => (
                          <li>{l}</li>
                        ),
                      )}
                    </ul>
                  </>
                )}
                {report.commute && (
                  <>
                    <h3>Walks to work</h3>
                    <ul class="plain small walk-notes">
                      {commuteNotes(store.rules, store.state, report.commute).map((l) => (
                        <li>{l}</li>
                      ))}
                    </ul>
                    {report.commute.toWater && (
                      <>
                        <h3>Walks to water</h3>
                        <ul class="plain small walk-notes">
                          {waterWalkNotes(store.rules, store.state, report.commute).map((l) => (
                            <li>{l}</li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}
                <Bonuses store={store} report={report} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
