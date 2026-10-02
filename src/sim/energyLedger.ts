/**
 * A season's energy and heat as a ledger, per slot, for the season report:
 * where every unit came from and went. Heat and energy count 1 for 1, as the
 * rules pay them. It balances exactly:
 *
 *   in:  generators (and the Mixed Grid), free heat, heat from a neighbouring
 *        kiln or heat well (the Bathhouse), what heat pumps add
 *        beyond the energy they draw, storage released, and demand nobody
 *        supplied (the shortfall, met by blacking buildings out);
 *   out: each building's energy and heat demand (and demolition work),
 *        workshop and kiln runs, energy and free heat put into storage, what
 *        was left unused, and what heat bought from the grid loses when it
 *        costs more than 1 energy each (local heat, in a Long Winter).
 */
import type { Content } from './content/load';
import { SLOTS, type Slot } from './content/schema';
import type { FlowLines, SeasonReport } from './types';

export const SHORT = 'Short: not supplied';

export type EnergyLedger = Record<Slot, { made: FlowLines; used: FlowLines }>;

export function energyLedger(content: Content, report: SeasonReport): EnergyLedger {
  const name = (id: string) =>
    id === 'mixedGrid'
      ? 'Mixed Grid bonus'
      : id === 'demolition'
        ? 'Demolition work'
        : (content.byId[id]?.name ?? id);
  const out = {} as EnergyLedger;
  for (const slot of SLOTS) {
    const e = report.energy[slot];
    const made: FlowLines = {};
    const used: FlowLines = {};
    const add = (lines: FlowLines, label: string, amount: number) => {
      if (amount <= 0) return;
      const l = (lines[label] ??= { amount: 0, count: 1 });
      l.amount += amount;
    };
    for (const [id, n] of Object.entries(e.bySource)) add(made, name(id), n);
    for (const [id, n] of Object.entries(e.heat.bySource)) add(made, `${name(id)} (free heat)`, n);
    add(made, 'Heat from a neighbouring kiln or heat well', e.heat.neighbor ?? 0);
    add(made, 'Heat pumps (heat gained)', e.heat.pumped - e.heat.pumpEnergy);
    add(made, 'From storage', e.storageDischarged);
    add(made, SHORT, e.shortfall);
    add(made, 'Cold: heat no source paid', e.heat.cold ?? 0);
    for (const [id, n] of Object.entries(e.demandBy)) add(used, name(id), n);
    add(used, 'Workshop and kiln runs', e.sponges);
    add(used, 'Into storage', e.storageCharged + e.heat.stored);
    add(used, 'Unused', e.unused);
    add(used, 'Free heat unused', e.heat.unused);
    add(used, 'Heat bought from the grid: losses', e.heat.gridLoss ?? 0);
    out[slot] = { made, used };
  }
  return out;
}
