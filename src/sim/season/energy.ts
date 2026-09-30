/**
 * Steps 5 to 7: flexible consumers, storage and demand, slot by slot.
 *
 * Storage first reserves the spare day energy it needs to cover a night
 * shortfall it can already see (covering demand is a need, not a spare);
 * flexible consumers then use what is spare; storage then charges from what is
 * still spare; demand is paid, storage discharges into shortfalls and any gap
 * left becomes a blackout, shutting buildings off lowest priority first.
 */
import type { Slot } from '../content/schema';
import { SLOTS } from '../content/schema';
import { byPriority, defOf, neighborBuildings, occupancy } from '../queries';
import type { BuildingState } from '../types';
import { addYield, explain, type SeasonContext } from './context';

type PerSlot = Record<Slot, number>;
const perSlot = (): PerSlot => ({ day: 0, night: 0 });

export function resolveEnergy(ctx: SeasonContext): void {
  const { content, state, si, report } = ctx;
  const active = byPriority(state).filter((b) => ctx.active.has(b.uid));

  const demandOf = (b: BuildingState, slot: Slot) => {
    const d = defOf(content, b).demand;
    return d ? d.energy[slot][si]! + d.heat[slot][si]! : 0;
  };
  const heatDemandOf = (b: BuildingState, slot: Slot) =>
    defOf(content, b).demand?.heat[slot][si] ?? 0;

  const spare = perSlot();
  const short = perSlot();
  const heatDemand = perSlot();
  const heatPaid = perSlot();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    r.demand = active.reduce((sum, b) => sum + demandOf(b, slot), 0);
    heatDemand[slot] = active.reduce((sum, b) => sum + heatDemandOf(b, slot), 0);
    spare[slot] = Math.max(0, r.supply - r.demand);
    short[slot] = Math.max(0, r.demand - r.supply);
  }

  const storages = active.filter((b) => defOf(content, b).storage);
  const storageDef = (b: BuildingState) => defOf(content, b).storage!;
  const room = (b: BuildingState) => storageDef(b).capacity - (b.stored ?? 0);
  const discharge = (slot: Slot, amount: number) => {
    short[slot] -= amount;
    report.energy[slot].storageDischarged += amount;
  };
  const charge = (b: BuildingState, slot: Slot, amount: number) => {
    b.stored = (b.stored ?? 0) + amount;
    spare[slot] -= amount;
    report.energy[slot].storageCharged += amount;
  };
  /** Delivers up to `want` from an energy store, spending stored energy at its return ratio. */
  const drawEnergy = (b: BuildingState, want: number): number => {
    const { numerator, denominator } = storageDef(b).returns;
    const deliverable = Math.floor(((b.stored ?? 0) * numerator) / denominator);
    const give = Math.min(want, deliverable);
    b.stored = (b.stored ?? 0) - Math.ceil((give * denominator) / numerator);
    return give;
  };

  // Stored heat and energy from earlier seasons cover shortfalls first.
  for (const slot of SLOTS) {
    for (const b of storages) {
      if (short[slot] === 0) break;
      const s = storageDef(b);
      if (s.holds === 'heat') {
        const give = Math.min(short[slot], heatDemand[slot] - heatPaid[slot], b.stored ?? 0);
        b.stored = (b.stored ?? 0) - give;
        heatPaid[slot] += give;
        discharge(slot, give);
      } else {
        discharge(slot, drawEnergy(b, short[slot]));
      }
    }
  }

  // Reserve spare day energy for the night shortfall: heat wells for heat, then energy storage.
  for (const b of storages) {
    if (short.night === 0 || spare.day === 0) break;
    const s = storageDef(b);
    if (!s.chargesFrom.includes('day')) continue;
    if (s.holds === 'heat') {
      const give = Math.min(short.night, heatDemand.night - heatPaid.night, room(b), spare.day);
      if (give <= 0) continue;
      charge(b, 'day', give);
      report.energy.day.reserved += give;
      b.stored! -= give;
      heatPaid.night += give;
      discharge('night', give);
    } else {
      const { numerator, denominator } = s.returns;
      const need = Math.ceil((short.night * denominator) / numerator);
      const amount = Math.min(need, room(b), spare.day);
      if (amount <= 0) continue;
      charge(b, 'day', amount);
      report.energy.day.reserved += amount;
      discharge('night', drawEnergy(b, short.night));
    }
  }

  // Flexible consumers ("sponges") run only on spare energy.
  const occ = occupancy(state);
  for (const b of active) {
    const def = defOf(content, b);
    if (!def.recipes) continue;
    const recipeId = b.recipe ?? def.recipes.defaultRecipe;
    const recipe = def.recipes.options.find((o) => o.id === recipeId)!;
    const used = perSlot();
    let runs = 0;
    while (runs < def.recipes.maxRuns) {
      const inputs = Object.entries(recipe.inputs) as [keyof typeof state.stores, number][];
      if (inputs.some(([res, n]) => state.stores[res] < n)) break;
      const slot = SLOTS.find((s) => spare[s] >= def.recipes!.energyPerRun);
      if (!slot) break;
      spare[slot] -= def.recipes.energyPerRun;
      used[slot] += def.recipes.energyPerRun;
      report.energy[slot].sponges += def.recipes.energyPerRun;
      for (const [res, n] of inputs) {
        state.stores[res] -= n;
        if (res === 'clutter') report.clutter.recycled += n;
      }
      for (const [res, n] of Object.entries(recipe.outputs) as [
        keyof typeof state.stores,
        number,
      ][]) {
        addYield(ctx, b, res, n);
      }
      if (recipe.heatToNeighborStorage > 0) {
        const well = neighborBuildings(state, b, occ).find(
          (n) => defOf(content, n).storage?.holds === 'heat' && room(n) > 0,
        );
        if (well)
          well.stored = (well.stored ?? 0) + Math.min(recipe.heatToNeighborStorage, room(well));
      }
      runs++;
    }
    report.runs[b.uid] = { recipe: recipeId, runs, energy: used };
    explain(
      ctx,
      b,
      `${runs} ${recipeId} runs using ${used.day} day and ${used.night} night energy`,
    );
  }

  // Storage charges from whatever is still spare.
  for (const b of storages) {
    for (const slot of storageDef(b).chargesFrom) {
      const amount = Math.min(spare[slot], room(b));
      if (amount > 0) charge(b, slot, amount);
    }
  }

  // Blackouts: shut buildings off, lowest priority first, until demand fits.
  const off = new Set<string>();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    r.shortfall = short[slot];
    r.unused = spare[slot];
    let gap = short[slot];
    for (const b of [...active].reverse()) {
      if (gap <= 0) break;
      const d = demandOf(b, slot);
      if (d === 0 || off.has(b.uid)) continue;
      off.add(b.uid);
      report.blackouts.push(b.uid);
      gap -= d;
      explain(ctx, b, `shut off in the ${slot} blackout`);
    }
  }
  for (const b of active) if (!off.has(b.uid)) ctx.powered.add(b.uid);
}
