/**
 * Steps 5 to 7: flexible consumers, storage and demand, slot by slot.
 *
 * Heat demand is paid first by free heat (solar thermal), then by heat pumps
 * (2 heat per energy), and the rest directly, 1 energy per heat.
 *
 * Storage first reserves the spare day energy (or free heat) it needs to cover
 * a night shortfall it can already see (covering demand is a need, not a
 * spare); flexible consumers then use what is spare; storage then charges from
 * what is still spare; demand is paid, storage discharges into shortfalls and
 * any gap left becomes a blackout, shutting buildings off lowest priority first.
 */
import type { Slot } from '../content/schema';
import { SLOTS } from '../content/schema';
import { byPriority, defOf, neighborBuildings, occupancy } from '../queries';
import type { BuildingState } from '../types';
import { addYield, explain, type SeasonContext } from './context';

type PerSlot = Record<Slot, number>;
const perSlot = (): PerSlot => ({ day: 0, night: 0 });

interface Settlement {
  /** Energy the buildings need once free heat and heat pumps have paid what they can. */
  demand: number;
  heat: number;
  free: number;
  pumped: number;
  pumpEnergy: number;
  /** Heat still to pay directly with energy. */
  direct: number;
  /** Heat paid and energy drawn, per heat pump uid. */
  byPump: Record<string, { heat: number; energy: number }>;
}

export function resolveEnergy(ctx: SeasonContext): void {
  const { content, state, si, report } = ctx;
  const active = byPriority(state).filter((b) => ctx.active.has(b.uid));

  const energyOf = (b: BuildingState, slot: Slot) =>
    defOf(content, b).demand?.energy[slot][si] ?? 0;
  const heatOf = (b: BuildingState, slot: Slot) => defOf(content, b).demand?.heat[slot][si] ?? 0;
  const pumps = active.filter((b) => defOf(content, b).heatPump);
  const freeHeat = perSlot();
  for (const slot of SLOTS) {
    freeHeat[slot] = Object.values(report.energy[slot].heat.bySource).reduce((a, b) => a + b, 0);
  }

  /** What the buildings that are still on need in a slot. */
  const settle = (slot: Slot, off: Set<string>): Settlement => {
    const on = active.filter((b) => !off.has(b.uid));
    const energy = on.reduce((sum, b) => sum + energyOf(b, slot), 0);
    const heat = on.reduce((sum, b) => sum + heatOf(b, slot), 0);
    const free = Math.min(heat, freeHeat[slot]);
    let rest = heat - free;
    let pumped = 0;
    let pumpEnergy = 0;
    const byPump: Settlement['byPump'] = {};
    for (const p of pumps) {
      const hp = defOf(content, p).heatPump!;
      const units = Math.min(
        Math.floor(rest / hp.heatPerEnergy),
        Math.floor(hp.maxHeatPerSlot / hp.heatPerEnergy),
      );
      if (units === 0) continue;
      byPump[p.uid] = { heat: units * hp.heatPerEnergy, energy: units };
      pumped += units * hp.heatPerEnergy;
      pumpEnergy += units;
      rest -= units * hp.heatPerEnergy;
    }
    return {
      demand: energy + rest + pumpEnergy,
      heat,
      free,
      pumped,
      pumpEnergy,
      direct: rest,
      byPump,
    };
  };

  const spare = perSlot();
  const short = perSlot();
  /** Heat still paid directly with energy: the part stored heat can cover. */
  const heatDemand = perSlot();
  const heatPaid = perSlot();
  const spareHeat = perSlot();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    const s = settle(slot, new Set());
    r.demand = s.demand;
    Object.assign(r.heat, {
      demand: s.heat,
      free: s.free,
      pumped: s.pumped,
      pumpEnergy: s.pumpEnergy,
      direct: s.direct,
    });
    for (const [uid, paid] of Object.entries(s.byPump)) {
      explain(
        ctx,
        state.buildings[uid]!,
        `${slot}: paid ${paid.heat} heat with ${paid.energy} energy`,
      );
    }
    heatDemand[slot] = s.direct;
    spareHeat[slot] = freeHeat[slot] - s.free;
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

  // Reserve for the night shortfall: heat wells take spare free heat, then spare day
  // energy, for the heat part; energy storage takes spare day energy for the rest.
  const heatFirst = [...storages].sort(
    (a, b) => Number(storageDef(b).holds === 'heat') - Number(storageDef(a).holds === 'heat'),
  );
  for (const b of heatFirst) {
    if (short.night === 0 || spare.day + spareHeat.day === 0) break;
    const s = storageDef(b);
    if (!s.chargesFrom.includes('day')) continue;
    if (s.holds === 'heat') {
      const give = Math.min(
        short.night,
        heatDemand.night - heatPaid.night,
        room(b),
        spareHeat.day + spare.day,
      );
      if (give <= 0) continue;
      const fromHeat = Math.min(give, spareHeat.day);
      spareHeat.day -= fromHeat;
      report.energy.day.heat.stored += fromHeat;
      if (give > fromHeat) {
        charge(b, 'day', give - fromHeat);
        report.energy.day.reserved += give - fromHeat;
        b.stored! -= give - fromHeat;
      }
      heatPaid.night += give;
      discharge('night', give);
    } else {
      if (spare.day === 0) continue;
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

  // Storage charges from whatever is still spare: free heat first, then energy.
  for (const b of storages) {
    for (const slot of storageDef(b).chargesFrom) {
      if (storageDef(b).holds === 'heat') {
        const heat = Math.min(spareHeat[slot], room(b));
        b.stored = (b.stored ?? 0) + heat;
        spareHeat[slot] -= heat;
        report.energy[slot].heat.stored += heat;
      }
      const amount = Math.min(spare[slot], room(b));
      if (amount > 0) charge(b, slot, amount);
    }
  }

  // Blackouts: shut buildings off, lowest priority first, until demand fits. Demand
  // is worked out again after each one, since heat pumps save less as heat demand falls.
  // A building shut off by day stays off at night.
  const off = new Set<string>();
  for (const slot of SLOTS) {
    const r = report.energy[slot];
    r.shortfall = short[slot];
    r.unused = spare[slot];
    if (short[slot] === 0) continue;
    const available = r.supply + r.storageDischarged;
    let gap = settle(slot, off).demand - available;
    for (const b of [...active].reverse()) {
      if (gap <= 0) break;
      if (off.has(b.uid) || energyOf(b, slot) + heatOf(b, slot) === 0) continue;
      off.add(b.uid);
      report.blackouts.push(b.uid);
      gap = settle(slot, off).demand - available;
      explain(ctx, b, `shut off in the ${slot} blackout`);
    }
  }
  for (const b of active) if (!off.has(b.uid)) ctx.powered.add(b.uid);
}
